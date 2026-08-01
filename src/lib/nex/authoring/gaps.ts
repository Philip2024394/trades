// Nex authoring · gap query (Philip 2026-08-01)
// Reads composer-served chat replies from telemetry as "customer questions
// Nex could not answer from her indexed library." Feeds the authoring inbox.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type GapEntry = {
  message:         string;
  count:           number;         // times this message-shape was asked
  first_seen_at:   string;
  last_seen_at:    string;
  sample_conv_id:  string;
};

/** Normalise a customer message for grouping · lowercase + strip punctuation. */
function normalise(msg: string): string {
  return msg.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
}

/**
 * Return the top gap messages by frequency · limited to N.
 * Only counts events where served_by === "composer" (Advisor + Runtime Core
 * both missed).
 */
export async function loadTopGaps(limit = 20, sinceDays = 30): Promise<GapEntry[]> {
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);

  const { data, error } = await supabaseAdmin
    .from("hammerex_nex_events")
    .select("metadata,created_at,entity_id")
    .eq("event_type", "nex_chat_reply")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error || !data) return [];

  const grouped = new Map<string, GapEntry>();
  for (const row of data) {
    const meta = (row as { metadata: Record<string, unknown> }).metadata ?? {};
    const servedBy = String(meta.served_by ?? "composer");
    if (servedBy !== "composer") continue;
    const msg = typeof meta.user_message === "string" ? meta.user_message : "";
    if (!msg || msg.length < 3) continue;
    const key = normalise(msg);
    if (!key) continue;
    const existing = grouped.get(key);
    const createdAt = String((row as { created_at: string }).created_at);
    const convId = String((row as { entity_id: string }).entity_id ?? "");
    if (existing) {
      existing.count += 1;
      if (createdAt > existing.last_seen_at) existing.last_seen_at = createdAt;
      if (createdAt < existing.first_seen_at) existing.first_seen_at = createdAt;
    } else {
      grouped.set(key, {
        message:        msg,
        count:          1,
        first_seen_at:  createdAt,
        last_seen_at:   createdAt,
        sample_conv_id: convId,
      });
    }
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
