/**
 * Résolution de la langue de l'interface — MIA-Spec-Fonctionnalites.md,
 * section 3.c ("Détection langue/pays (navigateur ou sélection
 * utilisateur) → interface en français, anglais, etc.").
 *
 * Contrairement à useCountry() (qui interdit tout sélecteur), la langue
 * reste modifiable explicitement par l'utilisateur à tout moment (bouton
 * FR/EN) — seul le choix *par défaut* est automatique. Ordre de
 * résolution :
 *   1. `profiles.language`, si connecté et déjà défini par un choix
 *      précédent.
 *   2. Le pays détecté par useCountry() (IP/GPS/téléphone) mappé sur une
 *      langue probable (ex. Ghana/Nigeria/Kenya → anglais, reste →
 *      français) — seulement s'il n'y a encore aucun choix persistant.
 *   3. La langue du navigateur (gérée par src/i18n/index.ts au tout
 *      premier rendu, avant que ce hook n'ait fini de résoudre le pays).
 *   4. Français, valeur par défaut de `profiles.language` en base.
 */
import { useCallback, useEffect, useState } from 'react';
import i18n, { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { useCountry } from './useCountry';

const LOCAL_STORAGE_KEY = 'mia_language';

/** Pays où l'anglais est la langue la plus probable parmi les marchés MIA actuels. */
const ENGLISH_SPEAKING_COUNTRIES = new Set(['GH', 'NG', 'KE']);

function languageForCountry(countryCode: string): SupportedLanguage {
  return ENGLISH_SPEAKING_COUNTRIES.has(countryCode) ? 'en' : 'fr';
}

export function useLanguage() {
  const { user } = useAuth();
  const { countryCode, loading: countryLoading } = useCountry();
  const [language, setLanguageState] = useState<SupportedLanguage>(i18n.language as SupportedLanguage);

  const applyLanguage = useCallback((lang: SupportedLanguage) => {
    i18n.changeLanguage(lang);
    setLanguageState(lang);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  }, []);

  // Choix explicite de l'utilisateur (bouton FR/EN) - persisté sur le
  // profil s'il est connecté, sinon seulement en local.
  const changeLanguage = useCallback(
    async (lang: SupportedLanguage) => {
      applyLanguage(lang);
      if (user) {
        await supabase.from('profiles').update({ language: lang }).eq('id', user.id);
      }
    },
    [applyLanguage, user]
  );

  // Résolution automatique au chargement : profil > pays détecté.
  // Ne s'exécute que si l'utilisateur n'a encore rien choisi explicitement
  // dans cette session (pas de valeur en localStorage) pour ne jamais
  // écraser un choix manuel avec une déduction automatique.
  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      let hasExplicitChoice = false;
      try {
        hasExplicitChoice = !!localStorage.getItem(LOCAL_STORAGE_KEY);
      } catch {
        // ignore
      }

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('language')
          .eq('id', user.id)
          .single();
        if (cancelled) return;
        if (profile?.language && (SUPPORTED_LANGUAGES as readonly string[]).includes(profile.language)) {
          applyLanguage(profile.language as SupportedLanguage);
          return;
        }
      }

      if (hasExplicitChoice || countryLoading) return;

      applyLanguage(languageForCountry(countryCode));
    };

    resolve();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, countryCode, countryLoading]);

  return { language, changeLanguage, supportedLanguages: SUPPORTED_LANGUAGES };
}
