// src/lib/nex/live-chat-completion/truth-engine/truth-engine.ts
//
// Founder BEGIN Phase 3.2 · Truth Engine.
//
// Wraps a computed fact + its provenance and answers three questions:
//   1. Is this fact stale? (per intent's freshness class TTL)
//   2. Do multiple sources disagree? (conflict detection)
//   3. What trust band should we honestly render at?
//
// Zero LLM. Pure function over the fact + its provenance rows.
// Never picks a random side of a conflict — surfaces "conflicting" so
// the composer can honestly say "sources disagree on this".
//
// Downstream:
//   - Composer reads TruthVerdict and prefixes / gates the reply.
//   - When a NEW conflict is detected, we UPSERT nex.fact_conflict.

import type { Pool } from "pg";
import type { StructuredFact, TrustLayer } from "@/lib/nex/intelligence-storage-grid/accommodation/fact-computer";
import type { FieldProvenanceRow } from "@/lib/nex/intelligence-storage-grid/accommodation/adapter-postgres";
import { getIntentFreshness, isFactFresh, type FreshnessClass } from "@/lib/nex/intelligence-storage-grid/accommodation/intent-registry";

export type FactStatus =
  | "unknown"       // no value at all
  | "observed"      // value seen but not verified
  | "verified"      // canonical + verified provenance
  | "stale"         // was verified but TTL expired
  | "conflicting"   // ≥2 sources disagree
  | "resolved";     // conflict was manually resolved

export interface TruthVerdict {
  status: FactStatus;
  effective_trust: TrustLayer | "conflicting";
  freshness_class: FreshnessClass;
  is_stale: boolean;
  is_conflicting: boolean;
  verified_age_ms: number | null;
  ttl_ms: number;
  conflicting_values?: readonly {
    value: unknown;
    source_reference: string | null;
    trust_layer: string;
    written_at: string;
  }[];
  reasoning: readonly string[];
}

/**
 * Given a fact + its provenance rows + the intent slug, decide:
 *   - is the fact stale?
 *   - do sources disagree?
 *   - what status to render at?
 */
export function evaluateTruth(input: {
  fact: StructuredFact;
  provenance: readonly FieldProvenanceRow[];
  intent_slug: string;
}): TruthVerdict {
  const { fact, provenance, intent_slug } = input;
  const freshness_class = getIntentFreshness(intent_slug);
  const ttl_ms = ttlForClass(freshness_class);
  const reasoning: string[] = [];

  // ── 1. Unknown fact ────────────────────────────────────────────────
  if (fact.unknown || fact.value === null || fact.value === undefined) {
    reasoning.push(`fact is unknown for intent=${intent_slug}`);
    return {
      status: "unknown",
      effective_trust: fact.trust,
      freshness_class,
      is_stale: false,
      is_conflicting: false,
      verified_age_ms: null,
      ttl_ms,
      reasoning,
    };
  }

  // ── 2. Conflict detection over provenance ─────────────────────────
  const relevantProv = provenance.filter((p) => p.field_name === intent_slug || p.field_name.startsWith(intent_slug + ":"));
  const distinctValues = new Map<string, { row: FieldProvenanceRow; count: number }>();
  for (const p of relevantProv) {
    const key = String((p as unknown as { value?: unknown }).value ?? "").trim().toLowerCase();
    if (!key) continue;
    const hit = distinctValues.get(key);
    if (hit) hit.count += 1;
    else distinctValues.set(key, { row: p, count: 1 });
  }
  const is_conflicting = distinctValues.size >= 2;

  // ── 3. Freshness · newest provenance row wins ─────────────────────
  const newestProv = relevantProv.reduce<FieldProvenanceRow | null>((acc, p) => {
    if (!acc) return p;
    return new Date(p.written_at) > new Date(acc.written_at) ? p : acc;
  }, null);
  const verified_age_ms = newestProv
    ? Date.now() - new Date(newestProv.written_at).getTime()
    : null;
  const is_stale = newestProv ? !isFactFresh(intent_slug, newestProv.written_at) : false;

  // ── 4. Decide status + effective trust ────────────────────────────
  let status: FactStatus = "verified";
  let effective_trust: TrustLayer | "conflicting" = fact.trust;

  if (is_conflicting) {
    status = "conflicting";
    effective_trust = "conflicting";
    reasoning.push(`conflict · ${distinctValues.size} distinct values across ${relevantProv.length} provenance rows`);
  } else if (is_stale) {
    status = "stale";
    // stale demotes trust one step
    effective_trust = demoteTrust(fact.trust);
    reasoning.push(`stale · newest source ${Math.round((verified_age_ms ?? 0) / (24 * 3600 * 1000))} days old · ttl ${Math.round(ttl_ms / (24 * 3600 * 1000))} days`);
  } else if (fact.trust === "unknown") {
    status = "observed";
    reasoning.push("observed but not verified");
  } else {
    reasoning.push(`verified · trust=${fact.trust} · freshness=${freshness_class}`);
  }

  return {
    status,
    effective_trust,
    freshness_class,
    is_stale,
    is_conflicting,
    verified_age_ms,
    ttl_ms,
    conflicting_values: is_conflicting
      ? Array.from(distinctValues.values()).map((v) => ({
          value: (v.row as unknown as { value?: unknown }).value ?? null,
          source_reference: (v.row.source_reference as string | null) ?? null,
          trust_layer: v.row.trust_layer,
          written_at: v.row.written_at instanceof Date ? v.row.written_at.toISOString() : String(v.row.written_at),
        }))
      : undefined,
    reasoning,
  };
}

function ttlForClass(cls: FreshnessClass): number {
  const map: Record<FreshnessClass, number> = {
    stable:      365 * 24 * 3600 * 1000,
    semi_stable: 180 * 24 * 3600 * 1000,
    changeable:   30 * 24 * 3600 * 1000,
    volatile:      3 * 24 * 3600 * 1000,
    live:              3600 * 1000,
  };
  return map[cls];
}

function demoteTrust(t: TrustLayer): TrustLayer {
  switch (t) {
    case "canonical_verified":  return "canonical_unverified";
    case "evidence_verified":   return "evidence_provisional";
    case "canonical_unverified": return "canonical_unverified";
    case "evidence_provisional": return "evidence_provisional";
    case "unknown":             return "unknown";
  }
}

// ═══════════════════════════════════════════════════════════════════
// Conflict persistence · UPSERTs into nex.fact_conflict.
// Called async / best-effort from adapters when a conflict is seen.
// ═══════════════════════════════════════════════════════════════════

export async function recordConflict(
  kfPool: Pool,
  input: {
    domain: string;
    entity_ref: string;
    intent_slug: string;
    conflicting_values: TruthVerdict["conflicting_values"];
  },
): Promise<{ conflict_id: string; created: boolean }> {
  const res = await kfPool.query(
    `INSERT INTO nex.fact_conflict
       (domain, entity_ref, intent_slug, conflicting_values, seen_count)
     VALUES ($1, $2, $3, $4::jsonb, 1)
     ON CONFLICT (domain, entity_ref, intent_slug) DO UPDATE SET
       conflicting_values = EXCLUDED.conflicting_values,
       last_seen_at = now(),
       seen_count = nex.fact_conflict.seen_count + 1
     RETURNING conflict_id::text AS conflict_id, (xmax = 0) AS was_insert`,
    [input.domain, input.entity_ref, input.intent_slug, JSON.stringify(input.conflicting_values ?? [])],
  );
  const row = res.rows[0];
  return { conflict_id: String(row.conflict_id), created: Boolean(row.was_insert) };
}
