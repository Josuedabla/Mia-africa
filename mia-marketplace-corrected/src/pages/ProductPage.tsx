/**
 * ProductPage Component
 * Individual product page with details, reviews, and purchase options
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Share2, ShoppingCart, MessageCircle, Star, ChevronLeft } from 'lucide-react';
import GiftBoostPanel from '@/components/GiftBoostPanel';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useCart } from '../hooks/useCart';
import { Product, Review } from '../types';
import LoadingFallback from '../components/LoadingFallback';

interface ProductPageProps {}

export const ProductPage: React.FC<ProductPageProps> = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const cart = useCart();

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProduct({ id: docSnap.id, ...docSnap.data() } as Product);
        }
      } catch (error) {
        console.error('Error fetching product:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchReviews = async () => {
      if (!id) return;
      try {
        const q = query(collection(db, 'reviews'), where('productId', '==', id));
        const querySnapshot = await getDocs(q);
        const reviewsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Review[];
        setReviews(reviewsData);
      } catch (error) {
        console.error('Error fetching reviews:', error);
      }
    };

    fetchProduct();
    fetchReviews();
  }, [id]);

  const handleAddToCart = () => {
    if (product) {
      cart.addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.images?.[0] || '',
        quantity,
        shopId: product.shopId || ''
      });
    }
  };

  const handleWhatsApp = () => {
    if (product) {
      const message = `Bonjour, je suis intéressé par: ${product.name} (${product.price} XOF)`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : 0;

  if (loading) {
    return <LoadingFallback />;
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Produit non trouvé</h2>
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

      {/* Product Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Images */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="bg-white rounded-lg overflow-hidden shadow-sm mb-4">
              <img
                src={product.images?.[selectedImage] || product.image}
                alt={product.name}
                className="w-full h-96 object-cover"
              />
            </div>
            {product.images && product.images.length > 1 && (
              <div className="flex gap-2">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${
                      selectedImage === idx ? 'border-mia-green-600' : 'border-gray-200'
                    }`}
                  >
                    <img src={img} alt={`${product.name} ${idx}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Details */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="bg-white rounded-lg p-6 shadow-sm">
              {/* Title & Rating */}
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      className={i < Math.round(Number(averageRating)) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-600">
                  {averageRating} ({reviews.length} avis)
                </span>
              </div>

              {/* Price */}
              <div className="mb-6">
                <p className="text-4xl font-bold text-mia-green-600 mb-2">
                  {product.price?.toLocaleString('fr-FR')} XOF
                </p>
                {product.originalPrice && (
                  <p className="text-lg text-gray-500 line-through">
                    {product.originalPrice?.toLocaleString('fr-FR')} XOF
                  </p>
                )}
              </div>

              {/* Description */}
              <p className="text-gray-700 mb-6 leading-relaxed">
                {product.description}
              </p>

              {/* Stock Status */}
              <div className="mb-6">
                <p className={`text-sm font-semibold ${
                  (product.stock || 0) > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(product.stock || 0) > 0 ? `${product.stock} en stock` : 'Rupture de stock'}
                </p>
              </div>

              {/* Quantity & Actions */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-semibold text-gray-700">Quantité:</label>
                  <div className="flex items-center border border-gray-300 rounded-lg">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-3 py-2 text-gray-600 hover:bg-gray-100"
                    >
                      −
                    </button>
                    <span className="px-4 py-2 font-semibold">{quantity}</span>
                    <button
                      onClick={() => setQuantity(Math.min((product.stock || 10), quantity + 1))}
                      className="px-3 py-2 text-gray-600 hover:bg-gray-100"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Add to Cart Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddToCart}
                  disabled={(product.stock || 0) === 0}
                  className="w-full bg-mia-green-600 hover:bg-mia-green-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <ShoppingCart size={20} />
                  Ajouter au panier
                </motion.button>

                {/* WhatsApp Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleWhatsApp}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageCircle size={20} />
                  Contacter le vendeur
                </motion.button>
              </div>

              {/* Share & Wishlist */}
              <div className="flex gap-4 mt-6 pt-6 border-t border-gray-200">
                <button className="flex-1 flex items-center justify-center gap-2 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  <Heart size={20} />
                  Ajouter aux favoris
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  <Share2 size={20} />
                  Partager
                </button>
              </div>

              {product.shopId && <GiftBoostPanel shopId={product.shopId} productId={product.id} />}
            </div>
          </motion.div>
        </div>

        {/* Reviews Section */}
        <div className="mt-12 bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Avis clients ({reviews.length})</h2>
          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.slice(0, 5).map((review) => (
                <div key={review.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900">{review.authorName || 'Anonyme'}</span>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={14}
                          className={i < (review.rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-gray-700 text-sm">{review.comment}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-8">Aucun avis pour le moment</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductPage;
