/**
 * HomePage Component
 * Main landing page with discovery sections
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, MapPin, ShoppingBag, AlertCircle } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import firestore from '../services/firestore.service';
import { useCart } from '../hooks/useCart';
import { LoadingFallback } from '../components/LoadingFallback';
import { EmptyState } from '../components/EmptyState';

interface Product {
  id: string;
  name: string;
  price: number;
  oldPrice?: number;
  images: string[];
  shopName: string;
  stats: { totalViews: number; totalLikes: number };
  isTrending?: boolean;
  isNew?: boolean;
}

const COUNTRIES = [
  { code: 'TG', name: 'Togo' },
  { code: 'BJ', name: 'Bénin' },
  { code: 'CM', name: 'Cameroun' },
  { code: 'GH', name: 'Ghana' },
];

const CATEGORIES = [
  { name: 'Mode', emoji: '👗' },
  { name: 'Électronique', emoji: '📱' },
  { name: 'Beauté', emoji: '💄' },
  { name: 'Maison', emoji: '🏠' },
  { name: 'Santé', emoji: '💊' },
  { name: 'Sports', emoji: '⚽' },
];

export const HomePage: React.FC = () => {
  const [selectedCountry, setSelectedCountry] = useState('TG');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [newProducts, setNewProducts] = useState<Product[]>([]);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToCart } = useCart();

  // Load products on mount and when country changes
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const [trending, newProds] = await Promise.all([
          firestore.getTrendingProducts(selectedCountry, 12),
          firestore.getNewProducts(selectedCountry, 12),
        ]);
        setTrendingProducts(trending as Product[]);
        setNewProducts(newProds as Product[]);
      } catch (error: any) {
        console.error('Error loading products:', error);
        setError('Impossible de charger les produits. Vérifiez votre connexion.');
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [selectedCountry]);

  // Load category products when category changes
  useEffect(() => {
    if (selectedCategory) {
      const loadCategoryProducts = async () => {
        try {
          setError(null);
          const products = await firestore.getProductsByCategory(
            selectedCategory,
            selectedCountry,
            12
          );
          setCategoryProducts(products as Product[]);
        } catch (error: any) {
          console.error('Error loading category products:', error);
          setError('Impossible de charger les produits de cette catégorie.');
        }
      };

      loadCategoryProducts();
    }
  }, [selectedCategory, selectedCountry]);

  const handleAddToCart = (product: Product) => {
    addToCart({
      productId: product.id,
      shopId: '',
      name: product.name,
      price: product.price,
      quantity: 1,
      image: product.images[0],
    });
  };

  const handleWhatsApp = (product: Product) => {
    const message = `Bonjour, je suis intéressé par: ${product.name} (${product.price} XOF)`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* Logo & Title */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-gradient">MIA</div>
              <span className="text-xs text-gray-600">Market Intelligence Africa</span>
            </div>
            <div className="flex items-center gap-2">
              <ShoppingBag className="text-mia-green-600" size={24} />
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Chercher des produits..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-mia-green-600"
              />
            </div>
          </div>

          {/* Country Selector */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <MapPin size={18} className="text-gray-600 flex-shrink-0" />
            {COUNTRIES.map((country) => (
              <motion.button
                key={country.code}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedCountry(country.code)}
                className={`px-4 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCountry === country.code
                    ? 'bg-mia-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {country.name}
              </motion.button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Error Alert */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 mb-6"
          >
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-semibold text-red-900">Erreur</h4>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Categories */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Catégories</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {CATEGORIES.map((category) => (
              <motion.button
                key={category.name}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() =>
                  setSelectedCategory(
                    selectedCategory === category.name ? null : category.name
                  )
                }
                className={`p-3 rounded-lg text-center transition-all ${
                  selectedCategory === category.name
                    ? 'bg-mia-green-600 text-white shadow-lg'
                    : 'bg-white text-gray-900 border border-gray-200 hover:border-mia-green-600'
                }`}
              >
                <div className="text-2xl mb-1">{category.emoji}</div>
                <div className="text-xs font-semibold">{category.name}</div>
              </motion.button>
            ))}
          </div>
        </section>

        {/* Trending Products */}
        {!selectedCategory && (
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xl font-bold text-gray-900">🔥 Tendances</h2>
            </div>
            {loading ? (
              <LoadingFallback />
            ) : trendingProducts.length === 0 ? (
              <EmptyState
                title="Aucun produit tendance"
                description="Revenez plus tard pour découvrir les produits populaires."
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {trendingProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    price={product.price}
                    oldPrice={product.oldPrice}
                    image={product.images[0]}
                    shopName={product.shopName}
                    likes={product.stats.totalLikes}
                    views={product.stats.totalViews}
                    isTrending={product.isTrending}
                    onAddToCart={() => handleAddToCart(product)}
                    onWhatsApp={() => handleWhatsApp(product)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* New Products */}
        {!selectedCategory && (
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xl font-bold text-gray-900">✨ Nouveautés</h2>
            </div>
            {loading ? (
              <LoadingFallback />
            ) : newProducts.length === 0 ? (
              <EmptyState
                title="Aucune nouveauté"
                description="Les nouveaux produits arriveront bientôt."
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {newProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    price={product.price}
                    oldPrice={product.oldPrice}
                    image={product.images[0]}
                    shopName={product.shopName}
                    likes={product.stats.totalLikes}
                    views={product.stats.totalViews}
                    isNew={product.isNew}
                    onAddToCart={() => handleAddToCart(product)}
                    onWhatsApp={() => handleWhatsApp(product)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Category Products */}
        {selectedCategory && (
          <section className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{selectedCategory}</h2>
            {loading ? (
              <LoadingFallback />
            ) : categoryProducts.length === 0 ? (
              <EmptyState
                title={`Aucun produit en ${selectedCategory}`}
                description="Essayez une autre catégorie ou un autre pays."
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {categoryProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    price={product.price}
                    oldPrice={product.oldPrice}
                    image={product.images[0]}
                    shopName={product.shopName}
                    likes={product.stats.totalLikes}
                    views={product.stats.totalViews}
                    onAddToCart={() => handleAddToCart(product)}
                    onWhatsApp={() => handleWhatsApp(product)}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

export default HomePage;
