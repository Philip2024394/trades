// src/lib/nex-native/supabase-admin.ts
//
// NEX-native server-only Supabase client.
// ========================================
//
// This client talks to the AUTHORITATIVE NEX Supabase project
// (ijvqdvsvwtwxzcqmoqit) using NEX_-prefixed environment variables.
//
// It is DELIBERATELY SEPARATE from `src/lib/supabaseAdmin.ts` which
// targets the legacy thenetworkers/hammerev substrate. Every NEX-native
// service imports from THIS module; legacy code continues to use the
// other one. This split guarantees that a NEX-native service cannot
// accidentally read from or write to the legacy DB.
//
// Doctrine:
//   · project_nex_reframed_wave_2_native_foundation_storage_audit_2026_09_24
//     Founder-authored 2026-09-24 · authoritative NEX Supabase is
//     ijvqdvsvwtwxzcqmoqit · legacy 350 migrations MUST NOT be applied
//     here · NEX-native services import THIS admin client.
//   · project_nex_identity_doctrine_phone_is_credential_not_identity_system_2026_09_23
//     UUID identity anchoring · never phone-keyed.
//   · project_nex_build_order_nervous_system_first_founder_test_acceptance_2026_09_23
//     Environment verification chain · fail-loudly on missing env.
//
// Never import from a Client Component. `server-only` throws at build
// time if anything tries.

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEX_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const serviceKey = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  throw new Error(
    "nex-native/supabase-admin: Missing NEX_SUPABASE_URL (or NEXT_PUBLIC_NEX_SUPABASE_URL). " +
      "NEX-native services require the authoritative NEX Supabase project · not the legacy thenetworkers substrate."
  );
}

if (!serviceKey) {
  throw new Error(
    "nex-native/supabase-admin: Missing NEX_SUPABASE_SERVICE_ROLE_KEY. " +
      "NEX-native services require the service-role secret for the NEX Supabase project."
  );
}

/**
 * The single NEX-native admin client. Uses the service-role key · bypasses
 * RLS · server-only. Every NEX-native service imports this instance.
 */
export const nexSupabaseAdmin: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Redacted project ref for diagnostics / logging. Never logs the service
 * key.
 */
export function nexSupabaseProjectRef(): string {
  return url!.replace(/^https?:\/\/([^.]+)\..*$/, "$1");
}
