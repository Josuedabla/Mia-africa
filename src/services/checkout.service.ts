/**
 * Checkout Service
 *
 * "Possibilité de sélectionner plusieurs produits à la fois et lancer la
 * commande. Chaque vendeur reçoit seulement ce qui est commandé chez
 * lui." -> checkoutCart() appelle la fonction RPC checkout_cart, qui
 * scinde le panier en une commande par boutique (voir migration
 * 20260719000010_multi_vendor_checkout.sql). Ce fichier ne fait QUE
 * l'appel réseau + le typage ; toute la logique métier (verrouillage du
 * stock, calcul des totaux par boutique) vit côté Postgres pour rester
 * atomique.
 */
import { supabase } from '@/lib/supabase';

export interface CartItemInput {
  product_id: string;
  quantity: number;
}

export interface CheckoutOrderResult {
  order_id: string;
  shop_id: string;
  total: number;
}

export interface CheckoutResult {
  checkout_group_id: string;
  orders: CheckoutOrderResult[];
}

export async function checkoutCart(params: {
  items: CartItemInput[];
  deliveryAddress?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  productPaymentTiming?: 'before' | 'after';
  deliveryPaymentTiming?: 'before' | 'after' | 'included';
}): Promise<CheckoutResult> {
  const { data, error } = await supabase.rpc('checkout_cart', {
    p_items: params.items,
    p_delivery_address: params.deliveryAddress ?? null,
    p_delivery_lat: params.deliveryLat ?? null,
    p_delivery_lng: params.deliveryLng ?? null,
    p_product_payment_timing: params.productPaymentTiming ?? 'before',
    p_delivery_payment_timing: params.deliveryPaymentTiming ?? 'after',
  });
  if (error) throw error;
  return data as CheckoutResult;
}

/** Récupère toutes les commandes issues du même passage en caisse (affichage "commande groupée" côté client). */
export async function getCheckoutGroupOrders(checkoutGroupId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, shops(name, slug, logo_url), order_items(*, products(name, images:product_media(url)))')
    .eq('checkout_group_id', checkoutGroupId);
  if (error) throw error;
  return data ?? [];
}

export default { checkoutCart, getCheckoutGroupOrders };
