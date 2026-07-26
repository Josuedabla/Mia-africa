# MIA Marketplace — Déploiement Supabase

Ce projet a migré de Firebase vers Supabase. Voici comment le déployer de zéro.

## 1. Créer le projet Supabase

```bash
npm install -g supabase
supabase login
supabase projects create mia-marketplace
```

Récupérez `Project URL` et `anon public key` depuis le dashboard Supabase (Project Settings > API) et remplissez `.env` :

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxx
```

## 2. Appliquer les migrations (schéma + RLS + fonctions)

```bash
supabase link --project-ref xxxx
supabase db push
```

Cela crée : toutes les tables, les policies RLS, les fonctions RPC (wallet, pièces, parrainage, capacités), les fonctions de recherche (pg_trgm/full-text, remplace Algolia), et les buckets Storage.

## 3. Configurer les secrets des Edge Functions

```bash
./scripts/set-edge-function-secrets.sh
```

Ce script pousse les mêmes clés Gemini/Chariow/Moneroo utilisées précédemment (aucune régénération nécessaire pour cette migration — mais voir la note sécurité en bas de ce document). Il vous manque `MONEROO_WEBHOOK_SECRET`, à récupérer depuis le dashboard Moneroo une fois le webhook créé (étape 5).

## 4. Déployer les Edge Functions

```bash
supabase functions deploy gemini-listing
supabase functions deploy moneroo-webhook --no-verify-jwt
supabase functions deploy chariow-webhook --no-verify-jwt
supabase functions deploy wallet-recharge
supabase functions deploy wallet-payout
supabase functions deploy geo-detect --no-verify-jwt
```

`--no-verify-jwt` est nécessaire pour les webhooks (Moneroo/Chariow n'envoient pas de JWT Supabase) et pour `geo-detect` (appelé avant authentification). Les autres fonctions vérifient l'utilisateur elles-mêmes via le token `Authorization` transmis par le client.

## 5. Enregistrer les webhooks

Dans le dashboard Moneroo (Développeurs > Webhooks), ajoutez :
```
https://xxxx.supabase.co/functions/v1/moneroo-webhook
```
Copiez le secret de signature généré, puis :
```bash
supabase secrets set MONEROO_WEBHOOK_SECRET="le_secret_copié"
```

Dans le dashboard Chariow, configurez le webhook de paiement vers :
```
https://xxxx.supabase.co/functions/v1/chariow-webhook
```

## 6. Créer le premier compte admin

Aucun compte n'est admin par défaut (la colonne `is_admin` ne peut pas être mise à `true` par un client, RLS l'interdit explicitement). Après avoir créé votre compte normalement dans l'app, promouvez-le via le SQL Editor du dashboard Supabase :

```sql
update public.profiles set is_admin = true where email = 'vous@exemple.com';
```

## 7. Build et déploiement du frontend

```bash
npm install
npm run build
```

Déployez le contenu de `dist/` sur Vercel, Netlify, Cloudflare Pages, ou `supabase hosting` équivalent.

## 8. SMS (auth par téléphone)

Le fichier `supabase/config.toml` active l'auth par téléphone, mais aucun fournisseur SMS n'est configuré par défaut. Configurez Twilio (ou équivalent) depuis le dashboard Supabase (Authentication > Providers > Phone) avant d'activer ce parcours en production — c'est le chemin le plus naturel pour la détection automatique du pays par préfixe téléphonique.

---

## ⚠️ Sécurité — action requise

La clé Moneroo sandbox et les autres clés (Gemini, Chariow) ont transité dans les conversations ayant mené à ce projet. Comme pour toute clé partagée dans un historique de discussion, elles doivent être considérées comme potentiellement exposées :
- Régénérez-les depuis chaque dashboard fournisseur avant la mise en production réelle.
- Mettez à jour `scripts/set-edge-function-secrets.sh` avec les nouvelles valeurs et relancez-le.

## Notes d'architecture

- **Aucune clé secrète ne vit côté client.** Tout ce qui touche à l'argent (recharge, retrait, achat, pièces, cadeaux, parrainage, transferts) passe par des fonctions RPC Postgres (`SECURITY DEFINER`) ou des Edge Functions utilisant la clé de service — jamais directement depuis le navigateur.
- **RLS est la seule ligne de défense côté base de données** : chaque table sensible a `enable row level security` et des policies explicites. Une table sans policy correspondante refuse tout par défaut.
- **La recherche ne dépend plus d'Algolia.** `search_products()` et `nearby_shops()` tournent entièrement dans Postgres (pg_trgm + full-text search + PostGIS), ce qui supprime une clé tierce à protéger et un service payant à maintenir.
- **Le pays n'est jamais choisi dans un menu.** Il est déduit (IP via `geo-detect`, préfixe téléphonique à l'inscription, ou GPS avec permission explicite) et stocké sur `profiles.country_code`.
