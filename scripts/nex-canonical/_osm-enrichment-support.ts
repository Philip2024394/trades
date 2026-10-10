// scripts/nex-canonical/_osm-enrichment-support.ts
//
// NEX Canonical · OSM re-probe enrichment support (pure helpers).
//
// These helpers are consumed by scripts/nex-canonical/_canonical-osm-enrichment.mjs
// and are kept pure/testable. All HTTP calls happen in the runner via the
// sealed Overpass adapter obtained from `resolveProductionHarvestAdapters`.
//
// Scope:
//   · parseOsmRef              — parse `node/<id>` / `way/<id>` / `relation/<id>` strings
//   · buildBatchOverpassQuery  — one Overpass QL that fetches tags for N refs at once
//   · extractEnrichmentFields  — pure merge of OSM tags into a canonical row,
//                                strictly only-if-existing-null
//   · buildUpdateSql           — parameterised UPDATE for business_canonical
//   · buildEvidenceInsertSql   — parameterised INSERT for business_evidence
//
// Governance hard-locks:
//   · Zero fabrication · all enriched values come from an OSM tag
//   · Never overwrite non-null existing values on business_canonical
//   · All DB writes expressed as parameterised SQL · no interpolation
//   · Deterministic candidate_integrity_hash / decision_record_id / review_package_id
//     derived from (canonical_business_id, osm_ref, run_id) so idempotent retries
//     produce the same ids and insertion is observationally stable.

import { createHash } from "node:crypto";

export type OsmKind = "node" | "way" | "relation";

export interface OsmRef {
  readonly kind: OsmKind;
  readonly id: number;
}

// ─── parseOsmRef ────────────────────────────────────────────────────
export function parseOsmRef(osmId: string | null | undefined): OsmRef | null {
  if (!osmId || typeof osmId !== "string") return null;
  const m = osmId.trim().match(/^(node|way|relation)\/(\d+)$/);
  if (!m) return null;
  const id = Number.parseInt(m[2], 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return { kind: m[1] as OsmKind, id };
}

// ─── buildBatchOverpassQuery ────────────────────────────────────────
// Max 100 refs per query (chosen for stable timeout headroom · the sealed
// adapter's own per-host max_bytes applies independently).
export const MAX_REFS_PER_QUERY = 100;

export function buildBatchOverpassQuery(refs: readonly OsmRef[]): string {
  if (refs.length === 0) {
    throw new Error("buildBatchOverpassQuery: refs must be non-empty");
  }
  if (refs.length > MAX_REFS_PER_QUERY) {
    throw new Error(
      `buildBatchOverpassQuery: cap is ${MAX_REFS_PER_QUERY} refs/query; got ${refs.length}`,
    );
  }
  const buckets: Record<OsmKind, number[]> = { node: [], way: [], relation: [] };
  for (const r of refs) buckets[r.kind].push(r.id);
  const parts: string[] = [];
  for (const kind of ["node", "way", "relation"] as const) {
    if (buckets[kind].length === 0) continue;
    parts.push(`${kind}(id:${buckets[kind].join(",")});`);
  }
  return `[out:json][timeout:60];(${parts.join("")});out tags;`;
}

// ─── extractEnrichmentFields ────────────────────────────────────────
export interface CanonicalExisting {
  readonly phone_e164: string | null;
  readonly website_apex: string | null;
  readonly address: unknown | null; // jsonb
  readonly services_products: Record<string, unknown> | null;
}

export interface CanonicalUpdate {
  phone_e164?: string;
  website_apex?: string;
  address?: Record<string, string>;
  services_products?: Record<string, unknown>;
}

export interface EnrichmentResult {
  readonly updates: CanonicalUpdate;
  readonly evidence_fields_new: readonly string[];
}

/**
 * Produces field updates for a canonical row from OSM tags. Only emits an
 * update when the existing value is null AND the OSM tag is non-null.
 * Never fabricates. Never overwrites stronger existing data.
 *
 * phone_e164: honours CHECK ck_bc_phone_e164 `^\+[1-9][0-9]{6,14}$`. If the
 * OSM phone cannot be normalised to that format (and no other field clearly
 * tells us the country code), the update is skipped — null stays null.
 */
export function extractEnrichmentFields(
  tags: Readonly<Record<string, string>>,
  existing: CanonicalExisting,
): EnrichmentResult {
  const updates: CanonicalUpdate = {};
  const fields: string[] = [];

  // phone
  if (existing.phone_e164 == null) {
    const rawPhone = tags.phone ?? tags["contact:phone"] ?? tags["contact:mobile"] ?? null;
    const e164 = normaliseToE164(rawPhone);
    if (e164) {
      updates.phone_e164 = e164;
      fields.push("phone_e164");
    }
  }

  // website_apex
  if (existing.website_apex == null) {
    const rawWebsite = tags.website ?? tags["contact:website"] ?? null;
    const apex = canonicaliseWebsitePure(rawWebsite);
    if (apex) {
      updates.website_apex = apex;
      fields.push("website_apex");
    }
  }

  // address jsonb
  if (existing.address == null) {
    const addr: Record<string, string> = {};
    const h = tags["addr:housenumber"];
    const s = tags["addr:street"];
    const c = tags["addr:city"];
    const p = tags["addr:postcode"];
    if (typeof h === "string" && h.trim().length > 0) addr.housenumber = h.trim();
    if (typeof s === "string" && s.trim().length > 0) addr.street = s.trim();
    if (typeof c === "string" && c.trim().length > 0) addr.city = c.trim();
    if (typeof p === "string" && p.trim().length > 0) addr.postcode = p.trim();
    if (Object.keys(addr).length > 0) {
      updates.address = addr;
      fields.push("address");
    }
  }

  // services_products jsonb · only write if ≥1 OSM key non-null
  const cuisine = tags.cuisine ?? null;
  const opening_hours = tags.opening_hours ?? null;
  const wikidata = tags.wikidata ?? null;
  const hasSp =
    (cuisine && cuisine.length > 0) ||
    (opening_hours && opening_hours.length > 0) ||
    (wikidata && wikidata.length > 0);
  if (hasSp) {
    // Preserve any existing services_products keys; only ADD osm-derived keys
    // when they are currently absent/empty. Never overwrite.
    const existingSp = (existing.services_products ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...existingSp };
    let changed = false;
    if (cuisine && merged.cuisine == null) {
      merged.cuisine = cuisine;
      changed = true;
    }
    if (opening_hours && merged.opening_hours == null) {
      merged.opening_hours = opening_hours;
      changed = true;
    }
    if (wikidata && merged.wikidata == null) {
      merged.wikidata = wikidata;
      changed = true;
    }
    if (changed) {
      merged.osm_tags_at = new Date().toISOString();
      updates.services_products = merged;
      fields.push("services_products");
    }
  }

  return { updates, evidence_fields_new: fields };
}

// ─── Internal pure helpers ──────────────────────────────────────────

/** Mirror of sealed canonicaliseWebsite(). Kept local so this module stays
 *  pure (no TS-path import from sealed harvest). Behaviour matches:
 *  strips protocol / www. / trailing slash · lowercases · requires a dot. */
export function canonicaliseWebsitePure(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  let s = url.trim();
  if (s.length === 0) return null;
  s = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "").toLowerCase();
  if (s.length === 0 || !s.includes(".")) return null;
  // Reject anything with spaces or that doesn't look host-shaped
  if (/\s/.test(s)) return null;
  return s;
}

/**
 * Attempt to normalise an OSM phone string to E.164 (`^\+[1-9][0-9]{6,14}$`).
 * Returns null when the input can't be unambiguously normalised. The DB CHECK
 * will reject anything else, so we skip rather than fabricate.
 *
 * Accepted inputs:
 *   · already-E164 like `+6281234567890`
 *   · OSM-style `+62 812-3456-7890` with separators (spaces, dashes, parens)
 *     — we strip separators and keep the leading `+`.
 *
 * Rejected (returns null):
 *   · multiple numbers separated by `;` or `,` (ambiguous)
 *   · bare local numbers without country code
 *   · ext.-style suffixes we can't safely drop
 */
export function normaliseToE164(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (s.length === 0) return null;
  // Ambiguous · multiple numbers
  if (/[;,]/.test(s)) return null;
  // Must start with +
  if (!s.startsWith("+")) return null;
  // Strip common separators
  const digitsOnly = "+" + s.slice(1).replace(/[\s\-().]/g, "");
  if (!/^\+[1-9][0-9]{6,14}$/.test(digitsOnly)) return null;
  return digitsOnly;
}

// ─── buildUpdateSql ─────────────────────────────────────────────────
export interface BuiltSql {
  readonly sql: string;
  readonly params: readonly unknown[];
}

export function buildUpdateSql(
  update: CanonicalUpdate,
  canonical_business_id: string,
): BuiltSql | null {
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (update.phone_e164 !== undefined) {
    fields.push(`phone_e164 = $${i++}`);
    params.push(update.phone_e164);
  }
  if (update.website_apex !== undefined) {
    fields.push(`website_apex = $${i++}`);
    params.push(update.website_apex);
  }
  if (update.address !== undefined) {
    fields.push(`address = $${i++}::jsonb`);
    params.push(JSON.stringify(update.address));
  }
  if (update.services_products !== undefined) {
    fields.push(`services_products = $${i++}::jsonb`);
    params.push(JSON.stringify(update.services_products));
  }

  if (fields.length === 0) return null;

  // When ≥1 identity field changed, bump updated_at + last_verified_at.
  fields.push(`updated_at = now()`);
  fields.push(`last_verified_at = now()`);

  const sql =
    `UPDATE nex.business_canonical SET ${fields.join(", ")} ` +
    `WHERE canonical_business_id = $${i}`;
  params.push(canonical_business_id);

  return { sql, params };
}

// ─── buildEvidenceInsertSql ─────────────────────────────────────────
export interface EvidenceInsertArgs {
  readonly canonical_business_id: string;
  readonly osm_ref: string; // "node/123"
  readonly fields_new: readonly string[];
  readonly run_id: string;
  /** Founder id present when running under founder authority. */
  readonly founder_id: string;
  /** ISO timestamp from the run; defaults to now() SQL-side if omitted. */
  readonly observation_generated_at?: string;
}

/**
 * Deterministic sha256 of the (osm_ref, run_id, canonical_business_id, salt).
 * Used for candidate_integrity_hash / decision_record_id / review_package_id,
 * each with a distinct salt so they are distinct 64-char hex strings as
 * required by the sealed CHECK regexes.
 */
export function sha256Hex(parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("")).digest("hex");
}

export function buildEvidenceInsertSql(args: EvidenceInsertArgs): BuiltSql {
  const candidate_id = `cand-osm-enrich-${sha256Hex([args.osm_ref, args.run_id]).slice(0, 16)}`;
  const integrity_hash = sha256Hex([
    "integrity",
    args.canonical_business_id,
    args.osm_ref,
    args.run_id,
    args.fields_new.join(","),
  ]);
  const decision_record_id = sha256Hex([
    "decision",
    args.canonical_business_id,
    args.osm_ref,
    args.run_id,
  ]);
  const review_package_id = sha256Hex([
    "review",
    args.canonical_business_id,
    args.osm_ref,
    args.run_id,
  ]);

  const sql = `
    INSERT INTO nex.business_evidence (
      canonical_business_id,
      schema_version,
      candidate_id,
      candidate_integrity_hash,
      decision_record_id,
      review_package_id,
      legacy_source_table,
      legacy_source_ref,
      resolver_verdict_kind,
      resolver_target_id,
      resolver_score,
      observation_generator,
      observation_run_id,
      observation_generated_at,
      observation_decision_timestamp,
      observation_founder_id,
      source_id
    ) VALUES (
      $1, 'evidence-v1', $2, $3, $4, $5,
      'nex.food_business', $6,
      'MATCH', $1, 1.0,
      'canonical-osm-enrichment-v1', $7, $8, $8, $9,
      'nex_food_business_legacy'
    )
  `;
  const generatedAt = args.observation_generated_at ?? new Date().toISOString();
  const params: unknown[] = [
    args.canonical_business_id,
    candidate_id,
    integrity_hash,
    decision_record_id,
    review_package_id,
    args.osm_ref,
    args.run_id,
    generatedAt,
    args.founder_id,
  ];
  return { sql, params };
}

// ─── Structural boundary markers ────────────────────────────────────
export const _OSM_ENRICHMENT_NEVER_OVERWRITES_EXISTING =
  "extractEnrichmentFields_only_fills_null_fields_never_touches_non_null_existing_values";
export const _OSM_ENRICHMENT_NEVER_FABRICATES_PHONE =
  "normaliseToE164_returns_null_when_input_cannot_be_normalised_never_guesses_country_code";
export const _OSM_ENRICHMENT_UPDATE_BUMPS_VERIFIED_AT =
  "buildUpdateSql_sets_last_verified_at_only_when_at_least_one_identity_field_changes";
