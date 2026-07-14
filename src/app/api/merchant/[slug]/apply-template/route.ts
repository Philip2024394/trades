// POST /api/merchant/[slug]/apply-template
//
// Applies a template from hammerex_app_templates onto the merchant's
// listing. Auth: the signed-in trade session cookie must match the
// slug in the URL path — otherwise 403. Body: { templateSlug }.

import { NextResponse } from "next/server";
import { applyTemplateToMerchant } from "@/lib/appTemplates";
import { getMerchantSlug } from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  templateSlug?: unknown;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const sessionSlug = await getMerchantSlug();
  if (!sessionSlug) {
    return NextResponse.json({ ok: false, error: "not-signed-in" }, { status: 401 });
  }
  if (sessionSlug !== slug) {
    return NextResponse.json({ ok: false, error: "not-your-listing" }, { status: 403 });
  }

  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  const templateSlug =
    typeof payload.templateSlug === "string" ? payload.templateSlug.trim() : "";
  if (!templateSlug) {
    return NextResponse.json({ ok: false, error: "missing-template" }, { status: 400 });
  }

  const result = await applyTemplateToMerchant(slug, templateSlug);
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error("[apply-template] failed", { slug, templateSlug, error: result.error });
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.error === "template-not-found" ? 404 : 500 }
    );
  }

  return NextResponse.json({ ok: true, applied: templateSlug });
}
