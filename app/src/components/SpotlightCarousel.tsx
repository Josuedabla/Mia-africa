/**
 * SpotlightCarousel
 *
 * Remplace VendorStories (jugé à risque de favoritisme perçu - un profil
 * fixe affiché 24h). Ici, un défilement HORIZONTAL CONTINU façon panneau
 * publicitaire routier : chaque profil entre par la droite, traverse
 * l'écran à vitesse constante, sort par la gauche - jamais un
 * remplacement brutal "tout disparaît en même temps", toujours un
 * mouvement fluide où plusieurs profils se chevauchent visuellement.
 *
 * Équité garantie côté serveur (get_spotlight_queue, migration 017) :
 * l'ordre de passage privilégie toujours qui n'est pas passé depuis le
 * plus longtemps. Un profil "Sponsorisé" (boost payant) passe plus
 * souvent mais JAMAIS en exclusivité - et porte toujours un badge visible
 * ici (obligation de transparence commerciale, jamais optionnel).
 *
 * Vitesse volontairement modérée (~28s pour traverser l'écran) : assez
 * lent pour rester lisible et laisser le temps de cliquer, assez rapide
 * pour qu'un visiteur voie plusieurs vendeurs différents en quelques
 * dizaines de secondes - un compromis délibéré, pas optimisé pour
 * maximiser les clics au détriment de la lisibilité.
 */
import React, { useEffect, useRef, useState } from 'react';
import { getSpotlightQueue, markSpotlightShown, type SpotlightEntry } from '@/services/spotlight.service';

interface SpotlightCarouselProps {
  onOpenShop: (shopSlug: string) => void;
}

const REFRESH_INTERVAL_MS = 15_000; // récupère un nouveau lot toutes les 15s
const TRAVERSAL_SECONDS = 28; // temps pour traverser l'écran de droite à gauche

export default function SpotlightCarousel({ onOpenShop }: SpotlightCarouselProps) {
  const [entries, setEntries] = useState<SpotlightEntry[]>([]);
  const shownRef = useRef<Set<string>>(new Set());

  const loadQueue = async () => {
    try {
      const queue = await getSpotlightQueue(10);
      setEntries(queue);

      // Marque comme "montré" seulement après un court délai (le temps
      // que l'utilisateur ait réellement pu les voir défiler), pour ne
      // pas pénaliser l'équité si le composant se démonte immédiatement.
      const newlyShown = queue.map((e) => e.shop_id).filter((id) => !shownRef.current.has(id));
      if (newlyShown.length > 0) {
        newlyShown.forEach((id) => shownRef.current.add(id));
        setTimeout(() => markSpotlightShown(newlyShown).catch(() => undefined), 3000);
      }
    } catch {
      setEntries([]);
    }
  };

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  if (entries.length === 0) return null;

  // Duplique la liste pour un défilement en boucle sans coupure visible
  // (technique standard du "marquee" infini en CSS).
  const loopEntries = [...entries, ...entries];

  return (
    <div className="relative overflow-hidden py-2" style={{ maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)' }}>
      <div
        className="flex gap-5 w-max"
        style={{
          animation: `mia-spotlight-scroll ${TRAVERSAL_SECONDS}s linear infinite`,
        }}
      >
        {loopEntries.map((entry, i) => (
          <button
            key={`${entry.shop_id}-${i}`}
            onClick={() => onOpenShop(entry.shop_slug)}
            className="flex flex-col items-center gap-1 shrink-0 w-16"
          >
            <div className="relative w-14 h-14">
              <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-mia-green-400 via-sky-400 to-mia-green-500">
                <div className="w-full h-full rounded-full bg-white p-0.5">
                  {entry.shop_logo_url ? (
                    <img src={entry.shop_logo_url} alt={entry.shop_name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-mia-green-100 text-mia-green-700 flex items-center justify-center font-bold text-lg">
                      {entry.shop_name?.[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              {/* Badge "Sponsorisé" - toujours visible quand is_sponsored,
                  jamais masquable : obligation de transparence
                  commerciale, pas une option de design. */}
              {entry.is_sponsored && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                  Sponsorisé
                </span>
              )}
            </div>
            <span className="text-[11px] text-gray-600 truncate w-full text-center mt-1">{entry.shop_name}</span>
          </button>
        ))}
      </div>

      <style>{`
        @keyframes mia-spotlight-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
