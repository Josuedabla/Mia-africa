# MIA Marketplace — État du projet

> Ce fichier remplace l'ancien `todo.md` (plan Firebase/Firestore/Algolia
> en 9 phases), obsolète depuis la migration du projet vers Supabase.
> L'historique détaillé de toutes les corrections et évolutions réelles
> se trouve dans `CORRECTIONS_APPLIQUEES.md`.

## Ce qui est en place

- Authentification, profils et capacités multiples (acheteur/créateur/vendeur/livreur) — Supabase Auth + RLS.
- Découverte, boutiques, produits, variantes, recherche.
- Panier, checkout multi-vendeur, paiement direct, wallet, paiement à la livraison.
- Portefeuille MIA (Moneroo), pièces virtuelles, cadeaux, boost produit avec paliers de prix.
- Parrainage à cashback réel (2 niveaux, déclenché uniquement par un achat).
- Dashboard vendeur complet + assistant IA (Gemini) pour les fiches produits.
- Parcours livreur (missions, tracking, confirmation par code).
- Dashboard admin (utilisateurs, stats, annonces, abonnements).
- i18n (fr/en/sw/ar/pt), détection pays/téléphone, domaines personnalisés pour boutiques.
- Politiques de boutique personnalisables, modération de contenu, âge minimum.

## Insuffisances connues à traiter

- Aucun test automatisé (`vitest` configuré mais 0 fichier `.test.*`).
- Pas de CI/CD (aucun `.github/workflows`).
- Pas de suivi du cash physique encaissé par un livreur en paiement à la livraison (aucune table `driver_balance`/`cash_owed`).
- Pas d'interface admin pour ajuster les taux économiques (`economics`) sans redéploiement.
- Configuration CDN/proxy pour la redirection des crawlers sociaux vers `product-meta` non automatisée, à mettre en place manuellement.
- `MONEROO_WEBHOOK_SECRET` à générer manuellement dans le dashboard Moneroo.
- Champs exacts de `/payments/initialize` et `/payouts/initialize` Moneroo à vérifier contre la documentation officielle avant le premier paiement réel.
- `sellerScore` reste statique, pas de calcul dynamique basé sur commandes/avis.
