import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { updateOrderStatus } from '@/services/db.service';
import type { MyShop } from '@/hooks/useMyShop';
import CoinDebitSummary from '@/components/CoinDebitSummary';

interface OutletCtx {
  shop: MyShop;
}

interface VendorOrder {
  id: string;
  customer_id: string;
  total: number;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  created_at?: string;
}

const STATUS_LABEL_KEY: Record<string, string> = {
  pending: 'vendor_orders.status_pending',
  paid: 'vendor_orders.status_paid',
  shipped: 'vendor_orders.status_shipped',
  delivered: 'vendor_orders.status_delivered',
  cancelled: 'vendor_orders.status_cancelled',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  paid: 'bg-blue-100 text-blue-700',
  shipped: 'bg-amber-100 text-amber-700',
  delivered: 'bg-mia-green-100 text-mia-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

// A vendor can only move an order forward along this path - never back to
// "paid"/"pending" and never straight to "delivered" without shipping.
const NEXT_STATUS: Record<string, VendorOrder['status'] | null> = {
  pending: null, // waiting on Chariow webhook, vendor can't force this
  paid: 'shipped',
  shipped: 'delivered',
  delivered: null,
  cancelled: null,
};

export default function VendorOrders() {
  const { shop } = useOutletContext<OutletCtx>();
  const { t } = useTranslation();
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadOrders = () => {
    setLoading(true);
    Promise.resolve(
      supabase
        .from('orders')
        .select('*')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => setOrders((data ?? []) as VendorOrder[]))
    ).finally(() => setLoading(false));
  };

  useEffect(loadOrders, [shop.id]);

  const advanceStatus = async (order: VendorOrder) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setUpdatingId(order.id);
    try {
      await updateOrderStatus(order.id, next);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('vendor_orders.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading && <p className="px-5 py-6 text-sm text-gray-400">{t('common.loading')}</p>}
          {!loading && orders.length === 0 && (
            <p className="px-5 py-6 text-sm text-gray-400">{t('vendor_orders.empty')}</p>
          )}
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-5 py-3 text-gray-700">#{order.id.slice(0, 8)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLOR[order.status]}`}>
                      {t(STATUS_LABEL_KEY[order.status])}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-semibold text-gray-900">{order.total?.toLocaleString()} FCFA</td>
                  <td className="px-5 py-3 text-right">
                    {NEXT_STATUS[order.status] && (
                      <button
                        onClick={() => advanceStatus(order)}
                        disabled={updatingId === order.id}
                        className="text-xs font-semibold text-mia-green-700 border border-mia-green-200 rounded-full px-3 py-1.5 disabled:opacity-50"
                      >
                        {t('vendor_orders.mark_as', { status: t(STATUS_LABEL_KEY[NEXT_STATUS[order.status]!]).toLowerCase() })}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="lg:col-span-1">
          <CoinDebitSummary />
        </div>
      </div>
    </div>
  );
}
