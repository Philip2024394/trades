// POST /api/admin/hero-library — create a new hero image.
// Auth-gated by the same admin session cookie the admin pages use.

import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  const image_url = String(body.image_url ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const vibe = String(body.vibe ?? "").trim();

  if (!id || !image_url || !subject || !vibe) {
    return NextResponse.json(
      { error: "id, image_url, subject, vibe required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("hero_library")
    .insert({
      id,
      image_url,
      subject,
      vibe,
      keywords_strict: (body.keywords_strict as string[]) ?? [],
      excluded_trades: (body.excluded_trades as string[]) ?? [],
      text_zone: body.text_zone ?? {},
      theme_palette: body.theme_palette ?? {},
      aspect_variants: body.aspect_variants ?? {},
      sibling_group_id: (body.sibling_group_id as string | null) ?? null,
      hero_use_case: (body.hero_use_case as string) ?? "",
      burned_in_text: Boolean(body.burned_in_text),
      worker_visible: Boolean(body.worker_visible),
      recommended_use: (body.recommended_use as string) ?? "hero",
      notes: (body.notes as string | null) ?? null
    })
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, image: data });
}
