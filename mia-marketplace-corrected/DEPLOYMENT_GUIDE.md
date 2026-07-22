# 🚀 Guide de Déploiement MIA Marketplace V2

## Configuration Initiale

### 1. Cloner et Installer les Dépendances

```bash
# Cloner le projet
git clone <repo-url>
cd mia-marketplace-v2

# Installer les dépendances
pnpm install
# ou
npm install
```

### 2. Configurer les Variables d'Environnement

Le fichier `.env` contient déjà toutes les configurations. Vérifiez que les clés API sont correctes :

```bash
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=mia-marketplace-ec510
...

# Gemini AI
REACT_APP_GEMINI_API_KEY=...

# Algolia
REACT_APP_ALGOLIA_APP_ID=...
REACT_APP_ALGOLIA_SEARCH_KEY=...

# Chariow Payment
REACT_APP_CHARIOW_API_KEY=...
```

### 3. Configurer Firebase Admin

1. Allez sur [Firebase Console](https://console.firebase.google.com)
2. Sélectionnez le projet `mia-marketplace-ec510`
3. Allez dans **Authentication** → **Sign-in method**
4. Activez **Email/Password**
5. Créez un compte admin avec l'email `nursedabla@gmail.com`

## Déploiement sur Firebase Hosting

### Option 1 : Déploiement Automatique (Recommandé)

```bash
# Installer Firebase CLI
npm install -g firebase-tools

# Se connecter à Firebase
firebase login

# Déployer
firebase deploy --project mia-marketplace-ec510
```

### Option 2 : Déploiement Manuel

```bash
# Build le projet
pnpm build

# Déployer les fichiers dans le dossier `dist` sur Firebase Hosting
firebase deploy --project mia-marketplace-ec510
```

## Structure du Projet

```
mia-marketplace-v2/
├── src/
│   ├── pages/
│   │   ├── HomePage.tsx          # Page d'accueil
│   │   ├── ProductPage.tsx        # Page produit individuelle
│   │   ├── ShopPage.tsx           # Page boutique
│   │   ├── admin/
│   │   │   ├── AdminPage.tsx      # Dashboard admin (Firebase Auth)
│   │   │   ├── AdminLogin.tsx     # Formulaire login admin
│   │   │   └── AdminDashboard.tsx # Contenu admin
│   │   └── vendor/
│   │       └── VendorDashboard.tsx # Dashboard vendeur
│   ├── components/
│   ├── services/
│   ├── hooks/
│   └── App.tsx                    # Routes principales
├── public/
│   ├── manifest.json              # PWA manifest
│   ├── sw.js                      # Service Worker
│   └── logo.png                   # Logo MIA
├── firebase/
│   ├── config/
│   │   └── firebase.config.ts     # Config Firebase
│   └── rules/
│       └── firestore.rules        # Règles Firestore
├── .env                           # Variables d'environnement
└── firebase.json                  # Config Firebase Hosting
```

## Sécurité

### ✅ Corrections Appliquées

1. **Admin Auth** : Remplacé le mot de passe hardcodé par Firebase Email/Password
2. **localStorage** : Supprimé l'authentification basée sur localStorage
3. **Gemini API** : À proxifier via Cloud Functions (voir section avancée)
4. **Firestore Rules** : Renforcées pour valider les commandes et avis

### 🔒 Checklist de Sécurité Avant Production

- [ ] Changer le mot de passe admin Firebase
- [ ] Activer Firebase App Check
- [ ] Configurer les règles CORS
- [ ] Vérifier les règles Firestore
- [ ] Activer les logs d'audit
- [ ] Configurer les alertes de budget Firebase

## Fonctionnalités Implémentées

### 🏪 Client (Acheteur)
- ✅ Page d'accueil avec sélecteur pays
- ✅ Recherche produits (Algolia)
- ✅ Page produit individuelle
- ✅ Page boutique/vendeur
- ✅ Panier fonctionnel
- ✅ Commande WhatsApp
- ✅ Traduction automatique (Google Translate)
- ✅ PWA (installable sur Android)

### 🏪 Vendeur
- 🔄 Dashboard vendeur (en cours)
- 🔄 Gestion produits (CRUD)
- 🔄 Gestion commandes
- 🔄 Statistiques ventes

### 👨‍💼 Admin
- ✅ Dashboard admin sécurisé
- 🔄 Gestion utilisateurs
- 🔄 Gestion boutiques
- 🔄 Modération contenu

## Performance & Optimisation

### Lazy Loading Images
```tsx
<img src={product.image} loading="lazy" decoding="async" />
```

### Code Splitting Routes
```tsx
const VendorDashboard = lazy(() => import('./pages/vendor/VendorDashboard'));
```

### Pagination Firestore
```tsx
const q = query(
  collection(db, 'products'),
  where('country', '==', country),
  orderBy('stats.totalViews', 'desc'),
  limit(12),
  startAfter(lastDoc)
);
```

## Monitoring & Logs

### Firebase Console
- [Firestore](https://console.firebase.google.com/firestore)
- [Authentication](https://console.firebase.google.com/authentication)
- [Storage](https://console.firebase.google.com/storage)
- [Hosting](https://console.firebase.google.com/hosting)

### Logs en Temps Réel
```bash
firebase functions:log --project mia-marketplace-ec510
```

## Troubleshooting

### Problème : "Firebase config not found"
**Solution** : Vérifiez que le fichier `.env` existe et contient les clés Firebase

### Problème : "Admin auth failed"
**Solution** : Vérifiez que l'utilisateur admin existe dans Firebase Authentication

### Problème : "Images ne s'affichent pas"
**Solution** : Vérifiez les permissions Firebase Storage et les URLs CORS

## Support & Ressources

- 📚 [Documentation Firebase](https://firebase.google.com/docs)
- 🔍 [Algolia Search](https://www.algolia.com/doc/)
- 💳 [Chariow Payment](https://chariow.com/docs)
- 🤖 [Google Gemini AI](https://ai.google.dev/)

## Prochaines Étapes

1. **Phase 1 (30 jours)** : Lancer avec 5-10 vendeurs pilotes
2. **Phase 2 (90 jours)** : Dashboard vendeur complet + paiements Chariow
3. **Phase 3 (12 mois)** : Expansion multi-pays + app mobile

---

**Version** : 2.0.0  
**Dernière mise à jour** : 16 juillet 2026  
**Auteur** : MIA Development Team
