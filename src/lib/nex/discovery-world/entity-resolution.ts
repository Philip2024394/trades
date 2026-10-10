// src/lib/nex/discovery-world/entity-resolution.ts
//
// NEX World Email Intelligence · Part 3 · Entity resolution primitives
// Founder-authorised programme · bounded wave 2026-09-21.
//
// DETERMINISTIC · EVIDENCE-BASED · NEVER FABRICATES.
//
// A search result is NOT a company. This module records candidate entities
// only when structural evidence exists (canonical domain, phone, address,
// postcode, repeated cross-source citation) and only marks them as
// resolved when independent evidence corroborates the identity.
//
// 5-state lifecycle (Part 3 mandate):
//   unresolved         · barely enough signal to remember
//   candidate_entity   · consistent evidence · not yet corroborated
//   resolved_entity    · ≥2 independent evidence sources OR canonical domain match
//   ambiguous_entity   · two rows collide · human review needed
//   rejected_entity    · Founder-explicit rejection · never re-resolved silently

import type { PoolClient } from "pg";

// ─── Types ──────────────────────────────────────────────────────────
export type EntityState =
  | "unresolved"
  | "candidate_entity"
  | "resolved_entity"
  | "ambiguous_entity"
  | "rejected_entity";

export interface EntityRow {
  readonly entity_id: string;
  readonly programme_id: string;
  readonly iso_alpha_2: string;
  readonly business_name: string;
  readonly business_name_norm: string;
  readonly trading_name: string | null;
  readonly canonical_website: string | null;
  readonly phone_norm: string | null;
  readonly address_line: string | null;
  readonly city: string | null;
  readonly region: string | null;
  readonly postcode: string | null;
  readonly state: EntityState;
  readonly state_reason: string | null;
  readonly category: string | null;
  readonly services: ReadonlyArray<string>;
  readonly discovery_terms: ReadonlyArray<string>;
  readonly source_urls: ReadonlyArray<string>;
  readonly evidence_count: number;
  readonly confidence: number;
  readonly first_seen_at: string;
  readonly last_seen_at: string;
  readonly first_cycle_id: string | null;
  readonly last_cycle_id: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface EntityObservation {
  readonly programme_id: string;
  readonly iso: string;
  readonly business_name: string;
  readonly trading_name?: string;
  readonly website_url?: string;
  readonly phone?: string;
  readonly address_line?: string;
  readonly city?: string;
  readonly region?: string;
  readonly postcode?: string;
  readonly category?: string;
  readonly services?: ReadonlyArray<string>;
  readonly discovery_term: string;
  readonly source_url: string;
  readonly source_kind: string;               // 'website' | 'directory' | 'listing' | 'search_result' | 'osm_element'
  readonly cycle_id?: string;
}

// ─── Identity normalisers (pure · deterministic) ───────────────────
/** Normalise a business name to a stable identity key.
 *  Lowercase · strip punctuation · collapse whitespace · drop common
 *  legal-form suffixes. Deliberately conservative: never removes signal
 *  that could distinguish two genuinely different companies. */
export function normalizeBusinessName(input: string): string {
  if (!input) return "";
  let s = String(input).toLowerCase();
  s = s.replace(/[.,'"()\-\/&]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/\b(ltd|limited|llc|inc|incorporated|plc|gmbh|srl|s\.a\.|pty|corp|corporation|co)\b/g, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** Canonicalise a URL to its apex domain-form (protocol lowered · trailing
 *  slash removed · no path). Returns null on invalid input · never guesses. */
export function canonicalWebsite(url: string | null | undefined): string | null {
  if (!url) return null;
  const raw = String(url).trim();
  if (!/^https?:\/\//i.test(raw) && !/^www\./i.test(raw) && !/\./.test(raw)) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;
    const u = new URL(withProtocol);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (!/\./.test(host)) return null;
    return host;
  } catch { return null; }
}

/** Canonical phone: strip non-digits · preserve leading + · reject <6 digits. */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const raw = String(phone).trim();
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 6) return null;
  return hasPlus ? `+${digits}` : digits;
}

// ─── Deterministic matcher ─────────────────────────────────────────
/** Compute a similarity score in [0,1] between two entity observations.
 *  Uses ONLY the fields present in both. Empty ↔ empty is never a match. */
export function matchScore(a: EntityObservation, b: EntityObservation): { score: number; signals: ReadonlyArray<string> } {
  const signals: string[] = [];
  let total = 0;
  let matched = 0;

  const aWeb = canonicalWebsite(a.website_url), bWeb = canonicalWebsite(b.website_url);
  if (aWeb && bWeb) {
    total += 3;
    if (aWeb === bWeb) { matched += 3; signals.push("website_exact"); }
  }
  const aPhone = normalizePhone(a.phone), bPhone = normalizePhone(b.phone);
  if (aPhone && bPhone) {
    total += 2;
    if (aPhone === bPhone) { matched += 2; signals.push("phone_exact"); }
  }
  const aName = normalizeBusinessName(a.business_name), bName = normalizeBusinessName(b.business_name);
  if (aName && bName) {
    total += 2;
    if (aName === bName) { matched += 2; signals.push("name_exact"); }
    else if (aName.length > 4 && bName.length > 4 && (aName.includes(bName) || bName.includes(aName))) {
      matched += 1; signals.push("name_containment");
    }
  }
  if (a.postcode && b.postcode) {
    total += 1;
    if (String(a.postcode).replace(/\s+/g, "").toLowerCase() === String(b.postcode).replace(/\s+/g, "").toLowerCase()) {
      matched += 1; signals.push("postcode_exact");
    }
  }
  if (a.iso && b.iso) {
    total += 1;
    if (a.iso.toUpperCase() === b.iso.toUpperCase()) { matched += 1; signals.push("country_exact"); }
  }
  const score = total === 0 ? 0 : matched / total;
  return { score, signals };
}

// ─── Persist / accumulate ──────────────────────────────────────────
export interface RecordEntityOutcome {
  readonly kind: "created_candidate" | "evidence_appended" | "promoted_resolved" | "flagged_ambiguous" | "skipped_rejected";
  readonly entity: EntityRow;
}

/** Observe an entity from a real discovery cycle. Records evidence · updates
 *  state deterministically · never fabricates identity. Idempotent by
 *  (programme_id, iso_alpha_2, business_name_norm, canonical_website). */
export async function recordEntityObservation(
  client: PoolClient,
  obs: EntityObservation,
): Promise<RecordEntityOutcome> {
  const business_name_norm = normalizeBusinessName(obs.business_name);
  const canonical = canonicalWebsite(obs.website_url ?? null);
  const phone = normalizePhone(obs.phone ?? null);

  if (!business_name_norm) {
    throw new Error("recordEntityObservation: business_name is required and must yield a non-empty normalised form");
  }

  // Look up any existing row that shares (programme, country, normName, canonicalWebsite)
  const existing = await client.query(
    `SELECT * FROM nex.discovery_entity
      WHERE programme_id = $1
        AND iso_alpha_2 = $2
        AND business_name_norm = $3
        AND (canonical_website = $4 OR (canonical_website IS NULL AND $4::text IS NULL))
      LIMIT 1`,
    [obs.programme_id, obs.iso.toUpperCase(), business_name_norm, canonical],
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    if (row.state === "rejected_entity") {
      // Founder-explicit rejection is durable. Never silently re-resolve.
      return { kind: "skipped_rejected", entity: rowToEntity(row) };
    }
    const nextEvidence = row.evidence_count + 1;
    // Promotion rule: candidate → resolved when
    //   (a) evidence_count ≥ 2 AND canonical_website present, OR
    //   (b) evidence_count ≥ 3 without canonical_website
    let nextState: EntityState = row.state as EntityState;
    let stateReason: string | null = row.state_reason;
    if (row.state === "candidate_entity") {
      if (canonical && nextEvidence >= 2) { nextState = "resolved_entity"; stateReason = "≥2 evidences with canonical website"; }
      else if (!canonical && nextEvidence >= 3) { nextState = "resolved_entity"; stateReason = "≥3 evidences without canonical website"; }
    }
    const nextConfidence = Math.min(1, nextEvidence / 5);
    const upd = await client.query(
      `UPDATE nex.discovery_entity
          SET last_seen_at    = now(),
              last_cycle_id   = COALESCE($1, last_cycle_id),
              evidence_count  = $2,
              confidence      = $3,
              source_urls     = ARRAY(SELECT DISTINCT unnest(source_urls || $4::text[])),
              discovery_terms = ARRAY(SELECT DISTINCT unnest(discovery_terms || $5::text[])),
              services        = ARRAY(SELECT DISTINCT unnest(services || $6::text[])),
              category        = COALESCE($7, category),
              phone_norm      = COALESCE(phone_norm, $8),
              address_line    = COALESCE(address_line, $9),
              city            = COALESCE(city, $10),
              region          = COALESCE(region, $11),
              postcode        = COALESCE(postcode, $12),
              state           = $13,
              state_reason    = $14
        WHERE entity_id = $15
      RETURNING *`,
      [
        obs.cycle_id ?? null, nextEvidence, nextConfidence,
        [obs.source_url], [obs.discovery_term], obs.services ? Array.from(obs.services) : [],
        obs.category ?? null, phone, obs.address_line ?? null, obs.city ?? null, obs.region ?? null, obs.postcode ?? null,
        nextState, stateReason, row.entity_id,
      ],
    );
    // Also record the source URL row
    await client.query(
      `INSERT INTO nex.discovery_entity_source (entity_id, source_url, source_kind, cycle_id)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [row.entity_id, obs.source_url, obs.source_kind, obs.cycle_id ?? null],
    );
    return {
      kind: nextState === "resolved_entity" && row.state === "candidate_entity" ? "promoted_resolved" : "evidence_appended",
      entity: rowToEntity(upd.rows[0]),
    };
  }

  // No exact match · check for potential ambiguity with an existing entity
  // in the same programme/country whose canonical_website OR phone matches.
  if (canonical || phone) {
    const ambig = await client.query(
      `SELECT entity_id, business_name FROM nex.discovery_entity
        WHERE programme_id = $1 AND iso_alpha_2 = $2
          AND ((canonical_website IS NOT NULL AND canonical_website = $3)
            OR (phone_norm         IS NOT NULL AND phone_norm         = $4))
          AND business_name_norm <> $5
        LIMIT 1`,
      [obs.programme_id, obs.iso.toUpperCase(), canonical, phone, business_name_norm],
    );
    if (ambig.rows.length > 0) {
      // Insert new row · flag both as ambiguous_entity
      const ins = await client.query(
        `INSERT INTO nex.discovery_entity
           (programme_id, iso_alpha_2, business_name, business_name_norm, trading_name,
            canonical_website, phone_norm, address_line, city, region, postcode,
            state, state_reason, category, services, discovery_terms, source_urls,
            evidence_count, confidence, first_cycle_id, last_cycle_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                 'ambiguous_entity', $12, $13, $14, $15, $16, 1, 0.20, $17, $17)
         RETURNING *`,
        [
          obs.programme_id, obs.iso.toUpperCase(), obs.business_name, business_name_norm,
          obs.trading_name ?? null, canonical, phone, obs.address_line ?? null, obs.city ?? null,
          obs.region ?? null, obs.postcode ?? null,
          `collides with entity_id ${ambig.rows[0].entity_id} on ${canonical ? "website" : "phone"}`,
          obs.category ?? null, obs.services ? Array.from(obs.services) : [],
          [obs.discovery_term], [obs.source_url],
          obs.cycle_id ?? null,
        ],
      );
      await client.query(
        `UPDATE nex.discovery_entity SET state = 'ambiguous_entity', state_reason = $1 WHERE entity_id = $2 AND state <> 'rejected_entity'`,
        [`collides with entity_id ${ins.rows[0].entity_id}`, ambig.rows[0].entity_id],
      );
      await client.query(
        `INSERT INTO nex.discovery_entity_source (entity_id, source_url, source_kind, cycle_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [ins.rows[0].entity_id, obs.source_url, obs.source_kind, obs.cycle_id ?? null],
      );
      return { kind: "flagged_ambiguous", entity: rowToEntity(ins.rows[0]) };
    }
  }

  // Fresh candidate_entity insert
  const ins = await client.query(
    `INSERT INTO nex.discovery_entity
       (programme_id, iso_alpha_2, business_name, business_name_norm, trading_name,
        canonical_website, phone_norm, address_line, city, region, postcode,
        state, category, services, discovery_terms, source_urls,
        evidence_count, confidence, first_cycle_id, last_cycle_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
             'candidate_entity', $12, $13, $14, $15, 1, 0.20, $16, $16)
     RETURNING *`,
    [
      obs.programme_id, obs.iso.toUpperCase(), obs.business_name, business_name_norm,
      obs.trading_name ?? null, canonical, phone, obs.address_line ?? null, obs.city ?? null,
      obs.region ?? null, obs.postcode ?? null,
      obs.category ?? null, obs.services ? Array.from(obs.services) : [],
      [obs.discovery_term], [obs.source_url],
      obs.cycle_id ?? null,
    ],
  );
  await client.query(
    `INSERT INTO nex.discovery_entity_source (entity_id, source_url, source_kind, cycle_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
    [ins.rows[0].entity_id, obs.source_url, obs.source_kind, obs.cycle_id ?? null],
  );
  return { kind: "created_candidate", entity: rowToEntity(ins.rows[0]) };
}

/** Founder-only rejection · never re-resolved silently. */
export async function rejectEntity(client: PoolClient, entity_id: string, actor: string, reason: string): Promise<EntityRow> {
  if (actor.startsWith("system:")) {
    throw new Error("rejectEntity: system actors may not reject · Founder decision required");
  }
  const res = await client.query(
    `UPDATE nex.discovery_entity
        SET state = 'rejected_entity', state_reason = $1, last_seen_at = now()
      WHERE entity_id = $2 RETURNING *`,
    [`Rejected by ${actor}: ${reason}`, entity_id],
  );
  if (res.rowCount === 0) throw new Error(`entity ${entity_id} not found`);
  return rowToEntity(res.rows[0]);
}

/** Load entities for a country/programme. */
export async function loadEntitiesForCountry(
  client: PoolClient,
  programme_id: string,
  iso: string,
  opts: { state?: EntityState; limit?: number } = {},
): Promise<ReadonlyArray<EntityRow>> {
  const where: string[] = ["programme_id = $1", "iso_alpha_2 = $2"];
  const params: unknown[] = [programme_id, iso.toUpperCase()];
  if (opts.state) { params.push(opts.state); where.push(`state = $${params.length}`); }
  params.push(opts.limit ?? 100);
  const res = await client.query(
    `SELECT * FROM nex.discovery_entity WHERE ${where.join(" AND ")} ORDER BY last_seen_at DESC LIMIT $${params.length}`,
    params,
  );
  return res.rows.map(rowToEntity);
}

function rowToEntity(r: any): EntityRow {
  return {
    entity_id: r.entity_id, programme_id: r.programme_id, iso_alpha_2: r.iso_alpha_2,
    business_name: r.business_name, business_name_norm: r.business_name_norm,
    trading_name: r.trading_name, canonical_website: r.canonical_website, phone_norm: r.phone_norm,
    address_line: r.address_line, city: r.city, region: r.region, postcode: r.postcode,
    state: r.state as EntityState, state_reason: r.state_reason,
    category: r.category, services: r.services ?? [], discovery_terms: r.discovery_terms ?? [],
    source_urls: r.source_urls ?? [], evidence_count: r.evidence_count, confidence: Number(r.confidence),
    first_seen_at: r.first_seen_at, last_seen_at: r.last_seen_at,
    first_cycle_id: r.first_cycle_id, last_cycle_id: r.last_cycle_id,
    metadata: r.metadata ?? {},
  };
}

export const _ENTITY_RESOLUTION_BOUNDARY_NEVER_FABRICATE = "entity_created_only_with_real_observation";
