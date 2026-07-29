-- ============================================================
-- MIA Marketplace — Migration 043: suppression définitive et tracée
-- du filtre pays sur similar_products.
--
-- Contexte : la migration 042 avait restauré `and p.country_code =
-- v_country` sur cette fonction, seule exception géographique voulue
-- à l'époque par le fondateur. Décision produit renversée
-- explicitement le 2026-07-29 (conversation directe, pas un document
-- tiers) : MIA est une plateforme panafricaine, aucune barrière ou
-- discrimination par pays nulle part, y compris sur les produits
-- similaires. Motivation également légale (conformité anti-
-- discrimination), pas seulement produit.
--
-- Cette migration aligne formellement le repo sur l'état déjà en
-- place en production (le filtre y avait déjà été retiré de fait,
-- sans migration tracée — ce fichier corrige cette dette).
-- ============================================================
create or replace function public.similar_products(
  p_product_id uuid,
  p_sort_by text default 'smart',
  p_limit int default 20,
  p_offset int default 0
) returns setof public.products
language plpgsql stable as $$
declare
  v_category text;
  v_shop_id uuid;
begin
  select category, shop_id into v_category, v_shop_id
    from public.products where id = p_product_id;

  return query
  select p.*
  from public.products p
  where p.status = 'active'
    and not public.is_shop_restricted(p.shop_id)
    and p.id <> p_product_id
    and p.category = v_category
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

grant execute on function public.similar_products(uuid, text, int, int) to authenticated, anon;
