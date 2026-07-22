// GET /functions/v1/geo-detect
// Server-side IP -> country lookup. Supabase Edge Functions run on Deno
// Deploy behind Cloudflare, which already sets the CF-IPCountry header on
// every request - the cheapest and most reliable source, no external API
// call or key needed. Falls back to a free IP geolocation API only if
// that header is somehow missing (e.g. local dev).
//
// This function exists so the ANDROID/iOS/web client never has to embed
// a geolocation API key, and so the "never show a country picker"
// requirement has a single, consistent source of truth. See
// src/hooks/useCountry.ts for how the client combines this with GPS
// (when permission is granted) and phone-prefix detection at signup.
import { corsHeaders, handleCors } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const lat = url.searchParams.get('lat');
  const lng = url.searchParams.get('lng');

  // GPS reverse-geocoding path - used when the user has granted location
  // permission, which takes priority over IP (more precise, and correct
  // for travelers/VPN users where IP geolocation is often wrong).
  if (lat && lng) {
    try {
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=fr`
      );
      const data = await res.json();
      if (data?.countryCode) {
        return json({ countryCode: data.countryCode, source: 'gps' });
      }
    } catch (error) {
      console.error('[geo-detect] reverse geocode failed', error);
    }
  }

  const cfCountry = req.headers.get('CF-IPCountry');
  if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') {
    return json({ countryCode: cfCountry, source: 'ip' });
  }

  // Local dev / no CF header fallback: ipapi.co free tier, no key
  // required for low volume. Swap for a paid provider before scaling.
  try {
    const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const url = forwardedFor ? `https://ipapi.co/${forwardedFor}/country/` : 'https://ipapi.co/country/';
    const res = await fetch(url);
    const code = (await res.text()).trim();
    if (res.ok && code.length === 2) {
      return json({ countryCode: code.toUpperCase(), source: 'ip' });
    }
  } catch (error) {
    console.error('[geo-detect] fallback lookup failed', error);
  }

  return json({ countryCode: null, source: 'unknown' });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
