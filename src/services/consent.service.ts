/**
 * Consent Service
 *
 * "Même si le compte peut ne pas être créé au début, on doit collecter
 * leurs données seulement s'il accepte." Gère le consentement à deux
 * niveaux :
 *  - Anonyme (avant tout compte) : un session_id local, persistant tant
 *    que le navigateur n'est pas vidé, sert de clé pour le consentement
 *    analytique d'un simple visiteur.
 *  - Compte (après inscription) : granulaire par type (essential_data,
 *    analytics, marketing, location), jamais un "tout accepter" fourre-
 *    tout - voir migration 20260720000023.
 */
import { supabase } from '@/lib/supabase';

const SESSION_ID_KEY = 'mia_session_id';
const CONSENT_CACHE_KEY = 'mia_consent_cache';
export const PRIVACY_POLICY_VERSION = 'v1';

export type ConsentType = 'essential_data' | 'analytics' | 'marketing' | 'location';

export interface ConsentState {
  analytics: boolean;
  marketing: boolean;
  location: boolean;
  hasAnswered: boolean; // distingue "n'a jamais répondu" de "a explicitement refusé"
}

/** Identifiant anonyme stable, généré une fois côté client, jamais un identifiant qui permettrait de ré-identifier la personne (pas d'IP, pas de fingerprint device ici). */
export function getOrCreateSessionId(): string {
  let sessionId = localStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

export function getLocalConsentState(): ConsentState {
  const raw = localStorage.getItem(CONSENT_CACHE_KEY);
  if (!raw) return { analytics: false, marketing: false, location: false, hasAnswered: false };
  try {
    return { hasAnswered: true, analytics: false, marketing: false, location: false, ...JSON.parse(raw) };
  } catch {
    return { analytics: false, marketing: false, location: false, hasAnswered: false };
  }
}

function saveLocalConsentState(state: Omit<ConsentState, 'hasAnswered'>) {
  localStorage.setItem(CONSENT_CACHE_KEY, JSON.stringify(state));
}

/**
 * Enregistre le consentement d'un visiteur ANONYME (pas encore de
 * compte) - uniquement le tracking analytique a du sens à ce stade,
 * aucune donnée personnelle n'est collectée avant l'inscription.
 */
export async function setAnonymousAnalyticsConsent(granted: boolean): Promise<void> {
  const sessionId = getOrCreateSessionId();
  const { error } = await supabase.rpc('set_anonymous_consent', {
    p_session_id: sessionId,
    p_analytics_consent: granted,
  });
  if (error) throw error;
  saveLocalConsentState({ analytics: granted, marketing: false, location: false });
}

/** Enregistre un consentement granulaire pour un compte authentifié - jamais groupé, un type à la fois. */
export async function setUserConsent(userId: string, type: ConsentType, granted: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_user_consent', {
    p_user_id: userId,
    p_consent_type: type,
    p_granted: granted,
    p_privacy_policy_version: PRIVACY_POLICY_VERSION,
  });
  if (error) throw error;

  if (type !== 'essential_data') {
    const current = getLocalConsentState();
    saveLocalConsentState({ ...current, [type]: granted });
  }
}

export async function getUserConsent(userId: string) {
  const { data, error } = await supabase.from('user_consents').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export default {
  getOrCreateSessionId,
  getLocalConsentState,
  setAnonymousAnalyticsConsent,
  setUserConsent,
  getUserConsent,
  PRIVACY_POLICY_VERSION,
};
