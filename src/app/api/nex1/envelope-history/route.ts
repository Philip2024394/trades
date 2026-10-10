// GET /api/nex1/envelope-history?task_id=<id>
//
// Verdict-history diagnostic surface. Returns every envelope persisted for a
// task in chronological order. Deterministic · zero LLM · zero mutation.

import { NextResponse } from "next/server";
import { loadEnvelopeHistory, getStoreDir } from "@/lib/nex-agent/code-engine/capability-envelope-history-persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const taskId = url.searchParams.get("task_id");
  if (!taskId) {
    return NextResponse.json({ ok: false, error: "missing_task_id" }, { status: 400 });
  }
  const { entries, skipped_malformed } = loadEnvelopeHistory(taskId);
  return NextResponse.json({
    ok: true,
    source: "NEX1_NATIVE",
    zero_llm: true,
    task_id: taskId,
    total_entries: entries.length,
    entries,
    skipped_malformed,
    store_dir: getStoreDir(),
  });
}
