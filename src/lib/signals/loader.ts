// Signals loader — writes engagement + conversion events into the
// signals table so the compose learning loop can adjust future posts.

import { createClient } from "@supabase/supabase-js";
import type { Signal, SignalType } from "./types";

function client() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function insertSignal(input: {
  merchantId: string;
  publicationId?: string;
  eventId?: string;
  signalType: SignalType;
  value?: number;
  source?: string;
  metadata?: Record<string, unknown>;
  observedAt?: string;
}): Promise<boolean> {
  const c = client();
  if (!c) return false;
  const { error } = await c.from("signals").insert({
    merchant_id: input.merchantId,
    publication_id: input.publicationId ?? null,
    event_id: input.eventId ?? null,
    signal_type: input.signalType,
    value: input.value ?? null,
    source: input.source ?? null,
    metadata: input.metadata ?? {},
    observed_at: input.observedAt ?? new Date().toISOString()
  });
  return !error;
}

type Row = {
  id: string;
  merchant_id: string;
  publication_id: string | null;
  event_id: string | null;
  signal_type: SignalType;
  observed_at: string;
  value: number | null;
  source: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function loadSignalsForPublication(
  publicationId: string
): Promise<Signal[]> {
  const c = client();
  if (!c) return [];
  const { data } = await c
    .from("signals")
    .select("*")
    .eq("publication_id", publicationId);
  return (data ?? []).map((r) => {
    const row = r as Row;
    return {
      id: row.id,
      merchantId: row.merchant_id,
      publicationId: row.publication_id,
      eventId: row.event_id,
      signalType: row.signal_type,
      observedAt: row.observed_at,
      value: row.value,
      source: row.source,
      metadata: row.metadata ?? {},
      createdAt: row.created_at
    };
  });
}
