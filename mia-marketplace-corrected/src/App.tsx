/**
 * App Component
 * Main application component with routing
 */

import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ProductPage from './pages/ProductPage';
import ShopPage from './pages/ShopPage';
import AdminPage from './pages/admin/AdminPage';
import DevenirVendeur from './pages/support/DevenirVendeur';
import AuthPage from './pages/AuthPage';
import { useCart } from './hooks/useCart';
import CartDrawer from './components/CartDrawer';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingFallback from './components/LoadingFallback';
import { ShoppingBag } from 'lucide-react';

// Lazy load the whole vendor space - it pulls in Tiptap/recharts, which
// public shoppers browsing the catalog never need to download.
const VendorLayout = lazy(() => import('./pages/vendor/VendorLayout'));
const VendorDashboard = lazy(() => import('./pages/vendor/VendorDashboard'));
const VendorProducts = lazy(() => import('./pages/vendor/VendorProducts'));
const VendorProductForm = lazy(() => import('./pages/vendor/VendorProductForm'));
const VendorOrders = lazy(() => import('./pages/vendor/VendorOrders'));
const VendorStats = lazy(() => import('./pages/vendor/VendorStats'));
const VendorAds = lazy(() => import('./pages/vendor/VendorAds'));
const VendorSettings = lazy(() => import('./pages/vendor/VendorSettings'));
const VendorOnboarding = lazy(() => import('./pages/vendor/VendorOnboarding'));
const WalletPage = lazy(() => import('./pages/WalletPage'));
const ReferralPage = lazy(() => import('./pages/ReferralPage'));

function App() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const cart = useCart();

  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-gray-50">
          {/* Cart Button (Floating) - Hidden on admin and vendor pages */}
          {cart.totalItems > 0 && !window.location.pathname.includes('/admin') && !window.location.pathname.includes('/vendeur') && (
            <button
              onClick={() => setIsCartOpen(true)}
              className="fixed bottom-6 right-6 bg-mia-green-600 hover:bg-mia-green-700 text-white rounded-full p-4 shadow-lg z-30 flex items-center justify-center"
            >
              <ShoppingBag size={24} />
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {cart.totalItems}
              </span>
            </button>
          )}

          {/* Cart Drawer */}
          <CartDrawer
            isOpen={isCartOpen}
            onClose={() => setIsCartOpen(false)}
            cart={cart}
            onUpdateQuantity={cart.updateQuantity}
            onRemoveItem={cart.removeFromCart}
            onCheckout={() => {
              // Handle checkout - redirect to Chariow or payment page
              console.log('Checkout:', cart);
              setIsCartOpen(false);
            }}
          />

          {/* Routes */}
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/produit/:id" element={<ProductPage />} />
            <Route path="/boutique/:slug" element={<ShopPage />} />
            <Route path="/devenir-vendeur" element={<DevenirVendeur />} />
            <Route path="/connexion" element={<AuthPage />} />
            <Route
              path="/portefeuille"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <WalletPage />
                </Suspense>
              }
            />
            <Route
              path="/parrainage"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <ReferralPage />
                </Suspense>
              }
            />

            {/* Admin Routes */}
            <Route path="/admin" element={<AdminPage />} />

            {/* Vendor onboarding (not a vendor yet / creating a shop) */}
            <Route
              path="/vendeur/bienvenue"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <VendorOnboarding />
                </Suspense>
              }
            />

            {/* Vendor space - nested under a shared layout + auth/role guard */}
            <Route
              path="/vendeur"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <VendorLayout />
                </Suspense>
              }
            >
              <Route path="dashboard" element={<VendorDashboard />} />
              <Route path="produits" element={<VendorProducts />} />
              <Route path="produits/nouveau" element={<VendorProductForm />} />
              <Route path="produits/:productId" element={<VendorProductForm />} />
              <Route path="commandes" element={<VendorOrders />} />
              <Route path="statistiques" element={<VendorStats />} />
              <Route path="publicite" element={<VendorAds />} />
              <Route path="parametres" element={<VendorSettings />} />
            </Route>

            {/* Catch all - redirect to home */}
            <Route path="*" element={<HomePage />} />
          </Routes>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
