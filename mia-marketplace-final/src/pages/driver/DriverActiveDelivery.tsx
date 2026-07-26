/**
 * DriverActiveDelivery
 *
 * Écran de suivi d'une livraison prise en charge : le livreur marque
 * "récupéré chez le vendeur" (simple jalon), puis à l'arrivée chez le
 * client, saisit le code OTP donné en main propre pour confirmer la
 * remise. Cette saisie est la SEULE façon de passer en "livré" - elle
 * déclenche aussi le règlement du paiement si c'était du cash à la
 * livraison (voir confirm_delivery, migration 20260719000015).
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Package, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { markPickedUp, confirmDelivery, markDeliveryFailed } from '@/services/delivery.service';

interface DeliveryDetail {
  id: string;
  status: string;
  order_id: string;
  orders: { shops: { name: string }; total: number };
}

export default function DriverActiveDelivery() {
  const { deliveryId } = useParams<{ deliveryId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!deliveryId) return;
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('deliveries')
      .select('id, status, order_id, orders(shops(name), total)')
      .eq('id', deliveryId)
      .single();
    if (fetchError) setError(t('driver_delivery.load_error'));
    else setDelivery(data as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [deliveryId]);

  const handlePickedUp = async () => {
    if (!deliveryId) return;
    setActionLoading(true);
    try {
      await markPickedUp(deliveryId);
      await load();
    } catch (err) {
      setError(t('driver_delivery.pickup_error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!deliveryId || otpInput.length !== 4) return;
    setActionLoading(true);
    setError(null);
    try {
      await confirmDelivery(deliveryId, otpInput);
      navigate('/livreur/tournee');
    } catch (err: any) {
      setError(err?.message?.includes('INVALID_OTP') ? t('driver_delivery.invalid_otp') : t('driver_delivery.confirm_error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleFailed = async () => {
    if (!deliveryId) return;
    if (!confirm(t('driver_delivery.confirm_failed_prompt'))) return;
    setActionLoading(true);
    try {
      await markDeliveryFailed(deliveryId);
      navigate('/livreur/tournee');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-mia-green-600" size={32} />
      </div>
    );
  }

  if (!delivery) {
    return <div className="text-center py-16 text-gray-500">{t('driver_delivery.not_found')}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">{delivery.orders?.shops?.name}</h1>
      <p className="text-sm text-gray-500 mb-6">{delivery.orders?.total?.toLocaleString()} XOF</p>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm mb-4">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {delivery.status === 'assigned' && (
        <div className="bg-white rounded-xl shadow-sm p-5 text-center">
          <Package className="mx-auto text-gray-400 mb-3" size={40} />
          <p className="text-gray-700 mb-4">{t('driver_delivery.pickup_instruction')}</p>
          <button
            onClick={handlePickedUp}
            disabled={actionLoading}
            className="w-full bg-mia-green-600 hover:bg-mia-green-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg"
          >
            {actionLoading ? <Loader2 className="animate-spin mx-auto" size={20} /> : t('driver_delivery.picked_up_button')}
          </button>
        </div>
      )}

      {delivery.status === 'picked_up' && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-gray-700 mb-3 text-center">
            {t('driver_delivery.otp_instruction')}
          </p>
          <input
            value={otpInput}
            onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="0000"
            inputMode="numeric"
            className="w-full text-center text-3xl tracking-[0.5em] border border-gray-300 rounded-lg py-3 mb-4 outline-none focus:ring-2 focus:ring-mia-green-500"
          />
          <button
            onClick={handleConfirmDelivery}
            disabled={actionLoading || otpInput.length !== 4}
            className="w-full bg-mia-green-600 hover:bg-mia-green-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 mb-2"
          >
            {actionLoading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
            {t('driver_delivery.confirm_button')}
          </button>
          <button onClick={handleFailed} className="w-full text-sm text-red-600 py-2">
            {t('driver_delivery.report_problem')}
          </button>
        </div>
      )}

      {delivery.status === 'delivered' && (
        <div className="bg-white rounded-xl shadow-sm p-5 text-center">
          <CheckCircle2 className="mx-auto text-mia-green-600 mb-3" size={40} />
          <p className="text-gray-700 font-semibold">{t('driver_delivery.delivered_confirmation')}</p>
        </div>
      )}
    </div>
  );
}
