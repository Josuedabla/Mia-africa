/**
 * Offrir un cadeau (catalogue: cœur, fleur, diamant...) ou booster un
 * produit, avec les pièces MIA, depuis la page produit. Remplace
 * l'ancien "montant libre de pièces" par un vrai catalogue d'objets-
 * cadeaux nommés (voir migration 20260720000021) - c'est l'objet
 * (cœur/fleur/diamant), pas un simple chiffre, qui pousse à dépenser.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, Rocket, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWallet } from '@/hooks/useCoins';
import { listGiftCatalog, sendGift, type GiftCatalogItem } from '@/services/gifts.service';
import { boostProduct } from '@/services/coins.service';

interface GiftBoostPanelProps {
  shopId: string;
  productId: string;
}

const BOOST_AMOUNTS = [50, 200, 500];

export default function GiftBoostPanel({ shopId, productId }: GiftBoostPanelProps) {
  const { isAuthenticated } = useAuth();
  const { coins } = useWallet();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'gift' | 'boost' | null>(null);
  const [catalog, setCatalog] = useState<GiftCatalogItem[]>([]);
  const [selectedGift, setSelectedGift] = useState<GiftCatalogItem | null>(null);
  const [boostAmount, setBoostAmount] = useState(BOOST_AMOUNTS[0]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    listGiftCatalog()
      .then((items) => {
        setCatalog(items);
        setSelectedGift(items[0] ?? null);
      })
      .catch(() => setCatalog([]));
  }, []);

  const requireAuth = () => {
    if (!isAuthenticated) {
      navigate('/connexion');
      return true;
    }
    return false;
  };

  const handleGift = async () => {
    if (requireAuth() || !selectedGift) return;
    setLoading(true);
    setMessage(null);
    try {
      await sendGift({ shopId, giftId: selectedGift.id });
      setMessage(`${selectedGift.emoji} ${selectedGift.name} envoyé au vendeur !`);
    } catch (err: any) {
      setMessage(err.message?.includes('INSUFFICIENT_COINS') ? 'Solde de pièces insuffisant.' : (err.message ?? 'Une erreur est survenue.'));
    } finally {
      setLoading(false);
    }
  };

  const handleBoost = async () => {
    if (requireAuth()) return;
    setLoading(true);
    setMessage(null);
    try {
      await boostProduct({ productId, coinAmount: boostAmount, durationHours: 24 });
      setMessage(`🚀 Produit boosté pendant 24h avec ${boostAmount} pièces !`);
    } catch (err: any) {
      setMessage(err.message?.includes('INSUFFICIENT_COINS') ? 'Solde de pièces insuffisant.' : (err.message ?? 'Une erreur est survenue.'));
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
            setBoostAmount(BOOST_AMOUNTS[0]);
            setMessage(null);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm border ${
            mode === 'boost' ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-300 text-gray-700'
          }`}
        >
          <Rocket size={18} /> Booster ce produit
        </button>
      </div>

      {mode === 'gift' && (
        <div className="mt-4 bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-3">
            Solde de pièces : <span className="font-semibold text-gray-700">{coins ?? 0}</span>
          </p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {catalog.map((gift) => (
              <button
                key={gift.id}
                onClick={() => setSelectedGift(gift)}
                className={`flex flex-col items-center gap-1 py-3 rounded-lg border ${
                  selectedGift?.id === gift.id ? 'bg-mia-green-50 border-mia-green-500' : 'bg-white border-gray-200'
                }`}
              >
                <span className="text-2xl">{gift.emoji}</span>
                <span className="text-xs font-medium text-gray-700">{gift.name}</span>
                <span className="text-[11px] text-gray-500">{gift.coin_price} 🪙</span>
              </button>
            ))}
          </div>
          <button
            onClick={handleGift}
            disabled={loading || !selectedGift}
            className="w-full flex items-center justify-center gap-2 bg-mia-green-600 hover:bg-mia-green-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Envoyer {selectedGift?.emoji} {selectedGift?.name} ({selectedGift?.coin_price} pièces)
          </button>
        </div>
      )}

      {mode === 'boost' && (
        <div className="mt-4 bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-2">
            Solde de pièces : <span className="font-semibold text-gray-700">{coins ?? 0}</span>
          </p>
          <div className="flex gap-2 mb-3">
            {BOOST_AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => setBoostAmount(a)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${
                  boostAmount === a ? 'bg-mia-green-600 text-white border-mia-green-600' : 'bg-white text-gray-600 border-gray-300'
                }`}
              >
                {a} 🪙
              </button>
            ))}
          </div>
          <button
            onClick={handleBoost}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-mia-green-600 hover:bg-mia-green-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Confirmer avec {boostAmount} pièces
          </button>
        </div>
      )}

      {mode && !coins && (
        <button onClick={() => navigate('/portefeuille')} className="w-full text-center text-xs text-mia-green-700 mt-2">
          Pas assez de pièces ? Recharger →
        </button>
      )}

      {message && <p className="mt-3 text-sm text-center text-gray-700">{message}</p>}
    </div>
  );
}
