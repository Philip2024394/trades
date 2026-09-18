// src/lib/nex-agent/code-engine/investigation-conclusion-store.ts
//
// NEX1 · Fix 17 · Parallel JSONL persistence for Q8 investigation conclusions.
// Deterministic · append-only · zero LLM · read-write to `data/nex1-
// investigation-conclusions/entries.jsonl` ONLY. No modification of any
// other file · no execution · no broker call · no WO-04 · no Ed25519.
//
// Founder authorization: Fix 17 Build Authorization (2026-09-17) · scope
// α REPORTING + γ-2 PERSISTENCE. Q8 policy V1 FOUNDER_APPROVED · Q8
// mechanism (Fix 16) UNCHANGED.
//
// SAFETY (defence-in-depth per §9):
//   · Append-only · never overwrites existing rows
//   · Deterministic record structure per §8 minimum fields
//   · Provenance preserved · not fabricated
//   · No modification / execution / authority escalation authority
//   · Persistence failure NEVER converts silently to success
//   · Zero external-model calls
//
// TYPE-LOCKED (mirrors Fix 15/16 invariants):
//   · evidence_kind preserved from Fix 16 · never PROVEN
//   · policy_id / policy_version explicit · Q8 identity distinct from Q7
//   · forbidden-causal-vocab check on any templated string
//
// SELECTION states (from Fix 16 · V1 Q8 policy §3):
//   SELECTED · NO_SELECTION · TIE · INSUFFICIENT_EVIDENCE ·
//   UNRESOLVED · REQUIRE_MORE_INVESTIGATION

import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import type { CandidateSelection } from "./capability-candidate-selector";

// ── Public shape ────────────────────────────────────────────────────────

/** One JSONL row · one Q8 selection per scope · matches §8 minimum fields
 *  + entry_id + timestamp + evidence_kind lock. */
export interface InvestigationConclusionEntry {
  readonly entry_id: string;
  readonly timestamp: string;
  readonly investigation_id: string | null;
  readonly trace_id: string | null;
  readonly source_file: string;
  readonly selection_state: CandidateSelection["selection_state"];
  readonly selected_candidate: string | null;
  readonly candidates_considered: readonly string[];
  readonly rankings_reference: CandidateSelection["rankings_reference"];
  readonly supporting_evidence_ids: readonly string[];
  readonly contradicting_evidence_ids: readonly string[];
  readonly insufficient_evidence_ids: readonly string[];
  readonly unresolved_evidence_ids: readonly string[];
  readonly decision_reason: string;
  readonly confidence: number;
  readonly provenance: readonly { source_file: string; start_line: number; end_line: number }[];
  readonly policy_id: "NEX1_Q8_SELECTION_POLICY";
  readonly policy_version: "V1";
  readonly uncertainty: string | null;
  readonly recommended_next_action: string;
  readonly evidence_kind: "INFERRED";
}

export interface AppendConclusionsInput {
  readonly selections: readonly CandidateSelection[];
  readonly repo_root?: string;
}

export interface AppendConclusionsResult {
  readonly ok: boolean;
  readonly path: string;
  readonly appended_entry_ids: readonly string[];
  readonly errors: readonly string[];
  readonly rejected_forbidden_word: number;
  readonly rejected_non_inferred: number;
}

// ── Constants ────────────────────────────────────────────────────────────

/** Defence-in-depth · reject records whose templated strings contain
 *  causal vocabulary (Q8 output is INFERRED · never PROVEN causal claim). */
const FORBIDDEN_CAUSAL_TOKENS = [
  "causes",
  "caused by",
  "therefore",
  "root cause is",
  "responsible for",
  "leads to",
  "results in",
  "because",
];

function containsForbiddenCausal(text: string): string | null {
  const lower = text.toLowerCase();
  for (const t of FORBIDDEN_CAUSAL_TOKENS) {
    if (lower.includes(t)) return t;
  }
  return null;
}

// ── Path resolution ─────────────────────────────────────────────────────

/** Store path is deliberately parallel to nex-code-brain · does NOT
 *  extend that schema (Decision 2 constitutional-boundary preserved). */
export function getConclusionsStorePath(repoRoot?: string): string {
  const root = repoRoot ?? process.cwd();
  return path.join(root, "data", "nex1-investigation-conclusions", "entries.jsonl");
}

// ── Entry construction ──────────────────────────────────────────────────

/** Deterministic-ish unique id · same pattern as nex-code-brain's newEntryId.
 *  Timestamp component + 3 random bytes · used for provenance auditability. */
function newEntryId(): string {
  return `q8-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(3).toString("hex")}`;
}

function toEntry(sel: CandidateSelection): InvestigationConclusionEntry {
  return {
    entry_id: newEntryId(),
    timestamp: new Date().toISOString(),
    investigation_id: sel.investigation_id,
    trace_id: sel.trace_id,
    source_file: sel.source_file,
    selection_state: sel.selection_state,
    selected_candidate: sel.selected_candidate,
    candidates_considered: sel.candidates_considered,
    rankings_reference: sel.rankings_reference,
    supporting_evidence_ids: sel.supporting_evidence_ids,
    contradicting_evidence_ids: sel.contradicting_evidence_ids,
    insufficient_evidence_ids: sel.insufficient_evidence_ids,
    unresolved_evidence_ids: sel.unresolved_evidence_ids,
    decision_reason: sel.decision_reason,
    confidence: sel.confidence,
    provenance: sel.provenance,
    policy_id: "NEX1_Q8_SELECTION_POLICY",
    policy_version: "V1",
    uncertainty: sel.uncertainty,
    recommended_next_action: sel.recommended_next_action,
    evidence_kind: "INFERRED",
  };
}

// ── Entry point ──────────────────────────────────────────────────────────

/** Append one JSONL row per selection · deterministic structure · read-only
 *  w.r.t. every file except the store target. Fails LOUDLY on any error ·
 *  never silently converts failure into success (§9). */
export function appendInvestigationConclusions(
  input: AppendConclusionsInput,
): AppendConclusionsResult {
  const storePath = getConclusionsStorePath(input.repo_root);
  const storeDir = path.dirname(storePath);
  const appended: string[] = [];
  const errors: string[] = [];
  let rejectedForbidden = 0;
  let rejectedNonInferred = 0;

  try {
    if (!existsSync(storeDir)) {
      mkdirSync(storeDir, { recursive: true });
    }
  } catch (e) {
    errors.push(`store_directory_create_failed: ${(e as Error).message}`);
    return {
      ok: false,
      path: storePath,
      appended_entry_ids: [],
      errors,
      rejected_forbidden_word: 0,
      rejected_non_inferred: 0,
    };
  }

  for (const sel of input.selections) {
    // Type-lock backstop (V1 §2.17 · Decision 14 · never PROVEN)
    if ((sel.evidence_kind as string) !== "INFERRED") {
      rejectedNonInferred++;
      errors.push(`rejected_non_inferred: ${sel.source_file}::${sel.selected_candidate ?? "null"}`);
      continue;
    }

    // Forbidden-causal-vocab check
    const scanText = `${sel.decision_reason} ${sel.uncertainty ?? ""} ${sel.recommended_next_action}`;
    const forbiddenHit = containsForbiddenCausal(scanText);
    if (forbiddenHit !== null) {
      rejectedForbidden++;
      errors.push(`rejected_forbidden_word[${forbiddenHit}]: ${sel.source_file}`);
      continue;
    }

    const entry = toEntry(sel);
    try {
      appendFileSync(storePath, JSON.stringify(entry) + "\n", { encoding: "utf8" });
      appended.push(entry.entry_id);
    } catch (e) {
      errors.push(`append_failed[${entry.entry_id}]: ${(e as Error).message}`);
    }
  }

  return {
    ok: errors.length === 0,
    path: storePath,
    appended_entry_ids: appended,
    errors,
    rejected_forbidden_word: rejectedForbidden,
    rejected_non_inferred: rejectedNonInferred,
  };
}
