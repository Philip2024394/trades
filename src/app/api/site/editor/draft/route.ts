// GET  /api/site/editor/draft            — most-recent draft for caller
// POST /api/site/editor/draft            — upsert (autosave + explicit save)
//
// Owner identity: signed-in merchant preferred, else signed
// tn_site_buyer email cookie. Anonymous (no cookie) callers get 401
// on POST but can GET null (used by the client to bootstrap a new
// empty state without a network round-trip failure).

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { readSiteBuyerEmailCookie } from "@/lib/siteBuyerCookie";
import type { EditorState } from "@/lib/siteEditor/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveOwner(): Promise<
  | { merchantSlug: string;  email: null }
  | { merchantSlug: null;    email: string }
  | null
> {
  const slug = await getMerchantSlug();
  if (slug) return { merchantSlug: slug, email: null };
  const email = await readSiteBuyerEmailCookie();
  if (email) return { merchantSlug: null, email };
  return null;
}

export async function GET(): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner) return NextResponse.json({ draft: null });

  const q = supabaseAdmin
    .from("hammerex_site_editor_drafts")
    .select("id, frame_slug, state, title, source_image_id, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1);
  const res = owner.merchantSlug
    ? await q.eq("owner_merchant_slug", owner.merchantSlug).maybeSingle()
    : await q.eq("owner_email", owner.email).maybeSingle();
  if (res.error) {
    console.error("[site/editor/draft] load failed:", res.error.message);
    return NextResponse.json({ draft: null });
  }
  return NextResponse.json({ draft: res.data ?? null });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  let body: {
    id?: unknown;
    frame_slug?: unknown;
    state?: unknown;
    title?: unknown;
    source_image_id?: unknown;
    is_autosave?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const state = body.state as EditorState | undefined;
  if (!state || typeof state !== "object" || state.version !== 1) {
    return NextResponse.json({ ok: false, error: "invalid_state" }, { status: 400 });
  }
  const frameSlug = typeof body.frame_slug === "string" && body.frame_slug.length > 0
    ? body.frame_slug
    : state.frameSlug;
  const title = typeof body.title === "string" && body.title.trim().length > 0
    ? body.title.trim().slice(0, 120)
    : "Untitled draft";
  const sourceImageId = typeof body.source_image_id === "string" && body.source_image_id.length > 0
    ? body.source_image_id
    : null;
  const isAutosave = body.is_autosave !== false;
  const draftId = typeof body.id === "string" && body.id.length > 0 ? body.id : null;

  const row = {
    owner_merchant_slug: owner.merchantSlug,
    owner_email:         owner.email,
    source_image_id:     sourceImageId,
    frame_slug:          frameSlug,
    state:               state as unknown as Record<string, unknown>,
    title,
    is_autosave:         isAutosave,
    updated_at:          new Date().toISOString()
  };

  if (draftId) {
    const upd = await supabaseAdmin
      .from("hammerex_site_editor_drafts")
      .update(row)
      .eq("id", draftId)
      .select("id")
      .maybeSingle();
    if (upd.error) {
      console.error("[site/editor/draft] update failed:", upd.error.message);
      return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: upd.data?.id ?? draftId });
  }

  const ins = await supabaseAdmin
    .from("hammerex_site_editor_drafts")
    .insert(row)
    .select("id")
    .single();
  if (ins.error || !ins.data) {
    console.error("[site/editor/draft] insert failed:", ins.error?.message);
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: ins.data.id });
}
