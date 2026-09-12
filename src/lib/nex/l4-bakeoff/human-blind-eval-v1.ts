// src/lib/nex/l4-bakeoff/human-blind-eval-v1.ts
//
// V.5.4.4 · HYBRID SCORING · human blind evaluation infrastructure
// Founder BEGIN V.5.4.4 · 2026-09-08
//
// Human blind eval is the ONLY authority permitted for subjective
// conversation quality (warmth · single-voice · plain-language uncertainty
// · UX invariants). LLM-as-judge is FORBIDDEN as sole authority.
//
// This module provides:
//   1. Anonymised-output composer (transcript → AnonymizedOutput with
//      sealed candidate_id · reviewer cannot infer the candidate)
//   2. BlindMapping registration (sealed until judgment recorded)
//   3. HumanJudgment record shape + append-only persistence (WORM discipline)
//   4. scoreHumanBlindEval that returns UNKNOWN until a judgment exists

import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { BenchmarkCase, EvaluationDimension, FailureKind } from "./types";
import type { HybridCaseScore, ScorableTranscript } from "./hybrid-scorers-v1";

// ═══════════════════════════════════════════════════════════════════
// § A · ANONYMISED OUTPUT (never leaks candidate identity to reviewer)
// ═══════════════════════════════════════════════════════════════════

export type AnonymisedOutputForReview = {
  anon_id: string;                        // e.g. "system_A" · "system_B" · reshuffled per case
  case_id: string;
  prompt: string;                         // reviewer sees the prompt
  system_prompt_slot: string;             // reviewer sees the slot NAME · not the sealed candidate
  response_text: string;                  // reviewer scores THIS
  language?: string;
  human_eval_criteria?: readonly string[];
  /** Sealed identifier · reviewer NEVER sees the raw candidate_id.
   *  Unsealed via BlindMapping AFTER judgment is recorded. */
  sealed_candidate_ref: string;
};

/** Deterministic sealed reference · reviewer cannot reverse without the
 *  BlindMapping. Uses SHA-256(candidate_id + case_id + session_salt). */
function sealCandidateRef(candidate_id: string, case_id: string, session_salt: string): string {
  return createHash("sha256").update(`${candidate_id}|${case_id}|${session_salt}`, "utf8").digest("hex").slice(0, 24);
}

/** Compose an anonymised output for a reviewer session.
 *  Caller is responsible for shuffling anon_ids so review order does not
 *  leak the candidate. */
export function composeAnonymisedOutput(input: {
  bcase: BenchmarkCase;
  transcript: ScorableTranscript;
  candidate_id: string;
  session_salt: string;
  anon_id: string;
}): AnonymisedOutputForReview {
  return {
    anon_id: input.anon_id,
    case_id: input.bcase.case_id,
    prompt: input.bcase.prompt,
    system_prompt_slot: (input.bcase.system_prompt_slot as string | undefined) ?? "default",
    response_text: input.transcript.response_text ?? "",
    language: input.bcase.language,
    human_eval_criteria: input.bcase.scoring_rubric?.human_eval_criteria,
    sealed_candidate_ref: sealCandidateRef(input.candidate_id, input.bcase.case_id, input.session_salt),
  };
}

// ═══════════════════════════════════════════════════════════════════
// § B · BLIND MAPPING (sealed until judgment recorded)
// ═══════════════════════════════════════════════════════════════════

export type BlindMappingRecord = {
  session_id: string;
  case_id: string;
  anon_id: string;
  sealed_candidate_ref: string;
  real_candidate_id: string;              // stored on disk · gated read via judgment presence
  session_salt: string;
  created_at_iso: string;
};

// ═══════════════════════════════════════════════════════════════════
// § C · HUMAN JUDGMENT RECORD (append-only · WORM)
// ═══════════════════════════════════════════════════════════════════
//
// Anonymised · evaluator identity is hashed · appended to a per-session
// file. Never overwritten. Never edited. A corrected judgment appends a
// NEW record with `supersedes` referring to the previous.

export type HumanJudgment = {
  judgment_id: string;
  session_id: string;
  case_id: string;
  anon_id: string;
  evaluator_id_hash: string;              // SHA-256 of evaluator's opaque identifier · never raw
  scores: {
    correctness: number;                  // 0..1
    usefulness: number;                   // 0..1
    reasoning_quality: number;            // 0..1
    naturalness: number;                  // 0..1
    warmth: number;                       // 0..1  (V.5.4.4 addition · UX-invariant priority)
    single_voice: number;                 // 0..1  (V.5.4.4 addition · UX-invariant priority)
    plain_language_uncertainty: number;   // 0..1  (V.5.4.4 addition · UX-invariant priority)
    instruction_following: number;        // 0..1
    factual_honesty: number;              // 0..1
    overall_preference: number;           // 0..1
  };
  notes?: string;
  recorded_at_iso: string;
  supersedes?: string;                    // prior judgment_id when correcting
};

// ═══════════════════════════════════════════════════════════════════
// § D · PERSISTENCE (append-only per session)
// ═══════════════════════════════════════════════════════════════════

function humanBlindDir(): string {
  const override = process.env.NEX_L4_HUMAN_BLIND_DIR;
  if (override) return override;
  return path.join(process.cwd(), "data", "l4-bakeoff", "human-blind-eval");
}

function ensureSessionDir(session_id: string): string {
  const dir = humanBlindDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const sessionDir = path.join(dir, session_id);
  if (!existsSync(sessionDir)) mkdirSync(sessionDir, { recursive: true });
  return sessionDir;
}

function judgmentsFile(session_id: string): string {
  return path.join(ensureSessionDir(session_id), "judgments.jsonl");
}

function mappingsFile(session_id: string): string {
  return path.join(ensureSessionDir(session_id), "blind-mappings.jsonl");
}

export function registerBlindMapping(record: BlindMappingRecord): void {
  const p = mappingsFile(record.session_id);
  const line = JSON.stringify(record) + "\n";
  const prior = existsSync(p) ? readFileSync(p, "utf8") : "";
  writeFileSync(p, prior + line, "utf8");
}

export function appendHumanJudgment(j: HumanJudgment): void {
  const p = judgmentsFile(j.session_id);
  const line = JSON.stringify(j) + "\n";
  const prior = existsSync(p) ? readFileSync(p, "utf8") : "";
  writeFileSync(p, prior + line, "utf8");
}

/** Read latest judgment for a (session_id · case_id · anon_id) triple.
 *  Latest = last record in append order · respects supersedes chain. */
export function latestJudgment(session_id: string, case_id: string, anon_id: string): HumanJudgment | null {
  const p = judgmentsFile(session_id);
  if (!existsSync(p)) return null;
  const lines = readFileSync(p, "utf8").split(/\r?\n/).filter((l) => l.trim().length > 0);
  const relevant = lines
    .map((l) => { try { return JSON.parse(l) as HumanJudgment; } catch { return null; } })
    .filter((j): j is HumanJudgment => j !== null && j.case_id === case_id && j.anon_id === anon_id);
  return relevant[relevant.length - 1] ?? null;
}

// ═══════════════════════════════════════════════════════════════════
// § E · HUMAN BLIND EVAL SCORER
// ═══════════════════════════════════════════════════════════════════

/** Returns UNKNOWN until a HumanJudgment has been recorded for this
 *  (session_id · case_id · anon_id). Pass threshold configurable.
 *  Never automatically judges · never uses an LLM to substitute. */
export function scoreHumanBlindEval(input: {
  bcase: BenchmarkCase;
  candidate_id: string;
  transcript: ScorableTranscript;
  /** Session under which the anonymised outputs were reviewed. */
  session_id: string;
  /** Anonymised handle the reviewer saw. Caller resolves this from the
   *  BlindMapping when composing the review batch. */
  anon_id: string;
  /** Overall-preference threshold for pass. Default 0.65 (bounded). */
  pass_threshold?: number;
}): HybridCaseScore {
  const { bcase, candidate_id, transcript, session_id, anon_id } = input;
  const threshold = input.pass_threshold ?? 0.65;
  const now = new Date().toISOString();

  if (transcript.response_kind !== "ok") {
    return {
      case_id: bcase.case_id,
      candidate_id,
      dimension: bcase.dimension,
      authority: "human_blind_eval",
      passed: "unknown",
      authority_notes: `response_kind=${transcript.response_kind} · no response text to review`,
      failure_kind: transcript.response_kind as FailureKind,
      scored_at_iso: now,
    };
  }

  const j = latestJudgment(session_id, bcase.case_id, anon_id);
  if (!j) {
    return {
      case_id: bcase.case_id,
      candidate_id,
      dimension: bcase.dimension,
      authority: "human_blind_eval",
      passed: "unknown",
      authority_notes: `no human judgment recorded yet for (session=${session_id} · case=${bcase.case_id} · anon=${anon_id}) · honestly UNKNOWN until reviewer scores`,
      scored_at_iso: now,
    };
  }

  const passed = j.scores.overall_preference >= threshold;
  return {
    case_id: bcase.case_id,
    candidate_id,
    dimension: bcase.dimension,
    authority: "human_blind_eval",
    passed,
    authority_notes: `human blind eval · overall_preference=${j.scores.overall_preference.toFixed(2)} vs threshold ${threshold} · passed=${passed} · evaluator_id_hash=${j.evaluator_id_hash.slice(0, 12)}`,
    raw_signals: {
      overall_preference: j.scores.overall_preference,
      warmth: j.scores.warmth,
      single_voice: j.scores.single_voice,
      plain_language_uncertainty: j.scores.plain_language_uncertainty,
      correctness: j.scores.correctness,
      factual_honesty: j.scores.factual_honesty,
      judgment_id: j.judgment_id,
      recorded_at_iso: j.recorded_at_iso,
    },
    scored_at_iso: now,
  };
}

// ═══════════════════════════════════════════════════════════════════
// § F · REVIEWER SESSION SETUP HELPER
// ═══════════════════════════════════════════════════════════════════

/** Convenience: given a set of (candidate_id · transcript · bcase) triples,
 *  compose a shuffled anonymised batch AND persist the BlindMapping records.
 *  Caller passes anon_ids in shuffle order · this helper does not shuffle
 *  (Founder controls shuffle for auditability). */
export function prepareBlindReviewBatch(input: {
  session_id: string;
  session_salt?: string;
  entries: readonly {
    bcase: BenchmarkCase;
    candidate_id: string;
    transcript: ScorableTranscript;
    anon_id: string;
  }[];
}): AnonymisedOutputForReview[] {
  const session_salt = input.session_salt ?? randomUUID();
  const out: AnonymisedOutputForReview[] = [];
  for (const e of input.entries) {
    const sealed = sealCandidateRef(e.candidate_id, e.bcase.case_id, session_salt);
    registerBlindMapping({
      session_id: input.session_id,
      case_id: e.bcase.case_id,
      anon_id: e.anon_id,
      sealed_candidate_ref: sealed,
      real_candidate_id: e.candidate_id,
      session_salt,
      created_at_iso: new Date().toISOString(),
    });
    out.push(composeAnonymisedOutput({
      bcase: e.bcase,
      transcript: e.transcript,
      candidate_id: e.candidate_id,
      session_salt,
      anon_id: e.anon_id,
    }));
  }
  return out;
}

// Void dependency to keep EvaluationDimension in scope (used by consumers)
void (undefined as unknown as EvaluationDimension);
