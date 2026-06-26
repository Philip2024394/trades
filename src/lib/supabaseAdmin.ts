// Server-only Supabase client using the service-role key. Bypasses RLS,
// so admin pages can still read tables that are otherwise locked down
// against the public anon key (hammerex_orders, hammerex_page_events,
// hammerex_search_queries, hammerex_quote_clicks).
//
// Never import this from a Client Component. The "server-only" import
// throws at build time if anything tries.
import "server-only";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}
if (!serviceKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
