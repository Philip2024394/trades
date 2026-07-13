// POST /api/studio/ai/publish
//
// The final step of the AI wizard — take the composed sections + save
// them as a published layout so the merchant's live profile URL
// (/[slug]) renders the generated page.
//
// Flow:
//   1. Auth (slug + edit_token)
//   2. Ensure merchant has a default studio_brand — create if not
//   3. Build layout_json from the wizard's sections (rows + sections)
//   4. Insert a NEW studio_layouts row with:
//        - status = 'published'
//        - version = max(existing) + 1
//        - breakpoint = 'default'
//   5. Return the live URL

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

type WizardSection = {
  slot?: string;
  library?: string;
  proposal?: {
    sectionId: string;
    reasoning?: string;
    params: Record<string, unknown>;
  } | null;
};

type PublishBody = {
  slug?: string;
  edit_token?: string;
  sections?: WizardSection[];
  page_id?: string;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: PublishBody;
  try {
    body = (await req.json()) as PublishBody;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const slug = s(body.slug);
  const token = s(body.edit_token);
  const pageId = s(body.page_id) || "home";
  const sections = Array.isArray(body.sections) ? body.sections : [];

  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "unauthorised" },
      { status: 401 }
    );
  }
  if (sections.length === 0) {
    return NextResponse.json(
      { ok: false, error: "no_sections" },
      { status: 400 }
    );
  }

  // Auth: verify slug + edit_token match a listing.
  const { data: listing, error: lErr } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, display_name, trading_name")
    .eq("slug", slug)
    .maybeSingle();
  if (lErr || !listing || !constantTimeEq(listing.edit_token, token)) {
    return NextResponse.json(
      { ok: false, error: "unauthorised" },
      { status: 401 }
    );
  }
  const merchantId = listing.id as string;
  const merchantName =
    (listing.trading_name as string | null)?.trim() ||
    (listing.display_name as string);

  // Step 1 — ensure default studio_brand exists.
  let brandId: string | null = null;
  const { data: existingBrand } = await supabaseAdmin
    .from("studio_brands")
    .select("id")
    .eq("merchant_id", merchantId)
    .eq("is_default", true)
    .maybeSingle();
  if (existingBrand) {
    brandId = existingBrand.id as string;
  } else {
    const { data: newBrand, error: bErr } = await supabaseAdmin
      .from("studio_brands")
      .insert({
        merchant_id: merchantId,
        name: merchantName,
        slug: slug,
        is_default: true
      })
      .select("id")
      .single();
    if (bErr || !newBrand) {
      return NextResponse.json(
        { ok: false, error: "brand_create_failed", detail: bErr?.message },
        { status: 500 }
      );
    }
    brandId = newBrand.id as string;
  }

  // Step 2 — build layout_json from wizard sections. Each section
  // becomes one row with one section (single-column stack — the
  // simplest legal layout).
  const rows: Array<{ id: string; columns: string[] }> = [];
  const sectionEntries: Array<{
    key: string;
    config: Record<string, unknown>;
    instanceId: string;
  }> = [];
  let idx = 0;
  for (const sec of sections) {
    const proposal = sec.proposal;
    if (!proposal || !proposal.sectionId) continue;
    const instanceId = `sec_${idx.toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    rows.push({ id: `r_${idx.toString(36)}`, columns: [instanceId] });
    sectionEntries.push({
      key: proposal.sectionId,
      config: proposal.params,
      instanceId
    });
    idx += 1;
  }
  const layoutJson = { rows, sections: sectionEntries };

  // Step 3 — get next version number.
  const { data: lastVersion } = await supabaseAdmin
    .from("studio_layouts")
    .select("version")
    .eq("merchant_id", merchantId)
    .eq("brand_id", brandId)
    .eq("page_id", pageId)
    .eq("breakpoint", "default")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion =
    typeof lastVersion?.version === "number" ? lastVersion.version + 1 : 1;

  // Step 4 — insert as published.
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("studio_layouts")
    .insert({
      merchant_id: merchantId,
      brand_id: brandId,
      page_id: pageId,
      breakpoint: "default",
      layout_json: layoutJson,
      status: "published",
      version: nextVersion,
      published_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json(
      { ok: false, error: "publish_failed", detail: insErr?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    layoutId: inserted.id,
    version: nextVersion,
    liveUrl: `/${slug}`,
    sectionsPublished: sectionEntries.length
  });
}
