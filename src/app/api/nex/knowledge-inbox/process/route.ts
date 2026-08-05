// POST /api/nex/knowledge-inbox/process
//
// Runs the processing pipeline over every "waiting" item (or over a
// specific subset if ids are supplied) and returns the ProcessingReport
// alongside the refreshed snapshot. The pipeline actually walks the
// items on disk, reads their content when applicable, and moves them
// into "processed" (or "review" for the hold-scrutiny sources).
// Statistics totals are rolled forward in stats.json.
//
// Body (optional): { ids?: string[] }

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { runProcessInbox } from "@/lib/nex/knowledge-inbox/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { ids?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    /* body is optional; ignore parse errors */
  }
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === "string")
    : undefined;

  try {
    const result = await runProcessInbox({ ids });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[knowledge-inbox.process] failed:", err);
    return NextResponse.json({ ok: false, error: "process_failed" }, { status: 500 });
  }
}
