// POST /functions/v1/wallet-payout
// Body: { amount: number, method: string, recipient: {...} }
// Debits the wallet via the request_payout RPC (row-locked, so two
// parallel requests can't both succeed against the same balance), then
// calls Moneroo. If Moneroo rejects the payout outright, refunds
// immediately via fail_payout instead of waiting on a webhook that will
// never arrive.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { initializeMonerooPayout } from '../_shared/moneroo.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'UNAUTHENTICATED' }, 401);

    const admin = getSupabaseAdmin();
    const { data: userData, error: userError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !userData.user) return json({ error: 'UNAUTHENTICATED' }, 401);
    const uid = userData.user.id;

    const { amount, method, recipient } = await req.json();
    if (!amount || !method) return json({ error: 'amount and method are required' }, 400);

    // request_payout() checks auth.uid() internally, so we call it
    // through a client scoped to the caller's own JWT (not the service
    // role, which would make auth.uid() resolve to null inside the RPC).
    const scoped = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: payoutId, error: rpcError } = await scoped.rpc('request_payout', {
      p_amount: amount,
      p_method: method,
      p_recipient: recipient ?? {},
    });
    if (rpcError) return json({ error: rpcError.message }, 400);

    try {
      const monerooKey = Deno.env.get('MONEROO_SECRET_KEY')!;
      const payout = await initializeMonerooPayout(monerooKey, {
        amount,
        currency: 'XOF',
        description: `Retrait MIA #${String(payoutId).slice(0, 8)}`,
        method,
        recipient: recipient ?? {},
        metadata: { mia_payout_id: payoutId, mia_uid: uid },
      });
      await admin.from('payout_requests').update({ provider_ref: payout.id }).eq('id', payoutId);
      return json({ payoutId, status: 'processing' });
    } catch (monerooError) {
      await admin.rpc('fail_payout', { p_payout_id: payoutId });
      return json({ error: 'Le retrait a échoué et le solde a été remboursé.' }, 502);
    }
  } catch (error) {
    console.error('[wallet-payout] error', error);
    return json({ error: (error as Error).message ?? 'Internal error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
