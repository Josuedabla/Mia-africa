/**
 * Gifts Service
 *
 * Catalogue de cadeaux (cœur, fleur, diamant...) envoyés en pièces à un
 * vendeur, avec classement public des donateurs/boosteurs (effet ego,
 * façon TikTok - voir migration 20260720000021). Remplace l'ancien
 * sendGift brut en pièces de wallet.service.ts.
 */
import { supabase } from '@/lib/supabase';

export interface GiftCatalogItem {
  id: string;
  name: string;
  emoji: string;
  coin_price: number;
  display_order: number;
}

export async function listGiftCatalog(): Promise<GiftCatalogItem[]> {
  const { data, error } = await supabase.from('gift_catalog').select('*').eq('is_active', true).order('display_order');
  if (error) throw error;
  return (data ?? []) as GiftCatalogItem[];
}

export async function sendGift(params: { shopId: string; giftId: string; message?: string }): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error('UNAUTHENTICATED');

  const { data, error } = await supabase.rpc('send_gift', {
    p_from_user_id: uid,
    p_shop_id: params.shopId,
    p_gift_id: params.giftId,
    p_message: params.message ?? null,
  });
  if (error) throw error;
  return data as string;
}

export interface TopSupporter {
  from_user_id: string;
  display_name: string | null;
  username: string;
  avatar_url: string | null;
  total_coins_given: number;
  gifts_count: number;
}

/** Classement public des plus gros donateurs d'une boutique - l'effet ego qui pousse à dépenser plus. */
export async function getShopTopSupporters(shopId: string, limit = 10): Promise<TopSupporter[]> {
  const { data, error } = await supabase
    .from('shop_top_supporters')
    .select('*')
    .eq('shop_id', shopId)
    .order('total_coins_given', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as TopSupporter[];
}

export interface TopBooster {
  buyer_id: string;
  display_name: string | null;
  username: string;
  avatar_url: string | null;
  total_coins_spent: number;
  boosts_count: number;
}

/** Classement public des plus gros "boosteurs" (mise en avant payante) d'une boutique - même logique ego. */
export async function getShopTopBoosters(shopId: string, limit = 10): Promise<TopBooster[]> {
  const { data, error } = await supabase
    .from('shop_top_boosters')
    .select('*')
    .eq('shop_id', shopId)
    .order('total_coins_spent', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as TopBooster[];
}

export async function getRecentGifts(shopId: string, limit = 20) {
  const { data, error } = await supabase
    .from('gifts_sent')
    .select('*, profiles(display_name, username, avatar_url), gift_catalog(name, emoji)')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export default { listGiftCatalog, sendGift, getShopTopSupporters, getShopTopBoosters, getRecentGifts };
