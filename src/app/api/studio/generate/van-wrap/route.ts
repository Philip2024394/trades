// POST /api/studio/generate/van-wrap
// Runs the Van Wrap Studio generator. Reads Brand DNA from the merchant's
// identity row, hands off to the registered Studio App via capabilityRegistry.
//
// Body (optional): { user_prompt?: string; reference_urls?: string[] }
// Returns: { ok, asset_urls[], prompt_used, cost_pence, latency_ms }

import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadStudioSession } from "@/lib/studio/session";
import { capabilityRegistry, ensureAppsLoaded } from "@/lib/design/trade-os/manifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await loadStudioSession();
  if (!session) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { user_prompt?: string; reference_urls?: string[] };

  const { data: identity } = await supabaseAdmin
    .from("hammerex_brand_identity")
    .select("id, brand_json")
    .eq("merchant_slug", session.merchant.slug)
    .maybeSingle();
  if (!identity) return NextResponse.json({ ok: false, error: "no_brand_dna_yet" }, { status: 409 });

  await ensureAppsLoaded();

  const result = await capabilityRegistry.execute("vehicle.van-wrap", {
    correlation_id:    randomUUID(),
    brand_snapshot:    identity.brand_json as Record<string, unknown>,
    brand_identity_id: identity.id,
    merchant_slug:     session.merchant.slug,
    user_prompt:       body.user_prompt,
    reference_urls:    body.reference_urls
  });

  return NextResponse.json(result);
}
