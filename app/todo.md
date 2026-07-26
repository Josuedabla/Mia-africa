# MIA Marketplace V2 — TODO

## Phase 1 : Configuration Firebase et Architecture Firestore
- [ ] Créer structure Firestore (collections: users, vendors, shops, products, orders, deliveries, drivers, ads, transactions, reviews, interactions)
- [ ] Configurer Firebase config (client et admin SDK)
- [ ] Créer fichier .env.example avec variables Firebase
- [ ] Implémenter Firebase Authentication (Anonymous + Email)
- [ ] Créer règles Firestore de sécurité par rôle
- [ ] Configurer Firebase Storage pour images produits
- [ ] Mettre en place indexation Firestore pour requêtes complexes

## Phase 2 : Frontend React — Page d'accueil, Boutiques et Découverte
- [ ] Intégrer logo MIA fourni
- [ ] Configurer palette de couleurs (vert/orange)
- [ ] Créer layout mobile-first avec navigation
- [ ] Implémenter HomePage avec sections : Tendances, Nouveautés, Boutiques populaires, "Pour Toi"
- [ ] Créer sélecteur multi-pays (Togo, Bénin, Cameroun, Ghana)
- [ ] Implémenter filtres par catégorie
- [ ] Créer composant ProductCard avec animations
- [ ] Implémenter ProductModal avec détails et galerie images
- [ ] Créer page ShopPage avec produits et statistiques
- [ ] Implémenter système de likes produits/boutiques
- [ ] Créer CartDrawer avec gestion du panier

## Phase 3 : Système Vendeur — Dashboard, Gestion Produits et Commandes
- [ ] Créer page VendorDashboard avec KPIs
- [ ] Implémenter création de boutique
- [ ] Créer formulaire d'édition boutique
- [ ] Implémenter gestion des produits (CRUD)
- [ ] Créer upload d'images vers Firebase Storage
- [ ] Implémenter gestion des commandes
- [ ] Créer système de notifications vendeur
- [ ] Implémenter statistiques de ventes et tendances

## Phase 4 : Intégration Chariow API et Système de Paiement
- [ ] Créer module client Chariow API
- [ ] Implémenter authentification Chariow (Bearer token)
- [ ] Créer service de synchronisation des ventes Chariow
- [ ] Implémenter injection de métadonnées (mia_shop_id, mia_product_id, mia_category, seller_id, country)
- [ ] Créer système de suivi des transactions
- [ ] Implémenter webhook Chariow pour confirmation paiement
- [ ] Créer tableau financier (revenues, commissions, seller_balance)
- [ ] Implémenter checkout Chariow dans le flux commande

## Phase 5 : Intégration Algolia et Gemini AI
- [ ] Créer client Algolia
- [ ] Implémenter synchronisation Firestore → Algolia
- [ ] Créer service de recherche avec autocomplétion
- [ ] Implémenter correction de fautes de frappe
- [ ] Créer filtres de recherche (catégorie, prix, pays, vendeur)
- [ ] Intégrer Gemini API pour assistant vendeur
- [ ] Implémenter génération de descriptions produits
- [ ] Créer conseiller de prix basé sur IA
- [ ] Implémenter analyse de ventes par IA

## Phase 6 : Système Livreur, Livraison et Tracking
- [ ] Créer profil livreur et système d'authentification
- [ ] Implémenter gestion des zones de livraison
- [ ] Créer système d'assignation commande-livreur
- [ ] Implémenter tracking en temps réel
- [ ] Créer notifications de livraison
- [ ] Implémenter confirmation de livraison
- [ ] Créer historique des missions livreur
- [ ] Implémenter système de notation livreur

## Phase 7 : Système MIA Trust, Ads et SEO
- [ ] Créer système de réputation vendeur (ancienneté, commandes, avis)
- [ ] Implémenter badges de confiance
- [ ] Créer système de détection anti-fraude
- [ ] Implémenter MIA Ads (création de campagnes)
- [ ] Créer gestion des placements sponsorisés
- [ ] Implémenter ciblage par pays et catégorie
- [ ] Créer tableau de bord statistiques publicitaires
- [ ] Implémenter génération de sitemap
- [ ] Créer données structurées schema.org
- [ ] Implémenter balises meta pour SEO
- [ ] Créer fichier robots.txt

## Phase 8 : Dashboard Admin et Règles Firestore
- [ ] Créer page AdminDashboard
- [ ] Implémenter gestion des utilisateurs
- [ ] Créer modération des contenus
- [ ] Implémenter gestion des disputes
- [ ] Créer rapports d'activité
- [ ] Implémenter règles Firestore complètes
- [ ] Créer indexes Firestore optimisés
- [ ] Implémenter logging de sécurité

## Phase 9 : Génération et Livraison du ZIP
- [ ] Préparer fichier .env.example
- [ ] Créer README.md avec instructions de déploiement
- [ ] Créer guide de configuration Firebase
- [ ] Générer fichier package.json complet
- [ ] Créer structure de dossiers finale
- [ ] Générer ZIP avec toute la structure
- [ ] Tester extraction et structure du ZIP

---

## Résumé

**Total tâches** : 80+
**Statut** : En cours de développement
**Priorité** : Phase 2 (Frontend découverte)
