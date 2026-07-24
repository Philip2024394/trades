// GET /api/admin/nex/knowledge/list?trade=&status=&q=
// Admin listing for the Knowledge Studio.

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const trade  = searchParams.get("trade");
  const status = searchParams.get("status") ?? "published";
  const q      = searchParams.get("q")?.trim();

  let query = supabaseAdmin
    .from("hammerex_nex_knowledge_entries")
    .select("id, trade, topic, title, summary, category, subcategory, difficulty, confidence, version, status, sources, updated_at");

  if (trade)  query = query.eq("trade",  trade);
  if (status) query = query.eq("status", status);
  if (q)      query = query.textSearch("search_tsv", q, { type: "websearch" });

  const { data, error } = await query.order("updated_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, entries: data });
}
