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
import { Loader2, Store, ChevronRight } from 'lucide-react';
import { listMyOrders } from '@/services/orders.service';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente de paiement', color: 'bg-gray-100 text-gray-700' },
  paid: { label: 'Payée, en préparation', color: 'bg-blue-100 text-blue-700' },
  shipped: { label: 'En cours de livraison', color: 'bg-amber-100 text-amber-700' },
  delivered: { label: 'Livrée', color: 'bg-mia-green-100 text-mia-green-700' },
  cancelled: { label: 'Annulée', color: 'bg-red-100 text-red-700' },
  refunded: { label: 'Remboursée', color: 'bg-red-100 text-red-700' },
};

export default function MyOrdersPage() {
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
      <h1 className="text-xl font-bold text-gray-900 mb-6">Mes commandes</h1>

      {orders.length === 0 ? (
        <p className="text-center text-gray-500 py-16">Vous n'avez pas encore passé de commande.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const statusInfo = STATUS_LABELS[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-700' };
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
                  {(order.order_items ?? []).length} article(s) · {order.total?.toLocaleString()} XOF
                </p>
                <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
