/**
 * DriverDashboard
 *
 * "Les livreurs voient les produits. Si plusieurs produits chez le même
 * vendeur, prix de livraison identique. Si chez plusieurs vendeurs, le
 * livreur peut choisir de tout récupérer et livrer, ou choisir ceux
 * proches de lui." -> liste toutes les livraisons disponibles autour du
 * livreur (position GPS), groupées visuellement par checkout_group_id
 * (même client, plusieurs boutiques), avec case à cocher par livraison.
 * Le livreur choisit librement lesquelles rejoindre à sa tournée -
 * "tout récupérer" n'est qu'un raccourci qui coche tout le groupe d'un
 * clic, jamais un mode imposé.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, MapPin, Package, CheckCircle2 } from 'lucide-react';
import {
  listAvailableDeliveries,
  groupByCheckoutGroup,
  claimDeliveries,
  type AvailableDelivery,
} from '@/services/delivery.service';

export default function DriverDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [deliveries, setDeliveries] = useState<AvailableDelivery[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError(t('driver_dashboard.geolocation_error'))
    );
  }, [t]);

  const load = useCallback(async () => {
    if (!position) return;
    setLoading(true);
    try {
      const data = await listAvailableDeliveries(position.lat, position.lng);
      setDeliveries(data);
    } catch (err) {
      console.error('Error loading deliveries:', err);
      setError(t('driver_dashboard.load_error'));
    } finally {
      setLoading(false);
    }
  }, [position]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = groupByCheckoutGroup(deliveries);

  const toggleOne = (deliveryId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(deliveryId)) next.delete(deliveryId);
      else next.add(deliveryId);
      return next;
    });
  };

  const toggleGroup = (groupDeliveries: AvailableDelivery[]) => {
    const ids = groupDeliveries.map((d) => d.delivery_id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const handleClaim = async () => {
    if (selected.size === 0) return;
    setClaiming(true);
    try {
      const claimedIds = Array.from(selected);
      await claimDeliveries(claimedIds);
      // Redirige directement vers le suivi de la première livraison prise -
      // le livreur n'a pas besoin de revenir chercher où il en est.
      navigate(`/livreur/livraison/${claimedIds[0]}`);
    } catch (err) {
      console.error('Error claiming deliveries:', err);
      setError(t('driver_dashboard.claim_conflict_error'));
      setSelected(new Set());
      await load();
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white shadow-sm sticky top-0 z-20 px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">{t('driver_dashboard.title')}</h1>
        <p className="text-sm text-gray-500">{t('driver_dashboard.subtitle')}</p>
      </div>

      {error && <div className="mx-4 mt-4 p-3 bg-amber-50 text-amber-800 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-mia-green-600" size={32} />
        </div>
      ) : deliveries.length === 0 ? (
        <div className="text-center py-16 text-gray-500">{t('driver_dashboard.empty')}</div>
      ) : (
        <div className="px-4 py-4 space-y-6">
          {[...groups.entries()].map(([groupId, groupDeliveries]: [string | null, AvailableDelivery[]]) => {
            const allSelected = groupDeliveries.every((d) => selected.has(d.delivery_id));
            return (
              <div key={groupId ?? 'no-group'} className="bg-white rounded-xl shadow-sm overflow-hidden">
                {groupDeliveries.length > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <span className="text-sm font-medium text-gray-700">
                      {t('driver_dashboard.group_count', { count: groupDeliveries.length })}
                    </span>
                    <button
                      onClick={() => toggleGroup(groupDeliveries)}
                      className="text-sm font-semibold text-mia-green-600 hover:text-mia-green-700"
                    >
                      {allSelected ? t('driver_dashboard.deselect_all') : t('driver_dashboard.claim_all')}
                    </button>
                  </div>
                )}

                {groupDeliveries.map((d) => (
                  <button
                    key={d.delivery_id}
                    onClick={() => toggleOne(d.delivery_id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0 text-left transition-colors ${
                      selected.has(d.delivery_id) ? 'bg-mia-green-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div
                      className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        selected.has(d.delivery_id) ? 'bg-mia-green-600 border-mia-green-600' : 'border-gray-300'
                      }`}
                    >
                      {selected.has(d.delivery_id) && <CheckCircle2 size={16} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{d.shop_name}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Package size={12} /> {t('driver_dashboard.item_count', { count: d.item_count })}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin size={12} /> {d.distance_km.toFixed(1)} km
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-mia-green-600">{d.delivery_fee.toLocaleString()} FCFA</p>
                      <p className="text-xs text-gray-400">{t('driver_dashboard.delivery_fee_label')}</p>
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 p-4 shadow-lg">
          <button
            onClick={handleClaim}
            disabled={claiming}
            className="w-full bg-mia-green-600 hover:bg-mia-green-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
          >
            {claiming ? <Loader2 className="animate-spin" size={20} /> : null}
            {t('driver_dashboard.claim_button', { count: selected.size })}
          </button>
        </div>
      )}
    </div>
  );
}
