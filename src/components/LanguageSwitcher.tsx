/**
 * Sélecteur de langue compact (FR/EN) — contrairement au pays (jamais de
 * sélecteur, toujours auto-détecté), la langue reste un choix explicite
 * possible à tout moment, voir useLanguage.ts.
 */
import React from 'react';
import { useLanguage } from '@/hooks/useLanguage';

const LABELS: Record<string, string> = { fr: 'FR', en: 'EN' };

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { language, changeLanguage, supportedLanguages } = useLanguage();

  return (
    <div className={`inline-flex items-center rounded-full bg-gray-100 p-0.5 text-xs font-semibold ${className}`}>
      {supportedLanguages.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => changeLanguage(lang)}
          aria-pressed={language === lang}
          className={`px-2.5 py-1 rounded-full transition-colors ${
            language === lang ? 'bg-mia-green-600 text-white' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {LABELS[lang] ?? lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
