// POST /functions/v1/wallet-recharge
// Body: { amount: number, currency?: string, returnUrl: string }
// Starts a Moneroo checkout for a wallet recharge. The balance is only
// credited later, by moneroo-webhook, once payment.success is confirmed
// and signature-verified - never here.
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { initializeMonerooPayment } from '../_shared/moneroo.ts';

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

    const { amount, currency, returnUrl } = await req.json();
    if (!amount || amount <= 0) return json({ error: 'amount (positive number) is required' }, 400);
    if (!returnUrl) return json({ error: 'returnUrl is required' }, 400);

    const { data: profile } = await admin.from('profiles').select('email').eq('id', uid).single();
    const email = profile?.email ?? userData.user.email ?? `${uid}@mia.local`;

    const monerooKey = Deno.env.get('MONEROO_SECRET_KEY')!;
    const payment = await initializeMonerooPayment(monerooKey, {
      amount,
      currency: currency ?? 'XOF',
      description: 'Recharge portefeuille MIA',
      customer: { email },
      return_url: returnUrl,
      metadata: { mia_uid: uid, mia_type: 'wallet_recharge' },
    });

    return json({ checkoutUrl: payment.checkout_url, paymentId: payment.id });
  } catch (error) {
    console.error('[wallet-recharge] error', error);
    return json({ error: (error as Error).message ?? 'Internal error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
