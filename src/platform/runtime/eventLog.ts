// Platform Runtime — durable event log writer.
//
// Every durable publish lands here first, then the in-process bus
// broadcasts to same-process subscribers. If the DB write fails, the
// event is NOT broadcast — durability is the primary contract of the
// durable path. Callers wanting fire-and-forget broadcast use
// runtime.publishEvent instead.
//
// Returns the persisted row (with its assigned `seq`) so callers can
// track their consumption cursor.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type StoredEvent = {
  id: string;
  seq: number;
  event: string;
  payload_json: Record<string, unknown> | null;
  merchant_id: string | null;
  published_by_app: string | null;
  published_at: string;
};

export type WriteEventArgs = {
  event: string;
  payload?: Record<string, unknown> | null;
  merchantId?: string | null;
  publishedByApp?: string | null;
};

/** Persist a single event to platform_events. Returns the stored
 *  row (with its assigned monotonic seq) so callers can track a
 *  consumption cursor. Throws on DB error so callers know durability
 *  failed. */
export async function writeEvent(
  args: WriteEventArgs
): Promise<StoredEvent> {
  const res = await supabaseAdmin
    .from("platform_events")
    .insert({
      event: args.event,
      payload_json: args.payload ?? null,
      merchant_id: args.merchantId ?? null,
      published_by_app: args.publishedByApp ?? null
    })
    .select(
      "id, seq, event, payload_json, merchant_id, published_by_app, published_at"
    )
    .maybeSingle();
  if (res.error || !res.data) {
    throw new Error(
      `eventLog.writeEvent: ${res.error?.message ?? "no row returned"}`
    );
  }
  return coerceStored(res.data);
}

function coerceStored(row: unknown): StoredEvent {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    seq: Number(r.seq),
    event: r.event as string,
    payload_json: (r.payload_json as Record<string, unknown> | null) ?? null,
    merchant_id: (r.merchant_id as string | null) ?? null,
    published_by_app: (r.published_by_app as string | null) ?? null,
    published_at: r.published_at as string
  };
}

export { coerceStored as _coerceStoredEvent };
