/**
 * Reads the Firestore `role` field for the current user (Firebase Auth
 * alone doesn't carry app roles). Used to guard vendor/admin/driver areas.
 */
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './useAuth';

export type UserRole = 'user' | 'vendor' | 'driver' | 'admin' | null;

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        setRole((snap.data()?.role as UserRole) ?? 'user');
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [user]);

  return { role, loading };
}
