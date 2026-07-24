// POST /api/admin/business-brains/[brainId]/sync
//
// Admin-only endpoint that triggers a manual Business Brain sync run.
// Auth: reuses the isAdminAuthed cookie gate. Returns the sync result
// so the dashboard can display page/product counts inline.

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { runBrainSync } from "@/lib/business-brains/_sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sync runs can take a while on large sites — Vercel serverless allows
// up to 300s on the Pro plan; adjust in vercel.json if needed. Local
// dev has no cap.
export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ brainId: string }> }
) {
  const authed = await isAdminAuthed();
  if (!authed) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { brainId } = await ctx.params;
  if (!brainId) return NextResponse.json({ ok: false, error: "brain_id_required" }, { status: 400 });

  try {
    const result = await runBrainSync({ brainId, triggeredBy: "manual" });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "sync_failed" },
      { status: 500 }
    );
  }
}
