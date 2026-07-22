/**
 * Replaces algolia.service.ts entirely. No third-party search service,
 * no separate write/admin key to protect - search runs directly in
 * Postgres via the search_products/nearby_shops RPC functions
 * (supabase/migrations/20260718000008_search_and_geo.sql), combining
 * full-text search with pg_trgm fuzzy matching for typo tolerance.
 */
import { supabase } from '@/lib/supabase';

export async function searchProducts(query: string, options?: {
  country?: string;
  category?: string;
  limit?: number;
  offset?: number;
}) {
  const { data, error } = await supabase.rpc('search_products', {
    p_query: query,
    p_country: options?.country ?? null,
    p_category: options?.category ?? null,
    p_limit: options?.limit ?? 20,
    p_offset: options?.offset ?? 0,
  });
  if (error) throw error;
  return data ?? [];
}

export async function nearbyShops(lat: number, lng: number, radiusKm = 15, country?: string) {
  const { data, error } = await supabase.rpc('nearby_shops', {
    p_lat: lat,
    p_lng: lng,
    p_radius_km: radiusKm,
    p_country: country ?? null,
  });
  if (error) throw error;
  return data ?? [];
}

export default { searchProducts, nearbyShops };
