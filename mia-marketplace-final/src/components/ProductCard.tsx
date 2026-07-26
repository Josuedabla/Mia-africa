/**
 * ProductCard Component
 * Displays a product card with image, name, price, and actions
 */

import React, { useEffect, useState } from 'react';
import { Heart, ShoppingCart, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import MediaPlayer from '@/components/MediaPlayer';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  oldPrice?: number;
  image?: string;
  /** Lien YouTube/TikTok optionnel - déclenche la prévisualisation au survol (Partie 3.5). */
  videoUrl?: string;
  shopName: string;
  likes: number;
  views: number;
  isTrending?: boolean;
  isNew?: boolean;
  onAddToCart?: () => void;
  onLike?: () => void;
  onClick?: () => void;
  onWhatsApp?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  id,
  name,
  price,
  oldPrice,
  image,
  videoUrl,
  shopName,
  likes,
  views,
  isTrending,
  isNew,
  onAddToCart,
  onLike,
  onClick,
  onWhatsApp,
}) => {
  const [hovering, setHovering] = useState(false);
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(likes);
  const discount = oldPrice ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;

  // Garde likeCount aligné si le parent recharge la carte avec des props
  // fraîches (nouvelle page de flux, etc.)
  useEffect(() => setLikeCount(likes), [likes]);

  // Sait si CET utilisateur a déjà aimé ce produit, pour que le cœur
  // reflète un vrai état persistant plutôt qu'un simple toggle local qui
  // se réinitialise à chaque remontage/rechargement de la carte.
  useEffect(() => {
    if (!user) {
      setIsLiked(false);
      return;
    }
    let cancelled = false;
    supabase
      .from('likes')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('product_id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsLiked(!!data);
      });
    return () => {
      cancelled = true;
    };
  }, [user, id]);

  // Persiste réellement le like (table `likes`, RLS: chacun gère les
  // siens) - le trigger trg_sync_product_likes tient products.likes_count
  // à jour côté serveur, ce qui alimente ensuite les stats de confiance
  // affichées sur le profil boutique.
  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      onLike?.();
      return;
    }
    const next = !isLiked;
    setIsLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      if (next) {
        await supabase.from('likes').insert({ user_id: user.id, product_id: id });
      } else {
        await supabase.from('likes').delete().eq('user_id', user.id).eq('product_id', id);
      }
    } catch {
      // Rollback optimiste en cas d'échec réseau/RLS
      setIsLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
    }
    onLike?.();
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToCart?.();
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    onWhatsApp?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer transition-shadow hover:shadow-lg"
      onClick={onClick}
    >
      {/* Image Container */}
      <div
        className="relative bg-gray-100 aspect-square overflow-hidden"
        onMouseEnter={() => videoUrl && setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {videoUrl && hovering ? (
          <MediaPlayer url={videoUrl} mode="hoverPreview" active poster={image} className="w-full h-full object-cover" />
        ) : image ? (
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-mia-green-100 to-mia-orange-100">
            <span className="text-gray-400">No Image</span>
          </div>
        )}
        {videoUrl && !hovering && (
          <span className="absolute bottom-2 left-2 bg-black/60 text-white rounded-full p-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </span>
        )}

        {/* Badges */}
        <div className="absolute top-2 right-2 flex flex-col gap-2">
          {isTrending && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
              🔥 Tendance
            </span>
          )}
          {isNew && (
            <span className="bg-mia-green-600 text-white text-xs font-bold px-2 py-1 rounded">
              ✨ Nouveau
            </span>
          )}
          {discount > 0 && (
            <span className="bg-mia-orange-600 text-white text-xs font-bold px-2 py-1 rounded">
              -{discount}%
            </span>
          )}
        </div>

        {/* Like Button */}
        <button
          onClick={handleLike}
          className="absolute top-2 left-2 bg-white rounded-full p-2 shadow-md hover:bg-gray-100 transition-colors"
        >
          <Heart
            size={18}
            className={isLiked ? 'fill-red-500 text-red-500' : 'text-gray-600'}
          />
        </button>
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Shop Name */}
        <p className="text-xs text-gray-500 mb-1">{shopName}</p>

        {/* Product Name */}
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-2">{name}</h3>

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-lg font-bold text-mia-green-600">
            {price.toLocaleString()} XOF
          </span>
          {oldPrice && (
            <span className="text-xs text-gray-400 line-through">
              {oldPrice.toLocaleString()} XOF
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
          <span>👁️ {views.toLocaleString()}</span>
          <span>❤️ {likeCount.toLocaleString()}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleAddToCart}
            className="flex-1 bg-mia-green-600 hover:bg-mia-green-700 text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
          >
            <ShoppingCart size={14} />
            Ajouter
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleWhatsApp}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
          >
            <MessageCircle size={14} />
            WhatsApp
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;
