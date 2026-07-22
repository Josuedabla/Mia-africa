/**
 * AdminPage Component
 * Secure admin dashboard with Firebase Email/Password authentication
 * Replaces hardcoded password with proper Firebase Auth
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, LogOut, BarChart3, Users, Zap, Settings } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';

export const AdminPage: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [error, setError] = useState<string>('');

  // Check Firebase auth state on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email === import.meta.env.VITE_ADMIN_EMAIL) {
        setCurrentUser(user);
        setIsAuthenticated(true);
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async (email: string, password: string): Promise<boolean> => {
    try {
      setError('');
      // Verify email is admin email
      if (email !== import.meta.env.VITE_ADMIN_EMAIL) {
        setError('Accès administrateur refusé. Email non autorisé.');
        return false;
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setCurrentUser(userCredential.user);
      setIsAuthenticated(true);
      return true;
    } catch (err: any) {
      const errorMessage = err.code === 'auth/invalid-credential'
        ? 'Email ou mot de passe incorrect'
        : err.code === 'auth/user-not-found'
        ? 'Utilisateur non trouvé'
        : err.code === 'auth/wrong-password'
        ? 'Mot de passe incorrect'
        : 'Erreur d\'authentification. Veuillez réessayer.';
      setError(errorMessage);
      return false;
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setIsAuthenticated(false);
      setError('');
    } catch (err) {
      console.error('Logout error:', err);
    }
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
      {/* Header */}
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

      {/* Main Content */}
      <AdminDashboard onLogout={handleLogout} />
    </div>
  );
};

export default AdminPage;
