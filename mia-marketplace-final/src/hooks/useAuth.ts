/**
 * useAuth - Supabase Auth version.
 *
 * Profile creation, the 'buyer' capability grant, and the wallet_profiles
 * row are now handled automatically by the handle_new_auth_user()
 * Postgres trigger (see supabase/migrations/20260718000002_profiles_and_capabilities.sql)
 * the moment Supabase Auth inserts a new auth.users row - a manual
 * approach in signUpWithEmail() had been tried earlier and was missing
 * entirely until a bug was found partway through the project's life.
 * A database trigger can't be forgotten by a future page.
 */
import { useState, useEffect, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface UseAuthReturn {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithPhone: (phone: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;
    } catch (err: any) {
      setError(err.message || 'Failed to sign up');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Phone auth: this is also the natural, zero-friction source of country
  // detection ("phone" in country_source) - the phone's international
  // prefix maps directly to a country, no separate step needed. See
  // useCountry.ts, which reads profiles.country_code once it's set here.
  const signInWithPhone = useCallback(async (phone: string) => {
    try {
      setError(null);
      setLoading(true);
      const { error: otpError } = await supabase.auth.signInWithOtp({ phone });
      if (otpError) throw otpError;
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyPhoneOtp = useCallback(async (phone: string, token: string) => {
    try {
      setError(null);
      setLoading(true);
      const { error: verifyError } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
      if (verifyError) throw verifyError;
    } catch (err: any) {
      setError(err.message || 'Invalid code');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    user,
    session,
    loading,
    error,
    isAuthenticated: !!user,
    signUpWithEmail,
    signInWithEmail,
    signInWithPhone,
    verifyPhoneOtp,
    signOut,
  };
}
