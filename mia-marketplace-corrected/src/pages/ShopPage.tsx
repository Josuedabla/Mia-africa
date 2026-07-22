/**
 * ShopPage Component
 * Individual shop/vendor page with products and information
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageCircle, MapPin, Star, ChevronLeft, Grid } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Shop, Product } from '../types';
import LoadingFallback from '../components/LoadingFallback';
import ProductCard from '../components/ProductCard';

interface ShopPageProps {}

export const ShopPage: React.FC<ShopPageProps> = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShop = async () => {
      if (!slug) return;
      try {
        // Query shops by slug
        const q = query(collection(db, 'shops'), where('slug', '==', slug));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const shopDoc = querySnapshot.docs[0];
          setShop({ id: shopDoc.id, ...shopDoc.data() } as Shop);

          // Fetch shop products
          const productsQ = query(collection(db, 'products'), where('shopId', '==', shopDoc.id));
          const productsSnapshot = await getDocs(productsQ);
          const productsData = productsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Product[];
          setProducts(productsData);
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
    if (shop && shop.whatsappNumber) {
      const message = `Bonjour, j'aimerais en savoir plus sur votre boutique ${shop.name}`;
      window.open(`https://wa.me/${shop.whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
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
              <h1 className="text-4xl font-bold mb-2">{shop.name}</h1>
              <p className="text-white/80 mb-4 max-w-2xl">{shop.description}</p>
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
                  <span>{averageRating.toFixed(1)}/5</span>
                </div>
                {shop.location && (
                  <div className="flex items-center gap-2">
                    <MapPin size={16} />
                    <span>{shop.location}</span>
                  </div>
                )}
              </div>
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
                <ProductCard product={product} />
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
