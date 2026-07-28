/**
 * ProductPage Component
 * Individual product page with details, reviews, and purchase options
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Share2, ShoppingCart, MessageCircle, Star, ChevronLeft } from 'lucide-react';
import GiftBoostPanel from '@/components/GiftBoostPanel';
import ReportProductButton from '@/components/ReportProductButton';
import SimilarProducts from '@/components/SimilarProducts';
import ShareSheet from '@/components/ShareSheet';
import MediaPlayer from '@/components/MediaPlayer';
import { getProduct, getProductReviews, trackEvent } from '@/services/db.service';
import { getWhatsAppOrderLink } from '@/services/whatsapp.service';
import { sanitizeProductHtml } from '@/lib/sanitizeHtml';
import { useCart } from '../hooks/useCart';
import { useFavorite } from '../hooks/useFavorite';
import { Product, Review } from '../types';
import LoadingFallback from '../components/LoadingFallback';
import { useTranslation } from 'react-i18next';

interface ProductPageProps {}

export const ProductPage: React.FC<ProductPageProps> = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<'loading' | 'available' | 'unavailable'>('loading');
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({});
  const cart = useCart();
  const favorite = useFavorite(product?.id);

  const handleToggleFavorite = async () => {
    try {
      await favorite.toggle();
    } catch (error) {
      if ((error as Error).message === 'UNAUTHENTICATED') {
        navigate('/connexion', { state: { from: `/produit/${id}` } });
        return;
      }
      console.error('[ProductPage] toggleFavorite error', error);
    }
  };

  const variantAttributes = product?.variant_attributes ?? [];
  const allAttrsSelected =
    variantAttributes.length > 0 && variantAttributes.every((a) => Boolean(selectedAttrs[a.attribute]));
  const selectedVariant = allAttrsSelected
    ? (product?.variants ?? []).find((v) =>
        variantAttributes.every((a) => v.attributes[a.attribute] === selectedAttrs[a.attribute])
      )
    : undefined;
  const effectiveStock = variantAttributes.length > 0
    ? (selectedVariant ? selectedVariant.stock : 0)
    : (product?.stock ?? 0);
  const canOrder = variantAttributes.length === 0 || Boolean(selectedVariant);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const load = async () => {
      try {
        const data = await getProduct(id);
        if (cancelled || !data) {
          setLoading(false);
          return;
        }
        const media = ((data as any).product_media ?? []).sort((a: any, b: any) => a.position - b.position);
        setProduct({ ...data, images: media.map((m: any) => m.url) });
        trackEvent('product_view', 'product', data.id).catch(() => {});

        getProductReviews(data.id)
          .then((reviewsData) => !cancelled && setReviews(reviewsData))
          .catch((error) => console.error('Error fetching reviews:', error));
      } catch (error) {
        console.error('Error fetching product:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleAddToCart = () => {
    if (product && canOrder) {
      const variantLabel = selectedVariant
        ? variantAttributes.map((a) => selectedVariant.attributes[a.attribute]).filter(Boolean).join(' / ')
        : undefined;
      cart.addToCart({
        productId: product.id,
        name: variantLabel ? `${product.name} (${variantLabel})` : product.name,
        price: product.price,
        image: product.images?.[0] || '',
        quantity,
        shopId: product.shop_id || '',
      });
    }
  };

  // "Si désactivé, le bouton Commander n'envoie pas vers WhatsApp" -
  // on résout la disponibilité côté serveur (whatsapp-order Edge Function)
  // avant même d'afficher le bouton, plutôt que de construire un lien
  // wa.me générique côté client qui ignorerait le choix du vendeur.
  useEffect(() => {
    if (!product?.id) return;
    setWhatsappStatus('loading');
    getWhatsAppOrderLink(product.id, quantity)
      .then((link) => setWhatsappStatus(link.available ? 'available' : 'unavailable'))
      .catch(() => setWhatsappStatus('unavailable'));
  }, [product?.id, quantity]);

  const handleWhatsApp = async () => {
    if (!product) return;
    try {
      const link = await getWhatsAppOrderLink(product.id, quantity);
      if (link.available && link.whatsappUrl) {
        window.open(link.whatsappUrl, '_blank');
      }
    } catch (error) {
      console.error('WhatsApp order link failed:', error);
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('product.not_found')}</h2>
          <button
            onClick={() => navigate('/')}
            className="text-mia-green-600 hover:text-mia-green-700 font-semibold"
          >
            {t('product.back_home')}
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
            {t('product.back')}
          </button>
        </div>
      </div>

      {/* Product Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Images + vidéo (Partie 4 du plan) */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="bg-white rounded-lg overflow-hidden shadow-sm mb-4">
              {selectedImage === -1 && product.external_video_url ? (
                <MediaPlayer
                  url={product.external_video_url}
                  mode="full"
                  poster={product.images?.[0]}
                  className="w-full aspect-video"
                />
              ) : (
                <img
                  src={product.images?.[selectedImage] ?? ''}
                  alt={product.name}
                  className="w-full h-96 object-cover"
                />
              )}
            </div>
            {((product.images && product.images.length > 1) || product.external_video_url) && (
              <div className="flex gap-2">
                {product.external_video_url && (
                  <button
                    onClick={() => setSelectedImage(-1)}
                    className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 bg-black flex items-center justify-center ${
                      selectedImage === -1 ? 'border-mia-green-600' : 'border-gray-200'
                    }`}
                  >
                    {product.images?.[0] && (
                      <img src={product.images[0]} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
                    )}
                    <span className="relative z-10 text-white text-lg">▶</span>
                  </button>
                )}
                {product.images?.map((img, idx) => (
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
              {product.is_age_restricted && (
                <p className="inline-block bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-1 rounded mb-2">
                  🔞 Contenu réservé aux adultes
                </p>
              )}
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
                  {averageRating} ({t('product.reviews_count', { count: reviews.length })})
                </span>
              </div>

              {/* Price */}
              <div className="mb-6">
                <p className="text-4xl font-bold text-mia-green-600 mb-2">
                  {product.price?.toLocaleString('fr-FR')} XOF
                </p>
                {product.original_price && (
                  <p className="text-lg text-gray-500 line-through">
                    {product.original_price?.toLocaleString('fr-FR')} XOF
                  </p>
                )}
              </div>

              {/* Description */}
              <div
                className="prose prose-sm max-w-none text-gray-700 mb-6 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: sanitizeProductHtml(product.description ?? '') }}
              />

              {/* Variantes */}
              {variantAttributes.length > 0 && (
                <div className="mb-6 space-y-4">
                  {variantAttributes.map((attr) => (
                    <div key={attr.attribute}>
                      <p className="text-sm font-semibold text-gray-700 mb-2 capitalize">{attr.attribute}</p>
                      <div className="flex flex-wrap gap-2">
                        {attr.values.map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setSelectedAttrs((prev) => ({ ...prev, [attr.attribute]: value }))}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                              selectedAttrs[attr.attribute] === value
                                ? 'bg-mia-green-600 text-white border-mia-green-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-mia-green-400'
                            }`}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!allAttrsSelected && (
                    <p className="text-xs text-amber-600">{t('product.choose_option')}</p>
                  )}
                </div>
              )}

              {/* Stock Status */}
              <div className="mb-6">
                {canOrder ? (
                  <p className={`text-sm font-semibold ${effectiveStock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {effectiveStock > 0 ? t('product.in_stock', { count: effectiveStock }) : t('product.out_of_stock')}
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-gray-400">{t('product.choose_variant')}</p>
                )}
              </div>

              {/* Quantity & Actions */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-semibold text-gray-700">{t('product.quantity')}</label>
                  <div className="flex items-center border border-gray-300 rounded-lg">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-3 py-2 text-gray-600 hover:bg-gray-100"
                    >
                      −
                    </button>
                    <span className="px-4 py-2 font-semibold">{quantity}</span>
                    <button
                      onClick={() => setQuantity(Math.min(effectiveStock || 10, quantity + 1))}
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
                  disabled={!canOrder || effectiveStock === 0}
                  className="w-full bg-mia-green-600 hover:bg-mia-green-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <ShoppingCart size={20} />
                  {!canOrder ? t('product.choose_variant_button') : t('product.add_to_cart')}
                </motion.button>

                {/* Bouton commande WhatsApp - n'apparaît que si le vendeur
                    (ou le produit collaboratif) a activé ce canal. Aucun
                    lien de secours générique n'est proposé si désactivé,
                    pour respecter le choix de vie privée du vendeur. */}
                {whatsappStatus === 'available' && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleWhatsApp}
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <MessageCircle size={20} />
                    {t('product.order_whatsapp')}
                  </motion.button>
                )}
              </div>

              {/* Share & Wishlist */}
              <div className="flex gap-4 mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={handleToggleFavorite}
                  disabled={favorite.toggling}
                  aria-pressed={favorite.isFavorited}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors disabled:opacity-60 ${
                    favorite.isFavorited
                      ? 'text-red-500 hover:bg-red-50'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Heart size={20} fill={favorite.isFavorited ? 'currentColor' : 'none'} />
                  {favorite.isFavorited ? t('product.remove_from_favorites') : t('product.add_to_favorites')}
                </button>
                <button
                  onClick={() => setShareOpen(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Share2 size={20} />
                  {t('product.share')}
                </button>
              </div>

              {shareOpen && product && (
                <ShareSheet
                  productId={product.id}
                  productSlug={product.slug}
                  productName={product.name}
                  price={`${product.price?.toLocaleString('fr-FR')} XOF`}
                  onClose={() => setShareOpen(false)}
                />
              )}

              {product.shop_id && <GiftBoostPanel shopId={product.shop_id} productId={product.id} />}
              <ReportProductButton productId={product.id} />
            </div>
          </motion.div>
        </div>

        {/* Reviews Section */}
        <div className="mt-12 bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('product.customer_reviews', { count: reviews.length })}</h2>
          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.slice(0, 5).map((review) => (
                <div key={review.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900">{review.author_name || t('product.anonymous')}</span>
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
            <p className="text-gray-600 text-center py-8">{t('product.no_reviews_yet')}</p>
          )}
        </div>

        {/* Produits similaires - triables prix/qualité/récence (demande explicite) */}
        {product.id && <SimilarProducts productId={product.id} />}
      </div>
    </div>
  );
};

export default ProductPage;
