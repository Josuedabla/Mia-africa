/**
 * ProductCard Component
 * Displays a product card with image, name, price, and actions
 */

import React, { useState } from 'react';
import { Heart, ShoppingCart, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  oldPrice?: number;
  image?: string;
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
  const [isLiked, setIsLiked] = useState(false);
  const discount = oldPrice ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLiked(!isLiked);
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
      <div className="relative bg-gray-100 aspect-square overflow-hidden">
        {image ? (
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
          <span>❤️ {likes.toLocaleString()}</span>
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
