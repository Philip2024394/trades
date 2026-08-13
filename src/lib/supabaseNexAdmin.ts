// NEX Supabase service-role client — service_role JWT for the NEX project
// (ijvqdvsvwtwxzcqmoqit). Bypasses RLS · never expose to the browser.
//
// This is SEPARATE from `@/lib/supabaseAdmin` which points at the trades /
// hammerex-shared project (msdonkkechxzgagyguoe). Nex-only tables — including
// directory_seeds — MUST use this client so their reads/writes hit the NEX
// project's database.
//
// Env vars (already present in .env.local):
//   · NEXT_PUBLIC_NEX_SUPABASE_URL          — the NEX project URL
//   · NEX_SUPABASE_SERVICE_ROLE_KEY          — service-role JWT (bypasses RLS)

import "server-only";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const serviceKey = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  throw new Error("Missing NEXT_PUBLIC_NEX_SUPABASE_URL");
}
if (!serviceKey) {
  throw new Error("Missing NEX_SUPABASE_SERVICE_ROLE_KEY");
}

export const supabaseNexAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
