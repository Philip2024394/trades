// GET /api/mate/history?conversation_id=<uuid>
//
// Returns every message in a conversation (user + Mate) ordered
// oldest → newest. Used by the chat widget when reopening a
// past conversation.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const id = new URL(req.url).searchParams.get("conversation_id") ?? "";
  if (!id) return NextResponse.json({ ok: false, error: "conversation_id_required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("hammerex_mate_messages")
    .select("id, role, content, created_at, feedback_signal, model")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, messages: data ?? [] });
}
