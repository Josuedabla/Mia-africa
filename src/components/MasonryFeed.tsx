/**
 * MasonryFeed
 *
 * PARTIE 3.2 (grille asymétrique façon Pinterest) + PARTIE 3.4 (mélange
 * du flux, pas 100% "ce que l'algo pense que tu aimes") + PARTIE 3.4 de
 * "infinite scroll comme YouTube: jamais tout le catalogue d'un coup".
 *
 * Implémentation en colonnes CSS (column-count) plutôt qu'une lib
 * externe (react-masonry-css) pour ne pas ajouter de dépendance non
 * encore présente dans le projet - le même effet visuel (hauteurs de
 * cartes variables selon le ratio réel de l'image) s'obtient nativement
 * avec `columns` + `break-inside-avoid`, supporté par tous les
 * navigateurs modernes.
 *
 * Infinite scroll réel : un sentinel invisible en bas de liste, observé
 * par IntersectionObserver - dès qu'il entre dans le viewport, on charge
 * la page suivante. Contrairement à TikTok qui masque totalement la
 * progression, on affiche un repère discret ("Vous avez vu N nouveautés
 * aujourd'hui") - choix délibéré du plan de croissance (Partie 3.2) pour
 * donner un point de sortie naturel plutôt qu'un flux sans fin invisible.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import PersonalizeFeedCard from '@/components/PersonalizeFeedCard';
import { getDiscoveryFeedPage } from '@/services/db.service';
import { useCart } from '@/hooks/useCart';
import type { Product } from '@/types';

interface MasonryFeedProps {
  category: string | null;
  /** Injecte l'encart de personnalisation toutes les N cartes (Partie "encart de fin de flux"). */
  personalizeCardEvery?: number;
}

function productImage(p: Product): string | undefined {
  return p.images?.[0] ?? (p as any).product_media?.[0]?.url;
}

export default function MasonryFeed({ category, personalizeCardEvery = 24 }: MasonryFeedProps) {
  const navigate = useNavigate();
  const cart = useCart();
  const [items, setItems] = useState<Product[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadPage = useCallback(
    async (pageToLoad: number, replace: boolean) => {
      setLoading(true);
      try {
        const { items: newItems, hasMore: more } = await getDiscoveryFeedPage('', pageToLoad, 12, category);
        setItems((prev) => (replace ? newItems : [...prev, ...newItems]));
        setHasMore(more);
      } finally {
        setLoading(false);
      }
    },
    [category]
  );

  // Recharge depuis zéro quand la catégorie change (nouvelle session de
  // découverte), plutôt que d'empiler sur un flux obsolète.
  useEffect(() => {
    setPage(0);
    loadPage(0, true);
  }, [category, loadPage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          loadPage(nextPage, false);
        }
      },
      { rootMargin: '400px' } // charge un peu avant que l'utilisateur n'atteigne réellement le bas
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [page, hasMore, loading, loadPage]);

  if (items.length === 0 && !loading) {
    return <p className="text-sm text-gray-400 py-8 text-center">Aucun produit à afficher pour le moment.</p>;
  }

  return (
    <div>
      {/* columns-2/3/4 + break-inside-avoid = grille asymétrique native,
          chaque carte garde son propre ratio d'image (pas d'aspect-ratio
          forcé identique pour toutes, contrairement à l'ancienne grille). */}
      <div className="columns-2 md:columns-3 lg:columns-4 gap-4 [&>*]:mb-4">
        {items.map((product, index) => (
          <React.Fragment key={product.id}>
            <div className="break-inside-avoid">
              <ProductCard
                id={product.id}
                name={product.name}
                price={product.price}
                oldPrice={(product as any).original_price}
                image={productImage(product)}
                videoUrl={product.external_video_url}
                shopName={(product as any).shop_name ?? ''}
                likes={product.likes_count ?? 0}
                views={(product as any).views ?? 0}
                isTrending={product.is_trending}
                isNew={product.is_new}
                onClick={() => navigate(`/produit/${product.id}`)}
                onAddToCart={() =>
                  cart.addToCart({
                    productId: product.id,
                    name: product.name,
                    price: product.price,
                    image: productImage(product) ?? '',
                    quantity: 1,
                    shopId: (product as any).shop_id ?? '',
                  })
                }
              />
            </div>
            {/* Encart "Personnalisez votre flux" injecté périodiquement -
                jamais à la toute première vague pour ne pas interrompre
                la découverte avant qu'elle ait commencé. */}
            {(index + 1) % personalizeCardEvery === 0 && (
              <div className="break-inside-avoid">
                <PersonalizeFeedCard />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      <div ref={sentinelRef} className="h-4" />

      {loading && (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-mia-green-600" size={24} />
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <p className="text-center text-xs text-gray-400 py-6">
          Vous avez vu {items.length} produits aujourd'hui. Revenez plus tard pour en découvrir d'autres !
        </p>
      )}
    </div>
  );
}
