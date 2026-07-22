/**
 * useAuth Hook
 * Manages Firebase authentication state and operations
 */

import { useState, useEffect, useCallback } from 'react';
import {
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AuthUser {
  uid: string;
  email?: string;
  displayName?: string;
  isAnonymous: boolean;
}

interface UseAuthReturn {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  signInAnonymous: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email || undefined,
          displayName: firebaseUser.displayName || undefined,
          isAnonymous: firebaseUser.isAnonymous,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInAnonymous = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      await signInAnonymously(auth);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in anonymously');
      console.error('Anonymous sign-in error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
      console.error('Email sign-in error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      // The users/{uid} document was never created here before, which
      // combined with the old admin-only `users.create` Firestore rule
      // meant every signup silently left the user without a profile doc.
      // The rule now allows an owner to create their own doc (role must
      // start as 'user'; becoming a vendor/driver goes through the
      // becomeVendor Cloud Function, not a direct client write).
      await setDoc(doc(db, 'users', credential.user.uid), {
        email,
        role: 'user',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      setError(err.message || 'Failed to sign up');
      console.error('Email sign-up error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      await signOut(auth);
      setUser(null);
    } catch (err: any) {
      setError(err.message || 'Failed to sign out');
      console.error('Sign-out error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    user,
    loading,
    error,
    signInAnonymous,
    signInWithEmail,
    signUpWithEmail,
    logout,
    isAuthenticated: !!user,
  };
}
