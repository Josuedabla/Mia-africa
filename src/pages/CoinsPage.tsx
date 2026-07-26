/**
 * CoinsPage
 *
 * Remplace WalletPage.tsx (obsolète depuis le modèle Money-In Only,
 * migration 20260720000019). Plus de solde en argent réel, plus de
 * recharge/transfert/retrait - uniquement le solde de pièces MIA, son
 * historique, l'achat de packs (seul flux financier réel restant), et
 * les gains gratuits (connexion quotidienne, tâches, publicité).
 */
import React, { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useWallet } from '@/hooks/useCoins';
import { useCoinTransactions } from '@/hooks/useCoinTransactions';
import {
  initiateCoinPurchase,
  claimDailyLoginReward,
  listRewardTasks,
  claimRewardTask,
  type RewardTask,
} from '@/services/coins.service';
import { Coins, Loader2, Users, ArrowDownCircle, ArrowUpCircle, Gift, CheckCircle2, PlayCircle } from 'lucide-react';

type Tab = 'apercu' | 'acheter' | 'gagner';

const COIN_PACKS = [25, 100, 250, 500, 1000, 2500];
const COIN_RATE_FCFA = 12;

export default function CoinsPage() {
  const { t } = useTranslation();
  const TX_LABEL: Record<string, string> = {
    credit: t('coins_page.tx_credit'),
    debit: t('coins_page.tx_debit'),
  };
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { coins, loading } = useWallet();
  const { transactions } = useCoinTransactions();
  const [tab, setTab] = useState<Tab>('apercu');

  const [selectedPack, setSelectedPack] = useState(COIN_PACKS[1]);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyClaimedToday, setDailyClaimedToday] = useState(false);

  const [tasks, setTasks] = useState<RewardTask[]>([]);
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    listRewardTasks().then(setTasks).catch(() => setTasks([]));
  }, []);

  if (authLoading) return null;
  if (!isAuthenticated) return <Navigate to="/connexion" replace />;

  const handlePurchase = async () => {
    setPurchaseLoading(true);
    setMessage(null);
    try {
      const { checkoutUrl } = await initiateCoinPurchase(selectedPack, `${window.location.origin}/pieces`);
      window.location.href = checkoutUrl;
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message ?? t('coins_page.buy_error') });
    } finally {
      setPurchaseLoading(false);
    }
  };

  const handleDailyClaim = async () => {
    setDailyLoading(true);
    setMessage(null);
    try {
      const gained = await claimDailyLoginReward();
      setDailyClaimedToday(true);
      setMessage({ type: 'success', text: t('coins_page.daily_claim_success', { count: gained }) });
    } catch (err: any) {
      if (err.message?.includes('ALREADY_CLAIMED_TODAY')) {
        setDailyClaimedToday(true);
        setMessage({ type: 'error', text: t('coins_page.daily_already_claimed') });
      } else {
        setMessage({ type: 'error', text: err.message ?? t('coins_page.generic_error') });
      }
    } finally {
      setDailyLoading(false);
    }
  };

  const handleClaimTask = async (task: RewardTask) => {
    setClaimingTaskId(task.id);
    setMessage(null);
    try {
      const gained = await claimRewardTask(task.id);
      setMessage({ type: 'success', text: t('coins_page.task_claim_success', { count: gained, title: task.title }) });
    } catch (err: any) {
      const text = err.message?.includes('ALREADY_CLAIMED')
        ? t('coins_page.task_already_claimed')
        : err.message?.includes('COOLDOWN_ACTIVE')
        ? t('coins_page.task_cooldown')
        : (err.message ?? t('coins_page.generic_error'));
      setMessage({ type: 'error', text });
    } finally {
      setClaimingTaskId(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-16">
      <div className="bg-gradient-to-br from-mia-green-600 to-mia-green-500 rounded-2xl p-6 text-white mb-6">
        <div className="flex items-center gap-2 mb-4 text-white/90">
          <Coins size={20} />
          <span className="font-medium">{t('coins_page.balance_label')}</span>
        </div>
        <p className="text-4xl font-extrabold">{loading ? '...' : `${(coins ?? 0).toLocaleString()} 🪙`}</p>
        <p className="text-xs text-white/70 mt-2">{t('coins_page.balance_disclaimer')}</p>
        <div className="flex gap-2 mt-5">
          <Link to="/parrainage" className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-sm font-semibold px-3 py-2 rounded-lg">
            <Users size={16} /> {t('coins_page.referral_link')}
          </Link>
        </div>
      </div>

      {message && (
        <div className={`mb-4 text-sm rounded-lg px-4 py-3 ${message.type === 'success' ? 'bg-mia-green-50 text-mia-green-700 border border-mia-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
        {([
          ['apercu', t('coins_page.tab_history')],
          ['acheter', t('coins_page.tab_buy')],
          ['gagner', t('coins_page.tab_earn')],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 whitespace-nowrap px-3 py-2 rounded-md text-sm font-semibold ${
              tab === key ? 'bg-white text-mia-green-700 shadow-sm' : 'text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'apercu' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {transactions.length === 0 && <p className="px-5 py-8 text-center text-sm text-gray-400">{t('coins_page.no_transactions')}</p>}
          {transactions.map((tx) => {
            const isCredit = tx.type === 'credit';
            return (
              <div key={tx.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isCredit ? (
                    <ArrowDownCircle className="text-mia-green-500" size={20} />
                  ) : (
                    <ArrowUpCircle className="text-red-400" size={20} />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{TX_LABEL[tx.type] ?? tx.type}</p>
                    <p className="text-xs text-gray-400 line-clamp-1">{tx.description}</p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${isCredit ? 'text-mia-green-600' : 'text-red-500'}`}>
                  {isCredit ? '+' : '-'}
                  {tx.amount.toLocaleString()} 🪙
                </span>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'acheter' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 text-gray-900 font-bold">
            <Coins size={18} /> {t('coins_page.buy_title')}
          </div>
          <p className="text-sm text-gray-500">{t('coins_page.buy_description')}</p>
          <div className="grid grid-cols-3 gap-2">
            {COIN_PACKS.map((amt) => (
              <button
                key={amt}
                onClick={() => setSelectedPack(amt)}
                className={`py-3 rounded-lg border text-sm font-semibold flex flex-col items-center ${
                  selectedPack === amt ? 'border-mia-green-600 bg-mia-green-50 text-mia-green-700' : 'border-gray-200 text-gray-600'
                }`}
              >
                <span>{amt.toLocaleString()} 🪙</span>
                <span className="text-[11px] text-gray-400 font-normal">{(amt * COIN_RATE_FCFA).toLocaleString()} FCFA</span>
              </button>
            ))}
          </div>
          <button
            onClick={handlePurchase}
            disabled={purchaseLoading}
            className="w-full bg-mia-green-600 hover:bg-mia-green-700 disabled:opacity-60 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
          >
            {purchaseLoading && <Loader2 size={18} className="animate-spin" />}
            {t('coins_page.buy_button', {
              amount: selectedPack.toLocaleString(),
              price: (selectedPack * COIN_RATE_FCFA).toLocaleString(),
            })}
          </button>
          <p className="text-xs text-gray-400">{t('coins_page.buy_secure_payment')}</p>
        </div>
      )}

      {tab === 'gagner' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 text-gray-900 font-bold mb-2">
              <Gift size={18} /> {t('coins_page.daily_title')}
            </div>
            <p className="text-sm text-gray-500 mb-3">{t('coins_page.daily_description')}</p>
            <button
              onClick={handleDailyClaim}
              disabled={dailyLoading || dailyClaimedToday}
              className="w-full bg-mia-green-600 hover:bg-mia-green-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm"
            >
              {dailyLoading ? <Loader2 size={16} className="animate-spin" /> : dailyClaimedToday ? <CheckCircle2 size={16} /> : null}
              {dailyClaimedToday ? t('coins_page.daily_claimed_button') : t('coins_page.daily_claim_button')}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            {tasks.map((task) => (
              <div key={task.id} className="px-5 py-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {task.id === 'watch_ad_unlock' ? (
                    <PlayCircle className="text-amber-500 shrink-0" size={22} />
                  ) : (
                    <Gift className="text-mia-green-500 shrink-0" size={22} />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{task.title}</p>
                    {task.description && <p className="text-xs text-gray-400 truncate">{task.description}</p>}
                  </div>
                </div>
                <button
                  onClick={() => handleClaimTask(task)}
                  disabled={claimingTaskId === task.id}
                  className="shrink-0 bg-mia-green-50 hover:bg-mia-green-100 text-mia-green-700 font-semibold text-xs px-3 py-2 rounded-lg flex items-center gap-1"
                >
                  {claimingTaskId === task.id && <Loader2 size={12} className="animate-spin" />}+{task.coins_reward} 🪙
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
