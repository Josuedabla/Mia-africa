/**
 * Minimal public auth page - didn't exist before this (only AdminLogin
 * did). Needed for the wallet/referral features below to be reachable at
 * all. Captures ?ref=<uid> from the URL and applies it via
 * applyReferralCode right after a successful signup.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { applyReferralCode } from '@/services/coins.service';
import { setUserConsent } from '@/services/consent.service';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Wallet } from 'lucide-react';

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signInWithEmail, signUpWithEmail, isAuthenticated } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Consentement granulaire à l'inscription - AUCUNE case n'est
  // pré-cochée. essentialConsent est requis pour créer un compte (les
  // données couvertes - email, téléphone - sont celles qui font
  // fonctionner le service lui-même) ; marketing et localisation restent
  // strictement optionnels et n'affectent jamais la création du compte.
  const [essentialConsent, setEssentialConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [locationConsent, setLocationConsent] = useState(false);

  const referrerCode = searchParams.get('ref');

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'signup' && !essentialConsent) {
      setError('Vous devez accepter le traitement de vos données essentielles pour créer un compte.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password);

        // Enregistre chaque consentement séparément (granulaire), juste
        // après la création du compte - c'est le premier moment où un
        // user_id existe pour les rattacher (voir migration
        // 20260720000023, table user_consents).
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (uid) {
          await setUserConsent(uid, 'essential_data', true);
          await setUserConsent(uid, 'marketing', marketingConsent);
          await setUserConsent(uid, 'location', locationConsent);
        }

        if (referrerCode) {
          try {
            await applyReferralCode(referrerCode);
          } catch {
            // Non-blocking: a bad/expired referral code shouldn't stop signup.
          }
        }
      } else {
        await signInWithEmail(email, password);
      }
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message ?? 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-mia-green-600 text-white flex items-center justify-center mx-auto mb-4">
          <Wallet size={26} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {mode === 'signup' ? 'Créer un compte MIA' : 'Se connecter'}
        </h1>
        {referrerCode && mode === 'signup' && (
          <p className="text-sm text-mia-green-700 mt-1">🎁 Vous avez été invité(e) par un membre MIA</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-mia-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-mia-green-500"
          />
        </div>

        {mode === 'signup' && (
          <div className="space-y-2 pt-1">
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={essentialConsent}
                onChange={(e) => setEssentialConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-mia-green-600"
              />
              <span>
                J'accepte que MIA traite mes données (email, téléphone) nécessaires à la création et au
                fonctionnement de mon compte. <span className="text-red-500">Requis.</span>{' '}
                <a href="/confidentialite" target="_blank" rel="noreferrer" className="underline">
                  Politique de confidentialité
                </a>
              </span>
            </label>
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={locationConsent}
                onChange={(e) => setLocationConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-mia-green-600"
              />
              <span>J'accepte le partage de ma localisation pour améliorer la livraison et les boutiques proches. Optionnel.</span>
            </label>
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-mia-green-600"
              />
              <span>J'accepte de recevoir des offres et nouveautés MIA par notification. Optionnel.</span>
            </label>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-mia-green-600 hover:bg-mia-green-700 disabled:opacity-60 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 size={18} className="animate-spin" />}
          {mode === 'signup' ? 'Créer mon compte' : 'Se connecter'}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
          className="w-full text-sm text-gray-500"
        >
          {mode === 'signup' ? 'Déjà un compte ? Se connecter' : "Pas de compte ? S'inscrire"}
        </button>
      </form>
    </div>
  );
}
