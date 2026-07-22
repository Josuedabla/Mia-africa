/**
 * CheckoutGroupPage
 *
 * Récapitulatif après un checkout multi-vendeurs : affiche une carte par
 * commande créée (= par boutique), avec son propre total et statut,
 * puisque chaque boutique traite sa commande indépendamment ("chaque
 * vendeur reçoit seulement ce qui est commandé chez lui").
 */
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, Store, CheckCircle2 } from 'lucide-react';
import { getCheckoutGroupOrders } from '@/services/checkout.service';

export default function CheckoutGroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;
    getCheckoutGroupOrders(groupId)
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [groupId]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-mia-green-600" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto">
      <div className="text-center mb-6">
        <CheckCircle2 className="mx-auto text-mia-green-600 mb-2" size={48} />
        <h1 className="text-xl font-bold text-gray-900">Commande confirmée</h1>
        <p className="text-sm text-gray-500">
          {orders.length > 1
            ? `${orders.length} commandes créées, une par boutique.`
            : 'Votre commande a bien été enregistrée.'}
        </p>
      </div>

      <div className="space-y-3">
        {orders.map((order) => (
          <div key={order.id} className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <Store size={16} className="text-gray-400" />
              <span className="font-semibold text-gray-900">{order.shops?.name}</span>
            </div>
            <div className="space-y-1 text-sm text-gray-600 mb-2">
              {(order.order_items ?? []).map((item: any) => (
                <div key={item.id} className="flex justify-between">
                  <span>
                    {item.quantity} × {item.products?.name}
                  </span>
                  <span>{item.subtotal?.toLocaleString()} XOF</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100">
              <span>Total</span>
              <span>{order.total?.toLocaleString()} XOF</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Statut : {order.status}</p>
          </div>
        ))}
      </div>

      <Link
        to="/"
        className="block w-full text-center mt-6 bg-mia-green-600 hover:bg-mia-green-700 text-white font-bold py-3 rounded-lg"
      >
        Continuer mes achats
      </Link>
    </div>
  );
}
