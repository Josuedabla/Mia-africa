/**
 * Vendor dashboard overview - the page App.tsx already lazily imports at
 * /vendeur/dashboard (that import was broken before this change since the
 * file didn't exist yet).
 */
import React, { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit as fbLimit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { VendorShop } from '@/hooks/useVendorShop';
import { Package, ShoppingBag, TrendingUp, Star, Plus, Sparkles } from 'lucide-react';

interface OutletCtx {
  shop: VendorShop;
  userId: string;
}

interface RecentOrder {
  id: string;
  total: number;
  status: string;
  createdAt?: { toDate: () => Date };
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${accent}`}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}

export default function VendorDashboard() {
  const { shop } = useOutletContext<OutletCtx>();
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const q = query(
      collection(db, 'orders'),
      where('shopId', '==', shop.id),
      orderBy('createdAt', 'desc'),
      fbLimit(5)
    );
    getDocs(q)
      .then((snap) => {
        if (cancelled) return;
        setRecentOrders(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      })
      .catch(() => {
        // Composite index on (shopId, createdAt) may not exist yet in a
        // freshly deployed project - fail soft rather than crash the page.
      })
      .finally(() => !cancelled && setLoadingOrders(false));
    return () => {
      cancelled = true;
    };
  }, [shop.id]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bonjour 👋</h1>
          <p className="text-gray-500">Voici comment se porte {shop.name} aujourd'hui.</p>
        </div>
        <Link
          to="/vendeur/produits/nouveau"
          className="inline-flex items-center gap-2 bg-mia-green-600 hover:bg-mia-green-700 text-white font-semibold px-4 py-2.5 rounded-lg"
        >
          <Plus size={18} /> Ajouter un produit
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Package} label="Produits en ligne" value={String(shop.productCount ?? 0)} accent="bg-blue-50 text-blue-600" />
        <KpiCard icon={ShoppingBag} label="Ventes totales" value={String(shop.totalSales ?? 0)} accent="bg-purple-50 text-purple-600" />
        <KpiCard icon={Star} label="Note boutique" value={shop.rating ? shop.rating.toFixed(1) : '—'} accent="bg-amber-50 text-amber-600" />
        <KpiCard icon={TrendingUp} label="Score vendeur" value={`${shop.sellerScore}/100`} accent="bg-mia-green-50 text-mia-green-600" />
      </div>

      <div className="bg-gradient-to-r from-mia-green-600 to-mia-green-500 rounded-xl p-6 text-white flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Sparkles size={24} />
          <div>
            <p className="font-bold">MIA AI Coach</p>
            <p className="text-sm text-white/90">
              Générez des fiches produits professionnelles en quelques secondes avec l'assistant IA.
            </p>
          </div>
        </div>
        <Link
          to="/vendeur/produits/nouveau"
          className="bg-white text-mia-green-700 font-semibold px-4 py-2 rounded-lg whitespace-nowrap"
        >
          Essayer maintenant
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Commandes récentes</h2>
          <Link to="/vendeur/commandes" className="text-sm text-mia-green-700 font-medium">Tout voir</Link>
        </div>
        <div className="divide-y divide-gray-100">
          {loadingOrders && <p className="px-5 py-6 text-sm text-gray-400">Chargement...</p>}
          {!loadingOrders && recentOrders.length === 0 && (
            <p className="px-5 py-6 text-sm text-gray-400">Aucune commande pour le moment.</p>
          )}
          {recentOrders.map((order) => (
            <div key={order.id} className="px-5 py-3 flex items-center justify-between text-sm">
              <span className="text-gray-700">#{order.id.slice(0, 8)}</span>
              <span className="capitalize text-gray-500">{order.status}</span>
              <span className="font-semibold text-gray-900">{order.total?.toLocaleString()} FCFA</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
