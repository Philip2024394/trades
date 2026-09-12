// src/app/api/nex/agent/edit-file/route.ts
//
// Founder edits a file from a card's landscape and saves. Writes to a
// per-task scratchpad · NEVER touches the working tree or main branch.
//
// Scratchpad path: data/nex-agent-edits/{task_id}/{safePath}
// Index: data/nex-agent-edits/index.json  (task_id → { path → { updatedAt, size } })
//
// Founder can re-run apply/verify to fold scratchpad edits back into the
// branch. Until then, edits are audit-visible but not applied.

import { NextResponse } from "next/server";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 500_000; // 500KB per file

function editsRoot(): string {
  return resolve(process.cwd(), "data/nex-agent-edits");
}
function indexPath(): string {
  return join(editsRoot(), "index.json");
}
function loadIndex(): Record<string, Record<string, { updatedAt: string; size: number; safePath: string }>> {
  const p = indexPath();
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return {}; }
}
function saveIndex(m: unknown): void {
  const p = indexPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(m, null, 2), "utf8");
}

function safePathFor(taskId: string, path: string): string {
  // sanitize · never allow escape outside per-task dir
  const clean = path.replace(/[^A-Za-z0-9._/-]/g, "_").replace(/^\/+/, "").replace(/\.\./g, "_");
  return join(editsRoot(), taskId, clean);
}

export async function POST(req: Request) {
  let body: { task_id?: string; path?: string; content?: string; edited_by?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const taskId = String(body.task_id ?? "").trim();
  const path = String(body.path ?? "").trim();
  const content = String(body.content ?? "");
  const editedBy = String(body.edited_by ?? "founder").trim() || "founder";

  if (!taskId) return NextResponse.json({ ok: false, error: "task_id_required" }, { status: 400 });
  if (!path) return NextResponse.json({ ok: false, error: "path_required" }, { status: 400 });
  if (!/^[A-Za-z0-9._/-]+$/.test(taskId)) return NextResponse.json({ ok: false, error: "task_id_bad_chars" }, { status: 400 });
  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
    return NextResponse.json({ ok: false, error: "file_too_large", detail: `max ${MAX_FILE_BYTES} bytes` }, { status: 413 });
  }

  const disk = safePathFor(taskId, path);
  mkdirSync(dirname(disk), { recursive: true });
  writeFileSync(disk, content, "utf8");

  const idx = loadIndex();
  if (!idx[taskId]) idx[taskId] = {};
  idx[taskId][path] = {
    updatedAt: new Date().toISOString(),
    size: Buffer.byteLength(content, "utf8"),
    safePath: disk,
  };
  saveIndex(idx);

  return NextResponse.json({
    ok: true,
    task_id: taskId,
    path,
    saved_at: idx[taskId][path].updatedAt,
    size: idx[taskId][path].size,
    edited_by: editedBy,
    note: "saved to per-task scratchpad · not applied to branch until founder runs apply/verify",
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const taskId = url.searchParams.get("task_id");
  if (!taskId) return NextResponse.json({ ok: false, error: "task_id_required" }, { status: 400 });
  const idx = loadIndex();
  const files = idx[taskId] ?? {};
  const out: Array<{ path: string; content: string; updatedAt: string; size: number }> = [];
  for (const [p, meta] of Object.entries(files)) {
    let contentText = "";
    try { contentText = readFileSync(meta.safePath, "utf8"); } catch { contentText = ""; }
    out.push({ path: p, content: contentText, updatedAt: meta.updatedAt, size: meta.size });
  }
  return NextResponse.json({ ok: true, task_id: taskId, files: out }, { headers: { "Cache-Control": "no-store" } });
}
