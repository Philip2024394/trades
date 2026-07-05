// Growth Coach — top-3 next actions for the merchant.
//
//   GET /api/studio/growth-coach → { ok, tasks: GrowthTask[] }
//
// Server-side inspection of the merchant's live state (credentials,
// coverage, wizard status, unpublished drafts, WhatsApp). Returns
// exactly 3 tasks ordered by impact. If everything is done, returns
// an empty array — the card renders a completion state.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { runGrowthCoach } from "@/lib/studio/growthCoach/checkers";

export const runtime = "nodejs";

export async function GET() {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  const tasks = await runGrowthCoach({
    merchantId: session.merchant.id,
    brandId: session.brand.id,
    primaryTrade: session.merchant.primary_trade,
    slug: session.merchant.slug,
    city: session.merchant.city
  });
  return NextResponse.json({ ok: true, tasks });
}
