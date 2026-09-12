// src/app/api/nex/agent/queue/route.ts
//
// NEX1 prompt queue · founder can send up to 10 prompts while a task is running.
//
// POST { prompt, active_task_id?, attachments? }
//   → classifies prompt vs the active task:
//     - MERGE_WITH_ACTIVE  → inserts a founder_addendum step in the active task,
//                            returns { ok, action: "merged", classification, active_task_id }
//     - QUEUE_AS_NEW       → appends to queue file (max 10), returns { ok, action: "queued", ... }
//
// GET  → returns { ok, queue, max: 10 }
// DELETE ?id=X → remove a queue entry
//
// Queue persisted to data/nex-agent-queue.json so it survives dev restarts.

import { NextResponse } from "next/server";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { classifyPrompt } from "@/lib/nex-agent/prompt-classifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUEUE = 10;

interface QueueEntry {
  readonly id: string;
  readonly prompt: string;
  readonly queuedAt: string;
  readonly queuedBy: string;
  readonly attachments: ReadonlyArray<{
    readonly id: string;
    readonly filename: string;
    readonly mimeType: string;
    readonly size: number;
    readonly isImage: boolean;
    readonly previewUrl: string;
  }>;
  readonly classification: {
    readonly decision: string;
    readonly confidence: number;
    readonly reasoning: string;
  } | null;
}

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL ?? process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

function queuePath(): string {
  return resolve(process.cwd(), "data/nex-agent-queue.json");
}

function loadQueue(): QueueEntry[] {
  const p = queuePath();
  if (!existsSync(p)) return [];
  try { return JSON.parse(readFileSync(p, "utf8")) as QueueEntry[]; }
  catch { return []; }
}

function saveQueue(q: readonly QueueEntry[]): void {
  const p = queuePath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(q, null, 2), "utf8");
}

async function getActiveTaskPrompt(taskId: string): Promise<string | null> {
  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  try {
    await c.connect();
    const row = (await c.query<{ prompt: string; status: string }>(
      `SELECT prompt, status FROM nex_agent.tasks WHERE task_id=$1`,
      [taskId],
    )).rows[0];
    if (!row) return null;
    // Only merge when the task is actively in-flight
    const inFlight = new Set(["submitted", "clarifying", "planning", "applying", "plan_ready", "plan_approved"]);
    if (!inFlight.has(row.status)) return null;
    return row.prompt;
  } catch { return null; }
  finally { try { await c.end(); } catch { /* ignore */ } }
}

async function insertAddendum(taskId: string, addendum: string, byWho: string): Promise<boolean> {
  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  try {
    await c.connect();
    await c.query(
      `INSERT INTO nex_agent.steps (task_id, actor, step_kind, title, body)
       VALUES ($1, 'founder', 'founder_addendum', $2, $3::jsonb)`,
      [taskId, `founder addendum · ${addendum.slice(0, 80)}${addendum.length > 80 ? "…" : ""}`, JSON.stringify({ addendum, added_by: byWho })],
    );
    return true;
  } catch {
    // Fall back to 'annotation' step_kind if 'founder_addendum' is rejected by schema
    try {
      await c.query(
        `INSERT INTO nex_agent.steps (task_id, actor, step_kind, title, body)
         VALUES ($1, 'founder', 'annotation', $2, $3::jsonb)`,
        [taskId, `[ADDENDUM] ${addendum.slice(0, 80)}${addendum.length > 80 ? "…" : ""}`, JSON.stringify({ addendum, added_by: byWho })],
      );
      return true;
    } catch { return false; }
  } finally { try { await c.end(); } catch { /* ignore */ } }
}

export async function GET() {
  const queue = loadQueue();
  return NextResponse.json({ ok: true, queue, count: queue.length, max: MAX_QUEUE }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  let body: {
    prompt?: string;
    active_task_id?: string;
    attachments?: ReadonlyArray<{ id: string; filename: string; mimeType: string; size: number; isImage: boolean; previewUrl: string }>;
    queued_by?: string;
    force?: "queue" | "merge";
  } = {};
  try { body = await req.json(); } catch { /* empty */ }

  const prompt = String(body.prompt ?? "").trim();
  const activeTaskId = String(body.active_task_id ?? "").trim();
  const queuedBy = String(body.queued_by ?? "founder").trim() || "founder";
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];

  if (!prompt) return NextResponse.json({ ok: false, error: "prompt_required" }, { status: 400 });

  // If no active task, this route shouldn't be called · redirect the caller
  // (client already uses /api/nex/agent/submit directly when no active task).
  if (!activeTaskId) return NextResponse.json({ ok: false, error: "active_task_id_required" }, { status: 400 });

  const activePrompt = await getActiveTaskPrompt(activeTaskId);
  if (activePrompt === null) {
    // Active task isn't in-flight anymore · fall through to QUEUE (safer)
    return await enqueue(prompt, attachments, queuedBy, null);
  }

  // Classify
  const classification = classifyPrompt(activePrompt, prompt);
  const forced = body.force === "queue" ? "QUEUE_AS_NEW"
              : body.force === "merge" ? "MERGE_WITH_ACTIVE"
              : classification.decision;

  if (forced === "MERGE_WITH_ACTIVE") {
    const inserted = await insertAddendum(activeTaskId, prompt, queuedBy);
    if (!inserted) {
      // Fallback: queue if we couldn't insert
      return await enqueue(prompt, attachments, queuedBy, classification);
    }
    return NextResponse.json({
      ok: true,
      action: "merged",
      active_task_id: activeTaskId,
      classification,
      note: "prompt merged into active task as founder_addendum · NEX1 sees it at next checkpoint",
    }, { headers: { "Cache-Control": "no-store" } });
  }

  return await enqueue(prompt, attachments, queuedBy, classification);
}

async function enqueue(
  prompt: string,
  attachments: ReadonlyArray<{ id: string; filename: string; mimeType: string; size: number; isImage: boolean; previewUrl: string }>,
  queuedBy: string,
  classification: ReturnType<typeof classifyPrompt> | null,
): Promise<NextResponse> {
  const q = loadQueue();
  if (q.length >= MAX_QUEUE) {
    return NextResponse.json({
      ok: false, error: "queue_full",
      detail: `queue holds ${q.length} of ${MAX_QUEUE} prompts · delete one before adding more`,
    }, { status: 409 });
  }
  const entry: QueueEntry = {
    id: randomUUID(),
    prompt,
    queuedAt: new Date().toISOString(),
    queuedBy,
    attachments: attachments.map((a) => ({
      id: a.id, filename: a.filename, mimeType: a.mimeType, size: a.size,
      isImage: !!a.isImage, previewUrl: a.previewUrl,
    })),
    classification: classification ? {
      decision: classification.decision,
      confidence: classification.confidence,
      reasoning: classification.reasoning,
    } : null,
  };
  q.push(entry);
  saveQueue(q);
  return NextResponse.json({
    ok: true,
    action: "queued",
    entry,
    queue_position: q.length,
    queue_size: q.length,
    max: MAX_QUEUE,
    classification,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id_required" }, { status: 400 });
  const q = loadQueue();
  const idx = q.findIndex((e) => e.id === id);
  if (idx === -1) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const [removed] = q.splice(idx, 1);
  saveQueue(q);
  return NextResponse.json({ ok: true, removed, queue_size: q.length }, { headers: { "Cache-Control": "no-store" } });
}
