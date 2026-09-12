// src/app/api/nex/agent/approve/route.ts
//
// NEX Agent v1 · founder approves a plan_ready task · we return the paste-ready brief
// and flip task status to plan_approved. This is the ONLY path from plan → engineering brief.

import { NextResponse } from "next/server";
import { Client } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL ?? process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

export async function POST(req: Request) {
  let body: { task_id?: string; decided_by?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const taskId = String(body.task_id ?? "").trim();
  const decided_by = String(body.decided_by ?? "founder").slice(0, 60);
  if (!taskId) return NextResponse.json({ ok: false, error: "task_id_required" }, { status: 400 });

  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  try {
    await c.connect();
    const task = (await c.query(`SELECT task_id, status, brief FROM nex_agent.tasks WHERE task_id=$1`, [taskId])).rows[0];
    if (!task) return NextResponse.json({ ok: false, error: "task_not_found" }, { status: 404 });
    if (task.status !== "plan_ready") return NextResponse.json({ ok: false, error: `bad_status:${task.status}` }, { status: 409 });
    if (!task.brief) return NextResponse.json({ ok: false, error: "brief_missing" }, { status: 500 });
    await c.query(`UPDATE nex_agent.tasks SET status='plan_approved', current_actor=NULL, updated_at=now() WHERE task_id=$1`, [taskId]);
    await c.query(
      `INSERT INTO nex_agent.approvals (task_id, requested_by, granted_at, granted_by, approval_kind, brief_snapshot)
       VALUES ($1, 'nex1', now(), $2, 'plan_approval', $3)`,
      [taskId, decided_by, task.brief],
    );
    await c.query(
      `INSERT INTO nex_agent.task_steps (task_id, actor, step_kind, title, body)
       VALUES ($1, 'founder', 'handoff', 'Founder approved the plan · brief handed off to engineer', $2)`,
      [taskId, JSON.stringify({ decided_by })],
    );
    return NextResponse.json({ ok: true, task_id: taskId, brief: task.brief });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message.slice(0, 200) }, { status: 500 });
  } finally { try { await c.end(); } catch { /* ignore */ } }
}
