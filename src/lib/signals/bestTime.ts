// Best-time-per-(merchant, channel) learning.
//
// Reads the merchant's last 90 days of signals joined with publications.
// Aggregates engagement per hour-of-week (0-167). Returns the top slots
// sorted by average engagement.
//
// This is intentionally simple — no ML, just an empirical mean. The
// publications projection reads this to bias scheduled_for toward
// slots that have historically converted for THIS merchant on THIS
// channel. Merchants who never engage on Sundays get their Sunday
// posts pushed to Monday.
//
// Fails safe: when there's insufficient data (fewer than 20 signals
// on the channel), returns null and the caller falls back to a
// generic 60-min buffer.

import { createClient } from "@supabase/supabase-js";
import type { ChannelId } from "@/lib/llm/composeForChannel";

const MIN_SIGNALS_TO_LEARN = 20;

function client() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export type HourSlot = {
  dayOfWeek: number; // 0 (Sun) .. 6 (Sat)
  hour: number; // 0 .. 23
  score: number;
  sampleCount: number;
};

/** Returns the top 3 slots for the channel, or null if not enough
 *  data. Scores are avg engagement per posted publication that
 *  landed in that hour-of-week bucket. */
export async function bestSlotsFor(
  merchantId: string,
  channel: ChannelId
): Promise<HourSlot[] | null> {
  const c = client();
  if (!c) return null;
  const ninetyDaysAgo = new Date(
    Date.now() - 90 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: rows } = await c
    .from("signals")
    .select("value, observed_at, publication_id, publications!inner(channel, posted_at)")
    .eq("merchant_id", merchantId)
    .gte("observed_at", ninetyDaysAgo)
    .not("publication_id", "is", null);
  if (!rows) return null;

  type Row = {
    value: number | null;
    observed_at: string;
    publication_id: string | null;
    publications:
      | { channel: string; posted_at: string | null }
      | Array<{ channel: string; posted_at: string | null }>
      | null;
  };
  const buckets = new Map<string, { total: number; count: number }>();
  for (const raw of rows as unknown as Row[]) {
    // Supabase returns a joined table as an array (or single object)
    // depending on cardinality; normalise here.
    const pubRaw = raw.publications;
    const pub = Array.isArray(pubRaw) ? pubRaw[0] : pubRaw;
    if (!pub || pub.channel !== channel || !pub.posted_at) continue;
    const posted = new Date(pub.posted_at);
    const key = `${posted.getUTCDay()}:${posted.getUTCHours()}`;
    const val = raw.value ?? 1;
    const cur = buckets.get(key) ?? { total: 0, count: 0 };
    cur.total += val;
    cur.count += 1;
    buckets.set(key, cur);
  }
  const totalSignals = Array.from(buckets.values()).reduce(
    (n, b) => n + b.count,
    0
  );
  if (totalSignals < MIN_SIGNALS_TO_LEARN) return null;

  const slots: HourSlot[] = Array.from(buckets.entries()).map(([k, v]) => {
    const [d, h] = k.split(":").map(Number);
    return {
      dayOfWeek: d,
      hour: h,
      score: v.total / v.count,
      sampleCount: v.count
    };
  });
  slots.sort((a, b) => b.score - a.score);
  return slots.slice(0, 3);
}

/** Given a channel + timestamp basis (usually now), return the next
 *  time that falls into a top slot for this merchant + channel. If we
 *  can't learn yet (insufficient signals), returns the fallback
 *  (basis + 60 min). */
export async function nextBestTime(
  merchantId: string,
  channel: ChannelId,
  basis: Date = new Date(),
  fallbackMinutes = 60
): Promise<Date> {
  const slots = await bestSlotsFor(merchantId, channel);
  if (!slots || slots.length === 0) {
    return new Date(basis.getTime() + fallbackMinutes * 60 * 1000);
  }
  // Search forward hour-by-hour for the first match within 7 days.
  const cursor = new Date(basis.getTime() + fallbackMinutes * 60 * 1000);
  for (let hoursAhead = 0; hoursAhead < 24 * 7; hoursAhead++) {
    const candidate = new Date(cursor.getTime() + hoursAhead * 60 * 60 * 1000);
    const day = candidate.getUTCDay();
    const hour = candidate.getUTCHours();
    if (
      slots.some((s) => s.dayOfWeek === day && s.hour === hour)
    ) {
      return candidate;
    }
  }
  return cursor;
}
