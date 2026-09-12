// src/app/api/nex/agent/apply/route.ts
//
// NEX Agent v1.2 · Apply-to-worktree + self-repair.
// POST body: { task_id: string }
//
// Reads the plan for a plan_approved task, creates an isolated git worktree,
// writes proposed_files into it, and runs the self-repair loop (verify → diagnose
// → patch → reverify, max 5 attempts). Nothing touches main.

import { NextResponse } from "next/server";
import { Client } from "pg";
import { runSelfRepairLoop } from "@/lib/nex-agent/core/self-repair";
import type { Plan } from "@/lib/nex-agent/core/orchestrator-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 900;

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL ?? process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

export async function POST(req: Request) {
  let body: { task_id?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const taskId = String(body.task_id ?? "").trim();
  if (!taskId) return NextResponse.json({ ok: false, error: "task_id_required" }, { status: 400 });

  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  try {
    await c.connect();
    const task = (await c.query(`SELECT * FROM nex_agent.tasks WHERE task_id=$1`, [taskId])).rows[0];
    if (!task) return NextResponse.json({ ok: false, error: "task_not_found" }, { status: 404 });
    if (task.status !== "plan_approved" && task.status !== "plan_ready") {
      return NextResponse.json({ ok: false, error: `bad_status:${task.status} · must be plan_ready or plan_approved` }, { status: 409 });
    }
    const plan = task.plan as Plan | null;
    if (!plan || !plan.proposed_files || plan.proposed_files.length === 0) {
      return NextResponse.json({ ok: false, error: "plan_has_no_proposed_files" }, { status: 400 });
    }
    // Mark status = applying so UI/founder sees it in flight
    await c.query(`UPDATE nex_agent.tasks SET status='applying', current_actor='nex1', updated_at=now() WHERE task_id=$1`, [taskId]);
    await c.end();

    const outcome = await runSelfRepairLoop(taskId, plan);

    // Update task with outcome
    const c2 = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
    await c2.connect();
    try {
      const newStatus = outcome.final_ok ? "applied_verified" : "applied_needs_review";
      await c2.query(`UPDATE nex_agent.tasks SET status=$1, current_actor='founder', updated_at=now() WHERE task_id=$2`, [newStatus, taskId]);
    } finally { try { await c2.end(); } catch { /* ignore */ } }

    return NextResponse.json({ ok: true, task_id: taskId, outcome });
  } catch (err) {
    try { await c.end(); } catch { /* ignore */ }
    return NextResponse.json({ ok: false, error: (err as Error).message.slice(0, 200) }, { status: 500 });
  }
}
