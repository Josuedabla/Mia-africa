/**
 * Seed Script for MIA Marketplace (Supabase edition)
 *
 * Reference data that must exist in every environment (like
 * country_wallet_availability) already lives directly in
 * supabase/migrations/20260718000008_search_and_geo.sql, so it's applied
 * automatically by `supabase db push` / `supabase migration up` - no
 * separate seed script is needed for that anymore.
 *
 * Use this file only for optional local-dev sample data (demo shops/
 * products) that you do NOT want applied in production. Requires the
 * service role key (bypasses RLS), never the anon key, and should only
 * ever be run against a local or staging database.
 *
 * Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-data.mjs
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('[seed] Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first.');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey);

async function main() {
  console.log('[seed] No demo data configured yet - add sample shops/products below as needed.');
  console.log('[seed] country_wallet_availability is already seeded by the migrations themselves.');
}

main();
