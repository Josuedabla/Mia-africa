# MIA Marketplace — Market Intelligence Africa

Une marketplace africaine mobile-first avec découverte inspirée de YouTube/TikTok, écosystème complet vendeur/livreur/admin, et intégrations avancées (Chariow, Algolia, Gemini, Firestore).

## 🌍 Fonctionnalités Principales

### Pour les Clients
- **Découverte inspirée de YouTube/TikTok** : Tendances, nouveautés, boutiques populaires, recommandations personnalisées
- **Sélecteur multi-pays** : Togo, Bénin, Cameroun, Ghana
- **Filtres intelligents** : Par catégorie, prix, vendeur
- **Panier intelligent** : Gestion multi-boutiques
- **Commandes via WhatsApp** : Messages pré-remplis
- **Système de likes** : Marquer produits et boutiques préférés

### Pour les Vendeurs
- **Création de boutique gratuite** : Pas de frais cachés
- **Gestion de produits** : CRUD complet avec images
- **Dashboard** : Statistiques, commandes, tendances
- **Assistant IA (Gemini)** : Génération de descriptions, conseils de prix
- **Système de publicité** : Campagnes sponsorisées

### Pour les Livreurs
- **Profil livreur** : Gestion des zones et disponibilité
- **Assignation de missions** : Système intelligent
- **Tracking en temps réel** : Localisation GPS
- **Historique et notation** : Système de réputation

### Pour les Admins
- **Dashboard complet** : Gestion utilisateurs, modération
- **Rapports d'activité** : Analytics et statistiques
- **Gestion des disputes** : Résolution de conflits
- **Détection anti-fraude** : Sécurité avancée

## 🏗️ Architecture Technique

### Stack
- **Frontend** : React 19 + Tailwind CSS 4 + TypeScript
- **Backend** : Firebase (Firestore, Auth, Storage, Hosting)
- **Paiement** : Chariow API
- **Recherche** : Algolia
- **IA** : Gemini API (Google)
- **Authentification** : Firebase Auth (Anonymous + Email)

### Structure des Données (Firestore)

```
Collections:
├── users/              # Profils utilisateurs
├── vendors/            # Profils vendeurs
├── shops/              # Boutiques
├── products/           # Produits
├── orders/             # Commandes
├── deliveries/         # Livraisons
├── drivers/            # Livreurs
├── adCampaigns/        # Campagnes publicitaires
├── transactions/       # Transactions Chariow
├── reviews/            # Avis et évaluations
├── interactions/       # Tracking utilisateur
├── reputation/         # Scores de confiance
├── securityLogs/       # Logs de sécurité
├── fraudAlerts/        # Alertes fraude
├── notifications/      # Notifications
└── carts/              # Paniers temporaires
```

## 🚀 Installation et Déploiement

### 1. Prérequis
- Node.js 16+ et npm/pnpm
- Compte Firebase
- Compte Chariow
- Compte Algolia
- Compte Google Cloud (pour Gemini)

### 2. Configuration Firebase

1. **Créer un projet Firebase** :
   - Aller sur [console.firebase.google.com](https://console.firebase.google.com)
   - Créer un nouveau projet

2. **Activer les services** :
   - Authentication (Anonymous + Email)
   - Firestore Database
   - Cloud Storage
   - Hosting

3. **Copier les credentials** :
   - Aller dans Settings → Project Settings
   - Copier la configuration Firebase
   - Créer `.env.local` et ajouter les variables

### 3. Configurer les Variables d'Environnement

```bash
# Copier le fichier d'exemple
cp .env.example .env.local

# Éditer .env.local avec vos credentials:
# Firebase
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_PROJECT_ID=...
# Chariow
REACT_APP_CHARIOW_API_KEY=...
# Algolia
REACT_APP_ALGOLIA_APP_ID=...
# Gemini
REACT_APP_GEMINI_API_KEY=...
```

### 4. Installer les Dépendances

```bash
pnpm install
```

### 5. Configurer Firestore

1. **Créer les collections** :
   ```bash
   # Les collections seront créées automatiquement à la première écriture
   # Ou utilisez le script de seed
   pnpm run seed
   ```

2. **Appliquer les règles de sécurité** :
   - Aller dans Firestore → Rules
   - Copier le contenu de `firebase/rules/firestore.rules`
   - Publier les règles

3. **Créer les indexes** (si nécessaire) :
   - Firestore créera automatiquement les indexes suggérés
   - Ou consultez `firebase/indexes/indexes.json`

### 6. Lancer en Développement

```bash
pnpm dev
```

Le site sera accessible à `http://localhost:5173`

### 7. Déployer sur Firebase Hosting

```bash
# Build
pnpm build

# Deploy
firebase deploy --only hosting
```

## 📁 Structure du Projet

```
mia-marketplace/
├── firebase/
│   ├── config/
│   │   ├── firebase.config.ts      # Configuration Firebase
│   │   └── firestore.schema.ts     # Schéma Firestore
│   ├── rules/
│   │   └── firestore.rules         # Règles de sécurité
│   └── indexes/
│       └── indexes.json            # Indexes Firestore
├── src/
│   ├── services/
│   │   ├── chariow.service.ts      # API Chariow
│   │   ├── algolia.service.ts      # Recherche Algolia
│   │   ├── gemini.service.ts       # IA Gemini
│   │   └── firestore.service.ts    # Opérations Firestore
│   ├── pages/
│   │   ├── HomePage.tsx            # Page d'accueil
│   │   ├── ShopPage.tsx            # Page boutique
│   │   ├── VendorDashboard.tsx     # Dashboard vendeur
│   │   ├── DriverApp.tsx           # App livreur
│   │   └── AdminDashboard.tsx      # Dashboard admin
│   ├── components/
│   │   ├── ProductCard.tsx         # Carte produit
│   │   ├── ProductModal.tsx        # Modal détail
│   │   ├── CartDrawer.tsx          # Panier
│   │   └── ...
│   ├── hooks/
│   │   ├── useAuth.ts              # Authentification
│   │   ├── useCart.ts              # Gestion panier
│   │   └── ...
│   └── lib/
│       ├── firebase.ts             # Config Firebase
│       ├── trpc.ts                 # Client tRPC
│       └── utils.ts                # Utilitaires
├── docs/
│   ├── DEPLOYMENT.md               # Guide déploiement
│   ├── API.md                      # Documentation API
│   └── ARCHITECTURE.md             # Architecture technique
├── .env.example                    # Variables d'exemple
├── firebase.json                   # Config Firebase
└── README.md                       # Ce fichier
```

## 🔐 Sécurité

### Firestore Rules
Les règles de sécurité garantissent :
- Accès public en lecture pour shops et produits
- Accès privé pour données utilisateur
- Vendeurs peuvent modifier leurs propres données
- Interactions loggées de manière sécurisée
- Admins ont accès complet

### Variables d'Environnement
**Ne JAMAIS commiter** :
- `.env.local`
- `.env.production`
- Clés API Firebase

## 🎨 Design & UX

### Principes
- **Mobile-first** : Optimisé pour téléphones
- **Découverte fluide** : Style YouTube/TikTok
- **Aucune friction** : Achetez sans compte
- **Visuel attrayant** : Cartes modernes
- **Responsive** : Tous les appareils

### Palette de Couleurs
- **Primaire** : Vert (#16a34a)
- **Secondaire** : Orange (#ea580c)
- **Accent** : Émeraude (#059669)
- **Neutre** : Gris (#64748b)

## 📊 Intégrations

### Chariow API
- Gestion des paiements
- Synchronisation des ventes
- Métadonnées produit (mia_shop_id, mia_product_id, etc.)
- Suivi des transactions

### Algolia
- Recherche instantanée
- Autocomplétion
- Correction de fautes
- Filtres avancés

### Gemini API
- Génération de descriptions
- Conseils de prix
- Analyse de ventes
- Génération de tags SEO

## 📱 Applications Mobiles

Prêt pour :
- **App Client** (React Native/Expo)
- **App Vendeur** (React Native/Expo)
- **App Livreur** (React Native/Expo)

## 💰 Modèle Économique

### Phase 1 : Gratuit (Actuellement)
- Création boutique gratuite
- Aucun frais de transaction
- Objectif : adoption et croissance

### Phase 2 : Premium (Futur)
- Boutiques premium avec plus de visibilité
- Outils avancés d'analyse
- Publicité sponsorisée

### Phase 3 : Publicité (Futur)
- Produits promotionnels
- Boutiques sponsorisées
- Annonces ciblées

## 🧪 Tests

```bash
# Exécuter les tests
pnpm test

# Tests en mode watch
pnpm test:watch
```

## 📚 Documentation Supplémentaire

- [DEPLOYMENT.md](./docs/DEPLOYMENT.md) — Guide déploiement détaillé
- [API.md](./docs/API.md) — Documentation des APIs
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Architecture technique
- [Firebase Docs](https://firebase.google.com/docs)
- [Chariow API Docs](https://docs.chariow.com)
- [Algolia Docs](https://www.algolia.com/doc/)
- [Gemini API Docs](https://ai.google.dev/)

## 🤝 Support

Pour toute question ou problème :

1. Consultez la documentation
2. Vérifiez les logs Firebase
3. Contactez l'équipe MIA

## 📄 Licence

Ce projet est créé pour **MIA — Market Intelligence Africa**.

Tous droits réservés © 2026

---

**"Construire dans le silence. Créer une expérience exceptionnelle. Révéler un écosystème complet."**

Dernière mise à jour : 16 juillet 2026
