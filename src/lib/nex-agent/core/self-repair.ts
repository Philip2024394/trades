// src/lib/nex-agent/core/self-repair.ts
//
// NEX Agent v1.2 · Self-repair loop with mandatory reverification after every attempt.
//
// Flow (per founder spec):
//   1. Create isolated worktree at data/nex-agent-workspaces/task-{id8}/
//   2. Write nex1's proposed_files into the worktree
//   3. Run verification (typecheck · lint · optionally tests) INSIDE the worktree
//   4. If fails · nex1 diagnoses findings · proposes patches · nex2/nex3 review
//   5. Apply approved patches to worktree · reverify
//   6. Max 5 attempts · halt after that · founder inspects worktree
//
// Nothing touches main. The founder merges the worktree branch manually when
// happy. If the loop halts with failures, founder can inspect the worktree
// files and decide.

import { Client } from "pg";
import { gitWorktreeCreate, gitWorktreeList, runTypecheck, runLint, type VerificationFinding } from "../tools/verification";
import { writeFileSafe } from "../tools/write";
import type { Plan, ProposedFile } from "./orchestrator-types";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const REPO_ROOT = process.cwd();
const WORKTREE_BASE = resolve(REPO_ROOT, "data", "nex-agent-workspaces");

export const MAX_REPAIR_ATTEMPTS = 5;

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL ?? process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}
async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  await c.connect();
  try { return await fn(c); } finally { try { await c.end(); } catch { /* ignore */ } }
}
async function emitStep(taskId: string, actor: "nex1" | "nex2" | "nex3" | "founder" | "system", step_kind: string, title: string, body?: unknown): Promise<void> {
  await withClient(c => c.query(
    `INSERT INTO nex_agent.task_steps (task_id, actor, step_kind, title, body) VALUES ($1,$2,$3,$4,$5)`,
    [taskId, actor, step_kind, title, body ? JSON.stringify(body) : null],
  ));
}

// ─── Two-track repair · fast deterministic library + reasoning path ─
export interface RepairPatch {
  path: string;
  action: "modify" | "create";
  new_content: string;
  rationale: string;
  from_findings: string[];  // finding rules that motivated this patch
  track: "deterministic" | "reasoning";
}

// A ReasoningDiagnosis is nex1's *structured hypothesis* about an unknown
// error. It doesn't ship a patch yet · nex2/nex3 review it first · then either:
//   · reviewers approve a suggested_patch_shape → the shape becomes a patch
//   · reviewers reject → the finding stays stuck for the founder
export interface ReasoningDiagnosis {
  finding_rule: string;
  finding_file: string;
  finding_line: number | undefined;
  finding_message: string;
  suspected_cause: string;         // one sentence
  affected_code_context: string;   // 5-line snippet around the failure
  suggested_patch_shape: string;   // human-readable description · reviewers judge shape
  confidence: "low" | "medium" | "high";
  requires_reviewer: boolean;      // always true in V1.2.1 · V1.3+ may auto-approve high-confidence
}

// ─── Deterministic library · fast path for known-safe fixes ────
// Returns { patches, cannot_deterministic }. The library is intentionally
// small: it exists to fix issues that have EXACTLY ONE correct answer.
// Extending it is a one-line addition per rule.
function tryDeterministicPatches(findings: VerificationFinding[], currentFiles: ProposedFile[]): { patches: RepairPatch[]; unhandled: VerificationFinding[] } {
  const patches: RepairPatch[] = [];
  const unhandled: VerificationFinding[] = [];

  const byFile = new Map<string, VerificationFinding[]>();
  for (const f of findings) {
    if (!f.file || f.severity !== "error") continue;
    const arr = byFile.get(f.file) ?? []; arr.push(f); byFile.set(f.file, arr);
  }

  for (const [file, fileFindings] of byFile) {
    const proposed = currentFiles.find(pf => file.endsWith(pf.path) || pf.path.endsWith(file));
    if (!proposed) { unhandled.push(...fileFindings); continue; }

    let content = proposed.preview_content;
    const applied: string[] = [];
    const remainingForFile: VerificationFinding[] = [];

    for (const f of fileFindings) {
      // TS2802 · matchAll iteration → Array.from()
      if (f.rule === "TS2802" && /matchAll/.test(f.message)) {
        content = content.replace(/for\s*\(\s*(const|let)\s+(\w+)\s+of\s+([\w.]+)\.matchAll\(([^)]+)\)\)/g, "for ($1 $2 of Array.from($3.matchAll($4)))");
        applied.push("wrap-matchAll-with-Array.from");
        continue;
      }
      // TS6133 · Unused declaration → prefix with _
      if (f.rule === "TS6133") {
        const m = /'([^']+)' is declared but/.exec(f.message);
        if (m) { const name = m[1]; content = content.replace(new RegExp(`\\b${name}\\b(\\s*[:,)])`, "g"), `_${name}$1`); applied.push(`prefix-unused-${name}`); continue; }
      }
      // TS7006 · implicit any parameter → : unknown
      if (f.rule === "TS7006") {
        const m = /Parameter '([^']+)' implicitly has/.exec(f.message);
        if (m) { const name = m[1]; content = content.replace(new RegExp(`\\b${name}\\b(\\s*[,)])`, "g"), `${name}: unknown$1`); applied.push(`annotate-${name}-unknown`); continue; }
      }
      // Anything else stays unhandled → routes to reasoning path
      remainingForFile.push(f);
    }

    if (applied.length > 0 && content !== proposed.preview_content) {
      patches.push({ path: proposed.path, action: proposed.action, new_content: content, rationale: `Deterministic: ${applied.join("; ")}`, from_findings: fileFindings.map(f => `${f.rule ?? "?"}:${f.line ?? "?"}`), track: "deterministic" });
    }
    unhandled.push(...remainingForFile);
  }

  return { patches, unhandled };
}

// ─── Reasoning path · nex1 forms a structured diagnosis ─────────
// Deterministic today (extracts context + composes a suspected_cause using rules).
// Future: an LLM helper CAN plug in here · its output is still gated by nex2/nex3 review
// before ever becoming a patch. The interface stays the same.
function tryReasoningDiagnoses(unhandled: VerificationFinding[], currentFiles: ProposedFile[]): ReasoningDiagnosis[] {
  const out: ReasoningDiagnosis[] = [];
  for (const f of unhandled) {
    const file = f.file ?? "?";
    const proposed = currentFiles.find(pf => file.endsWith(pf.path) || pf.path.endsWith(file));
    // Extract a ±2 line context window
    let context = "(context unavailable)";
    if (proposed && f.line) {
      const lines = proposed.preview_content.split("\n");
      const start = Math.max(0, f.line - 3);
      const end = Math.min(lines.length, f.line + 2);
      context = lines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`).join("\n");
    }
    // Compose suspected_cause from finding rule
    let cause = "Unknown · needs reviewer";
    let shape = "unknown";
    let confidence: ReasoningDiagnosis["confidence"] = "low";
    if (f.rule === "TS2307" || /Cannot find module/.test(f.message)) {
      cause = "Wrong import path · module resolution failed · likely wrong relative path or missing package";
      shape = "Change the import specifier to the correct relative path OR install the missing package (founder decides if new dep is allowed by architecture.json)";
      confidence = "medium";
    } else if (f.rule === "TS2339") {
      const m = /Property '([^']+)' does not exist on type '([^']+)'/.exec(f.message);
      if (m) { cause = `Property '${m[1]}' missing on type '${m[2]}' · either the property genuinely doesn't exist (bug) OR the type needs widening/refinement`;
               shape = `Add narrowing check (typeof / in / union discriminator) OR add the property to the type definition`;
               confidence = "medium"; }
    } else if (f.rule === "TS2345" || /not assignable to parameter of type/.test(f.message)) {
      cause = "Type mismatch at call site · argument shape doesn't match expected parameter";
      shape = "Cast at the boundary OR fix the caller to produce the expected shape";
      confidence = "medium";
    } else if (f.rule === "TS2322" || /not assignable to type/.test(f.message)) {
      cause = "Type mismatch in assignment · rhs doesn't match lhs";
      shape = "Adjust the type annotation OR change the value shape";
      confidence = "medium";
    }
    out.push({ finding_rule: f.rule ?? "?", finding_file: file, finding_line: f.line, finding_message: f.message, suspected_cause: cause, affected_code_context: context, suggested_patch_shape: shape, confidence, requires_reviewer: true });
  }
  return out;
}

// ─── Top-level entry · orchestrator calls this ─────────────────
export function generateRepairPatches(findings: VerificationFinding[], currentFiles: ProposedFile[]): { patches: RepairPatch[]; reasoning_diagnoses: ReasoningDiagnosis[]; cannot_repair: string[] } {
  const det = tryDeterministicPatches(findings, currentFiles);
  const diagnoses = tryReasoningDiagnoses(det.unhandled, currentFiles);
  // cannot_repair = diagnoses that lack a suggested_patch_shape (rare · would be zero for common TS codes)
  const cannot_repair = diagnoses.filter(d => d.suggested_patch_shape === "unknown").map(d => `${d.finding_rule} in ${d.finding_file}:${d.finding_line ?? "?"}: ${d.finding_message}`);
  return { patches: det.patches, reasoning_diagnoses: diagnoses, cannot_repair };
}

// ─── Apply proposed files to a worktree ──────────────────────────
export async function writeProposedFilesToWorktree(taskId: string, worktreePath: string, files: ProposedFile[]): Promise<{ written: number; errors: Array<{ path: string; reason: string }> }> {
  const errors: Array<{ path: string; reason: string }> = [];
  let written = 0;
  for (const pf of files) {
    // Skip placeholder paths that contain TBD / TODO
    if (/TBD|TODO_ENGINEER|NNN/.test(pf.path)) {
      await emitStep(taskId, "nex1", "thought", `skipping placeholder path ${pf.path}`, { path: pf.path });
      continue;
    }
    const r = writeFileSafe({ path: pf.path, content: pf.preview_content, allowedRoot: worktreePath });
    if (!r.ok) { errors.push({ path: pf.path, reason: r.reason ?? "unknown" }); await emitStep(taskId, "nex1", "tool_result", `write_file_safe FAILED ${pf.path}`, { reason: r.reason }); }
    else { written++; await emitStep(taskId, "nex1", "tool_result", `wrote ${pf.path} · ${(r.data as { bytes_written: number }).bytes_written} bytes`, { path: pf.path, bytes: (r.data as { bytes_written: number }).bytes_written }); }
  }
  return { written, errors };
}

// ─── The self-repair loop ────────────────────────────────────────
export interface RepairAttempt {
  attempt: number;
  verification_ok: boolean;
  typecheck: { ok: boolean; errors: number; findings_sample: VerificationFinding[] };
  patches_applied: RepairPatch[];
  reasoning_diagnoses?: ReasoningDiagnosis[];
  cannot_repair: string[];
  duration_ms: number;
}
export interface RepairOutcome {
  worktree_path: string;
  branch: string;
  attempts: RepairAttempt[];
  final_ok: boolean;
  halted_reason: "success" | "max_attempts" | "no_repair_possible" | "worktree_error";
  files_in_worktree: string[];
}

export async function runSelfRepairLoop(taskId: string, plan: Plan): Promise<RepairOutcome> {
  await emitStep(taskId, "system", "handoff", `─── V1.2 SELF-REPAIR LOOP · MAX ${MAX_REPAIR_ATTEMPTS} ATTEMPTS ───`);

  // Step 1 · ensure worktree exists
  await emitStep(taskId, "nex1", "tool_call", "git_worktree_create", { task_id: taskId });
  const list = await gitWorktreeList();
  const worktreePath = join(WORKTREE_BASE, `task-${taskId.slice(0, 8)}`);
  let branch = `nex-agent/task-${taskId.slice(0, 8)}`;
  const already = (list.data as { worktrees: Array<{ path: string; branch: string }> } | undefined)?.worktrees.find(w => w.path.replace(/\\/g, "/").endsWith(`task-${taskId.slice(0, 8)}`));
  if (!already) {
    const create = await gitWorktreeCreate(taskId);
    if (!create.ok) {
      await emitStep(taskId, "system", "review_fail", `worktree_create FAILED · ${create.reason}`, { reason: create.reason });
      return { worktree_path: worktreePath, branch, attempts: [], final_ok: false, halted_reason: "worktree_error", files_in_worktree: [] };
    }
    branch = (create.data as { branch: string }).branch;
    await emitStep(taskId, "nex1", "tool_result", `worktree created · branch=${branch}`, create.data);
  } else {
    branch = already.branch;
    await emitStep(taskId, "nex1", "thought", `worktree already exists · reusing branch=${branch}`);
  }

  // Step 2 · write proposed files into the worktree
  const proposed = plan.proposed_files ?? [];
  await emitStep(taskId, "nex1", "handoff", `writing ${proposed.length} proposed file(s) to worktree`, { worktree_path: worktreePath });
  const writeRes = await writeProposedFilesToWorktree(taskId, worktreePath, proposed);
  const filesWritten: string[] = proposed.filter(p => !/TBD|TODO_ENGINEER|NNN/.test(p.path)).map(p => p.path);

  // Step 3 · repair loop
  const attempts: RepairAttempt[] = [];
  let currentFiles = [...proposed];
  let attempt = 0;
  let finalOk = false;
  let halted: RepairOutcome["halted_reason"] = "max_attempts";
  let lastCannotRepair: string[] = [];

  while (attempt < MAX_REPAIR_ATTEMPTS) {
    attempt++;
    const t0 = Date.now();
    await emitStep(taskId, "system", "handoff", `─── REPAIR ATTEMPT ${attempt}/${MAX_REPAIR_ATTEMPTS} · verifying in worktree ───`);
    await emitStep(taskId, "nex2", "tool_call", "run_typecheck in worktree", { cwd: worktreePath });

    const tc = await runTypecheck({ cwd: worktreePath, timeoutMs: 180_000 });
    const tcData = tc.data;
    const attemptRecord: RepairAttempt = {
      attempt,
      verification_ok: tc.ok,
      typecheck: { ok: tc.ok, errors: tcData?.error_count ?? 0, findings_sample: (tcData?.findings ?? []).slice(0, 5) },
      patches_applied: [],
      cannot_repair: [],
      duration_ms: 0,
    };

    await emitStep(taskId, "nex2", tc.ok ? "review_pass" : "review_fail",
      `typecheck ${tc.ok ? "PASS" : `FAIL · ${tcData?.error_count ?? 0} errors`} · ${tc.duration_ms}ms`,
      { gate: "typecheck", ok: tc.ok, error_count: tcData?.error_count, findings: (tcData?.findings ?? []).slice(0, 20), attempt, cwd_worktree: worktreePath });

    if (tc.ok) {
      finalOk = true;
      halted = "success";
      attemptRecord.duration_ms = Date.now() - t0;
      attempts.push(attemptRecord);
      await emitStep(taskId, "system", "review_pass", `✓ verification PASSED at attempt ${attempt}`);
      break;
    }

    // Step 4 · two-track diagnosis · deterministic library + reasoning path
    await emitStep(taskId, "nex1", "thought", `attempt ${attempt} · diagnosing ${tcData?.error_count ?? 0} typecheck errors`, { findings: (tcData?.findings ?? []).slice(0, 10) });
    const { patches, reasoning_diagnoses, cannot_repair } = generateRepairPatches(tcData?.findings ?? [], currentFiles);
    attemptRecord.patches_applied = patches;
    attemptRecord.reasoning_diagnoses = reasoning_diagnoses;
    attemptRecord.cannot_repair = cannot_repair;
    lastCannotRepair = cannot_repair;

    if (patches.length === 0 && reasoning_diagnoses.length === 0) {
      halted = "no_repair_possible";
      await emitStep(taskId, "nex1", "review_fail", `⛔ nex1 has no deterministic patches AND no reasoning hypotheses · halting · founder decides`, { cannot_repair });
      attemptRecord.duration_ms = Date.now() - t0;
      attempts.push(attemptRecord);
      break;
    }

    // If we have reasoning diagnoses, emit them for reviewer approval BEFORE applying · V1.2.1 pattern
    if (reasoning_diagnoses.length > 0) {
      await emitStep(taskId, "nex1", "handoff",
        `attempt ${attempt} · nex1 has ${reasoning_diagnoses.length} reasoning diagnosis(es) awaiting reviewer approval · ${patches.length} deterministic patch(es) can apply immediately`,
        { reasoning_diagnoses });
    }

    await emitStep(taskId, "nex1", "handoff",
      `applying ${patches.length} deterministic patch(es) · ${reasoning_diagnoses.length} reasoning diagnosis(es) deferred to founder`,
      { patches: patches.map(p => ({ path: p.path, rationale: p.rationale, track: p.track, from_findings: p.from_findings })), reasoning_diagnoses });

    // Step 5 · apply DETERMINISTIC patches only · reasoning patches wait for reviewer
    for (const p of patches) {
      const w = writeFileSafe({ path: p.path, content: p.new_content, allowedRoot: worktreePath });
      await emitStep(taskId, "nex1", "tool_result", `wrote ${p.track} patch ${p.path} · ${w.ok ? "ok" : "FAIL"}`, { rationale: p.rationale, track: p.track });
      const idx = currentFiles.findIndex(cf => cf.path === p.path);
      if (idx >= 0) currentFiles[idx] = { ...currentFiles[idx], preview_content: p.new_content };
    }

    // If ONLY reasoning diagnoses (no deterministic patches applied), halt · founder must approve reasoning
    if (patches.length === 0 && reasoning_diagnoses.length > 0) {
      halted = "no_repair_possible";
      await emitStep(taskId, "nex1", "review_fail", `⛔ HALT · no deterministic fix available · ${reasoning_diagnoses.length} reasoning diagnosis(es) awaiting founder decision`, { reasoning_diagnoses });
      attemptRecord.duration_ms = Date.now() - t0;
      attempts.push(attemptRecord);
      break;
    }

    attemptRecord.duration_ms = Date.now() - t0;
    attempts.push(attemptRecord);
    // loop continues · next verification runs immediately
  }

  if (!finalOk && halted === "max_attempts") {
    await emitStep(taskId, "system", "review_fail",
      `⛔ HALT · ${MAX_REPAIR_ATTEMPTS} attempts exhausted · founder inspects worktree ${worktreePath}`,
      { attempts_summary: attempts.map(a => ({ attempt: a.attempt, verification_ok: a.verification_ok, patches_applied: a.patches_applied.length, cannot_repair: a.cannot_repair.length })), last_cannot_repair: lastCannotRepair });
  }

  return {
    worktree_path: worktreePath,
    branch,
    attempts,
    final_ok: finalOk,
    halted_reason: halted,
    files_in_worktree: filesWritten,
  };
}
