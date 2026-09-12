// src/app/api/nex/agent/autonomy/apply/route.ts
//
// NEX Agent v1.5 · AUTO-APPLY write path.
// POST { task_id, applied_by? }
//   → evaluateAutonomousDecision
//   → if can_auto_apply=false: refuse + record refused_* event
//   → if can_auto_apply=true:
//        · create isolated worktree
//        · writeFileSafe each proposed file
//        · run typecheck in worktree
//        · if typecheck FAILS: DO NOT commit · record auto_apply_refused + revert
//        · if typecheck PASSES: git commit to the worktree branch · record auto_applied
//        · task status → auto_applied_verified
//        · FOUNDER still merges manually · never auto-merge to main
//
// Emits every step to nex_agent.task_steps so the SSE stream shows it live.

import { NextResponse } from "next/server";
import { Client } from "pg";
import { evaluateAutonomousDecision, recordAutoApplyDecision } from "@/lib/nex-agent/core/autonomous-engineer";
import { gitWorktreeCreate, gitWorktreeList, runTypecheck } from "@/lib/nex-agent/tools/verification";
import { writeFileSafe } from "@/lib/nex-agent/tools/write";
import type { Plan } from "@/lib/nex-agent/core/orchestrator-types";
import { resolve, join } from "node:path";
import { spawn } from "node:child_process";
import { writeFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REPO_ROOT = process.cwd();
const WORKTREE_BASE = resolve(REPO_ROOT, "data", "nex-agent-workspaces");

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL ?? process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}
async function emitStep(taskId: string, actor: "nex1" | "nex2" | "nex3" | "founder" | "system", step_kind: string, title: string, body?: unknown): Promise<void> {
  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  try {
    await c.connect();
    await c.query(`INSERT INTO nex_agent.task_steps (task_id, actor, step_kind, title, body) VALUES ($1,$2,$3,$4,$5)`,
      [taskId, actor, step_kind, title, body ? JSON.stringify(body) : null]);
  } finally { try { await c.end(); } catch { /* ignore */ } }
}

// Small helper to run git commit inside the worktree (bounded child_process)
// Message is passed via a temp file with `-F` · avoids Windows cmd tokenisation
// (multi-line messages + spaces break `git commit -m "..."` under shell:true).
// `-a` dropped since we always `git add -A` before commit.
function gitCommit(cwd: string, message: string, timeoutMs = 15_000): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((res) => {
    const msgDir = mkdtempSync(join(tmpdir(), "nex-agent-commit-"));
    const msgFile = join(msgDir, "COMMIT_MSG");
    try { writeFileSync(msgFile, message, "utf8"); } catch (e) { res({ ok: false, stdout: "", stderr: "commit_msg_write_failed:" + (e as Error).message }); return; }
    const child = spawn("git", ["commit", "-F", msgFile], { cwd, shell: process.platform === "win32" });
    let stdout = "", stderr = "";
    const cleanup = () => { try { unlinkSync(msgFile); } catch { /* ignore */ } };
    const timer = setTimeout(() => { try { child.kill("SIGKILL"); } catch { /* ignore */ } }, timeoutMs);
    child.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
    child.on("exit", (code) => { clearTimeout(timer); cleanup(); res({ ok: code === 0, stdout: stdout.slice(-2000), stderr: stderr.slice(-2000) }); });
    child.on("error", (e) => { clearTimeout(timer); cleanup(); res({ ok: false, stdout, stderr: stderr + "\nERR: " + e.message }); });
  });
}
// Add all changes to the index so `git commit -a` doesn't miss new files
function gitAddAll(cwd: string, timeoutMs = 10_000): Promise<{ ok: boolean; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("git", ["add", "-A"], { cwd, shell: process.platform === "win32" });
    let stderr = "";
    const timer = setTimeout(() => { try { child.kill("SIGKILL"); } catch { /* ignore */ } }, timeoutMs);
    child.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
    child.on("exit", (code) => { clearTimeout(timer); resolve({ ok: code === 0, stderr: stderr.slice(-800) }); });
    child.on("error", (e) => { clearTimeout(timer); resolve({ ok: false, stderr: stderr + "\nERR: " + e.message }); });
  });
}

export async function POST(req: Request) {
  let body: { task_id?: string; applied_by?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const taskId = String(body.task_id ?? "").trim();
  const applied_by = String(body.applied_by ?? "nex1_autonomous").slice(0, 60);
  if (!taskId) return NextResponse.json({ ok: false, error: "task_id_required" }, { status: 400 });

  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  let plan: Plan | null = null;
  try {
    await c.connect();
    const task = (await c.query(`SELECT plan, status FROM nex_agent.tasks WHERE task_id=$1`, [taskId])).rows[0] as { plan: Plan | null; status: string } | undefined;
    if (!task) return NextResponse.json({ ok: false, error: "task_not_found" }, { status: 404 });
    if (!task.plan) return NextResponse.json({ ok: false, error: "task_has_no_plan" }, { status: 400 });
    plan = task.plan;
    if (task.status !== "plan_ready" && task.status !== "plan_approved") {
      return NextResponse.json({ ok: false, error: `bad_status:${task.status} · needs plan_ready or plan_approved` }, { status: 409 });
    }
  } finally { try { await c.end(); } catch { /* ignore */ } }
  if (!plan) return NextResponse.json({ ok: false, error: "plan_missing" }, { status: 500 });

  await emitStep(taskId, "system", "handoff", `─── V1.5 AUTO-APPLY EVALUATION · applied_by=${applied_by} ───`);
  const decision = await evaluateAutonomousDecision(plan);
  await emitStep(taskId, "nex1", decision.can_auto_apply ? "review_pass" : "review_fail",
    `autonomy decision: ${decision.can_auto_apply ? "AUTO-APPLY OK" : "AUTO-APPLY REFUSED"} · tier ${decision.autonomy_tier} · category=${decision.matched_category?.category_label ?? "(none)"}`,
    { decision });

  // ── REFUSED ─────────────────────────────────────────────────
  if (!decision.can_auto_apply) {
    const kind = decision.daily_cap_reached ? "refused_daily_cap"
               : !decision.matched_category ? "refused_category"
               : "refused_tier";
    await recordAutoApplyDecision({ task_id: taskId, category_id: decision.matched_category?.category_id, decision: kind, reason: decision.reasons_against.slice(0, 2).join("; ").slice(0, 300), files_changed: 0 });
    const upd = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
    try {
      await upd.connect();
      await upd.query(`UPDATE nex_agent.tasks SET status='auto_apply_refused', current_actor='founder', updated_at=now() WHERE task_id=$1`, [taskId]);
    } finally { try { await upd.end(); } catch { /* ignore */ } }
    return NextResponse.json({ ok: false, refused: true, decision });
  }

  // ── ACCEPTED · proceed to worktree write + verify + commit ─
  const proposed = plan.proposed_files ?? [];
  if (proposed.length === 0) {
    await recordAutoApplyDecision({ task_id: taskId, category_id: decision.matched_category?.category_id, decision: "refused_category", reason: "plan has no proposed_files", files_changed: 0 });
    return NextResponse.json({ ok: false, refused: true, reason: "plan_has_no_proposed_files" }, { status: 400 });
  }

  // Ensure worktree exists
  const worktreePath = join(WORKTREE_BASE, `task-${taskId.slice(0, 8)}`);
  const list = await gitWorktreeList();
  const already = (list.data as { worktrees: Array<{ path: string; branch: string }> } | undefined)?.worktrees.find(w => w.path.replace(/\\/g, "/").endsWith(`task-${taskId.slice(0, 8)}`));
  let branch = `nex-agent/task-${taskId.slice(0, 8)}`;
  if (!already) {
    const create = await gitWorktreeCreate(taskId);
    if (!create.ok) {
      await emitStep(taskId, "system", "review_fail", `worktree_create failed · ${create.reason}`, create);
      return NextResponse.json({ ok: false, error: `worktree_create_failed:${create.reason}` }, { status: 500 });
    }
    branch = (create.data as { branch: string }).branch;
    await emitStep(taskId, "nex1", "tool_result", `worktree created · branch=${branch}`, create.data);
  }

  // Write proposed files
  const writeResults: Array<{ path: string; ok: boolean; bytes?: number; reason?: string }> = [];
  for (const pf of proposed) {
    // Skip placeholder paths
    if (/TBD|TODO_ENGINEER|NNN/.test(pf.path)) {
      await emitStep(taskId, "nex1", "thought", `skipping placeholder ${pf.path}`, { path: pf.path });
      continue;
    }
    const w = writeFileSafe({ path: pf.path, content: pf.preview_content, allowedRoot: worktreePath });
    writeResults.push({ path: pf.path, ok: w.ok, bytes: (w.data as { bytes_written: number } | undefined)?.bytes_written, reason: w.reason });
    await emitStep(taskId, "nex1", "tool_result", `write_file_safe ${pf.path} · ${w.ok ? "ok" : "FAIL"}`, { rationale: pf.why, ...w });
  }
  const filesWritten = writeResults.filter(r => r.ok).length;
  if (filesWritten === 0) {
    await emitStep(taskId, "system", "review_fail", "no files written · aborting auto-apply", { writeResults });
    return NextResponse.json({ ok: false, error: "no_files_written", writeResults }, { status: 500 });
  }

  // Verify inside the worktree · TOUCHED-FILES GATE model.
  // The repo has pre-existing typecheck errors in unrelated files (test fixtures under tests/fixtures/programmer-*-proof/).
  // A repo-wide clean-typecheck gate would refuse every legitimate auto-apply.
  // Instead: run typecheck fully · then filter findings to only those referencing files the agent WROTE this round.
  // If the agent's own files produced zero typecheck errors → PASS. If any touched-file has an error → REFUSE.
  // Downside · this misses downstream regressions caused elsewhere. Accepted trade-off (Founder chose "touched-files gate" 2026-09-10).
  await emitStep(taskId, "nex2", "tool_call", "run_typecheck in worktree · touched-files gate", { cwd: worktreePath });
  const tc = await runTypecheck({ cwd: worktreePath, timeoutMs: 480_000 });
  const tcData = tc.data;
  const writtenPaths = writeResults.filter(r => r.ok).map(r => r.path.replace(/\\/g, "/"));
  const touchedFindings = (tcData?.findings ?? []).filter(f => {
    const file = (f.file ?? "").replace(/\\/g, "/");
    return writtenPaths.some(wp => file.endsWith(wp));
  });
  const touchedErrorCount = touchedFindings.filter(f => f.severity === "error").length;
  const touchedOk = touchedErrorCount === 0 && !tcData?.timed_out;
  await emitStep(taskId, "nex2", touchedOk ? "review_pass" : "review_fail",
    `typecheck touched-files gate ${touchedOk ? "PASS" : `FAIL · ${touchedErrorCount} errors on written files`} · repo total ${tcData?.error_count ?? 0} · ${tc.duration_ms}ms`,
    { gate: "typecheck_touched_files", ok: touchedOk, touched_error_count: touchedErrorCount, repo_error_count: tcData?.error_count, touched_findings: touchedFindings.slice(0, 10), written_paths: writtenPaths });

  if (!touchedOk) {
    await recordAutoApplyDecision({ task_id: taskId, category_id: decision.matched_category?.category_id, decision: "refused_category", reason: `verification failed · ${touchedErrorCount} typecheck errors on agent's written files`, files_changed: filesWritten });
    const upd = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
    try {
      await upd.connect();
      await upd.query(`UPDATE nex_agent.tasks SET status='auto_apply_refused', current_actor='founder', updated_at=now() WHERE task_id=$1`, [taskId]);
    } finally { try { await upd.end(); } catch { /* ignore */ } }
    await emitStep(taskId, "system", "review_fail", "auto-apply REFUSED · touched-files gate failed · files stay in worktree for founder review · no commit", { worktree_path: worktreePath, touched_findings: touchedFindings.slice(0, 5) });
    return NextResponse.json({ ok: false, refused_after_write: true, reason: "verification_failed_on_touched_files", worktree_path: worktreePath, decision, writeResults, touched_findings: touchedFindings.slice(0, 20), touched_error_count: touchedErrorCount, repo_error_count: tcData?.error_count, timed_out: tcData?.timed_out, tc_duration_ms: tc.duration_ms, tc_exit_code: tcData?.exit_code });
  }

  // Verification passed · git commit inside the worktree
  const addRes = await gitAddAll(worktreePath);
  if (!addRes.ok) await emitStep(taskId, "nex1", "tool_result", `git add -A · non-fatal warning: ${addRes.stderr.slice(0, 200)}`, {});
  const commitMessage = `nex-agent auto-apply · task ${taskId.slice(0, 8)}\n\napplied_by=${applied_by}\ncategory=${decision.matched_category?.category_label}\nautonomy_tier=${decision.autonomy_tier}\nfiles=${filesWritten}\n\nintent: ${plan.intent?.subject?.slice(0, 200) ?? "?"}\n\nFounder still needs to merge nex-agent/task-${taskId.slice(0, 8)} to main.`;
  const commitRes = await gitCommit(worktreePath, commitMessage);
  await emitStep(taskId, "nex1", commitRes.ok ? "review_pass" : "review_fail",
    `git commit · ${commitRes.ok ? "PASS · branch ready to merge" : "FAIL"} · ${commitRes.stdout.slice(0, 200)}`,
    { stdout: commitRes.stdout.slice(0, 400), stderr: commitRes.stderr.slice(0, 400) });

  if (!commitRes.ok) {
    // Files written but commit failed · treat as needs_review
    await recordAutoApplyDecision({ task_id: taskId, category_id: decision.matched_category?.category_id, decision: "refused_category", reason: `git commit failed · ${commitRes.stderr.slice(0, 200)}`, files_changed: filesWritten });
    const upd = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
    try {
      await upd.connect();
      await upd.query(`UPDATE nex_agent.tasks SET status='auto_apply_refused', current_actor='founder', updated_at=now() WHERE task_id=$1`, [taskId]);
    } finally { try { await upd.end(); } catch { /* ignore */ } }
    return NextResponse.json({ ok: false, refused: true, reason: "git_commit_failed", worktree_path: worktreePath, decision, writeResults, commit: commitRes }, { status: 500 });
  }

  // Success · record + flip task status
  await recordAutoApplyDecision({ task_id: taskId, category_id: decision.matched_category?.category_id, decision: "auto_applied", reason: `verified apply · ${filesWritten} files · branch ${branch}`, files_changed: filesWritten });
  const upd = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  try {
    await upd.connect();
    await upd.query(`UPDATE nex_agent.tasks SET status='auto_applied_verified', current_actor='founder', updated_at=now() WHERE task_id=$1`, [taskId]);
  } finally { try { await upd.end(); } catch { /* ignore */ } }
  await emitStep(taskId, "system", "handoff", `✓ AUTO-APPLY COMPLETE · ${filesWritten} files committed to ${branch} · founder merges manually`,
    { worktree_path: worktreePath, branch, files_changed: filesWritten });

  return NextResponse.json({
    ok: true,
    auto_applied: true,
    task_id: taskId,
    worktree_path: worktreePath,
    branch,
    files_changed: filesWritten,
    write_results: writeResults,
    typecheck_ok: tc.ok,
    touched_files_gate_ok: touchedOk,
    touched_error_count: touchedErrorCount,
    repo_error_count: tcData?.error_count,
    commit_ok: commitRes.ok,
    decision,
    merge_command: `git checkout main && git merge --no-ff ${branch} && git worktree remove ${worktreePath}`,
  });
}
