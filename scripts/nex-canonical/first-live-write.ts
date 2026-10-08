// scripts/nex-canonical/first-live-write.ts
//
// NEX Canonical · The ONE-SHOT orchestrator for the first controlled
// live canonical write.
//
// This module is consumed by EXACTLY ONE successful canonical write
// per process invocation. It carries:
//   · the synthetic founder-authorised Candidate fixture (clearly
//     marked SYNTHETIC in its identity fields)
//   · the plan-construction helpers that build a precheck-ready
//     `CanonicalWritePlan` without going through the resolver (the
//     resolver abstains on an empty pool · for the FIRST write there
//     is nothing to resolve against, so the orchestrator produces a
//     NO_MATCH verdict synthetically with founder authorisation)
//   · a module-level one-shot latch so a second write cannot be
//     attempted in the same process
//   · a non-secret preflight printer
//   · an env-presence gate that STOPS before any connection is opened
//     if required env vars are missing
//
// IMPORTANT
//   This module exports pure helpers for construction/testing and ONE
//   async orchestration function. It does NOT auto-run when imported.
//   Running the orchestrator requires an explicit invocation through
//   the thin runner (`first-live-write-runner.ts`).

import { createHash } from "node:crypto";
import type {
  ApprovedCandidateHandoff,
  CanonicalWritePlan,
  HandoffEvidence,
  ResolverVerdict,
  SourceRegistryRow,
} from "./canonical-handoff";
import {
  EVIDENCE_SCHEMA_VERSION,
  HANDOFF_SCHEMA_VERSION,
  precheckHandoff,
} from "./canonical-handoff";
import type { Candidate } from "./generate-candidates";
import {
  APPROVAL_SCHEMA_VERSION,
  buildReviewPackage,
  DECISION_SCHEMA_VERSION,
  decideCandidate,
  type DecisionRecord,
  type ReviewPackage,
} from "./candidate-approval";
import { reviewCandidates } from "./candidate-reviewer";
import {
  executeWritePlan,
  type ExpectedFingerprint,
  type WriteExecutionReport,
  type WriteSessionFactory,
} from "./execute-write-plan";
import {
  verifyFirstWriteReadback,
  type CanonicalReadbackReport,
  type ReadbackSessionFactory,
} from "./canonical-readback";
import {
  abstained,
  answered,
  isAbstained,
  type IntelligenceResult,
} from "./intelligence-result";

// ═════════════════════════════════════════════════════════════════════
// §1 · The synthetic Candidate fixture (founder-authorised)
// ═════════════════════════════════════════════════════════════════════

/** Fixed deterministic timestamps so the compiled plan hashes are
 *  stable across runs · the orchestrator must NOT read a clock. */
export const SYNTHETIC_FIXTURE_GENERATED_AT =
  "2026-10-08T00:00:00.000Z" as const;
export const SYNTHETIC_FIXTURE_PACKAGED_AT =
  "2026-10-08T00:00:00.000Z" as const;
export const SYNTHETIC_FIXTURE_DECISION_TIMESTAMP =
  "2026-10-08T00:05:00.000Z" as const;

/** The synthetic Candidate that will produce the ONE first canonical
 *  row. Its identity fields are unmistakably test data · a human
 *  reading `nex.business_canonical` immediately sees this is a
 *  deliberate proof, not real Directory content. */
export const SYNTHETIC_FIRST_WRITE_CANDIDATE: Candidate = Object.freeze({
  candidate_id: "cand-nex-first-live-write-synthetic-2026-10-08",
  status: "pending_founder_review",
  entity_type: "food",
  country: "ID",
  identity: Object.freeze({
    name_canonical: "SYNTHETIC NEX FIRST LIVE WRITE PROOF 2026-10-08",
    aliases: Object.freeze(["Synthetic First-Write Proof"]) as unknown as readonly string[],
    phone_e164: null,
    website_apex: null,
    osm_id: null,
    wikidata_qid: null,
    city: "SYNTHETIC-CITY",
    district: null,
    // Coordinates present so the Candidate carries one medium signal;
    // keeps the fixture compatible with resolver gating semantics even
    // though the first-write path bypasses the resolver.
    coordinates: Object.freeze({ lat: -6.9, lng: 107.6 }) as unknown as {
      readonly lat: number;
      readonly lng: number;
    },
  }) as Candidate["identity"],
  legacy_source: Object.freeze({
    table: "nex.food_business",
    ref: "synthetic-ref-first-live-write-2026-10-08",
    internal_id: null,
  }) as Candidate["legacy_source"],
  risk_categories: Object.freeze(["R1"]) as unknown as readonly ["R1"],
  selection_score: 0.5,
  selection_rationale: Object.freeze([
    Object.freeze({
      risk_category: "R1",
      contribution: 0.5,
      note: "synthetic fixture · first-live-write proof · do not use for Directory production",
    }),
  ]) as unknown as readonly {
    readonly risk_category: "R1";
    readonly contribution: number;
    readonly note: string;
  }[],
  generation_source: Object.freeze({
    generator: "scripts/nex-canonical/generate-candidates.ts",
    generated_at: SYNTHETIC_FIXTURE_GENERATED_AT,
    generation_run_id: "nex-cand-first-live-write-proof-2026-10-08",
  }) as Candidate["generation_source"],
  caveats: Object.freeze([
    "SYNTHETIC FIXTURE · first canonical write proof · do not promote to Directory production content",
  ]) as unknown as readonly string[],
}) as Candidate;

/** The source_registry row the orchestrator supplies with can_derive
 *  = TRUE. This is a SYNTHETIC authorisation specific to the first
 *  proof write · it does NOT read from the DB. The founder has
 *  authorised this synthetic source for exactly ONE write. */
export const SYNTHETIC_SOURCE_REGISTRY_ROW: SourceRegistryRow = Object.freeze({
  source_id: "nex.food_business",
  source_type: "LEGACY_NEX",
  display_name: "NEX Food Business (legacy)",
  can_collect: true,
  can_store: true,
  can_display: false,
  can_derive: true, // synthetic authorisation for first proof write
  can_redistribute: false,
  attribution_required: true,
}) as SourceRegistryRow;

/** The founder id recorded in the DecisionRecord + evidence for this
 *  synthetic proof. The surrounding words "synthetic-first-write"
 *  make it unmistakable in the DB. */
export const SYNTHETIC_FOUNDER_ID =
  "philip-first-live-write-synthetic-2026-10-08" as const;

/** Fixed synthetic run id. */
export const SYNTHETIC_RUN_ID =
  "nex-cand-first-live-write-proof-2026-10-08" as const;

// ═════════════════════════════════════════════════════════════════════
// §2 · Plan construction (pure)
// ═════════════════════════════════════════════════════════════════════

export interface SyntheticPlanContext {
  readonly candidate: Candidate;
  readonly reviewPackage: ReviewPackage;
  readonly decisionRecord: DecisionRecord;
  readonly handoff: ApprovedCandidateHandoff;
  readonly plan: CanonicalWritePlan;
}

/** Build the synthetic plan context for the first live write.
 *  Pure · deterministic given the module-level fixtures. */
export function buildSyntheticFirstWritePlan(): SyntheticPlanContext {
  const candidate = SYNTHETIC_FIRST_WRITE_CANDIDATE;
  const report = reviewCandidates([candidate]);
  const pkg = buildReviewPackage({
    candidates: [candidate],
    report,
    packagedAt: SYNTHETIC_FIXTURE_PACKAGED_AT,
  });
  // Approve the Candidate · the Candidate carries only "thin_identity"
  // as an applicable anomaly (name + city + coordinates + aliases ·
  // the thin-identity rule is name-only when EVERY signal is missing).
  // With coordinates set, the Candidate is NOT thin-identity · it has
  // at least one identity signal. Still, the acknowledgment is empty
  // because no bug_suspected anomalies apply.
  const applicable = report.anomalies.filter(
    (a) =>
      a.candidate_ids.length === 0 ||
      a.candidate_ids.includes(candidate.candidate_id),
  );
  const acknowledgedRules = applicable.map((a) => a.rule);

  const decisionRecord = decideCandidate({
    package: pkg,
    candidateId: candidate.candidate_id,
    decision: "approve",
    founderId: SYNTHETIC_FOUNDER_ID,
    founderNote:
      "synthetic first-live-write proof · the Candidate is a deliberate test fixture · do not promote",
    acknowledgedAnomalyRules: acknowledgedRules,
    decisionTimestamp: SYNTHETIC_FIXTURE_DECISION_TIMESTAMP,
    supersedes: null,
  });

  const handoff: ApprovedCandidateHandoff = {
    schema_version: HANDOFF_SCHEMA_VERSION,
    decision_record: decisionRecord,
    candidate,
    review_package: pkg,
  };

  // The first write has nothing in the canonical pool · the resolver
  // would abstain. The orchestrator supplies a SYNTHETIC NO_MATCH
  // verdict directly. This is explicitly a first-write-only path.
  const resolverVerdict: ResolverVerdict = {
    kind: "NO_MATCH",
    best_score: 0,
  };

  const precheck = precheckHandoff({
    handoff,
    resolver_verdict: resolverVerdict,
    source_registry_row: SYNTHETIC_SOURCE_REGISTRY_ROW,
    current_canonical_row_if_match: null,
    existing_osm_collision_if_any: null,
  });
  if (!precheck.ok) {
    throw new Error(
      `buildSyntheticFirstWritePlan: precheckHandoff refused the synthetic plan · ${precheck.reason.kind}`,
    );
  }
  return {
    candidate,
    reviewPackage: pkg,
    decisionRecord,
    handoff,
    plan: precheck.plan,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §3 · The one-shot latch
// ═════════════════════════════════════════════════════════════════════

let CONSUMED = false;

export class OrchestratorAlreadyConsumedError extends Error {
  constructor() {
    super(
      "first-live-write: this orchestrator has already been consumed · the one-shot authorisation permits exactly ONE write per process",
    );
    this.name = "OrchestratorAlreadyConsumedError";
  }
}

/** Test-only · reset the module-level latch so unit tests can exercise
 *  the orchestrator multiple times. Must NEVER be called in production. */
export function _resetOneShotLatchForTests(): void {
  CONSUMED = false;
}

export function _isConsumedForTests(): boolean {
  return CONSUMED;
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Preflight · env presence + non-secret summary
// ═════════════════════════════════════════════════════════════════════

export const REQUIRED_WRITE_ENV_VARS: readonly string[] = Object.freeze([
  "NEX_CANONICAL_PG_HOST",
  "NEX_CANONICAL_PG_DATABASE",
  "NEX_CANONICAL_PG_USER",
  "NEX_CANONICAL_PG_PASSWORD",
  "NEX_CANONICAL_PG_EXPECTED_DATABASE",
  "NEX_CANONICAL_PG_EXPECTED_USER",
  "NEX_CANONICAL_PG_EXPECTED_SERVER_VERSION_PREFIX",
  "NEX_CANONICAL_PG_EXPECTED_SCHEMAS",
]);

export interface EnvPresenceGate {
  readonly ok: boolean;
  readonly missing: readonly string[];
  readonly present: readonly string[];
}

/** Check that the required env vars are present. Returns which NAMES
 *  are missing and which are present. NEVER returns values. */
export function checkRequiredEnvVars(
  env: NodeJS.ProcessEnv,
): EnvPresenceGate {
  const missing: string[] = [];
  const present: string[] = [];
  for (const n of REQUIRED_WRITE_ENV_VARS) {
    const raw = env[n];
    if (typeof raw === "string" && raw.length > 0) {
      present.push(n);
    } else {
      missing.push(n);
    }
  }
  return { ok: missing.length === 0, missing, present };
}

export interface PreflightSummary {
  readonly fixture_candidate_id: string;
  readonly fixture_name_canonical: string;
  readonly entity_type: string;
  readonly country: string;
  readonly source_id: string;
  readonly intended_resolver_verdict: "NO_MATCH";
  readonly intended_plan_kind: "insert_new";
  readonly expected_fingerprint_database_name: string | null;
  readonly expected_fingerprint_user_name: string | null;
  readonly expected_server_version_prefix: string | null;
  readonly expected_schemas: readonly string[];
}

/** Produce the non-secret preflight summary. Reads env var NAMES to
 *  extract the EXPECTED values (which are intentionally non-secret
 *  oracle values · they are what we EXPECT to see, not credentials). */
export function buildPreflightSummary(
  env: NodeJS.ProcessEnv,
): PreflightSummary {
  const expectedSchemasRaw = env.NEX_CANONICAL_PG_EXPECTED_SCHEMAS ?? "";
  const expectedSchemas =
    typeof expectedSchemasRaw === "string" && expectedSchemasRaw.length > 0
      ? expectedSchemasRaw
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];
  return {
    fixture_candidate_id: SYNTHETIC_FIRST_WRITE_CANDIDATE.candidate_id,
    fixture_name_canonical:
      SYNTHETIC_FIRST_WRITE_CANDIDATE.identity.name_canonical,
    entity_type: SYNTHETIC_FIRST_WRITE_CANDIDATE.entity_type,
    country: SYNTHETIC_FIRST_WRITE_CANDIDATE.country,
    source_id: SYNTHETIC_SOURCE_REGISTRY_ROW.source_id,
    intended_resolver_verdict: "NO_MATCH",
    intended_plan_kind: "insert_new",
    expected_fingerprint_database_name:
      env.NEX_CANONICAL_PG_EXPECTED_DATABASE ?? null,
    expected_fingerprint_user_name:
      env.NEX_CANONICAL_PG_EXPECTED_USER ?? null,
    expected_server_version_prefix:
      env.NEX_CANONICAL_PG_EXPECTED_SERVER_VERSION_PREFIX ?? null,
    expected_schemas: expectedSchemas,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §5 · The one-shot orchestrator
// ═════════════════════════════════════════════════════════════════════

export interface FirstLiveWriteResult {
  readonly stage: "complete";
  readonly plan_kind: "insert_new";
  readonly write_report: WriteExecutionReport;
  readonly readback_report: CanonicalReadbackReport;
  readonly readback_matches_plan: boolean;
}

export interface RunFirstLiveWriteArgs {
  readonly plan: CanonicalWritePlan;
  readonly write_session_factory: WriteSessionFactory;
  readonly readback_session_factory: ReadbackSessionFactory;
  readonly expected_fingerprint: ExpectedFingerprint;
}

/** Run the first live canonical write · one-shot · the module-level
 *  latch refuses any second attempt in the same process. */
export async function runFirstLiveCanonicalWrite(
  args: RunFirstLiveWriteArgs,
): Promise<IntelligenceResult<FirstLiveWriteResult>> {
  if (CONSUMED) {
    throw new OrchestratorAlreadyConsumedError();
  }
  CONSUMED = true;

  // Write.
  const writeResult = await executeWritePlan({
    plan: args.plan,
    session_factory: args.write_session_factory,
    expected_fingerprint: args.expected_fingerprint,
  });
  if (isAbstained(writeResult)) {
    return abstained({
      code: "write_abstained",
      message: `write did not complete: ${writeResult.reason.code}: ${writeResult.reason.message}`,
      details: { write_reason_code: writeResult.reason.code },
    });
  }
  const writeReport = writeResult.value;

  // Independent read-back.
  const readback = await verifyFirstWriteReadback({
    session_factory: args.readback_session_factory,
    plan: args.plan,
    canonical_business_id: writeReport.canonical_business_id,
    evidence_id: writeReport.evidence_id,
  });
  if (isAbstained(readback)) {
    return abstained({
      code: "readback_abstained",
      message: `write succeeded but readback could not complete: ${readback.reason.code}: ${readback.reason.message}`,
      details: {
        canonical_business_id: writeReport.canonical_business_id,
        evidence_id: writeReport.evidence_id,
      },
    });
  }
  const readbackReport = readback.value;
  const matches =
    readbackReport.canonical_row_found &&
    readbackReport.evidence_row_found &&
    readbackReport.all_fields_match &&
    readbackReport.no_duplicates;

  return answered<FirstLiveWriteResult>({
    stage: "complete",
    plan_kind: "insert_new",
    write_report: writeReport,
    readback_report: readbackReport,
    readback_matches_plan: matches,
  });
}

// ═════════════════════════════════════════════════════════════════════
// §6 · Candidate integrity hash helper (used by tests)
// ═════════════════════════════════════════════════════════════════════

/** Match the hash algorithm used in candidate-approval.ts so tests
 *  can assert the decision record's integrity hash equals this. */
export function computeCandidateIntegrityHashLocal(
  candidate: Candidate,
): string {
  return createHash("sha256")
    .update(stableStringify(candidate), "utf8")
    .digest("hex");
}

function stableStringify(obj: unknown): string {
  if (obj === null) return "null";
  if (typeof obj === "number") return JSON.stringify(obj);
  if (typeof obj === "boolean" || typeof obj === "string")
    return JSON.stringify(obj);
  if (Array.isArray(obj))
    return "[" + obj.map((e) => stableStringify(e)).join(",") + "]";
  if (typeof obj === "object") {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    return (
      "{" +
      keys
        .map(
          (k) =>
            JSON.stringify(k) +
            ":" +
            stableStringify((obj as Record<string, unknown>)[k]),
        )
        .join(",") +
      "}"
    );
  }
  throw new Error("stableStringify: unsupported value");
}
