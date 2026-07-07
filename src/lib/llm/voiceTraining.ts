// Voice training — feeds the merchant's OWN top-performing captions
// into the composer prompt so future posts sound more like them over
// time.
//
// The signals table already knows which publications got engagement.
// We rank the merchant's last 90 days of posted publications by
// engagement (like + comment + share weighted equally for MVP),
// take the top 3 captions per channel, and return them as example
// snippets the LLM composer can mimic.
//
// Fails safe: when there's no history, returns [] and the composer
// uses its generic system prompt.

import { createClient } from "@supabase/supabase-js";
import type { ChannelId } from "./composeForChannel";

const TOP_N = 3;
const LOOKBACK_DAYS = 90;

function client() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export type VoiceExample = {
  publicationId: string;
  channel: ChannelId;
  caption: string;
  engagement: number;
};

/** Return the merchant's top N captions on a channel, ordered by
 *  observed engagement. Empty list = fall back to generic voice. */
export async function topPerformingCaptions(
  merchantId: string,
  channel: ChannelId
): Promise<VoiceExample[]> {
  const c = client();
  if (!c) return [];
  const since = new Date(
    Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: pubs } = await c
    .from("publications")
    .select("id, rendered_content, posted_at")
    .eq("merchant_id", merchantId)
    .eq("channel", channel)
    .eq("status", "posted")
    .gte("posted_at", since);
  if (!pubs || pubs.length === 0) return [];

  const pubIds = pubs.map((p) => (p as { id: string }).id);
  const { data: sigs } = await c
    .from("signals")
    .select("publication_id, signal_type, value")
    .in("publication_id", pubIds);

  // Aggregate engagement per pub.
  const engagementByPub = new Map<string, number>();
  for (const s of sigs ?? []) {
    const row = s as {
      publication_id: string | null;
      signal_type: string;
      value: number | null;
    };
    if (!row.publication_id) continue;
    const weight = weightFor(row.signal_type);
    const prev = engagementByPub.get(row.publication_id) ?? 0;
    engagementByPub.set(row.publication_id, prev + (row.value ?? 1) * weight);
  }

  const scored: VoiceExample[] = [];
  for (const p of pubs) {
    const row = p as {
      id: string;
      rendered_content: Record<string, unknown> | null;
    };
    const rc = row.rendered_content ?? {};
    const caption = (rc.caption as string) ?? "";
    if (!caption) continue;
    scored.push({
      publicationId: row.id,
      channel,
      caption,
      engagement: engagementByPub.get(row.id) ?? 0
    });
  }
  scored.sort((a, b) => b.engagement - a.engagement);
  // Only return examples with SOME engagement — a zero-engagement
  // post is a bad model even if it's the "best" one available.
  return scored.filter((s) => s.engagement > 0).slice(0, TOP_N);
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
