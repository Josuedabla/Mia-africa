/**
 * Spotlight Service
 *
 * Remplace stories.service.ts. Fournit la file de rotation équitable des
 * profils vendeurs pour le carrousel d'accueil (voir migration
 * 20260719000017 pour la garantie d'équité : tri par last_shown_at
 * croissant, un boost payant ne fait qu'augmenter la probabilité de
 * passage, jamais une exclusivité).
 */
import { supabase } from '@/lib/supabase';

export interface SpotlightEntry {
  shop_id: string;
  shop_name: string;
  shop_slug: string;
  shop_logo_url: string | null;
  is_sponsored: boolean;
  featured_product_id: string | null;
  featured_product_name: string | null;
}

export async function getSpotlightQueue(count = 8): Promise<SpotlightEntry[]> {
  const { data, error } = await supabase.rpc('get_spotlight_queue', { p_count: count });
  if (error) throw error;
  return (data ?? []) as SpotlightEntry[];
}

/** À appeler après que le carrousel a réellement affiché ces boutiques, pour faire avancer l'équité de rotation. */
export async function markSpotlightShown(shopIds: string[]): Promise<void> {
  if (shopIds.length === 0) return;
  const { error } = await supabase.rpc('mark_spotlight_shown', { p_shop_ids: shopIds });
  if (error) throw error;
}

/** Le vendeur achète une mise en avant. Toujours accompagnée du badge "Sponsorisé" côté affichage - jamais d'exclusivité, juste une fréquence de passage plus élevée (plafonnée). */
export async function purchaseSpotlightBoost(shopId: string, coinAmount: number, durationHours = 24): Promise<void> {
  const { error } = await supabase.rpc('purchase_spotlight_boost', {
    p_shop_id: shopId,
    p_coin_amount: coinAmount,
    p_duration_hours: durationHours,
  });
  if (error) throw error;
}

export default { getSpotlightQueue, markSpotlightShown, purchaseSpotlightBoost };
