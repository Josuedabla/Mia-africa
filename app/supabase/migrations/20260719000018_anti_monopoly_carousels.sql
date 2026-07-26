-- ============================================================
-- MIA Marketplace — Migration 018: Anti-monopolisation des carrousels
-- ============================================================
-- "La manière dont YouTube cache les tendances est aussi bon pour que
-- les meilleurs vendeurs ne continuent pas à profiter du privilège et
-- s'enrichir toujours, et les nouveaux..." -> les carrousels Tendance/
-- Tops Ventes triaient purement par vues/ventes, donc les mêmes gros
-- vendeurs occupaient structurellement toutes les places, jour après
-- jour. Ces fonctions plafonnent le nombre de produits par BOUTIQUE dans
-- un même carrousel (max_per_shop, défaut 2), pour garantir de la place
-- à plusieurs vendeurs différents même quand un seul domine les vues.
--
-- Ce n'est pas un système caché ou arbitraire comme peut sembler
-- l'algorithme YouTube de l'extérieur : la règle est simple, documentée,
-- et strictement appliquée en SQL - "jamais plus de N produits de la
-- même boutique dans ce carrousel", point final.

create or replace function public.get_trending_products_capped(
  p_country text,
  p_limit integer default 12,
  p_max_per_shop integer default 2
) returns setof public.products
language sql stable as $$
  select p.* from (
    select p.*,
      row_number() over (partition by p.shop_id order by p.views desc, p.is_boosted desc) as rank_in_shop
    from public.products p
    where p.country_code = p_country and p.status = 'active'
  ) p
  where p.rank_in_shop <= p_max_per_shop
  order by p.is_boosted desc, p.views desc
  limit p_limit;
$$;

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
    where p.country_code = p_country and p.status = 'active'
  ) p
  where p.rank_in_shop <= p_max_per_shop
  order by p.sales_count desc
  limit p_limit;
$$;

-- "Nouveautés" reste volontairement SANS plafond par boutique : c'est le
-- carrousel qui existe justement pour que les nouveaux comptes aient de
-- la visibilité immédiate ("les nouveaux aussi seront en joie, comme
-- TikTok le fait"), plafonner ici irait à l'encontre de son but.

grant execute on function public.get_trending_products_capped(text, integer, integer) to authenticated, anon;
grant execute on function public.get_best_sellers_capped(text, integer, integer) to authenticated, anon;
