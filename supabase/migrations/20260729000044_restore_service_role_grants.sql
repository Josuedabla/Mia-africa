-- ============================================================
-- MIA Marketplace — Migration: restaure les privilèges GRANT du rôle
-- service_role sur le schéma public.
--
-- Diagnostic : service_role n'avait plus SELECT/INSERT/UPDATE/DELETE
-- sur ~52 tables (seulement TRUNCATE/REFERENCES/TRIGGER restaient),
-- alors que anon/authenticated les avaient bien (protégés par RLS
-- comme prévu). Cause probable : un REVOKE partiel exécuté par erreur
-- à un moment donné, jamais tracé en migration.
--
-- Impact concret observé : l'Edge Function coins-purchase (client
-- admin = service_role, qui contourne volontairement RLS) recevait un
-- 403 Postgres en lisant coin_purchase_tiers -> "achat de pièces" cassé
-- pour tout le monde. Le même défaut de droits touchait potentiellement
-- toute Edge Function utilisant le client admin sur une table
-- publique directement (webhooks Moneroo/Chariow, wallet-payout, etc.)
-- même si leur usage principal passe par des RPC SECURITY DEFINER
-- (qui elles n'étaient pas affectées, d'où le comportement partiel).
--
-- service_role est un rôle serveur de confiance totale (jamais exposé
-- au client) — lui redonner tous les droits est le comportement par
-- défaut standard de Supabase et ne réduit aucune protection RLS
-- existante pour anon/authenticated.
-- ============================================================
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all routines in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on routines to service_role;
