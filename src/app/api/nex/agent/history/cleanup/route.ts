// src/app/api/nex/agent/history/cleanup/route.ts
//
// Marks NEX1 tasks older than the threshold as 'erased' · matches the
// erase-card mechanism (drops branch + preserves audit row). Also fires
// when the founder connects a new GitHub repo (new project → clean slate).
//
// POST { threshold_days?: number (default 7), triggered_by?: "auto" | "github_connect" | "founder" }
//   → { ok, threshold_days, purged: [{ task_id, prev_status, age_days }] }

import { NextResponse } from "next/server";
import { Client } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_THRESHOLD_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL ?? process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

export async function POST(req: Request) {
  let body: { threshold_days?: number; triggered_by?: string } = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const days = Number.isFinite(body.threshold_days) && (body.threshold_days as number) > 0
    ? Math.min(365, body.threshold_days as number)
    : DEFAULT_THRESHOLD_DAYS;
  const triggeredBy = String(body.triggered_by ?? "auto").trim() || "auto";

  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  const purged: Array<{ task_id: string; prev_status: string; age_days: number }> = [];
  try {
    await c.connect();
    // Never purge shipped · currently in-flight · or already erased tasks
    const eligible = await c.query<{ task_id: string; status: string; submitted_at: Date }>(
      `SELECT task_id, status, submitted_at
         FROM nex_agent.tasks
        WHERE submitted_at < now() - ($1 || ' days')::interval
          AND status NOT IN ('shipped', 'erased', 'applying', 'planning')`,
      [String(days)],
    );

    for (const row of eligible.rows) {
      try {
        await c.query(
          `UPDATE nex_agent.tasks SET status='erased', current_actor=NULL, updated_at=now() WHERE task_id=$1`,
          [row.task_id],
        );
        try {
          await c.query(
            `INSERT INTO nex_agent.steps (task_id, actor, step_kind, title, body)
             VALUES ($1, 'system', 'annotation', $2, $3::jsonb)`,
            [
              row.task_id,
              `auto-purged · older than ${days} days · trigger=${triggeredBy}`,
              JSON.stringify({ auto_purge: true, threshold_days: days, triggered_by: triggeredBy, prev_status: row.status }),
            ],
          );
        } catch { /* step insert non-fatal */ }
        const age = Math.floor((Date.now() - new Date(row.submitted_at).getTime()) / DAY_MS);
        purged.push({ task_id: row.task_id, prev_status: row.status, age_days: age });
      } catch { /* skip this row · continue with others */ }
    }
    await c.end();
    return NextResponse.json({
      ok: true,
      threshold_days: days,
      triggered_by: triggeredBy,
      purged_count: purged.length,
      purged,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    try { await c.end(); } catch { /* ignore */ }
    return NextResponse.json({ ok: false, error: (err as Error).message.slice(0, 200) }, { status: 500 });
  }
}
