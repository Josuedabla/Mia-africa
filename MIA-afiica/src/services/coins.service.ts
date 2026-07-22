/**
 * Coins Service
 *
 * Remplace wallet.service.ts (obsolète depuis le passage au modèle
 * "Money-In Only" - migration 20260720000019). Les pièces MIA sont la
 * SEULE monnaie de la plateforme : achetées avec de l'argent réel (12
 * FCFA/pièce), jamais retirables, pour personne. Ce service couvre
 * l'achat (via l'Edge Function coins-purchase qui appelle Moneroo/Chariow
 * pour le paiement RÉEL entrant) et les gains gratuits (connexion
 * quotidienne, tâches, pub).
 */
import { supabase } from '@/lib/supabase';

export async function getMyCoinBalance(): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return 0;
  const { data, error } = await supabase.from('coin_balances').select('coins').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return data?.coins ?? 0;
}

/** Initie l'achat réel d'un pack de pièces (argent réel entrant via Moneroo/Chariow - le seul flux financier réel que MIA gère encore). */
export async function initiateCoinPurchase(coinAmount: number, returnUrl: string, currency = 'XOF') {
  const { data, error } = await supabase.functions.invoke<{ checkoutUrl: string }>('coins-purchase', {
    body: { coinAmount, currency, returnUrl },
  });
  if (error) throw error;
  if (!data) throw new Error('Réponse vide du serveur de paiement.');
  return data;
}

/** Récompense de connexion quotidienne - une fois par jour, barème croissant sur 7 jours (voir migration 20260720000020). */
export async function claimDailyLoginReward(): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error('UNAUTHENTICATED');
  const { data, error } = await supabase.rpc('claim_daily_login_reward', { p_user_id: uid });
  if (error) throw error;
  return data as number;
}

export interface RewardTask {
  id: string;
  title: string;
  description: string | null;
  coins_reward: number;
  is_repeatable: boolean;
  cooldown_hours: number | null;
}

export async function listRewardTasks(): Promise<RewardTask[]> {
  const { data, error } = await supabase.from('reward_tasks').select('*').eq('is_active', true).order('coins_reward');
  if (error) throw error;
  return (data ?? []) as RewardTask[];
}

export async function claimRewardTask(taskId: string): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error('UNAUTHENTICATED');
  const { data, error } = await supabase.rpc('claim_reward_task', { p_user_id: uid, p_task_id: taskId });
  if (error) throw error;
  return data as number;
}

/** À appeler après confirmation du SDK publicitaire (ex: AdMob rewarded ad) que la pub a bien été vue en entier. */
export async function claimAdReward(adProviderRef: string): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error('UNAUTHENTICATED');
  const { data, error } = await supabase.rpc('claim_ad_reward', { p_user_id: uid, p_ad_provider_ref: adProviderRef });
  if (error) throw error;
  return data as number;
}

export async function boostProduct(params: { productId: string; coinAmount: number; durationHours?: number }) {
  const { data, error } = await supabase.rpc('boost_product', {
    p_product_id: params.productId,
    p_coin_amount: params.coinAmount,
    p_duration_hours: params.durationHours ?? 24,
  });
  if (error) throw error;
  return { boostId: data as string };
}

export async function applyReferralCode(referrerCode: string) {
  const { error } = await supabase.rpc('apply_referral_code', { p_referrer_id: referrerCode });
  if (error) throw error;
  return { ok: true as const };
}

export default {
  getMyCoinBalance,
  initiateCoinPurchase,
  claimDailyLoginReward,
  listRewardTasks,
  claimRewardTask,
  claimAdReward,
  boostProduct,
  applyReferralCode,
};
