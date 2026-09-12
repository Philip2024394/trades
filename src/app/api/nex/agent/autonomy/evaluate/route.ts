// src/app/api/nex/agent/autonomy/evaluate/route.ts
//
// NEX Agent v1.5 · POST { task_id } → evaluateAutonomousDecision · returns
// { can_auto_apply, matched_category, reasons_for, reasons_against, ... }.
// Does NOT trigger apply · founder still runs Apply-to-worktree manually.
// This endpoint just shows the founder whether nex1 WOULD qualify.

import { NextResponse } from "next/server";
import { Client } from "pg";
import { evaluateAutonomousDecision } from "@/lib/nex-agent/core/autonomous-engineer";
import type { Plan } from "@/lib/nex-agent/core/orchestrator-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const task = (await c.query(`SELECT plan FROM nex_agent.tasks WHERE task_id=$1`, [taskId])).rows[0] as { plan: Plan | null } | undefined;
    if (!task) return NextResponse.json({ ok: false, error: "task_not_found" }, { status: 404 });
    if (!task.plan) return NextResponse.json({ ok: false, error: "task_has_no_plan" }, { status: 400 });
    await c.end();
    const decision = await evaluateAutonomousDecision(task.plan);
    return NextResponse.json({ ok: true, task_id: taskId, decision });
  } catch (err) {
    try { await c.end(); } catch { /* ignore */ }
    return NextResponse.json({ ok: false, error: (err as Error).message.slice(0, 200) }, { status: 500 });
  }
}
