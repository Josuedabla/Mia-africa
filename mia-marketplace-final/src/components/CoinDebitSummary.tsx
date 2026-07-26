/**
 * Ticket 5 (chantier nouveau modèle pièces) : transparence obligatoire sur
 * les pièces prélevées automatiquement à chaque commande. Affiché à côté
 * de la liste des commandes dans VendorOrders.tsx (demande explicite du
 * fondateur), pas sur une page séparée.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCoinDebitSummary, COIN_TO_FCFA } from '@/services/coins.service';
import type { CoinDebitGranularity, CoinDebitSummaryRow } from '@/services/coins.service';

function formatPeriod(period: string, granularity: CoinDebitGranularity, locale: string, t: (key: string, opts?: any) => string): string {
  const d = new Date(period);
  if (granularity === 'month') {
    return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  }
  if (granularity === 'week') {
    return t('coin_debit_summary.week_of', { date: d.toLocaleDateString(locale, { day: '2-digit', month: 'short' }) });
  }
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CoinDebitSummary() {
  const { t, i18n } = useTranslation();
  const [granularity, setGranularity] = useState<CoinDebitGranularity>('day');
  const [rows, setRows] = useState<CoinDebitSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const GRANULARITY_LABEL: Record<CoinDebitGranularity, string> = {
    day: t('coin_debit_summary.granularity_day'),
    week: t('coin_debit_summary.granularity_week'),
    month: t('coin_debit_summary.granularity_month'),
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCoinDebitSummary(granularity)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [granularity]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4 h-fit">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-gray-900">{t('coin_debit_summary.title')}</h2>
        <select
          value={granularity}
          onChange={(e) => setGranularity(e.target.value as CoinDebitGranularity)}
          className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-mia-green-500 outline-none"
        >
          {(Object.keys(GRANULARITY_LABEL) as CoinDebitGranularity[]).map((g) => (
            <option key={g} value={g}>
              {GRANULARITY_LABEL[g]}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-gray-400">{t('coin_debit_summary.loading')}</p>}
      {!loading && rows.length === 0 && (
        <p className="text-sm text-gray-400">{t('coin_debit_summary.empty')}</p>
      )}

      {!loading && rows.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {rows.map((row) => (
            <div
              key={row.period}
              className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0"
            >
              <span className="text-gray-600 capitalize">{formatPeriod(row.period, granularity, i18n.language, t)}</span>
              <div className="text-right">
                <div className="font-semibold text-gray-900">
                  {t('coin_debit_summary.coins_debited', { count: row.coins_debited })}
                </div>
                <div className="text-xs text-gray-400">
                  {t('coin_debit_summary.orders_count', { count: row.orders_count })} · ~
                  {(row.coins_debited * COIN_TO_FCFA).toLocaleString()} FCFA
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
