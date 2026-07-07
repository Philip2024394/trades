// GET /api/licenses/check?imageId=&merchantId=&postcodePrefix=
//
// Returns availability + best-tier information for the merchant. Used
// by the marketplace UI to grey out tiers that aren't available (e.g.
// regional_exclusive already taken in the caller's area) and to show
// "You already own this — no need to buy again".

import { NextResponse } from "next/server";
import {
  loadBestLicenseForMerchant,
  loadFullBuyoutFor,
  loadRegionalExclusive
} from "@/lib/licenses/loader";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const imageId = url.searchParams.get("imageId") ?? "";
  const merchantId = url.searchParams.get("merchantId") ?? "";
  const postcodePrefix = url.searchParams.get("postcodePrefix") ?? "";
  if (!imageId) {
    return NextResponse.json({ error: "imageId required" }, { status: 400 });
  }
  const buyout = await loadFullBuyoutFor(imageId);
  const regionalHolder = postcodePrefix
    ? await loadRegionalExclusive(imageId, postcodePrefix.toUpperCase())
    : null;
  const myLicense = merchantId
    ? await loadBestLicenseForMerchant(imageId, merchantId)
    : null;
  return NextResponse.json({
    imageId,
    myTier: myLicense?.licenseTier ?? null,
    myLicenseExpiresAt: myLicense?.expiresAt ?? null,
    tiersUnavailable: {
      full_buyout: Boolean(buyout),
      competitor: Boolean(buyout),
      regional_exclusive:
        Boolean(regionalHolder) &&
        regionalHolder?.buyerMerchantId !== merchantId
    },
    regionalHolder: regionalHolder
      ? { merchantId: regionalHolder.buyerMerchantId, postcodePrefix }
      : null
  });
}
