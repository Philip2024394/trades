// src/app/api/nex/agent/stop/route.ts
//
// Stop signal for a running NEX1 task. Two effects:
//   1. Inserts a `stop_requested` step with actor=founder into nex_agent.steps
//      — orchestrator polls this and halts at the next checkpoint (never
//      mid-file-write · safety over speed).
//   2. Best-effort UPDATE nex_agent.tasks.status = 'paused' (falls back to
//      leaving status alone if the DB CHECK constraint doesn't allow it ·
//      the step event is the authoritative stop signal).
//
// Founder can resume by sending a new prompt with continue_task_id, or erase
// the task to fully wipe it.

import { NextResponse } from "next/server";
import { Client } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL ?? process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

export async function POST(req: Request) {
  let body: { task_id?: string; stopped_by?: string; reason?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }

  const taskId = String(body.task_id ?? "").trim();
  const stoppedBy = String(body.stopped_by ?? "founder").trim();
  const reason = String(body.reason ?? "").trim() || "founder pressed stop";
  if (!taskId) return NextResponse.json({ ok: false, error: "task_id_required" }, { status: 400 });

  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  let stepInserted = false;
  let statusUpdated = false;
  let statusUpdateError: string | null = null;
  let previousStatus: string | null = null;

  try {
    await c.connect();

    const row = (await c.query<{ task_id: string; status: string }>(
      `SELECT task_id, status FROM nex_agent.tasks WHERE task_id=$1`,
      [taskId],
    )).rows[0];
    if (!row) {
      await c.end();
      return NextResponse.json({ ok: false, error: "task_not_found" }, { status: 404 });
    }
    previousStatus = row.status;

    // Terminal states can't be stopped · report gracefully
    const terminal = new Set(["applied_verified", "shipped", "archived", "erased", "plan_rejected"]);
    if (terminal.has(row.status)) {
      await c.end();
      return NextResponse.json({
        ok: false,
        error: "task_already_terminal",
        detail: `task is ${row.status} · nothing to stop`,
        previous_status: row.status,
      }, { status: 409 });
    }

    // 1 · Insert the stop_requested step · authoritative signal
    try {
      await c.query(
        `INSERT INTO nex_agent.steps (task_id, actor, step_kind, title, body)
         VALUES ($1, 'founder', 'stop_requested', $2, $3::jsonb)`,
        [taskId, `stop requested by ${stoppedBy}`, JSON.stringify({ previous_status: previousStatus, reason })],
      );
      stepInserted = true;
    } catch (e) {
      // If schema doesn't accept 'stop_requested', try 'system' step_kind
      try {
        await c.query(
          `INSERT INTO nex_agent.steps (task_id, actor, step_kind, title, body)
           VALUES ($1, 'founder', 'annotation', $2, $3::jsonb)`,
          [taskId, `STOP · ${reason}`, JSON.stringify({ signal: "stop", previous_status: previousStatus, reason })],
        );
        stepInserted = true;
      } catch (e2) {
        // Non-fatal · we still try to update the task status
      }
    }

    // 2 · Best-effort status update to 'paused' · gracefully skip if CHECK blocks
    try {
      await c.query(
        `UPDATE nex_agent.tasks SET status='paused', current_actor=NULL, updated_at=now() WHERE task_id=$1`,
        [taskId],
      );
      statusUpdated = true;
    } catch (e) {
      statusUpdateError = (e as Error).message.slice(0, 200);
    }

    await c.end();

    return NextResponse.json({
      ok: true,
      task_id: taskId,
      previous_status: previousStatus,
      step_inserted: stepInserted,
      status_updated: statusUpdated,
      status_update_error: statusUpdateError,
      stopped_by: stoppedBy,
      note: statusUpdated
        ? "task set to 'paused' · NEX1 halts at next checkpoint"
        : "stop signal recorded as step · task status unchanged (DB CHECK constraint) · NEX1 sees the founder signal in its stream",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    try { await c.end(); } catch { /* ignore */ }
    return NextResponse.json({ ok: false, error: (err as Error).message.slice(0, 200) }, { status: 500 });
  }
}
