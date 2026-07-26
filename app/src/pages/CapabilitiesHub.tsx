/**
 * Single entry point to every capability a MIA account can take on -
 * embodies "one identity, many roles" instead of separate account types.
 * Each card reflects live status from useCapabilities (active/pending)
 * rather than just linking blindly.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Store, Bike, Sparkles, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { useCapabilities } from '@/hooks/useCapabilities';

const CARDS = [
  {
    key: 'seller' as const,
    to: '/vendeur/bienvenue',
    activeTo: '/vendeur/dashboard',
    icon: Store,
    color: 'bg-mia-green-600',
    title: 'Vendeur',
    description: "Créez votre boutique et vendez vos produits à des milliers d'acheteurs.",
  },
  {
    key: 'driver' as const,
    to: '/devenir-livreur',
    activeTo: '/devenir-livreur',
    icon: Bike,
    color: 'bg-indigo-600',
    title: 'Livreur',
    description: 'Livrez des commandes près de chez vous et gagnez à chaque course.',
  },
  {
    key: 'creator' as const,
    to: '/devenir-createur',
    activeTo: '/devenir-createur',
    icon: Sparkles,
    color: 'bg-pink-600',
    title: 'Créateur',
    description: 'Partagez du contenu et recevez des cadeaux de la communauté MIA.',
  },
];

export default function CapabilitiesHub() {
  const { has, loading } = useCapabilities();

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Une identité MIA, plusieurs façons de participer</h1>
        <p className="text-gray-500">Votre compte peut cumuler autant de capacités que vous le souhaitez.</p>
      </div>

      <div className="space-y-4">
        {CARDS.map(({ key, to, activeTo, icon: Icon, color, title, description }) => {
          const isActive = !loading && has(key, 'active');
          const isPending = !loading && has(key, 'pending');
          return (
            <Link
              key={key}
              to={isActive ? activeTo : to}
              className="flex items-center gap-4 bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              <div className={`w-12 h-12 rounded-xl ${color} text-white flex items-center justify-center shrink-0`}>
                <Icon size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900">{title}</p>
                <p className="text-sm text-gray-500">{description}</p>
              </div>
              {isActive && (
                <span className="flex items-center gap-1 text-xs font-semibold text-mia-green-700 bg-mia-green-50 rounded-full px-2.5 py-1 shrink-0">
                  <CheckCircle2 size={13} /> Actif
                </span>
              )}
              {isPending && (
                <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 rounded-full px-2.5 py-1 shrink-0">
                  <Clock size={13} /> En attente
                </span>
              )}
              {!isActive && !isPending && <ArrowRight size={18} className="text-gray-300 shrink-0" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
