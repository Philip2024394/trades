// src/lib/nex-agent/code-engine/processing/capability-processing-brain.ts
//
// NEX1 · Continuous Processing Brain (CPB) · founder-mission 2026-09-18.
//
// PURPOSE
//   Sit between Cortex and NEX. Ingest specialist outputs (via Cortex
//   pulses) and perform deterministic cross-specialist processing:
//     · evidence aggregation
//     · comparison
//     · conflict detection
//     · consensus measurement
//     · confidence calibration
//     · temporal comparison against own experience
//     · state assessment (CLEAR/UNCERTAIN/CONFLICTED/INSUFFICIENT/DEGRADED)
//     · validation preparation
//
// CONSTITUTIONAL BOUNDARIES
//   · zero-LLM
//   · deterministic
//   · never invents facts
//   · preserves disagreement (never erases DISAGREEMENT to fake consensus)
//   · own isolated 10-store mini-brain per Section 3
//   · own heartbeat with honest DEGRADED detection

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { registerAgent, recordHeartbeat } from "../capability-agent-registry";
import type { Analysis } from "../brb/capability-specialist-brain";

registerAgent({
  id: "processing_brain",
  name: "Continuous Processing Brain · cross-specialist processing layer",
  cognitive_layer: "processing_brain",
  description: "Deterministic processing of aggregated specialist output. Evidence aggregation · comparison · conflict detection · consensus · calibration · temporal · state assessment. Between Cortex and NEX. Recommend-only. Zero LLM.",
});

// ── Storage layout · Section 3 ─────────────────────────────────────────

const STORES = [
  "observations",
  "signals",
  "processed",
  "comparisons",
  "conflicts",
  "hypotheses",
  "outcomes",
  "experience",
] as const;

export type StoreName = (typeof STORES)[number];

export function getBrainRoot(repo_root?: string): string {
  return path.join(repo_root ?? process.cwd(), "data", "nex1-processing-brain");
}
export function getStorePath(store: StoreName, repo_root?: string): string {
  return path.join(getBrainRoot(repo_root), store + ".jsonl");
}
export function getBrainJsonPath(repo_root?: string): string {
  return path.join(getBrainRoot(repo_root), "brain.json");
}
export function getHeartbeatPath(repo_root?: string): string {
  return path.join(getBrainRoot(repo_root), "heartbeat.json");
}

// ── State + heartbeat ────────────────────────────────────────────────

export type ProcessingBrainStatus = "ACTIVE" | "IDLE" | "DEGRADED" | "STOPPED";

export interface ProcessingBrainHeartbeat {
  readonly brain_id: "processing_brain";
  readonly timestamp: string;
  readonly status: ProcessingBrainStatus;
  readonly stores_available: boolean;
  readonly store_states: Readonly<Record<StoreName, boolean>>;
  readonly session_id: string;
  readonly process_pid: number;
}

let _sessionId = crypto.randomBytes(4).toString("hex");

export function initProcessingBrain(repo_root?: string): void {
  fs.mkdirSync(getBrainRoot(repo_root), { recursive: true });
  for (const s of STORES) {
    const p = getStorePath(s, repo_root);
    if (!fs.existsSync(p)) fs.writeFileSync(p, "", "utf8");
  }
  const brainJson = {
    brain_id: "processing_brain",
    created_at: new Date().toISOString(),
    session_id: _sessionId,
    version: "cpb.v1",
    role: "processing_between_cortex_and_nex",
    zero_llm: true,
  };
  fs.writeFileSync(getBrainJsonPath(repo_root), JSON.stringify(brainJson, null, 2), "utf8");
  heartbeat(repo_root);
}

export function heartbeat(repo_root?: string): ProcessingBrainHeartbeat {
  const storeStates: Record<StoreName, boolean> = {} as Record<StoreName, boolean>;
  let allOk = true;
  for (const s of STORES) {
    const ok = fs.existsSync(getStorePath(s, repo_root));
    storeStates[s] = ok;
    if (!ok) allOk = false;
  }
  const hb: ProcessingBrainHeartbeat = {
    brain_id: "processing_brain",
    timestamp: new Date().toISOString(),
    status: allOk ? "ACTIVE" : "DEGRADED",
    stores_available: allOk,
    store_states: storeStates,
    session_id: _sessionId,
    process_pid: process.pid,
  };
  fs.writeFileSync(getHeartbeatPath(repo_root), JSON.stringify(hb, null, 2), "utf8");
  recordHeartbeat({
    agent_id: "processing_brain",
    event_type: "heartbeat",
    event_data: { status: hb.status, stores: hb.stores_available },
  });
  return hb;
}

// ── Record helpers ────────────────────────────────────────────────────

function idFor(kind: string): string { return kind + "_" + crypto.randomBytes(6).toString("hex"); }

function append(store: StoreName, record: Readonly<Record<string, unknown>>, repo_root?: string): string {
  const rec = { id: idFor(store), timestamp: new Date().toISOString(), session_id: _sessionId, ...record };
  const p = getStorePath(store, repo_root);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, JSON.stringify(rec) + "\n", "utf8");
  return rec.id;
}

export function readStore(store: StoreName, repo_root?: string): readonly Readonly<Record<string, unknown>>[] {
  const p = getStorePath(store, repo_root);
  if (!fs.existsSync(p)) return [];
  const out: Record<string, unknown>[] = [];
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line) as Record<string, unknown>); } catch { /* skip corrupted */ }
  }
  return out;
}

// ── Public API · deterministic processing operations ─────────────────

export type EvidenceState = "CLEAR" | "UNCERTAIN" | "CONFLICTED" | "INSUFFICIENT" | "DEGRADED";

export interface AggregatedEvidence {
  readonly task_id: string;
  readonly specialist_analyses: readonly Analysis[];
  readonly consensus_label: string; // from Cortex vocabulary
  readonly heartbeat_snapshot?: Readonly<Record<string, string>>;
}

export interface ProcessingResult {
  readonly id: string;
  readonly task_id: string;
  readonly evidence_state: EvidenceState;
  readonly non_null_responders: number;
  readonly total_responders: number;
  readonly distinct_kinds: readonly string[];
  readonly majority_kind: string | null;
  readonly disagreement_present: boolean;
  readonly average_confidence: number;
  readonly min_confidence: number;
  readonly max_confidence: number;
  readonly conflicts_detected: readonly Conflict[];
  readonly required_evidence_for_validation: readonly string[];
  readonly reasoning_trace: readonly string[];
  readonly confidence_calibration_hint: number | null; // null if no prior experience available
  readonly evidence_kind: "OBSERVED";
  readonly r11b_marker: "CPB_MUST_NOT_ENTER_R4_SUPPORTING_COUNT";
}

export interface Conflict {
  readonly kind: "kind_disagreement" | "confidence_polarization" | "degraded_specialist_in_pool" | "empty_response";
  readonly detail: Readonly<Record<string, unknown>>;
}

const MIN_RESPONDERS_FOR_CONFIDENCE = 2;
const CONFIDENCE_POLARIZATION_GAP = 0.5;
const HIGH_AGREEMENT_THRESHOLD = 0.75;

/**
 * Run the deterministic processing pipeline over aggregated evidence.
 * Persists per-step records to observations/comparisons/conflicts/processed.
 */
export function process(input: AggregatedEvidence, repo_root?: string): ProcessingResult {
  // 1. observations · record what we received
  const obsId = append("observations", {
    task_id: input.task_id,
    specialist_count: input.specialist_analyses.length,
    consensus_label_from_cortex: input.consensus_label,
    heartbeat_snapshot: input.heartbeat_snapshot ?? null,
  }, repo_root);

  const nonNull = input.specialist_analyses.filter((a) => a.kind !== "no_op" && a.kind !== "no_response");
  const total = input.specialist_analyses.length;

  // 2. comparisons · distinct kinds + majority
  const kindTally = new Map<string, number>();
  for (const a of nonNull) kindTally.set(a.kind, (kindTally.get(a.kind) ?? 0) + 1);
  const distinctKinds = [...kindTally.keys()].sort();
  const majorityEntry = [...kindTally.entries()].sort((a, b) => b[1] - a[1])[0];
  const majorityKind = majorityEntry ? majorityEntry[0] : null;
  const majorityShare = majorityEntry && nonNull.length > 0 ? majorityEntry[1] / nonNull.length : 0;
  const disagreementPresent = distinctKinds.length > 1;
  const compId = append("comparisons", {
    task_id: input.task_id,
    distinct_kinds: distinctKinds,
    majority_kind: majorityKind,
    majority_share: majorityShare,
    disagreement_present: disagreementPresent,
  }, repo_root);

  // 3. conflicts · deterministic detection
  const conflicts: Conflict[] = [];
  if (disagreementPresent) {
    conflicts.push({
      kind: "kind_disagreement",
      detail: { distinct_kinds: distinctKinds, majority_kind: majorityKind, majority_share: majorityShare },
    });
  }
  const confidences = nonNull.map((a) => a.confidence);
  const maxC = confidences.length > 0 ? Math.max(...confidences) : 0;
  const minC = confidences.length > 0 ? Math.min(...confidences) : 0;
  const avgC = confidences.length > 0 ? confidences.reduce((s, x) => s + x, 0) / confidences.length : 0;
  if (confidences.length >= 2 && (maxC - minC) >= CONFIDENCE_POLARIZATION_GAP) {
    conflicts.push({
      kind: "confidence_polarization",
      detail: { min: minC, max: maxC, gap: maxC - minC },
    });
  }
  if (input.heartbeat_snapshot) {
    const degraded = Object.entries(input.heartbeat_snapshot).filter(([, v]) => v === "DEGRADED").map(([k]) => k);
    if (degraded.length > 0) conflicts.push({ kind: "degraded_specialist_in_pool", detail: { degraded } });
  }
  if (nonNull.length === 0) conflicts.push({ kind: "empty_response", detail: { total } });
  for (const c of conflicts) append("conflicts", { task_id: input.task_id, ...c }, repo_root);

  // 4. state assessment
  let state: EvidenceState;
  const reasoning: string[] = [];
  const anyDegraded = conflicts.some((c) => c.kind === "degraded_specialist_in_pool");
  if (anyDegraded) {
    state = "DEGRADED";
    reasoning.push("degraded specialist present in the response pool");
  } else if (nonNull.length === 0) {
    state = "INSUFFICIENT";
    reasoning.push("no responder emitted a non-null kind");
  } else if (nonNull.length < MIN_RESPONDERS_FOR_CONFIDENCE) {
    state = "INSUFFICIENT";
    reasoning.push("responder count " + nonNull.length + " below minimum " + MIN_RESPONDERS_FOR_CONFIDENCE);
  } else if (disagreementPresent && majorityShare < 0.5) {
    state = "CONFLICTED";
    reasoning.push("no majority · " + distinctKinds.length + " distinct kinds · majority share " + majorityShare.toFixed(2));
  } else if (disagreementPresent) {
    state = "UNCERTAIN";
    reasoning.push("majority present at share " + majorityShare.toFixed(2) + " but " + distinctKinds.length + " distinct kinds");
  } else if (majorityShare >= HIGH_AGREEMENT_THRESHOLD && avgC >= 0.6) {
    state = "CLEAR";
    reasoning.push("unanimity with average confidence " + avgC.toFixed(2));
  } else {
    state = "UNCERTAIN";
    reasoning.push("unanimity but confidence below CLEAR threshold · avg " + avgC.toFixed(2));
  }

  // 5. calibration hint · read own experience for prior tasks with matching kind
  const experience = readStore("experience", repo_root);
  const priorSame = experience.filter((e) => (e as { state?: string }).state === state && (e as { majority_kind?: string }).majority_kind === majorityKind);
  const priorCorrect = priorSame.filter((e) => (e as { verdict?: string }).verdict === "correct").length;
  const priorTotal = priorSame.length;
  const calibrationHint = priorTotal > 0 ? priorCorrect / priorTotal : null;

  // 6. validation prep
  const requiredEvidence: string[] = [];
  if (state === "INSUFFICIENT") requiredEvidence.push("at_least_" + MIN_RESPONDERS_FOR_CONFIDENCE + "_specialist_responses");
  if (state === "CONFLICTED") requiredEvidence.push("tie_breaker_or_deeper_specialist_analysis");
  if (state === "DEGRADED") requiredEvidence.push("recovered_specialist_state_via_heartbeat_check");
  if (state === "UNCERTAIN" && majorityShare < HIGH_AGREEMENT_THRESHOLD) requiredEvidence.push("evidence_from_at_least_one_more_specialist");
  if (calibrationHint !== null && calibrationHint < 0.5) requiredEvidence.push("second_opinion_because_prior_calibration_below_50pct");

  const result: ProcessingResult = {
    id: idFor("proc"),
    task_id: input.task_id,
    evidence_state: state,
    non_null_responders: nonNull.length,
    total_responders: total,
    distinct_kinds: distinctKinds,
    majority_kind: majorityKind,
    disagreement_present: disagreementPresent,
    average_confidence: avgC,
    min_confidence: minC,
    max_confidence: maxC,
    conflicts_detected: conflicts,
    required_evidence_for_validation: requiredEvidence,
    reasoning_trace: reasoning,
    confidence_calibration_hint: calibrationHint,
    evidence_kind: "OBSERVED",
    r11b_marker: "CPB_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
  };
  append("processed", { ...result, source_observation_id: obsId, source_comparison_id: compId }, repo_root);

  return result;
}

/** Record an outcome for a prior processed task · updates own experience. */
export function recordOutcome(args: {
  readonly task_id: string;
  readonly processed_result: ProcessingResult;
  readonly verdict: "correct" | "wrong" | "unknown";
  readonly ground_truth?: unknown;
  readonly repo_root?: string;
}): void {
  append("outcomes", {
    task_id: args.task_id,
    verdict: args.verdict,
    ground_truth: args.ground_truth ?? null,
    processed_state: args.processed_result.evidence_state,
    processed_majority_kind: args.processed_result.majority_kind,
  }, args.repo_root);
  append("experience", {
    task_id: args.task_id,
    state: args.processed_result.evidence_state,
    majority_kind: args.processed_result.majority_kind,
    verdict: args.verdict,
    conflicts: args.processed_result.conflicts_detected.length,
  }, args.repo_root);
}

/** Emit a hypothesis · pure formatting · caller decides how to test it. */
export function emitHypothesis(args: {
  readonly statement: string;
  readonly evidence_ids: readonly string[];
  readonly confidence: number;
  readonly repo_root?: string;
}): string {
  return append("hypotheses", {
    statement: args.statement,
    evidence_ids: args.evidence_ids,
    confidence: args.confidence,
  }, args.repo_root);
}

/** Reset session identity · used for fresh-process persistence tests. */
export function _reseedSessionForTesting(newId: string): void {
  _sessionId = newId;
}

export const PROCESSING_BRAIN_VERSION = "processing-brain.v1";
