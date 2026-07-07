// POST /api/licenses/checkout
//
// Body:
//   {
//     imageId, tier,
//     buyerType: "merchant" | "external",
//     buyerMerchantId?, buyerEmail?,
//     postcodePrefix? (regional_exclusive only)
//   }
//
// Creates a pending licence row + a Stripe Checkout session and
// returns the redirect URL. Client redirects the browser there.
//
// Blocks the purchase if:
//   - The image already has an active full_buyout (removed from
//     catalogue).
//   - Regional_exclusive tier + the same postcode district already
//     has an active licence (partial unique index would fail anyway).

import { NextResponse } from "next/server";
import {
  createPendingLicense,
  loadFullBuyoutFor,
  loadRegionalExclusive
} from "@/lib/licenses/loader";
import { createCheckoutSession } from "@/lib/licenses/stripe";
import { TIER_PRICING } from "@/lib/licenses/pricing";
import type { LicenseTier, BuyerType } from "@/lib/licenses/types";
import { allHeroImages } from "@/lib/hero-swap/library";
import { allBeforeAfterEntries } from "@/lib/before-after/library";

export const runtime = "nodejs";

type Body = {
  imageId?: string;
  tier?: LicenseTier;
  buyerType?: BuyerType;
  buyerMerchantId?: string;
  buyerEmail?: string;
  postcodePrefix?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.imageId || !body?.tier || !body?.buyerType) {
    return NextResponse.json(
      { error: "imageId, tier, buyerType required" },
      { status: 400 }
    );
  }
  const pricing = TIER_PRICING[body.tier];
  if (!pricing) {
    return NextResponse.json({ error: "unknown tier" }, { status: 400 });
  }
  if (body.buyerType === "merchant" && !body.buyerMerchantId) {
    return NextResponse.json(
      { error: "merchant buyers need buyerMerchantId" },
      { status: 400 }
    );
  }
  if (body.buyerType === "external" && !body.buyerEmail) {
    return NextResponse.json(
      { error: "external buyers need buyerEmail" },
      { status: 400 }
    );
  }
  if (
    body.tier === "regional_exclusive" &&
    (!body.postcodePrefix || body.postcodePrefix.trim().length === 0)
  ) {
    return NextResponse.json(
      { error: "regional_exclusive needs postcodePrefix" },
      { status: 400 }
    );
  }

  // Resolve the image + subject.
  const heroMatch = allHeroImages().find((h) => h.id === body.imageId);
  const baMatch = allBeforeAfterEntries().find((b) => b.id === body.imageId);
  const subject = heroMatch?.subject ?? baMatch?.subject ?? "Trade library image";
  if (!heroMatch && !baMatch) {
    return NextResponse.json(
      { error: "unknown imageId" },
      { status: 404 }
    );
  }

  // Availability checks.
  const buyout = await loadFullBuyoutFor(body.imageId);
  if (buyout && buyout.buyerMerchantId !== body.buyerMerchantId) {
    return NextResponse.json(
      {
        error: "unavailable",
        detail:
          "This image has been bought outright and is no longer for sale."
      },
      { status: 409 }
    );
  }
  if (body.tier === "regional_exclusive") {
    const regional = await loadRegionalExclusive(
      body.imageId,
      body.postcodePrefix!.trim().toUpperCase()
    );
    if (regional && regional.buyerMerchantId !== body.buyerMerchantId) {
      return NextResponse.json(
        {
          error: "unavailable",
          detail: `Another tradesperson holds the regional exclusive for ${body.postcodePrefix}. Standard licence still available.`
        },
        { status: 409 }
      );
    }
  }

  // Create the pending licence row.
  const expiresAt =
    body.tier === "regional_exclusive"
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
  const licenseId = await createPendingLicense({
    imageId: body.imageId,
    buyerType: body.buyerType,
    buyerMerchantId: body.buyerMerchantId,
    buyerEmail: body.buyerEmail,
    licenseTier: body.tier,
    postcodePrefix: body.postcodePrefix?.trim().toUpperCase(),
    amountPence: pricing.amountPence,
    expiresAt
  });
  if (!licenseId) {
    return NextResponse.json(
      { error: "database unavailable" },
      { status: 503 }
    );
  }

  // Handoff to Stripe.
  const origin = new URL(request.url).origin;
  const successUrl = `${origin}/xrated-trades-images/success?license=${licenseId}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/xrated-trades-images/${encodeURIComponent(body.imageId)}?canceled=1`;

  const session = await createCheckoutSession({
    imageId: body.imageId,
    imageSubject: subject,
    tier: body.tier,
    buyerEmail: body.buyerEmail,
    buyerMerchantId: body.buyerMerchantId,
    postcodePrefix: body.postcodePrefix?.trim().toUpperCase(),
    successUrl,
    cancelUrl,
    licenseId
  });
  if (!session) {
    return NextResponse.json(
      {
        error: "stripe_unavailable",
        detail:
          "Stripe not configured (STRIPE_SECRET_KEY missing). Pending licence created but no checkout URL."
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    licenseId,
    sessionId: session.sessionId,
    url: session.url
  });
}
