/**
 * PersonalizeFeedCard
 *
 * Inspiré de l'encart YouTube "Personnalisez votre flux" injecté à
 * intervalle régulier dans la liste (voir capture d'écran fournie et la
 * demande explicite d'ajouter cette fonctionnalité). Sert deux buts :
 * 1. Un vrai point de sortie visuel dans le scroll infini (moins
 *    addictif de façon négative, plus respectueux de l'utilisateur).
 * 2. Une collecte de préférences de catégories qui améliore
 *    concrètement getDiscoveryFeedPage pour cet utilisateur ensuite.
 */
import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';

const CATEGORY_OPTIONS = [
  'Mode', 'Électronique', 'Beauté', 'Maison', 'Alimentation', 'Bijoux', 'Sport', 'Bébé & Enfant',
];

interface PersonalizeFeedCardProps {
  onPreferencesSaved?: (categories: string[]) => void;
}

export default function PersonalizeFeedCard({ onPreferencesSaved }: PersonalizeFeedCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const toggle = (cat: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleSave = () => {
    onPreferencesSaved?.(Array.from(selected));
    setDismissed(true);
  };

  return (
    <div className="relative rounded-2xl bg-gray-900 text-white p-5 flex flex-col items-center text-center">
      <button onClick={() => setDismissed(true)} className="absolute top-3 right-3 text-white/50 hover:text-white">
        <X size={16} />
      </button>

      <Sparkles className="text-mia-green-400 mb-2" size={28} />
      <p className="font-bold mb-1">Personnalisez votre flux</p>
      <p className="text-sm text-white/60 mb-4">
        Choisissez des catégories pour nous dire ce que vous aimez
      </p>

      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="bg-white text-gray-900 font-semibold text-sm px-5 py-2 rounded-full"
        >
          Commencer
        </button>
      ) : (
        <div className="w-full">
          <div className="flex flex-wrap gap-2 justify-center mb-4">
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat}
                onClick={() => toggle(cat)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
                  selected.has(cat) ? 'bg-mia-green-500 border-mia-green-500 text-white' : 'border-white/30 text-white/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={selected.size === 0}
            className="w-full bg-white text-gray-900 disabled:bg-white/30 disabled:text-white/50 font-semibold text-sm py-2 rounded-full"
          >
            Valider mes préférences
          </button>
        </div>
      )}
    </div>
  );
}
