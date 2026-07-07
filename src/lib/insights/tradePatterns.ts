// Cross-merchant pattern extraction.
//
// Runs weekly (call from a cron). For each (trade, channel) with a
// meaningful sample size, computes anonymised patterns:
//   - best_time_slots: top 3 hour-of-week buckets by avg engagement
//   - top_caption_length: median caption char count of top-quartile posts
//   - top_material_mentions: most frequent materials cited in top posts
//   - typical_engagement_baseline: median engagement per post
//
// Anonymised — we only ever surface aggregates, never single-merchant
// data.

import { createClient } from "@supabase/supabase-js";
import { upsertInsight } from "./loader";

const MIN_SAMPLE_PER_TRADE_CHANNEL = 30;

function client() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

type PubRow = {
  id: string;
  merchant_id: string;
  channel: string;
  rendered_content: Record<string, unknown>;
  posted_at: string | null;
  event_id: string;
};
type SignalRow = {
  publication_id: string | null;
  signal_type: string;
  value: number | null;
};
type EventRow = {
  id: string;
  event_payload: Record<string, unknown>;
};

export async function computeTradePatterns(): Promise<{
  updated: number;
  detail: string[];
}> {
  const c = client();
  if (!c) return { updated: 0, detail: ["supabase_unavailable"] };
  const since = new Date(
    Date.now() - 90 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: pubs } = await c
    .from("publications")
    .select("id, merchant_id, channel, rendered_content, posted_at, event_id")
    .eq("status", "posted")
    .gte("posted_at", since);
  const publications = (pubs ?? []) as PubRow[];
  if (publications.length === 0) return { updated: 0, detail: ["no_publications"] };

  const pubIds = publications.map((p) => p.id);
  const { data: sigs } = await c
    .from("signals")
    .select("publication_id, signal_type, value")
    .in("publication_id", pubIds);
  const signals = (sigs ?? []) as SignalRow[];
  const engagementByPub = new Map<string, number>();
  for (const s of signals) {
    if (!s.publication_id) continue;
    const w = weightFor(s.signal_type);
    engagementByPub.set(
      s.publication_id,
      (engagementByPub.get(s.publication_id) ?? 0) + (s.value ?? 1) * w
    );
  }

  const eventIds = publications.map((p) => p.event_id);
  const { data: evs } = await c
    .from("business_events")
    .select("id, event_payload")
    .in("id", eventIds);
  const events = new Map(
    ((evs ?? []) as EventRow[]).map((e) => [e.id, e.event_payload])
  );

  // Group publications by (trade, channel).
  const groups = new Map<string, PubRow[]>();
  for (const p of publications) {
    const payload = events.get(p.event_id) ?? {};
    const trade = (payload.trade as string) ?? "";
    if (!trade) continue;
    const key = `${trade}::${p.channel}`;
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }

  const detail: string[] = [];
  let updated = 0;
  for (const [key, pubs] of groups.entries()) {
    if (pubs.length < MIN_SAMPLE_PER_TRADE_CHANNEL) {
      detail.push(`${key} skipped (n=${pubs.length})`);
      continue;
    }
    const [trade, channel] = key.split("::");
    const scored = pubs
      .map((p) => ({
        pub: p,
        engagement: engagementByPub.get(p.id) ?? 0
      }))
      .sort((a, b) => b.engagement - a.engagement);
    const topQuartile = scored.slice(0, Math.max(1, Math.floor(scored.length / 4)));

    // 1) Best time slots.
    const slotBuckets = new Map<string, { total: number; count: number }>();
    for (const s of scored) {
      if (!s.pub.posted_at) continue;
      const d = new Date(s.pub.posted_at);
      const k = `${d.getUTCDay()}:${d.getUTCHours()}`;
      const cur = slotBuckets.get(k) ?? { total: 0, count: 0 };
      cur.total += s.engagement;
      cur.count += 1;
      slotBuckets.set(k, cur);
    }
    const bestSlots = Array.from(slotBuckets.entries())
      .map(([k, v]) => {
        const [day, hour] = k.split(":").map(Number);
        return { dayOfWeek: day, hour, avg: v.total / v.count };
      })
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3);

    await upsertInsight({
      trade,
      channel,
      insightKind: "best_time_slots",
      facets: { slots: bestSlots },
      sampleSize: scored.length,
      validForDays: 14
    });

    // 2) Top caption length band.
    const lengths = topQuartile
      .map((s) => {
        const rc = s.pub.rendered_content;
        const cap = (rc?.caption as string) ?? "";
        return cap.length;
      })
      .filter((n) => n > 0)
      .sort((a, b) => a - b);
    const median = lengths[Math.floor(lengths.length / 2)] ?? 0;
    await upsertInsight({
      trade,
      channel,
      insightKind: "top_caption_length",
      facets: {
        median_chars: median,
        range: [lengths[0] ?? 0, lengths[lengths.length - 1] ?? 0]
      },
      sampleSize: topQuartile.length,
      validForDays: 14
    });

    // 3) Top material mentions.
    const materialCounts = new Map<string, number>();
    for (const s of topQuartile) {
      const payload = events.get(s.pub.event_id) ?? {};
      const mats = (payload.materials as string[]) ?? [];
      for (const m of mats) {
        materialCounts.set(m, (materialCounts.get(m) ?? 0) + 1);
      }
    }
    const topMats = Array.from(materialCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([m, n]) => ({ material: m, count: n }));
    await upsertInsight({
      trade,
      channel,
      insightKind: "top_material_mentions",
      facets: { materials: topMats },
      sampleSize: topQuartile.length,
      validForDays: 14
    });

    // 4) Baseline engagement.
    const median_eng =
      scored[Math.floor(scored.length / 2)]?.engagement ?? 0;
    await upsertInsight({
      trade,
      channel,
      insightKind: "typical_engagement_baseline",
      facets: {
        median: median_eng,
        top_quartile_min: topQuartile[topQuartile.length - 1]?.engagement ?? 0
      },
      sampleSize: scored.length,
      validForDays: 14
    });

    updated += 4;
    detail.push(`${key} updated (n=${scored.length})`);
  }
  return { updated, detail };
}

function weightFor(signalType: string): number {
  switch (signalType) {
    case "booking":
      return 100;
    case "call":
    case "whatsapp_tap":
    case "lead_form_submit":
      return 50;
    case "click_through":
      return 5;
    case "save":
      return 3;
    case "share":
      return 4;
    case "comment":
      return 2;
    case "like":
    default:
      return 1;
  }
}
