// POST /api/admin/mate/gaps
//
// Admin action on a knowledge gap: mark reviewed / promoted / dismissed.
// When action='promoted' we create a draft knowledge base entry
// linking back to the gap so admin can polish then publish.
//
// Auth: admin cookie required (isAdminAuthed).

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminAuthed } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "not_admin" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as {
    id?:     string;
    action?: "reviewed" | "promoted" | "dismissed";
    notes?:  string;
  } | null;

  const id     = String(body?.id ?? "");
  const action = String(body?.action ?? "");
  const notes  = body?.notes ? String(body.notes).slice(0, 500) : null;

  if (!id) return NextResponse.json({ ok: false, error: "id_required" }, { status: 400 });
  if (!["reviewed", "promoted", "dismissed"].includes(action)) {
    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status:      action,
    reviewed_at: now,
    reviewed_by: "admin"
  };
  if (notes) patch.notes = notes;

  // 'promoted' just tags the gap for later. Admin still writes the
  // real KB entry via the knowledge admin surface with a chosen
  // trade_slug + content_type — those are required NOT NULL on the
  // entries table and shouldn't be guessed here. Question + reply are
  // preserved on the gap row so admin can copy them across.
  const { error } = await supabaseAdmin
    .from("hammerex_mate_gaps")
    .update(patch)
    .eq("id", id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
