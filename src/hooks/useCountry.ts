/**
 * Pays de l'utilisateur — SÉLECTION MANUELLE UNIQUEMENT.
 *
 * Décision produit + légale explicite (2026-07-29) : MIA ne détecte plus
 * jamais automatiquement la localisation d'un visiteur, sous aucune forme
 * (pas d'appel IP silencieux au chargement, pas de lecture de permission
 * GPS en arrière-plan). Aucune donnée de localisation n'est collectée sans
 * une action explicite et consciente de l'utilisateur.
 *
 * Ce hook ne fait plus que lire/écrire un choix que l'utilisateur a fait
 * lui-même (ex. pour l'affichage d'une devise). Il ne sert plus jamais à
 * filtrer quels produits ou boutiques s'affichent.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

const LOCAL_STORAGE_KEY = 'mia_selected_country';

export function useCountry() {
  const { user } = useAuth();
  const [countryCode, setCountryCode] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LOCAL_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  // Ne lit qu'un choix déjà explicitement fait et persisté (profil ou
  // localStorage) — aucun appel réseau de détection ici.
  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    supabase
      .from('profiles')
      .select('country_code, country_source')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.country_code && data.country_source === 'manual') {
          setCountryCode(data.country_code);
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, data.country_code);
          } catch {
            // ignore
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  /** Seule façon de définir un pays : choix explicite de l'utilisateur (ex. sélecteur de devise). */
  const setCountry = useCallback(
    async (code: string) => {
      setCountryCode(code);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, code);
      } catch {
        // ignore
      }
      if (user) {
        await supabase
          .from('profiles')
          .update({ country_code: code, country_source: 'manual' })
          .eq('id', user.id);
      }
    },
    [user?.id]
  );

  return { countryCode, setCountry };
}
