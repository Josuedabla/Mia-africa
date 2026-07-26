/**
 * Supabase client.
 *
 * One client for Auth, Postgres (via PostgREST), Storage, and Realtime.
 * No separate "db"/"auth"/"storage" exports - everything hangs off this
 * single `supabase` instance, which is the idiomatic Supabase pattern.
 */
import { createClient } from '@supabase/supabase-js';
// NOTE: once the project is linked (`supabase link`), generate real
// typed table definitions with:
//   supabase gen types typescript --linked > src/types/database.types.ts
// and swap createClient<Database>(...) back in below for full
// query-builder autocomplete/type-safety. Shipping untyped for now
// rather than a hand-written Database type that would silently drift
// from the actual schema in supabase/migrations/.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Supabase] Missing configuration. Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file and that the dev/build process was restarted after editing it.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Base URL for calling Edge Functions directly with fetch (used where supabase.functions.invoke isn't a fit, e.g. webhooks registered with providers). */
export const edgeFunctionUrl = (name: string) => `${supabaseUrl}/functions/v1/${name}`;

export default supabase;
