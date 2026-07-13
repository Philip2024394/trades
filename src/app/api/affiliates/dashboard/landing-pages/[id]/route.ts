// PATCH /api/affiliates/dashboard/landing-pages/[id] — update a page.
// DELETE — delete it.
//
// Both routes scope updates by affiliate_id so an affiliate cannot
// touch another's page.
import { NextResponse, type NextRequest } from "next/server";
import { readAffiliateSession } from "@/lib/affiliateSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitiseSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = readAffiliateSession(req);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Not signed in." },
      { status: 401 }
    );
  }
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  };
  if (typeof body.slug === "string") {
    const slug = sanitiseSlug(body.slug);
    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "Invalid slug." },
        { status: 400 }
      );
    }
    patch.slug = slug;
  }
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (typeof body.tagline === "string") {
    patch.tagline = body.tagline.trim() || null;
  }
  if (typeof body.cta_text === "string") {
    patch.cta_text = body.cta_text.trim() || "Join thenetworkers.app";
  }
  if (typeof body.hero_image_url === "string") {
    patch.hero_image_url = body.hero_image_url.trim() || null;
  }
  if (typeof body.body_markdown === "string") {
    patch.body_markdown = body.body_markdown;
  }

  const upd = await supabaseAdmin
    .from("hammerex_affiliate_landing_pages")
    .update(patch)
    .eq("id", id)
    .eq("affiliate_id", session.affiliate_id)
    .select("*")
    .maybeSingle();
  if (upd.error || !upd.data) {
    return NextResponse.json(
      { ok: false, error: upd.error?.message ?? "Update failed." },
      { status: 500 }
    );
  }
  await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
    actor_type: "affiliate",
    actor_id: String(session.affiliate_id),
    action: "landing_page.update",
    target_id: id
  });
  return NextResponse.json({ ok: true, page: upd.data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = readAffiliateSession(req);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Not signed in." },
      { status: 401 }
    );
  }
  const { id } = await params;
  const del = await supabaseAdmin
    .from("hammerex_affiliate_landing_pages")
    .delete()
    .eq("id", id)
    .eq("affiliate_id", session.affiliate_id);
  if (del.error) {
    return NextResponse.json(
      { ok: false, error: del.error.message },
      { status: 500 }
    );
  }
  await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
    actor_type: "affiliate",
    actor_id: String(session.affiliate_id),
    action: "landing_page.delete",
    target_id: id
  });
  return NextResponse.json({ ok: true });
}
