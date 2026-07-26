/**
 * Loads the shop(s) owned by the currently logged-in seller. Renamed
 * from useVendorShop to useMyShop to match the capability-based language
 * (a person is not "a vendor account", they are a MIA account that
 * currently holds the 'seller' capability and owns a shop).
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

export interface MyShop {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  category: string;
  country_code: string;
  status: string;
  rating: number;
  review_count: number;
  product_count: number;
  total_sales: number;
  seller_score: number;
  whatsapp_number: string | null;
  whatsapp_orders_enabled: boolean;
  custom_cgv_html: string | null;
  custom_returns_policy_html: string | null;
  custom_privacy_policy_html: string | null;
  custom_domain: string | null;
  custom_domain_status: 'none' | 'pending' | 'verified' | 'failed';
}

export function useMyShop() {
  const { user } = useAuth();
  const [shop, setShop] = useState<MyShop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setShop(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    Promise.resolve(
      supabase
        .from('shops')
        .select('*')
        .eq('owner_id', user.id)
        .limit(1)
        .maybeSingle()
        .then(({ data, error: err }) => {
          if (cancelled) return;
          if (err) setError(err as unknown as Error);
          setShop(data as MyShop | null);
        })
    ).finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { shop, loading, error };
}
