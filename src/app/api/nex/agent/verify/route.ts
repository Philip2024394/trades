// src/app/api/nex/agent/verify/route.ts
//
// NEX Agent v1.2 · run verification gates for a specific task.
// POST body: { task_id: string, gates?: Array<"typecheck"|"lint"|"tests"> }
//
// Runs each requested gate against the CURRENT working tree (V1.2 baseline
// verification). Emits nex2 steps for each gate result. Returns a summary
// so the UI can render green/red chips.
//
// V1.3 will run gates against the PROPOSED-DIFF worktree instead. For now,
// the founder proves the current codebase is healthy before nex1's plan
// touches anything.

import { NextResponse } from "next/server";
import { Client } from "pg";
import { runTypecheck, runLint, runTests, type VerificationFinding } from "@/lib/nex-agent/tools/verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600; // Next.js may enforce this on some hosts

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL ?? process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

async function emitStep(taskId: string, actor: "nex1" | "nex2" | "nex3" | "founder" | "system", step_kind: string, title: string, body?: unknown): Promise<void> {
  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  await c.connect();
  try {
    await c.query(`INSERT INTO nex_agent.task_steps (task_id, actor, step_kind, title, body) VALUES ($1,$2,$3,$4,$5)`,
      [taskId, actor, step_kind, title, body ? JSON.stringify(body) : null]);
  } finally { try { await c.end(); } catch { /* ignore */ } }
}

interface GateResult {
  gate: "typecheck" | "lint" | "tests";
  ok: boolean;
  duration_ms: number;
  reason?: string;
  error_count?: number;
  warning_count?: number;
  summary?: unknown;
  findings_preview: VerificationFinding[]; // first 10
}

export async function POST(req: Request) {
  let body: { task_id?: string; gates?: string[] } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const taskId = String(body.task_id ?? "").trim();
  if (!taskId) return NextResponse.json({ ok: false, error: "task_id_required" }, { status: 400 });
  const gates = new Set((body.gates ?? ["typecheck", "lint", "tests"]).filter((g): g is string => typeof g === "string"));

  await emitStep(taskId, "system", "handoff", `─── VERIFICATION START · gates=${[...gates].join(",")} ───`);
  const results: GateResult[] = [];

  if (gates.has("typecheck")) {
    await emitStep(taskId, "nex2", "tool_call", "run_typecheck · npx tsc --noEmit", { gate: "typecheck", scope: "repo" });
    const r = await runTypecheck({ timeoutMs: 180_000 });
    const d = r.data;
    const gr: GateResult = {
      gate: "typecheck", ok: r.ok, duration_ms: r.duration_ms, reason: r.reason,
      error_count: d?.error_count, warning_count: d?.warning_count, findings_preview: (d?.findings ?? []).slice(0, 10),
    };
    results.push(gr);
    await emitStep(taskId, "nex2", r.ok ? "review_pass" : "review_fail",
      `typecheck ${r.ok ? "PASS" : "FAIL"} · ${d?.error_count ?? 0} errors · ${d?.warning_count ?? 0} warnings · ${r.duration_ms}ms`,
      { gate: "typecheck", ok: r.ok, error_count: d?.error_count, warning_count: d?.warning_count, findings: (d?.findings ?? []).slice(0, 30), timed_out: d?.timed_out, stderr_tail: d?.stderr_tail?.slice(-500) });
  }

  if (gates.has("lint")) {
    await emitStep(taskId, "nex2", "tool_call", "run_lint · npx next lint", { gate: "lint", scope: "repo" });
    const r = await runLint({ timeoutMs: 120_000 });
    const d = r.data;
    const gr: GateResult = {
      gate: "lint", ok: r.ok, duration_ms: r.duration_ms, reason: r.reason,
      error_count: d?.error_count, warning_count: d?.warning_count, findings_preview: (d?.findings ?? []).slice(0, 10),
    };
    results.push(gr);
    await emitStep(taskId, "nex2", r.ok ? "review_pass" : "review_fail",
      `lint ${r.ok ? "PASS" : "FAIL"} · ${d?.error_count ?? 0} errors · ${d?.warning_count ?? 0} warnings · ${r.duration_ms}ms`,
      { gate: "lint", ok: r.ok, error_count: d?.error_count, warning_count: d?.warning_count, findings: (d?.findings ?? []).slice(0, 30), timed_out: d?.timed_out, stderr_tail: d?.stderr_tail?.slice(-500) });
  }

  if (gates.has("tests")) {
    await emitStep(taskId, "nex3", "tool_call", "run_tests · npx vitest run", { gate: "tests" });
    const r = await runTests({ timeoutMs: 300_000 });
    const d = r.data;
    const gr: GateResult = {
      gate: "tests", ok: r.ok, duration_ms: r.duration_ms, reason: r.reason,
      summary: d?.summary, findings_preview: (d?.findings ?? []).slice(0, 10),
    };
    results.push(gr);
    const s = d?.summary ?? {};
    await emitStep(taskId, "nex3", r.ok ? "review_pass" : "review_fail",
      `tests ${r.ok ? "PASS" : "FAIL"} · ${(s as { passed?: number }).passed ?? "?"} passed · ${(s as { failed?: number }).failed ?? "?"} failed · ${(s as { skipped?: number }).skipped ?? 0} skipped · ${r.duration_ms}ms`,
      { gate: "tests", ok: r.ok, summary: s, failed_files: (d?.findings ?? []).slice(0, 20), timed_out: d?.timed_out });
  }

  const all_pass = results.every(r => r.ok);
  await emitStep(taskId, "system", all_pass ? "review_pass" : "review_fail",
    `─── VERIFICATION ${all_pass ? "PASS ✓" : "FAIL ✗"} · ${results.filter(r => r.ok).length}/${results.length} gates green ───`,
    { all_pass, results: results.map(r => ({ gate: r.gate, ok: r.ok, duration_ms: r.duration_ms, reason: r.reason, error_count: r.error_count, warning_count: r.warning_count })) });

  return NextResponse.json({ ok: true, task_id: taskId, all_pass, results });
}
