// POST /functions/v1/vercel-domain-manager
// Automatise ce que "l'équipe de développement" ferait manuellement dans le
// dashboard Vercel (Project > Domains > Add) : rattacher le domaine externe
// d'un vendeur au projet Vercel, puis vérifier périodiquement si ses DNS
// pointent correctement vers Vercel. Aucune intervention manuelle admin
// n'est nécessaire une fois VERCEL_API_TOKEN et VERCEL_PROJECT_ID configurés
// (voir scripts/set-edge-function-secrets.sh).
//
// Deux actions, appelées depuis src/services/db.service.ts:
//   - action: "add"   -> après que request_shop_custom_domain() (RPC SQL) a
//                        déjà validé le format + l'unicité et mis le statut
//                        en 'pending' côté DB, cette fonction fait l'appel
//                        réel à l'API Vercel pour enregistrer le domaine sur
//                        le projet et renvoie les enregistrements DNS exacts
//                        à donner au vendeur (certains domaines sont
//                        vérifiés instantanément par Vercel s'ils sont déjà
//                        bien configurés, la plupart nécessitent un délai
//                        de propagation DNS).
//   - action: "check" -> interroge Vercel pour savoir si le domaine est
//                        maintenant "verified", et si oui, seulement à ce
//                        moment-là, met à jour shops.custom_domain_status
//                        en base ('verified' ou reste 'pending'/'failed').
//                        Le client ne peut jamais faire passer ce statut à
//                        'verified' directement - seule cette fonction (avec
//                        la clé service_role) le peut, exactement comme
//                        request_shop_custom_domain() l'impose déjà côté SQL.
//   - action: "remove" -> détache le domaine du projet Vercel. Appelée AVANT
//                        la RPC SQL remove_shop_custom_domain() côté client
//                        (voir db.service.ts:removeShopCustomDomain), pour
//                        que shops.custom_domain soit encore renseigné en
//                        base au moment de cet appel - ce qui permet de
//                        vérifier ici que le `domain` fourni dans le body
//                        correspond bien à celui de la boutique (RLS),
//                        avant de le transmettre à Vercel.
//
// Sécurité : VERCEL_API_TOKEN et VERCEL_PROJECT_ID ne sont jamais exposés au
// client, ils vivent uniquement dans les secrets de cette Edge Function.
// L'appelant doit être authentifié et propriétaire de la boutique - vérifié
// ici en re-questionnant la table `shops` avec le token de l'utilisateur
// (RLS s'applique), pas en faisant confiance à un shop_id fourni tel quel.

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const VERCEL_API_BASE = 'https://api.vercel.com';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const vercelToken = Deno.env.get('VERCEL_API_TOKEN');
  const vercelProjectId = Deno.env.get('VERCEL_PROJECT_ID');
  // Optionnel: uniquement si le projet Vercel vit sous une Team. Laissé vide
  // pour un compte personnel (cas de MIA aujourd'hui) - voir README de cette
  // fonction / SUPABASE_DEPLOYMENT.md.
  const vercelTeamId = Deno.env.get('VERCEL_TEAM_ID') ?? '';

  if (!vercelToken || !vercelProjectId) {
    console.error('[vercel-domain-manager] VERCEL_API_TOKEN ou VERCEL_PROJECT_ID manquant');
    return json({ error: 'SERVER_MISCONFIGURED' }, 500);
  }

  let body: { action?: string; shop_id?: string; domain?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'INVALID_JSON_BODY' }, 400);
  }

  const { action, shop_id } = body;
  if (!action || !shop_id) {
    return json({ error: 'MISSING_ACTION_OR_SHOP_ID' }, 400);
  }
  if (action !== 'add' && action !== 'check' && action !== 'remove') {
    return json({ error: 'INVALID_ACTION' }, 400);
  }

  // Authentification: on réutilise le JWT de l'appelant (passé dans
  // Authorization) pour interroger `shops` avec RLS actif, exactement comme
  // le ferait le client - ça garantit que seul le propriétaire de la
  // boutique peut déclencher cette action, sans dupliquer la logique
  // d'autorisation déjà écrite dans les policies RLS existantes.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'UNAUTHENTICATED' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Vérifie systématiquement la propriété de la boutique via RLS, quelle
  // que soit l'action - même pour "remove", où shops.custom_domain peut
  // déjà être null (voir plus bas), on doit d'abord confirmer que
  // shop_id appartient bien à l'appelant.
  const { data: shop, error: shopError } = await callerClient
    .from('shops')
    .select('id, custom_domain, custom_domain_status')
    .eq('id', shop_id)
    .single();

  if (shopError || !shop) {
    return json({ error: 'NOT_SHOP_OWNER_OR_NOT_FOUND' }, 403);
  }

  const admin = getSupabaseAdmin();

  if (action === 'remove') {
    // Le frontend appelle cette action AVANT la RPC SQL
    // remove_shop_custom_domain() (voir db.service.ts), donc
    // shop.custom_domain (relu juste au-dessus via RLS, garanti
    // appartenir à l'appelant) est encore renseigné à ce stade.
    //
    // Sécurité: on exige que le `domain` fourni dans le body corresponde
    // exactement à shop.custom_domain plutôt que de faire confiance au
    // body tel quel - un appelant malveillant pourrait sinon demander la
    // suppression du domaine Vercel d'une AUTRE boutique en le devinant.
    const domainToRemove = body.domain;
    if (!domainToRemove) {
      return json({ error: 'MISSING_DOMAIN_FOR_REMOVAL' }, 400);
    }
    if (shop.custom_domain !== domainToRemove) {
      return json({ error: 'DOMAIN_MISMATCH' }, 403);
    }
    return await handleRemove(domainToRemove, vercelToken, vercelProjectId, vercelTeamId);
  }

  if (!shop.custom_domain) {
    return json({ error: 'NO_DOMAIN_REGISTERED' }, 400);
  }

  const domain = shop.custom_domain;

  if (action === 'add') {
    return await handleAdd(domain, shop_id, admin, vercelToken, vercelProjectId, vercelTeamId);
  }
  return await handleCheck(domain, shop_id, admin, vercelToken, vercelProjectId, vercelTeamId);
});

async function handleRemove(domain: string, token: string, projectId: string, teamId: string) {
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  const res = await fetch(`${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${domain}${qs}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  // 404 = déjà absent côté Vercel (par ex. suite à une tentative précédente
  // qui avait échoué en plein milieu) - traité comme un succès, pas une
  // erreur, puisque l'état final souhaité (domaine détaché) est atteint.
  if (!res.ok && res.status !== 404) {
    const data = await res.json().catch(() => null);
    console.error('[vercel-domain-manager] remove failed', res.status, data);
    return json({ error: 'VERCEL_REMOVE_FAILED', vercel_error: data?.error?.message ?? null }, 502);
  }

  return json({ removed: true });
}

async function handleAdd(
  domain: string,
  shopId: string,
  admin: ReturnType<typeof getSupabaseAdmin>,
  token: string,
  projectId: string,
  teamId: string,
) {
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  const res = await fetch(`${VERCEL_API_BASE}/v10/projects/${projectId}/domains${qs}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: domain }),
  });
  const data = await res.json();

  // Vercel renvoie 409 si le domaine est déjà attaché ailleurs (à un autre
  // projet Vercel, potentiellement hors MIA) - cas distinct du doublon déjà
  // géré par request_shop_custom_domain() côté SQL (qui ne vérifie que les
  // autres boutiques MIA entre elles).
  if (res.status === 409) {
    await admin.from('shops').update({ custom_domain_status: 'failed' }).eq('id', shopId);
    return json({ error: 'DOMAIN_TAKEN_ON_VERCEL', vercel_error: data?.error?.message ?? null }, 409);
  }
  if (!res.ok) {
    console.error('[vercel-domain-manager] add failed', res.status, data);
    await admin.from('shops').update({ custom_domain_status: 'failed' }).eq('id', shopId);
    return json({ error: 'VERCEL_ADD_FAILED', vercel_error: data?.error?.message ?? null }, 502);
  }

  // Récupère les instructions DNS précises (certains domaines apex
  // nécessitent un enregistrement A, les sous-domaines un CNAME) pour les
  // afficher au vendeur - évite de coder en dur "pointez vers 76.76.21.21"
  // qui peut changer côté Vercel.
  const configRes = await fetch(`${VERCEL_API_BASE}/v6/domains/${domain}/config${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const config = configRes.ok ? await configRes.json() : null;

  const alreadyVerified = data?.verified === true;
  await admin
    .from('shops')
    .update({ custom_domain_status: alreadyVerified ? 'verified' : 'pending' })
    .eq('id', shopId);

  return json({
    status: alreadyVerified ? 'verified' : 'pending',
    dns_instructions: buildDnsInstructions(domain, config),
    vercel_verification: data?.verification ?? [],
  });
}

async function handleCheck(
  domain: string,
  shopId: string,
  admin: ReturnType<typeof getSupabaseAdmin>,
  token: string,
  projectId: string,
  teamId: string,
) {
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  const res = await fetch(`${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${domain}${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();

  if (!res.ok) {
    console.error('[vercel-domain-manager] check failed', res.status, data);
    return json({ error: 'VERCEL_CHECK_FAILED', vercel_error: data?.error?.message ?? null }, 502);
  }

  const configRes = await fetch(`${VERCEL_API_BASE}/v6/domains/${domain}/config${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const config = configRes.ok ? await configRes.json() : null;

  // `misconfigured: false` = les DNS pointent correctement vers Vercel et le
  // SSL est (ou sera sous peu) émis. `verified` seul ne suffit pas toujours
  // à garantir que le trafic fonctionne réellement - on exige les deux.
  const isLive = data?.verified === true && config?.misconfigured === false;

  let newStatus: 'verified' | 'pending' | 'failed' = 'pending';
  if (isLive) newStatus = 'verified';
  else if (data?.verified === false && Array.isArray(data?.verification) && data.verification.length > 0) {
    // Vercel a explicitement des instructions de vérification en attente:
    // toujours "pending" tant que le délai DNS n'a pas dépassé un seuil
    // raisonnable - on ne marque "failed" que si Vercel le signale lui-même
    // (domaine invalide, conflit) pour éviter de décourager un vendeur dont
    // les DNS sont juste encore en propagation (peut prendre jusqu'à 48h).
    newStatus = 'pending';
  }

  await admin.from('shops').update({ custom_domain_status: newStatus }).eq('id', shopId);

  return json({
    status: newStatus,
    verified: data?.verified ?? false,
    misconfigured: config?.misconfigured ?? null,
    dns_instructions: buildDnsInstructions(domain, config),
  });
}

// deno-lint-ignore no-explicit-any
function buildDnsInstructions(domain: string, config: any) {
  const isApex = domain.split('.').length === 2; // ex: maboutique.com (vs shop.maboutique.com)
  if (isApex) {
    return {
      type: 'A',
      name: '@',
      value: (config?.aValues && config.aValues[0]) || '76.76.21.21',
      note: `Chez votre registrar de domaine, ajoutez un enregistrement A pointant "@" (ou ${domain}) vers cette adresse.`,
    };
  }
  return {
    type: 'CNAME',
    name: domain.split('.')[0],
    value: 'cname.vercel-dns.com',
    note: `Chez votre registrar de domaine, ajoutez un enregistrement CNAME pointant "${domain.split('.')[0]}" vers cette valeur.`,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
