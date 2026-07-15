// PUT /api/admin/image-submissions/[id]/materials
//
// Admin sets/replaces the materials tag list on a submission.
// Per feedback_never_suggest_extra_products.md — human-tagged only.
// This endpoint enforces the shape { kind, ref, label, url }[] and
// rejects anything malformed.

import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { MaterialTag } from "@/lib/imageSubmissions";

const MAX_MATERIALS = 20;

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });
  }

  let payload: { materials?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  const raw = payload.materials;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ ok: false, error: "materials-must-be-array" }, { status: 400 });
  }

  const cleaned: MaterialTag[] = [];
  for (const item of raw) {
    if (cleaned.length >= MAX_MATERIALS) break;
    if (!item || typeof item !== "object") continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = item as any;
    const kind  = String(rec.kind ?? "");
    const ref   = String(rec.ref ?? "").trim();
    const label = String(rec.label ?? "").trim();
    const url   = String(rec.url ?? "").trim();
    if (kind !== "hammerex" && kind !== "trade_center" && kind !== "external") continue;
    if (!ref || !label || !/^https?:\/\//.test(url)) continue;
    cleaned.push({ kind, ref, label: label.slice(0, 80), url });
  }

  const res = await supabaseAdmin
    .from("networkers_image_submissions")
    .update({ materials: cleaned })
    .eq("id", id)
    .select("id, materials")
    .single();

  if (res.error || !res.data) {
    // eslint-disable-next-line no-console
    console.error("[admin/image-submissions/materials] update failed", res.error);
    return NextResponse.json({ ok: false, error: "db-update-failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, materials: cleaned });
}
