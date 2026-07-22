# Guide de Déploiement MIA Marketplace

Ce guide vous aide à déployer MIA Marketplace sur Firebase Hosting.

## 📋 Prérequis

- Node.js 16+ installé
- npm ou pnpm installé
- Compte Firebase
- Accès à la console Firebase
- Firebase CLI installé (`npm install -g firebase-tools`)

## 🔧 Étape 1 : Configuration Firebase

### 1.1 Créer un Projet Firebase

1. Allez sur [console.firebase.google.com](https://console.firebase.google.com)
2. Cliquez sur "Ajouter un projet"
3. Entrez le nom du projet (ex: "mia-marketplace")
4. Acceptez les conditions
5. Cliquez sur "Créer un projet"

### 1.2 Activer les Services

#### Authentication
1. Allez dans **Authentication** → **Sign-in method**
2. Activez **Anonymous**
3. Activez **Email/Password**
4. Cliquez sur **Save**

#### Firestore Database
1. Allez dans **Firestore Database**
2. Cliquez sur **Create database**
3. Sélectionnez **Start in production mode**
4. Choisissez la région (ex: **europe-west1** pour l'Afrique de l'Ouest)
5. Cliquez sur **Create**

#### Cloud Storage
1. Allez dans **Storage**
2. Cliquez sur **Get started**
3. Acceptez les règles par défaut
4. Cliquez sur **Done**

#### Hosting
1. Allez dans **Hosting**
2. Cliquez sur **Get started**
3. Suivez les instructions

### 1.3 Récupérer les Credentials

1. Allez dans **Settings** → **Project Settings**
2. Allez dans l'onglet **General**
3. Descendez jusqu'à **Your apps**
4. Cliquez sur l'icône **Web** (</> )
5. Copiez la configuration Firebase

```javascript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

## 🔑 Étape 2 : Configuration des Variables d'Environnement

### 2.1 Créer le fichier `.env.local`

```bash
# À la racine du projet
cp .env.example .env.local
```

### 2.2 Remplir les Variables

Éditer `.env.local` et ajouter vos credentials :

```bash
# Firebase
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id

# Chariow (optionnel pour le développement)
REACT_APP_CHARIOW_API_KEY=your_chariow_key
REACT_APP_CHARIOW_API_URL=https://api.chariow.com/v1

# Algolia (optionnel pour le développement)
REACT_APP_ALGOLIA_APP_ID=your_algolia_id
REACT_APP_ALGOLIA_SEARCH_API_KEY=your_algolia_key

# Gemini (optionnel pour le développement)
REACT_APP_GEMINI_API_KEY=your_gemini_key
```

## 📦 Étape 3 : Installation des Dépendances

```bash
# Installer pnpm si nécessaire
npm install -g pnpm

# Installer les dépendances
pnpm install
```

## 🔐 Étape 4 : Configurer les Règles Firestore

### 4.1 Appliquer les Règles de Sécurité

1. Allez dans **Firestore Database** → **Rules**
2. Remplacez le contenu par celui de `firebase/rules/firestore.rules`
3. Cliquez sur **Publish**

### 4.2 Créer les Indexes (si nécessaire)

1. Firestore créera automatiquement les indexes suggérés
2. Vous pouvez aussi les créer manuellement dans la console

## 🏗️ Étape 5 : Build et Test Local

### 5.1 Lancer en Développement

```bash
pnpm dev
```

Accédez à `http://localhost:5173`

### 5.2 Build pour Production

```bash
pnpm build
```

Cela créera un dossier `dist/` avec les fichiers optimisés.

### 5.3 Tester Localement

```bash
# Installer Firebase CLI
npm install -g firebase-tools

# Se connecter à Firebase
firebase login

# Servir localement
firebase serve
```

Accédez à `http://localhost:5000`

## 🚀 Étape 6 : Déployer sur Firebase Hosting

### 6.1 Initialiser Firebase CLI

```bash
firebase init hosting
```

Répondez aux questions :
- **Project**: Sélectionnez votre projet
- **Public directory**: `dist`
- **Single-page app**: `Yes`
- **Overwrite**: `No`

### 6.2 Déployer

```bash
firebase deploy --only hosting
```

Ou pour déployer tout (Firestore, Storage, Hosting) :

```bash
firebase deploy
```

### 6.3 Vérifier le Déploiement

1. Allez dans **Hosting** dans la console Firebase
2. Vous verrez votre site avec une URL comme `https://your-project.web.app`

## 🌍 Étape 7 : Configuration du Domaine Personnalisé

### 7.1 Connecter un Domaine

1. Allez dans **Hosting** → **Domains**
2. Cliquez sur **Add custom domain**
3. Entrez votre domaine
4. Suivez les instructions pour mettre à jour les enregistrements DNS

### 7.2 Vérifier le Certificat SSL

Firebase fournit automatiquement un certificat SSL gratuit via Let's Encrypt.

## 🔄 Étape 8 : Configuration Chariow (Production)

### 8.1 Obtenir les Credentials Chariow

1. Allez sur [dashboard.chariow.com](https://dashboard.chariow.com)
2. Allez dans **Settings** → **API Keys**
3. Copiez votre **Store API Key**

### 8.2 Ajouter à Firebase Secrets

```bash
# Ajouter le secret à Firebase
firebase functions:config:set chariow.api_key="your_key"
firebase functions:config:set chariow.api_url="https://api.chariow.com/v1"
```

## 🔍 Étape 9 : Configuration Algolia (Production)

### 9.1 Obtenir les Credentials Algolia

1. Allez sur [dashboard.algolia.com](https://dashboard.algolia.com)
2. Allez dans **Settings** → **API Keys**
3. Copiez votre **Application ID** et **Search-Only API Key**

### 9.2 Ajouter à Firebase Secrets

```bash
firebase functions:config:set algolia.app_id="your_id"
firebase functions:config:set algolia.search_key="your_key"
```

## 🤖 Étape 10 : Configuration Gemini (Production)

### 10.1 Obtenir la Clé Gemini

1. Allez sur [console.cloud.google.com](https://console.cloud.google.com)
2. Sélectionnez votre projet
3. Allez dans **APIs & Services** → **Credentials**
4. Créez une **API Key**
5. Activez **Generative Language API**

### 10.2 Ajouter à Firebase Secrets

```bash
firebase functions:config:set gemini.api_key="your_key"
```

## 📊 Étape 11 : Monitoring et Analytics

### 11.1 Activer Google Analytics

1. Allez dans **Analytics** dans la console Firebase
2. Cliquez sur **Get started**
3. Acceptez les conditions
4. Cliquez sur **Enable**

### 11.2 Vérifier les Performances

1. Allez dans **Performance** pour voir les métriques
2. Allez dans **Crash Reporting** pour les erreurs
3. Allez dans **Logs** pour les logs détaillés

## 🔄 Étape 12 : Mises à Jour Continues

### 12.1 Déployer les Mises à Jour

```bash
# Faire vos changements
# Puis :
pnpm build
firebase deploy --only hosting
```

### 12.2 Rollback en Cas de Problème

```bash
# Voir l'historique des déploiements
firebase hosting:channel:list

# Restaurer une version précédente
firebase hosting:clone <source-site> <target-site>
```

## 🐛 Dépannage

### Problème : "Permission denied" sur Firestore

**Solution** : Vérifiez les règles Firestore dans `firebase/rules/firestore.rules`

### Problème : Images ne s'affichent pas

**Solution** : Vérifiez les règles Cloud Storage et les URLs des images

### Problème : Recherche Algolia ne fonctionne pas

**Solution** : Vérifiez que les produits sont indexés dans Algolia

### Problème : Paiements Chariow échouent

**Solution** : Vérifiez les credentials Chariow et les métadonnées des produits

## 📞 Support

Pour toute question :

1. Consultez la [documentation Firebase](https://firebase.google.com/docs)
2. Consultez la [documentation Chariow](https://docs.chariow.com)
3. Consultez la [documentation Algolia](https://www.algolia.com/doc/)
4. Consultez la [documentation Gemini](https://ai.google.dev/)

---

**Dernière mise à jour** : 16 juillet 2026
