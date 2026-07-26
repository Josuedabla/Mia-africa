-- ============================================================
-- MIA Marketplace — Migration 029: Boost produit — expiration réelle
-- + tri proportionnel au score payé
-- ============================================================
-- Deux bugs découverts en auditant le système de boost (boost_product(),
-- migration 20260718000006_functions.sql) :
--
-- 1) EXPIRATION JAMAIS APPLIQUÉE (bug financier) : boost_product() débite
--    le vendeur, enregistre une ligne product_boosts avec expires_at, puis
--    met products.is_boosted = true — mais RIEN, nulle part dans le code,
--    ne repassait jamais is_boosted à false une fois expires_at dépassé.
--    Un vendeur payant pour 24h de boost restait donc boosté
--    indéfiniment, gratuitement, après ce délai — ni ce qu'il a payé, ni
--    équitable envers les vendeurs qui n'ont jamais boosté ou dont le
--    boost a expiré "normalement" avant que ce bug ne soit corrigé.
--
-- 2) TRI TOUT-OU-RIEN : tous les usages de is_boosted (search_products,
--    get_discovery_feed_page, get_trending_products_capped) triaient par
--    is_boosted (booléen) puis views — donc payer 100 pièces ou 10 000
--    pièces produisait EXACTEMENT le même effet de tri. La colonne
--    boost_score existait déjà (proportionnelle au coin_amount payé) mais
--    n'était utilisée nulle part. Corrigé en calculant un score de boost
--    EFFECTIF (somme des boost_score des boosts encore actifs pour ce
--    produit, 0 si aucun) et en l'utilisant comme critère de tri
--    intermédiaire, entre le score de pertinence/pool et les vues.
--
-- Le plafond anti-monopole (get_trending_products_capped, migration 018,
-- max_per_shop) s'applique TOUJOURS avant le tri par boost - renforcer le
-- poids du boost ici n'permet donc jamais à un vendeur de dépasser ce
-- plafond, peu importe combien il paie.

-- ---------- Fonction: score de boost effectif d'un produit ----------
-- Somme des boost_score de tous les boosts encore actifs (expires_at dans
-- le futur) pour ce produit. Retourne 0 si aucun boost actif - jamais
-- négatif, jamais null, pour rester simple à utiliser dans un `order by`.
create or replace function public.get_active_boost_score(p_product_id uuid)
returns bigint language sql stable as $$
  select coalesce(sum(pb.boost_score), 0)::bigint
  from public.product_boosts pb
  where pb.product_id = p_product_id
    and pb.expires_at > now();
$$;

grant execute on function public.get_active_boost_score(uuid) to authenticated, anon;

-- ---------- Fonction: expire les boosts et resynchronise is_boosted ----------
-- À planifier via un cron (voir supabase/functions/expire-boosts-cron/,
-- même pattern que leaderboard-cron avec CRON_SECRET). Idempotente : peut
-- être appelée aussi souvent que voulu sans effet de bord, ne fait rien
-- pour les produits déjà dans le bon état.
--
-- Met is_boosted = false pour tout produit qui N'A PLUS aucun boost actif
-- (get_active_boost_score = 0) alors que is_boosted est encore true - et,
-- symétriquement, remet is_boosted = true si un produit a un score de
-- boost actif positif mais que la colonne était restée à false (ne
-- devrait pas arriver via boost_product(), mais protège contre toute
-- désynchronisation future, ex. un boost ajouté par une autre voie).
create or replace function public.expire_product_boosts()
returns integer language plpgsql as $$
declare v_updated_count integer := 0;
begin
  update public.products p
    set is_boosted = false
    where p.is_boosted = true
      and public.get_active_boost_score(p.id) = 0;
  get diagnostics v_updated_count = row_count;

  update public.products p
    set is_boosted = true
    where p.is_boosted = false
      and public.get_active_boost_score(p.id) > 0;

  return v_updated_count;
end;
$$;

-- ---------- search_products: tri par score de boost réel ----------
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

-- ---------- get_trending_products_capped: idem, score réel plutôt que booléen ----------
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
    where p.country_code = p_country and p.status = 'active'
  ) p
  where p.rank_in_shop <= p_max_per_shop
  order by public.get_active_boost_score(p.id) desc, p.views desc
  limit p_limit;
$$;

-- ---------- get_discovery_feed_page: pool "recommandé" trié par score réel ----------
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

grant execute on function public.search_products(text, text, text, int, int) to authenticated, anon;
grant execute on function public.get_trending_products_capped(text, integer, integer) to authenticated, anon;
grant execute on function public.get_discovery_feed_page(text, integer, integer, text, uuid) to authenticated, anon;

-- ---------- Rattrapage immédiat ----------
-- Corrige tout de suite les produits déjà désynchronisés par le bug
-- d'expiration (boostés en base depuis potentiellement des semaines sans
-- qu'aucun boost ne soit plus actif), sans attendre le premier passage du
-- cron.
select public.expire_product_boosts();
