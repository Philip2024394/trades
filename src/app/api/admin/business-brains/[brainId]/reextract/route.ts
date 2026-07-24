// POST /api/admin/business-brains/[brainId]/reextract
//
// Re-runs the extractors against every already-stored page for this brain.
// Useful after a heuristic change — no need to re-crawl the source site.

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { reextractBrain } from "@/lib/business-brains/_sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ brainId: string }> }) {
  const authed = await isAdminAuthed();
  if (!authed) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { brainId } = await ctx.params;
  try {
    const result = await reextractBrain(brainId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "reextract_failed" }, { status: 500 });
  }
}
