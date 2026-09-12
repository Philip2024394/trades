// src/app/api/nex/agent/migration/apply/route.ts
//
// NEX Agent v1.3 · POST { task_id, sql, confirm_phrase, applied_by, allow_destructive?, sql_hash? }
//   → runs the migration for REAL against nex_dev · transaction wrapped.
//
// Safety gates enforced by postgresApplyMigration:
//   1. sql not empty
//   2. sql_hash matches (if caller passes one · defends against tampering)
//   3. destructive ops require confirm_phrase='APPLY DESTRUCTIVE MIGRATION' + allow_destructive:true
//   4. non-destructive requires confirm_phrase='APPLY MIGRATION'
//   5. applied_by must be present
//   6. connection URL must contain /nex_dev · will not run against any other DB
//   7. transaction: single-statement failure → full ROLLBACK
//   8. every apply audit-logged to nex_agent.decisions
// After apply, the task status flips to 'migration_applied' or 'migration_failed'.

import { NextResponse } from "next/server";
import { Client } from "pg";
import { postgresApplyMigration } from "@/lib/nex-agent/tools/database";
import { bumpCompetencyFromRealWork } from "@/lib/nex-agent/core/competency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL ?? process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

export async function POST(req: Request) {
  let body: { task_id?: string; sql?: string; confirm_phrase?: string; applied_by?: string; allow_destructive?: boolean; sql_hash?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const taskId = String(body.task_id ?? "").trim();
  const sql = String(body.sql ?? "").trim();
  const confirm_phrase = String(body.confirm_phrase ?? "");
  const applied_by = String(body.applied_by ?? "founder");
  const allow_destructive = Boolean(body.allow_destructive);
  const known_hash = body.sql_hash ? String(body.sql_hash) : undefined;
  if (!sql) return NextResponse.json({ ok: false, error: "sql_required" }, { status: 400 });
  if (!taskId) return NextResponse.json({ ok: false, error: "task_id_required" }, { status: 400 });
  if (!confirm_phrase) return NextResponse.json({ ok: false, error: "confirm_phrase_required · type 'APPLY MIGRATION' (or 'APPLY DESTRUCTIVE MIGRATION' for DROP/TRUNCATE/DELETE)" }, { status: 400 });

  // Emit "starting" step
  {
    const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
    try {
      await c.connect();
      await c.query(
        `INSERT INTO nex_agent.task_steps (task_id, actor, step_kind, title, body) VALUES ($1,'system','handoff',$2,$3)`,
        [taskId, `─── MIGRATION APPLY REQUESTED · applied_by=${applied_by} ───`, JSON.stringify({ confirm_phrase_provided: confirm_phrase, allow_destructive })],
      );
    } catch { /* best-effort */ }
    finally { try { await c.end(); } catch { /* ignore */ } }
  }

  const r = await postgresApplyMigration({ sql, confirm_phrase, applied_by, task_id: taskId, allow_destructive, known_hash });

  // Update task + emit result step
  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  try {
    await c.connect();
    const applied = r.ok && (r.data?.applied ?? false);
    const newStatus = applied ? "migration_applied" : "migration_failed";
    await c.query(`UPDATE nex_agent.tasks SET status=$1, current_actor='founder', updated_at=now() WHERE task_id=$2`, [newStatus, taskId]);
    await c.query(
      `INSERT INTO nex_agent.task_steps (task_id, actor, step_kind, title, body) VALUES ($1,'nex3',$2,$3,$4)`,
      [taskId, applied ? "review_pass" : "review_fail",
       applied
         ? `✓ MIGRATION APPLIED · ${r.data?.statements_executed} stmt · sha256=${r.data?.sql_hash.slice(0, 12)}`
         : `⛔ MIGRATION FAILED · ${r.reason ?? "unknown"}`,
       JSON.stringify(r.data ?? { error: r.reason })],
    );
  } catch { /* best-effort */ }
  finally { try { await c.end(); } catch { /* ignore */ } }

  // Founder's design: verified apply = 2 evidence · complex/destructive apply = 3 evidence
  let competency_bumps: Array<{ domain: string; delta: number; new_achieved: number; kind: string }> = [];
  if (r.ok && r.data?.applied) {
    const destructive = (r.data.destructive_ops_detected?.length ?? 0) > 0;
    const complex = (r.data.statements_executed ?? 0) >= 3 || destructive;
    const kind = complex ? "real_complex_migration" : "real_verified_apply";
    const b1 = await bumpCompetencyFromRealWork({
      domain_key: "migration_reasoning",
      evidence_kind: kind as "real_verified_apply" | "real_complex_migration",
      task_id: taskId,
      reason: `apply succeeded · ${r.data.statements_executed} stmt · destructive=${destructive}`,
      recorded_by: "migration_apply_auto",
    });
    if (b1.ok) competency_bumps.push({ domain: "migration_reasoning", delta: b1.delta, new_achieved: b1.new_achieved, kind });
    // Also bump database_reasoning (touching real DB proves DB understanding)
    const b2 = await bumpCompetencyFromRealWork({
      domain_key: "database_reasoning",
      evidence_kind: "real_verified_apply",
      task_id: taskId,
      reason: `apply succeeded on nex_dev`,
      recorded_by: "migration_apply_auto",
    });
    if (b2.ok) competency_bumps.push({ domain: "database_reasoning", delta: b2.delta, new_achieved: b2.new_achieved, kind: "real_verified_apply" });
  }

  return NextResponse.json({ ...r, competency_bumps });
}
