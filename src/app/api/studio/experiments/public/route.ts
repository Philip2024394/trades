// Public bucketing feed for the preview iframe + published pages.
//
// GET /api/studio/experiments/public?brandId=…&pageId=…
//   → { ok, experiments: PublicExperimentRow[] }
//
// Returns only running experiments and only the fields the client
// needs to bucket + overlay: id, instance_id, variant_a_config,
// variant_b_config, split_a. Never returns names / metadata to
// avoid exposing experiment strategy in customer-side responses.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const brandId = url.searchParams.get("brandId");
  const pageId = url.searchParams.get("pageId");
  if (!brandId || !pageId) {
    return NextResponse.json({ ok: true, experiments: [] });
  }
  const res = await supabaseAdmin
    .from("studio_experiments")
    .select("id, instance_id, variant_a_config, variant_b_config, split_a")
    .eq("brand_id", brandId)
    .eq("page_id", pageId)
    .eq("status", "running");
  if (res.error) {
    return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, experiments: res.data ?? [] });
}
