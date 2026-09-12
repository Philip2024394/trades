// src/app/api/nex/agent/decide/route.ts
//
// Founder clicks one option on a NEX1 decision card · this endpoint records
// the choice as a founder_decision step (or 'annotation' fallback if the
// step_kind CHECK doesn't allow the specific label).
//
// POST { task_id, step_id, option_id, option_label?, decided_by? }
//   → inserts a step with actor=founder and body carrying the choice.
//
// NEX1's orchestrator polls steps · sees the founder decision · proceeds.

import { NextResponse } from "next/server";
import { Client } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL ?? process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

export async function POST(req: Request) {
  let body: {
    task_id?: string;
    step_id?: string;
    option_id?: string;
    option_label?: string;
    decided_by?: string;
  } = {};
  try { body = await req.json(); } catch { /* empty */ }

  const taskId = String(body.task_id ?? "").trim();
  const stepId = String(body.step_id ?? "").trim();
  const optionId = String(body.option_id ?? "").trim();
  const optionLabel = String(body.option_label ?? "").trim();
  const decidedBy = String(body.decided_by ?? "founder").trim() || "founder";

  if (!taskId) return NextResponse.json({ ok: false, error: "task_id_required" }, { status: 400 });
  if (!optionId) return NextResponse.json({ ok: false, error: "option_id_required" }, { status: 400 });

  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  const decisionBody = JSON.stringify({
    decision_for_step: stepId || null,
    option_id: optionId,
    option_label: optionLabel || null,
    decided_by: decidedBy,
  });

  try {
    await c.connect();
    let inserted = false;
    try {
      await c.query(
        `INSERT INTO nex_agent.steps (task_id, actor, step_kind, title, body)
         VALUES ($1, 'founder', 'founder_decision', $2, $3::jsonb)`,
        [taskId, `founder chose: ${optionLabel || optionId}`, decisionBody],
      );
      inserted = true;
    } catch {
      try {
        await c.query(
          `INSERT INTO nex_agent.steps (task_id, actor, step_kind, title, body)
           VALUES ($1, 'founder', 'annotation', $2, $3::jsonb)`,
          [taskId, `[DECISION] ${optionLabel || optionId}`, decisionBody],
        );
        inserted = true;
      } catch (e2) { /* schema rejected both · surface error */ }
    }
    await c.end();
    if (!inserted) {
      return NextResponse.json({ ok: false, error: "step_insert_failed" }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      task_id: taskId,
      step_id: stepId || null,
      option_id: optionId,
      decided_by: decidedBy,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    try { await c.end(); } catch { /* ignore */ }
    return NextResponse.json({ ok: false, error: (err as Error).message.slice(0, 200) }, { status: 500 });
  }
}
