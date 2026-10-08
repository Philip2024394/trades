// scripts/nex-canonical/write-approved-candidates.ts
//
// NEX Canonical · Thin CLI that advances explicitly-authorised
// approved candidates through the sealed canonical-write pipeline.
//
// Flow (per candidate · in order · all sealed primitives · no bypass)
//   1. Load the sealed pending-review queue + decision log.
//   2. Filter to decisions whose candidate_id is on the explicit
//      operator-supplied allowlist AND whose decision is `approve`.
//      Pair each with its matching PendingReviewEntry via the
//      (candidate_id, review_package_id) composite key.
//   3. Pre-write idempotency check against nex.business_evidence by
//      decision_record_id · already-written candidates are reported
//      as `already_written` and skipped (no second insert).
//   4. For each remaining handoff:
//        a. Query sealed `nex.source_registry` for the source row.
//        b. Query the sealed canonical pool for (country, entity_type).
//        c. Call sealed `resolveCanonical(candidate, pool)` → verdict.
//        d. For MATCH, query the full CanonicalRow of the target.
//           For NO_MATCH-with-osm_id, query the (country, osm_id)
//           uniqueness collision set.
//        e. Call sealed `precheckHandoff(...)` → CanonicalWritePlan
//           or a BlockedReason.
//        f. Call sealed `executeWritePlan(plan, write_session_factory,
//           expected_fingerprint)` · the sealed executor opens a BEGIN
//           SERIALIZABLE transaction with session-level
//           default_transaction_read_only=off, runs the four
//           FINGERPRINT_QUERIES as the first stage, inserts
//           business_canonical + business_evidence, COMMITs on success,
//           ROLLBACKs on any step failure.
//        g. Call sealed `verifyFirstWriteReadback(...)` against the
//           read-only readback session · asserts exactly one canonical
//           row + exactly one evidence row for the pair, with every
//           field matching the plan.
//   5. Report per-candidate outcome · exit non-zero if any failed.
//
// What this runner does NOT do
//   · Does NOT approve, reject, or defer any candidate (approvals must
//     already live in the sealed decision log).
//   · Does NOT generate new candidates (reads from the sealed queue only).
//   · Does NOT touch nex.source_registry (reads only).
//   · Does NOT invoke decideCandidate on behalf of the founder.
//   · Does NOT write directly outside the sealed executeWritePlan path.
//   · Does NOT modify Directory UI, add categories, or add media.
//   · Does NOT silently expand beyond the operator-supplied allowlist.
//   · Does NOT retry a failed write · one attempt per plan · the sealed
//     executor's own rollback is the only recovery semantics.
//   · Does NOT re-write an already-written candidate (idempotency check
//     keyed on decision_record_id).
//   · Does NOT alter the synthetic first-live-write proof row (that
//     row's candidate_id is not on any operator allowlist · it was
//     written through a different sealed path).
//
// EXIT CODES
//   0  · all allowlisted candidates reached outcome `written_verified`
//        OR `already_written`
//   1  · preflight (env or CLI args) refused
//   2  · fingerprint mismatch during executeWritePlan
//   3  · at least one candidate failed anywhere in the pipeline (full
//        per-candidate outcomes still reported to stdout)
//  99  · unexpected error (sanitised)

import * as fs from "node:fs/promises";
import {
  parsePgReadAdapterConfigFromEnv,
  createPgReadSessionFactory,
  type ReadSession,
  type ReadSessionFactory,
} from "./pg-read-adapter";
import {
  parsePgWriteAdapterConfigFromEnv,
  createPgWriteSessionFactory,
} from "./pg-write-adapter";
import {
  createPgReadbackSessionFactory,
  verifyFirstWriteReadback,
  type CanonicalReadbackConfig,
  type CanonicalReadbackReport,
} from "./canonical-readback";
import { parseFingerprintExpectationsFromEnv } from "./pg-fingerprint";
import {
  parseDecisionLog,
  type DecisionRecord,
  type ReviewPackage,
} from "./candidate-approval";
import {
  parsePendingQueue,
  type PendingReviewEntry,
} from "./durable-approval-queue";
import {
  HANDOFF_SCHEMA_VERSION,
  precheckHandoff,
  type ApprovedCandidateHandoff,
  type HandoffPrecheckResult,
  type SourceRegistryRow,
} from "./canonical-handoff";
import { executeWritePlan } from "./execute-write-plan";
import {
  resolveCanonical,
  type ResolverVerdict,
} from "./canonical-resolver";
import type { Candidate } from "./generate-candidates";
import type {
  CanonicalResolverInput,
  CanonicalRow,
  EntityType,
  LifecycleState,
} from "./canonical-row";
import { isAbstained } from "./intelligence-result";

// Local-dev credential derivation · mirrors the pattern in
// first-live-write-runner.ts and real-ingestion-runner.ts.
function deriveSplitCredsFromUrlIfNeeded(env: NodeJS.ProcessEnv): void {
  if (env.NEX_CANONICAL_PG_HOST) return;
  const url = env.NEX_POSTGRES_URL;
  if (!url) return;
  try {
    const u = new URL(url);
    env.NEX_CANONICAL_PG_HOST = u.hostname;
    if (u.port) env.NEX_CANONICAL_PG_PORT = u.port;
    const db = u.pathname.replace(/^\//, "");
    if (db.length > 0) env.NEX_CANONICAL_PG_DATABASE = db;
    if (u.username.length > 0) {
      env.NEX_CANONICAL_PG_USER = decodeURIComponent(u.username);
    }
    if (u.password.length > 0) {
      env.NEX_CANONICAL_PG_PASSWORD = decodeURIComponent(u.password);
    }
    if (!env.NEX_CANONICAL_PG_SSL) env.NEX_CANONICAL_PG_SSL = "false";
  } catch {
    // Malformed URL · adapter config parsing fails-closed below.
  }
}

function sanitiseErr(message: string): string {
  let out = message;
  out = out.replace(
    /postgres(?:ql)?:\/\/[^:]*:[^@]*@[^\s'"]+/gi,
    "postgres://[redacted]",
  );
  out = out.replace(/password\s*=\s*['"][^'"]*['"]/gi, "password=[redacted]");
  out = out.replace(/password\s*=\s*\S+/gi, "password=[redacted]");
  return out;
}

// ═════════════════════════════════════════════════════════════════════
// §1 · CLI
// ═════════════════════════════════════════════════════════════════════

export interface CliArgs {
  readonly allowlist: readonly string[];
  readonly pendingQueuePath: string;
  readonly decisionLogPath: string;
}

export class CliArgError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliArgError";
  }
}

function readArg(argv: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const a of argv) {
    if (a.startsWith(prefix)) return a.slice(prefix.length);
  }
  return undefined;
}

export function parseCliArgs(argv: readonly string[]): CliArgs {
  const rest = argv.slice(2);
  const allowlistRaw = readArg(rest, "allowlist");
  if (allowlistRaw === undefined || allowlistRaw.length === 0) {
    throw new CliArgError(
      "missing required CLI arg --allowlist=<comma-separated candidate_ids>",
    );
  }
  const allowlist = allowlistRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (allowlist.length === 0) {
    throw new CliArgError("--allowlist must contain at least one candidate_id");
  }
  const pendingQueuePath = readArg(rest, "pending-queue");
  if (!pendingQueuePath) {
    throw new CliArgError("missing required CLI arg --pending-queue=<path>");
  }
  const decisionLogPath = readArg(rest, "decision-log");
  if (!decisionLogPath) {
    throw new CliArgError("missing required CLI arg --decision-log=<path>");
  }
  return { allowlist, pendingQueuePath, decisionLogPath };
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Pure join · operator-explicit · fail-closed on surprise state
// ═════════════════════════════════════════════════════════════════════

export type JoinOutcome =
  | {
      readonly outcome: "ready";
      readonly candidate_id: string;
      readonly handoff: ApprovedCandidateHandoff;
    }
  | {
      readonly outcome: "no_decision_in_log";
      readonly candidate_id: string;
      readonly reason: string;
    }
  | {
      readonly outcome: "not_approve_in_log";
      readonly candidate_id: string;
      readonly observed_decision: string;
      readonly reason: string;
    }
  | {
      readonly outcome: "no_matching_queue_entry";
      readonly candidate_id: string;
      readonly expected_review_package_id: string;
      readonly reason: string;
    }
  | {
      readonly outcome: "candidate_not_in_review_package";
      readonly candidate_id: string;
      readonly review_package_id: string;
      readonly reason: string;
    };

export interface JoinResult {
  readonly outcomes: readonly JoinOutcome[];
  /** Candidate ids that appear in the decision log as approve but are
   *  NOT on the operator allowlist · reported for visibility only ·
   *  this runner refuses to touch them. */
  readonly approved_outside_allowlist: readonly string[];
}

/** Pure · operator-explicit join. For each allowlisted candidate_id,
 *  find its current approve decision in the sealed decision log and
 *  pair it with the matching PendingReviewEntry. Returns one outcome
 *  per allowlist entry · never silently drops. */
export function joinApprovedForWrite(args: {
  readonly allowlist: readonly string[];
  readonly decisions: readonly DecisionRecord[];
  readonly pending: readonly PendingReviewEntry[];
}): JoinResult {
  const { allowlist, decisions, pending } = args;

  // Precompute: supersedes graph · current decision per candidate.
  const supersededIds = new Set<string>();
  for (const r of decisions) {
    if (r.supersedes !== null) supersededIds.add(r.supersedes);
  }
  const latestByCandidate = new Map<string, DecisionRecord>();
  for (const r of decisions) {
    if (supersededIds.has(r.decision_record_id)) continue;
    const prev = latestByCandidate.get(r.candidate_id);
    if (
      prev === undefined ||
      prev.decision_timestamp < r.decision_timestamp ||
      (prev.decision_timestamp === r.decision_timestamp &&
        prev.decision_record_id < r.decision_record_id)
    ) {
      latestByCandidate.set(r.candidate_id, r);
    }
  }

  // Precompute: pending by composite key.
  const pendingByKey = new Map<string, PendingReviewEntry>();
  for (const p of pending) {
    pendingByKey.set(`${p.candidate_id}::${p.review_package_id}`, p);
  }

  const allowSet = new Set(allowlist);
  const outcomes: JoinOutcome[] = [];
  for (const candidate_id of allowlist) {
    const dec = latestByCandidate.get(candidate_id);
    if (!dec) {
      outcomes.push({
        outcome: "no_decision_in_log",
        candidate_id,
        reason:
          "no current (non-superseded) DecisionRecord found for this candidate_id · the operator may have omitted the approve step",
      });
      continue;
    }
    if (dec.decision !== "approve") {
      outcomes.push({
        outcome: "not_approve_in_log",
        candidate_id,
        observed_decision: dec.decision,
        reason: `current DecisionRecord has decision="${dec.decision}" · only approve can proceed to canonical write`,
      });
      continue;
    }
    const entry = pendingByKey.get(
      `${candidate_id}::${dec.review_package_id}`,
    );
    if (!entry) {
      outcomes.push({
        outcome: "no_matching_queue_entry",
        candidate_id,
        expected_review_package_id: dec.review_package_id,
        reason:
          "DecisionRecord references a review_package_id that is not present in the pending-review queue · cannot reconstruct the ReviewPackage the founder saw",
      });
      continue;
    }
    const candidate = entry.review_package.candidates.find(
      (c) => c.candidate_id === candidate_id,
    );
    if (!candidate) {
      outcomes.push({
        outcome: "candidate_not_in_review_package",
        candidate_id,
        review_package_id: dec.review_package_id,
        reason:
          "the matched ReviewPackage does not contain the named candidate · queue state is inconsistent",
      });
      continue;
    }
    const handoff: ApprovedCandidateHandoff = {
      schema_version: HANDOFF_SCHEMA_VERSION,
      decision_record: dec,
      candidate,
      review_package: entry.review_package,
      previous_decisions: decisions,
    };
    outcomes.push({ outcome: "ready", candidate_id, handoff });
  }

  // Visibility: approvals in the log that fall outside the allowlist.
  const approved_outside_allowlist: string[] = [];
  for (const [cid, r] of latestByCandidate) {
    if (!allowSet.has(cid) && r.decision === "approve") {
      approved_outside_allowlist.push(cid);
    }
  }
  approved_outside_allowlist.sort();

  return { outcomes, approved_outside_allowlist };
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Live providers · all backed by the sealed read factory
// ═════════════════════════════════════════════════════════════════════

async function fetchSourceRegistryRow(
  session: ReadSession,
  source_id: string,
): Promise<SourceRegistryRow | null> {
  const r = await session.query<{
    source_id: string;
    source_type: string;
    display_name: string;
    can_collect: boolean;
    can_store: boolean;
    can_display: boolean;
    can_derive: boolean;
    can_redistribute: boolean;
    attribution_required: boolean;
  }>(
    `SELECT source_id, source_type, display_name,
            can_collect, can_store, can_display, can_derive,
            can_redistribute, attribution_required
     FROM nex.source_registry WHERE source_id = $1 LIMIT 1`,
    [source_id],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    source_id: row.source_id,
    source_type: row.source_type,
    display_name: row.display_name,
    can_collect: row.can_collect,
    can_store: row.can_store,
    can_display: row.can_display,
    can_derive: row.can_derive,
    can_redistribute: row.can_redistribute,
    attribution_required: row.attribution_required,
  };
}

interface CanonicalPoolRow {
  canonical_business_id: string;
  entity_type: string;
  country: string;
  name_canonical: string;
  name_norm: string;
  aliases: string[];
  phone_e164: string | null;
  website_apex: string | null;
  osm_id: string | null;
  wikidata_qid: string | null;
  city: string | null;
  coordinates_lat: number | null;
  coordinates_lng: number | null;
}

async function fetchCanonicalPool(
  session: ReadSession,
  country: string,
  entity_type: string,
): Promise<readonly CanonicalResolverInput[]> {
  const r = await session.query<CanonicalPoolRow>(
    `SELECT canonical_business_id, entity_type, country,
            name_canonical, name_norm, aliases,
            phone_e164, website_apex, osm_id, wikidata_qid, city,
            ST_Y(coordinates::geometry) AS coordinates_lat,
            ST_X(coordinates::geometry) AS coordinates_lng
     FROM nex.business_canonical
     WHERE country = $1 AND entity_type = $2
       AND lifecycle_state <> 'SUPERSEDED'`,
    [country, entity_type],
  );
  return r.rows.map((row) => ({
    canonical_business_id: row.canonical_business_id,
    entity_type: row.entity_type as EntityType,
    country: row.country,
    name_canonical: row.name_canonical,
    name_norm: row.name_norm,
    aliases: row.aliases ?? [],
    phone_e164: row.phone_e164,
    website_apex: row.website_apex,
    osm_id: row.osm_id,
    wikidata_qid: row.wikidata_qid,
    city: row.city,
    coordinates:
      row.coordinates_lat !== null && row.coordinates_lng !== null
        ? { lat: row.coordinates_lat, lng: row.coordinates_lng }
        : null,
  }));
}

async function fetchCanonicalRowById(
  session: ReadSession,
  canonical_business_id: string,
): Promise<CanonicalRow | null> {
  const r = await session.query<{
    canonical_business_id: string;
    entity_type: string;
    country: string;
    lifecycle_state: string;
    name_canonical: string;
    name_norm: string;
    aliases: string[];
    phone_e164: string | null;
    website_apex: string | null;
    osm_id: string | null;
    wikidata_qid: string | null;
    city: string | null;
    district: string | null;
    coordinates_lat: number | null;
    coordinates_lng: number | null;
    supersedes_business_id: string | null;
    superseded_by_business_id: string | null;
    last_verified_at: string | null;
  }>(
    `SELECT canonical_business_id, entity_type, country, lifecycle_state,
            name_canonical, name_norm, aliases,
            phone_e164, website_apex, osm_id, wikidata_qid,
            city, district,
            ST_Y(coordinates::geometry) AS coordinates_lat,
            ST_X(coordinates::geometry) AS coordinates_lng,
            supersedes_business_id, superseded_by_business_id,
            last_verified_at
     FROM nex.business_canonical WHERE canonical_business_id = $1 LIMIT 1`,
    [canonical_business_id],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    canonical_business_id: row.canonical_business_id,
    entity_type: row.entity_type as EntityType,
    country: row.country,
    lifecycle_state: row.lifecycle_state as LifecycleState,
    name_canonical: row.name_canonical,
    name_norm: row.name_norm,
    aliases: row.aliases ?? [],
    phone_e164: row.phone_e164,
    website_apex: row.website_apex,
    osm_id: row.osm_id,
    wikidata_qid: row.wikidata_qid,
    city: row.city,
    district: row.district,
    coordinates:
      row.coordinates_lat !== null && row.coordinates_lng !== null
        ? { lat: row.coordinates_lat, lng: row.coordinates_lng }
        : null,
    supersedes_business_id: row.supersedes_business_id,
    superseded_by_business_id: row.superseded_by_business_id,
    last_verified_at: row.last_verified_at,
  };
}

async function fetchOsmCollision(
  session: ReadSession,
  country: string,
  osm_id: string,
): Promise<
  { readonly canonical_business_id: string; readonly osm_id: string } | null
> {
  const r = await session.query<{
    canonical_business_id: string;
    osm_id: string;
  }>(
    `SELECT canonical_business_id, osm_id FROM nex.business_canonical
     WHERE country = $1 AND osm_id = $2 LIMIT 1`,
    [country, osm_id],
  );
  const row = r.rows[0];
  return row ? { canonical_business_id: row.canonical_business_id, osm_id: row.osm_id } : null;
}

async function alreadyWrittenEvidenceId(
  session: ReadSession,
  decision_record_id: string,
): Promise<string | null> {
  const r = await session.query<{
    evidence_id: string;
    canonical_business_id: string;
  }>(
    `SELECT evidence_id, canonical_business_id FROM nex.business_evidence
     WHERE decision_record_id = $1 LIMIT 1`,
    [decision_record_id],
  );
  const row = r.rows[0];
  return row ? row.canonical_business_id : null;
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Per-candidate execution
// ═════════════════════════════════════════════════════════════════════

export type PerCandidateOutcome =
  | {
      readonly candidate_id: string;
      readonly stage: "written_verified";
      readonly canonical_business_id: string;
      readonly evidence_id: string;
      readonly resolver_verdict: "MATCH" | "NO_MATCH";
      readonly plan_kind: string;
      readonly readback_all_fields_match: boolean;
      readonly readback_no_duplicates: boolean;
    }
  | {
      readonly candidate_id: string;
      readonly stage: "already_written";
      readonly canonical_business_id: string;
      readonly reason: string;
    }
  | {
      readonly candidate_id: string;
      readonly stage: "join_blocked";
      readonly reason_kind: string;
      readonly reason: string;
    }
  | {
      readonly candidate_id: string;
      readonly stage: "resolver_abstained" | "precheck_blocked" | "write_abstained" | "readback_failed";
      readonly reason_kind: string;
      readonly reason: string;
    }
  | {
      readonly candidate_id: string;
      readonly stage: "source_registry_missing";
      readonly source_id: string;
      readonly reason: string;
    };

interface ExecDeps {
  readonly readSession: ReadSession;
  readonly writeSessionFactory: import("./execute-write-plan").WriteSessionFactory;
  readonly readbackSessionFactory: import("./canonical-readback").ReadbackSessionFactory;
  readonly expectedFingerprint: import("./pg-fingerprint").FingerprintExpectations;
}

async function executeOneHandoff(
  handoff: ApprovedCandidateHandoff,
  deps: ExecDeps,
): Promise<PerCandidateOutcome> {
  const candidate: Candidate = handoff.candidate;
  const candidate_id = candidate.candidate_id;
  const decision = handoff.decision_record;

  // §4.1 · Idempotency pre-check keyed on decision_record_id.
  const existingCanonicalId = await alreadyWrittenEvidenceId(
    deps.readSession,
    decision.decision_record_id,
  );
  if (existingCanonicalId !== null) {
    return {
      candidate_id,
      stage: "already_written",
      canonical_business_id: existingCanonicalId,
      reason: "an evidence row already exists in nex.business_evidence for this decision_record_id · leaving the prior write intact",
    };
  }

  // §4.2 · Source permission row. The sealed decision_record itself
  // does not carry source_id; the source_id lives on the evidence row
  // (built from the candidate's legacy_source.table during buildEvidence).
  // We re-derive the source_id from the sealed Candidate's
  // legacy_source + the sealed adapter's declared slug, then look up
  // the registry row.
  const sourceId = deriveSourceIdForCandidate(candidate);
  const sourceRowReal = await fetchSourceRegistryRow(deps.readSession, sourceId);
  if (!sourceRowReal) {
    return {
      candidate_id,
      stage: "source_registry_missing",
      source_id: sourceId,
      reason:
        "no row in nex.source_registry for the derived source_id · the operator must register the source before any write",
    };
  }

  // §4.3 · Resolver pool.
  const pool = await fetchCanonicalPool(
    deps.readSession,
    candidate.country,
    candidate.entity_type,
  );
  const resolverResult = resolveCanonical({ candidate, pool });
  if (isAbstained(resolverResult)) {
    return {
      candidate_id,
      stage: "resolver_abstained",
      reason_kind: resolverResult.reason.code,
      reason: resolverResult.reason.message,
    };
  }
  const verdict: ResolverVerdict = resolverResult.value;

  // §4.4 · MATCH-side current canonical row.
  let currentRow: CanonicalRow | null = null;
  if (verdict.kind === "MATCH") {
    currentRow = await fetchCanonicalRowById(
      deps.readSession,
      verdict.target_canonical_business_id,
    );
  }

  // §4.5 · NO_MATCH-with-osm_id collision check.
  let osmCollision:
    | { readonly canonical_business_id: string; readonly osm_id: string }
    | null = null;
  if (verdict.kind === "NO_MATCH" && candidate.identity.osm_id !== null) {
    osmCollision = await fetchOsmCollision(
      deps.readSession,
      candidate.country,
      candidate.identity.osm_id,
    );
  }

  // §4.6 · Precheck.
  const pre: HandoffPrecheckResult = precheckHandoff({
    handoff,
    resolver_verdict: verdict,
    source_registry_row: sourceRowReal,
    current_canonical_row_if_match: currentRow,
    existing_osm_collision_if_any: osmCollision,
  });
  if (!pre.ok) {
    return {
      candidate_id,
      stage: "precheck_blocked",
      reason_kind: pre.reason.kind,
      reason: `precheckHandoff refused · ${pre.reason.kind}`,
    };
  }

  // §4.7 · Execute · per-plan BEGIN/COMMIT inside the sealed executor.
  const writeResult = await executeWritePlan({
    plan: pre.plan,
    session_factory: deps.writeSessionFactory,
    expected_fingerprint: deps.expectedFingerprint,
  });
  if (isAbstained(writeResult)) {
    return {
      candidate_id,
      stage: "write_abstained",
      reason_kind: writeResult.reason.code,
      reason: writeResult.reason.message,
    };
  }
  const writeReport = writeResult.value;

  // §4.8 · Readback.
  const readbackResult = await verifyFirstWriteReadback({
    session_factory: deps.readbackSessionFactory,
    plan: pre.plan,
    canonical_business_id: writeReport.canonical_business_id,
    evidence_id: writeReport.evidence_id,
  });
  if (isAbstained(readbackResult)) {
    return {
      candidate_id,
      stage: "readback_failed",
      reason_kind: readbackResult.reason.code,
      reason: readbackResult.reason.message,
    };
  }
  const rb: CanonicalReadbackReport = readbackResult.value;
  if (!rb.canonical_row_found || !rb.evidence_row_found || !rb.all_fields_match || !rb.no_duplicates) {
    return {
      candidate_id,
      stage: "readback_failed",
      reason_kind: "readback_assertion_failed",
      reason:
        `canonical_found=${rb.canonical_row_found} evidence_found=${rb.evidence_row_found} ` +
        `fields_match=${rb.all_fields_match} no_duplicates=${rb.no_duplicates}`,
    };
  }

  return {
    candidate_id,
    stage: "written_verified",
    canonical_business_id: writeReport.canonical_business_id,
    evidence_id: writeReport.evidence_id,
    resolver_verdict: verdict.kind,
    plan_kind: writeReport.kind,
    readback_all_fields_match: rb.all_fields_match,
    readback_no_duplicates: rb.no_duplicates,
  };
}

/** The source_id on an evidence row is derived from the candidate's
 *  `legacy_source.table`. The sealed adapter for the real food-business
 *  path registers itself as `nex_food_business_legacy` · the mapping
 *  table→source_id lives in the adapter module (`source-legacy-food-
 *  business.ts`) via `LEGACY_FOOD_SOURCE_ID`. For this one-wave runner
 *  we hard-code the single supported mapping · future adapters will
 *  extend the switch. Fail-closed on an unknown table. */
function deriveSourceIdForCandidate(candidate: Candidate): string {
  const t = candidate.legacy_source.table;
  if (t === "nex.food_business") return "nex_food_business_legacy";
  return `__unknown_source_for_table__:${t}`;
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Main
// ═════════════════════════════════════════════════════════════════════

async function readTextOrEmpty(path: string): Promise<string> {
  try {
    return await fs.readFile(path, "utf8");
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : null;
    if (code === "ENOENT") return "";
    throw err;
  }
}

async function main(): Promise<number> {
  // 5.1 Parse CLI args.
  let cli: CliArgs;
  try {
    cli = parseCliArgs(process.argv);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(`write-approved-candidates · ${msg}`);
    // eslint-disable-next-line no-console
    console.error(
      "usage: tsx scripts/nex-canonical/write-approved-candidates.ts \\\n" +
        "  --allowlist=<csv-of-candidate_ids> \\\n" +
        "  --pending-queue=<path> \\\n" +
        "  --decision-log=<path>",
    );
    return 1;
  }

  deriveSplitCredsFromUrlIfNeeded(process.env);

  // 5.2 Build sealed factories.
  const readConfig = parsePgReadAdapterConfigFromEnv(process.env);
  const writeConfig = parsePgWriteAdapterConfigFromEnv(process.env);
  const readbackConfig: CanonicalReadbackConfig = {
    host: readConfig.host,
    port: readConfig.port,
    database: readConfig.database,
    user: readConfig.user,
    password: readConfig.password,
    ssl: readConfig.ssl,
    statementTimeoutMs: readConfig.statementTimeoutMs,
    connectionTimeoutMillis: readConfig.connectionTimeoutMillis,
  };
  const expectedFingerprint = parseFingerprintExpectationsFromEnv(process.env);

  const readFactory: ReadSessionFactory = createPgReadSessionFactory(readConfig);
  const writeSessionFactory = createPgWriteSessionFactory(writeConfig);
  const readbackSessionFactory = createPgReadbackSessionFactory(readbackConfig);

  // 5.3 Load pending + decisions.
  const pendingText = await readTextOrEmpty(cli.pendingQueuePath);
  const pending =
    pendingText.length > 0 ? parsePendingQueue(pendingText) : [];
  const decisionText = await readTextOrEmpty(cli.decisionLogPath);
  const decisions =
    decisionText.length > 0 ? parseDecisionLog(decisionText) : [];

  // 5.4 Pure join.
  const join = joinApprovedForWrite({
    allowlist: cli.allowlist,
    decisions,
    pending,
  });

  // eslint-disable-next-line no-console
  console.log("=== write-approved-candidates ===");
  // eslint-disable-next-line no-console
  console.log(
    `allowlist_size      : ${cli.allowlist.length}\n` +
      `pending_queue_lines : ${pending.length}\n` +
      `decision_log_lines  : ${decisions.length}\n` +
      `join_ready          : ${join.outcomes.filter((o) => o.outcome === "ready").length}\n` +
      `approvals_outside_allowlist: ${join.approved_outside_allowlist.length}` +
      (join.approved_outside_allowlist.length > 0
        ? `\n  (visible only · this runner will not touch them: ${join.approved_outside_allowlist.join(", ")})`
        : ""),
  );

  // 5.5 Open a single read session for the duration of the loop.
  const readSession = await readFactory.openSession();
  const perCandidate: PerCandidateOutcome[] = [];
  try {
    for (const outcome of join.outcomes) {
      if (outcome.outcome !== "ready") {
        perCandidate.push({
          candidate_id: outcome.candidate_id,
          stage: "join_blocked",
          reason_kind: outcome.outcome,
          reason:
            "reason" in outcome ? outcome.reason : "join refused this candidate",
        });
        continue;
      }
      const res = await executeOneHandoff(outcome.handoff, {
        readSession,
        writeSessionFactory,
        readbackSessionFactory,
        expectedFingerprint,
      });
      perCandidate.push(res);
    }
  } finally {
    await readFactory.closeSession(readSession);
  }

  // 5.6 Report.
  const summary = {
    total: perCandidate.length,
    written_verified: perCandidate.filter((o) => o.stage === "written_verified").length,
    already_written: perCandidate.filter((o) => o.stage === "already_written").length,
    join_blocked: perCandidate.filter((o) => o.stage === "join_blocked").length,
    resolver_abstained: perCandidate.filter((o) => o.stage === "resolver_abstained").length,
    precheck_blocked: perCandidate.filter((o) => o.stage === "precheck_blocked").length,
    write_abstained: perCandidate.filter((o) => o.stage === "write_abstained").length,
    readback_failed: perCandidate.filter((o) => o.stage === "readback_failed").length,
    source_registry_missing: perCandidate.filter((o) => o.stage === "source_registry_missing").length,
  };
  // eslint-disable-next-line no-console
  console.log("=== outcomes ===");
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ summary, outcomes: perCandidate }, null, 2));

  const terminalFailure =
    summary.join_blocked +
    summary.resolver_abstained +
    summary.precheck_blocked +
    summary.write_abstained +
    summary.readback_failed +
    summary.source_registry_missing;
  if (terminalFailure > 0) return 3;
  return 0;
}

const isDirectRun =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  /write-approved-candidates(?:\.(?:ts|js|mts|cts|mjs))?$/.test(process.argv[1]);
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(
        "write-approved-candidates · UNEXPECTED ERROR · " +
          sanitiseErr(err instanceof Error ? err.message : String(err)),
      );
      process.exit(99);
    });
}
