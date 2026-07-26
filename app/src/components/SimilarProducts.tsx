/**
 * SimilarProducts
 *
 * "Il est sur un produit, il voit les similaires et du moins cher vers
 * le plus cher, plus bonne qualité et plus commandé vers moins qualité,
 * plus récent vers vieux." Chips de tri au-dessus d'une grille de
 * ProductCard, rechargées via discovery.service.ts::getSimilarProducts
 * à chaque changement de tri - sans recharger toute la page produit.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import { getSimilarProducts, type SimilarProductsSort } from '@/services/discovery.service';
import { useCart } from '@/hooks/useCart';
import { getWhatsAppOrderLink } from '@/services/whatsapp.service';
import type { Product } from '@/types';

interface SimilarProductsProps {
  productId: string;
}

const SORT_OPTIONS: { value: SimilarProductsSort; label: string }[] = [
  { value: 'smart', label: 'Recommandé' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'quality', label: 'Meilleure qualité' },
  { value: 'newest', label: 'Plus récent' },
];

export default function SimilarProducts({ productId }: SimilarProductsProps) {
  const [sortBy, setSortBy] = useState<SimilarProductsSort>('smart');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const cart = useCart();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSimilarProducts(productId, sortBy, 12);
      setProducts(data);
    } catch (error) {
      console.error('Error loading similar products:', error);
    } finally {
      setLoading(false);
    }
  }, [productId, sortBy]);

  useEffect(() => {
    load();
  }, [load]);

  const handleWhatsApp = async (product: Product) => {
    try {
      const link = await getWhatsAppOrderLink(product.id, 1);
      if (link.available && link.whatsappUrl) window.open(link.whatsappUrl, '_blank');
    } catch (error) {
      console.error('WhatsApp order link failed:', error);
    }
  };

  if (!loading && products.length === 0) return null;

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Produits similaires</h2>

      {/* Chips de tri */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-1 px-1">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSortBy(opt.value)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              sortBy === opt.value
                ? 'bg-mia-green-600 text-white border-mia-green-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-mia-green-600" size={28} />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              id={p.id}
              name={p.name}
              price={p.price}
              oldPrice={(p as any).original_price}
              image={(p as any).images?.[0]}
              videoUrl={(p as any).external_video_url}
              shopName={(p as any).shop_name ?? ''}
              likes={(p as any).likes_count ?? 0}
              views={(p as any).views ?? 0}
              isTrending={(p as any).is_trending}
              isNew={(p as any).is_new}
              onClick={() => navigate(`/product/${(p as any).slug ?? p.id}`)}
              onAddToCart={() =>
                cart.addToCart({
                  productId: p.id,
                  name: p.name,
                  price: p.price,
                  image: (p as any).images?.[0] ?? '',
                  quantity: 1,
                  shopId: (p as any).shop_id ?? '',
                })
              }
              onWhatsApp={() => handleWhatsApp(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
