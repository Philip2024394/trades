// Local SEO Pack API.
//
//   GET /api/studio/local-seo → { ok, pack: { description, services, posts, reviews } }
//
// Loads merchant + brand + credentials + coverage context and returns
// every generator's output in one payload so the tab UI doesn't need
// per-tab fetches. Everything is deterministic — no LLM, no cost.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import "@/lib/studio/blueprints"; // ensure registry populated
import {
  generateAllPosts,
  generateDescription,
  generateReviewRequests,
  generateServiceList,
  loadLocalSeoContext
} from "@/lib/studio/localSeo/generators";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  const origin = new URL(req.url).origin;
  const ctx = await loadLocalSeoContext({
    merchantId: session.merchant.id,
    brandId: session.brand.id,
    primaryTrade: session.merchant.primary_trade,
    slug: session.merchant.slug,
    city: session.merchant.city,
    merchantName: session.merchant.display_name,
    origin
  });

  return NextResponse.json({
    ok: true,
    context: {
      merchantName: ctx.merchantName,
      tradeLabel: ctx.tradeLabel,
      city: ctx.city,
      coveragePostcode: ctx.coveragePostcode,
      coverageRadiusMi: ctx.coverageRadiusMi,
      verifiedCredentials: ctx.verifiedCredentials,
      blueprintSlug: ctx.blueprintSlug
    },
    pack: {
      description: [generateDescription(ctx)],
      services: generateServiceList(ctx),
      posts: generateAllPosts(ctx),
      reviews: generateReviewRequests(ctx)
    }
  });
}
