// Shared Supabase admin client for Edge Functions - uses the service
// role key (set automatically by Supabase in every Edge Function's
// environment), which bypasses RLS. Only import this in server-side
// Edge Function code, never ship it to the client.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export function getSupabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
