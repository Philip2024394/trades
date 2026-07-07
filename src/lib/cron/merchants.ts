// Merchant enumeration for fan-out cron jobs. Reads distinct
// merchant_ids that have activity in the last 90 days so we don't
// waste calls on dormant accounts.

import { createClient } from "@supabase/supabase-js";

export async function activeMerchantIds(): Promise<string[]> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  const c = createClient(url, key, { auth: { persistSession: false } });
  const since = new Date(
    Date.now() - 90 * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data } = await c
    .from("business_events")
    .select("merchant_id")
    .gte("occurred_at", since);
  const set = new Set<string>();
  for (const row of (data ?? []) as Array<{ merchant_id: string }>) {
    set.add(row.merchant_id);
  }
  return Array.from(set);
}
