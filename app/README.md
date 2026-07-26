# MIA Marketplace — Market Intelligence Africa

Marketplace social-commerce mobile-first pour l'Afrique et au-delà, avec système de capacités unifié (acheteur/créateur/vendeur/livreur), portefeuille intégré, pièces virtuelles, et assistant IA pour les vendeurs.

**Stack :** React 19 + Vite + TypeScript + Supabase (PostgreSQL, Auth, Storage, Edge Functions) + Tailwind CSS.

> Ce projet a migré de Firebase vers Supabase. Voir `SUPABASE_DEPLOYMENT.md` pour le guide de déploiement complet, et `CORRECTIONS_APPLIQUEES.md` pour l'historique détaillé de toutes les corrections et évolutions apportées au projet.

## Démarrage rapide

```bash
npm install
cp .env.example .env   # renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm run dev
```

Le backend (schéma, RLS, fonctions) est entièrement défini dans `supabase/migrations/` et `supabase/functions/` — voir `SUPABASE_DEPLOYMENT.md` pour l'appliquer à un projet Supabase.

## Fonctionnalités principales

### Une identité, plusieurs capacités
Un compte MIA peut cumuler : acheteur (par défaut), créateur, vendeur, livreur (sur approbation) — sans dropdown de rôle unique. Voir `/devenir` dans l'app et `supabase/migrations/20260718000002_profiles_and_capabilities.sql`.

### Découverte social-commerce
Page d'accueil inspirée YouTube (recherche centrale) / TikTok (feed de découverte, pièces, boost) / Amazon (achat rapide) / Uber (boutiques proches, opt-in GPS). Aucun sélecteur de pays — détection automatique par IP/téléphone/GPS.

### Portefeuille MIA
Recharge et retrait via Moneroo (mobile money/banque), paiement direct, paiement à la livraison, transferts entre utilisateurs, pièces virtuelles avec système de cadeaux et boost produit. Le Wallet est toujours visible ; un message explique s'il n'est pas encore disponible dans le pays de l'utilisateur.

### Parrainage
Cashback réel à 2 niveaux, déclenché uniquement par un achat effectif — jamais par le simple recrutement.

### Assistant IA vendeur (MIA AI)
Génération de fiches produits (description, SEO, mots-clés) via Gemini, éditeur WYSIWYG, score qualité en temps réel.

## Structure du projet

```
src/                    Frontend React
supabase/migrations/    Schéma PostgreSQL, RLS, fonctions RPC
supabase/functions/     Edge Functions (webhooks paiement, IA, géolocalisation)
scripts/                Scripts de configuration des secrets
```

## Documentation complémentaire

- `SUPABASE_DEPLOYMENT.md` — déploiement pas à pas
- `CORRECTIONS_APPLIQUEES.md` — historique complet des corrections et évolutions
- `MIA_AUDIT_MASTER_REPORT.md` — audit initial de la plateforme
