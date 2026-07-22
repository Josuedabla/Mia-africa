/**
 * "Become a seller" onboarding - calls the become_seller RPC
 * (supabase/migrations/20260718000006_functions.sql), which creates the
 * shop and grants the 'seller' capability atomically.
 *
 * The country field is no longer a dropdown the user picks - it's
 * pre-filled from useCountry() (auto-detected) and shown read-only,
 * consistent with the product rule "never ask the user to choose their
 * country".
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Store, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useCountry } from '@/hooks/useCountry';
import { capabilitiesService } from '@/services/capabilities.service';

const CATEGORIES = ['Mode', 'Électronique', 'Beauté', 'Maison', 'Alimentation', 'Autre'];
const COUNTRY_LABELS: Record<string, string> = {
  TG: 'Togo', BJ: 'Bénin', CI: "Côte d'Ivoire", SN: 'Sénégal',
  CM: 'Cameroun', GH: 'Ghana', NG: 'Nigeria', KE: 'Kenya',
};

export default function VendorOnboarding() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { isSeller } = useCapabilities();
  const { countryCode } = useCountry();
  const [form, setForm] = useState({ shopName: '', category: CATEGORIES[0], phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isSeller) {
    navigate('/vendeur/dashboard', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setError('Connectez-vous d\'abord pour créer votre boutique.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await capabilitiesService.becomeSeller({ ...form, country: countryCode });
      navigate('/vendeur/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message ?? "Une erreur est survenue, réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-mia-green-600 text-white flex items-center justify-center mx-auto mb-4">
          <Store size={26} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Créez votre boutique MIA</h1>
        <p className="text-gray-600 mt-1">Deux minutes suffisent, vous pourrez ajouter vos produits juste après.</p>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-md p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la boutique</label>
          <input
            required
            minLength={3}
            value={form.shopName}
            onChange={(e) => setForm((f) => ({ ...f, shopName: e.target.value }))}
            placeholder="Ex : Fashion Lomé"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mia-green-500 focus:border-transparent outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mia-green-500 outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pays (détecté automatiquement)</label>
          <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-gray-600">
            📍 {COUNTRY_LABELS[countryCode] ?? countryCode}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
          <input
            required
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+228 90 00 00 00"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mia-green-500 outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-mia-green-600 hover:bg-mia-green-700 disabled:opacity-60 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 size={18} className="animate-spin" />}
          {submitting ? 'Création en cours...' : 'Créer ma boutique'}
        </button>
      </motion.form>
    </div>
  );
}
