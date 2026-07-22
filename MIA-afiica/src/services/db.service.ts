/**
 * Replaces firestore.service.ts. The old service exposed a generic
 * collection(name)/getDocuments(constraints) wrapper, which doesn't fit
 * Postgres well - Supabase's query builder is already ergonomic and
 * typed per table, so this file instead groups small, purpose-built
 * functions by domain (products, shops, orders, reviews, analytics)
 * rather than one generic passthrough.
 */
import { supabase } from '@/lib/supabase';
import type { Product, Shop, Review } from '@/types';

// ---------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------

export async function getProduct(id: string): Promise<Product | null> {
  const { data } = await supabase.from('products').select('*, product_media(*)').eq('id', id).maybeSingle();
  return data as Product | null;
}

/**
 * "En Tendance" - plafonné à p_max_per_shop produits par boutique
 * (défaut 2, voir migration 20260719000018) pour qu'un vendeur qui
 * domine les vues n'occupe pas structurellement tout le carrousel.
 * Laisse mécaniquement de la place à plusieurs vendeurs différents.
 */
export async function getTrendingProducts(country: string, limit = 12): Promise<Product[]> {
  const { data, error } = await supabase.rpc('get_trending_products_capped', {
    p_country: country,
    p_limit: limit,
    p_max_per_shop: 2,
  });
  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function getNewProducts(country: string, limit = 12): Promise<Product[]> {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('country_code', country)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as Product[];
}

/** "🏆 Tops Ventes" - également plafonné par boutique, même logique anti-monopolisation que getTrendingProducts. */
export async function getBestSellers(country: string, limit = 12): Promise<Product[]> {
  const { data, error } = await supabase.rpc('get_best_sellers_capped', {
    p_country: country,
    p_limit: limit,
    p_max_per_shop: 2,
  });
  if (error) throw error;
  return (data ?? []) as Product[];
}

/**
 * Flux principal paginé, façon YouTube: charge par vagues plutôt que tout
 * le catalogue d'un coup. Mélange délibéré réellement implémenté côté
 * SQL (voir migration 20260721000025_feed_mix_video_trust.sql, RPC
 * get_discovery_feed_page): par page, environ 60% recommandé (boost +
 * popularité), 20% nouveaux vendeurs / boutiques peu exposées, 20%
 * boutiques suivies par l'utilisateur (redistribué au pool recommandé
 * si l'utilisateur n'est pas connecté ou ne suit personne).
 */
export async function getDiscoveryFeedPage(
  country: string,
  page: number,
  pageSize = 12,
  category?: string | null
): Promise<{ items: Product[]; hasMore: boolean }> {
  const { data: userData } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc('get_discovery_feed_page', {
    p_country: country,
    p_page: page,
    p_page_size: pageSize,
    p_category: category ?? null,
    p_user_id: userData.user?.id ?? null,
  });
  if (error) throw error;

  const items = (data ?? []) as Product[];

  // La RPC renvoie les colonnes de products uniquement (pas de jointure
  // product_media dans un `setof products`) - on récupère les médias en
  // un aller-retour groupé, plutôt qu'une requête par carte.
  if (items.length > 0) {
    const { data: media } = await supabase
      .from('product_media')
      .select('*')
      .in('product_id', items.map((p) => p.id))
      .order('position', { ascending: true });

    const mediaByProduct = new Map<string, any[]>();
    (media ?? []).forEach((m: any) => {
      const list = mediaByProduct.get(m.product_id) ?? [];
      list.push(m);
      mediaByProduct.set(m.product_id, list);
    });

    for (const item of items) {
      const productMedia = mediaByProduct.get(item.id) ?? [];
      (item as any).product_media = productMedia;
      item.images = productMedia.filter((m) => m.media_type === 'image').map((m) => m.url);
    }
  }

  return { items, hasMore: items.length === pageSize };
}

export async function getProductsByCategory(category: string, country: string, limit = 20): Promise<Product[]> {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('category', category)
    .eq('country_code', country)
    .eq('status', 'active')
    .order('views', { ascending: false })
    .limit(limit);
  return (data ?? []) as Product[];
}

export async function createProduct(payload: Record<string, unknown>) {
  const { data, error } = await supabase.from('products').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateProduct(id: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase.from('products').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function getShopProducts(shopId: string) {
  const { data } = await supabase
    .from('products')
    .select('*, product_media(*)')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });
  return (data ?? []).map((p: any) => ({
    ...p,
    images: (p.product_media ?? [])
      .filter((m: any) => m.media_type === 'image')
      .sort((a: any, b: any) => a.position - b.position)
      .map((m: any) => m.url),
  }));
}

// ---------------------------------------------------------------------
// Shops
// ---------------------------------------------------------------------

export async function getShopBySlug(slug: string): Promise<Shop | null> {
  const { data } = await supabase.from('shops').select('*').eq('slug', slug).maybeSingle();
  return data as Shop | null;
}

export async function updateShop(id: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase.from('shops').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------

export async function createOrder(payload: {
  customer_id: string;
  shop_id: string;
  total: number;
  currency?: string;
  delivery_address?: string;
}) {
  const { data, error } = await supabase.from('orders').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function getShopOrders(shopId: string, limit = 50) {
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getCustomerOrders(customerId: string, limit = 50) {
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function updateOrderStatus(orderId: string, status: string) {
  const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
  if (error) throw error;
}

/**
 * Signaux de mise en confiance publics d'une boutique : likes cumulés
 * sur ses produits, commandes totales, abonnés, ancienneté, badge
 * vérifié. Un seul aller-retour (RPC SECURITY DEFINER) plutôt que
 * recalculer côté client à partir de tables protégées par la RLS
 * (orders n'est lisible que par les parties concernées côté client).
 */
export async function getShopTrustStats(shopId: string): Promise<import('@/types').ShopTrustStats | null> {
  const { data, error } = await supabase.rpc('get_shop_trust_stats', { p_shop_id: shopId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    total_likes: Number(row.total_likes ?? 0),
    total_orders: Number(row.total_orders ?? 0),
    total_followers: Number(row.total_followers ?? 0),
    total_reviews: Number(row.total_reviews ?? 0),
    avg_rating: Number(row.avg_rating ?? 0),
    member_since: row.member_since ?? undefined,
    verified: Boolean(row.verified),
  };
}

// ---------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------

export async function getProductReviews(productId: string): Promise<Review[]> {
  const { data } = await supabase.from('reviews').select('*').eq('product_id', productId).order('created_at', { ascending: false });
  return (data ?? []) as Review[];
}

import { getOrCreateSessionId } from './consent.service';

// ---------------------------------------------------------------------
// Analytics (lightweight event logging - replaces firestore's trackInteraction)
// ---------------------------------------------------------------------
// L'écriture est conditionnée au consentement côté serveur (trigger
// trg_check_analytics_consent, migration 20260720000023) : sans
// consentement valide, l'insert est silencieusement annulé - jamais une
// erreur qui casserait l'UX, mais aussi jamais un enregistrement sans
// accord explicite, même si ce code oubliait de vérifier le consentement
// côté client.

export async function trackEvent(
  eventType: string,
  entityType?: string,
  entityId?: string,
  metadata: Record<string, unknown> = {}
) {
  const { data: userData } = await supabase.auth.getUser();
  await supabase.from('analytics').insert({
    user_id: userData.user?.id ?? null,
    session_id: userData.user ? null : getOrCreateSessionId(),
    event_type: eventType,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    metadata,
  });
}

export default {
  getProduct,
  getTrendingProducts,
  getNewProducts,
  getBestSellers,
  getDiscoveryFeedPage,
  getProductsByCategory,
  createProduct,
  updateProduct,
  getShopProducts,
  getShopBySlug,
  updateShop,
  createOrder,
  getShopOrders,
  getCustomerOrders,
  updateOrderStatus,
  getProductReviews,
  getShopTrustStats,
  trackEvent,
};
