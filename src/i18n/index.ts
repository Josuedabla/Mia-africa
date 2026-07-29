/**
 * i18n — MIA-Spec-Fonctionnalites.md, section 3.c.
 *
 * Ordre de résolution de la langue au premier chargement (avant que
 * useLanguage() ne prenne le relai côté profil Supabase, voir
 * useLanguage.ts) :
 *   1. Langue déjà choisie/persistée par l'utilisateur (localStorage).
 *   2. Langue du navigateur (`navigator.language`), si c'est une des
 *      langues supportées.
 *   3. Français par défaut — cohérent avec `profiles.language default
 *      'fr'` déjà présent en base, et avec la majorité des pays
 *      actuellement supportés (Togo, Bénin, Côte d'Ivoire, Sénégal,
 *      Cameroun sont francophones).
 *
 * Le mapping pays → langue (ex. Ghana/Nigeria/Kenya → anglais) est géré
 * séparément dans useLanguage.ts (langue du navigateur, pas de pays détecté).
 * pays détecté — i18next lui-même reste simple et ne connaît que
 * "quelles langues existent" et "quel texte pour quelle clé".
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './locales/fr.json';
import en from './locales/en.json';
import sw from './locales/sw.json';
import ar from './locales/ar.json';
import pt from './locales/pt.json';

export const SUPPORTED_LANGUAGES = ['fr', 'en', 'sw', 'ar', 'pt'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const LOCAL_STORAGE_KEY = 'mia_language';

function detectInitialLanguage(): SupportedLanguage {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)) {
      return stored as SupportedLanguage;
    }
  } catch {
    // localStorage indisponible (SSR, navigation privée stricte...) - ignore.
  }

  const browserLang = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : 'fr';
  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(browserLang)) {
    return browserLang as SupportedLanguage;
  }

  return 'fr';
}

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    sw: { translation: sw },
    ar: { translation: ar },
    pt: { translation: pt },
  },
  lng: detectInitialLanguage(),
  fallbackLng: 'fr',
  supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
  interpolation: { escapeValue: false }, // React échappe déjà le JSX.
  returnEmptyString: false,
});

/** Langues s'affichant de droite à gauche. */
const RTL_LANGUAGES: readonly SupportedLanguage[] = ['ar'];

/**
 * Applique dir="rtl"/"ltr" et lang="xx" sur <html> selon la langue active.
 * Appelé une fois au chargement puis à chaque changement de langue
 * (i18n.changeLanguage, y compris via useLanguage().changeLanguage).
 */
function applyDocumentDirection(lang: string) {
  if (typeof document === 'undefined') return;
  document.documentElement.dir = RTL_LANGUAGES.includes(lang as SupportedLanguage) ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
}

i18n.on('languageChanged', applyDocumentDirection);
applyDocumentDirection(i18n.language);

export default i18n;
