// src/lib/nex/programmer-stability/version-manifest.ts
//
// NEX Programmer Agent · Phase E · version manifest capture
// Philip 2026-09-05 · AUTHORIZE §12 §13
//
// Captures a deterministic manifest of every source-of-truth dimension
// that could explain a change in evaluation results. Every field is
// hashable · fresh processes produce identical hashes for identical
// on-disk state.
//
// Rationale (§13): attribution requires distinguishing "performance
// changed because reviewer changed" from "…because knowledge changed"
// from "…because corpus changed" from "…because evaluator changed".
// If we can't tell which changed, we can't diagnose · so we hash each
// dimension independently.

import { createHash } from "node:crypto";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import type { BenchmarkCorpus } from "@/lib/nex/programmer-benchmark/types";
import type { VersionManifest } from "./types";

/** SHA-256 hex · first 24 chars for brevity · deterministic. */
export function shortHash(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 24);
}

/** Hash the content of a set of files · concatenated in fixed order.
 *  Missing files contribute "MISSING:{path}" so absence is visible. */
export function hashFiles(files: readonly string[], repoRoot: string): string {
  const parts: string[] = [];
  for (const rel of [...files].sort()) {
    const abs = path.resolve(repoRoot, rel);
    if (!existsSync(abs)) {
      parts.push(`MISSING:${rel}`);
      continue;
    }
    const st = statSync(abs);
    if (!st.isFile()) {
      parts.push(`NOT_FILE:${rel}`);
      continue;
    }
    const buf = readFileSync(abs);
    parts.push(`${rel}::${shortHash(buf)}`);
  }
  return shortHash(parts.join("\n"));
}

/** Hash a frozen benchmark corpus by serializing its cases in stable
 *  order. Immune to Object.keys ordering variance. */
export function hashCorpus(corpus: BenchmarkCorpus): string {
  const sorted = [...corpus.cases].sort((a, b) => a.case_id.localeCompare(b.case_id));
  const parts: string[] = [];
  parts.push(`version:${corpus.version}`);
  parts.push(`case_count:${corpus.case_count}`);
  for (const c of sorted) {
    parts.push(JSON.stringify({
      id: c.case_id,
      def: c.defect_class,
      dif: c.difficulty,
      req: c.requirement,
      gt: c.ground_truth,
      exp: c.expected_verdict,
      efc: c.expected_finding_categories ?? null,
      tpbw: c.tests_pass_but_code_wrong ?? false,
      // include request essentials so a case whose fixture body changes is detected
      claim: c.request.implementation.claim,
      summary: c.request.implementation.summary,
      test_summary: c.request.tests.summary,
      known_gaps: c.request.tests.known_gaps,
      edge_req: c.request.requirement_details.edge_cases_required,
      edge_cov: c.request.requirement_details.edge_cases_covered,
      sec_req: c.request.requirement_details.security_requirements,
      sec_vio: c.request.requirement_details.security_violations_observed,
      tests_passed: c.request.tests.passed,
      tests_failed: c.request.tests.failed,
    }));
  }
  return shortHash(parts.join("\n"));
}

/** Default file sets defining "the reviewer" and "the evaluator" for
 *  hashing purposes. Kept small and explicit so future modules must
 *  be added intentionally. */
export const REVIEWER_SOURCE_FILES: readonly string[] = [
  "src/lib/nex/programmer-review/reviewer.ts",
  "src/lib/nex/programmer-review/test-quality.ts",
  "src/lib/nex/programmer-review/types.ts",
];

export const EVALUATOR_SOURCE_FILES: readonly string[] = [
  "src/lib/nex/programmer-benchmark/evaluator.ts",
  "src/lib/nex/programmer-benchmark/corpus.ts",
  "src/lib/nex/programmer-benchmark/types.ts",
];

// ─── Capture a manifest for the current process ─────────────────

export type CaptureManifestInput = {
  repoRoot: string;
  corpus: BenchmarkCorpus;
  /** Optional file paths whose content is the reviewer surface being
   *  hashed. Defaults to REVIEWER_SOURCE_FILES. */
  reviewer_files?: readonly string[];
  evaluator_files?: readonly string[];
  /** Optional list of Phase B knowledge JSONL paths. When empty or
   *  missing, knowledge_snapshot_hash becomes UNKNOWN. */
  knowledge_files?: readonly string[];
};

export function captureManifest(input: CaptureManifestInput): VersionManifest {
  const reviewer_hash = hashFiles(input.reviewer_files ?? REVIEWER_SOURCE_FILES, input.repoRoot);
  const evaluator_hash = hashFiles(input.evaluator_files ?? EVALUATOR_SOURCE_FILES, input.repoRoot);
  const knowledge_hash =
    input.knowledge_files && input.knowledge_files.length > 0
      ? hashFiles(input.knowledge_files, input.repoRoot)
      : "UNKNOWN";
  return {
    benchmark_version: input.corpus.version,
    benchmark_hash: hashCorpus(input.corpus),
    reviewer_hash,
    evaluator_hash,
    knowledge_snapshot_hash: knowledge_hash,
    environment_identifier: `node:${process.version}`,
    captured_at: new Date().toISOString(),
  };
}

/** True IFF two manifests are identical across every dimension. */
export function manifestsIdentical(a: VersionManifest, b: VersionManifest): boolean {
  return (
    a.benchmark_version === b.benchmark_version &&
    a.benchmark_hash === b.benchmark_hash &&
    a.reviewer_hash === b.reviewer_hash &&
    a.evaluator_hash === b.evaluator_hash &&
    a.knowledge_snapshot_hash === b.knowledge_snapshot_hash &&
    a.environment_identifier === b.environment_identifier
  );
}

// ─── Case fingerprint (matches Phase D fingerprint scheme) ──────

export type CaseFingerprintInput = {
  case_id: string;
  match_status: string;
  actual_verdict: string;
  actual_finding_count: number;
};

export function computeCaseFingerprint(results: CaseFingerprintInput[]): string {
  const sorted = results
    .map((r) => `${r.case_id}|${r.match_status}|${r.actual_verdict}|${r.actual_finding_count}`)
    .sort();
  return shortHash(sorted.join("\n"));
}
