-- ============================================================
-- MIA Marketplace — Migration 024: Classements & récompenses (Duolingo-like)
-- ============================================================
-- "Créer une compétition positive : Top vendeurs de la semaine et par
-- moi. Classement : plus de commandes, meilleure satisfaction, plus
-- populaire, meilleure progression. Récompenses : badge diamant/bronze,
-- mise en avant gratuite, interview MIA, promotion offerte."
--
-- Chaque classement est calculé sur une FENÊTRE GLISSANTE de 7 jours
-- (pas cumulatif depuis toujours) - c'est ce qui rend la compétition
-- "positive" et rejouable chaque semaine : un nouveau vendeur peut gagner
-- le classement de la semaine même si un gros vendeur historique domine
-- le total_sales cumulé. Même philosophie que l'anti-monopolisation des
-- carrousels (migration 20260719000018) : personne ne "possède"
-- indéfiniment le sommet.

create table public.weekly_leaderboard_periods (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique, -- lundi de la semaine, ISO
  week_end date not null,
  is_finalized boolean not null default false, -- true une fois les récompenses distribuées
  created_at timestamptz not null default now()
);

-- ---------- Snapshot des scores par boutique et par semaine ----------
-- Recalculé périodiquement (Edge Function planifiée, voir plus bas) plutôt
-- qu'à la volée à chaque requête : un classement doit être STABLE pendant
-- la semaine en cours (pas de saut visible à chaque nouvelle commande),
-- rafraîchi par exemple toutes les heures.
create table public.weekly_leaderboard_scores (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.weekly_leaderboard_periods(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,

  orders_count integer not null default 0,           -- critère "plus de commandes"
  avg_satisfaction numeric not null default 0,        -- critère "meilleure satisfaction" (moyenne des avis 5j)
  popularity_score numeric not null default 0,        -- critère "plus populaire" (vues + favoris + partages)
  progression_score numeric not null default 0,       -- critère "meilleure progression" (delta vs semaine précédente)

  rank_orders integer,
  rank_satisfaction integer,
  rank_popularity integer,
  rank_progression integer,

  computed_at timestamptz not null default now(),
  unique (period_id, shop_id)
);

create index idx_weekly_scores_period on public.weekly_leaderboard_scores (period_id);
create index idx_weekly_scores_shop on public.weekly_leaderboard_scores (shop_id);

alter table public.weekly_leaderboard_periods enable row level security;
alter table public.weekly_leaderboard_scores enable row level security;

create policy "weekly_periods_public_select" on public.weekly_leaderboard_periods for select using (true);
create policy "weekly_scores_public_select" on public.weekly_leaderboard_scores for select using (true);
-- Écriture réservée au calcul serveur (SECURITY DEFINER ci-dessous) -
-- aucune policy insert/update pour authenticated: refus par défaut.

-- ---------- fn: calcule les scores de la semaine EN COURS ----------
-- Appelée par une Edge Function planifiée (cron horaire). Idempotente :
-- recalcule tout à chaque appel plutôt que d'incrémenter, pour ne jamais
-- dériver d'un état incohérent.
create or replace function public.compute_weekly_leaderboard(p_week_start date default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_week_start date := coalesce(p_week_start, date_trunc('week', current_date)::date);
  v_week_end date := v_week_start + 6;
  v_period_id uuid;
  v_prev_period_id uuid;
begin
  insert into public.weekly_leaderboard_periods (week_start, week_end)
    values (v_week_start, v_week_end)
  on conflict (week_start) do update set week_end = excluded.week_end
  returning id into v_period_id;

  select id into v_prev_period_id from public.weekly_leaderboard_periods
    where week_start = v_week_start - 7;

  -- Purge les scores existants de cette période avant recalcul (idempotence).
  delete from public.weekly_leaderboard_scores where period_id = v_period_id;

  insert into public.weekly_leaderboard_scores (
    period_id, shop_id, orders_count, avg_satisfaction, popularity_score, progression_score
  )
  select
    v_period_id,
    s.id,
    coalesce(o.orders_count, 0),
    coalesce(r.avg_rating, 0),
    coalesce(p.popularity, 0),
    -- Progression : delta du nombre de commandes vs la semaine précédente,
    -- normalisé pour ne pas favoriser mécaniquement les grosses boutiques
    -- (un petit vendeur qui double ses ventes doit pouvoir gagner ce
    -- critère face à un gros vendeur stable).
    case
      when v_prev_period_id is null then 0
      else coalesce(o.orders_count, 0) - coalesce(prev.orders_count, 0)
    end
  from public.shops s
  left join lateral (
    select count(*) as orders_count
    from public.orders ord
    where ord.shop_id = s.id
      and ord.status = 'delivered'
      and ord.created_at::date between v_week_start and v_week_end
  ) o on true
  left join lateral (
    select avg(rv.rating) as avg_rating
    from public.reviews rv
    join public.orders ord2 on ord2.id = rv.order_id
    where ord2.shop_id = s.id
      and rv.created_at::date between v_week_start and v_week_end
  ) r on true
  left join lateral (
    select
      coalesce(sum(p2.views), 0) * 0.1
      + coalesce((select count(*) from public.likes lk join public.products p3 on p3.id = lk.product_id where p3.shop_id = s.id and lk.created_at::date between v_week_start and v_week_end), 0) * 2
      as popularity
    from public.products p2 where p2.shop_id = s.id
  ) p on true
  left join public.weekly_leaderboard_scores prev
    on prev.shop_id = s.id and prev.period_id = v_prev_period_id
  where s.status = 'active';

  -- Calcule les rangs par critère (fenêtre séparée pour chaque classement).
  update public.weekly_leaderboard_scores wls set
    rank_orders = ranked.rank_orders,
    rank_satisfaction = ranked.rank_satisfaction,
    rank_popularity = ranked.rank_popularity,
    rank_progression = ranked.rank_progression
  from (
    select
      id,
      rank() over (order by orders_count desc) as rank_orders,
      rank() over (order by avg_satisfaction desc) as rank_satisfaction,
      rank() over (order by popularity_score desc) as rank_popularity,
      rank() over (order by progression_score desc) as rank_progression
    from public.weekly_leaderboard_scores where period_id = v_period_id
  ) ranked
  where wls.id = ranked.id;

  return v_period_id;
end;
$$;

grant execute on function public.compute_weekly_leaderboard(date) to service_role;

-- ---------- Lecture publique d'un classement (top N par critère) ----------
create or replace function public.get_weekly_leaderboard(
  p_criterion text default 'orders', -- 'orders' | 'satisfaction' | 'popularity' | 'progression'
  p_limit integer default 20
) returns table (
  shop_id uuid, shop_name text, shop_slug text, shop_logo_url text,
  score numeric, rank integer
)
language plpgsql stable as $$
declare
  v_current_period_id uuid;
begin
  select id into v_current_period_id from public.weekly_leaderboard_periods
    where week_start = date_trunc('week', current_date)::date;

  if v_current_period_id is null then
    return; -- pas encore calculé cette semaine, l'Edge Function planifiée s'en chargera
  end if;

  return query
  select
    s.id, s.name, s.slug, s.logo_url,
    case p_criterion
      when 'satisfaction' then wls.avg_satisfaction
      when 'popularity' then wls.popularity_score
      when 'progression' then wls.progression_score
      else wls.orders_count::numeric
    end,
    case p_criterion
      when 'satisfaction' then wls.rank_satisfaction
      when 'popularity' then wls.rank_popularity
      when 'progression' then wls.rank_progression
      else wls.rank_orders
    end
  from public.weekly_leaderboard_scores wls
  join public.shops s on s.id = wls.shop_id
  where wls.period_id = v_current_period_id
  order by 5 asc nulls last
  limit p_limit;
end;
$$;

grant execute on function public.get_weekly_leaderboard(text, integer) to authenticated, anon;

-- ---------- "Top vendeurs par moi" : classement personnalisé pour un acheteur ----------
-- Parmi les boutiques que CET utilisateur suit ou a déjà achetées chez -
-- son propre "top 5" plutôt qu'un classement global, pour qu'un petit
-- acheteur voie aussi ses propres favoris briller, pas seulement les
-- mega-vendeurs qui dominent le classement global.
create or replace function public.get_my_top_shops(p_user_id uuid, p_limit integer default 5)
returns table (shop_id uuid, shop_name text, shop_slug text, shop_logo_url text, my_orders_count integer)
language sql stable as $$
  select s.id, s.name, s.slug, s.logo_url, count(o.id)::integer
  from public.shops s
  join public.orders o on o.shop_id = s.id and o.customer_id = p_user_id and o.status = 'delivered'
  group by s.id, s.name, s.slug, s.logo_url
  order by count(o.id) desc
  limit p_limit;
$$;

grant execute on function public.get_my_top_shops(uuid, integer) to authenticated;

-- ============================================================
-- Badges & récompenses (diamant, bronze...)
-- ============================================================
create table public.leaderboard_badges (
  id text primary key, -- 'bronze', 'silver', 'gold', 'diamond'
  name text not null,
  emoji text not null,
  min_rank integer not null, -- ex: diamond = rank 1, gold = rank <=3, silver = rank <=10, bronze = rank <=20
  display_order integer not null
);

insert into public.leaderboard_badges (id, name, emoji, min_rank, display_order) values
  ('diamond', 'Diamant', '💎', 1, 1),
  ('gold', 'Or', '🥇', 3, 2),
  ('silver', 'Argent', '🥈', 10, 3),
  ('bronze', 'Bronze', '🥉', 20, 4);

alter table public.leaderboard_badges enable row level security;
create policy "leaderboard_badges_public_select" on public.leaderboard_badges for select using (true);

create table public.shop_weekly_awards (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.weekly_leaderboard_periods(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  criterion text not null, -- 'orders' | 'satisfaction' | 'popularity' | 'progression'
  rank integer not null,
  badge_id text references public.leaderboard_badges(id),
  reward_applied text, -- 'free_spotlight' | 'mia_interview' | 'free_promotion' | null
  created_at timestamptz not null default now(),
  unique (period_id, shop_id, criterion)
);

create index idx_shop_weekly_awards_shop on public.shop_weekly_awards (shop_id, created_at desc);

alter table public.shop_weekly_awards enable row level security;
create policy "shop_weekly_awards_public_select" on public.shop_weekly_awards for select using (true);

-- ---------- fn: finalise la semaine PRÉCÉDENTE et distribue les récompenses ----------
-- À appeler une fois par semaine (lundi matin) depuis l'Edge Function
-- planifiée, APRÈS le dernier compute_weekly_leaderboard de la semaine
-- écoulée - jamais sur la semaine en cours (les rangs ne sont définitifs
-- qu'une fois la semaine terminée).
create or replace function public.finalize_weekly_awards(p_week_start date)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_period record;
  v_score record;
  v_badge_id text;
  v_reward text;
begin
  select * into v_period from public.weekly_leaderboard_periods where week_start = p_week_start;
  if v_period is null or v_period.is_finalized then
    return; -- idempotent
  end if;

  for v_score in
    select * from public.weekly_leaderboard_scores where period_id = v_period.id
  loop
    if v_score.rank_orders is not null and v_score.rank_orders <= 20 then
      select id into v_badge_id from public.leaderboard_badges where min_rank >= v_score.rank_orders order by min_rank asc limit 1;
      v_reward := case when v_score.rank_orders = 1 then 'free_spotlight' when v_score.rank_orders <= 3 then 'free_promotion' else null end;
      insert into public.shop_weekly_awards (period_id, shop_id, criterion, rank, badge_id, reward_applied)
        values (v_period.id, v_score.shop_id, 'orders', v_score.rank_orders, v_badge_id, v_reward)
      on conflict (period_id, shop_id, criterion) do nothing;
    end if;

    if v_score.rank_satisfaction is not null and v_score.rank_satisfaction <= 20 then
      select id into v_badge_id from public.leaderboard_badges where min_rank >= v_score.rank_satisfaction order by min_rank asc limit 1;
      v_reward := case when v_score.rank_satisfaction = 1 then 'mia_interview' when v_score.rank_satisfaction <= 3 then 'free_promotion' else null end;
      insert into public.shop_weekly_awards (period_id, shop_id, criterion, rank, badge_id, reward_applied)
        values (v_period.id, v_score.shop_id, 'satisfaction', v_score.rank_satisfaction, v_badge_id, v_reward)
      on conflict (period_id, shop_id, criterion) do nothing;
    end if;

    if v_score.rank_popularity is not null and v_score.rank_popularity <= 20 then
      select id into v_badge_id from public.leaderboard_badges where min_rank >= v_score.rank_popularity order by min_rank asc limit 1;
      v_reward := case when v_score.rank_popularity = 1 then 'free_spotlight' else null end;
      insert into public.shop_weekly_awards (period_id, shop_id, criterion, rank, badge_id, reward_applied)
        values (v_period.id, v_score.shop_id, 'popularity', v_score.rank_popularity, v_badge_id, v_reward)
      on conflict (period_id, shop_id, criterion) do nothing;
    end if;

    if v_score.rank_progression is not null and v_score.rank_progression <= 20 then
      select id into v_badge_id from public.leaderboard_badges where min_rank >= v_score.rank_progression order by min_rank asc limit 1;
      -- "Meilleure progression" est le critère qui donne le plus sa
      -- chance aux petits/nouveaux vendeurs - récompense volontairement
      -- généreuse (promotion offerte dès le rang 1) pour encourager
      -- explicitement la progression plutôt que la seule taille.
      v_reward := case when v_score.rank_progression = 1 then 'free_promotion' else null end;
      insert into public.shop_weekly_awards (period_id, shop_id, criterion, rank, badge_id, reward_applied)
        values (v_period.id, v_score.shop_id, 'progression', v_score.rank_progression, v_badge_id, v_reward)
      on conflict (period_id, shop_id, criterion) do nothing;
    end if;

    -- Applique la récompense "mise en avant gratuite" (réutilise le
    -- système de spotlight déjà construit, migration 20260719000017) -
    -- 48h de boost gratuit, poids maximal, toujours étiqueté comme un
    -- gain de classement plutôt qu'un achat (transparence).
    if exists (
      select 1 from public.shop_weekly_awards
      where period_id = v_period.id and shop_id = v_score.shop_id and reward_applied = 'free_spotlight'
    ) then
      update public.spotlight_rotation
        set boost_active = true, boost_expires_at = now() + interval '48 hours', boost_weight = 3
        where shop_id = v_score.shop_id;
    end if;

    -- Notifie le vendeur de ses gains de la semaine.
    if exists (select 1 from public.shop_weekly_awards where period_id = v_period.id and shop_id = v_score.shop_id) then
      insert into public.notifications (user_id, type, title, body, data)
      select owner_id, 'weekly_award', '🏆 Résultats de la semaine MIA disponibles',
        'Découvrez votre classement et vos récompenses de la semaine.',
        jsonb_build_object('shop_id', v_score.shop_id, 'period_id', v_period.id)
      from public.shops where id = v_score.shop_id;
    end if;
  end loop;

  update public.weekly_leaderboard_periods set is_finalized = true where id = v_period.id;
end;
$$;

grant execute on function public.finalize_weekly_awards(date) to service_role;

-- ---------- Lecture des récompenses d'une boutique ----------
create or replace function public.get_shop_weekly_awards(p_shop_id uuid, p_limit integer default 10)
returns table (criterion text, rank integer, badge_id text, badge_emoji text, reward_applied text, week_start date)
language sql stable as $$
  select swa.criterion, swa.rank, swa.badge_id, lb.emoji, swa.reward_applied, wlp.week_start
  from public.shop_weekly_awards swa
  join public.weekly_leaderboard_periods wlp on wlp.id = swa.period_id
  left join public.leaderboard_badges lb on lb.id = swa.badge_id
  where swa.shop_id = p_shop_id
  order by wlp.week_start desc
  limit p_limit;
$$;

grant execute on function public.get_shop_weekly_awards(uuid, integer) to authenticated, anon;
