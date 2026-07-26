/**
 * AdminPage Component
 * Secure admin dashboard with Supabase Auth.
 *
 * Admin status is not an email compared against an env var (that
 * pattern is broken end-to-end under Vite - process.env never resolves
 * client-side). It's the `is_admin` boolean on the profiles row, which
 * only a service-role script or a trusted Postgres migration can set -
 * never the client itself (RLS's profiles_update_own policy explicitly
 * blocks flipping is_admin).
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';

export const AdminPage: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [error, setError] = useState<string>('');

  const checkAdmin = async (user: User | null) => {
    if (!user) {
      setCurrentUser(null);
      setIsAuthenticated(false);
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
    if (profile?.is_admin) {
      setCurrentUser(user);
      setIsAuthenticated(true);
    } else {
      // Authenticated, but not an admin account - sign them back out of
      // this session rather than leaving a half-logged-in state.
      await supabase.auth.signOut();
      setCurrentUser(null);
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      checkAdmin(data.session?.user ?? null).finally(() => setLoading(false));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      checkAdmin(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogin = async (email: string, password: string): Promise<boolean> => {
    try {
      setError('');
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', data.user.id).single();
      if (!profile?.is_admin) {
        setError('Accès administrateur refusé. Ce compte n\'a pas les droits admin.');
        await supabase.auth.signOut();
        return false;
      }

      setCurrentUser(data.user);
      setIsAuthenticated(true);
      return true;
    } catch (err: any) {
      setError(err.message === 'Invalid login credentials'
        ? 'Email ou mot de passe incorrect'
        : "Erreur d'authentification. Veuillez réessayer.");
      return false;
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setError('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-mia-green-200 border-t-mia-green-600 rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} error={error} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="text-mia-green-600" size={28} />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">MIA Admin</h1>
              <p className="text-xs text-gray-500">Panneau de contrôle privé • {currentUser?.email}</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLogout}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            Déconnexion
          </motion.button>
        </div>
      </header>

      <AdminDashboard onLogout={handleLogout} />
    </div>
  );
};

export default AdminPage;
