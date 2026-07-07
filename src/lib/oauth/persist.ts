// Shared connection persistence — every OAuth callback funnels
// through this to write merchant_channel_connections rows.

import { createClient } from "@supabase/supabase-js";

export type ConnectionRow = {
  merchantId: string;
  channel: string;
  externalAccountId: string;
  displayName: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  scopes: string[];
  metadata?: Record<string, unknown>;
};

export async function persistConnections(
  rows: ConnectionRow[]
): Promise<{ ok: boolean; count: number; reason?: string }> {
  const supaUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supaUrl || !key) return { ok: false, count: 0, reason: "supabase_missing" };
  const c = createClient(supaUrl, key, { auth: { persistSession: false } });
  const payload = rows.map((r) => ({
    merchant_id: r.merchantId,
    channel: r.channel,
    external_account_id: r.externalAccountId,
    display_name: r.displayName,
    access_token: r.accessToken,
    refresh_token: r.refreshToken ?? null,
    expires_at: r.expiresAt,
    scopes: r.scopes,
    status: "active",
    metadata: r.metadata ?? {}
  }));
  const { error } = await c
    .from("merchant_channel_connections")
    .upsert(payload, {
      onConflict: "merchant_id,channel,external_account_id"
    });
  return { ok: !error, count: payload.length, reason: error?.message };
}
