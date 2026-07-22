# Architecture Technique MIA Marketplace

## Vue d'Ensemble

MIA Marketplace est une plateforme e-commerce africaine construite avec une architecture moderne et scalable.

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 19)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   HomePage   │  │  VendorDash  │  │  DriverApp   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  ShopPage    │  │  AdminDash   │  │  CartDrawer  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Services Layer (TypeScript)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Firestore   │  │  Chariow     │  │  Algolia     │       │
│  │  Service     │  │  Service     │  │  Service     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │  Gemini AI   │  │  Storage     │                         │
│  │  Service     │  │  Service     │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              External APIs & Services                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Firebase    │  │  Chariow     │  │  Algolia     │       │
│  │  (Auth, DB)  │  │  (Payments)  │  │  (Search)    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │  Gemini      │  │  Google      │                         │
│  │  (AI)        │  │  Maps        │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

## Stack Technologique

### Frontend
- **Framework** : React 19 + TypeScript
- **Styling** : Tailwind CSS 4
- **Animations** : Framer Motion
- **Routing** : React Router v7
- **State Management** : Zustand
- **Forms** : React Hook Form + Zod
- **HTTP Client** : Axios

### Backend & Database
- **Database** : Firebase Firestore (NoSQL)
- **Authentication** : Firebase Auth
- **Storage** : Firebase Cloud Storage
- **Hosting** : Firebase Hosting

### Intégrations Externes
- **Paiement** : Chariow API
- **Recherche** : Algolia
- **IA** : Gemini API (Google)
- **Cartographie** : Google Maps API

## Architecture Firestore

### Collections Principales

#### 1. Users
Stocke les profils utilisateurs avec leurs rôles.

```typescript
users/{userId}
├── email: string
├── phone: string
├── name: string
├── photoUrl?: string
├── country: string (TG, BJ, CM, GH)
├── role: 'customer' | 'vendor' | 'driver' | 'admin'
├── reputation: { score, totalReviews, averageRating }
└── createdAt: timestamp
```

#### 2. Shops
Boutiques des vendeurs avec métadonnées.

```typescript
shops/{shopId}
├── vendorId: string (ref: vendors)
├── name: string
├── slug: string
├── description: string
├── logoUrl?: string
├── country: string
├── whatsappNumber: string
├── reputation: { score, totalReviews, totalSales }
├── stats: { totalProducts, totalLikes, totalViews }
├── badges: string[]
└── createdAt: timestamp
```

#### 3. Products
Produits avec métadonnées Chariow.

```typescript
products/{productId}
├── shopId: string (ref: shops)
├── name: string
├── description: string
├── category: string
├── price: number
├── images: string[]
├── stock: number
├── country: string
├── chariowProductId?: string
├── chariowMetadata?: {
│   mia_shop_id: string
│   mia_product_id: string
│   mia_category: string
│   seller_id: string
│   country: string
│ }
├── stats: { totalViews, totalLikes, totalSales }
└── createdAt: timestamp
```

#### 4. Orders
Commandes avec suivi complet.

```typescript
orders/{orderId}
├── customerId: string (ref: users)
├── shopId: string (ref: shops)
├── vendorId: string (ref: vendors)
├── products: OrderItem[]
├── totalAmount: number
├── status: 'pending' | 'confirmed' | 'shipped' | 'delivered'
├── paymentStatus: 'pending' | 'completed' | 'failed'
├── chariowSaleId?: string
├── deliveryId?: string (ref: deliveries)
├── driverId?: string (ref: drivers)
└── createdAt: timestamp
```

#### 5. Deliveries
Livraisons avec tracking GPS.

```typescript
deliveries/{deliveryId}
├── orderId: string (ref: orders)
├── driverId?: string (ref: drivers)
├── status: 'pending' | 'assigned' | 'in_transit' | 'delivered'
├── pickupLocation: string
├── deliveryLocation: string
├── currentLocation?: { latitude, longitude, timestamp }
├── proofOfDelivery?: { photoUrl, signature, notes }
└── createdAt: timestamp
```

#### 6. Drivers
Profils des livreurs.

```typescript
drivers/{driverId}
├── userId: string (ref: users)
├── phone: string
├── vehicleType: 'motorcycle' | 'car' | 'truck'
├── country: string
├── deliveryZones: string[]
├── status: 'active' | 'inactive'
├── availability: 'available' | 'busy' | 'offline'
├── reputation: { score, totalDeliveries, successRate }
└── createdAt: timestamp
```

#### 7. Transactions
Transactions financières de Chariow.

```typescript
transactions/{transactionId}
├── orderId: string (ref: orders)
├── vendorId: string (ref: vendors)
├── amount: number
├── type: 'sale' | 'refund' | 'commission'
├── status: 'pending' | 'completed' | 'failed'
├── chariowTransactionId: string
├── metadata?: { mia_shop_id, mia_product_id, ... }
└── createdAt: timestamp
```

#### 8. AdCampaigns
Campagnes publicitaires.

```typescript
adCampaigns/{campaignId}
├── vendorId: string (ref: vendors)
├── name: string
├── type: 'product' | 'shop'
├── targetProductId?: string
├── targetCountries: string[]
├── budget: number
├── spent: number
├── stats: { impressions, clicks, conversions }
└── createdAt: timestamp
```

#### 9. Interactions
Tracking des interactions utilisateur.

```typescript
interactions/{interactionId}
├── userId: string (ref: users)
├── type: 'view' | 'like' | 'cart_add' | 'purchase' | 'search'
├── entityType: 'product' | 'shop' | 'category'
├── entityId: string
├── metadata?: { searchQuery, source, country }
└── timestamp: timestamp
```

## Flux de Données

### 1. Flux Commande

```
Client clique "Commander"
    ↓
Création du panier (carts collection)
    ↓
Redirection vers Chariow Checkout
    ↓
Paiement réussi
    ↓
Webhook Chariow → Création Order
    ↓
Synchronisation Firestore
    ↓
Notification Vendeur
    ↓
Assignation Livreur
    ↓
Tracking en temps réel
    ↓
Livraison confirmée
```

### 2. Flux Recherche

```
Utilisateur tape requête
    ↓
Appel Algolia Search
    ↓
Résultats avec facettes
    ↓
Affichage des résultats
    ↓
Clic sur produit
    ↓
Tracking interaction (Firestore)
    ↓
Ouverture ProductModal
```

### 3. Flux IA Vendeur

```
Vendeur crée produit
    ↓
Appel Gemini API
    ↓
Génération description
    ↓
Conseils de prix
    ↓
Génération tags SEO
    ↓
Sauvegarde Firestore
    ↓
Indexation Algolia
```

## Sécurité

### Firestore Rules

Les règles de sécurité garantissent :

```
- Accès public en lecture pour shops et produits
- Accès privé pour données utilisateur
- Vendeurs peuvent modifier leurs propres données
- Livreurs peuvent mettre à jour livraisons
- Admins ont accès complet
- Interactions loggées de manière sécurisée
```

### Authentication

```
- Firebase Anonymous Auth pour clients
- Email/Password pour vendeurs et livreurs
- OAuth pour admins
- JWT pour sessions sécurisées
```

### API Keys

```
- Chariow API Key (backend only)
- Algolia Search Key (frontend, read-only)
- Gemini API Key (backend only)
- Google Maps API Key (frontend)
```

## Performance

### Optimisations

1. **Caching** :
   - Cache Algolia pour recherches
   - Cache local pour produits populaires
   - Cache HTTP pour assets statiques

2. **Lazy Loading** :
   - Chargement des images à la demande
   - Code splitting par route
   - Chargement progressif des produits

3. **Indexation** :
   - Indexes Firestore pour requêtes complexes
   - Indexes Algolia pour recherche rapide
   - Indexes de base de données pour transactions

4. **Pagination** :
   - Cursor-based pagination pour listes
   - Infinite scroll pour découverte
   - Limit de 20-50 documents par requête

## Scalabilité

### Horizontal Scaling

- Firebase Firestore auto-scale
- Algolia auto-scale
- Firebase Hosting auto-scale
- Chariow API auto-scale

### Vertical Scaling

- Indexes Firestore pour requêtes rapides
- Sharding des collections si nécessaire
- Archivage des anciennes données

## Monitoring

### Logs

- Firebase Console Logs
- Firestore Query Performance
- Cloud Functions Logs
- Error Tracking (Sentry optionnel)

### Metrics

- Nombre de requêtes Firestore
- Latence moyenne
- Erreurs par endpoint
- Taux de conversion

## Déploiement

### Environnements

1. **Development** : Localhost avec Firebase Emulator
2. **Staging** : Firebase Hosting (staging domain)
3. **Production** : Firebase Hosting (production domain)

### CI/CD

```bash
# Build
pnpm build

# Deploy
firebase deploy --only hosting
```

### Rollback

```bash
firebase hosting:clone <source> <target>
```

---

**Dernière mise à jour** : 16 juillet 2026
