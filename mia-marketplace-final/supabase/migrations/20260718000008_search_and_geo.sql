-- ============================================================
-- MIA Marketplace — Migration 008: Search & geolocation
-- ============================================================
-- Replaces Algolia entirely. Product search combines full-text search
-- (search_vector, weighted name/category/description) with pg_trgm
-- similarity for typo tolerance, ranked together. Shop discovery uses
-- PostGIS ST_DWithin/ST_Distance for real "shops near me" queries.

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
    p.is_boosted desc,
    p.views desc
  limit p_limit offset p_offset;
$$;

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
    and s.location is not null
    and ST_DWithin(s.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radius_km * 1000)
    and (p_country is null or s.country_code = p_country)
  order by distance_km asc
  limit 50;
$$;

grant execute on function public.search_products(text, text, text, int, int) to authenticated, anon;
grant execute on function public.nearby_shops(double precision, double precision, double precision, text) to authenticated, anon;

-- ---------- Seed: country wallet availability ----------
-- Wallet starts enabled in MIA's initial launch markets; every other
-- country defaults to "not yet available" (handled in application code
-- by treating a missing row as disabled), never hidden from the UI.
insert into public.country_wallet_availability (country_code, wallet_enabled, currency, payout_methods) values
  ('TG', true,  'FCFA', array['mtn_momo','moov_money','bank_transfer']),
  ('BJ', true,  'FCFA', array['mtn_momo','bank_transfer']),
  ('CI', true,  'FCFA', array['orange_money','mtn_momo','bank_transfer']),
  ('SN', true,  'FCFA', array['orange_money','bank_transfer']),
  ('GH', false, 'GHS',  array[]::text[]),
  ('NG', false, 'NGN',  array[]::text[]),
  ('CM', false, 'FCFA', array[]::text[]),
  ('KE', false, 'KES',  array[]::text[]);
