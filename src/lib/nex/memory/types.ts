// Nex Memory Engine — Phase 26 V0 contracts.
//
// V0 covers 3 owner-scoped layers (user, company, project). Cross-tenant
// layers (trade, region, industry, market) arrive in V1 with the
// rollup crons + K-anonymity gate.
//
// Every write records `visible_to`. Every read filters on the caller's
// viewer scope. Corrections chain via `correction_of` — never destructive.

import type { Evidence } from "../pi/types";
export type { Evidence };

// ─── Layer + shared enums ───────────────────────────────────────

export type MemoryLayer = "user" | "company" | "project";

export type MemoryPredicate =
  | "="
  | ">"
  | "<"
  | "avg"
  | "median"
  | "p50"
  | "p95"
  | "has"
  | "not"
  | "like";

export type MemoryConfidence = "low" | "medium" | "high";

/** V0 visibility scope. Cross-tenant scopes (`trade_k5`, `region_k5`,
 *  `industry_paid`, `market_paid`) are defined here so V1 additions
 *  don't break the union — but only the V0-safe values are accepted
 *  by the writer. */
export type MemoryVisibility =
  | "owner_only"
  | "owner_and_delegates"
  | "project_participants"
  | "trade_k5"           // V1
  | "region_k5"          // V1
  | "industry_paid"      // V2
  | "market_paid";       // V2

/** The visibilities the V0 writer accepts. Reject-list is safer than
 *  allow-list once the union grows. */
export const V0_VISIBILITIES: readonly MemoryVisibility[] = Object.freeze([
  "owner_only",
  "owner_and_delegates",
  "project_participants"
]);

// ─── Row envelope (shared shape across the 3 tables) ────────────

export type MemoryRow = {
  id:              string;
  layer:           MemoryLayer;
  /** Layer-specific owner keys. Only one is set. */
  owner_user_id?:  string | null;
  merchant_slug?:  string | null;
  project_id?:     string | null;

  subject:         string;
  predicate:       MemoryPredicate;
  value_json:      unknown;
  unit:            string | null;

  observed_at:     string;
  window_start:    string | null;
  window_end:      string | null;
  sample_size:     number;

  confidence:      MemoryConfidence;
  is_official:     boolean;
  is_verified:     boolean;

  visible_to:      MemoryVisibility;

  source_engine:   string;
  evidence_tables: string[];
  computed_at:     string;
  decays_at:       string | null;

  correction_of:   string | null;

  created_at:      string;
};

// ─── Writer input ───────────────────────────────────────────────

/** Common fields for every write. */
type WriteBase = {
  subject:         string;
  predicate:       MemoryPredicate;
  value_json:      unknown;
  unit?:           string | null;

  observed_at?:    string;                  // defaults to now
  window_start?:   string | null;
  window_end?:     string | null;
  sample_size?:    number;                  // defaults to 1

  confidence?:     MemoryConfidence;        // defaults to "low"
  is_official?:    boolean;
  is_verified?:    boolean;

  visible_to?:     MemoryVisibility;        // defaults per layer

  source_engine:   string;                  // required — every write must attribute
  evidence_tables?: string[];
  decays_at?:      string | null;

  /** When set, supersedes the referenced row. The old row is preserved
   *  (never deleted); reads prefer the newest un-superseded row. */
  correction_of?:  string | null;
};

export type WriteUserMemoryInput    = WriteBase & { layer: "user";    owner_user_id: string };
export type WriteCompanyMemoryInput = WriteBase & { layer: "company"; merchant_slug: string };
export type WriteProjectMemoryInput = WriteBase & { layer: "project"; merchant_slug: string; project_id: string };

export type WriteMemoryInput =
  | WriteUserMemoryInput
  | WriteCompanyMemoryInput
  | WriteProjectMemoryInput;

// ─── Reader input ───────────────────────────────────────────────

/** Who's asking, and what for. The viewer scope determines which rows
 *  come back. V0 = owner-only. */
export type ViewerScope =
  | { kind: "user";    user_id: string }
  | { kind: "merchant"; merchant_slug: string }
  | { kind: "project"; merchant_slug: string; project_id: string };

export type ReadMemoryInput = {
  layer:         MemoryLayer;
  viewer:        ViewerScope;
  subject?:      string;                    // exact match
  subject_like?: string;                    // "pricing.kitchen.*" style prefix search
  /** Return only rows with sample_size >= this (useful when the caller
   *  wants meaningful aggregates). */
  min_sample_size?: number;
  /** Return only rows younger than this (in days). */
  fresh_within_days?: number;
  /** How many rows. Defaults to 3 per user memory rule ("always return 3
   *  unless user specifies"). */
  limit?:        number;
};

/** What the reader returns. */
export type RetrieveResult = {
  rows:       MemoryRow[];
  /** Count of rows the correction chain resolved into "current" state. */
  resolved:   number;
  /** Rows that were dropped because a newer correction supersedes them. */
  superseded: number;
  evidence:   Evidence;
};

// ─── Correction ─────────────────────────────────────────────────

export type CorrectionInput = {
  layer:           MemoryLayer;
  correcting_id:   string;                  // the row being corrected
  /** New value + reason. Reason is stored in evidence_tables[0] for
   *  auditability without a schema change. */
  value_json:      unknown;
  reason:          string;
  source_engine:   string;
};

// ─── Helpers ────────────────────────────────────────────────────

export function evidenceFor(source: string, tables: string[] = []): Evidence {
  return {
    source,
    tables,
    computed_at: new Date().toISOString()
  };
}

/** Compute a default `decays_at` for a subject family. Callers can
 *  override. Financial signals age fastest; regulation cites never
 *  decay by default. */
export function defaultDecayFor(subject: string): string | null {
  if (/^regulation\./.test(subject))     return null;                        // never decays
  if (/^market\.|^supplier\./.test(subject)) return daysFromNow(90).toISOString();
  if (/^pricing\.|^financial\./.test(subject)) return daysFromNow(180).toISOString();
  return daysFromNow(365).toISOString();
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

/** Derived confidence bump per the blueprint's scoring rules. Starting
 *  tier is caller-supplied; this function applies the rules. */
export function computeConfidence(input: {
  base?:           MemoryConfidence;
  sample_size?:    number;
  is_official?:    boolean;
  is_verified?:    boolean;
  observed_at?:    string;
  decays_at?:      string | null;
  conflict?:       boolean;
}): MemoryConfidence {
  const RANK: MemoryConfidence[] = ["low", "medium", "high"];
  let idx = RANK.indexOf(input.base ?? "low");
  if ((input.sample_size ?? 1) >= 20) idx += 1;
  if (input.is_official)              idx += 1;
  if (input.is_verified)              idx += 1;
  if (input.observed_at && input.decays_at) {
    const obs   = new Date(input.observed_at).getTime();
    const decay = new Date(input.decays_at).getTime();
    const halfway = obs + (decay - obs) / 2;
    if (Date.now() < halfway) idx += 1;
  }
  if (input.conflict) idx -= 1;
  idx = Math.max(0, Math.min(RANK.length - 1, idx));
  return RANK[idx]!;
}
