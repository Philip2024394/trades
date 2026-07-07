// POST /api/apps/ai-visualiser/scope
//
// Merchant toggles a taxonomy leaf on/off for their Visualiser. This
// defines what the AI is allowed to render on their page.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  merchantId?: unknown;
  leafSlug?: unknown;
  enabled?: unknown;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const posted = typeof body.merchantId === "string" ? body.merchantId : null;
  const merchantId = await getMerchantIdFromRequest(posted);
  if (!merchantId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  const leafSlug = typeof body.leafSlug === "string" ? body.leafSlug.trim() : "";
  const enabled = Boolean(body.enabled);
  if (!leafSlug) {
    return NextResponse.json(
      { ok: false, error: "leafSlug required." },
      { status: 400 }
    );
  }
  // Verify the leaf exists
  const { data: leaf } = await supabaseAdmin
    .from("ai_visualiser_taxonomy_leaves")
    .select("slug")
    .eq("slug", leafSlug)
    .maybeSingle();
  if (!leaf) {
    return NextResponse.json({ ok: false, error: "Unknown leaf." }, { status: 404 });
  }
  await supabaseAdmin
    .from("app_ai_visualiser_catalogue_scope")
    .upsert(
      {
        merchant_id: merchantId,
        leaf_slug: leafSlug,
        is_enabled: enabled
      },
      { onConflict: "merchant_id,leaf_slug" }
    );
  return NextResponse.json({ ok: true });
}
