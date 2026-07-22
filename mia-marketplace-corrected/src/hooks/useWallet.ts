import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './useAuth';

export function useWallet() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [coins, setCoins] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setBalance(null);
      setCoins(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubWallet = onSnapshot(doc(db, 'wallets', user.uid), (snap) => {
      setBalance(snap.exists() ? (snap.data().balance ?? 0) : 0);
      setLoading(false);
    });
    const unsubCoins = onSnapshot(doc(db, 'coinBalances', user.uid), (snap) => {
      setCoins(snap.exists() ? (snap.data().coins ?? 0) : 0);
    });
    return () => {
      unsubWallet();
      unsubCoins();
    };
  }, [user]);

  return { balance, coins, loading };
}
