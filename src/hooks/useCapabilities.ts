/**
 * Reads the current user's capabilities (buyer/creator/seller/driver/
 * wallet) - replaces the old single-role useUserRole hook. A user can
 * hold several capabilities at once; each has its own status
 * ('active' | 'pending' | 'suspended' | 'rejected').
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

export type Capability = 'buyer' | 'creator' | 'seller' | 'driver' | 'wallet';
export type CapabilityStatus = 'active' | 'pending' | 'suspended' | 'rejected';

export interface CapabilityRow {
  capability: Capability;
  status: CapabilityStatus;
}

export function useCapabilities() {
  const { user } = useAuth();
  const [capabilities, setCapabilities] = useState<CapabilityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setCapabilities([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const load = () =>
      supabase
        .from('user_capabilities')
        .select('capability, status')
        .eq('user_id', user.id)
        .then(({ data }) => setCapabilities(data ?? []));

    Promise.resolve(load()).finally(() => setLoading(false));

    const channel = supabase
      .channel(`capabilities:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_capabilities', filter: `user_id=eq.${user.id}` }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const has = (capability: Capability, status: CapabilityStatus = 'active') =>
    capabilities.some((c) => c.capability === capability && c.status === status);

  return {
    capabilities,
    loading,
    isBuyer: has('buyer'),
    isCreator: has('creator'),
    isSeller: has('seller'),
    isDriver: has('driver'),
    hasWalletCapability: has('wallet'),
    isDriverPending: has('driver', 'pending'),
    has,
  };
}
