/**
 * MyOrdersPage
 *
 * Liste des commandes du client, une carte par commande (= par boutique,
 * cf. checkout multi-vendeurs). Statut visible en un coup d'œil, clic
 * vers le détail pour voir le code OTP à donner au livreur ou laisser un
 * avis une fois livrée.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Store, ChevronRight } from 'lucide-react';
import { listMyOrders } from '@/services/orders.service';

const STATUS_LABELS: Record<string, { labelKey: string; color: string }> = {
  pending: { labelKey: 'my_orders.status_pending', color: 'bg-gray-100 text-gray-700' },
  paid: { labelKey: 'my_orders.status_paid', color: 'bg-blue-100 text-blue-700' },
  shipped: { labelKey: 'my_orders.status_shipped', color: 'bg-amber-100 text-amber-700' },
  delivered: { labelKey: 'my_orders.status_delivered', color: 'bg-mia-green-100 text-mia-green-700' },
  cancelled: { labelKey: 'my_orders.status_cancelled', color: 'bg-red-100 text-red-700' },
  refunded: { labelKey: 'my_orders.status_refunded', color: 'bg-red-100 text-red-700' },
};

export default function MyOrdersPage() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMyOrders()
      .then(setOrders)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-mia-green-600" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">{t('my_orders.title')}</h1>

      {orders.length === 0 ? (
        <p className="text-center text-gray-500 py-16">{t('my_orders.empty')}</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const statusInfo = STATUS_LABELS[order.status];
            const statusLabel = statusInfo ? t(statusInfo.labelKey) : order.status;
            const statusColor = statusInfo?.color ?? 'bg-gray-100 text-gray-700';
            return (
              <Link
                key={order.id}
                to={`/mes-commandes/${order.id}`}
                className="block bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Store size={16} className="text-gray-400" />
                    <span className="font-semibold text-gray-900">{order.shops?.name}</span>
                  </div>
                  <ChevronRight size={18} className="text-gray-300" />
                </div>
                <p className="text-sm text-gray-500 mb-2">
                  {t('my_orders.items_count', { count: (order.order_items ?? []).length, total: order.total?.toLocaleString() })}
                </p>
                <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${statusColor}`}>
                  {statusLabel}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
