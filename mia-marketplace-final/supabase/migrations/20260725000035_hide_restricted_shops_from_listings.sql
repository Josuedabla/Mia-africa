-- ============================================================
-- MIA Marketplace — Migration 033: Boutique invisible publiquement
-- si solde de pièces ≤ -100 (Ticket 2 du chantier nouveau modèle coins)
-- ============================================================
-- Dépend du Ticket 0 (fonction public.is_shop_restricted(uuid), qui doit
-- être mergée avant celle-ci) : vrai si le solde du propriétaire de la
-- boutique est <= -100 pièces.
--
-- Règle : une boutique en dessous de -100 pièces disparaît de TOUTE
-- surface de découverte publique (recherche, tendances, tops ventes,
-- feed de découverte, produits similaires, boutiques à proximité,
-- carrousel spotlight) — mais reste 100% accessible via un lien direct
-- vers sa page produit ou sa page boutique (ProductPage.tsx / ShopPage.tsx
-- non touchés ici, aucune modification frontend nécessaire).
--
-- Chaque fonction ci-dessous est reprise dans sa version la PLUS RÉCENTE
-- déjà en place (et non celle de sa migration d'origine, quand une
-- migration plus tardive l'a redéfinie via create or replace function) :
--   - search_products, get_trending_products_capped,
--     get_discovery_feed_page : version de 20260723000031 (dernière
--     redéfinition, avec le filtre moderation_status = 'approved' déjà
--     ajouté par ce fichier) — PAS celle de 20260723000029 citée dans le
--     ticket, qui est déjà obsolète.
--   - get_best_sellers_capped, nearby_shops, similar_products,
--     get_spotlight_queue : aucune redéfinition ultérieure, version de
--     leur migration d'origine (018, 008, 012, 017 respectivement)
--     reprise telle quelle.
--
-- Ces quatre dernières fonctions ne sont pas explicitement citées dans le
-- ticket 2 (qui n'en cite que 3), mais correspondent à la même vérification
-- demandée par le ticket ("chercher git grep status = 'active' pour
-- repérer d'éventuelles autres requêtes de listing à corriger de la même
-- façon") : ce sont aussi des surfaces de découverte publique de
-- boutiques/produits (marquées `to ... anon` dans leurs grants). Les
-- classements hebdomadaires (get_weekly_leaderboard, get_my_top_shops,
-- get_shop_weekly_awards) sont volontairement laissés de côté : ce sont
-- des palmarès de performance passée, pas des surfaces de découverte au
-- sens du ticket — à confirmer avec le fondateur si ce n'est pas le
-- comportement voulu.

-- ---------- search_products ----------
create or replace function public.search_products(
  p_query text,
  p_country text default null,
  p_category text default null,
  p_limit int default 20,
  p_offset int default 0
) returns setof public.products
language sql stable as $$
  select p.*
  from public.products p
  where p.status = 'active'
    and p.moderation_status = 'approved'
    and not public.is_shop_restricted(p.shop_id)
    and (p_country is null or p.country_code = p_country)
    and (p_category is null or p.category = p_category)
    and (
      p_query is null or p_query = ''
      or p.search_vector @@ plainto_tsquery('french', p_query)
      or p.name % p_query   -- pg_trgm fuzzy match, catches typos
    )
  order by
    case when p_query is null or p_query = '' then 0
         else ts_rank(p.search_vector, plainto_tsquery('french', p_query)) + similarity(p.name, coalesce(p_query, ''))
    end desc,
    public.get_active_boost_score(p.id) desc,
    p.views desc
  limit p_limit offset p_offset;
$$;

-- ---------- get_trending_products_capped ----------
create or replace function public.get_trending_products_capped(
  p_country text,
  p_limit integer default 12,
  p_max_per_shop integer default 2
) returns setof public.products
language sql stable as $$
  select p.* from (
    select p.*,
      row_number() over (
        partition by p.shop_id
        order by p.views desc, public.get_active_boost_score(p.id) desc
      ) as rank_in_shop
    from public.products p
    where p.country_code = p_country
      and p.status = 'active'
      and p.moderation_status = 'approved'
      and not public.is_shop_restricted(p.shop_id)
  ) p
  where p.rank_in_shop <= p_max_per_shop
  order by public.get_active_boost_score(p.id) desc, p.views desc
  limit p_limit;
$$;

-- ---------- get_discovery_feed_page ----------
create or replace function public.get_discovery_feed_page(
  p_country text,
  p_page integer,
  p_page_size integer default 12,
  p_category text default null,
  p_user_id uuid default null
) returns setof public.products
language plpgsql stable as $$
declare
  v_followed_n integer;
  v_new_n integer;
  v_recommended_n integer;
  v_followed_available integer := 0;
begin
  if p_page_size is null or p_page_size < 1 then
    p_page_size := 12;
  end if;
  if p_page is null or p_page < 0 then
    p_page := 0;
  end if;

  v_followed_n := greatest(round(p_page_size * 0.2)::int, 0);
  v_new_n := greatest(round(p_page_size * 0.2)::int, 1);

  if p_user_id is not null then
    select count(*) into v_followed_available
    from public.followers f
    where f.follower_id = p_user_id and f.followed_shop_id is not null;
  end if;

  if v_followed_available = 0 then
    v_followed_n := 0;
  end if;

  v_recommended_n := greatest(p_page_size - v_followed_n - v_new_n, 1);

  return query
  with followed_pool as (
    select p.*
    from public.products p
    where v_followed_n > 0
      and p_user_id is not null
      and p.country_code = p_country
      and p.status = 'active'
      and p.moderation_status = 'approved'
      and not public.is_shop_restricted(p.shop_id)
      and (p_category is null or p.category = p_category)
      and p.shop_id in (
        select f.followed_shop_id from public.followers f
        where f.follower_id = p_user_id and f.followed_shop_id is not null
      )
    order by p.created_at desc
    offset v_followed_n * p_page
    limit v_followed_n
  ),
  new_pool as (
    select p.*
    from public.products p
    join public.shops s on s.id = p.shop_id
    where p.country_code = p_country
      and p.status = 'active'
      and p.moderation_status = 'approved'
      and not public.is_shop_restricted(p.shop_id)
      and (p_category is null or p.category = p_category)
      and (s.total_sales = 0 or s.created_at > now() - interval '30 days')
      and p.id not in (select id from followed_pool)
    order by p.created_at desc
    offset v_new_n * p_page
    limit v_new_n
  ),
  used_ids as (
    select id from followed_pool
    union
    select id from new_pool
  ),
  recommended_pool as (
    select p.*
    from public.products p
    where p.country_code = p_country
      and p.status = 'active'
      and p.moderation_status = 'approved'
      and not public.is_shop_restricted(p.shop_id)
      and (p_category is null or p.category = p_category)
      and p.id not in (select id from used_ids)
    order by public.get_active_boost_score(p.id) desc, p.views desc
    offset v_recommended_n * p_page
    limit v_recommended_n
  )
  select * from followed_pool
  union all
  select * from new_pool
  union all
  select * from recommended_pool;
end;
$$;

-- ---------- get_best_sellers_capped (migration 018, non redéfinie depuis) ----------
create or replace function public.get_best_sellers_capped(
  p_country text,
  p_limit integer default 12,
  p_max_per_shop integer default 2
) returns setof public.products
language sql stable as $$
  select p.* from (
    select p.*,
      row_number() over (partition by p.shop_id order by p.sales_count desc) as rank_in_shop
    from public.products p
    where p.country_code = p_country
      and p.status = 'active'
      and not public.is_shop_restricted(p.shop_id)
  ) p
  where p.rank_in_shop <= p_max_per_shop
  order by p.sales_count desc
  limit p_limit;
$$;

-- ---------- similar_products (migration 012, non redéfinie depuis) ----------
create or replace function public.similar_products(
  p_product_id uuid,
  p_sort_by text default 'smart',
  p_limit int default 20,
  p_offset int default 0
) returns setof public.products
language plpgsql stable as $$
declare
  v_category text;
  v_country text;
  v_shop_id uuid;
begin
  select category, country_code, shop_id into v_category, v_country, v_shop_id
    from public.products where id = p_product_id;

  return query
  select p.*
  from public.products p
  where p.status = 'active'
    and not public.is_shop_restricted(p.shop_id)
    and p.id <> p_product_id
    and p.category = v_category
    and p.country_code = v_country
  order by
    case p_sort_by
      when 'price_asc' then p.price
      when 'price_desc' then -p.price
      else null
    end asc nulls last,
    case p_sort_by
      when 'quality' then (p.rating * 20 + least(p.sales_count, 500) * 0.1)
      else null
    end desc nulls last,
    case p_sort_by
      when 'newest' then extract(epoch from p.created_at)
      else null
    end desc nulls last,
    (p.rating * 15
      + least(p.sales_count, 300) * 0.2
      + least(p.views, 2000) * 0.02
      + (case when p.is_boosted then 10 else 0 end)
      - (extract(epoch from now() - p.created_at) / 86400 * 0.05)
    ) desc
  limit p_limit offset p_offset;
end;
$$;

-- ---------- nearby_shops (migration 008, non redéfinie depuis) ----------
-- Filtre ici directement sur s.id (la boutique elle-même), pas p.shop_id.
create or replace function public.nearby_shops(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision default 15,
  p_country text default null
) returns table (
  id uuid, name text, slug text, category text, country_code text,
  rating numeric, seller_score int, logo_url text, distance_km double precision
)
language sql stable as $$
  select s.id, s.name, s.slug, s.category, s.country_code,
         s.rating, s.seller_score, s.logo_url,
         ST_Distance(s.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) / 1000.0 as distance_km
  from public.shops s
  where s.status = 'active'
    and not public.is_shop_restricted(s.id)
    and s.location is not null
    and ST_DWithin(s.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radius_km * 1000)
    and (p_country is null or s.country_code = p_country)
  order by distance_km asc
  limit 50;
$$;

-- ---------- get_spotlight_queue (migration 017, non redéfinie depuis) ----------
-- Filtre appliqué dans le CTE "eligible", sur sr.shop_id (la boutique).
create or replace function public.get_spotlight_queue(p_count integer default 8)
returns table (
  shop_id uuid, shop_name text, shop_slug text, shop_logo_url text,
  is_sponsored boolean, featured_product_id uuid, featured_product_name text
)
language plpgsql stable as $$
begin
  return query
  with eligible as (
    select
      sr.shop_id, sr.last_shown_at,
      (sr.boost_active and coalesce(sr.boost_expires_at, now()) > now()) as is_sponsored,
      case when sr.boost_active and coalesce(sr.boost_expires_at, now()) > now() then sr.boost_weight else 1 end as weight
    from public.spotlight_rotation sr
    join public.shops s on s.id = sr.shop_id
    where s.status = 'active'
      and not public.is_shop_restricted(sr.shop_id)
  ),
  weighted_pool as (
    select e.shop_id, e.last_shown_at, e.is_sponsored
    from eligible e, generate_series(1, e.weight)
  )
  select distinct on (wp.shop_id)
    s.id, s.name, s.slug, s.logo_url, wp.is_sponsored,
    p.id, p.name
  from weighted_pool wp
  join public.shops s on s.id = wp.shop_id
  left join lateral (
    select id, name from public.products
    where shop_id = s.id and status = 'active'
    order by created_at desc limit 1
  ) p on true
  order by wp.shop_id, wp.last_shown_at asc
  limit p_count;
end;
$$;

grant execute on function public.search_products(text, text, text, int, int) to authenticated, anon;
grant execute on function public.get_trending_products_capped(text, integer, integer) to authenticated, anon;
grant execute on function public.get_discovery_feed_page(text, integer, integer, text, uuid) to authenticated, anon;
grant execute on function public.get_best_sellers_capped(text, integer, integer) to authenticated, anon;
grant execute on function public.similar_products(uuid, text, int, int) to authenticated, anon;
grant execute on function public.nearby_shops(double precision, double precision, double precision, text) to authenticated, anon;
grant execute on function public.get_spotlight_queue(integer) to authenticated, anon;
