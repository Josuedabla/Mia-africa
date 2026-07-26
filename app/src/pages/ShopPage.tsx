/**
 * ShopPage Component
 * Individual shop/vendor page with products and information
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageCircle, Star, ChevronLeft, Grid, Heart, ShoppingBag, Users, BadgeCheck, CalendarDays } from 'lucide-react';
import { getShopBySlug, getShopProducts, getShopTrustStats } from '@/services/db.service';
import { Shop, Product, ShopTrustStats } from '../types';
import LoadingFallback from '../components/LoadingFallback';
import ProductCard from '../components/ProductCard';
import WeeklyBadges from '@/components/WeeklyBadges';

interface ShopPageProps {}

// Ancienneté lisible, sans dépendance de formatage de date externe.
function memberSinceLabel(iso?: string): string | null {
  if (!iso) return null;
  const months = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30))
  );
  if (months < 1) return "Membre depuis moins d'un mois";
  if (months < 12) return `Membre depuis ${months} mois`;
  const years = Math.floor(months / 12);
  return `Membre depuis ${years} an${years > 1 ? 's' : ''}`;
}

export const ShopPage: React.FC<ShopPageProps> = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [trustStats, setTrustStats] = useState<ShopTrustStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShop = async () => {
      if (!slug) return;
      try {
        const shopData = await getShopBySlug(slug);
        if (shopData) {
          setShop(shopData);
          const [productsData, stats] = await Promise.all([
            getShopProducts(shopData.id),
            getShopTrustStats(shopData.id).catch(() => null),
          ]);
          setProducts(productsData as Product[]);
          setTrustStats(stats);
        }
      } catch (error) {
        console.error('Error fetching shop:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchShop();
  }, [slug]);

  const handleWhatsApp = () => {
    if (shop && shop.whatsapp_number) {
      const message = `Bonjour, j'aimerais en savoir plus sur votre boutique ${shop.name}`;
      window.open(`https://wa.me/${shop.whatsapp_number}?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  const averageRating = shop?.rating || 0;

  if (loading) {
    return <LoadingFallback />;
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Boutique non trouvée</h2>
          <button
            onClick={() => navigate('/')}
            className="text-mia-green-600 hover:text-mia-green-700 font-semibold"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-mia-green-600 hover:text-mia-green-700 font-semibold"
          >
            <ChevronLeft size={20} />
            Retour
          </button>
        </div>
      </div>

      {/* Shop Banner */}
      <div className="bg-gradient-to-r from-mia-green-600 to-mia-orange-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-4xl font-bold">{shop.name}</h1>
                {trustStats?.verified && (
                  <span
                    title="Boutique vérifiée"
                    className="inline-flex items-center gap-1 bg-white/15 text-white text-xs font-bold px-2.5 py-1 rounded-full"
                  >
                    <BadgeCheck size={14} className="text-sky-300" /> Vérifiée
                  </span>
                )}
              </div>
              <p className="text-white/80 mb-4 max-w-2xl">{shop.description}</p>
              <div className="mb-4"><WeeklyBadges shopId={shop.id} /></div>
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={16}
                        className={i < Math.round(averageRating) ? 'fill-yellow-400 text-yellow-400' : 'text-white/30'}
                      />
                    ))}
                  </div>
                  <span>{averageRating.toFixed(1)}/5{trustStats ? ` (${trustStats.total_reviews} avis)` : ''}</span>
                </div>
                {/* shop.location is now a PostGIS geography point (lat/lng),
                    not a display string - a text `city` column could be
                    added to the shops table if a human-readable address
                    display is wanted here later. */}
              </div>

              {/* Signaux de confiance : likes cumulés, commandes totales,
                  abonnés, ancienneté - preuve sociale visible dès l'arrivée
                  sur le profil public du vendeur. */}
              {trustStats && (
                <div className="flex flex-wrap items-center gap-4 mt-5 text-sm">
                  <span className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
                    <Heart size={15} className="text-pink-300" />
                    {trustStats.total_likes.toLocaleString()} j'aime
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
                    <ShoppingBag size={15} className="text-amber-200" />
                    {trustStats.total_orders.toLocaleString()} commandes
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
                    <Users size={15} className="text-emerald-200" />
                    {trustStats.total_followers.toLocaleString()} abonnés
                  </span>
                  {memberSinceLabel(trustStats.member_since) && (
                    <span className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
                      <CalendarDays size={15} className="text-white/70" />
                      {memberSinceLabel(trustStats.member_since)}
                    </span>
                  )}
                </div>
              )}
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleWhatsApp}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2 transition-colors"
            >
              <MessageCircle size={20} />
              Contacter
            </motion.button>
          </div>
        </div>
      </div>

      {/* Products Section */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center gap-2 mb-8">
          <Grid size={24} className="text-mia-green-600" />
          <h2 className="text-2xl font-bold text-gray-900">
            Produits ({products.length})
          </h2>
        </div>

        {products.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate(`/produit/${product.id}`)}
                className="cursor-pointer"
              >
                <ProductCard
                  id={product.id}
                  name={product.name}
                  price={product.price}
                  oldPrice={product.original_price}
                  image={product.images?.[0]}
                  videoUrl={product.external_video_url}
                  shopName={shop.name}
                  likes={product.likes_count ?? 0}
                  views={product.views ?? 0}
                  isTrending={product.is_trending}
                  isNew={product.is_new}
                  onClick={() => navigate(`/produit/${product.id}`)}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">Aucun produit pour le moment</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShopPage;
