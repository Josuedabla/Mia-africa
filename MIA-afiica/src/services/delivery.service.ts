/**
 * Delivery Service (côté livreur)
 *
 * "Les livreurs voient les produits. Si plusieurs produits chez le même
 * vendeur, prix de livraison identique. Si chez plusieurs vendeurs, le
 * livreur peut choisir de tout récupérer et livrer, ou choisir ceux
 * proches de lui." -> listAvailableDeliveries() montre TOUTES les
 * livraisons disponibles triées par distance (RPC
 * available_deliveries_for_driver), avec leur checkout_group_id visible
 * pour que l'UI puisse suggérer "ce sont 3 commandes du même client, tout
 * récupérer ?" sans jamais l'imposer. claimDeliveries() accepte un tableau
 * d'IDs : un seul, plusieurs, ou tout le groupe - au choix du livreur.
 */
import { supabase } from '@/lib/supabase';

export interface AvailableDelivery {
  delivery_id: string;
  order_id: string;
  shop_id: string;
  shop_name: string;
  checkout_group_id: string | null;
  pickup_lat: number;
  pickup_lng: number;
  distance_km: number;
  order_total: number;
  delivery_fee: number;
  item_count: number;
}

export async function listAvailableDeliveries(lat: number, lng: number, radiusKm = 15): Promise<AvailableDelivery[]> {
  const { data, error } = await supabase.rpc('available_deliveries_for_driver', {
    p_lat: lat,
    p_lng: lng,
    p_radius_km: radiusKm,
  });
  if (error) throw error;
  return (data ?? []) as AvailableDelivery[];
}

/** Regroupe les livraisons disponibles par checkout_group_id, pour que l'UI propose "tout récupérer" quand plusieurs boutiques partagent le même client/tournée. */
export function groupByCheckoutGroup(deliveries: AvailableDelivery[]): Map<string | null, AvailableDelivery[]> {
  const groups = new Map<string | null, AvailableDelivery[]>();
  for (const d of deliveries) {
    const key = d.checkout_group_id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  }
  return groups;
}

/** p_delivery_ids: un seul ID, plusieurs, ou tout un groupe - le choix reste entièrement au livreur. */
export async function claimDeliveries(deliveryIds: string[]): Promise<string> {
  const { data, error } = await supabase.rpc('claim_deliveries', { p_delivery_ids: deliveryIds });
  if (error) throw error;
  return data as string;
}

/** Marque le colis comme récupéré chez le vendeur - simple jalon informatif, pas de preuve nécessaire à ce stade. */
export async function markPickedUp(deliveryId: string) {
  const { error } = await supabase
    .from('deliveries')
    .update({ status: 'picked_up', picked_up_at: new Date().toISOString() })
    .eq('id', deliveryId);
  if (error) throw error;
}

/**
 * Confirme la remise au client. SEUL chemin légitime pour passer une
 * livraison à 'delivered' - le livreur doit saisir le code OTP que le
 * client lui donne en main propre. Règle aussi le paiement si c'était du
 * cash à la livraison, et débloque la possibilité pour le client de
 * laisser un avis (voir migration 20260719000015).
 */
export async function confirmDelivery(deliveryId: string, otpCode: string, proofPhotoUrl?: string) {
  const { error } = await supabase.rpc('confirm_delivery', {
    p_delivery_id: deliveryId,
    p_otp_code: otpCode,
    p_proof_photo_url: proofPhotoUrl ?? null,
  });
  if (error) throw error;
}

export async function markDeliveryFailed(deliveryId: string) {
  const { error } = await supabase.from('deliveries').update({ status: 'failed' }).eq('id', deliveryId);
  if (error) throw error;
}

export default { listAvailableDeliveries, groupByCheckoutGroup, claimDeliveries, markPickedUp, confirmDelivery, markDeliveryFailed };
