// src/lib/nex-agent/code-engine/capability-specification-driven-loop.ts
//
// NEX1 · Specification-Driven Coding Loop Wrapper · zero LLM.
// Founder-authorised 2026-09-17 · Specification-Driven Coding Capability.
//
// PURPOSE
//   Compose the following existing capabilities into a single deterministic
//   flow that answers the founder question: "can NEX1 natively convert prose
//   into a real failing test, and drive it through the existing
//   REASON→PLAN→CHANGE→TEST→VERIFY chain?"
//
//     1. extractSpecification(founder_goal)          — extractor
//     2. generateVerificationCases(...)              — case generator
//     3. composeTestFileText(...) + fs.writeFile     — spec-derived .test.ts
//     4. runNativeProgrammingLoop({ target_test_file }) — existing loop
//     5. fs.unlink(...)                              — cleanup
//
// DISCIPLINE
//   · Zero LLM · zero synthetic failures · zero domain-specific hard-coding.
//   · Refuses cleanly at every boundary:
//       SPECIFICATION_INSUFFICIENT · NO_VERIFIABLE_CASES · WRITE_REFUSED
//   · Emits a single truthful result envelope · one of:
//       CODING_LOOP_RUNTIME_VERIFIED         (full chain executed to pass)
//       CODING_LOOP_PARTIALLY_RUNTIME_VERIFIED (some stages · not all pass)
//       CODING_LOOP_NOT_YET_RUNTIME_VERIFIED  (a stage refused · honest)
//       SPECIFICATION_INSUFFICIENT           (no extractable expected behaviour)
//       NO_VERIFIABLE_CASES                  (extracted but generator refused all)
//       WRITE_REFUSED                        (spec-derived test path refused)
//
// GENERALIZED · NOT TEST-5-SPECIFIC
//   The loop makes no reference to pricing, staircase, quantity, or any
//   business-domain term. It is exercised against a founder-supplied target.
//
// AUTHORIZATION BOUNDARY
//   The generator writes to `<targetDir>/<basename>.spec-derived.test.ts`
//   which is NOT a source file · NOT a checked-in test · NOT a modification
//   of pricing.ts / pricing.test.ts. It is an ephemeral artifact scoped to
//   THIS loop invocation. It is deleted after the loop terminates regardless
//   of outcome (unless keep_artifact=true).

import * as fs from "node:fs";
import * as path from "node:path";
import { extractSpecification, classifyExtraction } from "./capability-specification-extractor";
import type { ExtractSpecificationResult } from "./capability-specification-extractor";
import {
  generateVerificationCases,
  composeTestFileText,
} from "./capability-verification-case-generator";
import type {
  GenerateVerificationCasesResult,
  VerificationCase,
  VerificationRefusal,
} from "./capability-verification-case-generator";
import {
  runNativeProgrammingLoop,
} from "./native-programming-loop";
import type { NativeLoopResult } from "./native-programming-loop";

// ── Public shape ─────────────────────────────────────────────────────────

export type SpecDrivenVerdict =
  | "CODING_LOOP_RUNTIME_VERIFIED"
  | "CODING_LOOP_PARTIALLY_RUNTIME_VERIFIED"
  | "CODING_LOOP_NOT_YET_RUNTIME_VERIFIED"
  | "SPECIFICATION_INSUFFICIENT"
  | "NO_VERIFIABLE_CASES"
  | "WRITE_REFUSED"
  | "EARLY_EXIT_TARGET_MISSING";

export interface SpecificationDrivenLoopInput {
  readonly founder_goal: string;
  readonly target_source_file: string;      // repo-relative or absolute
  readonly repo_root: string;
  readonly test_timeout_ms?: number;
  readonly keep_artifact?: boolean;         // preserve spec-derived test file (default: false)
  /**
   * Batch 2A Streaming · 2026-09-17.
   * Forwarded to runNativeProgrammingLoop. See NativeLoopInput.onStage.
   * Absent by default; no observable difference to Batch 1 callers.
   */
  readonly onStage?: (s: import("./native-programming-loop").StageResult) => void;
}

export interface SpecificationDrivenLoopResult {
  readonly ok: true;
  readonly overall_verdict: SpecDrivenVerdict;
  readonly zero_llm: true;
  readonly started_at: string;
  readonly finished_at: string;
  readonly repo_root: string;
  readonly target_source_file: string;      // repo-relative
  readonly spec_derived_test_file: string | null;
  readonly extraction: {
    readonly classification: ReturnType<typeof classifyExtraction>;
    readonly stats: ExtractSpecificationResult["stats"];
    readonly expected_behaviour_count: number;
  };
  readonly generation: {
    readonly ok: boolean;
    readonly case_count: number;
    readonly refusal_count: number;
    readonly high_confidence_count: number;
    readonly refusals: readonly VerificationRefusal[];
  };
  readonly programming_loop: NativeLoopResult | null;
  readonly rationale: string;
  readonly capability_gaps: readonly string[];
  readonly evidence_kind: "COMPOSED";
}

// ── Utilities ────────────────────────────────────────────────────────────

function toForwardSlash(p: string): string {
  return p.replace(/\\/g, "/");
}

function toRepoRelative(p: string, repoRoot: string): string {
  const abs = path.isAbsolute(p) ? p : path.resolve(repoRoot, p);
  return toForwardSlash(path.relative(repoRoot, abs));
}

function ensureAbsolute(p: string, repoRoot: string): string {
  return path.isAbsolute(p) ? p : path.resolve(repoRoot, p);
}

function safeIsWithinRepo(absPath: string, repoRoot: string): boolean {
  const rel = path.relative(repoRoot, absPath);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

// ── Entry point ──────────────────────────────────────────────────────────

export async function runSpecificationDrivenCodingLoop(
  input: SpecificationDrivenLoopInput,
): Promise<SpecificationDrivenLoopResult> {
  const startedAt = new Date();
  const capabilityGaps: string[] = [];

  const targetAbs = ensureAbsolute(input.target_source_file, input.repo_root);
  const targetRel = toRepoRelative(input.target_source_file, input.repo_root);

  if (!fs.existsSync(targetAbs)) {
    return finalise({
      startedAt,
      overall_verdict: "EARLY_EXIT_TARGET_MISSING",
      target_source_file: targetRel,
      spec_derived_test_file: null,
      extraction: emptyExtraction(),
      generation: emptyGeneration(),
      programming_loop: null,
      rationale: `target source file not found: ${targetRel}`,
      capability_gaps: [...capabilityGaps, "spec_driven: target file missing"],
      repo_root: input.repo_root,
    });
  }

  // ─── PHASE A · Extract ────────────────────────────────────────────────
  const extraction = extractSpecification(input.founder_goal);
  const classification = classifyExtraction(extraction);
  const highOrMedium = extraction.expected_behaviours.filter(
    (b) => b.confidence === "high" || b.confidence === "medium",
  );

  if (classification === "SPECIFICATION_INSUFFICIENT" || highOrMedium.length === 0) {
    capabilityGaps.push(
      "spec_driven: prose contained no explicit expected-value clauses (patterns: 'when X is Y, Z should be W' etc.) — deterministic extractor cannot infer missing expectations without LLM",
    );
    return finalise({
      startedAt,
      overall_verdict: "SPECIFICATION_INSUFFICIENT",
      target_source_file: targetRel,
      spec_derived_test_file: null,
      extraction: {
        classification,
        stats: extraction.stats,
        expected_behaviour_count: extraction.expected_behaviours.length,
      },
      generation: emptyGeneration(),
      programming_loop: null,
      rationale:
        `Extraction found ${extraction.expected_behaviours.length} clauses; ` +
        `${extraction.stats.matches_high} explicit / ${extraction.stats.matches_insufficient} case-only. ` +
        `No high/medium-confidence explicit expected values → cannot generate verification cases.`,
      capability_gaps: capabilityGaps,
      repo_root: input.repo_root,
    });
  }

  // ─── PHASE B · Generate ──────────────────────────────────────────────
  // Compute the spec-derived test file location (deterministic).
  const targetDir = path.dirname(targetAbs);
  const targetBase = path
    .basename(targetAbs)
    .replace(/\.(tsx?|jsx?|mjs|cjs)$/, "");
  const specDerivedTestAbs = path.join(
    targetDir,
    `${targetBase}.spec-derived.test.ts`,
  );
  const specDerivedTestRel = toRepoRelative(specDerivedTestAbs, input.repo_root);

  if (!safeIsWithinRepo(specDerivedTestAbs, input.repo_root)) {
    capabilityGaps.push(
      `spec_driven: computed test path outside repo root · refusing to write`,
    );
    return finalise({
      startedAt,
      overall_verdict: "WRITE_REFUSED",
      target_source_file: targetRel,
      spec_derived_test_file: null,
      extraction: {
        classification,
        stats: extraction.stats,
        expected_behaviour_count: extraction.expected_behaviours.length,
      },
      generation: emptyGeneration(),
      programming_loop: null,
      rationale: `spec-derived test path failed safety check: ${specDerivedTestAbs}`,
      capability_gaps: capabilityGaps,
      repo_root: input.repo_root,
    });
  }

  const generation = generateVerificationCases({
    extraction,
    target_source_file: targetAbs,
    repo_root: input.repo_root,
    test_file_target: specDerivedTestAbs,
  });

  if (!generation.ok) {
    capabilityGaps.push(
      `spec_driven: generator refused → ${generation.refusal_kind} · ${generation.detail}`,
    );
    return finalise({
      startedAt,
      overall_verdict: "NO_VERIFIABLE_CASES",
      target_source_file: targetRel,
      spec_derived_test_file: null,
      extraction: {
        classification,
        stats: extraction.stats,
        expected_behaviour_count: extraction.expected_behaviours.length,
      },
      generation: emptyGeneration(),
      programming_loop: null,
      rationale: `verification-case generator refused: ${generation.refusal_kind} · ${generation.detail}`,
      capability_gaps: capabilityGaps,
      repo_root: input.repo_root,
    });
  }

  if (generation.cases.length === 0) {
    capabilityGaps.push(
      `spec_driven: extracted ${extraction.expected_behaviours.length} behaviour(s) · generator refused all (${generation.refusals.length}). Common cause: subject noun not found among exported functions in target file.`,
    );
    return finalise({
      startedAt,
      overall_verdict: "NO_VERIFIABLE_CASES",
      target_source_file: targetRel,
      spec_derived_test_file: null,
      extraction: {
        classification,
        stats: extraction.stats,
        expected_behaviour_count: extraction.expected_behaviours.length,
      },
      generation: {
        ok: true,
        case_count: 0,
        refusal_count: generation.refusals.length,
        high_confidence_count: 0,
        refusals: generation.refusals,
      },
      programming_loop: null,
      rationale: `generator produced zero verification cases (all refused: ${generation.refusals.length})`,
      capability_gaps: capabilityGaps,
      repo_root: input.repo_root,
    });
  }

  // ─── PHASE C · Write spec-derived test file ─────────────────────────
  // Compose test file text.
  const targetDirRel = path.dirname(specDerivedTestRel);
  const targetNoExt = targetRel.replace(/\.(tsx?|jsx?|mjs|cjs)$/, "");
  let importSpecifier = path.relative(targetDirRel, targetNoExt);
  importSpecifier = toForwardSlash(importSpecifier);
  if (!importSpecifier.startsWith(".")) importSpecifier = "./" + importSpecifier;

  const testFileText = composeTestFileText({
    cases: generation.cases,
    import_specifier: importSpecifier,
    describe_title: `NEX1 spec-derived · ${targetBase}`,
    generated_at_iso: startedAt.toISOString(),
    source_marker: `spec-derived from founder_goal on ${targetRel}`,
  });

  try {
    fs.writeFileSync(specDerivedTestAbs, testFileText, "utf8");
  } catch (err: any) {
    capabilityGaps.push(`spec_driven: writeFile failed · ${err?.message ?? String(err)}`);
    return finalise({
      startedAt,
      overall_verdict: "WRITE_REFUSED",
      target_source_file: targetRel,
      spec_derived_test_file: specDerivedTestRel,
      extraction: {
        classification,
        stats: extraction.stats,
        expected_behaviour_count: extraction.expected_behaviours.length,
      },
      generation: {
        ok: true,
        case_count: generation.cases.length,
        refusal_count: generation.refusals.length,
        high_confidence_count: generation.stats.high_confidence,
        refusals: generation.refusals,
      },
      programming_loop: null,
      rationale: `writeFile failed on spec-derived test path`,
      capability_gaps: capabilityGaps,
      repo_root: input.repo_root,
    });
  }

  // ─── PHASE D · Invoke programming loop against spec-derived test ────
  let loopResult: NativeLoopResult | null = null;
  try {
    loopResult = await runNativeProgrammingLoop({
      founder_goal:
        input.founder_goal + ` [spec-derived target: ${specDerivedTestRel}]`,
      target_test_file: specDerivedTestRel,
      repo_root: input.repo_root,
      test_timeout_ms: input.test_timeout_ms,
      onStage: input.onStage,
    });
  } catch (err: any) {
    capabilityGaps.push(
      `spec_driven: native programming loop threw · ${err?.message ?? String(err)}`,
    );
  } finally {
    // Cleanup · delete the spec-derived test file unless caller asked to keep.
    if (!input.keep_artifact) {
      try {
        if (fs.existsSync(specDerivedTestAbs)) fs.unlinkSync(specDerivedTestAbs);
      } catch {
        // Non-fatal · report but continue
        capabilityGaps.push(`spec_driven: cleanup unlink failed on ${specDerivedTestRel}`);
      }
    }
  }

  // ─── PHASE E · Classify overall verdict from loop stages ────────────
  let overall: SpecDrivenVerdict;
  if (!loopResult) {
    overall = "CODING_LOOP_NOT_YET_RUNTIME_VERIFIED";
  } else if (loopResult.overall_verdict === "VERIFIED") {
    overall = "CODING_LOOP_RUNTIME_VERIFIED";
  } else if (
    loopResult.stages.some((s) => s.stage === "change" && s.verdict === "VERIFIED")
  ) {
    overall = "CODING_LOOP_PARTIALLY_RUNTIME_VERIFIED";
  } else {
    overall = "CODING_LOOP_NOT_YET_RUNTIME_VERIFIED";
  }

  if (loopResult) {
    for (const g of loopResult.capability_gaps) capabilityGaps.push(g);
  }

  return finalise({
    startedAt,
    overall_verdict: overall,
    target_source_file: targetRel,
    spec_derived_test_file: specDerivedTestRel,
    extraction: {
      classification,
      stats: extraction.stats,
      expected_behaviour_count: extraction.expected_behaviours.length,
    },
    generation: {
      ok: true,
      case_count: generation.cases.length,
      refusal_count: generation.refusals.length,
      high_confidence_count: generation.stats.high_confidence,
      refusals: generation.refusals,
    },
    programming_loop: loopResult,
    rationale:
      overall === "CODING_LOOP_RUNTIME_VERIFIED"
        ? `full spec-driven chain executed: extract → generate → write → programming-loop VERIFIED`
        : overall === "CODING_LOOP_PARTIALLY_RUNTIME_VERIFIED"
          ? `chain reached CHANGE but did not fully verify · see programming_loop.stages`
          : `chain executed to programming-loop but did not verify · see programming_loop.stages`,
    capability_gaps: capabilityGaps,
    repo_root: input.repo_root,
  });
}

// ── Internal helpers ─────────────────────────────────────────────────────

function emptyExtraction() {
  return {
    classification: "SPECIFICATION_INSUFFICIENT" as const,
    stats: {
      total_patterns_tested: 0,
      matches_high: 0,
      matches_medium: 0,
      matches_insufficient: 0,
      total_length: 0,
      capped_by: "n/a",
    },
    expected_behaviour_count: 0,
  };
}

function emptyGeneration() {
  return {
    ok: false,
    case_count: 0,
    refusal_count: 0,
    high_confidence_count: 0,
    refusals: [] as VerificationRefusal[],
  };
}

interface FinaliseArgs {
  readonly startedAt: Date;
  readonly overall_verdict: SpecDrivenVerdict;
  readonly target_source_file: string;
  readonly spec_derived_test_file: string | null;
  readonly extraction: SpecificationDrivenLoopResult["extraction"];
  readonly generation: SpecificationDrivenLoopResult["generation"];
  readonly programming_loop: NativeLoopResult | null;
  readonly rationale: string;
  readonly capability_gaps: readonly string[];
  readonly repo_root: string;
}

function finalise(args: FinaliseArgs): SpecificationDrivenLoopResult {
  return {
    ok: true,
    overall_verdict: args.overall_verdict,
    zero_llm: true,
    started_at: args.startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    repo_root: args.repo_root,
    target_source_file: args.target_source_file,
    spec_derived_test_file: args.spec_derived_test_file,
    extraction: args.extraction,
    generation: args.generation,
    programming_loop: args.programming_loop,
    rationale: args.rationale,
    capability_gaps: args.capability_gaps,
    evidence_kind: "COMPOSED",
  };
}
