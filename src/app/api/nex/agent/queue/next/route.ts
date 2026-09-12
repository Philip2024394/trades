// src/app/api/nex/agent/queue/next/route.ts
//
// Pops the top queue entry and submits it as a new NEX1 task. Called by the
// UI when the active task reaches a terminal state (auto-select next).
//
// POST → { ok, submitted: { task_id }, entry, queue_size }
//     OR { ok: true, empty: true } when queue is empty

import { NextResponse } from "next/server";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface QueueEntry {
  id: string;
  prompt: string;
  queuedAt: string;
  queuedBy: string;
  attachments: Array<{ id: string; filename: string; mimeType: string; size: number; isImage: boolean; previewUrl: string }>;
  classification: { decision: string; confidence: number; reasoning: string } | null;
}

function queuePath(): string { return resolve(process.cwd(), "data/nex-agent-queue.json"); }
function loadQueue(): QueueEntry[] {
  const p = queuePath();
  if (!existsSync(p)) return [];
  try { return JSON.parse(readFileSync(p, "utf8")) as QueueEntry[]; } catch { return []; }
}
function saveQueue(q: QueueEntry[]): void {
  const p = queuePath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(q, null, 2), "utf8");
}

export async function POST(req: Request) {
  const q = loadQueue();
  if (q.length === 0) {
    return NextResponse.json({ ok: true, empty: true }, { headers: { "Cache-Control": "no-store" } });
  }
  const [next, ...rest] = q;

  // Compose the prompt with attachment references so NEX1 sees them
  let composed = next.prompt;
  if (next.attachments.length > 0) {
    const lines = next.attachments.map((a) =>
      `[${a.isImage ? "IMAGE" : "FILE"}: ${a.filename} · ${a.mimeType} · ${(a.size / 1024).toFixed(1)} KB · id=${a.id} · url=${a.previewUrl}]`,
    );
    composed = `${next.prompt}\n\n${lines.join("\n")}`.trim();
  }

  // Submit to the existing submit endpoint · same-origin, no auth needed in dev
  const origin = new URL(req.url).origin;
  let submitResult: { ok: boolean; task_id?: string; error?: string } = { ok: false };
  try {
    const r = await fetch(`${origin}/api/nex/agent/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: composed,
        attachments: next.attachments,
        submitted_by: next.queuedBy,
      }),
    });
    submitResult = await r.json();
  } catch (e) {
    submitResult = { ok: false, error: (e as Error).message };
  }

  if (!submitResult.ok) {
    return NextResponse.json({
      ok: false,
      error: submitResult.error ?? "submit_failed",
      note: "queue entry preserved · call again to retry",
    }, { status: 500 });
  }

  // Save queue without the promoted entry
  saveQueue(rest);
  return NextResponse.json({
    ok: true,
    submitted: { task_id: submitResult.task_id },
    entry: next,
    queue_size: rest.length,
  }, { headers: { "Cache-Control": "no-store" } });
}
