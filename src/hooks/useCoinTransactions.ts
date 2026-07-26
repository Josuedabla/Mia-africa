/**
 * Historique des mouvements de pièces MIA (achat, gains gratuits,
 * cadeaux envoyés/reçus, boosts). Remplace useWalletTransactions.ts qui
 * lisait une table "transactions" générique liée à l'ancien wallet.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

export interface CoinTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export function useCoinTransactions(max = 30) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const load = () =>
      supabase
        .from('coin_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(max)
        .then(({ data }) => setTransactions((data ?? []) as CoinTransaction[]));

    Promise.resolve(load()).finally(() => setLoading(false));

    const channel = supabase
      .channel(`coin-tx:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'coin_transactions', filter: `user_id=eq.${user.id}` }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, max]);

  return { transactions, loading };
}
