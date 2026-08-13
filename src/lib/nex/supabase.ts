// Nex-dedicated Supabase client · Philip 2026-08-02.
//
// SEPARATE from the existing hammerex-shared `src/lib/supabase.ts` client.
// Points at the new Nex Supabase project (ijvqdvsvwtwxzcqmoqit) so Nex
// app data (Projects · Nex Images · etc.) never mixes with trades/hammerex.
//
// Data-scope rule (Philip 2026-08-02 verbatim):
//   "Do not add any data that is not Nex app files and the system of Nex."
//
// v1 uses the anon key server-side. When auth arrives, swap in per-request
// user tokens. Client-side code should NEVER import this — all Nex data
// access goes through the /api/nex/* routes so session_id ownership can
// be enforced server-side.

import { createClient } from "@supabase/supabase-js";
import "server-only";

const url = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Server-only module — throwing here surfaces the misconfig at the
  // first API call rather than at silent-fail time.
  throw new Error(
    "Nex Supabase env vars missing · set NEXT_PUBLIC_NEX_SUPABASE_URL and NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY in .env.local",
  );
}

export const nexSupabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});
