/**
 * Data access layer for Postgres via Supabase's query builder, which is
 * already ergonomic and typed per table - this file groups small,
 * purpose-built functions by domain (products, shops, orders, reviews,
 * analytics) rather than one generic passthrough.
 */
import { supabase } from '@/lib/supabase';
import type { Product, Shop, Review } from '@/types';

// ---------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------

// Une route publique /produit/:slugOrId doit rester valable pour tous les
// liens déjà partagés/indexés avant l'introduction des slugs produit -
// on détecte un UUID (id) vs un slug lisible plutôt que de casser les
// anciens liens.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getProduct(idOrSlug: string): Promise<Product | null> {
  const column = UUID_RE.test(idOrSlug) ? 'id' : 'slug';
  const { data } = await supabase.from('products').select('*, product_media(*)').eq(column, idOrSlug).maybeSingle();
  if (!data) return null;
  const id = (data as any).id as string;
  if ((data as any).has_variants) {
    const [{ data: attrs }, { data: variants }] = await Promise.all([
      supabase.from('product_variant_attributes').select('*').eq('product_id', id),
      supabase.from('product_variants').select('*').eq('product_id', id),
    ]);
    (data as any).variant_attributes = attrs ?? [];
    (data as any).variants = variants ?? [];
  }
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

// Résout une boutique soit par son domaine personnalisé vérifié (si le
// visiteur arrive via ce domaine), soit par son slug MIA classique -
// utile côté proxy/edge si on route un jour un domaine externe vers
// cette même app plutôt que de dupliquer le déploiement.
export async function getShopByCustomDomain(domain: string): Promise<Shop | null> {
  const { data } = await supabase
    .from('shops')
    .select('*')
    .eq('custom_domain', domain)
    .eq('custom_domain_status', 'verified')
    .maybeSingle();
  return data as Shop | null;
}

/** Change le lien (slug) d'une boutique. Rejette avec 'SLUG_ALREADY_TAKEN' ou 'INVALID_SLUG_FORMAT' si besoin. */
export async function setShopSlug(shopId: string, slug: string): Promise<string> {
  const { data, error } = await supabase.rpc('set_shop_slug', { p_shop_id: shopId, p_slug: slug });
  if (error) throw error;
  return (data as any).slug as string;
}

/** Change le lien (slug) d'un produit. Rejette avec 'SLUG_ALREADY_TAKEN' ou 'INVALID_SLUG_FORMAT' si besoin. */
export async function setProductSlug(productId: string, slug: string): Promise<string> {
  const { data, error } = await supabase.rpc('set_product_slug', { p_product_id: productId, p_slug: slug });
  if (error) throw error;
  return (data as any).slug as string;
}

export interface DnsInstructions {
  type: 'A' | 'CNAME';
  name: string;
  value: string;
  note: string;
}

/**
 * Demande le rattachement d'un domaine personnalisé, puis l'attache
 * réellement au projet Vercel (Edge Function vercel-domain-manager) - plus
 * aucune étape manuelle admin. La RPC SQL fait d'abord la validation de
 * format + l'unicité et passe le statut à 'pending' ; l'Edge Function
 * appelle ensuite l'API Vercel pour créer le domaine sur le projet et
 * renvoie les instructions DNS précises à afficher au vendeur. Si l'appel
 * Vercel échoue, le domaine reste enregistré côté MIA en statut 'failed'
 * (le vendeur peut retirer et réessayer) plutôt que de laisser un état
 * incohérent entre la DB et Vercel.
 */
export async function requestShopCustomDomain(
  shopId: string,
  domain: string,
): Promise<{ custom_domain: string; status: string; dns_instructions?: DnsInstructions }> {
  const { data, error } = await supabase.rpc('request_shop_custom_domain', { p_shop_id: shopId, p_domain: domain });
  if (error) throw error;
  const rpcResult = data as { custom_domain: string; status: string };

  const { data: vercelData, error: vercelError } = await supabase.functions.invoke<{
    status: string;
    dns_instructions: DnsInstructions;
    error?: string;
  }>('vercel-domain-manager', { body: { action: 'add', shop_id: shopId } });

  if (vercelError || !vercelData || vercelData.error) {
    // Le domaine est bien enregistré côté MIA (unique, réservé) mais pas
    // encore attaché sur Vercel - le vendeur voit 'failed' plutôt qu'un
    // 'pending' silencieux qui ne progresserait jamais.
    throw new Error(vercelData?.error ?? 'VERCEL_ATTACH_FAILED');
  }

  return { custom_domain: rpcResult.custom_domain, status: vercelData.status, dns_instructions: vercelData.dns_instructions };
}

/**
 * Retire le domaine personnalisé : détache d'abord le domaine du projet
 * Vercel (Edge Function vercel-domain-manager, action "remove"), PUIS
 * seulement ensuite exécute la RPC SQL qui remet shops.custom_domain à
 * null - dans cet ordre précis, car une fois la RPC passée, la base ne
 * contient plus l'information de quel domaine détacher. Le domaine est
 * donc capturé ici et transmis explicitement à l'Edge Function plutôt que
 * relu depuis la base. Retour immédiat au sous-domaine MIA gratuit dans
 * tous les cas, même si le détachement Vercel échoue (un domaine qui reste
 * attaché à Vercel sans DNS pointant dessus n'a aucun effet visible pour
 * personne - mieux vaut ça qu'un vendeur bloqué sur "Retirer").
 */
export async function removeShopCustomDomain(shopId: string, currentDomain: string): Promise<void> {
  try {
    const { error: vercelError } = await supabase.functions.invoke<{ removed?: boolean; error?: string }>(
      'vercel-domain-manager',
      { body: { action: 'remove', shop_id: shopId, domain: currentDomain } },
    );
    if (vercelError) {
      console.error('[removeShopCustomDomain] détachement Vercel a échoué, on retire quand même côté MIA', vercelError);
    }
  } catch (err) {
    console.error('[removeShopCustomDomain] détachement Vercel a échoué, on retire quand même côté MIA', err);
  }

  const { error } = await supabase.rpc('remove_shop_custom_domain', { p_shop_id: shopId });
  if (error) throw error;
}

/**
 * Redemande à Vercel où en est la vérification DNS/SSL du domaine et met à
 * jour custom_domain_status en base en conséquence ('verified' seulement si
 * les DNS pointent réellement vers Vercel ET que Vercel n'a pas signalé de
 * mauvaise configuration). Prévu pour être appelé par un bouton "Vérifier
 * maintenant" côté vendeur, et/ou par un cron (voir leaderboard-cron pour
 * le pattern) pour repasser automatiquement 'pending' -> 'verified' sans
 * action du vendeur une fois la propagation DNS terminée.
 */
export async function checkShopCustomDomainStatus(
  shopId: string,
): Promise<{ status: 'verified' | 'pending' | 'failed'; verified: boolean; misconfigured: boolean | null; dns_instructions: DnsInstructions }> {
  const { data, error } = await supabase.functions.invoke<{
    status: 'verified' | 'pending' | 'failed';
    verified: boolean;
    misconfigured: boolean | null;
    dns_instructions: DnsInstructions;
    error?: string;
  }>('vercel-domain-manager', { body: { action: 'check', shop_id: shopId } });

  if (error || !data || data.error) throw new Error(data?.error ?? 'VERCEL_CHECK_FAILED');
  return data;
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
// Analytics (lightweight event logging)
// ---------------------------------------------------------------------
// L'écriture est conditionnée au consentement côté serveur (trigger
// trg_check_analytics_consent, migration 20260720000023) : sans
// consentement valide, l'insert est silencieusement annulé - jamais une
// erreur qui casserait l'UX, mais aussi jamais un enregistrement sans
// accord explicite, même si ce code oubliait de vérifier le consentement
// côté client.

export type ProductReportReason = 'produit_illegal' | 'contrefacon' | 'securite_mineur' | 'autre';

export async function reportProduct(productId: string, reason: ProductReportReason, details?: string): Promise<void> {
  const { error } = await supabase.rpc('report_product', {
    p_product_id: productId,
    p_reason: reason,
    p_details: details ?? null,
  });
  if (error) throw error;
}

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
