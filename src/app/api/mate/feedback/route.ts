// POST /api/mate/feedback
//
// Records a thumbs up/down + optional note on a specific Mate
// message. This is the training-data signal — Phase 3 fine-tune
// will use these labels.
//
// Body: { message_id, signal: 1|-1, note?: string }

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json().catch(() => null) as {
    message_id?: string; signal?: number; note?: string
  } | null;

  const id     = String(body?.message_id ?? "");
  const signal = Number(body?.signal ?? 0);
  const note   = String(body?.note ?? "").slice(0, 400);

  if (!id) return NextResponse.json({ ok: false, error: "message_id_required" }, { status: 400 });
  if (signal !== 1 && signal !== -1) {
    return NextResponse.json({ ok: false, error: "invalid_signal" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("hammerex_mate_messages")
    .update({ feedback_signal: signal, feedback_note: note || null })
    .eq("id", id)
    .eq("role", "assistant");

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
