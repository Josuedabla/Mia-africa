/**
 * Résolution de la langue de l'interface — MIA-Spec-Fonctionnalites.md,
 * section 3.c.
 *
 * Aucune détection de pays n'intervient plus dans ce choix (décision du
 * 2026-07-29 : zéro détection de localisation, automatique ou silencieuse,
 * nulle part dans l'app). La langue reste modifiable explicitement par
 * l'utilisateur à tout moment (bouton FR/EN). Ordre de résolution :
 *   1. `profiles.language`, si connecté et déjà défini par un choix
 *      précédent.
 *   2. La langue du navigateur (gérée par src/i18n/index.ts au tout
 *      premier rendu).
 *   3. Français, valeur par défaut de `profiles.language` en base.
 */
import { useCallback, useEffect, useState } from 'react';
import i18n, { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

const LOCAL_STORAGE_KEY = 'mia_language';

export function useLanguage() {
  const { user } = useAuth();
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

  // Résolution automatique au chargement : profil connecté uniquement.
  // Si rien n'est défini côté profil, on laisse la langue déjà posée par
  // src/i18n/index.ts (navigateur, ou français par défaut) sans y toucher.
  useEffect(() => {
    let cancelled = false;
    if (!user) return;

    supabase
      .from('profiles')
      .select('language')
      .eq('id', user.id)
      .single()
      .then(({ data: profile }) => {
        if (cancelled) return;
        if (profile?.language && (SUPPORTED_LANGUAGES as readonly string[]).includes(profile.language)) {
          applyLanguage(profile.language as SupportedLanguage);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, applyLanguage]);

  return { language, changeLanguage, supportedLanguages: SUPPORTED_LANGUAGES };
}
