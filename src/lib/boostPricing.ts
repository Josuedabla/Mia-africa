/**
 * Grille de prix du boost produit (1 à 10 jours), en pièces MIA.
 * Doit rester en phase avec public.get_boost_price_range() côté SQL
 * (migration 20260723000030_boost_pricing_tiers.sql) — la validation
 * qui fait foi reste côté serveur, ceci sert uniquement à afficher le
 * prix et à donner un message d'erreur clair avant l'appel réseau.
 */
export const BOOST_MIN_DURATION_DAYS = 1;
export const BOOST_MAX_DURATION_DAYS = 10;

export function getBoostPriceRange(durationDays: number): { minTotal: number; maxTotal: number } {
  const minPerDay = 99 + (durationDays - 1) * 100;
  const maxPerDay = 500 + (durationDays - 1) * 500;
  return { minTotal: minPerDay * durationDays, maxTotal: maxPerDay * durationDays };
}
