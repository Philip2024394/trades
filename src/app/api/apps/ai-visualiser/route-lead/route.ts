// POST /api/apps/ai-visualiser/route-lead
//
// Captures a mis-uploaded homeowner as a routed marketplace lead —
// e.g. a staircase photo on a door-carpenter's Visualiser. The
// originating merchant loses nothing (they couldn't quote for it) and
// the platform gets to route the intent to relevant merchants.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  merchantId?: unknown;
  homeownerId?: unknown;
  detectedLeafSlug?: unknown;
  sourcePhotoUrl?: unknown;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const merchantId = typeof body.merchantId === "string" ? body.merchantId.trim() : "";
  const detectedLeafSlug =
    typeof body.detectedLeafSlug === "string" ? body.detectedLeafSlug.trim() : "";
  const sourcePhotoUrl =
    typeof body.sourcePhotoUrl === "string" ? body.sourcePhotoUrl.trim() : "";
  const homeownerId =
    typeof body.homeownerId === "string" ? body.homeownerId.trim() : null;

  if (!merchantId || !detectedLeafSlug || !sourcePhotoUrl) {
    return NextResponse.json(
      { ok: false, error: "merchantId, detectedLeafSlug and sourcePhotoUrl are required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("app_ai_visualiser_routed_leads")
    .insert({
      originating_merchant_id: merchantId,
      homeowner_id: homeownerId,
      detected_leaf_slug: detectedLeafSlug,
      source_photo_url: sourcePhotoUrl,
      status: "detected"
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: "Could not record routed lead." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: data.id });
}
