#!/usr/bin/env bash
# Sets the secrets used by Supabase Edge Functions. Run this once after
# `supabase link` and before deploying functions.
#
# Usage: ./scripts/set-edge-function-secrets.sh
set -euo pipefail

# ⚠️ SÉCURITÉ : les clés qui se trouvaient ici précédemment (Gemini,
# Chariow, Moneroo) ont transité en clair dans un historique de
# conversation/fichier. Une clé qui a été vue dans un tel historique doit
# être considérée comme potentiellement exposée, même si personne d'autre
# ne l'a lue. Avant toute mise en production réelle :
#   1. Régénérez CHAQUE clé depuis son dashboard fournisseur respectif
#      (Google AI Studio pour Gemini, Chariow, Moneroo).
#   2. Remplacez les valeurs ci-dessous par les nouvelles clés.
#   3. Ne committez JAMAIS ce fichier une fois rempli - ajoutez-le à
#      .gitignore si ce n'est pas déjà fait, ou gardez les valeurs dans un
#      gestionnaire de secrets et injectez-les au moment de l'exécution.
supabase secrets set GEMINI_API_KEY="REPLACE_WITH_NEW_GEMINI_KEY"
supabase secrets set CHARIOW_API_KEY="REPLACE_WITH_NEW_CHARIOW_KEY"
supabase secrets set MONEROO_SECRET_KEY="REPLACE_WITH_NEW_MONEROO_KEY"

# MONEROO_WEBHOOK_SECRET est généré quand vous créez le webhook dans le
# dashboard Moneroo (Développeurs > Webhooks), pointant vers :
#   https://<project-ref>.supabase.co/functions/v1/moneroo-webhook
# À définir une fois que vous l'avez :
#   supabase secrets set MONEROO_WEBHOOK_SECRET="..."

# ---------- Domaine personnalisé vendeur (vercel-domain-manager) ----------
# VERCEL_API_TOKEN : Vercel > Account Settings > Tokens > Create Token.
#   Portée "Full Account" (ou au minimum accès au projet MIA) requise pour
#   pouvoir ajouter des domaines au projet via l'API.
# VERCEL_PROJECT_ID : Vercel > Project Settings > Project ID (commence par
#   "prj_"). PAS le nom du projet.
# VERCEL_TEAM_ID : à définir UNIQUEMENT si le projet vit sous une Vercel
#   Team plutôt qu'un compte personnel (pas le cas de MIA actuellement -
#   laissez cette ligne commentée sinon).
supabase secrets set VERCEL_API_TOKEN="REPLACE_WITH_VERCEL_API_TOKEN"
supabase secrets set VERCEL_PROJECT_ID="REPLACE_WITH_VERCEL_PROJECT_ID"
# supabase secrets set VERCEL_TEAM_ID="team_xxxxxxxx"

# Fonction supplémentaire de SUPABASE_ANON_KEY à définir manuellement -
# contrairement à SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY, la clé anon n'est
# PAS injectée automatiquement dans l'environnement des Edge Functions.
# vercel-domain-manager en a besoin pour vérifier que l'appelant est bien
# propriétaire de la boutique (RLS) avant de toucher à Vercel.
supabase secrets set SUPABASE_ANON_KEY="REPLACE_WITH_YOUR_PROJECT_ANON_KEY"

# ---------- Secret partagé pour les Edge Functions déclenchées par cron ----------
# CRON_SECRET protège leaderboard-cron ET expire-boosts-cron : un cron
# externe (Supabase Cron, ou un service tiers comme cron-job.org) doit
# envoyer ce secret dans le header X-Cron-Secret pour pouvoir les
# déclencher. Générez une valeur aléatoire longue, par exemple :
#   openssl rand -hex 32
supabase secrets set CRON_SECRET="REPLACE_WITH_A_LONG_RANDOM_SECRET"

# Planification recommandée (Dashboard Supabase > Edge Functions > votre
# fonction > Schedule, ou un cron externe pointant vers l'URL avec le
# header X-Cron-Secret) :
#   - leaderboard-cron      : toutes les heures ; + une fois/semaine
#                             (lundi 00h05 UTC) avec ?finalize=true
#   - expire-boosts-cron    : toutes les 15 minutes (un vendeur ne doit
#                             jamais rester "boosté" plus de quelques
#                             minutes après la fin réelle de ce qu'il a payé)

echo "Done. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are already"
echo "available to every Edge Function automatically - no need to set them."
