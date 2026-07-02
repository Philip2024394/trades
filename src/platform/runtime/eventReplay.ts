// Platform Runtime — event replay.
//
// Reads from platform_events for consumers that missed the in-process
// broadcast (cold starts, cross-request Apps, admin dashboards).
// Ordering is by monotonic `seq`; the caller tracks the last-seen seq
// and passes it back for the next replay call.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { StoredEvent } from "./eventLog";
import { _coerceStoredEvent } from "./eventLog";

const COLS =
  "id, seq, event, payload_json, merchant_id, published_by_app, published_at";
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

export type ReplayOptions = {
  /** Only events with this kind. Omit for all kinds. */
  event?: string;
  /** Scope to a single merchant. Omit for platform-wide. */
  merchantId?: string;
  /** Scope to events an App emitted. Omit for all publishers. */
  publishedByApp?: string;
  /** Return only events with seq > sinceSeq. Omit to start from 0. */
  sinceSeq?: number;
  /** Cap on rows returned. Default 200, hard cap 1000. */
  limit?: number;
};

/** Replay events matching the filter, ordered ascending by seq.
 *
 *  Common usage: a subscriber tracks its cursor client-side and calls
 *  `replayEvents({ sinceSeq: cursor })` on each poll. The returned
 *  array's last element's `seq` becomes the next cursor. */
export async function replayEvents(
  opts: ReplayOptions = {}
): Promise<StoredEvent[]> {
  const limit = Math.max(
    1,
    Math.min(MAX_LIMIT, opts.limit ?? DEFAULT_LIMIT)
  );

  let q = supabaseAdmin
    .from("platform_events")
    .select(COLS)
    .order("seq", { ascending: true })
    .limit(limit);

  if (opts.event) q = q.eq("event", opts.event);
  if (opts.merchantId) q = q.eq("merchant_id", opts.merchantId);
  if (opts.publishedByApp)
    q = q.eq("published_by_app", opts.publishedByApp);
  if (typeof opts.sinceSeq === "number" && opts.sinceSeq >= 0) {
    q = q.gt("seq", opts.sinceSeq);
  }

  const res = await q;
  if (res.error || !res.data) return [];
  return (res.data as unknown[]).map(_coerceStoredEvent);
}

/** The highest seq currently in the log. Useful for consumers
 *  onboarding fresh — they can set their initial cursor to this value
 *  to consume only forward. */
export async function currentEventCursor(): Promise<number> {
  const res = await supabaseAdmin
    .from("platform_events")
    .select("seq")
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (res.error || !res.data) return 0;
  return Number((res.data as { seq: number }).seq);
}
