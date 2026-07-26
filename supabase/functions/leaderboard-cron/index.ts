// GET/POST /functions/v1/leaderboard-cron
//
// À planifier via Supabase Cron (Dashboard > Edge Functions > Schedule) :
//   - Toutes les heures : recalcule les scores de la semaine EN COURS
//     (compute_weekly_leaderboard), pour que le classement affiché
//     avance progressivement sans être recalculé à chaque requête client.
//   - Une fois par semaine (lundi 00h05) avec ?finalize=true : finalise
//     la semaine ÉCOULÉE et distribue les badges/récompenses
//     (finalize_weekly_awards) - jamais sur la semaine en cours, les
//     rangs ne sont définitifs qu'une fois la semaine terminée.
//
// Protégé par un secret partagé (CRON_SECRET) plutôt que --no-verify-jwt
// ouvert à tous : un cron externe (ex: cron-job.org, ou le scheduler
// Supabase lui-même) doit connaître ce secret pour déclencher le calcul.
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

  const url = new URL(req.url);
  const shouldFinalize = url.searchParams.get('finalize') === 'true';
  const admin = getSupabaseAdmin();

  try {
    const { data: periodId, error: computeError } = await admin.rpc('compute_weekly_leaderboard', {});
    if (computeError) throw computeError;

    let finalizedWeekStart: string | null = null;
    if (shouldFinalize) {
      // Finalise la semaine PRÉCÉDENTE (celle qui vient de se terminer),
      // jamais la semaine en cours - date_trunc('week', ...) - 7 jours.
      const today = new Date();
      const currentWeekStart = new Date(today);
      const day = currentWeekStart.getUTCDay() || 7; // ISO: lundi = 1
      currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() - day + 1);
      const previousWeekStart = new Date(currentWeekStart);
      previousWeekStart.setUTCDate(previousWeekStart.getUTCDate() - 7);
      finalizedWeekStart = previousWeekStart.toISOString().slice(0, 10);

      const { error: finalizeError } = await admin.rpc('finalize_weekly_awards', { p_week_start: finalizedWeekStart });
      if (finalizeError) throw finalizeError;
    }

    return new Response(
      JSON.stringify({ ok: true, periodId, finalizedWeekStart }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[leaderboard-cron] error', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
