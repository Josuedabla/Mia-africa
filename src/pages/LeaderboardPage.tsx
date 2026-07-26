/**
 * LeaderboardPage
 *
 * "Créer une compétition positive : Top vendeurs de la semaine et top
 * vendeurs par moi." 4 onglets de classement (commandes, satisfaction,
 * popularité, progression) + un onglet personnel des boutiques que
 * l'utilisateur commande le plus. Le classement se réinitialise chaque
 * semaine (voir migration 20260720000024) - un badge diamant/or/argent/
 * bronze selon le rang, jamais figé.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Trophy, Heart, TrendingUp, ShoppingBag, Star, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  getWeeklyLeaderboard,
  getMyTopShops,
  type LeaderboardEntry,
  type MyTopShop,
  type LeaderboardCriterion,
} from '@/services/leaderboard.service';

const CRITERIA: { key: LeaderboardCriterion; icon: React.ReactNode; labelKey: string }[] = [
  { key: 'orders', icon: <ShoppingBag size={16} />, labelKey: 'leaderboard.criterion_orders' },
  { key: 'satisfaction', icon: <Star size={16} />, labelKey: 'leaderboard.criterion_satisfaction' },
  { key: 'popularity', icon: <TrendingUp size={16} />, labelKey: 'leaderboard.criterion_popularity' },
  { key: 'progression', icon: <Sparkles size={16} />, labelKey: 'leaderboard.criterion_progression' },
];

function rankBadge(rank: number): string {
  if (rank === 1) return '💎';
  if (rank <= 3) return '🥇';
  if (rank <= 10) return '🥈';
  if (rank <= 20) return '🥉';
  return `#${rank}`;
}

export default function LeaderboardPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [view, setView] = useState<'weekly' | 'mine'>('weekly');
  const [criterion, setCriterion] = useState<LeaderboardCriterion>('orders');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myShops, setMyShops] = useState<MyTopShop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (view === 'weekly') {
      getWeeklyLeaderboard(criterion)
        .then(setEntries)
        .finally(() => setLoading(false));
    } else {
      getMyTopShops()
        .then(setMyShops)
        .finally(() => setLoading(false));
    }
  }, [view, criterion]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-16">
      <div className="flex items-center gap-2 mb-1">
        <Trophy className="text-amber-500" size={24} />
        <h1 className="text-xl font-bold text-gray-900">{t('leaderboard.title')}</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">{t('leaderboard.subtitle')}</p>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4">
        <button
          onClick={() => setView('weekly')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-semibold ${
            view === 'weekly' ? 'bg-white text-mia-green-700 shadow-sm' : 'text-gray-500'
          }`}
        >
          <Trophy size={15} /> {t('leaderboard.weekly_top')}
        </button>
        {isAuthenticated && (
          <button
            onClick={() => setView('mine')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-semibold ${
              view === 'mine' ? 'bg-white text-mia-green-700 shadow-sm' : 'text-gray-500'
            }`}
          >
            <Heart size={15} /> {t('leaderboard.my_top')}
          </button>
        )}
      </div>

      {view === 'weekly' && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
            {CRITERIA.map((c) => (
              <button
                key={c.key}
                onClick={() => setCriterion(c.key)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  criterion === c.key ? 'bg-mia-green-600 text-white border-mia-green-600' : 'border-gray-300 text-gray-600'
                }`}
              >
                {c.icon} {t(c.labelKey)}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-center text-sm text-gray-400 py-10">{t('common.loading')}</p>
          ) : entries.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">{t('leaderboard.weekly_empty')}</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100">
              {entries.map((entry) => (
                <Link
                  key={entry.shop_id}
                  to={`/boutique/${entry.shop_slug}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
                >
                  <span className="text-xl w-8 text-center shrink-0">{rankBadge(entry.rank)}</span>
                  {entry.shop_logo_url ? (
                    <img src={entry.shop_logo_url} alt={entry.shop_name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-mia-green-100 text-mia-green-700 flex items-center justify-center font-bold">
                      {entry.shop_name?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{entry.shop_name}</p>
                  </div>
                  <span className="text-sm font-bold text-mia-green-600 shrink-0">
                    {criterion === 'satisfaction' ? entry.score.toFixed(1) : Math.round(entry.score)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {view === 'mine' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {loading ? (
            <p className="text-center text-sm text-gray-400 py-10">{t('common.loading')}</p>
          ) : myShops.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">{t('leaderboard.mine_empty')}</p>
          ) : (
            myShops.map((shop, i) => (
              <Link key={shop.shop_id} to={`/boutique/${shop.shop_slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                <span className="text-lg w-8 text-center shrink-0 text-gray-400 font-bold">#{i + 1}</span>
                {shop.shop_logo_url ? (
                  <img src={shop.shop_logo_url} alt={shop.shop_name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-mia-green-100 text-mia-green-700 flex items-center justify-center font-bold">
                    {shop.shop_name?.[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{shop.shop_name}</p>
                </div>
                <span className="text-sm font-bold text-mia-green-600 shrink-0">
                  {t('leaderboard.orders_count', { count: shop.my_orders_count })}
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
