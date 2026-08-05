// GET /api/nex/brain/status — live snapshot of the NEX Brain
//
// Returns the full BrainStatus (worker pool health, corpus counts,
// LLM budget consumed, feedback totals, contradictions open). Used by
// the /nex-app/nex-brain monitor page and by anything else that wants
// to display the brain's live state.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { managerStatus } from "@/lib/nex/brain/manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const status = await managerStatus();
    return NextResponse.json({ ok: true, status });
  } catch (err) {
    console.error("[api.brain.status] failed:", err);
    return NextResponse.json({ ok: false, error: "status_failed" }, { status: 500 });
  }
}
