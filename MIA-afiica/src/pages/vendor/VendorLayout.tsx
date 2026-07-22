/**
 * Shell layout for the whole vendor space: sidebar navigation + guard.
 * Redirects to onboarding if the user isn't a vendor yet, and to login
 * if not authenticated at all.
 */
import React from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useMyShop } from '@/hooks/useMyShop';
import LoadingFallback from '@/components/LoadingFallback';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  BarChart3,
  Megaphone,
  Settings,
  Store,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/vendeur/dashboard', label: 'Aperçu', icon: LayoutDashboard, end: true },
  { to: '/vendeur/produits', label: 'Produits', icon: Package },
  { to: '/vendeur/commandes', label: 'Commandes', icon: ShoppingBag },
  { to: '/vendeur/statistiques', label: 'Statistiques', icon: BarChart3 },
  { to: '/vendeur/publicite', label: 'Publicité MIA Ads', icon: Megaphone },
  { to: '/vendeur/parametres', label: 'Paramètres', icon: Settings },
];

export default function VendorLayout() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const { isSeller, loading: capabilitiesLoading } = useCapabilities();
  const { shop, loading: shopLoading } = useMyShop();

  if (authLoading || capabilitiesLoading) return <LoadingFallback />;

  if (!isAuthenticated) {
    return <Navigate to="/connexion" replace />;
  }

  if (!isSeller) {
    return <Navigate to="/vendeur/bienvenue" replace />;
  }

  if (shopLoading) return <LoadingFallback />;

  if (!shop) {
    return <Navigate to="/vendeur/bienvenue" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="hidden md:flex md:flex-col w-64 bg-white border-r border-gray-200 shrink-0">
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-mia-green-600 flex items-center justify-center text-white">
              <Store size={18} />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-gray-900 truncate">{shop.name}</p>
              <p className="text-xs text-gray-500">Espace vendeur MIA</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-mia-green-50 text-mia-green-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Score vendeur</span>
            <span className="font-semibold text-mia-green-700">{shop.sellerScore}/100</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-mia-green-500 rounded-full"
              style={{ width: `${shop.sellerScore}%` }}
            />
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <p className="font-bold text-gray-900">{shop.name}</p>
        </header>
        <main className="p-4 md:p-8 max-w-6xl mx-auto">
          <Outlet context={{ shop, userId: user?.id }} />
        </main>

        {/* Mobile bottom nav - vendors are often on their phone in the field */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex justify-around py-2 z-20">
          {NAV_ITEMS.slice(0, 4).map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] ${
                  isActive ? 'text-mia-green-700' : 'text-gray-500'
                }`
              }
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
