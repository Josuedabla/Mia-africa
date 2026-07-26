/**
 * Auto-detects the user's country - the app must NEVER show a "choose
 * your country" dropdown. Priority order:
 *   1. Already stored on the profile (phone signup already set it, or a
 *      previous run of this hook did).
 *   2. GPS, if the browser/app already has location permission (we never
 *      prompt just for this - see requestPreciseLocation for the
 *      opt-in path used by "shops near me" features).
 *   3. IP address (via the geo-detect Edge Function), always available,
 *      no permission needed.
 *   4. 'TG' as a last-resort default so the app never has nothing to
 *      show (product/currency defaults have to be something).
 *
 * Once resolved, the result is written back to profiles.country_code /
 * country_source so subsequent loads skip straight to step 1.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase, edgeFunctionUrl } from '@/lib/supabase';
import { useAuth } from './useAuth';

const LOCAL_CACHE_KEY = 'mia_detected_country';
const DEFAULT_COUNTRY = 'TG';

interface DetectedCountry {
  countryCode: string;
  source: 'ip' | 'phone' | 'gps' | 'manual' | 'default';
}

async function detectViaIp(): Promise<DetectedCountry | null> {
  try {
    const res = await fetch(edgeFunctionUrl('geo-detect'));
    const data = await res.json();
    if (data?.countryCode) return { countryCode: data.countryCode, source: 'ip' };
  } catch {
    // ignore - falls through to default
  }
  return null;
}

async function detectViaGps(): Promise<DetectedCountry | null> {
  if (!('geolocation' in navigator)) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(`${edgeFunctionUrl('geo-detect')}?lat=${latitude}&lng=${longitude}`);
          const data = await res.json();
          resolve(data?.countryCode ? { countryCode: data.countryCode, source: 'gps' } : null);
        } catch {
          resolve(null);
        }
      },
      () => resolve(null), // permission denied / unavailable - fall back silently
      { timeout: 4000, maximumAge: 300_000 }
    );
  });
}

export function useCountry() {
  const { user } = useAuth();
  const [countryCode, setCountryCode] = useState<string>(() => localStorage.getItem(LOCAL_CACHE_KEY) ?? DEFAULT_COUNTRY);
  const [source, setSource] = useState<DetectedCountry['source']>('default');
  const [loading, setLoading] = useState(true);

  const persist = useCallback(
    async (result: DetectedCountry) => {
      localStorage.setItem(LOCAL_CACHE_KEY, result.countryCode);
      setCountryCode(result.countryCode);
      setSource(result.source);
      if (user) {
        await supabase
          .from('profiles')
          .update({ country_code: result.countryCode, country_source: result.source })
          .eq('id', user.id);
      }
    },
    [user]
  );

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      setLoading(true);

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('country_code, country_source')
          .eq('id', user.id)
          .single();
        if (cancelled) return;
        if (profile?.country_code) {
          setCountryCode(profile.country_code);
          setSource((profile.country_source as DetectedCountry['source']) ?? 'manual');
          localStorage.setItem(LOCAL_CACHE_KEY, profile.country_code);
          setLoading(false);
          return;
        }
      }

      // Try GPS only if permission was already granted previously (never
      // trigger a fresh browser permission prompt on page load - that's
      // reserved for an explicit "shops near me" action).
      if ('permissions' in navigator) {
        try {
          const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (status.state === 'granted') {
            const gpsResult = await detectViaGps();
            if (gpsResult && !cancelled) {
              await persist(gpsResult);
              setLoading(false);
              return;
            }
          }
        } catch {
          // Permissions API not supported - fall through to IP.
        }
      }

      const ipResult = await detectViaIp();
      if (cancelled) return;
      if (ipResult) {
        await persist(ipResult);
      } else {
        await persist({ countryCode: DEFAULT_COUNTRY, source: 'default' });
      }
      setLoading(false);
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [user, persist]);

  /** Explicit opt-in path for "shops near me" - this is allowed to trigger the browser's permission prompt. */
  const requestPreciseLocation = useCallback(async () => {
    const gpsResult = await detectViaGps();
    if (gpsResult) await persist(gpsResult);
    return gpsResult;
  }, [persist]);

  return { countryCode, source, loading, requestPreciseLocation };
}
