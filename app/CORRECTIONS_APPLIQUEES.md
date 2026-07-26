# Corrections appliquées — MIA Marketplace V2

## 🚀 MIGRATION MAJEURE — Firebase → Supabase (dernière passe)

Migration complète et fonctionnelle de toute la stack backend. **Aucune fonctionnalité n'a été retirée** — le portefeuille, les pièces, le parrainage, l'assistant IA vendeur, le dashboard vendeur, etc. existent toujours, mais tournent désormais sur Postgres/Supabase. En plus de la migration technique demandée, la vision produit a évolué (système de capacités, personnalisation par pays automatique, accueil social-commerce) — détaillé ci-dessous.

### Backend Supabase (`supabase/`)

**Schéma PostgreSQL** (`supabase/migrations/`, 9 fichiers) : `profiles`, `user_capabilities`, `seller_profiles`, `delivery_profiles`, `creator_profiles`, `wallet_profiles`, `shops`, `products` (recherche full-text + pg_trgm intégrée), `product_media`, `orders`, `order_items`, `deliveries` (PostGIS), `wallets`, `transactions`, `coin_balances`, `coin_transactions`, `gifts`, `product_boosts`, `transfers`, `payout_requests`, `referrals`, `ads`, `followers`, `likes`, `reviews`, `notifications`, `analytics`, `country_wallet_availability`, `platform_settings`.

**Fonctions RPC** (remplacent toute la logique Cloud Functions) : contrairement à Firestore, Postgres offre de vraies transactions ACID — plus besoin de séparer chaque fonction en phase lecture/écriture comme c'était nécessaire avec Firestore. Toutes les mutations d'argent (`credit_wallet`, `debit_wallet`, `settle_order_payment`, `purchase_with_wallet`, `request_payout`, `transfer_to_user`, `purchase_coins`, `send_gift`, `boost_product`, `distribute_referral_cashback`, `become_seller`, `request_driver_capability`...) sont des fonctions `SECURITY DEFINER` avec verrouillage de ligne (`for update`), impossibles à contourner depuis le client.

**RLS complet** sur toutes les tables — équivalent direct des anciennes règles Firestore, mais en SQL natif avec le même principe de refus par défaut.

**Recherche** : `search_products()` (full-text + pg_trgm pour la tolérance aux fautes de frappe) et `nearby_shops()` (PostGIS, distance réelle) — **Algolia n'est plus utilisé du tout**, ce qui supprime une clé tierce à protéger et un service payant à maintenir.

**Storage** : buckets `products`, `shops`, `avatars`, `delivery-proofs` avec policies d'accès par propriétaire (remplace Firebase Storage).

**Edge Functions** (`supabase/functions/`, Deno) : `gemini-listing` (génération de fiche produit IA, quota quotidien), `moneroo-webhook` et `chariow-webhook` (confirmation de paiement avec vérification de signature), `wallet-recharge` et `wallet-payout` (intégration Moneroo), `geo-detect` (détection pays par IP/GPS, sans clé exposée côté client).

### Nouveau système de capacités (remplace le rôle unique)

Fini `user / vendor / driver / admin`. Un compte MIA peut désormais cumuler plusieurs capacités (`buyer` automatique à l'inscription, `creator` en self-serve, `seller` en self-serve comme avant, `driver` sur approbation admin). Table `user_capabilities` + tables dédiées par capacité (`seller_profiles`, `delivery_profiles`, `creator_profiles`, `wallet_profiles`). Nouveau hook `useCapabilities` (remplace `useUserRole`), nouveau hub `/devenir` présentant les 3 parcours (vendeur/livreur/créateur) avec leur statut en temps réel, nouvelles pages `BecomeDriverPage` et `BecomeCreatorPage`.

### Personnalisation automatique par pays (jamais de sélecteur)

Nouveau hook `useCountry` : détecte le pays via IP (Edge Function `geo-detect`, utilise l'en-tête `CF-IPCountry` de Cloudflare), préfixe téléphonique à l'inscription, ou GPS (uniquement sur action explicite de l'utilisateur — jamais de prompt de permission au chargement de la page). Le résultat est stocké sur `profiles.country_code` et réutilisé à chaque chargement. **L'ancien sélecteur de pays dans `HomePage.tsx` (un vrai `<select>` avec liste de pays) a été supprimé** — c'était l'anti-pattern exact que la nouvelle vision interdit.

### Portefeuille MIA — toujours visible, jamais caché

`WalletPage` affiche désormais un message clair ("Le Wallet MIA n'est pas encore disponible dans votre pays...") quand `country_wallet_availability.wallet_enabled` est faux pour le pays détecté, **sans jamais masquer la page ou le lien de navigation** — conformément à la consigne explicite.

### Nouvel accueil social-commerce (`HomePage.tsx`, réécriture complète)

- **YouTube** : logo MIA visible, recherche centrale, sections personnalisées par pays détecté.
- **TikTok** : feed de découverte vertical (grandes cartes produit avec like en temps réel via la table `likes`), badge "🚀 Boosté" sur les produits sponsorisés.
- **Amazon** : rangée "Tendances" horizontale pour un parcours d'achat rapide.
- **Uber** : section "Boutiques près de vous" utilisant `nearby_shops()` (PostGIS), activée uniquement sur action explicite ("Activer la localisation"), jamais au chargement.
- Recherche en temps réel (debounced) branchée sur `search_products()`.

### Frontend — couche de données migrée intégralement

Tous les hooks (`useAuth`, `useWallet`, `useWalletTransactions`, `useMyShop` [ex `useVendorShop`]) et services (`db.service` [remplace `firestore.service`], `search.service` [remplace `algolia.service`], `gemini.service`, `wallet.service`, `capabilities.service`) migrés vers le client Supabase. Toutes les pages consommatrices (`AdminPage`, `ShopPage`, `ProductPage`, `AuthPage`, `ReferralPage`, `WalletPage`, et l'intégralité de `src/pages/vendor/`) mises à jour : champs en `snake_case` (convention Postgres native, plus de couche de mapping camelCase source de bugs silencieux), upload de fichiers vers Supabase Storage, appels RPC/Edge Functions au lieu de `httpsCallable`.

`AdminPage` vérifie désormais `profiles.is_admin` (booléen protégé par RLS, non modifiable par le client) au lieu de comparer un email à une variable d'environnement — l'ancienne méthode ne fonctionnait déjà plus correctement après la migration Vite précédente.

### Bugs préexistants découverts et corrigés au passage

- `ShopPage.tsx` passait `<ProductCard product={product} />` alors que `ProductCard` attend des props individuelles (`id`, `name`, `price`...) — bug silencieux préexistant (toutes les valeurs s'affichaient `undefined`), corrigé en passant les props explicitement.

### Nettoyage

Suppression complète de `firebase/`, `firebase.json`, `functions/` (ancien dossier Cloud Functions), des dépendances `firebase` et `algoliasearch` dans `package.json`. Documentation obsolète retirée (`DEPLOYMENT_GUIDE.md`, `QUICK_START.md`, `SECURITY_FIXES.md`, `CHANGELOG.md`, `docs/`), remplacée par `SUPABASE_DEPLOYMENT.md` et un `README.md` à jour.

### ⚠️ Sécurité — action requise

Les clés Moneroo/Chariow/Gemini utilisées dans `scripts/set-edge-function-secrets.sh` sont les mêmes que précédemment (aucune régénération pour cette migration, comme demandé), mais elles ont transité dans les échanges ayant mené à ce projet et doivent être considérées comme potentiellement exposées — à régénérer avant toute mise en production réelle. Voir `SUPABASE_DEPLOYMENT.md`.

### Ce qui reste hors périmètre de cette migration

- Interface livreur complète (au-delà de la demande de capacité) — toujours au stade `delivery_profiles`/`deliveries` en base, pas encore d'écran de mission/navigation.
- Contenu créateur (vidéos produit façon TikTok) — la capacité `creator` existe et s'active, mais aucun flux de publication de contenu n'est construit.
- `boost_score` des produits boostés : la donnée existe (`product_boosts`, `products.is_boosted`) mais n'est pas encore intégrée dans le tri réel de `search_products()`/page d'accueil.
- Réconciliation SMS : `supabase/config.toml` active l'auth téléphone mais aucun fournisseur SMS (Twilio etc.) n'est configuré — à faire depuis le dashboard Supabase.
- Interface admin pour ajuster `platform_settings` sans passer par SQL direct.

---



## 🔴 Urgent — build & fonctionnement
- **Import Firebase cassé corrigé.** `firebase.config.ts` déplacé de `/firebase/config/` (hors de `src/`, donc introuvable par le bundler) vers `src/lib/firebase.ts`. Les 5 fichiers qui l'importaient (`useAuth.ts`, `firestore.service.ts`, `AdminPage.tsx`, `ShopPage.tsx`, `ProductPage.tsx`) pointent maintenant vers `@/lib/firebase`.
- **Variables d'environnement migrées de `REACT_APP_*` vers `VITE_*`**, et tout le code lit désormais `import.meta.env.VITE_*` au lieu de `process.env.REACT_APP_*` (qui ne fonctionne pas sous Vite). Fichier de typage `src/vite-env.d.ts` ajouté.
- **Vérification admin réparée** (`AdminPage.tsx`, `AdminLogin.tsx`) : compare désormais `import.meta.env.VITE_ADMIN_EMAIL`.
- **`vitest.config.ts` et `scripts/seed-data.mjs` corrigés** : ils pointaient vers l'ancienne arborescence `client/`/`server/` supprimée et vers les mauvaises variables d'env. Le script de seed charge maintenant réellement `.env` (il ne le faisait jamais avant).

## 🔴 Urgent — secrets exposés
Les clés suivantes ont été **retirées du bundle client** (elles restent les mêmes valeurs, mais vivent désormais uniquement côté serveur, dans Firebase Cloud Functions) :
- `GEMINI_API_KEY`
- `ALGOLIA_WRITE_KEY` / `ALGOLIA_ADMIN_KEY`
- `CHARIOW_API_KEY` (clé secrète de paiement)

Un nouveau dossier `functions/` a été créé avec 3 Cloud Functions :
- `functions/src/gemini.ts` → proxy Gemini avec quota quotidien de 50 générations/utilisateur (`generateProductDescription`, `generatePriceAdvice`, `generateSupportResponse`).
- `functions/src/algolia-sync.ts` → indexation automatique déclenchée à chaque écriture Firestore sur `products/{id}` (le client n'a plus jamais besoin de la clé d'écriture).
- `functions/src/chariow.ts` → `getChariowSale` (callable) + `chariowWebhook` (endpoint HTTPS qui revérifie le paiement directement auprès de Chariow avant de marquer une commande payée).

Côté client, `gemini.service.ts`, `chariow.service.ts` et `algolia.service.ts` ont été réécrits pour appeler ces fonctions au lieu d'utiliser les clés secrètes directement.

**Pour finaliser le déploiement**, exécuter une fois :
```bash
firebase login
./scripts/set-function-secrets.sh   # pousse les mêmes clés en secrets Cloud Functions
firebase deploy --only functions,firestore:rules,storage:rules
```
⚠️ `scripts/set-function-secrets.sh` contient les clés en clair pour ce transfert — il est dans `.gitignore` et doit être supprimé localement après exécution.

## 🔴 Urgent — règles Firestore
Fichier `firebase/rules/firestore.rules` corrigé pour correspondre à ce que `SECURITY_FIXES.md` annonçait déjà (mais qui n'était pas appliqué) :
- `orders` : création limitée à son propre `customerId`, statut `pending` obligatoire, `total` numérique positif obligatoire ; mise à jour limitée (le client ne peut qu'annuler sa propre commande, jamais modifier le total).
- `reviews` : création possible uniquement si la commande correspondante existe, appartient à l'utilisateur, est `delivered`, et correspond au bon produit.
- `users` : la création est maintenant possible par l'utilisateur lui-même (`isOwner`) — avant, seul un admin pouvait créer un profil, ce qui bloquait toute inscription publique. Le rôle ne peut plus être modifié via une simple mise à jour côté client (anti auto-promotion admin).

## 🟠 Important
- **`firebase/rules/storage.rules` créé** (référencé par `firebase.json` mais absent) : upload d'images limité au propriétaire de la boutique/produit/avatar, 5 Mo max, type image obligatoire, tout le reste refusé par défaut.
- **Icônes PWA carrées générées** (`public/icons/icon-192.png`, `icon-512.png`) à partir du logo existant, `manifest.json` mis à jour en conséquence (les icônes 1536×1024 précédentes cassaient l'installabilité PWA).

## 🟡 Nettoyage (dette technique)
Suppression du code mort qui n'était plus utilisé par le vrai projet (celui dans `src/`, référencé par `vite.config.ts`) :
- `client/` (arborescence frontend dupliquée, reliquat de template Manus)
- `server/`, `drizzle/`, `drizzle.config.ts` (backend tRPC/MySQL jamais branché à l'app Firebase réelle)
- `patches/wouter@3.7.1.patch` (patch pour une librairie de routing non utilisée — le projet utilise `react-router-dom`)
- `shared/`, `components.json` (uniquement référencés par le code supprimé ci-dessus)
- `.gitignore-new`, `.project-config.json` (doublons/fichiers de plateforme non nécessaires au code)

## ✨ NOUVEAU — Dashboard vendeur complet + MIA AI Description Generator

Ce qui n'existait pas du tout dans le ZIP (juste le schéma de données et un bouton mort) a été construit :

### Assistant IA de fiche produit ("MIA AI Description Generator")
Dans `src/pages/vendor/VendorProductForm.tsx` :
- Le vendeur saisit nom, catégorie, prix, notes rapides, jusqu'à 6 photos.
- Il choisit un **ton** (professionnel, premium, persuasif, simple, luxe, TikTok viral), des **mots-clés SEO**, et peut ajouter des **instructions spéciales**.
- Bouton **"✨ Améliorer avec MIA AI"** → appelle `generateProductListing` (nouvelle Cloud Function dans `functions/src/gemini.ts`) → Gemini génère description HTML + titre SEO + meta description + mots-clés, **adaptés au pays de la boutique** (FCFA Togo vs GHS Ghana vs NGN Nigeria, etc.).
- Résultat éditable dans un **éditeur WYSIWYG riche** (`src/components/editor/RichTextEditor.tsx`, basé sur Tiptap : titres, gras, italique, listes, liens, images, undo/redo).
- **Sécurité HTML à deux niveaux** : le HTML généré est nettoyé côté serveur (`sanitize-html` dans la Cloud Function) puis re-nettoyé côté client (`DOMPurify` dans `src/lib/sanitizeHtml.ts`) avant tout affichage ou sauvegarde — seules les balises `h2/h3/p/ul/ol/li/strong/em/br/img/a` passent, tout `<script>`/`onclick`/`javascript:` est bloqué.
- Les instructions spéciales du vendeur sont bornées et le prompt inclut une consigne explicite pour ignorer toute tentative d'y faire changer le format de sortie (garde-fou anti prompt-injection basique).

### Score qualité de fiche produit (heuristique, sans appel IA)
`src/lib/qualityScore.ts` calcule en temps réel (à chaque frappe, aucun coût) un score /100 basé sur : nombre/résolution des photos, longueur du titre, longueur et structure de la description, présence de titre/description/mots-clés SEO. Affiché en direct dans le formulaire avec des conseils actionnables ("Ajoutez 2 photos de plus", "Ajoutez une liste de caractéristiques"...).

### Dashboard vendeur complet (`src/pages/vendor/`)
- `VendorLayout.tsx` : sidebar de navigation (Aperçu, Produits, Commandes, Statistiques, Publicité, Paramètres) + garde d'accès (redirige vers l'onboarding si l'utilisateur n'est pas encore vendeur).
- `VendorDashboard.tsx` : KPIs (produits en ligne, ventes, note, score vendeur), commandes récentes, mise en avant de l'assistant IA.
- `VendorProducts.tsx` : liste des produits avec badge de score qualité.
- `VendorOrders.tsx` : liste des commandes avec avancement de statut (payée → expédiée → livrée).
- `VendorStats.tsx` : graphiques (revenu 14 jours, répartition par statut) via `recharts`.
- `VendorOnboarding.tsx` : le vrai flux "Créer ma boutique" (le bouton dans `DevenirVendeur.tsx` ne faisait rien avant - il est maintenant câblé).

### Cloud Function `becomeVendor` (`functions/src/vendor.ts`)
Bascule `role: 'vendor'` et crée `shops/{id}` de façon atomique côté serveur. Nécessaire car les règles Firestore interdisent désormais à un client de changer son propre rôle (anti auto-promotion) et exigent déjà `isVendor()` pour créer une boutique - sans cette fonction, personne ne pourrait jamais devenir vendeur.

### Corrections connexes découvertes en construisant cette fonctionnalité
- `App.tsx` importait déjà `./pages/vendor/VendorDashboard` (route `/vendeur/dashboard`) **alors que ce fichier n'existait pas** - un deuxième import cassé qui aurait empêché le build, indépendant de celui corrigé précédemment.
- `firebase/indexes/indexes.json`, référencé par `firebase.json`, **n'existait pas non plus** - créé avec tous les index composites nécessaires aux requêtes du service et du nouveau dashboard.
- `signUpWithEmail` (dans `useAuth.ts`) ne créait jamais le document Firestore `users/{uid}` correspondant - corrigé, avec `role: 'user'` par défaut.
- Règle Firestore `products.create` ne vérifiait que `isVendor()`, sans confirmer que le produit est bien créé sous la boutique du vendeur connecté - resserrée en `isVendor() && isVendorOfShop(shopId)`.
- Le bouton "Créer ma boutique maintenant" sur `/devenir-vendeur` n'avait **aucun `onClick`** - câblé vers `/vendeur/bienvenue`. Cette page elle-même n'était routée nulle part - ajoutée à `App.tsx`.

### Nouvelles dépendances ajoutées
Client (`package.json`) : `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-image`, `@tiptap/extension-placeholder`, `@tiptap/extension-character-count`, `dompurify`, `recharts`.
Cloud Functions (`functions/package.json`) : `sanitize-html`.

### Ce qui reste volontairement hors périmètre
- **MIA Seller Score** évolutif (calcul automatique à partir des commandes/avis) : le champ `sellerScore` existe dans `shops` mais reste statique à 50 pour l'instant - le calcul dynamique n'a pas été implémenté.
- **Réseau livreurs**, **algorithme de classement type TikTok**, **modération IA**, **traduction automatique multi-langue** : ce sont les prochains chantiers listés dans le plan 90 jours / 12 mois de l'audit, non construits dans cette passe.
- **Analyse IA vision des photos** : score photo actuel = heuristique (nombre + résolution), comme demandé - pas d'appel Gemini vision.


## 💰 NOUVEAU — Portefeuille MIA, paiements Moneroo, pièces/cadeaux, parrainage légal, transferts

### ⚠️ Choix de conception qui ont changé la demande initiale

Deux éléments demandés ont été volontairement **transformés** plutôt que construits tels quels — le détail complet a été donné dans le chat avant de coder, résumé ici pour mémoire :

1. **Parrainage** : la mécanique décrite (générations infinies, gains bloqués tant qu'ils ne sont pas échangés contre un article, déblocage conditionné à un paiement ou au recrutement d'un nouveau payeur) a les caractéristiques d'un système pyramidal, illégal dans la quasi-totalité des pays. Remplacé par un **modèle d'affiliation à 2 niveaux, cashback réel et immédiatement disponible**, déclenché uniquement par un achat réel (jamais par le simple recrutement).
2. **Transfert d'argent international** : la transmission de fonds entre particuliers est une activité réglementée (licence banque centrale / EMI requise). Construit uniquement le **wallet-to-wallet interne à MIA** + **cash-out via les payouts Moneroo** (mobile money/banque) — pas de transfert international direct hors de ce cadre.

### Architecture générale
Toute mutation de solde (FCFA ou pièces) passe **exclusivement** par des Cloud Functions utilisant l'Admin SDK, jamais par une écriture client directe :
- `functions/src/ledger.ts` : utilitaire transactionnel central (`readWallet`/`writeWalletCredit`/`writeWalletDebit`, équivalent pour les pièces). Toutes les fonctions financières respectent la contrainte Firestore *toutes les lectures avant toutes les écritures* dans une transaction — chaque module est découpé en phase LECTURE puis phase ÉCRITURE.
- `functions/src/economics.ts` : **un seul endroit** pour ajuster tous les taux (commission plateforme 8%, cashback parrainage 3%/1%, taux d'achat/reversement des pièces, frais de transfert). Une assertion au chargement empêche de configurer un cashback parrainage supérieur à la commission perçue.
- Règles Firestore : les nouvelles collections (`wallets`, `walletTransactions`, `coinBalances`, `coinTransactions`, `gifts`, `productBoosts`, `transfers`, `payoutRequests`, `referrals`) sont **lecture seule pour le client, écriture bloquée** (`allow write: if false`) — seul l'Admin SDK des Cloud Functions peut les modifier.

### Portefeuille MIA (`functions/src/wallet.ts`, `functions/src/moneroo.ts`, `functions/src/moneroo-webhook.ts`)
- `initiateWalletRecharge` → crée une transaction en attente, appelle Moneroo, renvoie l'URL de paiement. **Le solde n'est jamais crédité par cet appel** — uniquement par `monerooWebhook` après confirmation réelle du paiement (signature HMAC-SHA256 vérifiée avant tout traitement).
- `purchaseWithWallet` → paie une commande directement depuis le solde, dans une seule transaction (débit acheteur + crédit vendeur + commission + cashback parrainage).
- `requestPayout` → cash-out vers mobile money/banque. Débit immédiat (empêche le double-retrait), remboursement automatique si Moneroo rejette la demande ou si le webhook `payout.failed` arrive.
- `monerooWebhook` : gère `payment.success` (recharge ou paiement direct), `payout.success`, `payout.failed`.

### Règlement de commande unifié (`functions/src/orders.ts`)
Logique **partagée** entre Chariow, Moneroo et paiement par wallet : calcule la commission MIA (8% par défaut), crédite le vendeur du reste, déclenche le cashback parrainage — le tout dans une seule transaction cohérente. Le webhook Chariow existant (`functions/src/chariow.ts`) a été mis à jour pour utiliser ce module au lieu de simplement marquer la commande "payée" sans mouvement d'argent réel.

### Parrainage légal 2 niveaux (`functions/src/referral.ts`, `src/pages/ReferralPage.tsx`)
- `applyReferralCode` : appelé une fois à l'inscription si l'utilisateur arrive via `?ref=<uid>` (capturé automatiquement par `AuthPage.tsx`).
- Cashback automatique à chaque achat réel d'un filleul : 3% pour le parrain direct, 1% pour le parrain de son parrain — **jamais plus de 2 niveaux**, jamais sans achat réel.
- Page `/parrainage` : lien à copier, compteur de filleuls niveau 1/2, explication claire du mécanisme.

### Pièces MIA façon TikTok (`functions/src/coins.ts`, `src/components/GiftBoostPanel.tsx`)
- `purchaseCoins` : achat de pièces avec le solde wallet (1 pièce = 10 FCFA par défaut).
- `sendGift` : envoi de pièces en cadeau à un vendeur — **reversement à taux réduit** (5 FCFA/pièce reversés au vendeur contre 10 FCFA/pièce payés à l'achat, soit 50% de marge MIA, mécanique identique à la conversion Diamonds→cash de TikTok).
- `boostProduct` : dépense de pièces pour booster un produit (champ `boostScore`/`isBoosted` sur le produit, à intégrer dans la logique de classement/recherche existante — pas encore branché sur le tri réel de la page d'accueil, volontairement laissé comme donnée disponible plutôt que comme changement de comportement du classement).
- UI intégrée directement sur `ProductPage.tsx` (nouveau composant `GiftBoostPanel`).

### Transferts wallet-to-wallet (`functions/src/transfers.ts`)
`transferToUser` : transfert interne entre deux comptes MIA (par uid ou numéro de téléphone), frais de 1% (25 FCFA minimum) prélevés par MIA. Le cash-out vers mobile money reste une étape séparée volontaire (`requestPayout`), pour garder la frontière claire entre "argent qui reste dans l'écosystème MIA" et "sortie réelle vers une banque/opérateur".

### Pages et composants créés
- `src/pages/AuthPage.tsx` : **il n'existait aucune page de connexion/inscription publique** dans le ZIP (seulement `AdminLogin`) — créée ici, condition préalable pour que tout ce qui précède soit testable. Capture `?ref=` et applique le code de parrainage après inscription.
- `src/pages/WalletPage.tsx` (`/portefeuille`) : solde, historique, recharge, transfert, retrait, achat de pièces - un seul écran à onglets.
- `src/pages/ReferralPage.tsx` (`/parrainage`).
- `src/services/wallet.service.ts`, `src/hooks/useWallet.ts`, `src/hooks/useWalletTransactions.ts` : lecture temps réel des soldes (jamais de calcul de solde côté client, uniquement des `onSnapshot` Firestore et des appels aux Cloud Functions).

### Bug additionnel découvert et corrigé en cours de route
`src/types/index.ts` **n'existait pas du tout**, alors que `ProductPage.tsx` et `ShopPage.tsx` importaient déjà `Product`, `Shop`, `Review` depuis `'../types'` — encore un import cassé qui aurait empêché le build, indépendant de tous les précédents. Créé avec les champs réellement utilisés dans ces deux pages et dans `algolia.service.ts`.

### Secrets à configurer avant déploiement
`scripts/set-function-secrets.sh` a été mis à jour avec la clé `MONEROO_SECRET_KEY` fournie (sandbox). **`MONEROO_WEBHOOK_SECRET` doit être généré manuellement** dans le dashboard Moneroo (Développeurs > Webhooks) lors de la création du webhook pointant vers `monerooWebhook`, puis renseigné via `firebase functions:secrets:set MONEROO_WEBHOOK_SECRET` - il n'a pas été fourni dans la conversation.

### ⚠️ Point de vigilance technique avant mise en production
La documentation Moneroo collée dans la conversation couvre l'authentification, le format des réponses, les erreurs, le mode sandbox et les webhooks - **mais pas le détail exact des champs attendus par `/payments/initialize` et `/payouts/initialize`** (noms de champs, unité du montant - unité majeure ou mineure, méthodes de payout disponibles par pays). `functions/src/moneroo.ts` suit les conventions standard d'un PSP et est isolé dans un seul fichier pour être facile à corriger si un champ diffère - à vérifier contre https://docs.moneroo.io avant le premier vrai paiement.

### Ce qui reste hors périmètre
- Le `boostScore` des produits boostés n'est pas encore intégré dans le tri réel de la page d'accueil/recherche.
- Pas d'interface admin pour ajuster les taux (`economics.ts`) sans redéployer - à envisager si les pourcentages doivent bouger souvent.
- Réconciliation du cash physique pour les commandes en paiement à la livraison (le livreur encaisse, mais rien ne suit encore la remise de cet argent à MIA/Moneroo) - dépend de la construction du réseau livreurs, toujours dans le plan 90 jours de l'audit.


- **Interface livreur** : toujours absente de `src/pages/` - le dashboard vendeur est construit, mais le parcours livreur (récupération, livraison, validation OTP/photo) reste à faire.
- SEO dynamique pour les pages publiques (meta tags par page, sitemap) : non implémenté (les champs `seoTitle`/`seoDescription` sont bien générés et stockés par produit, mais rien ne les injecte encore dans le `<head>` de `ProductPage.tsx`).
- Mobile Money : toujours désactivé (`VITE_FEATURE_MOBILE_MONEY=false`), nécessite l'intégration d'un agrégateur.

Voir `MIA_AUDIT_MASTER_REPORT.md` pour le détail complet et le plan 30/90/365 jours.
