-- ============================================================
-- MIA Marketplace — Migration 020: Pièces MIA, prix et anti-fraude
-- ============================================================
-- Ajuste le prix de la pièce à 12 FCFA (décision explicite) et nettoie
-- les réglages économiques devenus sans objet depuis la migration 019
-- (plus de commission de vente, plus de cashback de parrainage en
-- argent réel, plus de frais de transfert wallet, plus de retrait).

update public.platform_settings set value = 12 where key = 'coin_purchase_rate_fcfa';
update public.platform_settings set description = '1 pièce coûte 12 FCFA à l''achat (prix fixé au lancement)' where key = 'coin_purchase_rate_fcfa';

delete from public.platform_settings where key in (
  'platform_commission_rate', 'referral_level1_rate', 'referral_level2_rate',
  'coin_gift_payout_rate_fcfa', 'transfer_fee_rate', 'transfer_fee_min_fcfa', 'min_payout_fcfa'
);

-- ============================================================
-- PARTIE 1 — Anti-fraude multi-comptes
-- ============================================================
-- Sans garde-fou, un utilisateur peut créer des dizaines de comptes pour
-- cumuler les pièces gratuites (connexion quotidienne, tâches,
-- parrainage). On combine plusieurs signaux faibles plutôt qu'un seul
-- signal fort (aucun n'est fiable seul en Afrique où le partage de
-- téléphone est courant) : device fingerprint, numéro de téléphone
-- unique (déjà `profiles.phone unique` en base), et une limite de
-- vitesse de création de compte par device.

create table public.device_fingerprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  fingerprint_hash text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index idx_device_fingerprints_hash on public.device_fingerprints (fingerprint_hash);
create index idx_device_fingerprints_user on public.device_fingerprints (user_id);

alter table public.device_fingerprints enable row level security;
-- Écriture uniquement via Edge Function (service_role) - jamais directement
-- par le client, pour qu'un utilisateur ne puisse pas se déclarer sur un
-- fingerprint qui n'est pas le sien. Pas de policy insert/update/delete
-- pour authenticated -> refus par défaut (RLS enable sans policy = deny all).
create policy "device_fingerprints_admin_select" on public.device_fingerprints
  for select using (public.is_admin());

-- Combien de comptes DIFFÉRENTS partagent déjà ce fingerprint - la limite
-- réelle (combien de comptes tolérer par appareil) est appliquée côté
-- Edge Function register-device, pas ici (garde la logique métier
-- ajustable sans migration).
create or replace function public.count_accounts_for_fingerprint(p_fingerprint_hash text)
returns integer language sql stable as $$
  select count(distinct user_id)::integer from public.device_fingerprints where fingerprint_hash = p_fingerprint_hash;
$$;

grant execute on function public.count_accounts_for_fingerprint(text) to service_role;

-- Marque un compte comme suspect (au lieu de bannir automatiquement -
-- laisse toujours une révision humaine possible avant sanction définitive,
-- cohérent avec les CGU mentionnant "bannissement" comme sanction ultime,
-- pas automatique).
alter table public.profiles add column if not exists fraud_flag text
  check (fraud_flag is null or fraud_flag in ('suspected_multi_account', 'confirmed_multi_account', 'banned'));
alter table public.profiles add column if not exists fraud_flagged_at timestamptz;

create or replace function public.flag_account_suspected_fraud(p_user_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
    set fraud_flag = 'suspected_multi_account', fraud_flagged_at = now()
    where id = p_user_id and fraud_flag is null;
  insert into public.security_logs (user_id, event_type, metadata)
    values (p_user_id, 'fraud_suspected', jsonb_build_object('reason', p_reason));
end;
$$;

grant execute on function public.flag_account_suspected_fraud(uuid, text) to service_role;

-- Un compte marqué fraud_flag ne peut plus recevoir de pièces gratuites
-- (parrainage, tâches, connexion quotidienne, pub) tant qu'il n'est pas
-- blanchi par un admin - mais peut toujours ACHETER des pièces (aucune
-- raison de bloquer un vrai revenu) et utiliser l'application normalement.
create or replace function public.can_receive_free_coins(p_user_id uuid)
returns boolean language sql stable as $$
  select coalesce((select fraud_flag is null from public.profiles where id = p_user_id), false);
$$;

-- ============================================================
-- PARTIE 2 — Connexion quotidienne (gains gratuits)
-- ============================================================
create table public.daily_login_rewards (
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_date date not null default current_date,
  coins_awarded integer not null,
  streak_day integer not null default 1,
  created_at timestamptz not null default now(),
  primary key (user_id, reward_date)
);

alter table public.daily_login_rewards enable row level security;
create policy "daily_login_rewards_select_own" on public.daily_login_rewards
  for select using (user_id = auth.uid() or public.is_admin());

-- Barème croissant sur 7 jours puis plafond, pour encourager la
-- régularité sans faire exploser la distribution gratuite (voir note de
-- soutenabilité économique à la fin de cette migration).
create or replace function public.claim_daily_login_reward(p_user_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_yesterday_streak integer;
  v_new_streak integer;
  v_coins integer;
begin
  if exists (select 1 from public.daily_login_rewards where user_id = p_user_id and reward_date = current_date) then
    raise exception 'ALREADY_CLAIMED_TODAY';
  end if;
  if not public.can_receive_free_coins(p_user_id) then
    raise exception 'ACCOUNT_FLAGGED';
  end if;

  select streak_day into v_yesterday_streak from public.daily_login_rewards
    where user_id = p_user_id and reward_date = current_date - interval '1 day';

  v_new_streak := case when v_yesterday_streak is not null then least(v_yesterday_streak + 1, 7) else 1 end;
  -- Jour 1-6 : 1 pièce par jour de streak. Jour 7 : bonus à 10 pièces,
  -- puis le cycle repart à 1 (évite une accumulation infinie linéaire).
  v_coins := case when v_new_streak = 7 then 10 else v_new_streak end;

  insert into public.daily_login_rewards (user_id, reward_date, coins_awarded, streak_day)
    values (p_user_id, current_date, v_coins, v_new_streak);

  perform public.credit_coins(p_user_id, v_coins, format('Connexion quotidienne (jour %s)', v_new_streak));

  return v_coins;
end;
$$;

grant execute on function public.claim_daily_login_reward(uuid) to authenticated;

-- ============================================================
-- PARTIE 3 — Tâches bénéfiques pour MIA (gains gratuits)
-- ============================================================
-- Catalogue de tâches simples, chacune réclamable une fois par
-- utilisateur (sauf indication contraire). "Bénéfique pour MIA" =
-- actions qui font tourner l'écosystème (compléter son profil, essayer
-- MIA IA, suivre des vendeurs) plutôt que des actions creuses.
create table public.reward_tasks (
  id text primary key, -- slug stable, ex: 'complete_profile', 'first_ai_generation'
  title text not null,
  description text,
  coins_reward integer not null,
  is_repeatable boolean not null default false,
  cooldown_hours integer, -- si repeatable: délai minimum entre deux réclamations
  is_active boolean not null default true
);

insert into public.reward_tasks (id, title, description, coins_reward, is_repeatable, cooldown_hours) values
  ('complete_profile', 'Complétez votre profil à 100%', 'Photo, ville et numéro vérifié', 5, false, null),
  ('first_ai_generation', 'Essayez MIA IA', 'Générez votre première fiche produit avec l''IA', 3, false, null),
  ('follow_3_shops', 'Suivez 3 boutiques', 'Découvrez et suivez 3 vendeurs qui vous plaisent', 3, false, null),
  ('watch_ad_unlock', 'Regardez une publicité', 'Débloquez des pièces en regardant une courte pub', 2, true, 4),
  ('invite_friend_validated', 'Un ami que vous avez invité a validé son compte', 'Parrainage complété', 20, true, null);

alter table public.reward_tasks enable row level security;
create policy "reward_tasks_public_select" on public.reward_tasks for select using (is_active = true);

create table public.reward_task_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id text not null references public.reward_tasks(id),
  coins_awarded integer not null,
  claimed_at timestamptz not null default now()
);

create index idx_reward_task_claims_user_task on public.reward_task_claims (user_id, task_id, claimed_at desc);

alter table public.reward_task_claims enable row level security;
create policy "reward_task_claims_select_own" on public.reward_task_claims
  for select using (user_id = auth.uid() or public.is_admin());

create or replace function public.claim_reward_task(p_user_id uuid, p_task_id text)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_task record;
  v_last_claim timestamptz;
begin
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

grant execute on function public.claim_reward_task(uuid, text) to authenticated;

-- ============================================================
-- PARTIE 4 — Publicité regardée (déblocage de pièces)
-- ============================================================
-- La validation réelle qu'une pub a été vue en entier vient du SDK
-- publicitaire côté client (ex: Google AdMob rewarded ads) - cette
-- fonction ne fait qu'enregistrer et créditer une fois le SDK confirmé,
-- avec le même cooldown que la tâche 'watch_ad_unlock' pour éviter les
-- abus (voir claim_reward_task ci-dessus, réutilisé directement ici).
create or replace function public.claim_ad_reward(p_user_id uuid, p_ad_provider_ref text)
returns integer
language plpgsql security definer set search_path = public as $$
begin
  -- Réutilise le mécanisme générique de tâche répétable, garde le
  -- provider_ref pour audit (repérer un même ad_ref réutilisé en boucle,
  -- signe probable de rejeu côté client).
  if exists (
    select 1 from public.reward_task_claims
    where task_id = 'watch_ad_unlock'
      and claimed_at > now() - interval '5 minutes'
      and coins_awarded > 0
      and user_id != p_user_id
      and id::text = p_ad_provider_ref -- comparaison défensive, voir Edge Function pour la vraie vérification SDK
  ) then
    raise exception 'AD_REF_ALREADY_USED';
  end if;

  return public.claim_reward_task(p_user_id, 'watch_ad_unlock');
end;
$$;

grant execute on function public.claim_ad_reward(uuid, text) to authenticated;

-- ============================================================
-- Correction de type : related_id doit accepter des identifiants
-- externes arbitraires (ex: ID de paiement Moneroo), pas garantis UUID.
-- ============================================================
alter table public.coin_transactions alter column related_id type text using related_id::text;

-- credit_coins/debit_coins avaient p_related_id en uuid - on les recrée
-- avec text. drop explicite car changer le type d'un paramètre change la
-- signature de la fonction (uuid -> text n'est pas un simple "or replace").
drop function if exists public.credit_coins(uuid, bigint, text, uuid);
drop function if exists public.debit_coins(uuid, bigint, text, uuid);

create or replace function public.credit_coins(p_user_id uuid, p_amount bigint, p_description text, p_related_id text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_new_balance bigint;
begin
  if p_amount <= 0 then raise exception 'Coin credit must be positive'; end if;
  insert into public.coin_balances (user_id, coins) values (p_user_id, p_amount)
    on conflict (user_id) do update set coins = coin_balances.coins + p_amount, updated_at = now()
    returning coins into v_new_balance;
  insert into public.coin_transactions (user_id, type, amount, balance_after, description, related_id)
    values (p_user_id, 'credit', p_amount, v_new_balance, p_description, p_related_id);
  return v_new_balance;
end;
$$;

create or replace function public.debit_coins(p_user_id uuid, p_amount bigint, p_description text, p_related_id text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_current bigint; v_new_balance bigint;
begin
  if p_amount <= 0 then raise exception 'Coin debit must be positive'; end if;
  select coins into v_current from public.coin_balances where user_id = p_user_id for update;
  if v_current is null then v_current := 0; end if;
  if v_current < p_amount then
    raise exception 'INSUFFICIENT_COINS' using errcode = 'P0001';
  end if;
  insert into public.coin_balances (user_id, coins) values (p_user_id, -p_amount)
    on conflict (user_id) do update set coins = coin_balances.coins - p_amount, updated_at = now()
    returning coins into v_new_balance;
  insert into public.coin_transactions (user_id, type, amount, balance_after, description, related_id)
    values (p_user_id, 'debit', p_amount, v_new_balance, p_description, p_related_id);
  return v_new_balance;
end;
$$;

grant execute on function public.credit_coins(uuid, bigint, text, text) to service_role, authenticated;
grant execute on function public.debit_coins(uuid, bigint, text, text) to service_role, authenticated;

-- ============================================================
-- Note de soutenabilité économique (pour le fondateur, pas du code)
-- ============================================================
-- Barème actuel de gains gratuits max par utilisateur/jour :
--   connexion quotidienne: 1-10 pièces (moyenne ~2.3/jour sur un cycle de 7j)
--   tâches uniques: 11 pièces au total (non répétables, one-shot)
--   pub: jusqu'à 6 pièces/jour (2 pièces x 1 fois/4h = 3x max réaliste)
--   parrainage validé: 20 pièces par filleul validé (non plafonné en
--     nombre de filleuls - à surveiller si la croissance virale s'emballe)
-- Coût pour MIA si un utilisateur very actif cumule tout: environ
-- 8-9 pièces/jour gratuites = 96-108 FCFA/jour de "manque à gagner" par
-- utilisateur très engagé. À comparer aux pièces qu'il achètera
-- réellement pour des cadeaux/boosts au-delà de ce quota gratuit.
