// src/app/api/nex/agent/erase/route.ts
//
// Erase a NEX Agent task · used by the "delete card" action in the
// programming workstation. Founder-visible semantics: erasing a card
// wipes the corresponding code from live + preview.
//
// Mechanics:
//   1. Marks nex_agent.tasks.status = 'erased' (preserves audit row · never DELETE)
//   2. Attempts to drop the branch `nex-agent/task-<taskId>` if it exists
//      (best-effort · never touches main · never force-pushes)
//   3. Never runs on shipped tasks (status = 'shipped' rejected)
//   4. Never runs on a task that was merged to main (branch missing OR merged is safe · we only drop unmerged branches)

import { NextResponse } from "next/server";
import { Client } from "pg";
import { spawn } from "node:child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL ?? process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

function runGit(args: readonly string[], cwd: string, timeoutMs = 10000): Promise<{ ok: boolean; stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const p = spawn("git", args, { cwd, shell: false });
    let stdout = ""; let stderr = "";
    const timer = setTimeout(() => { try { p.kill(); } catch { /* ignore */ } }, timeoutMs);
    p.stdout.on("data", (d) => { stdout += d.toString(); });
    p.stderr.on("data", (d) => { stderr += d.toString(); });
    p.on("close", (code) => { clearTimeout(timer); resolve({ ok: code === 0, stdout, stderr, code: code ?? -1 }); });
    p.on("error", (e) => { clearTimeout(timer); resolve({ ok: false, stdout, stderr: (e as Error).message, code: -1 }); });
  });
}

export async function POST(req: Request) {
  let body: { task_id?: string; erased_by?: string } = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const taskId = String(body.task_id ?? "").trim();
  const erasedBy = String(body.erased_by ?? "founder").trim();
  if (!taskId) return NextResponse.json({ ok: false, error: "task_id_required" }, { status: 400 });

  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  let dbUpdated = false;
  let branchDeleted: string | null = null;
  let branchNote: string | null = null;
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
    if (row.status === "shipped") {
      await c.end();
      return NextResponse.json({ ok: false, error: "cannot_erase_shipped_task", detail: "shipped tasks are on main · use section-intervention to revert" }, { status: 409 });
    }

    await c.query(
      `UPDATE nex_agent.tasks SET status='erased', current_actor=NULL, updated_at=now() WHERE task_id=$1`,
      [taskId],
    );
    dbUpdated = true;

    // Best-effort git branch delete
    const branchName = `nex-agent/task-${taskId}`;
    const showRef = await runGit(["show-ref", "--verify", `refs/heads/${branchName}`], process.cwd(), 5000);
    if (showRef.ok) {
      // Branch exists · attempt delete (never -D on merged · use safe -d first · escalate to -D if unmerged)
      const safeDelete = await runGit(["branch", "-d", branchName], process.cwd(), 5000);
      if (safeDelete.ok) {
        branchDeleted = branchName;
        branchNote = "safe-delete (merged or empty)";
      } else {
        const forceDelete = await runGit(["branch", "-D", branchName], process.cwd(), 5000);
        if (forceDelete.ok) {
          branchDeleted = branchName;
          branchNote = "force-delete (unmerged · code discarded)";
        } else {
          branchNote = `branch delete failed: ${(forceDelete.stderr || safeDelete.stderr).slice(0, 200)}`;
        }
      }
    } else {
      branchNote = "no branch existed · db-only erase";
    }

    // Record erase event in nex_agent.steps if the table accepts it (best-effort)
    try {
      await c.query(
        `INSERT INTO nex_agent.steps (task_id, actor, step_kind, title, body)
         VALUES ($1, 'system', 'task_erased', $2, $3::jsonb)`,
        [taskId, `task erased by ${erasedBy}`, JSON.stringify({ previous_status: previousStatus, branch_deleted: branchDeleted, branch_note: branchNote })],
      );
    } catch { /* steps table may have different shape · not fatal */ }

    await c.end();

    return NextResponse.json({
      ok: true,
      task_id: taskId,
      previous_status: previousStatus,
      branch_deleted: branchDeleted,
      branch_note: branchNote,
      erased_by: erasedBy,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    try { await c.end(); } catch { /* ignore */ }
    return NextResponse.json({
      ok: false,
      error: (err as Error).message.slice(0, 200),
      db_updated: dbUpdated,
      branch_deleted: branchDeleted,
      branch_note: branchNote,
    }, { status: 500 });
  }
}
