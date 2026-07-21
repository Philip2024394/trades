// POST /api/site/entitlement
//
// Batch entitlement resolver for The Site wall. SearchShell's SSR
// pass resolves the first page's IDs server-side; every subsequent
// page appended by endless-scroll hits this endpoint so the "Owned"
// / "Subscribed" / "Bundled" chip + direct-download link stay correct
// as the user scrolls.
//
// Cheapest path wins — a subscription/tier check answers hasBlanket in
// one round trip; only the purchase-fallback path spends a second
// round trip over the specific IDs.
//
// Body: { image_ids: string[] }  (max 100 per call — keeps the OR
// clause small; SearchShell paginates 24 per fetch so this is fine)
// Response: { hasBlanket, blanketReason, ownedImageIds }

import { NextResponse, type NextRequest } from "next/server";
import { getMerchantSlug } from "@/lib/merchantSession";
import { readSiteBuyerEmailCookie } from "@/lib/siteBuyerCookie";
import { siteEntitlementForViewer } from "@/lib/siteAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IDS = 100;

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { image_ids?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const idsIn = Array.isArray(body.image_ids) ? body.image_ids : [];
  const ids = idsIn
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    .slice(0, MAX_IDS);

  const merchantSlug = await getMerchantSlug();
  const email        = await readSiteBuyerEmailCookie();

  const result = await siteEntitlementForViewer(ids, {
    merchantSlug,
    email
  });

  return NextResponse.json(result);
}
