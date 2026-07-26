/**
 * App Component
 * Main application component with routing - Supabase edition.
 */

import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ProductPage from './pages/ProductPage';
import ShopPage from './pages/ShopPage';
import AdminPage from './pages/admin/AdminPage';
import DevenirVendeur from './pages/support/DevenirVendeur';
import AuthPage from './pages/AuthPage';
import AccountPage from './pages/AccountPage';
import { useCart } from './hooks/useCart';
import CartDrawer from './components/CartDrawer';
import ErrorBoundary from './components/ErrorBoundary';
import ConsentBanner from './components/ConsentBanner';
import LoadingFallback from './components/LoadingFallback';
import { ShoppingBag } from 'lucide-react';

// Lazy load the whole vendor space and the other capability areas - they
// pull in Tiptap/recharts, which public shoppers browsing the catalog
// never need to download.
const VendorLayout = lazy(() => import('./pages/vendor/VendorLayout'));
const VendorDashboard = lazy(() => import('./pages/vendor/VendorDashboard'));
const VendorProducts = lazy(() => import('./pages/vendor/VendorProducts'));
const VendorProductForm = lazy(() => import('./pages/vendor/VendorProductForm'));
const VendorOrders = lazy(() => import('./pages/vendor/VendorOrders'));
const VendorStats = lazy(() => import('./pages/vendor/VendorStats'));
const VendorAds = lazy(() => import('./pages/vendor/VendorAds'));
const VendorSettings = lazy(() => import('./pages/vendor/VendorSettings'));
const VendorOnboarding = lazy(() => import('./pages/vendor/VendorOnboarding'));
const CoinsPage = lazy(() => import('./pages/CoinsPage'));
const ReferralPage = lazy(() => import('./pages/ReferralPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const CapabilitiesHub = lazy(() => import('./pages/CapabilitiesHub'));
const BecomeDriverPage = lazy(() => import('./pages/BecomeDriverPage'));
const BecomeCreatorPage = lazy(() => import('./pages/BecomeCreatorPage'));
const DriverDashboard = lazy(() => import('./pages/driver/DriverDashboard'));
const DriverActiveDelivery = lazy(() => import('./pages/driver/DriverActiveDelivery'));
const MyOrdersPage = lazy(() => import('./pages/MyOrdersPage'));
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const CheckoutGroupPage = lazy(() => import('./pages/CheckoutGroupPage'));
const CGU = lazy(() => import('./pages/legal/CGU'));
const CGV = lazy(() => import('./pages/legal/CGV'));
const Confidentialite = lazy(() => import('./pages/legal/Confidentialite'));
const SupportCenter = lazy(() => import('./pages/support/SupportCenter'));

function AppContent() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const cart = useCart();
  const navigate = useNavigate();

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
          <ConsentBanner />
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
              setIsCartOpen(false);
              navigate('/commander');
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
            <Route path="/mon-compte" element={<AccountPage />} />
            <Route path="/cgu" element={<CGU />} />
            <Route path="/cgv" element={<CGV />} />
            <Route path="/confidentialite" element={<Confidentialite />} />
            <Route
              path="/aide"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <SupportCenter />
                </Suspense>
              }
            />
            <Route
              path="/aide"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <SupportCenter />
                </Suspense>
              }
            />

            {/* Admin Routes */}
            <Route path="/admin" element={<AdminPage />} />

            {/* Capabilities hub - "one identity, many roles" entry point */}
            <Route
              path="/devenir"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <CapabilitiesHub />
                </Suspense>
              }
            />
            <Route
              path="/devenir-livreur"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <BecomeDriverPage />
                </Suspense>
              }
            />
            <Route
              path="/devenir-createur"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <BecomeCreatorPage />
                </Suspense>
              }
            />
            <Route
              path="/livreur/tournee"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <DriverDashboard />
                </Suspense>
              }
            />
            <Route
              path="/livreur/livraison/:deliveryId"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <DriverActiveDelivery />
                </Suspense>
              }
            />
            <Route
              path="/mes-commandes"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <MyOrdersPage />
                </Suspense>
              }
            />
            <Route
              path="/mes-commandes/:orderId"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <OrderDetailPage />
                </Suspense>
              }
            />
            <Route
              path="/commander"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <CheckoutPage />
                </Suspense>
              }
            />
            <Route
              path="/commande/groupe/:groupId"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <CheckoutGroupPage />
                </Suspense>
              }
            />

            {/* Pièces MIA & Parrainage */}
            <Route
              path="/pieces"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <CoinsPage />
                </Suspense>
              }
            />
            <Route path="/portefeuille" element={<Navigate to="/pieces" replace />} />
            <Route
              path="/parrainage"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <ReferralPage />
                </Suspense>
              }
            />
            <Route
              path="/classements"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <LeaderboardPage />
                </Suspense>
              }
            />

            {/* Vendor onboarding (not a seller yet / creating a shop) */}
            <Route
              path="/vendeur/bienvenue"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <VendorOnboarding />
                </Suspense>
              }
            />

            {/* Vendor space - nested under a shared layout + auth/capability guard */}
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
    </ErrorBoundary>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
