/**
 * Central place for every percentage/rate in MIA's money flows. Change
 * numbers here rather than hunting through each function.
 */

// MIA's cut on a vendor sale (paid via wallet or Moneroo). 6-10% range
// as specified - default to 8%. Could later be made per-shop (e.g. lower
// for high sellerScore shops), but a flat rate is safest to launch with.
export const PLATFORM_COMMISSION_RATE = 0.08;

// Referral cashback comes out of MIA's own commission above, never out of
// the vendor's share - the vendor still nets (1 - PLATFORM_COMMISSION_RATE)
// regardless of whether the buyer was referred.
export const REFERRAL_LEVEL_1_RATE = 0.03; // direct referrer
export const REFERRAL_LEVEL_2_RATE = 0.01; // referrer's own referrer
// Sanity check: cashback paid out must never exceed what MIA collected.
if (REFERRAL_LEVEL_1_RATE + REFERRAL_LEVEL_2_RATE > PLATFORM_COMMISSION_RATE) {
  throw new Error('Referral cashback rates exceed platform commission - fix rates in economics.ts');
}

// Coins: users buy coins with real money, spend them as gifts or product
// boosts. Like TikTok Diamonds, the payout value when a gift is cashed out
// is lower than the purchase value - that spread is MIA's margin.
export const COIN_PURCHASE_RATE_FCFA = 10; // 1 coin costs 10 FCFA to buy
export const COIN_GIFT_PAYOUT_RATE_FCFA = 5; // recipient's wallet gets 5 FCFA per coin gifted (50% margin)

// Wallet-to-wallet transfer fee, taken by MIA on every transfer.
export const TRANSFER_FEE_RATE = 0.01; // 1%
export const TRANSFER_FEE_MIN_FCFA = 25; // floor, so tiny transfers aren't free to spam

// Minimum payout (cash-out) amount, to keep Moneroo payout fees from
// eating small withdrawals.
export const MIN_PAYOUT_FCFA = 1000;
