// src/lib/nex-agent/code-engine/capability-experience-corpus.ts
//
// NEX1 · Phase 9-11 · Experience Receipt + Persistence + Retrieval
// Ledger B structure · Ledger A candidate values · Zero LLM · JSONL append-only.
//
// FOUNDER PRINCIPLE (verbatim · A5 design guiding rule)
//   "Do not let NEX learn what kind of answer is desirable. Let it learn
//    what happened when particular evidence was previously observed."
//
// PURPOSE (A3 audit finding · biggest single leverage)
//   NEX has extensive Ledger B substrate for every stage of the intelligence
//   loop but production runtimes never write to outcome-experience. The
//   abstractors are STARVED OF DATA, not broken. This module provides:
//     1. Unified episode receipt schema (7 evidence layers)
//     2. Append-only JSONL persistence with write-barrier rules
//     3. Wilson lower-bound retrieval (never raw rate · prevents 1/1=100%)
//     4. Every retrieval carries caller_must_decide: true
//     5. Anti-manufacturing controls (forbidden-pattern scan)
//
// AUTHORITY BOUNDARY
//   · WRITE authority for episodes.jsonl and discarded.jsonl (append-only)
//   · READ authority for retrieval
//   · Never MODIFY / EXECUTE / DECIDE for the caller
//   · Every retrieval response is advisory
//
// LEDGER
//   · Structure = Claude-designed = Ledger B
//   · Values (Wilson-ranked table rows) = data-derived = Ledger A candidate
//   · No numeric threshold in a decision rule hand-authored inside code
//   · No task-specific mapping
//   · Fresh-subprocess byte-identical reproducibility

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export const EXPERIENCE_CORPUS_VERSION = "experience-corpus.v1.2026-09-19";

// ── Episode receipt schema (7 evidence layers · A5 design) ───────────────

export interface EpisodeReceipt {
  readonly schema_version: string;
  readonly episode_id: string;
  readonly correlation_id: string;
  readonly recorded_at_iso: string;
  readonly nex_version: {
    readonly gate1_state: "FROZEN" | "OPEN";
  };
  readonly task_context: {
    readonly task_kind: string;
    readonly domain_tag: "coding" | "data" | "config" | "prose" | "ambiguous";
    readonly input_hash: string;
    readonly input_shape_fingerprint: {
      readonly verb_class: string;
      readonly target_class: string;
      readonly activity_class: string;
      readonly size_bucket: "S" | "M" | "L";
      readonly language_class: string;
    };
  };
  readonly believed: {
    readonly hypothesis_prediction?: string | null;
    readonly caller_must_decide: true;
  };
  readonly observed: {
    readonly verifier_verdict: string;
    readonly agreement_status?: string | null;
  };
  readonly what_actually_happened: {
    readonly final_outcome: "verified_success" | "verified_failure" | "unresolved";
    readonly repair_iterations: number;
    readonly reproducibility_check: {
      readonly byte_identical_across_reruns: boolean | null;
      readonly reruns_observed: number;
    };
  };
  readonly what_was_verified: {
    readonly target_pass: boolean;
    readonly regression_pass: boolean;
    readonly gate1_frozen_confirmed: boolean;
  };
  readonly what_failed: {
    readonly failure_class: string | null;
  };
  readonly what_was_learned: {
    readonly operator_kind: string | null;
    readonly extracted_relationship_type: "OBSERVED" | "INFERRED" | "GENERALIZED" | null;
  };
  readonly epistemic_status:
    | "OBSERVED" | "INFERRED" | "GENERALIZED" | "HYPOTHESIZED"
    | "VERIFIED" | "CONTRADICTED" | "UNRESOLVED" | "RETIRED_PROVISIONAL";
  readonly ledger_classification: "Ledger B structural · Ledger A candidate values";
}

export interface AppendResult {
  readonly written: boolean;
  readonly path: "episodes.jsonl" | "discarded.jsonl";
  readonly discard_reason?: string;
  readonly episode_id: string;
  readonly write_barrier_passes: readonly string[];
  readonly write_barrier_failures: readonly string[];
}

// ── Write barrier rules (A5 design · every episode must pass all) ────────

const WRITE_BARRIERS = [
  "has_verified_outcome",
  "has_provenance",
  "signature_computable",
  "hypothesis_recorded_pre_observation",
  "no_forbidden_pattern",
] as const;

const FORBIDDEN_PATTERNS = [
  /task_id\s*[:=]\s*['"]?[a-zA-Z0-9_-]+['"]?\s*→\s*['"]?[a-zA-Z0-9_-]+['"]?/,  // literal task→answer table
  /answer_table\[/,
  /if\s+task_id\s*===/,
];

// ── Append with write barrier ────────────────────────────────────────────

export interface ExperienceCorpusOptions {
  readonly data_root: string;
}

export function appendEpisode(
  receipt: EpisodeReceipt,
  opts: ExperienceCorpusOptions,
): AppendResult {
  const passes: string[] = [];
  const failures: string[] = [];

  // Barrier 1: verified outcome
  if (["verified_success", "verified_failure"].includes(receipt.what_actually_happened.final_outcome)) {
    passes.push("has_verified_outcome");
  } else {
    failures.push("has_verified_outcome");
  }

  // Barrier 2: provenance (correlation_id + episode_id non-empty)
  if (receipt.episode_id && receipt.correlation_id) {
    passes.push("has_provenance");
  } else {
    failures.push("has_provenance");
  }

  // Barrier 3: signature computable (deterministic hash of receipt content)
  const signature = signatureOf(receipt);
  if (signature) {
    passes.push("signature_computable");
  } else {
    failures.push("signature_computable");
  }

  // Barrier 4: hypothesis recorded pre-observation
  // (permissible to be null · but "believed" object must exist to prove
  //  the field was considered, preventing post-hoc rationalisation)
  if (receipt.believed && "hypothesis_prediction" in receipt.believed) {
    passes.push("hypothesis_recorded_pre_observation");
  } else {
    failures.push("hypothesis_recorded_pre_observation");
  }

  // Barrier 5: forbidden-pattern scan on the JSON representation
  const serialized = JSON.stringify(receipt);
  const forbidden_hit = FORBIDDEN_PATTERNS.some((rx) => rx.test(serialized));
  if (!forbidden_hit) {
    passes.push("no_forbidden_pattern");
  } else {
    failures.push("no_forbidden_pattern");
  }

  const should_write = failures.length === 0;
  const target_file = should_write ? "episodes.jsonl" : "discarded.jsonl";
  const target_path = path.join(opts.data_root, target_file);

  ensureDir(path.dirname(target_path));
  const line = JSON.stringify({
    ...receipt,
    ...(should_write ? {} : { discard_reason: failures.join(",") }),
  }) + "\n";
  appendFileSync(target_path, line);

  return {
    written: should_write,
    path: target_file,
    discard_reason: should_write ? undefined : failures.join(","),
    episode_id: receipt.episode_id,
    write_barrier_passes: passes,
    write_barrier_failures: failures,
  };
}

// ── Wilson lower bound (95% · never raw rate) ────────────────────────────

const Z_95 = 1.9599639845400545;  // 97.5 percentile of standard normal · frozen constant

export function wilsonLowerBound95(successes: number, total: number): number {
  if (total === 0 || successes < 0 || successes > total) return 0;
  const phat = successes / total;
  const n = total;
  const z = Z_95;
  const denom = 1 + (z * z) / n;
  const centre = phat + (z * z) / (2 * n);
  const margin = z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * n)) / n);
  return Math.max(0, (centre - margin) / denom);
}

// ── Retrieval ────────────────────────────────────────────────────────────

export interface OperatorRankRow {
  readonly operator_kind: string;
  readonly support_count: number;
  readonly success_count: number;
  readonly failure_count: number;
  readonly wilson_lower_95: number;
  readonly raw_rate: number;
  readonly confidence_bucket: "NASCENT" | "ACTIVE" | "WATCHED";
  readonly provenance_episode_ids: readonly string[];
}

export interface OperatorQueryResult {
  readonly ranked_operators: readonly OperatorRankRow[];
  readonly caller_must_decide: true;
  readonly epistemic_status: "OBSERVED" | "INFERRED" | "GENERALIZED";
  readonly total_episodes_consulted: number;
  readonly zero_llm: true;
  readonly ledger: "B";
}

export function queryTopOperators(
  spec_signature: string,
  opts: ExperienceCorpusOptions,
): OperatorQueryResult {
  const episodes = readEpisodes(opts);
  const filtered = episodes.filter(
    (e) => signatureOf(e) === spec_signature || e.task_context.task_kind === spec_signature,
  );

  const by_op = new Map<string, { successes: number; failures: number; ids: string[] }>();
  for (const ep of filtered) {
    const op = ep.what_was_learned.operator_kind ?? "unknown_operator";
    const bucket = by_op.get(op) ?? { successes: 0, failures: 0, ids: [] };
    if (ep.what_actually_happened.final_outcome === "verified_success") bucket.successes += 1;
    else if (ep.what_actually_happened.final_outcome === "verified_failure") bucket.failures += 1;
    bucket.ids.push(ep.episode_id);
    by_op.set(op, bucket);
  }

  const ranked: OperatorRankRow[] = [];
  for (const [op, b] of by_op) {
    const total = b.successes + b.failures;
    if (total === 0) continue;
    const wilson = wilsonLowerBound95(b.successes, total);
    ranked.push({
      operator_kind: op,
      support_count: total,
      success_count: b.successes,
      failure_count: b.failures,
      wilson_lower_95: wilson,
      raw_rate: b.successes / total,
      confidence_bucket: total < 3 ? "NASCENT" : total < 10 ? "ACTIVE" : "WATCHED",
      provenance_episode_ids: [...b.ids].sort(),
    });
  }

  ranked.sort((a, b) =>
    b.wilson_lower_95 - a.wilson_lower_95 ||
    b.support_count - a.support_count ||
    a.operator_kind.localeCompare(b.operator_kind),
  );

  return {
    ranked_operators: ranked,
    caller_must_decide: true,
    epistemic_status: filtered.length < 3 ? "OBSERVED" : "INFERRED",
    total_episodes_consulted: filtered.length,
    zero_llm: true,
    ledger: "B",
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function signatureOf(receipt: EpisodeReceipt): string {
  const fp = receipt.task_context.input_shape_fingerprint;
  return createHash("sha256")
    .update([
      receipt.task_context.task_kind,
      receipt.task_context.domain_tag,
      fp.verb_class,
      fp.target_class,
      fp.activity_class,
      fp.size_bucket,
      fp.language_class,
    ].join("|"))
    .digest("hex")
    .slice(0, 16);
}

function readEpisodes(opts: ExperienceCorpusOptions): EpisodeReceipt[] {
  const p = path.join(opts.data_root, "episodes.jsonl");
  if (!existsSync(p)) return [];
  const content = readFileSync(p, "utf8");
  const results: EpisodeReceipt[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      results.push(JSON.parse(trimmed));
    } catch {
      // corrupt line · skip (this is honest degradation · not a silent success)
    }
  }
  return results;
}

// ── Frozen table integrity check ─────────────────────────────────────────

export function computeCorpusHash(opts: ExperienceCorpusOptions): {
  readonly episodes_hash: string;
  readonly episode_count: number;
  readonly zero_llm: true;
} {
  const p = path.join(opts.data_root, "episodes.jsonl");
  if (!existsSync(p)) {
    return { episodes_hash: "empty", episode_count: 0, zero_llm: true };
  }
  const buf = readFileSync(p);
  const eps = readEpisodes(opts);
  return {
    episodes_hash: createHash("sha256").update(buf).digest("hex").slice(0, 32),
    episode_count: eps.length,
    zero_llm: true,
  };
}
