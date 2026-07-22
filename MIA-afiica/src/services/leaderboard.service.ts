/**
 * Leaderboard Service
 *
 * "Top vendeurs de la semaine et top vendeurs par moi." Classements
 * hebdomadaires calculés côté serveur (migration 20260720000024) : plus
 * de commandes, meilleure satisfaction, plus populaire, meilleure
 * progression. Fenêtre glissante de 7 jours - jamais un cumul depuis
 * toujours, pour que la compétition reste rejouable chaque semaine.
 */
import { supabase } from '@/lib/supabase';

export type LeaderboardCriterion = 'orders' | 'satisfaction' | 'popularity' | 'progression';

export interface LeaderboardEntry {
  shop_id: string;
  shop_name: string;
  shop_slug: string;
  shop_logo_url: string | null;
  score: number;
  rank: number;
}

export async function getWeeklyLeaderboard(criterion: LeaderboardCriterion = 'orders', limit = 20): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_weekly_leaderboard', { p_criterion: criterion, p_limit: limit });
  if (error) throw error;
  return (data ?? []) as LeaderboardEntry[];
}

export interface MyTopShop {
  shop_id: string;
  shop_name: string;
  shop_slug: string;
  shop_logo_url: string | null;
  my_orders_count: number;
}

/** "Top vendeurs par moi" - mes boutiques les plus commandées, pas un classement global. */
export async function getMyTopShops(limit = 5): Promise<MyTopShop[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase.rpc('get_my_top_shops', { p_user_id: uid, p_limit: limit });
  if (error) throw error;
  return (data ?? []) as MyTopShop[];
}

export interface ShopWeeklyAward {
  criterion: LeaderboardCriterion;
  rank: number;
  badge_id: string | null;
  badge_emoji: string | null;
  reward_applied: string | null;
  week_start: string;
}

export async function getShopWeeklyAwards(shopId: string, limit = 10): Promise<ShopWeeklyAward[]> {
  const { data, error } = await supabase.rpc('get_shop_weekly_awards', { p_shop_id: shopId, p_limit: limit });
  if (error) throw error;
  return (data ?? []) as ShopWeeklyAward[];
}

export const REWARD_LABELS: Record<string, string> = {
  free_spotlight: 'Mise en avant gratuite (48h)',
  mia_interview: 'Interview MIA offerte',
  free_promotion: 'Promotion offerte',
};

export const CRITERION_LABELS: Record<LeaderboardCriterion, string> = {
  orders: 'Plus de commandes',
  satisfaction: 'Meilleure satisfaction',
  popularity: 'Plus populaire',
  progression: 'Meilleure progression',
};

export default { getWeeklyLeaderboard, getMyTopShops, getShopWeeklyAwards, REWARD_LABELS, CRITERION_LABELS };
