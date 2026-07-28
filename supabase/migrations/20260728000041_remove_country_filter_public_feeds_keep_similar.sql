-- ============================================================
-- MIA Marketplace — Migration 041: suppression de toute barrière pays
-- sur les surfaces de découverte publiques (Tendances, Nouveautés,
-- Tops Ventes, Feed de découverte, Recherche).
-- ============================================================
--
-- Bug rapporté : les produits d'un vendeur ne s'affichaient pas pour les
-- autres utilisateurs. Cause : get_trending_products_capped,
-- get_best_sellers_capped, get_discovery_feed_page et search_products
-- filtraient strictement sur country_code = p_country (le pays détecté
-- du visiteur via IP/GPS/valeur par défaut 'TG'). Un produit publié
-- depuis un pays n'apparaissait donc jamais pour un visiteur détecté
-- dans un autre pays.
--
-- Décision produit explicite : plus aucun filtre pays, plus aucune
-- barrière, sur AUCUNE surface de découverte — sauf similar_products
-- (produits similaires sur une fiche produit), qui reste filtré par
-- pays et n'est PAS touché par cette migration.
--
-- Cette migration a été appliquée directement sur le projet Supabase
-- "MIA Africa" (ppxiphfkbdhisvdchbwz) le 2026-07-28 ; ce fichier
-- reflète l'état réellement déployé pour que le repo et la prod restent
-- synchronisés.

-- ---------- get_trending_products_capped : plus de filtre pays ----------
create or replace function public.get_trending_products_capped(
  p_country text default null,
  p_limit integer default 12,
  p_max_per_shop integer default 2
) returns setof public.products
language sql stable as $$
  select pr.*
  from public.products pr
  join (
    select id, row_number() over (
      partition by shop_id
      order by views desc, public.get_active_boost_score(id) desc
    ) as rank_in_shop
    from public.products
    where status = 'active' and moderation_status = 'approved'
      and not public.is_shop_restricted(shop_id)
  ) ranked on ranked.id = pr.id
  where ranked.rank_in_shop <= p_max_per_shop
  order by public.get_active_boost_score(pr.id) desc, pr.views desc
  limit p_limit;
$$;

-- ---------- get_best_sellers_capped : plus de filtre pays ----------
create or replace function public.get_best_sellers_capped(
  p_country text default null,
  p_limit integer default 12,
  p_max_per_shop integer default 2
) returns setof public.products
language sql stable as $$
  select pr.*
  from public.products pr
  join (
    select id, row_number() over (partition by shop_id order by sales_count desc) as rank_in_shop
    from public.products
    where status = 'active'
      and not public.is_shop_restricted(shop_id)
  ) ranked on ranked.id = pr.id
  where ranked.rank_in_shop <= p_max_per_shop
  order by pr.sales_count desc
  limit p_limit;
$$;

-- ---------- get_discovery_feed_page : plus de filtre pays ----------
create or replace function public.get_discovery_feed_page(
  p_country text default null,
  p_page integer default 0,
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
    where p.status = 'active'
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
    where p.status = 'active'
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

-- ---------- search_products : plus de filtre pays ----------
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
    and (p_category is null or p.category = p_category)
    and (
      p_query is null or p_query = ''
      or p.search_vector @@ plainto_tsquery('french', p_query)
      or p.name % p_query
    )
  order by
    case when p_query is null or p_query = '' then 0
         else ts_rank(p.search_vector, plainto_tsquery('french', p_query)) + similarity(p.name, coalesce(p_query, ''))
    end desc,
    public.get_active_boost_score(p.id) desc,
    p.views desc
  limit p_limit offset p_offset;
$$;

-- ---------- similar_products : SEULE fonction où le pays reste un
-- filtre strict (demande explicite du fondateur : "pas de filtre pays,
-- pas de barrière sauf au niveau de similaire") — volontairement non
-- modifiée par cette migration.

grant execute on function public.get_trending_products_capped(text, integer, integer) to authenticated, anon;
grant execute on function public.get_best_sellers_capped(text, integer, integer) to authenticated, anon;
grant execute on function public.get_discovery_feed_page(text, integer, integer, text, uuid) to authenticated, anon;
grant execute on function public.search_products(text, text, text, int, int) to authenticated, anon;
