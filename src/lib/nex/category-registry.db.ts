// src/lib/nex/category-registry.db.ts
//
// Directory Factory · Phase 0 · 2026-08-23
// Thin PG adapter for the Category Registry + Category Candidate tables.
// Runtime consumers of `category-registry.ts` still read from the TS
// constant — this adapter exists for:
//
//   · the TS-vs-DB parity validator (this phase)
//   · future Walker candidate-writer (Phase 1)
//   · future HQ approval surface (Phase 2)
//   · future Factory activation engine (Phase 3)
//
// Phase 0 exposes read-only helpers on both tables + one utility to
// list constraints. Write paths are NOT exported by this file to keep
// the "Phase 0 doesn't change runtime behaviour" invariant enforceable
// by import audit.
//
// Env: reuses NEX_POSTGRES_URL (same pool pattern as src/lib/nex-food/db.ts).
// Missing env → helpers return null-shaped results so validator can
// skip gracefully in dev machines without the DB running (Philip R7).
//
// Doctrine anchors:
//   project_nex_directory_factory_doctrine_2026_08_22
//   project_nex_walker_stays_pure_acquisition_2026_08_22

import { Pool, type QueryResult, type QueryResultRow } from "pg";

let cachedPool: Pool | null = null;

/** Returns pool if NEX_POSTGRES_URL is set · else null so callers can
 *  skip cleanly in environments without the local DB. */
export function getRegistryDbPool(): Pool | null {
  if (cachedPool) return cachedPool;
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) return null;
  cachedPool = new Pool({
    connectionString: url,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  return cachedPool;
}

async function q<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<QueryResult<T> | null> {
  const pool = getRegistryDbPool();
  if (!pool) return null;
  return pool.query<T>(sql, params);
}

// ── Shape of a row returned from nex.category_registry ─────────────
export interface CategoryRegistryRow {
  id: string;
  parent_vertical: string;
  display_name_en: string;
  display_name_id: string;
  icon: string | null;
  visual_glyph: string;
  visual_family: string | null;
  route: string;
  active: boolean;
  brain_keywords: string[];
  countries: string[];
  business_table: string | null;
  category_filter: string | null;
  schema_version: string;
  origin_candidate_id: string | null;
  activated_at: Date | null;
  activated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

/** Read every row from nex.category_registry.
 *  Returns null if DB is unreachable (env unset). */
export async function readCategoryRegistryRows(): Promise<CategoryRegistryRow[] | null> {
  const res = await q<CategoryRegistryRow>(
    `SELECT id, parent_vertical, display_name_en, display_name_id, icon,
            visual_glyph, visual_family, route, active,
            brain_keywords, countries, business_table, category_filter,
            schema_version, origin_candidate_id, activated_at, activated_by,
            created_at, updated_at
       FROM nex.category_registry
       ORDER BY id ASC`,
  );
  if (!res) return null;
  return res.rows;
}

// ── Shape of a row from nex.category_candidate ─────────────────────
export interface CategoryCandidateRow {
  id: string;
  proposed_category_id: string;
  proposed_name: string;
  display_name_en: string;
  display_name_id: string | null;
  suggested_parent_vertical: string;
  brain_keywords: string[];
  suggested_countries: string[];
  business_count: number;
  cycle_count: number;
  confidence: number;
  evidence: Record<string, unknown>;
  discovered_businesses: unknown[];
  image_candidates: unknown[];
  image_candidates_note: string;
  proposed_by: string;
  proposed_cycle_run_id: string | null;
  admin_decision: "pending" | "approved" | "rejected" | "duplicate" | "superseded";
  admin_reviewed_at: Date | null;
  admin_reviewed_by: string | null;
  admin_notes: string | null;
  duplicate_of_registry_id: string | null;
  superseded_by_candidate_id: string | null;
  created_at: Date;
}

/** List candidate rows filtered by admin_decision · newest first. */
export async function listCategoryCandidates(
  decision?: CategoryCandidateRow["admin_decision"],
): Promise<CategoryCandidateRow[] | null> {
  const sql = decision
    ? `SELECT * FROM nex.category_candidate WHERE admin_decision = $1 ORDER BY created_at DESC`
    : `SELECT * FROM nex.category_candidate ORDER BY created_at DESC`;
  const params = decision ? [decision] : [];
  const res = await q<CategoryCandidateRow>(sql, params);
  if (!res) return null;
  return res.rows;
}

/** Look up a single candidate by id. */
export async function readCandidateById(
  id: string,
): Promise<CategoryCandidateRow | null> {
  const res = await q<CategoryCandidateRow>(
    `SELECT * FROM nex.category_candidate WHERE id = $1`,
    [id],
  );
  if (!res || res.rows.length === 0) return null;
  return res.rows[0];
}

// ── Human-decision mutator · Phase 2 · 2026-08-23 ──────────────────
//
// The ONLY write path that persists a human's decision on a
// CATEGORY_CANDIDATE. Never activates a Registry category · that is the
// exclusive job of the Phase 3 Factory activation engine, which is not
// yet built.
//
// Boundaries (verifiable via source-audit tests):
//   · Writes ONLY to nex.category_candidate.
//   · Never writes to nex.category_registry.
//   · admin_decision transitions are one-way from 'pending' (WHERE guard
//     rejects decisions on already-decided rows).
//   · Refuses decision='pending' — that's the initial state, not a
//     terminal review outcome.
//   · Refuses missing reviewer.
//   · 'duplicate' requires a valid duplicate_of_registry_id.
//   · 'superseded' requires a valid superseded_by_candidate_id.
//
// Doctrine anchors:
//   project_nex_directory_factory_doctrine_2026_08_22 (Decision #12 · human-gated activation)
//   project_nex_walker_stays_pure_acquisition_2026_08_22 (unchanged)

export type CandidateDecision =
  | "approved"
  | "rejected"
  | "duplicate"
  | "superseded";

export interface DecideCandidateOptions {
  notes?: string;
  duplicateOfRegistryId?: string;
  supersededByCandidateId?: string;
}

export interface DecideCandidateResult {
  ok: boolean;
  reason?:
    | "invalid-decision"
    | "reviewer-required"
    | "notes-too-long"
    | "duplicate-target-required"
    | "superseded-target-required"
    | "candidate-not-found-or-already-decided"
    | "no-db";
  candidate?: CategoryCandidateRow;
}

const MAX_NOTES_LENGTH = 4000;
const ALLOWED_DECISIONS = new Set<CandidateDecision>([
  "approved",
  "rejected",
  "duplicate",
  "superseded",
]);

/** Persist a human's decision on a pending candidate. */
export async function decideCategoryCandidate(
  candidateId: string,
  decision: CandidateDecision,
  reviewedBy: string,
  opts: DecideCandidateOptions = {},
): Promise<DecideCandidateResult> {
  if (!ALLOWED_DECISIONS.has(decision)) return { ok: false, reason: "invalid-decision" };
  if (typeof reviewedBy !== "string" || reviewedBy.trim().length === 0) {
    return { ok: false, reason: "reviewer-required" };
  }
  if (opts.notes !== undefined && opts.notes.length > MAX_NOTES_LENGTH) {
    return { ok: false, reason: "notes-too-long" };
  }
  if (decision === "duplicate" && !opts.duplicateOfRegistryId) {
    return { ok: false, reason: "duplicate-target-required" };
  }
  if (decision === "superseded" && !opts.supersededByCandidateId) {
    return { ok: false, reason: "superseded-target-required" };
  }

  const pool = getRegistryDbPool();
  if (!pool) return { ok: false, reason: "no-db" };

  const res = await pool.query<CategoryCandidateRow>(
    `UPDATE nex.category_candidate
        SET admin_decision              = $2,
            admin_reviewed_at           = now(),
            admin_reviewed_by           = $3,
            admin_notes                 = $4,
            duplicate_of_registry_id    = $5,
            superseded_by_candidate_id  = $6
      WHERE id = $1
        AND admin_decision = 'pending'
      RETURNING *`,
    [
      candidateId,
      decision,
      reviewedBy.trim(),
      opts.notes ?? null,
      opts.duplicateOfRegistryId ?? null,
      opts.supersededByCandidateId ?? null,
    ],
  );

  if (res.rowCount === 0) {
    return { ok: false, reason: "candidate-not-found-or-already-decided" };
  }
  return { ok: true, candidate: res.rows[0] };
}

/** For tests / graceful shutdown. */
export async function closeRegistryDbPool(): Promise<void> {
  if (cachedPool) {
    await cachedPool.end();
    cachedPool = null;
  }
}
