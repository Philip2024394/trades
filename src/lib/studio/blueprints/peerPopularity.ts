// Peer popularity signal for the recommender.
//
// Reads studio_blueprint_installs, counts installs in the last 30 days
// per blueprint_id, returns a normalised {0..1} score by blueprint slug.
//
// Normalisation is per-run: score = installs / maxInstalls. If nobody
// has installed anything the map is empty and the recommender's
// peer-popularity term contributes 0 across the board.
//
// Cached in-memory for 60 seconds so the browser query doesn't hammer
// the DB on every card fetch.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

let cache: { map: Map<string, number>; expires: number } | null = null;
const TTL_MS = 60_000;

export async function peerPopularityByBlueprint(): Promise<Map<string, number>> {
  if (cache && cache.expires > Date.now()) return cache.map;

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const res = await supabaseAdmin
    .from("studio_blueprint_installs")
    .select("blueprint_id")
    .gte("installed_at", since)
    .is("uninstalled_at", null);

  const map = new Map<string, number>();
  if (res.error || !res.data) {
    cache = { map, expires: Date.now() + TTL_MS };
    return map;
  }
  const counts = new Map<string, number>();
  for (const row of res.data as { blueprint_id: string }[]) {
    counts.set(row.blueprint_id, (counts.get(row.blueprint_id) ?? 0) + 1);
  }
  let max = 0;
  for (const v of counts.values()) if (v > max) max = v;
  if (max === 0) {
    cache = { map, expires: Date.now() + TTL_MS };
    return map;
  }
  for (const [slug, count] of counts.entries()) {
    map.set(slug, count / max);
  }
  cache = { map, expires: Date.now() + TTL_MS };
  return map;
}
