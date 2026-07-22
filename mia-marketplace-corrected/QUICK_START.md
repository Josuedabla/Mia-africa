# MIA Marketplace — Guide de Démarrage Rapide

Bienvenue ! Ce guide vous aide à déployer MIA Marketplace sur Firebase en moins de 30 minutes.

## 🚀 Étapes Rapides

### 1. Extraire le ZIP
```bash
unzip mia-marketplace-v2-complete.zip
cd mia-marketplace-v2
```

### 2. Installer les Dépendances
```bash
npm install -g pnpm
pnpm install
```

### 3. Configurer Firebase

#### A. Créer un Projet Firebase
1. Allez sur [console.firebase.google.com](https://console.firebase.google.com)
2. Cliquez sur "Ajouter un projet"
3. Entrez "mia-marketplace" comme nom
4. Acceptez les conditions et créez le projet

#### B. Activer les Services
- **Authentication** : Activez "Anonymous" et "Email/Password"
- **Firestore** : Créez une base de données en mode production
- **Storage** : Activez Cloud Storage
- **Hosting** : Activez Firebase Hosting

#### C. Récupérer les Credentials
1. Allez dans Settings → Project Settings
2. Copiez la configuration Firebase
3. Remplacez les valeurs dans `.env.local`

### 4. Configurer les Variables d'Environnement

Éditez `.env.local` avec vos credentials :

```bash
# Firebase
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
# ... autres variables
```

### 5. Appliquer les Règles Firestore

1. Allez dans Firestore → Rules
2. Copiez le contenu de `firebase/rules/firestore.rules`
3. Publiez les règles

### 6. Lancer en Développement

```bash
pnpm dev
```

Accédez à `http://localhost:5173`

### 7. Build pour Production

```bash
pnpm build
```

### 8. Déployer sur Firebase

```bash
# Installer Firebase CLI
npm install -g firebase-tools

# Se connecter
firebase login

# Initialiser
firebase init hosting

# Déployer
firebase deploy --only hosting
```

## 📁 Structure du Projet

```
mia-marketplace-v2/
├── firebase/               # Configuration Firebase
│   ├── config/            # Firebase config
│   └── rules/             # Firestore rules
├── src/
│   ├── services/          # Chariow, Algolia, Gemini, Firestore
│   ├── pages/             # HomePage
│   ├── components/        # ProductCard, CartDrawer
│   ├── hooks/             # useAuth, useCart
│   └── App.tsx            # Application principale
├── docs/                  # Documentation
├── README.md              # Documentation complète
└── QUICK_START.md         # Ce fichier
```

## 🔑 Variables d'Environnement Requises

| Variable | Description |
|----------|-------------|
| `REACT_APP_FIREBASE_API_KEY` | Clé API Firebase |
| `REACT_APP_FIREBASE_PROJECT_ID` | ID du projet Firebase |
| `REACT_APP_CHARIOW_API_KEY` | Clé API Chariow (optionnel) |
| `REACT_APP_ALGOLIA_APP_ID` | ID Algolia (optionnel) |
| `REACT_APP_GEMINI_API_KEY` | Clé Gemini (optionnel) |

## 🎯 Prochaines Étapes

1. **Personnaliser le Logo** : Remplacez le logo MIA dans `src/components/`
2. **Ajouter des Produits** : Utilisez le script `scripts/seed-data.mjs`
3. **Configurer Chariow** : Intégrez votre compte Chariow pour les paiements
4. **Configurer Algolia** : Activez la recherche avancée
5. **Configurer Gemini** : Activez l'assistant IA pour les vendeurs

## 📚 Documentation Complète

- [README.md](./README.md) — Guide complet
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — Guide de déploiement détaillé
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Architecture technique

## 🆘 Dépannage

### Erreur : "Cannot find module 'firebase'"
```bash
pnpm install firebase
```

### Erreur : "Firestore rules not applied"
1. Vérifiez que vous êtes connecté à Firebase
2. Allez dans Firestore → Rules
3. Copiez et publiez les règles

### Erreur : "Port 5173 already in use"
```bash
pnpm dev -- --port 5174
```

## 📞 Support

Pour toute question :
1. Consultez la [documentation Firebase](https://firebase.google.com/docs)
2. Consultez la [documentation Chariow](https://docs.chariow.com)
3. Consultez la [documentation Algolia](https://www.algolia.com/doc/)

---

**Vous êtes prêt !** 🎉

Démarrez avec `pnpm dev` et commencez à construire votre marketplace africaine.

**"Construire dans le silence. Créer une expérience exceptionnelle. Révéler un écosystème complet."**
