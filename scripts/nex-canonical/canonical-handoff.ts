// scripts/nex-canonical/canonical-handoff.ts
//
// NEX Canonical · Post-Approval Handoff · handoff-v1 pure precheck.
//
// Takes an approved DecisionRecord (with its exact Candidate and
// ReviewPackage), a resolver verdict supplied by the caller, a source
// registry row supplied by the caller, and (if MATCH) the current
// canonical row supplied by the caller. Returns either a write PLAN
// (not an execution) or a precise blocked reason.
//
// This module is PURE. It:
//   · does NOT connect to PostgreSQL
//   · does NOT invoke the resolver (verdict is an input)
//   · does NOT read `nex.source_registry` (row is an input)
//   · does NOT read `nex.business_canonical` (row is an input)
//   · does NOT read environment variables
//   · does NOT read or write the filesystem
//   · does NOT use a clock, randomness, or network
//   · does NOT mutate its inputs
//   · does NOT execute anything · it only returns a plan
//
// What it does
//   · Verifies the full integrity triple: Decision ↔ Candidate ↔
//     ReviewPackage (via content hashes).
//   · Checks the decision is `approve` and current (not superseded,
//     if the caller supplied the previous decision log).
//   · Routes on the caller-supplied resolver verdict:
//       MATCH     → merge_match plan   (never insert_new)
//       NO_MATCH  → insert_new plan    (never merge_match)
//       AMBIGUOUS → block              (never any plan)
//   · Applies Rule-5 structural checks (sealed entity type, country
//     ISO-2, phone E.164, Wikidata QID format, non-blank name) using
//     only the Candidate payload.
//   · Verifies the source-registry row grants `can_derive`.
//   · Verifies the MATCH target has writable lifecycle_state AND is
//     not itself superseded.
//   · For NO_MATCH with a non-null osm_id, consults the caller-supplied
//     `existing_osm_collision_if_any` to honour the `(country, osm_id)`
//     partial unique index from migration 167.
//
// Separation of concerns
//   · The actual canonical INSERT is NOT this module's responsibility.
//     A future `executeWritePlan(plan)` module (separate authorization)
//     will own the write transaction, fingerprint re-check, and session
//     binding.
//   · The resolver that produced the verdict is NOT this module's
//     responsibility. The pre-check accepts a verdict and acts on it.
//   · The DB queries that populate `source_registry_row`,
//     `current_canonical_row_if_match`, and `existing_osm_collision_if_any`
//     are NOT this module's responsibility. The caller owns them.

import { createHash } from "node:crypto";
import {
  SEALED_ENTITY_TYPES,
  type Candidate,
  type EntityType,
} from "./generate-candidates";
import type {
  DecisionRecord,
  DecisionState,
  ReviewPackage,
} from "./candidate-approval";
import { isLifecycleWritable, type LifecycleState } from "./canonical-row";

// ═════════════════════════════════════════════════════════════════════
// §1 · Schema version pins
// ═════════════════════════════════════════════════════════════════════

export const HANDOFF_SCHEMA_VERSION = "handoff-v1" as const;
export const EVIDENCE_SCHEMA_VERSION = "evidence-v1" as const;

// ═════════════════════════════════════════════════════════════════════
// §2a · Legacy backlink spec · vertical-aware canonical_business_id
//        backfill target
// ═════════════════════════════════════════════════════════════════════
//
// After a successful `merge_match` write (new business_evidence row
// pointing at an existing canonical row), the Layer-B executor should
// also backfill the legacy row's `canonical_business_id` column so the
// candidate adapter stops re-emitting the same source row forever.
//
// This is vertical-aware · only legacy tables that physically CARRY a
// `canonical_business_id` column may be backfilled:
//
//   · nex.food_business            · has canonical_business_id
//   · nex.accommodation_business   · has canonical_business_id
//   · nex.service_business         · has canonical_business_id
//   · nex.mp_seller                · has canonical_business_id
//
// Transport (`nex.transport_acquisition_record`) does NOT yet carry a
// `canonical_business_id` column (verified against live `nex_dev` on
// 2026-10-10). This function returns null for that case, which the
// executor interprets as "silently skip the backfill" — never fabricate
// an UPDATE against a column that doesn't exist.
//
// The function is PURE · it looks up a short in-module table of known
// legacy tables and returns null for anything else. It does NOT consult
// the DB · it does NOT read env vars · it does NOT read the FS.

/** The physical UPDATE target for backfilling a legacy row's canonical
 *  pointer after a successful merge_match write. */
export interface LegacyBacklinkSpec {
  /** Fully-qualified legacy table (e.g. `nex.food_business`). */
  readonly table: string;
  /** The legacy primary key column that the evidence's
   *  `legacy_source.internal_id` matches against. */
  readonly idColumn: string;
  /** The legacy column receiving the canonical UUID. Today every
   *  supported legacy table uses the same column name. */
  readonly canonicalIdColumn: "canonical_business_id";
}

/**
 * Returns the legacy backlink UPDATE target for a given legacy source
 * table, or null for verticals that do not yet have a
 * `canonical_business_id` column. The executor is responsible for
 * (a) honouring the `WHERE canonical_business_id IS NULL` idempotency
 * guard and (b) only issuing the UPDATE when both the spec AND a
 * non-null `legacy_source.internal_id` are present.
 *
 * PURE · no DB · no FS · no clock · deterministic.
 */
export function legacyBacklinkSpec(
  legacySourceTable: string,
): LegacyBacklinkSpec | null {
  //
  // ID column names verified against live `nex_dev` on 2026-10-10:
  //   nex.food_business          · PK=internal_id (uuid)
  //   nex.accommodation_business · PK=internal_id (uuid)
  //   nex.service_business       · PK=internal_id (uuid)
  //   nex.mp_seller              · PK=seller_id   (uuid)   ← different!
  //
  // The Candidate's `legacy_source.internal_id` for each source adapter
  // carries that table's primary key value verbatim.
  switch (legacySourceTable) {
    case "nex.food_business":
      return {
        table: "nex.food_business",
        idColumn: "internal_id",
        canonicalIdColumn: "canonical_business_id",
      };
    case "nex.accommodation_business":
      return {
        table: "nex.accommodation_business",
        idColumn: "internal_id",
        canonicalIdColumn: "canonical_business_id",
      };
    case "nex.service_business":
      return {
        table: "nex.service_business",
        idColumn: "internal_id",
        canonicalIdColumn: "canonical_business_id",
      };
    case "nex.mp_seller":
      return {
        table: "nex.mp_seller",
        idColumn: "seller_id",
        canonicalIdColumn: "canonical_business_id",
      };
    default:
      // Transport (nex.transport_acquisition_record) + any other
      // vertical that has not yet grown a canonical_business_id column.
      // Silent skip is correct · the executor must NOT fabricate an
      // UPDATE against a column that doesn't exist.
      return null;
  }
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Public types · resolver verdict + source registry row
// ═════════════════════════════════════════════════════════════════════

export interface ScoreBreakdown {
  readonly key: string;
  readonly contribution: number;
  readonly note: string;
}

/** The resolver's verdict for a single approved candidate. Produced by
 *  a separate (future) Layer-B resolver and supplied to this precheck
 *  as an input. The precheck NEVER produces its own verdict. */
export type ResolverVerdict =
  | {
      readonly kind: "MATCH";
      readonly target_canonical_business_id: string;
      readonly score: number;
      readonly score_breakdown: readonly ScoreBreakdown[];
    }
  | {
      readonly kind: "AMBIGUOUS";
      readonly competing: readonly {
        readonly canonical_business_id: string;
        readonly score: number;
      }[];
      readonly best_score: number;
    }
  | {
      readonly kind: "NO_MATCH";
      readonly best_score: number;
    };

/** A row from `nex.source_registry` (migration 166). Supplied by the
 *  caller · the precheck does not read the DB. */
export interface SourceRegistryRow {
  readonly source_id: string;
  readonly source_type: string;
  readonly display_name: string;
  readonly can_collect: boolean;
  readonly can_store: boolean;
  readonly can_display: boolean;
  readonly can_derive: boolean;
  readonly can_redistribute: boolean;
  readonly attribution_required: boolean;
}

// Re-export the shared types used in signatures for callers that want
// a one-stop import.
export type { CanonicalRow, LifecycleState } from "./canonical-row";

// ═════════════════════════════════════════════════════════════════════
// §3 · Input bundle · the approved candidate handoff
// ═════════════════════════════════════════════════════════════════════

export interface ApprovedCandidateHandoff {
  readonly schema_version: typeof HANDOFF_SCHEMA_VERSION;
  readonly decision_record: DecisionRecord;
  readonly candidate: Candidate;
  readonly review_package: ReviewPackage;
  /** Optional previous decisions · when supplied, enables the "current
   *  decision for this candidate is not superseded" check. If omitted,
   *  the precheck trusts the supplied DecisionRecord is current. */
  readonly previous_decisions?: readonly DecisionRecord[];
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Evidence · the immutable citation attached to any plan
// ═════════════════════════════════════════════════════════════════════

export interface HandoffEvidence {
  readonly schema_version: typeof EVIDENCE_SCHEMA_VERSION;
  readonly candidate_id: string;
  readonly candidate_integrity_hash: string;
  readonly decision_record_id: string;
  readonly review_package_id: string;
  readonly legacy_source: {
    readonly table: string;
    readonly ref: string;
    readonly internal_id: string | null;
  };
  readonly resolver_verdict_summary: {
    readonly kind: "MATCH" | "NO_MATCH";
    readonly target_canonical_business_id: string | null;
    readonly score: number;
  };
  readonly observation_provenance: {
    readonly generator: string;
    readonly generation_run_id: string;
    readonly generated_at: string;
    readonly decision_timestamp: string;
    readonly founder_id: string;
  };
  readonly source_id: string;
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Write plan · a PLAN only · NOTHING is written
// ═════════════════════════════════════════════════════════════════════

/** The shape of a row that would be inserted into `nex.business_canonical`
 *  on NO_MATCH. Mirrors migration 167 columns. `lifecycle_state` is
 *  always `"DISCOVERED"` for a brand-new canonical row. */
export interface InsertCanonicalRow {
  readonly entity_type: EntityType;
  readonly country: string;
  readonly lifecycle_state: "DISCOVERED";
  readonly name_canonical: string;
  readonly aliases: readonly string[];
  readonly phone_e164: string | null;
  readonly website_apex: string | null;
  readonly osm_id: string | null;
  readonly wikidata_qid: string | null;
  readonly city: string | null;
  readonly district: string | null;
  /** Added by migration 178 · location-granularity wave. Preserved
   *  verbatim from the Candidate's identity · the write path does not
   *  concatenate or infer these values. */
  readonly street_line: string | null;
  readonly neighbourhood: string | null;
  /** Canonical address · maps to `nex.business_canonical.address jsonb`
   *  (migration 167). Sealed shape per the doctrine. Preserved
   *  verbatim from Candidate.identity.address · the write path does
   *  not parse, split, or infer. */
  readonly address: {
    readonly line1: string | null;
    readonly postal_code: string | null;
  } | null;
  readonly coordinates: { readonly lat: number; readonly lng: number } | null;
}

export type CanonicalWritePlan =
  | {
      readonly kind: "insert_new";
      readonly row: InsertCanonicalRow;
      readonly evidence: HandoffEvidence;
    }
  | {
      readonly kind: "merge_match";
      readonly target_canonical_business_id: string;
      readonly evidence: HandoffEvidence;
    };

// ═════════════════════════════════════════════════════════════════════
// §6 · Blocked reason · a discriminated union of refusal categories
// ═════════════════════════════════════════════════════════════════════

export type HandoffBlockedReason =
  | { readonly kind: "invalid_handoff_schema_version"; readonly observed: string }
  | { readonly kind: "not_approved"; readonly decision: DecisionState }
  | { readonly kind: "superseded"; readonly superseded_by_record_id: string }
  | {
      readonly kind: "candidate_integrity_mismatch";
      readonly expected: string;
      readonly actual: string;
    }
  | {
      readonly kind: "review_package_integrity_mismatch";
      readonly expected: string;
      readonly actual: string;
    }
  | {
      readonly kind: "decision_record_candidate_mismatch";
      readonly decision_candidate_id: string;
      readonly supplied_candidate_id: string;
    }
  | {
      readonly kind: "decision_record_package_mismatch";
      readonly decision_package_id: string;
      readonly supplied_package_id: string;
    }
  | {
      readonly kind: "resolver_ambiguous";
      readonly competing: readonly string[];
      readonly best_score: number;
    }
  | { readonly kind: "rule_5_violation"; readonly detail: string }
  | {
      readonly kind: "source_permission_denied";
      readonly source_id: string;
      readonly flag: string;
    }
  | {
      readonly kind: "lifecycle_blocked";
      readonly current_state: LifecycleState;
      readonly target_canonical_business_id: string;
    }
  | {
      readonly kind: "target_already_superseded";
      readonly target_canonical_business_id: string;
      readonly superseded_by_business_id: string;
    }
  | {
      readonly kind: "osm_collision";
      readonly existing_canonical_business_id: string;
      readonly osm_id: string;
    }
  | {
      readonly kind: "missing_canonical_row_for_match";
      readonly target_canonical_business_id: string;
    }
  | {
      readonly kind: "match_target_mismatch";
      readonly verdict_target: string;
      readonly supplied_row_id: string;
    };

// ═════════════════════════════════════════════════════════════════════
// §7 · Public result
// ═════════════════════════════════════════════════════════════════════

export type HandoffPrecheckResult =
  | { readonly ok: true; readonly plan: CanonicalWritePlan }
  | { readonly ok: false; readonly reason: HandoffBlockedReason };

// ═════════════════════════════════════════════════════════════════════
// §8 · Internal pure helpers
// ═════════════════════════════════════════════════════════════════════

/** Local copy of stableStringify · intentionally duplicated to keep
 *  this module isolated from the α.2 producer / approval modules.
 *  Keep in behavioural sync. Pure · deterministic. */
function stableStringify(obj: unknown): string {
  if (obj === null) return "null";
  if (typeof obj === "number") {
    if (!Number.isFinite(obj)) {
      throw new Error("stableStringify: non-finite number is not JSON-safe");
    }
    return JSON.stringify(obj);
  }
  if (typeof obj === "boolean" || typeof obj === "string") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map((e) => stableStringify(e)).join(",") + "]";
  }
  if (typeof obj === "object") {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const pairs = keys.map(
      (k) =>
        JSON.stringify(k) +
        ":" +
        stableStringify((obj as Record<string, unknown>)[k]),
    );
    return "{" + pairs.join(",") + "}";
  }
  throw new Error(
    `stableStringify: value of type "${typeof obj}" is not JSON-safe`,
  );
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function candidateIntegrityHashOf(c: Candidate): string {
  return sha256Hex(stableStringify(c));
}

function packageIdFromContent(
  pkg: ReviewPackage,
): string {
  const canonical = stableStringify({
    schema_version: pkg.schema_version,
    packaged_at: pkg.packaged_at,
    candidates: pkg.candidates,
    report: pkg.report,
  });
  return sha256Hex(canonical);
}

const ENTITY_TYPE_SET: ReadonlySet<string> = new Set(SEALED_ENTITY_TYPES);
const COUNTRY_RE = /^[A-Z]{2}$/;
const PHONE_E164_RE = /^\+[1-9][0-9]{6,14}$/;
const WIKIDATA_QID_RE = /^Q[0-9]+$/;

function rule5Violation(candidate: Candidate): string | null {
  // Rule 5l · entity_type is in the sealed 9-value set (defence in
  // depth; the validator already checks this, but a bypass would be
  // caught here before any canonical write path).
  if (!ENTITY_TYPE_SET.has(candidate.entity_type)) {
    return `entity_type "${candidate.entity_type}" is not in SEALED_ENTITY_TYPES`;
  }
  // Country ISO 3166-1 alpha-2 (mirrors migration 167 ck_bc_country).
  if (!COUNTRY_RE.test(candidate.country)) {
    return `country "${candidate.country}" is not ISO 3166-1 alpha-2`;
  }
  // Name non-blank (mirrors migration 167 ck_bc_name_canonical_nonblank).
  if (candidate.identity.name_canonical.trim().length === 0) {
    return "name_canonical is blank";
  }
  // Phone E.164 if present (mirrors migration 167 ck_bc_phone_e164).
  if (
    candidate.identity.phone_e164 !== null &&
    !PHONE_E164_RE.test(candidate.identity.phone_e164)
  ) {
    return `phone_e164 "${candidate.identity.phone_e164}" does not match E.164`;
  }
  // Wikidata QID if present (mirrors migration 167 ck_bc_wikidata_qid).
  if (
    candidate.identity.wikidata_qid !== null &&
    !WIKIDATA_QID_RE.test(candidate.identity.wikidata_qid)
  ) {
    return `wikidata_qid "${candidate.identity.wikidata_qid}" does not match Q[0-9]+`;
  }
  return null;
}

function buildEvidence(
  handoff: ApprovedCandidateHandoff,
  sourceRow: SourceRegistryRow,
  verdictSummary: HandoffEvidence["resolver_verdict_summary"],
): HandoffEvidence {
  const { decision_record, candidate, review_package } = handoff;
  return {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    candidate_id: candidate.candidate_id,
    candidate_integrity_hash: decision_record.candidate_integrity_hash,
    decision_record_id: decision_record.decision_record_id,
    review_package_id: review_package.package_id,
    legacy_source: {
      table: candidate.legacy_source.table,
      ref: candidate.legacy_source.ref,
      internal_id: candidate.legacy_source.internal_id,
    },
    resolver_verdict_summary: verdictSummary,
    observation_provenance: {
      generator: candidate.generation_source.generator,
      generation_run_id: candidate.generation_source.generation_run_id,
      generated_at: candidate.generation_source.generated_at,
      decision_timestamp: decision_record.decision_timestamp,
      founder_id: decision_record.founder_id,
    },
    source_id: sourceRow.source_id,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §9 · precheckHandoff · the pure precheck
// ═════════════════════════════════════════════════════════════════════

export interface PrecheckHandoffArgs {
  readonly handoff: ApprovedCandidateHandoff;
  readonly resolver_verdict: ResolverVerdict;
  readonly source_registry_row: SourceRegistryRow;
  /** For MATCH · the current state of the target canonical row.
   *  For NO_MATCH or AMBIGUOUS · null. */
  readonly current_canonical_row_if_match: import("./canonical-row").CanonicalRow | null;
  /** For NO_MATCH with a non-null osm_id · the caller MUST pre-check
   *  the (country, osm_id) uniqueness and supply either null (no
   *  collision) or the colliding row's id. For MATCH / AMBIGUOUS /
   *  NO_MATCH-with-null-osm_id · pass null. */
  readonly existing_osm_collision_if_any:
    | { readonly canonical_business_id: string; readonly osm_id: string }
    | null;
}

export function precheckHandoff(
  args: PrecheckHandoffArgs,
): HandoffPrecheckResult {
  // §9.1 · Handoff shape
  if (args.handoff.schema_version !== HANDOFF_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: {
        kind: "invalid_handoff_schema_version",
        observed: String(args.handoff.schema_version),
      },
    };
  }

  const { decision_record, candidate, review_package, previous_decisions } =
    args.handoff;

  // §9.2 · Decision is approve
  if (decision_record.decision !== "approve") {
    return {
      ok: false,
      reason: { kind: "not_approved", decision: decision_record.decision },
    };
  }

  // §9.3 · Decision candidate_id matches supplied candidate
  if (decision_record.candidate_id !== candidate.candidate_id) {
    return {
      ok: false,
      reason: {
        kind: "decision_record_candidate_mismatch",
        decision_candidate_id: decision_record.candidate_id,
        supplied_candidate_id: candidate.candidate_id,
      },
    };
  }

  // §9.4 · Decision review_package_id matches supplied package
  if (decision_record.review_package_id !== review_package.package_id) {
    return {
      ok: false,
      reason: {
        kind: "decision_record_package_mismatch",
        decision_package_id: decision_record.review_package_id,
        supplied_package_id: review_package.package_id,
      },
    };
  }

  // §9.5 · Candidate integrity hash
  const recomputedCandidateHash = candidateIntegrityHashOf(candidate);
  if (recomputedCandidateHash !== decision_record.candidate_integrity_hash) {
    return {
      ok: false,
      reason: {
        kind: "candidate_integrity_mismatch",
        expected: decision_record.candidate_integrity_hash,
        actual: recomputedCandidateHash,
      },
    };
  }

  // §9.6 · Review package integrity
  const recomputedPackageId = packageIdFromContent(review_package);
  if (recomputedPackageId !== review_package.package_id) {
    return {
      ok: false,
      reason: {
        kind: "review_package_integrity_mismatch",
        expected: review_package.package_id,
        actual: recomputedPackageId,
      },
    };
  }

  // §9.7 · Supersession check · requires previous_decisions
  if (previous_decisions) {
    const superseding = previous_decisions.find(
      (r) => r.supersedes === decision_record.decision_record_id,
    );
    if (superseding) {
      return {
        ok: false,
        reason: {
          kind: "superseded",
          superseded_by_record_id: superseding.decision_record_id,
        },
      };
    }
  }

  // §9.8 · AMBIGUOUS always blocks · never any plan
  if (args.resolver_verdict.kind === "AMBIGUOUS") {
    return {
      ok: false,
      reason: {
        kind: "resolver_ambiguous",
        competing: args.resolver_verdict.competing.map(
          (c) => c.canonical_business_id,
        ),
        best_score: args.resolver_verdict.best_score,
      },
    };
  }

  // §9.9 · Rule-5 structural checks
  const r5 = rule5Violation(candidate);
  if (r5 !== null) {
    return { ok: false, reason: { kind: "rule_5_violation", detail: r5 } };
  }

  // §9.10 · Source permission · can_derive required
  if (!args.source_registry_row.can_derive) {
    return {
      ok: false,
      reason: {
        kind: "source_permission_denied",
        source_id: args.source_registry_row.source_id,
        flag: "can_derive",
      },
    };
  }

  // §9.11 · Branch on verdict
  if (args.resolver_verdict.kind === "MATCH") {
    const targetId = args.resolver_verdict.target_canonical_business_id;
    const row = args.current_canonical_row_if_match;

    if (!row) {
      return {
        ok: false,
        reason: {
          kind: "missing_canonical_row_for_match",
          target_canonical_business_id: targetId,
        },
      };
    }
    if (row.canonical_business_id !== targetId) {
      return {
        ok: false,
        reason: {
          kind: "match_target_mismatch",
          verdict_target: targetId,
          supplied_row_id: row.canonical_business_id,
        },
      };
    }
    // Target already superseded (lifecycle may lag · defensive check).
    if (row.superseded_by_business_id !== null) {
      return {
        ok: false,
        reason: {
          kind: "target_already_superseded",
          target_canonical_business_id: targetId,
          superseded_by_business_id: row.superseded_by_business_id,
        },
      };
    }
    // Target lifecycle writable.
    if (!isLifecycleWritable(row.lifecycle_state)) {
      return {
        ok: false,
        reason: {
          kind: "lifecycle_blocked",
          current_state: row.lifecycle_state,
          target_canonical_business_id: targetId,
        },
      };
    }

    const evidence = buildEvidence(args.handoff, args.source_registry_row, {
      kind: "MATCH",
      target_canonical_business_id: targetId,
      score: args.resolver_verdict.score,
    });
    return {
      ok: true,
      plan: {
        kind: "merge_match",
        target_canonical_business_id: targetId,
        evidence,
      },
    };
  }

  // §9.12 · NO_MATCH branch
  // (Rule-5 and permissions have already passed.)
  // If the candidate has an osm_id, the caller must have supplied the
  // existing_osm_collision_if_any field. We honour whatever they say.
  if (
    candidate.identity.osm_id !== null &&
    args.existing_osm_collision_if_any !== null
  ) {
    return {
      ok: false,
      reason: {
        kind: "osm_collision",
        existing_canonical_business_id:
          args.existing_osm_collision_if_any.canonical_business_id,
        osm_id: args.existing_osm_collision_if_any.osm_id,
      },
    };
  }

  const row: InsertCanonicalRow = {
    entity_type: candidate.entity_type,
    country: candidate.country,
    lifecycle_state: "DISCOVERED",
    name_canonical: candidate.identity.name_canonical,
    aliases: candidate.identity.aliases,
    phone_e164: candidate.identity.phone_e164,
    website_apex: candidate.identity.website_apex,
    osm_id: candidate.identity.osm_id,
    wikidata_qid: candidate.identity.wikidata_qid,
    city: candidate.identity.city,
    district: candidate.identity.district,
    street_line: candidate.identity.street_line,
    neighbourhood: candidate.identity.neighbourhood,
    address: candidate.identity.address,
    coordinates: candidate.identity.coordinates,
  };

  const evidence = buildEvidence(args.handoff, args.source_registry_row, {
    kind: "NO_MATCH",
    target_canonical_business_id: null,
    score: args.resolver_verdict.best_score,
  });
  return {
    ok: true,
    plan: { kind: "insert_new", row, evidence },
  };
}

// ═════════════════════════════════════════════════════════════════════
// §10 · Static invariants · module-level
// ═════════════════════════════════════════════════════════════════════
//
// This module is PURE. It:
//   · does NOT import pg, pg-executor, pg-fingerprint, or
//     extract-candidates
//   · does NOT import identity-matching, entity-universe, or
//     matchBusiness
//   · does NOT reference Supabase, dotenv, process.env, or fs
//   · does NOT use a clock (no Date.now, no new Date)
//   · does NOT use randomness (no Math.random, no randomUUID,
//     no randomBytes)
//   · does NOT implement executeWritePlan, canonical-insert,
//     canonicalInsert, or any DB-writing surface
//   · does NOT implement handoffReady (that was deliberately deferred
//     in approval-v1)
//
// Permitted imports: node:crypto (hash only), ./generate-candidates
// (type-only + SEALED_ENTITY_TYPES), ./candidate-approval (type-only),
// ./canonical-row (type-only + isLifecycleWritable).
