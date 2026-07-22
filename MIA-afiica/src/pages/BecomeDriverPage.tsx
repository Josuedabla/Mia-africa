import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bike, Loader2, Clock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCapabilities } from '@/hooks/useCapabilities';
import { capabilitiesService } from '@/services/capabilities.service';

const VEHICLES = [
  { value: 'moto', label: '🏍️ Moto' },
  { value: 'velo', label: '🚲 Vélo' },
  { value: 'voiture', label: '🚗 Voiture' },
  { value: 'pied', label: '🚶 À pied' },
];

export default function BecomeDriverPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { isDriver, isDriverPending, loading } = useCapabilities();
  const [vehicleType, setVehicleType] = useState('moto');
  const [zone, setZone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthenticated) {
    navigate('/connexion');
    return null;
  }

  if (loading) return null;

  if (isDriver) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto text-mia-green-600 mb-4" size={40} />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Vous êtes déjà livreur MIA</h1>
        <p className="text-gray-500">Retrouvez vos missions depuis l'application mobile MIA Livreur (bientôt disponible).</p>
      </div>
    );
  }

  if (isDriverPending) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <Clock className="mx-auto text-amber-500 mb-4" size={40} />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Demande en cours d'examen</h1>
        <p className="text-gray-500">Votre demande pour devenir livreur MIA est en cours de vérification par notre équipe.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await capabilitiesService.requestDriverCapability({ vehicleType, zone });
    } catch (err: any) {
      setError(err.message ?? 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto mb-4">
          <Bike size={26} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Devenez livreur MIA</h1>
        <p className="text-gray-600 mt-1">
          Livrez des commandes près de chez vous. Votre demande sera examinée par notre équipe avant activation.
        </p>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-md p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Moyen de transport</label>
          <div className="grid grid-cols-2 gap-2">
            {VEHICLES.map((v) => (
              <button
                type="button"
                key={v.value}
                onClick={() => setVehicleType(v.value)}
                className={`py-2.5 rounded-lg border text-sm font-medium ${
                  vehicleType === v.value ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Zone de livraison</label>
          <input
            required
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            placeholder="Ex : Lomé - Agoè, Bè, Adidogomé"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 size={18} className="animate-spin" />}
          Envoyer ma demande
        </button>
      </motion.form>
    </div>
  );
}
