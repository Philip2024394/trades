// POST /api/affiliates/dashboard/landing-pages — create a new
// white-label landing page for the signed-in affiliate.
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

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = readAffiliateSession(req);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Not signed in." },
      { status: 401 }
    );
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const slug = sanitiseSlug(typeof body.slug === "string" ? body.slug : "");
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!slug || !title) {
    return NextResponse.json(
      { ok: false, error: "Slug and title are required." },
      { status: 400 }
    );
  }
  const row = {
    affiliate_id: session.affiliate_id,
    slug,
    title,
    tagline:
      typeof body.tagline === "string" && body.tagline.trim()
        ? body.tagline.trim()
        : null,
    cta_text:
      typeof body.cta_text === "string" && body.cta_text.trim()
        ? body.cta_text.trim()
        : "Join xratedtrade.com",
    hero_image_url:
      typeof body.hero_image_url === "string" && body.hero_image_url.trim()
        ? body.hero_image_url.trim()
        : null,
    body_markdown:
      typeof body.body_markdown === "string" ? body.body_markdown : null
  };
  const ins = await supabaseAdmin
    .from("hammerex_affiliate_landing_pages")
    .insert(row)
    .select("*")
    .maybeSingle();
  if (ins.error || !ins.data) {
    const msg = ins.error?.message?.includes("duplicate")
      ? "A page with that slug already exists."
      : ins.error?.message ?? "Insert failed.";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 }
    );
  }
  await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
    actor_type: "affiliate",
    actor_id: String(session.affiliate_id),
    action: "landing_page.create",
    target_id: ins.data.id,
    details: { slug }
  });
  return NextResponse.json({ ok: true, page: ins.data });
}
