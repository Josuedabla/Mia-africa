/**
 * AdminLogin Component
 * Supabase Auth (email/password) authentication for admin dashboard
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, AlertCircle } from 'lucide-react';

interface AdminLoginProps {
  onLogin: (email: string, password: string) => Promise<boolean>;
  error?: string;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin, error: externalError }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(externalError || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await onLogin(email, password);
      if (!success) {
        setPassword('');
      }
    } catch (err) {
      setError('Une erreur s\'est produite. Veuillez réessayer.');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-mia-green-600 to-mia-orange-600 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-mia-green-100 rounded-full mb-4">
            <Lock className="text-mia-green-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">MIA Admin</h1>
          <p className="text-gray-600 text-sm">Authentification sécurisée</p>
        </div>

        {/* Error Message */}
        {(error || externalError) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6 flex items-start gap-3"
          >
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-red-700 text-sm">{error || externalError}</p>
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
              Email administrateur
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={import.meta.env.VITE_ADMIN_EMAIL || 'admin@example.com'}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-mia-green-600 focus:border-transparent"
              disabled={loading}
              autoFocus
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Entrez votre mot de passe"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-mia-green-600 focus:border-transparent"
              disabled={loading}
              required
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-mia-green-600 hover:bg-mia-green-700 disabled:bg-gray-400 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Vérification...
              </>
            ) : (
              <>
                <Lock size={18} />
                Accéder au panneau
              </>
            )}
          </motion.button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          Accès réservé aux administrateurs MIA uniquement
        </p>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
