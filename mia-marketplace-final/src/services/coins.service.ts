/**
 * Coins Service
 *
 * Remplace wallet.service.ts (obsolète depuis le passage au modèle
 * "Money-In Only" - migration 20260720000019). Les pièces MIA sont la
 * SEULE monnaie de la plateforme : achetées avec de l'argent réel (12
 * FCFA/pièce), jamais retirables, pour personne. Ce service couvre
 * l'achat (via l'Edge Function coins-purchase qui appelle Chariow pour
 * le paiement RÉEL entrant) et les gains gratuits (connexion
 * quotidienne, tâches, pub).
 *
 * Moneroo a été retiré de la plateforme (décision produit) : Chariow est
 * désormais le seul prestataire de paiement utilisé par MIA.
 */
import { supabase } from '@/lib/supabase';

/** 1 pièce = 12 FCFA (tarif fixé au lancement, cf. platform_settings.coin_purchase_rate_fcfa). Constante exportée pour éviter un nombre magique dupliqué à chaque endroit qui affiche un équivalent FCFA. */
export const COIN_TO_FCFA = 12;

export async function getMyCoinBalance(): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return 0;
  const { data, error } = await supabase.from('coin_balances').select('coins').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return data?.coins ?? 0;
}

/** Initie l'achat réel d'un pack de pièces (argent réel entrant via Chariow - le seul flux financier réel que MIA gère encore). */
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

/** coinAmount = montant TOTAL payé pour toute la durée (pas un montant/jour). */
export async function boostProduct(params: { productId: string; coinAmount: number; durationDays: number }) {
  const { data, error } = await supabase.rpc('boost_product', {
    p_product_id: params.productId,
    p_coin_amount: params.coinAmount,
    p_duration_days: params.durationDays,
  });
  if (error) throw error;
  return { boostId: data as string };
}

/** Nombre de commandes reçues (paid/shipped/delivered) par une boutique - utilisé pour le seuil de 300 commandes requis avant de pouvoir booster un produit (migration 20260725000036). */
export async function getShopOrderCount(shopId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_shop_order_count', { p_shop_id: shopId });
  if (error) throw error;
  return data as number;
}

export const BOOST_MIN_ORDERS_REQUIRED = 300;

export async function applyReferralCode(referrerCode: string) {
  const { error } = await supabase.rpc('apply_referral_code', { p_referrer_id: referrerCode });
  if (error) throw error;
  return { ok: true as const };
}

export type BlueBadgeDurationMonths = 1 | 3 | 12;

/** Prix en pièces de chaque formule du badge bleu. 12 mois = ancien tarif annuel unique, inchangé. */
export const BLUE_BADGE_PRICES_COINS: Record<BlueBadgeDurationMonths, number> = {
  1: 198,
  3: 398,
  12: 999,
};

/** Achète (ou renouvelle) le badge bleu vérifié pour la durée choisie (1, 3 ou 12 mois). Prolonge depuis l'expiration actuelle si encore active. Retourne la nouvelle date d'expiration ISO. */
export async function purchaseBlueBadge(shopId: string, durationMonths: BlueBadgeDurationMonths): Promise<string> {
  const { data, error } = await supabase.rpc('purchase_blue_badge', {
    p_shop_id: shopId,
    p_duration_months: durationMonths,
  });
  if (error) throw error;
  return data as string;
}

export type CoinDebitGranularity = 'day' | 'week' | 'month';

export interface CoinDebitSummaryRow {
  period: string;
  orders_count: number;
  coins_debited: number;
}

/** Historique agrégé des pièces prélevées automatiquement par commande (ticket 1), groupé par jour/semaine/mois - transparence obligatoire pour le vendeur (migration 20260725000038_coin_debit_summary). */
export async function getCoinDebitSummary(granularity: CoinDebitGranularity = 'day'): Promise<CoinDebitSummaryRow[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error('UNAUTHENTICATED');
  const { data, error } = await supabase.rpc('get_coin_debit_summary', {
    p_user_id: uid,
    p_granularity: granularity,
  });
  if (error) throw error;
  return (data ?? []) as CoinDebitSummaryRow[];
}

export default {
  getMyCoinBalance,
  initiateCoinPurchase,
  claimDailyLoginReward,
  listRewardTasks,
  claimRewardTask,
  claimAdReward,
  boostProduct,
  getShopOrderCount,
  applyReferralCode,
  purchaseBlueBadge,
  getCoinDebitSummary,
};
