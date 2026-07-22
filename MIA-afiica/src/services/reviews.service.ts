/**
 * Reviews Service
 *
 * L'écriture est protégée par la policy RLS reviews_insert_if_purchased
 * (migration 20260718000007) : impossible de laisser un avis sans une
 * commande à son propre nom, dans cet état 'delivered', sur ce produit
 * précis. Ce service ne fait qu'exposer l'appel - toute la garantie vit
 * en base.
 */
import { supabase } from '@/lib/supabase';

export async function submitReview(params: { orderId: string; productId: string; rating: number; comment?: string }) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error('UNAUTHENTICATED');

  const { error } = await supabase.from('reviews').insert({
    order_id: params.orderId,
    product_id: params.productId,
    customer_id: uid,
    rating: params.rating,
    comment: params.comment ?? null,
  });
  if (error) throw error;
}

export async function getProductReviews(productId: string) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, profiles(display_name, avatar_url)')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Un avis existe-t-il déjà pour ce couple commande/produit ? Permet à l'UI de basculer entre "laisser un avis" et "modifier mon avis". */
export async function getMyReviewForOrderItem(orderId: string, productId: string) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('order_id', orderId)
    .eq('product_id', productId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export default { submitReview, getProductReviews, getMyReviewForOrderItem };
