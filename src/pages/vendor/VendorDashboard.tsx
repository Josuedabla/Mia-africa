/**
 * Vendor dashboard overview - the page App.tsx already lazily imports at
 * /vendeur/dashboard (that import was broken before this change since the
 * file didn't exist yet).
 */
import React, { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import type { MyShop } from '@/hooks/useMyShop';
import { Package, ShoppingBag, TrendingUp, Star, Plus, Sparkles } from 'lucide-react';

interface OutletCtx {
  shop: MyShop;
  userId: string;
}

interface RecentOrder {
  id: string;
  total: number;
  status: string;
  created_at?: string;
}

const STATUS_LABEL_KEY: Record<string, string> = {
  pending: 'vendor_orders.status_pending',
  paid: 'vendor_orders.status_paid',
  shipped: 'vendor_orders.status_shipped',
  delivered: 'vendor_orders.status_delivered',
  cancelled: 'vendor_orders.status_cancelled',
};

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
  const { t } = useTranslation();
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(
      supabase
        .from('orders')
        .select('id, total, status, created_at')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
        .limit(5)
        .then(({ data }) => {
          if (!cancelled) setRecentOrders((data ?? []) as RecentOrder[]);
        })
    ).finally(() => !cancelled && setLoadingOrders(false));
    return () => {
      cancelled = true;
    };
  }, [shop.id]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('vendor_dashboard.greeting')}</h1>
          <p className="text-gray-500">{t('vendor_dashboard.subtitle', { shopName: shop.name })}</p>
        </div>
        <Link
          to="/vendeur/produits/nouveau"
          className="inline-flex items-center gap-2 bg-mia-green-600 hover:bg-mia-green-700 text-white font-semibold px-4 py-2.5 rounded-lg"
        >
          <Plus size={18} /> {t('vendor_dashboard.add_product')}
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Package} label={t('vendor_dashboard.kpi_products')} value={String(shop.product_count ?? 0)} accent="bg-blue-50 text-blue-600" />
        <KpiCard icon={ShoppingBag} label={t('vendor_dashboard.kpi_sales')} value={String(shop.total_sales ?? 0)} accent="bg-purple-50 text-purple-600" />
        <KpiCard icon={Star} label={t('vendor_dashboard.kpi_rating')} value={shop.rating ? shop.rating.toFixed(1) : '—'} accent="bg-amber-50 text-amber-600" />
        <KpiCard icon={TrendingUp} label={t('vendor_dashboard.kpi_score')} value={`${shop.seller_score}/100`} accent="bg-mia-green-50 text-mia-green-600" />
      </div>

      <div className="bg-gradient-to-r from-mia-green-600 to-mia-green-500 rounded-xl p-6 text-white flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Sparkles size={24} />
          <div>
            <p className="font-bold">{t('vendor_dashboard.ai_coach_title')}</p>
            <p className="text-sm text-white/90">
              {t('vendor_dashboard.ai_coach_description')}
            </p>
          </div>
        </div>
        <Link
          to="/vendeur/produits/nouveau"
          className="bg-white text-mia-green-700 font-semibold px-4 py-2 rounded-lg whitespace-nowrap"
        >
          {t('vendor_dashboard.ai_coach_cta')}
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">{t('vendor_dashboard.recent_orders')}</h2>
          <Link to="/vendeur/commandes" className="text-sm text-mia-green-700 font-medium">{t('vendor_dashboard.see_all')}</Link>
        </div>
        <div className="divide-y divide-gray-100">
          {loadingOrders && <p className="px-5 py-6 text-sm text-gray-400">{t('common.loading')}</p>}
          {!loadingOrders && recentOrders.length === 0 && (
            <p className="px-5 py-6 text-sm text-gray-400">{t('vendor_orders.empty')}</p>
          )}
          {recentOrders.map((order) => (
            <div key={order.id} className="px-5 py-3 flex items-center justify-between text-sm">
              <span className="text-gray-700">#{order.id.slice(0, 8)}</span>
              <span className="text-gray-500">{t(STATUS_LABEL_KEY[order.status] ?? 'vendor_orders.status_pending')}</span>
              <span className="font-semibold text-gray-900">{order.total?.toLocaleString()} FCFA</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
