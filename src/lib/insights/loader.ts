// Trade insights loader — read + write anonymised cross-merchant
// patterns so the composer can inject "for roofers on Instagram,
// typical strong posts are 90–120 chars mentioning slate + valley
// lead" context.

import { createClient } from "@supabase/supabase-js";

function client() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export type TradeInsight = {
  trade: string;
  channel: string | null;
  insightKind: string;
  facets: Record<string, unknown>;
  sampleSize: number;
  computedAt: string;
  validUntil: string | null;
};

type Row = {
  trade: string;
  channel: string | null;
  insight_kind: string;
  facets: Record<string, unknown>;
  sample_size: number;
  computed_at: string;
  valid_until: string | null;
};

function rowToInsight(row: Row): TradeInsight {
  return {
    trade: row.trade,
    channel: row.channel,
    insightKind: row.insight_kind,
    facets: row.facets,
    sampleSize: row.sample_size,
    computedAt: row.computed_at,
    validUntil: row.valid_until
  };
}

export async function upsertInsight(input: {
  trade: string;
  channel: string | null;
  insightKind: string;
  facets: Record<string, unknown>;
  sampleSize: number;
  validForDays?: number;
}): Promise<boolean> {
  const c = client();
  if (!c) return false;
  const validUntil = input.validForDays
    ? new Date(
        Date.now() + input.validForDays * 24 * 60 * 60 * 1000
      ).toISOString()
    : null;
  const { error } = await c.from("trade_insights").upsert(
    {
      trade: input.trade,
      channel: input.channel,
      insight_kind: input.insightKind,
      facets: input.facets,
      sample_size: input.sampleSize,
      computed_at: new Date().toISOString(),
      valid_until: validUntil
    },
    { onConflict: "trade,channel,insight_kind" }
  );
  return !error;
}

export async function loadInsightsFor(
  trade: string,
  channel: string | null = null
): Promise<TradeInsight[]> {
  const c = client();
  if (!c) return [];
  let q = c.from("trade_insights").select("*").eq("trade", trade);
  if (channel) q = q.eq("channel", channel);
  const { data } = await q;
  return (data ?? []).map((r) => rowToInsight(r as Row));
}
