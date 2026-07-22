-- ============================================================
-- MIA Marketplace — Migration 022: Rate limiting des RPC sensibles
-- ============================================================
-- Recommandation d'audit sécurité : "Pas de rate limiting visible sur
-- /functions/v1/*. Possibles brute-force OTP ou abuse de
-- claim_daily_login_reward." Point légitime - même si
-- claim_daily_login_reward refuse déjà une 2e réclamation le même jour,
-- rien n'empêchait des dizaines d'appels par seconde qui échouent tous
-- mais consomment des ressources serveur (déni de service à faible coût
-- pour l'attaquant). Ce garde-fou générique protège toute RPC appelée
-- fréquemment par un client, pas seulement les gains gratuits.

create table public.rate_limit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  action_key text not null, -- ex: 'claim_daily_login_reward', 'confirm_delivery_otp_attempt'
  created_at timestamptz not null default now()
);

create index idx_rate_limit_log_lookup on public.rate_limit_log (user_id, action_key, created_at desc);

-- Nettoyage périodique (à appeler depuis un cron Edge Function, ou
-- simplement laisser grossir - la table reste petite car on ne garde que
-- quelques minutes d'historique par utilisateur/action en pratique).
create or replace function public.cleanup_old_rate_limit_logs()
returns void language sql security definer set search_path = public as $$
  delete from public.rate_limit_log where created_at < now() - interval '1 hour';
$$;

-- ----------------------------------------------------------------------
-- fn: enforce_rate_limit - à appeler en tout début d'une fonction
-- sensible. Lève une exception si p_max_attempts a été atteint dans la
-- fenêtre p_window_seconds pour ce user_id + action_key.
-- ----------------------------------------------------------------------
create or replace function public.enforce_rate_limit(
  p_user_id uuid,
  p_action_key text,
  p_max_attempts integer,
  p_window_seconds integer
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_recent_count integer;
begin
  select count(*) into v_recent_count
    from public.rate_limit_log
    where user_id = p_user_id
      and action_key = p_action_key
      and created_at > now() - make_interval(secs => p_window_seconds);

  if v_recent_count >= p_max_attempts then
    raise exception 'RATE_LIMIT_EXCEEDED' using errcode = 'P0001';
  end if;

  insert into public.rate_limit_log (user_id, action_key) values (p_user_id, p_action_key);
end;
$$;

-- ----------------------------------------------------------------------
-- Application concrète : claim_daily_login_reward, claim_reward_task,
-- claim_ad_reward, et confirm_delivery (protège contre le brute-force du
-- code OTP à 4 chiffres, signalé à raison par l'audit - 10000
-- combinaisons possibles, sans limite un script pourrait toutes les
-- essayer en quelques secondes).
-- ----------------------------------------------------------------------
create or replace function public.claim_daily_login_reward(p_user_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_yesterday_streak integer;
  v_new_streak integer;
  v_coins integer;
begin
  perform public.enforce_rate_limit(p_user_id, 'claim_daily_login_reward', 5, 60);

  if exists (select 1 from public.daily_login_rewards where user_id = p_user_id and reward_date = current_date) then
    raise exception 'ALREADY_CLAIMED_TODAY';
  end if;
  if not public.can_receive_free_coins(p_user_id) then
    raise exception 'ACCOUNT_FLAGGED';
  end if;

  select streak_day into v_yesterday_streak from public.daily_login_rewards
    where user_id = p_user_id and reward_date = current_date - interval '1 day';

  v_new_streak := case when v_yesterday_streak is not null then least(v_yesterday_streak + 1, 7) else 1 end;
  v_coins := case when v_new_streak = 7 then 10 else v_new_streak end;

  insert into public.daily_login_rewards (user_id, reward_date, coins_awarded, streak_day)
    values (p_user_id, current_date, v_coins, v_new_streak);

  perform public.credit_coins(p_user_id, v_coins, format('Connexion quotidienne (jour %s)', v_new_streak));

  return v_coins;
end;
$$;

create or replace function public.claim_reward_task(p_user_id uuid, p_task_id text)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_task record;
  v_last_claim timestamptz;
begin
  perform public.enforce_rate_limit(p_user_id, 'claim_reward_task', 10, 60);

  select * into v_task from public.reward_tasks where id = p_task_id and is_active = true;
  if v_task is null then raise exception 'TASK_NOT_FOUND'; end if;
  if not public.can_receive_free_coins(p_user_id) then raise exception 'ACCOUNT_FLAGGED'; end if;

  if v_task.is_repeatable then
    select max(claimed_at) into v_last_claim from public.reward_task_claims
      where user_id = p_user_id and task_id = p_task_id;
    if v_last_claim is not null and v_task.cooldown_hours is not null
       and v_last_claim > now() - make_interval(hours => v_task.cooldown_hours) then
      raise exception 'COOLDOWN_ACTIVE';
    end if;
  else
    if exists (select 1 from public.reward_task_claims where user_id = p_user_id and task_id = p_task_id) then
      raise exception 'ALREADY_CLAIMED';
    end if;
  end if;

  insert into public.reward_task_claims (user_id, task_id, coins_awarded)
    values (p_user_id, p_task_id, v_task.coins_reward);

  perform public.credit_coins(p_user_id, v_task.coins_reward, format('Tâche: %s', v_task.title));

  return v_task.coins_reward;
end;
$$;

-- confirm_delivery : ajoute le rate limit sur les TENTATIVES (bonnes ou
-- mauvaises) de code OTP, indépendamment de la vérification elle-même -
-- c'est ce qui bloque un script qui essaierait les 10000 combinaisons.
create or replace function public.confirm_delivery(
  p_delivery_id uuid,
  p_otp_code text,
  p_proof_photo_url text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_delivery record;
begin
  perform public.enforce_rate_limit(auth.uid(), 'confirm_delivery_otp_attempt', 8, 300);

  select * into v_delivery from public.deliveries where id = p_delivery_id for update;
  if v_delivery is null then raise exception 'DELIVERY_NOT_FOUND'; end if;
  if v_delivery.driver_id <> auth.uid() then raise exception 'NOT_YOUR_DELIVERY'; end if;
  if v_delivery.status = 'delivered' then
    return;
  end if;
  if v_delivery.otp_code is null or v_delivery.otp_code <> p_otp_code then
    raise exception 'INVALID_OTP';
  end if;

  update public.deliveries
    set status = 'delivered', delivered_at = now(), proof_photo_url = coalesce(p_proof_photo_url, proof_photo_url)
    where id = p_delivery_id;

  update public.orders set status = 'delivered', updated_at = now()
    where id = v_delivery.order_id and status in ('pending', 'shipped');
end;
$$;

grant execute on function public.confirm_delivery(uuid, text, text) to authenticated;

alter table public.rate_limit_log enable row level security;
create policy "rate_limit_log_admin_select" on public.rate_limit_log for select using (public.is_admin());
-- Aucune policy insert/update/delete pour authenticated : seule
-- enforce_rate_limit (SECURITY DEFINER) peut écrire ici.
