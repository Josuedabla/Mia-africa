-- ============================================================
-- MIA Marketplace — Migration 013: Helper de distance pour delivery-quote
-- ============================================================
-- Petite fonction utilitaire pour que l'Edge Function delivery-quote
-- puisse calculer une distance en km entre deux geography(Point,4326)
-- sans dupliquer la syntaxe ST_Distance(...)/1000.0 à chaque appel RPC.

create or replace function public.st_distance_geography_km(p_point_a geography, p_point_b geography)
returns double precision
language sql stable as $$
  select ST_Distance(p_point_a, p_point_b) / 1000.0;
$$;

grant execute on function public.st_distance_geography_km(geography, geography) to authenticated, service_role;
