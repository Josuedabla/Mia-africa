-- ============================================================
-- MIA Marketplace — Migration 034: fix get_discovery_feed_page
-- ============================================================
-- Bug réel constaté en prod : la version actuellement déployée de
-- get_discovery_feed_page (redéfinie après la migration 033, hors du
-- repo synchronisé) se termine par :
--
--   select * from followed_pool
--   union all
--   select * from new_pool
--   union all
--   select * from recommended_pool
--   order by random();
--
-- Postgres interdit un ORDER BY sur une expression (ici random(), pas
-- une colonne du SELECT) directement sur un UNION ALL : erreur
-- "42P0A0A invalid UNION/INTERSECT/EXCEPT ORDER BY clause". Résultat :
-- CHAQUE appel de cette RPC échoue, donc le flux de découverte
-- (page d'accueil) ne renvoie jamais aucun produit à personne, quel
-- que soit le compte utilisé - ce n'est pas propre à un produit ou un
-- vendeur en particulier.
--
-- Correctif : wrap l'union dans une sous-requête avant d'appliquer
-- ORDER BY random(), ce qui est la syntaxe valide pour mélanger le
-- résultat final (comportement voulu, gardé identique).
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
  ),
  combined as (
    select * from followed_pool
    union all
    select * from new_pool
    union all
    select * from recommended_pool
  )
  select * from combined
  order by random();
end;
$$;

grant execute on function public.get_discovery_feed_page(text, integer, integer, text, uuid) to authenticated, anon;
