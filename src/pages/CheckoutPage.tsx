/**
 * CheckoutPage
 *
 * Étape entre le panier et le paiement : demande l'adresse de livraison
 * (+ position GPS si autorisée) et les modalités de paiement (produit
 * avant/après réception, livraison payée avant/après), puis appelle
 * cart.checkout() qui scinde automatiquement en une commande par
 * boutique côté serveur. Redirige ensuite vers le récapitulatif de la
 * commande groupée (une carte par boutique/commande créée).
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, MapPin } from 'lucide-react';
import { useCart } from '@/hooks/useCart';

export default function CheckoutPage() {
  const { t } = useTranslation();
  const cart = useCart();
  const navigate = useNavigate();
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [productPaymentTiming, setProductPaymentTiming] = useState<'before' | 'after'>('before');
  const [deliveryPaymentTiming, setDeliveryPaymentTiming] = useState<'before' | 'after'>('after');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectPosition = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError(t('checkout.geolocation_error'))
    );
  };

  const handleSubmit = async () => {
    if (!address.trim()) {
      setError(t('checkout.address_required_error'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await cart.checkout({
        deliveryAddress: address,
        deliveryLat: coords?.lat,
        deliveryLng: coords?.lng,
        productPaymentTiming,
        deliveryPaymentTiming,
      });
      navigate(`/commande/groupe/${result.checkout_group_id}`);
    } catch (err: any) {
      setError(err?.message ?? t('checkout.order_failed_error'));
    } finally {
      setLoading(false);
    }
  };

  const shopCount = new Set(cart.items.map((i) => i.shopId)).size;

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">{t('checkout.title')}</h1>
      {shopCount > 1 && (
        <p className="text-sm text-gray-500 mb-6">
          {t('checkout.multi_shop_notice', { count: shopCount })}
        </p>
      )}

      <div className="bg-white rounded-xl shadow-sm p-4 space-y-4 mb-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">{t('checkout.delivery_address')}</span>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
            className="mt-1 w-full border border-gray-300 rounded-lg p-2 text-sm"
            placeholder={t('checkout.address_placeholder') as string}
          />
        </label>

        <button
          onClick={detectPosition}
          className="flex items-center gap-2 text-sm font-medium text-mia-green-600 hover:text-mia-green-700"
        >
          <MapPin size={16} />
          {coords ? t('checkout.position_detected') : t('checkout.use_current_position')}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 space-y-4 mb-4">
        <div>
          <span className="text-sm font-medium text-gray-700 block mb-2">{t('checkout.product_payment_label')}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setProductPaymentTiming('before')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                productPaymentTiming === 'before' ? 'bg-mia-green-600 text-white border-mia-green-600' : 'border-gray-300'
              }`}
            >
              {t('checkout.pay_now')}
            </button>
            <button
              onClick={() => setProductPaymentTiming('after')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                productPaymentTiming === 'after' ? 'bg-mia-green-600 text-white border-mia-green-600' : 'border-gray-300'
              }`}
            >
              {t('checkout.pay_on_delivery')}
            </button>
          </div>
        </div>

        <div>
          <span className="text-sm font-medium text-gray-700 block mb-2">{t('checkout.delivery_payment_label')}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setDeliveryPaymentTiming('before')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                deliveryPaymentTiming === 'before' ? 'bg-mia-green-600 text-white border-mia-green-600' : 'border-gray-300'
              }`}
            >
              {t('checkout.pay_now')}
            </button>
            <button
              onClick={() => setDeliveryPaymentTiming('after')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                deliveryPaymentTiming === 'after' ? 'bg-mia-green-600 text-white border-mia-green-600' : 'border-gray-300'
              }`}
            >
              {t('checkout.pay_driver')}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm mb-4">{error}</div>}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full bg-mia-green-600 hover:bg-mia-green-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="animate-spin" size={20} /> : null}
        {t('checkout.confirm_button', { amount: cart.totalAmount.toLocaleString() })}
      </button>
    </div>
  );
}
