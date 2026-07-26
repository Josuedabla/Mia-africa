-- ============================================================
-- MIA Marketplace — Migration 027: Politiques personnalisées par vendeur
-- ============================================================
-- Spec (MIA-Spec-Fonctionnalites.md, section 2 & 7) : "CGV / retours /
-- confidentialité modifiables par vendeur, avec politique MIA par défaut
-- en fallback". Point ouvert de la spec ("granularité: globale MIA vs
-- personnalisable par vendeur") tranché ici en faveur du "par vendeur,
-- optionnel" - un champ vide = fallback vers /cgv, /retours, /confidentialite
-- (pages MIA globales déjà existantes dans src/pages/legal/), jamais de
-- vide affiché tel quel côté acheteur.
--
-- Stockées en HTML riche comme products.description_html (même
-- sanitizeProductHtml() côté client à la sauvegarde et à l'affichage),
-- pas en jsonb structuré: ce sont des textes légaux libres rédigés par
-- le vendeur, pas des données interrogées par le reste du schéma.

alter table public.shops
  add column if not exists custom_cgv_html text,
  add column if not exists custom_returns_policy_html text,
  add column if not exists custom_privacy_policy_html text;

comment on column public.shops.custom_cgv_html is
  'CGV spécifiques à la boutique (HTML sanitizé). NULL/vide => fallback page MIA /cgv.';
comment on column public.shops.custom_returns_policy_html is
  'Politique de retours spécifique à la boutique (HTML sanitizé). NULL/vide => pas de politique de retours custom, section masquée côté boutique (les CGV MIA génériques couvrent déjà les retours par défaut).';
comment on column public.shops.custom_privacy_policy_html is
  'Politique de confidentialité spécifique à la boutique (HTML sanitizé). NULL/vide => fallback page MIA /confidentialite.';

-- Pas de nouvelle policy RLS nécessaire : ces colonnes sont sur `shops`,
-- déjà couvert par les policies existantes (lecture publique, écriture
-- réservée au owner_id) définies dans 20260718000003_commerce.sql.
