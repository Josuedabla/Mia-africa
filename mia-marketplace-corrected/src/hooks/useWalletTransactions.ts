import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './useAuth';

export interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number | null;
  status?: string;
  description: string;
  createdAt?: { toDate: () => Date };
}

export function useWalletTransactions(max = 30) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'walletTransactions'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(max)
    );
    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
    });
    return unsub;
  }, [user, max]);

  return { transactions, loading };
}
