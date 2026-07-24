// Nex Construction Experience Intelligence — contracts.
//
// This layer learns from COMPLETED projects to answer real-world
// questions like "how long does an oak staircase usually take?".
//
// Privacy is non-negotiable:
//   1. Fingerprints strip every identifier (no merchant, homeowner,
//      address, customer name, project title free-text). Region is
//      derived from postcode-area only (e.g. "M25" → "M").
//   2. Aggregates apply k-anonymity — any benchmark from fewer than
//      K_MIN contributing projects returns null with an honest reason
//      instead of a number a caller could reverse-engineer.
//   3. Consent is opt-in per project. Defaults to false. No project
//      contributes silently.
//   4. Every reply LABELS its evidence sources: "Official regulation"
//      vs "Real-world experience" vs "Merchant preference" — never
//      merged.

import type { Evidence } from "../pi/types";
export type { Evidence };

/** k-anonymity threshold. Never surface a benchmark from fewer than
 *  K_MIN contributing projects. Tuned conservatively for launch. */
export const K_MIN = 3;

/** Currently supported source labels — every reply MUST tag each
 *  claim with exactly one of these so callers can display them
 *  distinctly. */
export type EvidenceSourceKind = "regulation" | "experience" | "preference" | "engine_default";

// ─── Fingerprint ────────────────────────────────────────────────

export type PropertyTypeCategory = "domestic" | "commercial" | "unknown";

export type ProjectFingerprint = {
  /** Stable hash of (project_id, salt). Never reversible to project_id
   *  without the salt (which stays server-side). */
  anon_id:           string;
  trade:             string;                 // primary trade slug
  project_type:      string;                 // "kitchen" | "loft" | "staircase" | "roof" | …
  property_type:     PropertyTypeCategory;
  region:            string;                 // postcode area only, e.g. "M", "LS", "SW"
  duration_days:     number | null;          // completed_at - started_at
  labour_hours:      number | null;          // sum of job_diary entries
  materials_spend_pence: number | null;
  labour_spend_pence:    number | null;
  crew_size:         number | null;          // distinct trades on the project
  completed_at:      string;
};

// ─── Benchmark ──────────────────────────────────────────────────

export type BenchmarkStat = {
  metric:       "duration_days" | "labour_hours" | "materials_spend_pence" | "labour_spend_pence" | "crew_size";
  label:        string;
  count:        number;                      // contributing projects
  /** null when count < K_MIN. */
  median:       number | null;
  min:          number | null;
  max:          number | null;
  p25:          number | null;
  p75:          number | null;
  confidence:   "low" | "medium" | "high" | "insufficient";
  reason:       string;
  source_kind:  "experience";                // always experience for these
  evidence:     Evidence;
};

export type ProjectBenchmark = {
  filters: {
    trade?:         string;
    project_type?:  string;
    region?:        string;
    property_type?: PropertyTypeCategory;
  };
  sample_size:      number;                  // contributing projects
  stats:            BenchmarkStat[];
  warnings:         string[];
  evidence:         Evidence;
};

// ─── Similar project ────────────────────────────────────────────

export type SimilarProject = {
  anon_id:         string;
  trade:           string;
  project_type:    string;
  region:          string;
  duration_days:   number | null;
  labour_hours:    number | null;
  similarity_note: string;                   // "same trade + region"
  evidence:        Evidence;
};

// ─── Explainable recommendation ─────────────────────────────────

export type SourcedClaim = {
  source_kind:  EvidenceSourceKind;
  headline:     string;                      // one line
  detail?:      string;
  /** Only populated for `experience` claims. */
  sample_size?: number;
  confidence?:  "low" | "medium" | "high";
  evidence:     Evidence;
};

export type ExperienceRecommendation = {
  query:        string;
  claims:       SourcedClaim[];              // separated by source_kind
  disclaimer:   string;
  evidence:     Evidence;
};

// ─── Consent ────────────────────────────────────────────────────

export type ContributionConsent = {
  project_id:   string;
  merchant_slug: string;
  status:       "opt_in" | "opt_out";
  source:       "engine_default" | "merchant_choice";
  set_at:       string;
};

export function evidenceFor(source: string, tables: string[] = []): Evidence {
  return {
    source,
    tables,
    computed_at: new Date().toISOString()
  };
}

// ─── Standard disclaimers (must appear on every experience reply) ─

export const DISCLAIMERS = {
  regulation_vs_experience:
    "This reply separates OFFICIAL regulation from REAL-WORLD experience from MERCHANT preference. Never treat experience-based figures as regulatory sign-off — check with a qualified inspector for anything safety-critical.",
  k_anonymity:
    "Benchmarks respect k-anonymity — they only appear when at least 3 anonymous projects contribute. Below that we stay silent rather than risk identifying any one merchant.",
  privacy:
    "Every contributing project is anonymised at the point of contribution: merchant, homeowner, address and free-text are stripped. Region is postcode area only."
};
