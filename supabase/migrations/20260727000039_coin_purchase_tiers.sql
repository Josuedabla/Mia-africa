-- Passage du système de pièces MIA d'un "prix libre calculé" à 8 tranches
-- à prix fixe, chacune liée à un produit Chariow distinct. Cette migration
-- était déjà appliquée directement en production (hors repo) ; elle est
-- ajoutée ici pour resynchroniser le repo local avec la prod.

-- Table des tranches d'achat de pièces (prix fixe, un produit Chariow par tranche)
CREATE TABLE IF NOT EXISTS coin_purchase_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coin_amount integer NOT NULL UNIQUE,
  price_fcfa numeric NOT NULL,
  chariow_product_id text NOT NULL UNIQUE,
  chariow_checkout_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE coin_purchase_tiers IS 'Tranches à prix fixe pour l''achat de pièces MIA. Chaque tranche = un produit Chariow distinct (prix fixe, pas de "prix libre") pour garantir que le montant payé est toujours connu à l''avance.';

ALTER TABLE coin_purchase_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coin_purchase_tiers_public_select ON coin_purchase_tiers;
CREATE POLICY coin_purchase_tiers_public_select
  ON coin_purchase_tiers
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Lien entre une intention d'achat et sa tranche
ALTER TABLE coin_purchase_intents
  ADD COLUMN IF NOT EXISTS tier_id uuid REFERENCES coin_purchase_tiers(id);

-- Policy INSERT pour que l'utilisateur authentifié puisse créer sa propre intention
DROP POLICY IF EXISTS coin_purchase_intents_own_insert ON coin_purchase_intents;
CREATE POLICY coin_purchase_intents_own_insert
  ON coin_purchase_intents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS coin_purchase_intents_select_own ON coin_purchase_intents;
CREATE POLICY coin_purchase_intents_select_own
  ON coin_purchase_intents
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Les 8 tranches réelles (déjà appliquées en prod - à garder en seed, pas à ré-exécuter aveuglément)
INSERT INTO coin_purchase_tiers (coin_amount, price_fcfa, chariow_product_id, chariow_checkout_url, sort_order) VALUES
  (80,   990,   'prd_4harsty5', 'https://miaweb.mychariow.market/mia80/checkout',   1),
  (165,  1990,  'prd_nb6j59m7', 'https://miaweb.mychariow.market/mia165/checkout',  2),
  (420,  4990,  'prd_cd2gb9dh', 'https://miaweb.mychariow.market/mia420/checkout',  3),
  (850,  9900,  'prd_yf3wbkzk', 'https://miaweb.mychariow.market/mia850/checkout',  4),
  (1300, 14900, 'prd_ms76oeal', 'https://miaweb.mychariow.market/mia1300/checkout', 5),
  (1750, 19900, 'prd_qf4x44si', 'https://miaweb.mychariow.market/mia1750/checkout', 6),
  (2200, 24900, 'prd_wjmpqtje', 'https://miaweb.mychariow.market/mia2200/checkout', 7),
  (2700, 29900, 'prd_ks7ph6av', 'https://miaweb.mychariow.market/mia2700/checkout', 8)
ON CONFLICT DO NOTHING;
