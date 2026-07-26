// GET/POST /functions/v1/expire-boosts-cron
//
// À planifier via Supabase Cron (Dashboard > Edge Functions > Schedule),
// par exemple toutes les 15 minutes - suffisant pour qu'un vendeur ne
// reste jamais "boosté" plus de quelques minutes après l'expiration
// réellement payée (product_boosts.expires_at). Corrige le bug où
// products.is_boosted restait à true indéfiniment une fois le boost
// expiré, puisque rien ne le repassait à false auparavant (voir migration
// 20260723000029_boost_expiration_and_scoring.sql).
//
// Appelle simplement public.expire_product_boosts() (idempotente, sans
// effet de bord si rien n'a expiré depuis le dernier passage).
//
// Protégé par le même secret partagé que leaderboard-cron (CRON_SECRET)
// plutôt que --no-verify-jwt ouvert à tous.
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const providedSecret = req.headers.get('X-Cron-Secret');
  const expectedSecret = Deno.env.get('CRON_SECRET');
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const admin = getSupabaseAdmin();

  try {
    const { data: expiredCount, error } = await admin.rpc('expire_product_boosts', {});
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, expiredCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[expire-boosts-cron] error', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
