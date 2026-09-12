// src/app/api/nex/agent/submit/route.ts
//
// NEX Agent v1 · submit a founder prompt · orchestrator runs nex1/nex2/nex3
// synchronously and returns the initial state (clarifying / plan_ready / plan_rejected).
// (turbopack-force-recompile-2026-09-10T14:16Z)

import { NextResponse } from "next/server";
import { Client } from "pg";
import { processTask } from "@/lib/nex-agent/core/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL ?? process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

export async function POST(req: Request) {
  let body: { prompt?: string; submitted_by?: string; continue_task_id?: string } = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const prompt = String(body.prompt ?? "").trim();
  const submitted_by = String(body.submitted_by ?? "founder").slice(0, 60);
  if (!prompt) return NextResponse.json({ ok: false, error: "prompt_empty" }, { status: 400 });
  if (prompt.length > 10_000) return NextResponse.json({ ok: false, error: "prompt_too_long" }, { status: 400 });

  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  try {
    await c.connect();
    let taskId: string;
    if (body.continue_task_id) {
      // Reply to an existing clarifying-question task
      const r = await c.query(`SELECT task_id, status, prompt FROM nex_agent.tasks WHERE task_id=$1`, [body.continue_task_id]);
      if (r.rows.length === 0) return NextResponse.json({ ok: false, error: "task_not_found" }, { status: 404 });
      const t = r.rows[0];
      const newPrompt = `${t.prompt}\n\n[FOUNDER REPLY]\n${prompt}`;
      await c.query(`UPDATE nex_agent.tasks SET prompt=$1, status='submitted', updated_at=now() WHERE task_id=$2`, [newPrompt, t.task_id]);
      await c.query(`INSERT INTO nex_agent.task_steps (task_id, actor, step_kind, title, body) VALUES ($1, 'founder', 'user_reply', $2, $3)`,
        [t.task_id, prompt.slice(0, 120), JSON.stringify({ reply: prompt })]);
      taskId = t.task_id;
    } else {
      const r = await c.query(`INSERT INTO nex_agent.tasks (submitted_by, prompt) VALUES ($1, $2) RETURNING task_id`, [submitted_by, prompt]);
      taskId = r.rows[0].task_id;
    }
    await c.end();
    // Run orchestrator inline (V1.0 · fast · <5s typical because all tools are read-only)
    const result = await processTask(taskId);
    return NextResponse.json({ ok: true, task_id: taskId, ...result });
  } catch (err) {
    try { await c.end(); } catch { /* ignore */ }
    return NextResponse.json({ ok: false, error: (err as Error).message.slice(0, 200) }, { status: 500 });
  }
}
