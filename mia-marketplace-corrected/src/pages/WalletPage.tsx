import React, { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWallet } from '@/hooks/useWallet';
import { useWalletTransactions } from '@/hooks/useWalletTransactions';
import { walletService } from '@/services/wallet.service';
import {
  Wallet as WalletIcon,
  ArrowDownToLine,
  ArrowUpFromLine,
  Send,
  Coins,
  Loader2,
  Users,
  ArrowDownCircle,
  ArrowUpCircle,
} from 'lucide-react';

const TX_LABEL: Record<string, string> = {
  recharge: 'Recharge',
  purchase: 'Achat',
  vendor_payout_received: 'Vente reçue',
  payout_requested: 'Retrait demandé',
  payout_failed_refund: 'Retrait remboursé',
  transfer_out: 'Transfert envoyé',
  transfer_in: 'Transfert reçu',
  transfer_fee: 'Frais de transfert',
  referral_cashback: 'Cashback parrainage',
  coin_purchase: 'Achat de pièces',
  gift_received: 'Cadeau reçu',
};

const CREDIT_TYPES = new Set(['recharge', 'vendor_payout_received', 'payout_failed_refund', 'transfer_in', 'referral_cashback', 'gift_received']);

type Tab = 'apercu' | 'recharger' | 'transferer' | 'retirer' | 'pieces';

export default function WalletPage() {
  const { isAuthenticated } = useAuth();
  const { balance, coins, loading } = useWallet();
  const { transactions } = useWalletTransactions();
  const [tab, setTab] = useState<Tab>('apercu');

  const [rechargeAmount, setRechargeAmount] = useState(2000);
  const [rechargeLoading, setRechargeLoading] = useState(false);

  const [transferTarget, setTransferTarget] = useState('');
  const [transferAmount, setTransferAmount] = useState(1000);
  const [transferLoading, setTransferLoading] = useState(false);

  const [payoutMethod, setPayoutMethod] = useState('mtn_momo');
  const [payoutPhone, setPayoutPhone] = useState('');
  const [payoutAmount, setPayoutAmount] = useState(1000);
  const [payoutLoading, setPayoutLoading] = useState(false);

  const [coinAmount, setCoinAmount] = useState(100);
  const [coinLoading, setCoinLoading] = useState(false);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isAuthenticated) return <Navigate to="/connexion" replace />;

  const handleRecharge = async () => {
    setRechargeLoading(true);
    setMessage(null);
    try {
      const { checkoutUrl } = await walletService.initiateRecharge(rechargeAmount, `${window.location.origin}/portefeuille`);
      window.location.href = checkoutUrl;
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message ?? 'Échec de la recharge.' });
    } finally {
      setRechargeLoading(false);
    }
  };

  const handleTransfer = async () => {
    setTransferLoading(true);
    setMessage(null);
    try {
      const isPhone = /^\+?\d[\d\s]{6,}$/.test(transferTarget);
      const { fee } = await walletService.transferToUser({
        [isPhone ? 'toPhone' : 'toUid']: transferTarget,
        amount: transferAmount,
      } as any);
      setMessage({ type: 'success', text: `Transfert envoyé (frais MIA : ${fee.toLocaleString()} FCFA).` });
      setTransferTarget('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message ?? 'Échec du transfert.' });
    } finally {
      setTransferLoading(false);
    }
  };

  const handlePayout = async () => {
    setPayoutLoading(true);
    setMessage(null);
    try {
      await walletService.requestPayout(payoutAmount, payoutMethod, { phone: payoutPhone });
      setMessage({ type: 'success', text: 'Retrait en cours de traitement.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message ?? 'Échec du retrait.' });
    } finally {
      setPayoutLoading(false);
    }
  };

  const handleBuyCoins = async () => {
    setCoinLoading(true);
    setMessage(null);
    try {
      const { cost } = await walletService.purchaseCoins(coinAmount);
      setMessage({ type: 'success', text: `${coinAmount} pièces achetées pour ${cost.toLocaleString()} FCFA.` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message ?? "Échec de l'achat de pièces." });
    } finally {
      setCoinLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-16">
      <div className="bg-gradient-to-br from-mia-green-600 to-mia-green-500 rounded-2xl p-6 text-white mb-6">
        <div className="flex items-center gap-2 mb-4 text-white/90">
          <WalletIcon size={20} />
          <span className="font-medium">Mon portefeuille MIA</span>
        </div>
        <p className="text-4xl font-extrabold">
          {loading ? '...' : `${(balance ?? 0).toLocaleString()} FCFA`}
        </p>
        <div className="flex items-center gap-2 mt-3 text-white/90">
          <Coins size={16} />
          <span className="text-sm">{loading ? '...' : (coins ?? 0).toLocaleString()} pièces MIA</span>
        </div>
        <div className="flex gap-2 mt-5">
          <Link to="/parrainage" className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-sm font-semibold px-3 py-2 rounded-lg">
            <Users size={16} /> Parrainage
          </Link>
        </div>
      </div>

      {message && (
        <div className={`mb-4 text-sm rounded-lg px-4 py-3 ${message.type === 'success' ? 'bg-mia-green-50 text-mia-green-700 border border-mia-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 overflow-x-auto">
        {([
          ['apercu', 'Aperçu'],
          ['recharger', 'Recharger'],
          ['transferer', 'Transférer'],
          ['retirer', 'Retirer'],
          ['pieces', 'Pièces'],
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
          {transactions.length === 0 && <p className="px-5 py-8 text-center text-sm text-gray-400">Aucune transaction pour le moment.</p>}
          {transactions.map((tx) => {
            const isCredit = CREDIT_TYPES.has(tx.type);
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
                  {isCredit ? '+' : '-'}{tx.amount.toLocaleString()} FCFA
                </span>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'recharger' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 text-gray-900 font-bold"><ArrowDownToLine size={18} /> Recharger le portefeuille</div>
          <div className="grid grid-cols-3 gap-2">
            {[1000, 2000, 5000, 10000, 25000, 50000].map((amt) => (
              <button
                key={amt}
                onClick={() => setRechargeAmount(amt)}
                className={`py-2 rounded-lg border text-sm font-semibold ${
                  rechargeAmount === amt ? 'border-mia-green-600 bg-mia-green-50 text-mia-green-700' : 'border-gray-200 text-gray-600'
                }`}
              >
                {amt.toLocaleString()}
              </button>
            ))}
          </div>
          <input
            type="number"
            value={rechargeAmount}
            onChange={(e) => setRechargeAmount(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none"
          />
          <button
            onClick={handleRecharge}
            disabled={rechargeLoading || rechargeAmount <= 0}
            className="w-full bg-mia-green-600 hover:bg-mia-green-700 disabled:opacity-60 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
          >
            {rechargeLoading && <Loader2 size={18} className="animate-spin" />}
            Recharger {rechargeAmount.toLocaleString()} FCFA
          </button>
          <p className="text-xs text-gray-400">Paiement sécurisé via Moneroo (mobile money, carte bancaire).</p>
        </div>
      )}

      {tab === 'transferer' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 text-gray-900 font-bold"><Send size={18} /> Transférer à un utilisateur MIA</div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de téléphone du destinataire</label>
            <input
              value={transferTarget}
              onChange={(e) => setTransferTarget(e.target.value)}
              placeholder="+228 90 00 00 00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Montant (FCFA)</label>
            <input
              type="number"
              value={transferAmount}
              onChange={(e) => setTransferAmount(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none"
            />
          </div>
          <button
            onClick={handleTransfer}
            disabled={transferLoading || !transferTarget || transferAmount <= 0}
            className="w-full bg-mia-green-600 hover:bg-mia-green-700 disabled:opacity-60 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
          >
            {transferLoading && <Loader2 size={18} className="animate-spin" />}
            Envoyer {transferAmount.toLocaleString()} FCFA
          </button>
          <p className="text-xs text-gray-400">Des frais MIA de 1% (25 FCFA minimum) s'appliquent à chaque transfert.</p>
        </div>
      )}

      {tab === 'retirer' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 text-gray-900 font-bold"><ArrowUpFromLine size={18} /> Retirer vers mobile money</div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Opérateur</label>
            <select
              value={payoutMethod}
              onChange={(e) => setPayoutMethod(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none"
            >
              <option value="mtn_momo">MTN Mobile Money</option>
              <option value="orange_money">Orange Money</option>
              <option value="moov_money">Moov Money</option>
              <option value="bank_transfer">Virement bancaire</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Numéro / compte</label>
            <input
              value={payoutPhone}
              onChange={(e) => setPayoutPhone(e.target.value)}
              placeholder="+228 90 00 00 00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Montant (FCFA) - minimum 1 000</label>
            <input
              type="number"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none"
            />
          </div>
          <button
            onClick={handlePayout}
            disabled={payoutLoading || payoutAmount < 1000 || !payoutPhone}
            className="w-full bg-mia-green-600 hover:bg-mia-green-700 disabled:opacity-60 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
          >
            {payoutLoading && <Loader2 size={18} className="animate-spin" />}
            Retirer {payoutAmount.toLocaleString()} FCFA
          </button>
        </div>
      )}

      {tab === 'pieces' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 text-gray-900 font-bold"><Coins size={18} /> Acheter des pièces MIA</div>
          <p className="text-sm text-gray-500">Utilisez vos pièces pour offrir des cadeaux à vos vendeurs préférés ou booster un produit.</p>
          <div className="grid grid-cols-3 gap-2">
            {[100, 500, 1000, 2500, 5000, 10000].map((amt) => (
              <button
                key={amt}
                onClick={() => setCoinAmount(amt)}
                className={`py-2 rounded-lg border text-sm font-semibold ${
                  coinAmount === amt ? 'border-mia-green-600 bg-mia-green-50 text-mia-green-700' : 'border-gray-200 text-gray-600'
                }`}
              >
                {amt.toLocaleString()}
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-600">Coût : <span className="font-bold">{(coinAmount * 10).toLocaleString()} FCFA</span> (débité du portefeuille)</p>
          <button
            onClick={handleBuyCoins}
            disabled={coinLoading || coinAmount <= 0}
            className="w-full bg-mia-green-600 hover:bg-mia-green-700 disabled:opacity-60 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
          >
            {coinLoading && <Loader2 size={18} className="animate-spin" />}
            Acheter {coinAmount.toLocaleString()} pièces
          </button>
        </div>
      )}
    </div>
  );
}
