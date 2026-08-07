// Merchant directory search — the read-side over
// hammerex_trade_off_listings. Supports:
//   • trade filter (primary_trade OR contains in secondary_trades[])
//   • area filter (city case-insensitive OR postcode_prefix startsWith)
//   • distance calc when caller supplies lat/lng
//
// No fuzzy full-text search yet — the listings table has plenty of
// exact fields to lean on. When a search relevance model lands we
// swap the matching layer here.

import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type NetworkBusiness } from "./types";
import { findContactsByEmails } from "@/lib/nex/contacts/registry";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";

const MAX_RESULTS = 20;

export type FindBusinessesInput = {
  trade?:          string;            // slug or free-text ("bricklayer" / "roofer")
  city?:           string;
  postcode_prefix?: string;
  /** When set, results include distance_km sorted ascending. */
  origin?:         { lat: number; lng: number };
  limit?:          number;
  /** Exclude these slugs (usually the caller's own listing). */
  exclude_slugs?:  string[];
};

export async function findBusinesses(opts: FindBusinessesInput): Promise<NetworkBusiness[]> {
  const evidence = evidenceFor("hammerex_trade_off_listings", ["hammerex_trade_off_listings"]);

  let q = supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("slug, display_name, trading_name, primary_trade, secondary_trades, city, postcode_prefix, lat, lng, email")
    .limit(opts.limit ?? MAX_RESULTS);

  const trade = opts.trade?.toLowerCase().trim();
  if (trade) {
    // Match primary_trade case-insensitive OR contains in secondary_trades[].
    q = q.or(`primary_trade.ilike.${trade}%,secondary_trades.cs.{${trade}}`);
  }
  if (opts.city) q = q.ilike("city", `%${opts.city}%`);
  if (opts.postcode_prefix) q = q.ilike("postcode_prefix", `${opts.postcode_prefix}%`);

  const rows = await q;
  const rawRows = rows.data ?? [];
  let results: NetworkBusiness[] = rawRows.map((r) => {
    const lat = r.lat as number | null;
    const lng = r.lng as number | null;
    const dist = opts.origin && lat !== null && lng !== null
      ? haversineKm(opts.origin.lat, opts.origin.lng, Number(lat), Number(lng))
      : null;
    return {
      slug:             String(r.slug),
      display_name:     String(r.display_name),
      trading_name:     (r.trading_name as string | null) ?? null,
      primary_trade:    String(r.primary_trade),
      secondary_trades: (r.secondary_trades as string[] | null) ?? [],
      city:             String(r.city),
      postcode_prefix:  (r.postcode_prefix as string | null) ?? null,
      distance_km:      dist,
      evidence
    };
  });

  // Phase 3d.4d · Contact Registry row enrichment.
  // Every returned trade gets `.registry.canonical_contact_id` when the
  // trade's email is in the registry. Batch-lookup keeps this to one
  // extra query regardless of result-set size. Never throws · registry
  // unreachable → registry field stays undefined on every row.
  await attachRegistryToBusinesses(results, rawRows);

  if (opts.exclude_slugs && opts.exclude_slugs.length > 0) {
    const skip = new Set(opts.exclude_slugs);
    results = results.filter((r) => !skip.has(r.slug));
  }

  if (opts.origin) {
    results.sort((a, b) => {
      const ax = a.distance_km ?? Number.POSITIVE_INFINITY;
      const bx = b.distance_km ?? Number.POSITIVE_INFINITY;
      return ax - bx;
    });
  }

  return results;
}

/**
 * Phase 3d.4d · net brain row-enrichment.
 * Zips a canonical registry contact onto every returned NetworkBusiness
 * via the trade's email. One batch registry query · one audit event per
 * findBusinesses call (not per row) so AI adoption metrics reflect the
 * brain call, not the fanout.
 */
async function attachRegistryToBusinesses(results: NetworkBusiness[], rawRows: Array<{ slug: unknown; email?: unknown }>): Promise<void> {
  if (results.length === 0) return;
  const emails = rawRows.map((r) => (r.email as string | null | undefined) ?? undefined);
  let byEmail: Map<string, { contact_id: string; canonical_email: string | null }> = new Map();
  let matchCount = 0;
  try {
    const map = await findContactsByEmails(emails);
    matchCount = map.size;
    byEmail = new Map(Array.from(map.entries()).map(([k, v]) => [k, { contact_id: v.contact_id, canonical_email: v.canonical_email }]));
  } catch {
    // registry unreachable · leave every row un-enriched
  }

  for (let i = 0; i < results.length; i++) {
    const raw = rawRows[i];
    const rawEmail = ((raw?.email as string | null | undefined) ?? "").trim().toLowerCase();
    if (!rawEmail) continue;
    const hit = byEmail.get(rawEmail);
    if (hit) {
      results[i].registry = { canonical_contact_id: hit.contact_id, alias_resolved: false };
    } else {
      results[i].registry = null;
    }
  }

  // Single ai.contact_resolved audit event · caller = nex-brain:net:findBusinesses
  // Powers the AI Adoption dashboard's "brain workers migrated" counter.
  try {
    const store = getStorage();
    await store.save(COLLECTIONS.events, {
      event_id: randomUUID(),
      event_type: "ai.contact_resolved",
      source: "nex-ai-resolver",
      actor_id: null,
      timestamp: new Date().toISOString(),
      business_id: null,
      related_department: "contact-intelligence",
      related_brain: "nex-brain:net:findBusinesses",
      related_job: null,
      related_contact: null,
      outcome: matchCount > 0 ? "ok" : "no_match",
      payload: {
        caller: "nex-brain:net:findBusinesses",
        strategy: "email",
        match_count: matchCount,
        top_confidence: matchCount > 0 ? 99 : null,
        top_contact_id: null,
        registry_resolved: matchCount > 0,
        alias_resolved: false,
        row_count: results.length,
        duration_ms: 0,
        input_signals: { has_email: true },
      },
      reversible: false, reverse_of: null, supersedes: null,
    });
  } catch {
    // never mask the brain's list result
  }
}

/** Great-circle distance in km via Haversine. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}
