// src/app/api/nex/agent/export/route.ts
//
// Export a NEX1 task's files + metadata as a downloadable JSON bundle.
// The bundle contains the plan's proposed_files + any founder scratchpad
// edits + task metadata. Content-Disposition triggers a browser save.
//
// GET ?task_id=X  → JSON bundle with { export_version, task, files: [{ path, content, source }] }
//
// Bundle can be re-imported via the /upload flow · same structure.

import { NextResponse } from "next/server";
import { Client } from "pg";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL ?? process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

function editsRoot(): string {
  return resolve(process.cwd(), "data/nex-agent-edits");
}

function loadScratchpad(taskId: string): Array<{ path: string; content: string }> {
  const idx = join(editsRoot(), "index.json");
  if (!existsSync(idx)) return [];
  try {
    const raw = JSON.parse(readFileSync(idx, "utf8")) as Record<string, Record<string, { safePath: string }>>;
    const files = raw[taskId];
    if (!files) return [];
    const out: Array<{ path: string; content: string }> = [];
    for (const [p, meta] of Object.entries(files)) {
      try { out.push({ path: p, content: readFileSync(meta.safePath, "utf8") }); }
      catch { /* skip missing files */ }
    }
    return out;
  } catch { return []; }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const taskId = url.searchParams.get("task_id");
  if (!taskId) return NextResponse.json({ ok: false, error: "task_id_required" }, { status: 400 });

  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  try {
    await c.connect();
    const row = (await c.query<{
      task_id: string; submitted_at: Date; updated_at: Date; submitted_by: string;
      prompt: string; status: string; plan: unknown; brief: string | null;
    }>(
      `SELECT task_id, submitted_at, updated_at, submitted_by, prompt, status, plan, brief
         FROM nex_agent.tasks WHERE task_id=$1`,
      [taskId],
    )).rows[0];
    await c.end();
    if (!row) return NextResponse.json({ ok: false, error: "task_not_found" }, { status: 404 });

    const planFiles: Array<{ path: string; content: string; source: string; language?: string }> = [];
    const plan = row.plan as { proposed_files?: Array<{ path?: string; preview_content?: string; language?: string }> } | null | undefined;
    if (plan?.proposed_files) {
      for (const pf of plan.proposed_files) {
        if (!pf?.path) continue;
        planFiles.push({
          path: pf.path,
          content: String(pf.preview_content ?? ""),
          source: "plan.proposed_files",
          language: typeof pf.language === "string" ? pf.language : undefined,
        });
      }
    }
    const scratchFiles = loadScratchpad(taskId);
    // Overlay scratchpad edits · founder's saved version wins
    const merged = new Map<string, { path: string; content: string; source: string; language?: string }>();
    for (const f of planFiles) merged.set(f.path, f);
    for (const f of scratchFiles) {
      const existing = merged.get(f.path);
      merged.set(f.path, {
        path: f.path,
        content: f.content,
        source: existing ? "plan+founder-edit" : "founder-edit",
        language: existing?.language,
      });
    }

    const bundle = {
      export_version: "1.0",
      exported_at: new Date().toISOString(),
      task: {
        task_id: row.task_id,
        submitted_at: row.submitted_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
        submitted_by: row.submitted_by,
        prompt: row.prompt,
        status: row.status,
        brief: row.brief,
      },
      files_count: merged.size,
      files: Array.from(merged.values()),
    };

    const shortId = taskId.slice(0, 8);
    const filename = `nex1-task-${shortId}-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    try { await c.end(); } catch { /* ignore */ }
    return NextResponse.json({ ok: false, error: (err as Error).message.slice(0, 200) }, { status: 500 });
  }
}
