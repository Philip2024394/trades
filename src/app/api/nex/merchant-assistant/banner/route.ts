// POST /api/nex/merchant-assistant/banner
//
// The UI's "Regenerate banner" button endpoint. Distinct from NEX's
// generate_banner tool (which fires from inside the chat loop) but
// calls the same executor so ownership + guardrails + persistence are
// identical.
//
// Body: { offer_id, visual_style?, angle? }
// Returns:
//   200 { ok: true, banner: MerchantAssistantBanner }
//   401 { ok: false, error: "not_authenticated" }
//   400 { ok: false, error: "missing_offer_id" | ... }
//   400 { ok: false, error, guardrail_blocked?, guardrail_reason? }
//
// Reference: docs/brains/PHASE_7_IMPLEMENTATION_PLAN.md · Section 7.1

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { loadMerchantContextFromSession } from "@/lib/nex/merchant-assistant/contextLoader";
import { executeGenerateBanner } from "@/lib/nex/merchant-assistant/toolExecutors";
import type { BannerVisualStyle } from "@/lib/nex/merchant-assistant/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STYLES: BannerVisualStyle[] = [
  "premium",
  "utility",
  "seasonal",
  "minimal",
];

export async function POST(req: NextRequest) {
  const ctx = await loadMerchantContextFromSession();
  if (!ctx) {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401 }
    );
  }

  let body: { offer_id?: unknown; visual_style?: unknown; angle?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 }
    );
  }

  const offerId = typeof body.offer_id === "string" ? body.offer_id.trim() : "";
  if (!offerId) {
    return NextResponse.json(
      { ok: false, error: "missing_offer_id" },
      { status: 400 }
    );
  }

  const visualStyle =
    typeof body.visual_style === "string" &&
    (ALLOWED_STYLES as string[]).includes(body.visual_style)
      ? (body.visual_style as BannerVisualStyle)
      : undefined;

  const angle = typeof body.angle === "string" ? body.angle.slice(0, 200) : undefined;

  const result = await executeGenerateBanner(ctx, {
    offer_id: offerId,
    visual_style: visualStyle,
    angle,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error ?? "banner_failed",
        guardrail_blocked: result.guardrail_blocked ?? false,
        guardrail_reason: result.guardrail_reason,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, banner: result.data });
}
