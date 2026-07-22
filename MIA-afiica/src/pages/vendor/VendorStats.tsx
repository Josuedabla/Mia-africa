import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { MyShop } from '@/hooks/useMyShop';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';

interface OutletCtx {
  shop: MyShop;
}

interface OrderDoc {
  total: number;
  status: string;
  created_at?: string;
}

function groupByDay(orders: OrderDoc[]) {
  const map = new Map<string, number>();
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  for (const order of orders) {
    if (!order.created_at) continue;
    const key = order.created_at.slice(0, 10);
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + order.total);
  }
  return Array.from(map.entries()).map(([date, total]) => ({
    date: date.slice(5), // MM-DD
    total,
  }));
}

export default function VendorStats() {
  const { shop } = useOutletContext<OutletCtx>();
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('orders')
      .select('total, status, created_at')
      .eq('shop_id', shop.id)
      .then(({ data }) => setOrders((data ?? []) as OrderDoc[]))
      .finally(() => setLoading(false));
  }, [shop.id]);

  const revenueByDay = useMemo(() => groupByDay(orders), [orders]);
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of orders) counts[o.status] = (counts[o.status] ?? 0) + 1;
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  }, [orders]);

  const totalRevenue = orders.reduce((sum, o) => sum + (o.total ?? 0), 0);
  const avgOrderValue = orders.length ? Math.round(totalRevenue / orders.length) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Statistiques</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-2xl font-bold text-gray-900">{totalRevenue.toLocaleString()}</p>
          <p className="text-sm text-gray-500">Revenu total (FCFA)</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
          <p className="text-sm text-gray-500">Commandes</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-2xl font-bold text-gray-900">{avgOrderValue.toLocaleString()}</p>
          <p className="text-sm text-gray-500">Panier moyen (FCFA)</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-2xl font-bold text-gray-900">{shop.seller_score}</p>
          <p className="text-sm text-gray-500">Score vendeur</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-gray-900 mb-4">Revenu (14 derniers jours)</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Chargement...</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => [`${value.toLocaleString()} FCFA`, 'Revenu']} />
              <Line type="monotone" dataKey="total" stroke="#16a34a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-gray-900 mb-4">Commandes par statut</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Chargement...</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusCounts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="status" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
