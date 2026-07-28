/**
 * Solde de pièces MIA en temps réel, via Supabase Realtime. Remplace
 * useWallet.ts - il n'y a plus de "wallet" en argent réel depuis le
 * passage au modèle Money-In Only (migration 20260720000019). Les
 * pièces sont la seule monnaie, jamais retirables, pour personne.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

export function useCoins() {
  const { user } = useAuth();
  const [coins, setCoins] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setCoins(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    supabase
      .from('coin_balances')
      .select('coins')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setCoins(data?.coins ?? 0);
        setLoading(false);
      });

    const channel = supabase
      .channel(`coins:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'coin_balances', filter: `user_id=eq.${user.id}` },
        (payload) => setCoins((payload.new as any)?.coins ?? 0)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { coins, loading };
}

// Alias rétro-compatible pour les composants existants qui importent
// encore `useWallet` et lisent `.coins` - évite de devoir renommer tous
// les appelants d'un coup. `.balance` et `.walletEnabled` ont
// intentionnellement disparu (n'ont plus de sens sans wallet réel) : tout
// appelant qui les utilisait encore doit être corrigé, pas contourné.
export const useWallet = useCoins;
