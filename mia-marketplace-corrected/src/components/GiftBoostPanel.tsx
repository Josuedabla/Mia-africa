/**
 * Gift a shop / boost a product with MIA Coins, right from the product
 * page. Both actions call server-side Cloud Functions (coins.ts) - no
 * balance math happens here, this just triggers the call and shows the
 * server's response.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, Rocket, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWallet } from '@/hooks/useWallet';
import { walletService } from '@/services/wallet.service';

interface GiftBoostPanelProps {
  shopId: string;
  productId: string;
}

const GIFT_AMOUNTS = [10, 50, 100, 500];
const BOOST_AMOUNTS = [50, 200, 500];

export default function GiftBoostPanel({ shopId, productId }: GiftBoostPanelProps) {
  const { isAuthenticated } = useAuth();
  const { coins } = useWallet();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'gift' | 'boost' | null>(null);
  const [amount, setAmount] = useState(GIFT_AMOUNTS[0]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const requireAuth = () => {
    if (!isAuthenticated) {
      navigate('/connexion');
      return true;
    }
    return false;
  };

  const handleGift = async () => {
    if (requireAuth()) return;
    setLoading(true);
    setMessage(null);
    try {
      await walletService.sendGift({ shopId, productId, coinAmount: amount });
      setMessage(`🎁 Cadeau de ${amount} pièces envoyé au vendeur !`);
    } catch (err: any) {
      setMessage(err.message ?? 'Solde de pièces insuffisant.');
    } finally {
      setLoading(false);
    }
  };

  const handleBoost = async () => {
    if (requireAuth()) return;
    setLoading(true);
    setMessage(null);
    try {
      await walletService.boostProduct({ productId, coinAmount: amount, durationHours: 24 });
      setMessage(`🚀 Produit boosté pendant 24h avec ${amount} pièces !`);
    } catch (err: any) {
      setMessage(err.message ?? 'Solde de pièces insuffisant.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-gray-200">
      <div className="flex gap-3">
        <button
          onClick={() => {
            setMode(mode === 'gift' ? null : 'gift');
            setAmount(GIFT_AMOUNTS[0]);
            setMessage(null);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm border ${
            mode === 'gift' ? 'bg-pink-50 border-pink-300 text-pink-700' : 'border-gray-300 text-gray-700'
          }`}
        >
          <Gift size={18} /> Offrir un cadeau
        </button>
        <button
          onClick={() => {
            setMode(mode === 'boost' ? null : 'boost');
            setAmount(BOOST_AMOUNTS[0]);
            setMessage(null);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm border ${
            mode === 'boost' ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-300 text-gray-700'
          }`}
        >
          <Rocket size={18} /> Booster ce produit
        </button>
      </div>

      {mode && (
        <div className="mt-4 bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-2">
            Solde de pièces : <span className="font-semibold text-gray-700">{coins ?? 0}</span>
          </p>
          <div className="flex gap-2 mb-3">
            {(mode === 'gift' ? GIFT_AMOUNTS : BOOST_AMOUNTS).map((a) => (
              <button
                key={a}
                onClick={() => setAmount(a)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${
                  amount === a ? 'bg-mia-green-600 text-white border-mia-green-600' : 'bg-white text-gray-600 border-gray-300'
                }`}
              >
                {a} 🪙
              </button>
            ))}
          </div>
          <button
            onClick={mode === 'gift' ? handleGift : handleBoost}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-mia-green-600 hover:bg-mia-green-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Confirmer avec {amount} pièces
          </button>
          {!coins && (
            <button onClick={() => navigate('/portefeuille')} className="w-full text-center text-xs text-mia-green-700 mt-2">
              Pas assez de pièces ? Recharger →
            </button>
          )}
        </div>
      )}

      {message && <p className="mt-3 text-sm text-center text-gray-700">{message}</p>}
    </div>
  );
}
