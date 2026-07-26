/**
 * ConsentBanner
 *
 * S'affiche dès la première visite, AVANT toute création de compte -
 * "on doit collecter leurs données seulement s'il accepte". Consentement
 * granulaire : "Refuser" n'empêche jamais l'usage du site (aucune donnée
 * n'est essentielle pour un simple visiteur anonyme), seul le tracking
 * analytique est concerné à ce stade. Aucune case n'est pré-cochée.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { setAnonymousAnalyticsConsent, getLocalConsentState } from '@/services/consent.service';

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const state = getLocalConsentState();
    if (!state.hasAnswered) setVisible(true);
  }, []);

  const handleChoice = async (granted: boolean) => {
    setSaving(true);
    try {
      await setAnonymousAnalyticsConsent(granted);
    } catch (err) {
      console.error('Error saving consent:', err);
    } finally {
      setSaving(false);
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[100] bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] p-4 sm:p-5">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-gray-600 flex-1">
          MIA utilise des données de navigation pour améliorer vos recommandations de produits. Vous pouvez accepter
          ou refuser - cela ne change rien à votre accès au site.{' '}
          <Link to="/confidentialite" className="text-mia-green-700 underline">
            En savoir plus
          </Link>
        </p>
        <div className="flex gap-2 shrink-0 w-full sm:w-auto">
          <button
            onClick={() => handleChoice(false)}
            disabled={saving}
            className="flex-1 sm:flex-none px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold"
          >
            Refuser
          </button>
          <button
            onClick={() => handleChoice(true)}
            disabled={saving}
            className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-mia-green-600 hover:bg-mia-green-700 text-white text-sm font-semibold"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
