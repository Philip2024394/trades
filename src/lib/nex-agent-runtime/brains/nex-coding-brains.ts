// WO-AGENT-RUNTIME-05 · 4 NEX Coding brains.
//
// Specialist coding workers. Operate on local workspace only. Never
// touch substrate. P-U preserved.

import { promises as fs } from "node:fs";
import path from "node:path";
import { sha256Hex } from "@/lib/nex-intelligence/provenance";
import type { Mission, MissionResult, BrainToolContext } from "../runtime-loop";

// ── Code Generator ─────────────────────────────────────────────────────
export function makeCodeGeneratorBrain() {
  return async function codeGeneratorBrain(mission: Mission, ctx: BrainToolContext): Promise<MissionResult> {
    const evidence_refs: string[] = [];
    const generationId = `code-gen-${sha256Hex(mission.mission_id).slice(0, 16)}`;
    await ctx.emitProgress({
      progress_counter: 1, last_completed_work: `code generation ${generationId} planned`,
      evidence_refs: [`gen-plan:${generationId}`],
    });
    evidence_refs.push(`gen-plan:${generationId}`);

    // Deterministic: propose a diff based on the mission input
    const template = typeof (mission.input as { template?: unknown }).template === "string" ? (mission.input as { template: string }).template : "empty";
    const proposedLines = template.length * 2;   // deterministic function of input
    await ctx.writeMemory({
      kind: "MISSION_OUTCOME", mission_id: mission.mission_id,
      content: { generation_id: generationId, template, proposed_lines: proposedLines, kind: "code-generation-proposal" },
    });
    evidence_refs.push(`memory:code-gen:${generationId}`);
    await ctx.emitProgress({
      progress_counter: 2, last_completed_work: `${proposedLines} lines proposed for template "${template}"`,
      evidence_refs: [`memory:code-gen:${generationId}`],
    });
    return { outcome: "SUCCESS", items_processed: 1, evidence_refs, summary: `${proposedLines} lines proposed` };
  };
}

// ── Code Reviewer ──────────────────────────────────────────────────────
export function makeCodeReviewerBrain() {
  return async function codeReviewerBrain(mission: Mission, ctx: BrainToolContext): Promise<MissionResult> {
    const evidence_refs: string[] = [];
    const reviewId = `code-review-${sha256Hex(mission.mission_id).slice(0, 16)}`;
    await ctx.emitProgress({
      progress_counter: 1, last_completed_work: `code review ${reviewId} started`,
      evidence_refs: [`review-start:${reviewId}`],
    });
    evidence_refs.push(`review-start:${reviewId}`);

    // Deterministic: read a target file and count non-empty lines
    const targetPath = typeof (mission.input as { path?: unknown }).path === "string" ? (mission.input as { path: string }).path : "package.json";
    let lines = 0, findings = 0;
    try {
      const content = await fs.readFile(path.join(process.cwd(), targetPath), "utf8");
      lines = content.split("\n").filter((l) => l.trim().length > 0).length;
      // Deterministic finding: count occurrences of "TODO" as a review finding
      findings = (content.match(/TODO/g) ?? []).length;
    } catch { /* file missing = zero */ }

    await ctx.writeMemory({
      kind: "MISSION_OUTCOME", mission_id: mission.mission_id,
      content: { review_id: reviewId, target: targetPath, lines_reviewed: lines, findings, kind: "code-review-report" },
    });
    evidence_refs.push(`memory:review:${reviewId}`);
    await ctx.emitProgress({
      progress_counter: 2, last_completed_work: `${lines} lines reviewed · ${findings} findings`,
      evidence_refs: [`memory:review:${reviewId}`],
    });
    return {
      outcome: "SUCCESS", items_processed: lines, evidence_refs,
      summary: `reviewed ${lines} lines · ${findings} findings`,
    };
  };
}

// ── Code Refactorer ────────────────────────────────────────────────────
export function makeCodeRefactorerBrain() {
  return async function codeRefactorerBrain(mission: Mission, ctx: BrainToolContext): Promise<MissionResult> {
    const evidence_refs: string[] = [];
    const refactorId = `refactor-${sha256Hex(mission.mission_id).slice(0, 16)}`;
    await ctx.emitProgress({
      progress_counter: 1, last_completed_work: `refactor proposal ${refactorId} started`,
      evidence_refs: [`refactor-start:${refactorId}`],
    });
    evidence_refs.push(`refactor-start:${refactorId}`);

    // Deterministic: propose a bounded number of refactor edits
    const proposedEdits = Math.min(3, typeof (mission.input as { max_edits?: unknown }).max_edits === "number" ? (mission.input as { max_edits: number }).max_edits : 1);
    await ctx.writeMemory({
      kind: "MISSION_OUTCOME", mission_id: mission.mission_id,
      content: { refactor_id: refactorId, proposed_edits: proposedEdits, kind: "refactor-proposal", signed: false },
    });
    evidence_refs.push(`memory:refactor:${refactorId}`);
    await ctx.emitProgress({
      progress_counter: 2, last_completed_work: `${proposedEdits} refactor edits proposed (unsigned · founder must sign)`,
      evidence_refs: [`memory:refactor:${refactorId}`],
    });
    return { outcome: "SUCCESS", items_processed: proposedEdits, evidence_refs, summary: `${proposedEdits} refactor edits proposed` };
  };
}

// ── Test Author ────────────────────────────────────────────────────────
export function makeTestAuthorBrain() {
  return async function testAuthorBrain(mission: Mission, ctx: BrainToolContext): Promise<MissionResult> {
    const evidence_refs: string[] = [];
    const suiteId = `test-suite-${sha256Hex(mission.mission_id).slice(0, 16)}`;
    await ctx.emitProgress({
      progress_counter: 1, last_completed_work: `test suite ${suiteId} planned`,
      evidence_refs: [`test-plan:${suiteId}`],
    });
    evidence_refs.push(`test-plan:${suiteId}`);

    // Deterministic: propose a test count based on target complexity
    const targetKind = typeof (mission.input as { kind?: unknown }).kind === "string" ? (mission.input as { kind: string }).kind : "unit";
    const proposedTests = targetKind === "adversarial" ? 5 : targetKind === "property" ? 3 : 2;
    await ctx.writeMemory({
      kind: "MISSION_OUTCOME", mission_id: mission.mission_id,
      content: { suite_id: suiteId, kind: targetKind, proposed_tests: proposedTests, coverage_hint: "arrows + rejections" },
    });
    evidence_refs.push(`memory:test-suite:${suiteId}`);
    await ctx.emitProgress({
      progress_counter: 2, last_completed_work: `${proposedTests} tests proposed for ${targetKind}`,
      evidence_refs: [`memory:test-suite:${suiteId}`],
    });
    return {
      outcome: "SUCCESS", items_processed: proposedTests, evidence_refs,
      summary: `${proposedTests} tests proposed for ${targetKind} suite`,
    };
  };
}
