// src/app/api/nex/agent/migration/dry-run/route.ts
//
// NEX Agent v1.3 · POST { task_id, sql } → runs SQL inside SAVEPOINT · ROLLBACK · returns diagnostics.
// Also writes a nex_agent.task_steps row so the SSE stream shows the dry-run.
// SAFE · does NOT modify the DB.

import { NextResponse } from "next/server";
import { Client } from "pg";
import { postgresDryRunMigration } from "@/lib/nex-agent/tools/database";
import { bumpCompetencyFromRealWork } from "@/lib/nex-agent/core/competency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL ?? process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

export async function POST(req: Request) {
  let body: { task_id?: string; sql?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const taskId = String(body.task_id ?? "").trim();
  const sql = String(body.sql ?? "").trim();
  if (!sql) return NextResponse.json({ ok: false, error: "sql_required" }, { status: 400 });
  if (!taskId) return NextResponse.json({ ok: false, error: "task_id_required" }, { status: 400 });

  const r = await postgresDryRunMigration(sql);
  // Emit step for the SSE stream
  try {
    const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
    await c.connect();
    const d = r.data;
    await c.query(
      `INSERT INTO nex_agent.task_steps (task_id, actor, step_kind, title, body) VALUES ($1,'nex2',$2,$3,$4)`,
      [taskId, r.ok ? "review_pass" : "review_fail",
       `dry-run · ${d?.statements_executed ?? 0} stmt · ${r.ok ? "PASS · nothing applied" : "FAIL · " + (r.reason ?? "error")}`,
       JSON.stringify({ statements_executed: d?.statements_executed, destructive_ops_detected: d?.destructive_ops_detected, first_error: d?.first_error, statement_results: d?.statement_results?.slice(0, 10), total_duration_ms: d?.total_duration_ms })],
    );
    await c.end();
  } catch { /* audit is best-effort */ }

  // Founder's design: dry-run pass = 1 evidence toward migration_reasoning
  let competency_bump: { delta: number; new_achieved: number } | null = null;
  if (r.ok && r.data?.statements_executed && r.data.statements_executed > 0) {
    const bump = await bumpCompetencyFromRealWork({
      domain_key: "migration_reasoning",
      evidence_kind: "real_dry_run",
      task_id: taskId,
      reason: `dry-run passed · ${r.data.statements_executed} stmt`,
      recorded_by: "migration_dry_run_auto",
    });
    if (bump.ok) competency_bump = { delta: bump.delta, new_achieved: bump.new_achieved };
  }

  return NextResponse.json({ ...r, competency_bump });
}
