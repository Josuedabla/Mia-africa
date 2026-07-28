/**
 * MIA Home - "social commerce" experience.
 *
 * Full rebuild, not a patch: the previous version had a literal "choose
 * your country" <select> (COUNTRIES array + a dropdown), which is exactly
 * what the product direction now forbids - country comes from
 * useCountry() (IP/phone/GPS), never a picker.
 *
 * Inspiration blend, all real and functional (not just decorative):
 *  - YouTube: visible MIA logo, central search, personalized sections
 *  - TikTok: a vertical discovery feed of large product cards with
 *    like/gift/boost actions, sourced from trending + new products
 *  - Amazon: a fast horizontal "Tendances" row for quick buy-oriented browsing
 *  - Uber: an opt-in "Boutiques près de vous" section using real
 *    PostGIS distance search once the person explicitly asks for it
 *    (never auto-prompts for GPS permission on page load)
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bell, Wallet as WalletIcon, Heart, Flame, Sparkles, Trophy, Navigation, Loader2, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useCountry } from '@/hooks/useCountry';
import { useWallet } from '@/hooks/useCoins';
import { getTrendingProducts, getNewProducts, getBestSellers, trackEvent } from '@/services/db.service';
import { searchProducts, nearbyShops } from '@/services/search.service';
import ProductCard from '@/components/ProductCard';
import LoadingFallback from '@/components/LoadingFallback';
import SpotlightCarousel from '@/components/SpotlightCarousel';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import MasonryFeed from '@/components/MasonryFeed';
import type { Product } from '@/types';

const CATEGORIES = [
  { name: 'Mode', emoji: '👗' },
  { name: 'Électronique', emoji: '📱' },
  { name: 'Beauté', emoji: '💄' },
  { name: 'Maison', emoji: '🏠' },
  { name: 'Alimentation', emoji: '🍲' },
  { name: 'Autre', emoji: '✨' },
];

function productImage(p: Product): string | undefined {
  return p.images?.[0] ?? (p as any).product_media?.[0]?.url;
}

// ---------------------------------------------------------------------
// TikTok-style discovery card (large, vertical feed)
// ---------------------------------------------------------------------
interface DiscoveryCardProps {
  product: Product;
  onOpen: () => void;
}

const DiscoveryCard: React.FC<DiscoveryCardProps> = ({ product, onOpen }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(product.likes_count ?? 0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('likes')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('product_id', product.id)
      .maybeSingle()
      .then(({ data }) => setLiked(!!data));
  }, [user, product.id]);

  const toggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    if (liked) {
      await supabase.from('likes').delete().eq('user_id', user.id).eq('product_id', product.id);
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from('likes').insert({ user_id: user.id, product_id: product.id });
      setLiked(true);
      setLikeCount((c) => c + 1);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      onClick={onOpen}
      className="relative rounded-2xl overflow-hidden bg-gray-100 aspect-[4/5] cursor-pointer group"
    >
      {productImage(product) ? (
        <img
          src={productImage(product)}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-mia-green-200 to-mia-green-400" />
      )}

      {product.is_boosted && (
        <span className="absolute top-3 left-0 bg-pink-600 text-white text-[10px] font-bold px-3 py-1 rounded-r-full flex items-center gap-1">
          {t('home.boosted')}
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 pt-10 text-white">
        <p className="font-semibold text-sm line-clamp-1">{product.name}</p>
        <p className="text-mia-green-300 font-bold">{product.price?.toLocaleString()} {product.currency ?? 'FCFA'}</p>
        <p className="text-xs text-white/70">{product.shop_name}</p>
      </div>

      <button
        onClick={toggleLike}
        className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center"
      >
        <Heart size={18} className={liked ? 'fill-pink-500 text-pink-500' : 'text-white'} />
      </button>
      {likeCount > 0 && (
        <span className="absolute top-13 right-3 mt-11 text-[10px] text-white/80 font-semibold">{likeCount}</span>
      )}
    </motion.div>
  );
};

// ---------------------------------------------------------------------
// Carrousel horizontal thématique factorisé (Tendances/Nouveautés/Tops Ventes)
// ---------------------------------------------------------------------
function ProductCarousel({
  icon,
  title,
  products,
  onOpen,
}: {
  icon: React.ReactNode;
  title: string;
  products: Product[];
  onOpen: (productId: string) => void;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="font-bold text-gray-900 text-lg">{title}</h2>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {products.map((p) => (
          <div key={p.id} className="shrink-0 w-40">
            <ProductCard
              id={p.id}
              name={p.name}
              price={p.price}
              oldPrice={(p as any).original_price}
              image={productImage(p)}
              videoUrl={p.external_video_url}
              shopName={(p as any).shop_name ?? ''}
              likes={p.likes_count ?? 0}
              views={(p as any).views ?? 0}
              isTrending={p.is_trending}
              isNew={p.is_new}
              onClick={() => onOpen(p.id)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  // Note : useCountry() n'est plus utilisé pour piloter l'affichage des
  // produits (Tendances/Nouveautés/Tops Ventes/Recherche/Feed principal).
  // Décision produit explicite : zéro barrière pays, zéro dépendance à la
  // détection IP/GPS/localStorage pour montrer du contenu. Le seul usage
  // géographique restant est "Boutiques près de vous", strictement
  // opt-in (l'utilisateur clique explicitement sur "Activer la
  // localisation"), via requestPreciseLocation ci-dessous.
  const { requestPreciseLocation } = useCountry();
  const { coins } = useWallet();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [trending, setTrending] = useState<Product[]>([]);
  const [newProducts, setNewProducts] = useState<Product[]>([]);
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [nearby, setNearby] = useState<any[] | null>(null);
  const [loadingNearby, setLoadingNearby] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getTrendingProducts('', 10),
      getNewProducts('', 10),
      getBestSellers('', 10),
    ])
      .then(([trendingData, newData, bestSellerData]) => {
        if (cancelled) return;
        setTrending(trendingData);
        setNewProducts(newData);
        setBestSellers(bestSellerData);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced search-as-you-type.
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const results = await searchProducts(searchQuery, { limit: 24 });
        setSearchResults(results as Product[]);
        trackEvent('search', undefined, undefined, { query: searchQuery }).catch(() => {});
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  // Ne sert plus que l'affichage des résultats de recherche (liste simple,
  // pas de pagination nécessaire pour une recherche déjà bornée) - le
  // flux principal hors recherche passe désormais par MasonryFeed, qui
  // gère sa propre pagination infinite-scroll (voir plus bas).
  const visibleSearchResults = useMemo(() => {
    if (!searchResults) return null;
    if (!activeCategory) return searchResults;
    return searchResults.filter((p) => p.category === activeCategory);
  }, [searchResults, activeCategory]);

  const handleFindNearby = useCallback(async () => {
    setLoadingNearby(true);
    try {
      const result = await requestPreciseLocation();
      if (!result) {
        setNearby([]);
        return;
      }
      // requestPreciseLocation only resolves the country - fetch the
      // actual coordinates again for the distance query itself.
      navigator.geolocation.getCurrentPosition(async (position) => {
        const shops = await nearbyShops(position.coords.latitude, position.coords.longitude, 20);
        setNearby(shops);
        setLoadingNearby(false);
      }, () => setLoadingNearby(false));
    } catch {
      setLoadingNearby(false);
    }
  }, [requestPreciseLocation]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ---------- Header: logo + central search + wallet/location (YouTube-inspired) ---------- */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <span className="font-extrabold text-2xl text-mia-green-600 tracking-tight shrink-0">MIA</span>

          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('nav.search_placeholder') as string}
              className="w-full bg-gray-100 rounded-full pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-mia-green-500"
            />
            {searching && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
          </div>

          <LanguageSwitcher className="hidden sm:inline-flex shrink-0" />

          {isAuthenticated ? (
            <>
              <button
                onClick={() => navigate('/portefeuille')}
                className="hidden sm:inline-flex items-center gap-1.5 bg-mia-green-600 text-white text-xs font-bold rounded-full px-3 py-2 shrink-0"
              >
                <WalletIcon size={14} /> {(coins ?? 0).toLocaleString()}
              </button>
              <button
                onClick={() => navigate('/mon-compte')}
                className="w-9 h-9 rounded-full bg-mia-green-50 text-mia-green-700 flex items-center justify-center shrink-0 font-bold text-sm"
                aria-label={t('nav.my_account') as string}
              >
                <User size={17} />
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate('/connexion')}
              className="inline-flex items-center gap-1.5 bg-mia-green-600 text-white text-xs font-bold rounded-full px-4 py-2 shrink-0"
            >
              {t('nav.login')}
            </button>
          )}

          <button className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0" aria-label={t('nav.notifications') as string}>
            <Bell size={17} className="text-gray-600" />
          </button>
        </div>

        {/* Category chips */}
        <div className="max-w-6xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveCategory(null)}
            className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border ${
              !activeCategory ? 'bg-mia-green-600 text-white border-mia-green-600' : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            {t('nav.all')}
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.name}
              onClick={() => setActiveCategory(c.name)}
              className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border flex items-center gap-1 ${
                activeCategory === c.name ? 'bg-mia-green-600 text-white border-mia-green-600' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-10">
        {/* ---------- Carrousel de rotation équitable (remplace les Stories 24h,
            jugées à risque de favoritisme perçu). Défilement continu,
            équité garantie côté serveur, mise en avant payante toujours
            étiquetée "Sponsorisé". ---------- */}
        {!searchResults && (
          <SpotlightCarousel onOpenShop={(slug) => navigate(`/boutique/${slug}`)} />
        )}

        {loading ? (
          <LoadingFallback />
        ) : (
          <>
            {/* ---------- Carrousels horizontaux thématiques (Partie 3.3 du plan de croissance) ---------- */}
            {!searchResults && trending.length > 0 && (
              <ProductCarousel
                icon={<Flame size={20} className="text-orange-500" />}
                title={`🔥 ${t('home.trending')}`}
                products={trending}
                onOpen={(id) => navigate(`/produit/${id}`)}
              />
            )}

            {!searchResults && newProducts.length > 0 && (
              <ProductCarousel
                icon={<Sparkles size={20} className="text-pink-500" />}
                title={`✨ ${t('home.new_arrivals')}`}
                products={newProducts}
                onOpen={(id) => navigate(`/produit/${id}`)}
              />
            )}

            {!searchResults && bestSellers.length > 0 && (
              <ProductCarousel
                icon={<Trophy size={20} className="text-amber-500" />}
                title={`🏆 ${t('home.best_sellers')}`}
                products={bestSellers}
                onOpen={(id) => navigate(`/produit/${id}`)}
              />
            )}

            {/* ---------- Boutiques près de vous (Uber-inspired, opt-in only) ---------- */}
            {!searchResults && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Navigation size={20} className="text-mia-green-600" />
                    <h2 className="font-bold text-gray-900 text-lg">{t('home.nearby_shops')}</h2>
                  </div>
                  {nearby === null && (
                    <button
                      onClick={handleFindNearby}
                      disabled={loadingNearby}
                      className="text-xs font-semibold text-mia-green-700 border border-mia-green-200 rounded-full px-3 py-1.5 flex items-center gap-1.5"
                    >
                      {loadingNearby && <Loader2 size={12} className="animate-spin" />}
                      {t('home.enable_location')}
                    </button>
                  )}
                </div>
                {nearby === null && (
                  <p className="text-sm text-gray-400">{t('home.enable_location_hint')}</p>
                )}
                {nearby !== null && nearby.length === 0 && (
                  <p className="text-sm text-gray-400">{t('home.no_nearby_shops')}</p>
                )}
                {nearby !== null && nearby.length > 0 && (
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {nearby.map((shop) => (
                      <button
                        key={shop.id}
                        onClick={() => navigate(`/boutique/${shop.slug}`)}
                        className="shrink-0 w-36 bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-mia-green-100 text-mia-green-700 flex items-center justify-center font-bold mb-2">
                          {shop.name?.[0]?.toUpperCase()}
                        </div>
                        <p className="text-sm font-semibold text-gray-900 line-clamp-1">{shop.name}</p>
                        <p className="text-xs text-gray-400">{shop.distance_km?.toFixed(1)} km</p>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ---------- Pour vous: flux principal (masonry + infinite scroll réel hors recherche) ---------- */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={20} className="text-pink-500" />
                <h2 className="font-bold text-gray-900 text-lg">
                  {searchResults ? t('home.results_for', { query: searchQuery }) : t('home.for_you')}
                </h2>
              </div>

              {searchResults ? (
                <>
                  {visibleSearchResults?.length === 0 && (
                    <p className="text-sm text-gray-400 py-8 text-center">{t('home.no_results')}</p>
                  )}
                  <AnimatePresence mode="popLayout">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {(visibleSearchResults ?? []).map((product) => (
                        <DiscoveryCard key={product.id} product={product} onOpen={() => navigate(`/produit/${product.id}`)} />
                      ))}
                    </div>
                  </AnimatePresence>
                </>
              ) : (
                <MasonryFeed category={activeCategory} />
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
