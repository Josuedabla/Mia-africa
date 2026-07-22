// POST /functions/v1/chariow-webhook
// Same role as before (functions/src/chariow.ts in the Firebase version):
// re-verifies the sale directly against the Chariow API (never trusting
// the webhook body alone) before settling the order via the same
// settle_order_payment RPC used by Moneroo and wallet purchases.
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

const CHARIOW_API_URL = Deno.env.get('CHARIOW_API_URL') ?? 'https://api.chariow.com/v1';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const body = await req.json();
    const saleId = body?.id ?? body?.data?.id;
    if (!saleId) return new Response('Missing sale id', { status: 400 });

    const chariowKey = Deno.env.get('CHARIOW_API_KEY')!;
    const verifyResponse = await fetch(`${CHARIOW_API_URL}/sales/${saleId}`, {
      headers: { Authorization: `Bearer ${chariowKey}` },
    });
    if (!verifyResponse.ok) return new Response('Could not verify sale with Chariow', { status: 502 });

    const sale = await verifyResponse.json();
    const isPaid = sale?.status === 'completed' && sale?.payment?.status === 'success';
    const orderId = sale?.custom_metadata?.mia_order_id ?? sale?.metadata?.mia_order_id;

    if (isPaid && orderId) {
      const admin = getSupabaseAdmin();
      await admin.rpc('confirm_order_payment_webhook', { p_order_id: orderId, p_payment_method: 'chariow' });
    }

    return new Response('ok', { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('[chariow-webhook] error', error);
    return new Response('Internal error', { status: 500 });
  }
});
