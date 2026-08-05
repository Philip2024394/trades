// POST /api/nex/brain/dispatch — manager scans the Knowledge Inbox
// for WAITING items and enqueues an extractor job for each new one.
// Idempotent — safe to call every minute from a cron / worker loop.
//
// Body: none required. Returns a summary of what was enqueued.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { dispatchNewInboxItems } from "@/lib/nex/brain/manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_req: NextRequest) {
  try {
    const summary = await dispatchNewInboxItems();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[api.brain.dispatch] failed:", err);
    return NextResponse.json({ ok: false, error: "dispatch_failed" }, { status: 500 });
  }
}
