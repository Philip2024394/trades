// scripts/nex-canonical/candidate-approval.ts
//
// NEX Business Canonical · Seed-Approval Workflow · approval-v1.
//
// Pure consumer module. Takes a validated Candidate[] + ReviewReport,
// bundles them into an immutable ReviewPackage, and lets a founder
// record approve / reject / defer decisions as DecisionRecords in a
// deterministic append-only log.
//
// SCOPE
//   · Pure. No DB. No network. No filesystem. No credentials. No clock.
//     Every timestamp is caller-supplied ISO-8601.
//   · No handoff. `handoffReady` is NOT implemented in approval-v1 ·
//     the approval layer ends at "approved and auditable."
//   · No decision-log file is created by this module. The caller passes
//     text buffers to parseDecisionLog / serializeDecisionLog.
//
// SEPARATION OF CONCERNS
//   An approval record ONLY says: "founder decided this candidate
//   should / should not advance from founder review." It does NOT mean:
//     · the entity exists
//     · the identity is resolved
//     · the database row is authoritative
//     · the candidate passed ground truth
//     · the canonical seed has been inserted
//   Those remain future authorized stages (canonical-insert, resolver
//   evaluation, evidence collection, …).
//
// Permitted imports
//   · node:crypto                  (pure, hash computation only)
//   · ./generate-candidates        (sealed TYPE exports)
//   · ./candidate-reviewer         (sealed TYPE exports)
//   · ./secret-scan                (pure shared utility)
//
// Forbidden imports (grep-enforced in the test file)
//   · pg, pg-executor, pg-fingerprint, extract-candidates
//   · identity-matching, entity-universe, matchBusiness
//   · supabase, dotenv, process.env, fs, net, http

import { createHash } from "node:crypto";
import type {
  Candidate,
  EntityType,
  RiskCategory,
} from "./generate-candidates";
import type {
  Anomaly,
  AnomalyRule,
  ReviewReport,
} from "./candidate-reviewer";
import { scanForLikelyCredentials } from "./secret-scan";

// ═════════════════════════════════════════════════════════════════════
// §1 · Schema versions · literal pins
// ═════════════════════════════════════════════════════════════════════

export const APPROVAL_SCHEMA_VERSION = "approval-v1" as const;
export const DECISION_SCHEMA_VERSION = "decision-v1" as const;

/** 80% of a package's candidates triggers the wide-scope confirmation. */
export const BATCH_WIDE_SCOPE_THRESHOLD = 0.8;

/** The eight known AnomalyRule values · duplicated here as a runtime
 *  set because `AnomalyRule` is a TypeScript union with no runtime
 *  representation. Must stay in lock-step with candidate-reviewer.ts. */
const KNOWN_ANOMALY_RULES: ReadonlySet<string> = new Set<AnomalyRule>([
  "duplicate_candidate_id",
  "duplicate_legacy_source",
  "zero_risk_categories",
  "risk_rationale_mismatch",
  "score_boundary",
  "thin_identity",
  "mixed_generation_run_id",
  "mixed_generated_at",
]);

// ═════════════════════════════════════════════════════════════════════
// §2 · Public types
// ═════════════════════════════════════════════════════════════════════

export interface ReviewPackage {
  readonly schema_version: typeof APPROVAL_SCHEMA_VERSION;
  readonly packaged_at: string; // ISO-8601 UTC · caller-supplied
  readonly candidates: readonly Candidate[];
  readonly report: ReviewReport;
  /** SHA-256 hex over the canonical content of this package. Content-
   *  addressed · recomputing from the content must equal this value. */
  readonly package_id: string;
}

export interface GenerationMetadataSnapshot {
  readonly generator: string;
  readonly generation_run_id: string;
  readonly generated_at: string;
}

export type DecisionState = "approve" | "reject" | "defer";

export interface DecisionRecord {
  /** SHA-256 hex over the canonical content of this record (every field
   *  below). Content-addressed · tamper-evident per record. */
  readonly decision_record_id: string;
  readonly schema_version: typeof DECISION_SCHEMA_VERSION;
  readonly decision: DecisionState;

  // Identity bindings
  readonly candidate_id: string;
  readonly candidate_integrity_hash: string; // SHA-256 of the Candidate
  readonly review_package_id: string;

  // Founder identity (opaque to this layer)
  readonly founder_id: string;
  readonly founder_note: string | null;

  // Context snapshot (anomaly rules may evolve; snapshot what applied)
  readonly anomaly_snapshot: readonly Anomaly[];
  readonly acknowledged_anomaly_rules: readonly AnomalyRule[];
  readonly generation_metadata_snapshot: GenerationMetadataSnapshot;

  readonly decision_timestamp: string; // ISO-8601 UTC · caller-supplied

  /** Reference to the previous decision_record_id this one replaces.
   *  NOT a cryptographic chain · a supersession reference. The content-
   *  addressed decision_record_id gives per-record integrity. */
  readonly supersedes: string | null;
}

export interface BatchFilter {
  readonly entity_types?: readonly EntityType[];
  readonly risk_categories?: readonly RiskCategory[];
  readonly source_tables?: readonly string[];
  readonly countries?: readonly string[];
  readonly min_selection_score?: number;
  readonly max_selection_score?: number;
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Deferred list (parallel to the reviewer's)
// ═════════════════════════════════════════════════════════════════════

export const APPROVAL_DEFERRED_UNTIL_LATER: readonly string[] = Object.freeze([
  "Canonical business entity ID · does not exist until the canonical-insert stage",
  "Resolver confidence or match quality · the resolver has not been invoked",
  "External ground-truth verification · out of scope for approval-v1",
  "Assertion that the candidate represents a real business · approval is NOT that claim",
  "Database state about this candidate · no DB access in this layer",
  "Historical approval decisions by other founders · this layer records one founder's view",
  "DB primary key of the eventual seed row · materialised later",
  "Whether this approval will survive resolver execution · the resolver may still find a merge or reject the candidate",
  "handoffReady() boundary function · deliberately NOT implemented in approval-v1 (per design report §14) · the next stage is a separate authorization",
]);

// ═════════════════════════════════════════════════════════════════════
// §4 · Error classes · each failure category gets its own
// ═════════════════════════════════════════════════════════════════════

export class InvalidReviewPackageError extends Error {
  constructor(detail: string) {
    super(`InvalidReviewPackageError: ${detail}`);
    this.name = "InvalidReviewPackageError";
  }
}

export class InvalidTimestampError extends Error {
  constructor(field: string) {
    super(
      `InvalidTimestampError: ${field} is not a valid ISO-8601 UTC timestamp (e.g. "2026-10-08T12:00:00.000Z")`,
    );
    this.name = "InvalidTimestampError";
  }
}

export class InvalidFounderIdError extends Error {
  constructor() {
    super("InvalidFounderIdError: founder_id must be a non-empty string");
    this.name = "InvalidFounderIdError";
  }
}

export class CandidateNotInPackageError extends Error {
  readonly candidate_id: string;
  constructor(candidateId: string) {
    super(
      `CandidateNotInPackageError: candidate_id "${candidateId}" is not in the ReviewPackage`,
    );
    this.name = "CandidateNotInPackageError";
    this.candidate_id = candidateId;
  }
}

export class UnacknowledgedAnomalyError extends Error {
  readonly candidate_id: string;
  readonly anomaly_rule: AnomalyRule;
  constructor(candidateId: string, rule: AnomalyRule) {
    super(
      `UnacknowledgedAnomalyError: candidate "${candidateId}" has applicable anomaly "${rule}" that is not in acknowledged_anomaly_rules`,
    );
    this.name = "UnacknowledgedAnomalyError";
    this.candidate_id = candidateId;
    this.anomaly_rule = rule;
  }
}

export class BlanketAcknowledgmentError extends Error {
  constructor() {
    super(
      'BlanketAcknowledgmentError: acknowledged_anomaly_rules must contain explicit AnomalyRule values · "*" / "all" / "any" are not permitted',
    );
    this.name = "BlanketAcknowledgmentError";
  }
}

export class UnknownAnomalyRuleError extends Error {
  readonly rule: string;
  constructor(rule: string) {
    super(
      `UnknownAnomalyRuleError: "${rule}" is not a known AnomalyRule`,
    );
    this.name = "UnknownAnomalyRuleError";
    this.rule = rule;
  }
}

export class DuplicateCandidateIdError extends Error {
  readonly candidate_id: string;
  constructor(candidateId: string) {
    super(
      `DuplicateCandidateIdError: candidate_id "${candidateId}" appears in the duplicate_candidate_id anomaly · decisions are refused on ambiguous identity`,
    );
    this.name = "DuplicateCandidateIdError";
    this.candidate_id = candidateId;
  }
}

export class DuplicateLegacySourceNoteRequiredError extends Error {
  readonly candidate_id: string;
  constructor(candidateId: string) {
    super(
      `DuplicateLegacySourceNoteRequiredError: candidate "${candidateId}" has duplicate_legacy_source · founder_note must be non-null and non-empty`,
    );
    this.name = "DuplicateLegacySourceNoteRequiredError";
    this.candidate_id = candidateId;
  }
}

export class BugSuspectedApprovalError extends Error {
  readonly candidate_id: string;
  readonly anomaly_rule: string;
  constructor(candidateId: string, rule: string) {
    super(
      `BugSuspectedApprovalError: candidate "${candidateId}" has bug_suspected anomaly "${rule}" · approve is refused · reject or defer instead`,
    );
    this.name = "BugSuspectedApprovalError";
    this.candidate_id = candidateId;
    this.anomaly_rule = rule;
  }
}

export class MixedPackageBatchError extends Error {
  readonly anomaly_rule: AnomalyRule;
  constructor(rule: AnomalyRule) {
    super(
      `MixedPackageBatchError: ReviewPackage has set-wide anomaly "${rule}" · batch operations are refused · use decideCandidate per candidate instead`,
    );
    this.name = "MixedPackageBatchError";
    this.anomaly_rule = rule;
  }
}

export class WideScopeConfirmationError extends Error {
  readonly matched: number;
  readonly total: number;
  constructor(matched: number, total: number) {
    super(
      `WideScopeConfirmationError: batch filter matched ${matched}/${total} candidates (≥${(BATCH_WIDE_SCOPE_THRESHOLD * 100).toFixed(0)}%) · wideScopeConfirmation must be true`,
    );
    this.name = "WideScopeConfirmationError";
    this.matched = matched;
    this.total = total;
  }
}

export class BatchMissingAcknowledgmentError extends Error {
  readonly candidate_id: string;
  constructor(candidateId: string) {
    super(
      `BatchMissingAcknowledgmentError: perCandidateAcknowledgments is missing entry for candidate "${candidateId}" · implicit "ack everything" is not permitted`,
    );
    this.name = "BatchMissingAcknowledgmentError";
    this.candidate_id = candidateId;
  }
}

export class SupersedesError extends Error {
  constructor(detail: string) {
    super(`SupersedesError: ${detail}`);
    this.name = "SupersedesError";
  }
}

export class CrossCandidateSupersedesError extends Error {
  readonly previous_candidate_id: string;
  readonly new_candidate_id: string;
  constructor(previousCandidateId: string, newCandidateId: string) {
    super(
      `CrossCandidateSupersedesError: supersedes record is for candidate "${previousCandidateId}" but new decision is for "${newCandidateId}" · cross-candidate supersession is not permitted`,
    );
    this.name = "CrossCandidateSupersedesError";
    this.previous_candidate_id = previousCandidateId;
    this.new_candidate_id = newCandidateId;
  }
}

export class NoteSecretsLeakError extends Error {
  readonly field: "founder_note" | "founder_id";
  readonly findings: readonly string[];
  constructor(field: "founder_note" | "founder_id", findings: readonly string[]) {
    super(
      `NoteSecretsLeakError: ${field} contains likely credentials (${findings.join(", ")}) · refusing to record decision`,
    );
    this.name = "NoteSecretsLeakError";
    this.field = field;
    this.findings = findings;
  }
}

export class DecisionLogError extends Error {
  readonly path: string;
  constructor(path: string, detail: string) {
    super(`DecisionLogError at ${path}: ${detail}`);
    this.name = "DecisionLogError";
    this.path = path;
  }
}

export class SchemaVersionMismatchError extends Error {
  readonly expected: string;
  readonly observed: string;
  constructor(path: string, expected: string, observed: string) {
    super(
      `SchemaVersionMismatchError at ${path}: expected "${expected}" but observed "${observed}" · a decision log is pinned to one schema version`,
    );
    this.name = "SchemaVersionMismatchError";
    this.expected = expected;
    this.observed = observed;
  }
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Internal pure helpers
// ═════════════════════════════════════════════════════════════════════

/** Local copy of stableStringify · intentionally duplicated to keep the
 *  approval module isolated from the producer-side extract-candidates.
 *  Keep in behavioural sync. Pure · deterministic · fail-closed on
 *  non-JSON-safe values. */
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

/** SHA-256 hex of a UTF-8 string. Pure, deterministic. */
function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** ISO-8601 UTC pattern · requires trailing Z, allows optional
 *  fractional seconds. Fail-closed on any deviation. */
const ISO_UTC_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;

function assertIsoTimestamp(field: string, v: unknown): void {
  if (typeof v !== "string" || v.length === 0 || !ISO_UTC_RE.test(v)) {
    throw new InvalidTimestampError(field);
  }
}

function assertNonEmptyString(fail: () => Error, v: unknown): void {
  if (typeof v !== "string" || v.length === 0) throw fail();
}

function candidateIntegrityHashOf(c: Candidate): string {
  return sha256Hex(stableStringify(c));
}

function packageIdFromContent(
  schemaVersion: typeof APPROVAL_SCHEMA_VERSION,
  packagedAt: string,
  candidates: readonly Candidate[],
  report: ReviewReport,
): string {
  const canonical = stableStringify({
    schema_version: schemaVersion,
    packaged_at: packagedAt,
    candidates,
    report,
  });
  return sha256Hex(canonical);
}

function decisionRecordIdFromContent(
  d: Omit<DecisionRecord, "decision_record_id">,
): string {
  const canonical = stableStringify({
    schema_version: d.schema_version,
    decision: d.decision,
    candidate_id: d.candidate_id,
    candidate_integrity_hash: d.candidate_integrity_hash,
    review_package_id: d.review_package_id,
    founder_id: d.founder_id,
    founder_note: d.founder_note,
    anomaly_snapshot: d.anomaly_snapshot,
    acknowledged_anomaly_rules: d.acknowledged_anomaly_rules,
    generation_metadata_snapshot: d.generation_metadata_snapshot,
    decision_timestamp: d.decision_timestamp,
    supersedes: d.supersedes,
  });
  return sha256Hex(canonical);
}

/** Collect anomalies that apply to a specific candidate_id · includes
 *  set-wide anomalies (empty candidate_ids list means package-level). */
function applicableAnomalies(
  report: ReviewReport,
  candidateId: string,
): readonly Anomaly[] {
  return report.anomalies.filter(
    (a) =>
      a.candidate_ids.length === 0 || a.candidate_ids.includes(candidateId),
  );
}

/** Normalise + sanity-check an acknowledgment list · reject blanket "*"
 *  and unknown rule names before use. Returns a sorted, deduplicated
 *  readonly list. */
function normaliseAcknowledgments(
  rules: readonly AnomalyRule[],
): readonly AnomalyRule[] {
  const seen = new Set<string>();
  for (const r of rules) {
    if (typeof r !== "string") {
      throw new BlanketAcknowledgmentError();
    }
    const trimmed = r.trim().toLowerCase();
    if (trimmed === "*" || trimmed === "all" || trimmed === "any") {
      throw new BlanketAcknowledgmentError();
    }
    if (!KNOWN_ANOMALY_RULES.has(r)) {
      throw new UnknownAnomalyRuleError(r);
    }
    seen.add(r);
  }
  return [...seen].sort() as AnomalyRule[];
}

function matchesFilter(c: Candidate, f: BatchFilter): boolean {
  if (f.entity_types && !f.entity_types.includes(c.entity_type)) return false;
  if (f.risk_categories) {
    const any = c.risk_categories.some((r) =>
      f.risk_categories!.includes(r),
    );
    if (!any) return false;
  }
  if (f.source_tables && !f.source_tables.includes(c.legacy_source.table)) {
    return false;
  }
  if (f.countries && !f.countries.includes(c.country)) return false;
  if (
    f.min_selection_score !== undefined &&
    c.selection_score < f.min_selection_score
  ) {
    return false;
  }
  if (
    f.max_selection_score !== undefined &&
    c.selection_score > f.max_selection_score
  ) {
    return false;
  }
  return true;
}

function cmpDecisionOrder(a: DecisionRecord, b: DecisionRecord): number {
  if (a.decision_timestamp !== b.decision_timestamp) {
    return a.decision_timestamp < b.decision_timestamp ? -1 : 1;
  }
  if (a.decision_record_id === b.decision_record_id) return 0;
  return a.decision_record_id < b.decision_record_id ? -1 : 1;
}

// ═════════════════════════════════════════════════════════════════════
// §6 · buildReviewPackage + verifyPackageIntegrity
// ═════════════════════════════════════════════════════════════════════

export interface BuildReviewPackageArgs {
  readonly candidates: readonly Candidate[];
  readonly report: ReviewReport;
  readonly packagedAt: string; // ISO-8601 UTC
}

export function buildReviewPackage(args: BuildReviewPackageArgs): ReviewPackage {
  assertIsoTimestamp("packagedAt", args.packagedAt);
  const packageId = packageIdFromContent(
    APPROVAL_SCHEMA_VERSION,
    args.packagedAt,
    args.candidates,
    args.report,
  );
  return {
    schema_version: APPROVAL_SCHEMA_VERSION,
    packaged_at: args.packagedAt,
    candidates: args.candidates,
    report: args.report,
    package_id: packageId,
  };
}

export function verifyPackageIntegrity(pkg: ReviewPackage): void {
  if (pkg.schema_version !== APPROVAL_SCHEMA_VERSION) {
    throw new InvalidReviewPackageError(
      `schema_version is "${pkg.schema_version}", expected "${APPROVAL_SCHEMA_VERSION}"`,
    );
  }
  assertIsoTimestamp("package.packaged_at", pkg.packaged_at);
  const recomputed = packageIdFromContent(
    pkg.schema_version,
    pkg.packaged_at,
    pkg.candidates,
    pkg.report,
  );
  if (recomputed !== pkg.package_id) {
    throw new InvalidReviewPackageError(
      `package_id mismatch · recomputed=${recomputed} declared=${pkg.package_id}`,
    );
  }
}

// ═════════════════════════════════════════════════════════════════════
// §7 · decideCandidate
// ═════════════════════════════════════════════════════════════════════

export interface DecideCandidateArgs {
  readonly package: ReviewPackage;
  readonly candidateId: string;
  readonly decision: DecisionState;
  readonly founderId: string;
  readonly founderNote: string | null;
  readonly acknowledgedAnomalyRules: readonly AnomalyRule[];
  readonly decisionTimestamp: string; // ISO-8601 UTC
  readonly supersedes: string | null;
  readonly previousRecords?: readonly DecisionRecord[];
}

export function decideCandidate(args: DecideCandidateArgs): DecisionRecord {
  verifyPackageIntegrity(args.package);
  assertIsoTimestamp("decisionTimestamp", args.decisionTimestamp);
  assertNonEmptyString(() => new InvalidFounderIdError(), args.founderId);

  // Defensive credential scanning on both free-form strings.
  const idFindings = scanForLikelyCredentials(args.founderId);
  if (idFindings.length > 0) {
    throw new NoteSecretsLeakError("founder_id", idFindings);
  }
  if (args.founderNote !== null) {
    if (typeof args.founderNote !== "string") {
      throw new NoteSecretsLeakError("founder_note", ["invalid-type"]);
    }
    const noteFindings = scanForLikelyCredentials(args.founderNote);
    if (noteFindings.length > 0) {
      throw new NoteSecretsLeakError("founder_note", noteFindings);
    }
  }

  const candidate = args.package.candidates.find(
    (c) => c.candidate_id === args.candidateId,
  );
  if (!candidate) throw new CandidateNotInPackageError(args.candidateId);

  const applicable = applicableAnomalies(args.package.report, args.candidateId);

  // Duplicate candidate_id · refuse all decisions
  if (applicable.some((a) => a.rule === "duplicate_candidate_id")) {
    throw new DuplicateCandidateIdError(args.candidateId);
  }

  // Validate + normalise acknowledgments (rejects blanket, unknown rules)
  const normalisedAck = normaliseAcknowledgments(args.acknowledgedAnomalyRules);
  const ackSet = new Set<AnomalyRule>(normalisedAck);

  // Every applicable rule must be acknowledged
  for (const a of applicable) {
    if (!ackSet.has(a.rule)) {
      throw new UnacknowledgedAnomalyError(args.candidateId, a.rule);
    }
  }

  // Duplicate legacy source · require non-empty founder_note
  const hasDupLegacy = applicable.some(
    (a) => a.rule === "duplicate_legacy_source",
  );
  if (hasDupLegacy) {
    if (
      args.founderNote === null ||
      typeof args.founderNote !== "string" ||
      args.founderNote.trim().length === 0
    ) {
      throw new DuplicateLegacySourceNoteRequiredError(args.candidateId);
    }
  }

  // Bug-suspected · refuse approve
  if (args.decision === "approve") {
    const bug = applicable.find((a) => a.severity === "bug_suspected");
    if (bug) {
      throw new BugSuspectedApprovalError(args.candidateId, bug.rule);
    }
  }

  // Supersedes · format + optional semantic validation
  if (args.supersedes !== null) {
    if (!/^[a-f0-9]{64}$/.test(args.supersedes)) {
      throw new SupersedesError(
        `supersedes "${args.supersedes}" is not a 64-char sha256 hex string`,
      );
    }
    if (args.previousRecords) {
      const prev = args.previousRecords.find(
        (r) => r.decision_record_id === args.supersedes,
      );
      if (!prev) {
        throw new SupersedesError(
          `supersedes references unknown record_id "${args.supersedes}"`,
        );
      }
      if (prev.candidate_id !== args.candidateId) {
        throw new CrossCandidateSupersedesError(
          prev.candidate_id,
          args.candidateId,
        );
      }
    }
  }

  // Snapshot anomalies deterministically (sort by rule name).
  const anomalySnapshot: readonly Anomaly[] = [...applicable].sort((a, b) =>
    a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0,
  );

  const generationMetadataSnapshot: GenerationMetadataSnapshot = {
    generator: candidate.generation_source.generator,
    generation_run_id: candidate.generation_source.generation_run_id,
    generated_at: candidate.generation_source.generated_at,
  };

  const draft: Omit<DecisionRecord, "decision_record_id"> = {
    schema_version: DECISION_SCHEMA_VERSION,
    decision: args.decision,
    candidate_id: args.candidateId,
    candidate_integrity_hash: candidateIntegrityHashOf(candidate),
    review_package_id: args.package.package_id,
    founder_id: args.founderId,
    founder_note: args.founderNote,
    anomaly_snapshot: anomalySnapshot,
    acknowledged_anomaly_rules: normalisedAck,
    generation_metadata_snapshot: generationMetadataSnapshot,
    decision_timestamp: args.decisionTimestamp,
    supersedes: args.supersedes,
  };
  const id = decisionRecordIdFromContent(draft);
  return { decision_record_id: id, ...draft };
}

// ═════════════════════════════════════════════════════════════════════
// §8 · decideBatch
// ═════════════════════════════════════════════════════════════════════

export interface DecideBatchArgs {
  readonly package: ReviewPackage;
  readonly filter: BatchFilter;
  readonly decision: DecisionState;
  readonly founderId: string;
  readonly founderNote: string | null;
  readonly perCandidateAcknowledgments: ReadonlyMap<
    string,
    readonly AnomalyRule[]
  >;
  readonly decisionTimestamp: string;
  readonly wideScopeConfirmation: boolean;
}

export function decideBatch(args: DecideBatchArgs): readonly DecisionRecord[] {
  verifyPackageIntegrity(args.package);

  // Refuse mixed-generation packages at batch level
  const mixed = args.package.report.anomalies.find(
    (a) =>
      a.rule === "mixed_generation_run_id" ||
      a.rule === "mixed_generated_at",
  );
  if (mixed) throw new MixedPackageBatchError(mixed.rule);

  const matched = args.package.candidates.filter((c) =>
    matchesFilter(c, args.filter),
  );
  const total = args.package.candidates.length;
  if (total > 0 && matched.length / total >= BATCH_WIDE_SCOPE_THRESHOLD) {
    if (!args.wideScopeConfirmation) {
      throw new WideScopeConfirmationError(matched.length, total);
    }
  }

  const records: DecisionRecord[] = [];
  for (const c of matched) {
    const ack = args.perCandidateAcknowledgments.get(c.candidate_id);
    if (!ack) {
      throw new BatchMissingAcknowledgmentError(c.candidate_id);
    }
    // Delegate to decideCandidate · reuses all its guards
    // (duplicate_candidate_id, bug_suspected, acknowledgment coverage,
    //  secret scan, timestamp/founder validation, etc.).
    const record = decideCandidate({
      package: args.package,
      candidateId: c.candidate_id,
      decision: args.decision,
      founderId: args.founderId,
      founderNote: args.founderNote,
      acknowledgedAnomalyRules: ack,
      decisionTimestamp: args.decisionTimestamp,
      supersedes: null,
    });
    records.push(record);
  }
  return records;
}

// ═════════════════════════════════════════════════════════════════════
// §9 · currentStatePerCandidate
// ═════════════════════════════════════════════════════════════════════

/** Compute the current (non-superseded, latest) DecisionRecord per
 *  candidate_id. Pure · deterministic. If a candidate has multiple
 *  non-superseded records (which would indicate a founder recorded two
 *  parallel decisions without a supersedes link), the latest by
 *  (decision_timestamp, decision_record_id) wins. */
export function currentStatePerCandidate(
  records: readonly DecisionRecord[],
): ReadonlyMap<string, DecisionRecord> {
  const supersededIds = new Set<string>();
  for (const r of records) {
    if (r.supersedes !== null) supersededIds.add(r.supersedes);
  }
  const current = new Map<string, DecisionRecord>();
  for (const r of records) {
    if (supersededIds.has(r.decision_record_id)) continue;
    const existing = current.get(r.candidate_id);
    if (!existing || cmpDecisionOrder(existing, r) < 0) {
      current.set(r.candidate_id, r);
    }
  }
  return current;
}

// ═════════════════════════════════════════════════════════════════════
// §10 · parseDecisionLog + serializeDecisionLog
// ═════════════════════════════════════════════════════════════════════

/** Deterministic JSONL serialisation · one DecisionRecord per line,
 *  sorted by (decision_timestamp ASC, decision_record_id ASC), trailing
 *  newline. Keys within each record are alphabetically ordered. */
export function serializeDecisionLog(
  records: readonly DecisionRecord[],
): string {
  if (records.length === 0) return "";
  const sorted = [...records].sort(cmpDecisionOrder);
  return sorted.map((r) => stableStringify(r)).join("\n") + "\n";
}

/** Parse a JSONL buffer of DecisionRecords. Validates structural shape,
 *  recomputes the content hash, and refuses to mix schema versions in
 *  one log. Returns records in file order (serializeDecisionLog's
 *  sorted order round-trips). Throws DecisionLogError with per-line
 *  path on any invalid line. */
export function parseDecisionLog(text: string): readonly DecisionRecord[] {
  const lines = text.split("\n");
  const out: DecisionRecord[] = [];
  let seenSchemaVersion: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length === 0) continue;
    const pathPrefix = `line ${i + 1}`;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      throw new DecisionLogError(
        pathPrefix,
        `invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const record = validateDecisionRecordShape(parsed, pathPrefix);
    if (seenSchemaVersion === null) {
      seenSchemaVersion = record.schema_version;
    } else if (seenSchemaVersion !== record.schema_version) {
      throw new SchemaVersionMismatchError(
        pathPrefix,
        seenSchemaVersion,
        record.schema_version,
      );
    }
    out.push(record);
  }
  return out;
}

function validateDecisionRecordShape(
  x: unknown,
  pathPrefix: string,
): DecisionRecord {
  if (typeof x !== "object" || x === null || Array.isArray(x)) {
    throw new DecisionLogError(pathPrefix, "expected object");
  }
  const o = x as Record<string, unknown>;

  const requiredStr = (k: string): string => {
    const v = o[k];
    if (typeof v !== "string" || v.length === 0) {
      throw new DecisionLogError(`${pathPrefix}.${k}`, "expected non-empty string");
    }
    return v;
  };
  const strOrNull = (k: string): string | null => {
    const v = o[k];
    if (v === null) return null;
    if (typeof v !== "string") {
      throw new DecisionLogError(
        `${pathPrefix}.${k}`,
        "expected string or null",
      );
    }
    return v;
  };

  const decision_record_id = requiredStr("decision_record_id");
  if (!/^[a-f0-9]{64}$/.test(decision_record_id)) {
    throw new DecisionLogError(
      `${pathPrefix}.decision_record_id`,
      "not a 64-char sha256 hex string",
    );
  }
  const schema_version = requiredStr("schema_version");
  const decision = requiredStr("decision");
  if (decision !== "approve" && decision !== "reject" && decision !== "defer") {
    throw new DecisionLogError(
      `${pathPrefix}.decision`,
      `expected "approve" | "reject" | "defer", got "${decision}"`,
    );
  }
  const candidate_id = requiredStr("candidate_id");
  const candidate_integrity_hash = requiredStr("candidate_integrity_hash");
  if (!/^[a-f0-9]{64}$/.test(candidate_integrity_hash)) {
    throw new DecisionLogError(
      `${pathPrefix}.candidate_integrity_hash`,
      "not a 64-char sha256 hex string",
    );
  }
  const review_package_id = requiredStr("review_package_id");
  if (!/^[a-f0-9]{64}$/.test(review_package_id)) {
    throw new DecisionLogError(
      `${pathPrefix}.review_package_id`,
      "not a 64-char sha256 hex string",
    );
  }
  const founder_id = requiredStr("founder_id");
  const founder_note = strOrNull("founder_note");

  const anomaly_snapshot_raw = o.anomaly_snapshot;
  if (!Array.isArray(anomaly_snapshot_raw)) {
    throw new DecisionLogError(
      `${pathPrefix}.anomaly_snapshot`,
      "expected array",
    );
  }
  const anomaly_snapshot = anomaly_snapshot_raw as readonly Anomaly[];

  const ack_raw = o.acknowledged_anomaly_rules;
  if (!Array.isArray(ack_raw)) {
    throw new DecisionLogError(
      `${pathPrefix}.acknowledged_anomaly_rules`,
      "expected array",
    );
  }
  for (const r of ack_raw) {
    if (typeof r !== "string" || !KNOWN_ANOMALY_RULES.has(r)) {
      throw new DecisionLogError(
        `${pathPrefix}.acknowledged_anomaly_rules`,
        `unknown rule "${String(r)}"`,
      );
    }
  }
  const acknowledged_anomaly_rules = ack_raw as readonly AnomalyRule[];

  const genMetaRaw = o.generation_metadata_snapshot;
  if (
    typeof genMetaRaw !== "object" ||
    genMetaRaw === null ||
    Array.isArray(genMetaRaw)
  ) {
    throw new DecisionLogError(
      `${pathPrefix}.generation_metadata_snapshot`,
      "expected object",
    );
  }
  const gm = genMetaRaw as Record<string, unknown>;
  const generation_metadata_snapshot: GenerationMetadataSnapshot = {
    generator: (() => {
      if (typeof gm.generator !== "string" || gm.generator.length === 0) {
        throw new DecisionLogError(
          `${pathPrefix}.generation_metadata_snapshot.generator`,
          "expected non-empty string",
        );
      }
      return gm.generator;
    })(),
    generation_run_id: (() => {
      if (
        typeof gm.generation_run_id !== "string" ||
        gm.generation_run_id.length === 0
      ) {
        throw new DecisionLogError(
          `${pathPrefix}.generation_metadata_snapshot.generation_run_id`,
          "expected non-empty string",
        );
      }
      return gm.generation_run_id;
    })(),
    generated_at: (() => {
      if (
        typeof gm.generated_at !== "string" ||
        gm.generated_at.length === 0
      ) {
        throw new DecisionLogError(
          `${pathPrefix}.generation_metadata_snapshot.generated_at`,
          "expected non-empty string",
        );
      }
      return gm.generated_at;
    })(),
  };

  const decision_timestamp = requiredStr("decision_timestamp");
  if (!ISO_UTC_RE.test(decision_timestamp)) {
    throw new DecisionLogError(
      `${pathPrefix}.decision_timestamp`,
      "not an ISO-8601 UTC timestamp",
    );
  }

  const supersedes_raw = o.supersedes;
  let supersedes: string | null;
  if (supersedes_raw === null) {
    supersedes = null;
  } else if (
    typeof supersedes_raw === "string" &&
    /^[a-f0-9]{64}$/.test(supersedes_raw)
  ) {
    supersedes = supersedes_raw;
  } else {
    throw new DecisionLogError(
      `${pathPrefix}.supersedes`,
      "expected null or 64-char sha256 hex string",
    );
  }

  const draft: Omit<DecisionRecord, "decision_record_id"> = {
    schema_version: schema_version as typeof DECISION_SCHEMA_VERSION,
    decision: decision as DecisionState,
    candidate_id,
    candidate_integrity_hash,
    review_package_id,
    founder_id,
    founder_note,
    anomaly_snapshot,
    acknowledged_anomaly_rules,
    generation_metadata_snapshot,
    decision_timestamp,
    supersedes,
  };
  const recomputed = decisionRecordIdFromContent(draft);
  if (recomputed !== decision_record_id) {
    throw new DecisionLogError(
      `${pathPrefix}.decision_record_id`,
      `content hash mismatch · recomputed=${recomputed} stored=${decision_record_id}`,
    );
  }
  return { decision_record_id, ...draft };
}

// ═════════════════════════════════════════════════════════════════════
// §11 · Static invariants · module-level
// ═════════════════════════════════════════════════════════════════════
//
// This module is PURE. It:
//   · does NOT open a network connection
//   · does NOT read or write the filesystem
//   · does NOT read environment variables
//   · does NOT instantiate a pg Client
//   · does NOT invoke the resolver or any identity-matching surface
//   · does NOT create a CLI runner
//   · does NOT create any file artifact (no decision-log fixture)
//   · does NOT connect to Supabase or any other service
//   · does NOT use a clock (no Date.now, no new Date)
//   · does NOT use randomness
//
// Permitted imports: node:crypto (hash only), ./generate-candidates
// (TYPE-only), ./candidate-reviewer (TYPE-only), ./secret-scan (pure
// function). Forbidden imports: pg, pg-executor, pg-fingerprint,
// extract-candidates, identity-matching, entity-universe,
// matchBusiness, any supabase/dotenv/process-env/fs surface.
//
// handoffReady() is DELIBERATELY NOT IMPLEMENTED in approval-v1.
// The approval layer ends at "approved and auditable." The next stage
// (canonical-insert / evidence collection / resolver evaluation) is a
// separate authorization.
