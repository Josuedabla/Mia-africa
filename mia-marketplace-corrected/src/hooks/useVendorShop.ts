/**
 * Loads the shop owned by the currently logged-in vendor.
 * A vendor account without a shop yet means onboarding
 * (becomeVendor Cloud Function) never completed.
 */
import { useEffect, useState } from 'react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './useAuth';

export interface VendorShop {
  id: string;
  vendorId: string;
  name: string;
  slug: string;
  category: string;
  country: string;
  status: string;
  rating: number;
  reviewCount: number;
  productCount: number;
  totalSales: number;
  sellerScore: number;
}

export function useVendorShop() {
  const { user } = useAuth();
  const [shop, setShop] = useState<VendorShop | null>(null);
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

    const q = query(collection(db, 'shops'), where('vendorId', '==', user.uid), limit(1));
    getDocs(q)
      .then((snap) => {
        if (cancelled) return;
        if (snap.empty) {
          setShop(null);
        } else {
          const docSnap = snap.docs[0];
          setShop({ id: docSnap.id, ...(docSnap.data() as Omit<VendorShop, 'id'>) });
        }
      })
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { shop, loading, error };
}
