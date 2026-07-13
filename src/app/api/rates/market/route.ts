// GET /api/rates/market?trade=plastering&region=UKD&services=slug1,slug2,…&city=manchester
//
// Batch fetch of network medians per service slug. Returns { medians:
// { [serviceSlug]: { gbpMedian, gbpP25, gbpP75, sampleSize,
// contributorCount, scope } } }.
//
// Evidence-or-silence: only services with a verified aggregate that
// passed the 3+/3-month/<15% stdev rule appear in the response.
// Everything else is silently omitted. UI shows "not enough data" for
// missing keys.

import { NextResponse } from "next/server";
import { batchGetMarketRatesByService } from "@/lib/rates/getMarketRate";
import { NUTS1_REGIONS, UK_CITIES } from "@/lib/rates/taxonomy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const trade    = url.searchParams.get("trade")    ?? "";
  const region   = url.searchParams.get("region")   ?? "";
  const city     = url.searchParams.get("city")     ?? undefined;
  const services = (url.searchParams.get("services") ?? "").split(",").filter(Boolean);

  if (!trade) return NextResponse.json({ error: "missing_trade" }, { status: 400 });
  if (!NUTS1_REGIONS.some((r) => r.code === region)) {
    return NextResponse.json({ error: "invalid_region" }, { status: 400 });
  }
  if (city && !UK_CITIES.some((c) => c.slug === city)) {
    return NextResponse.json({ error: "invalid_city" }, { status: 400 });
  }

  const map = await batchGetMarketRatesByService({
    tradeSlug:    trade,
    serviceSlugs: services,
    regionCode:   region,
    citySlug:     city
  });

  const medians: Record<string, {
    gbpMedian: number;
    gbpP25: number;
    gbpP75: number;
    sampleSize: number;
    contributorCount: number;
    scope: "city" | "region";
  }> = {};
  for (const [slug, rate] of map) {
    medians[slug] = {
      gbpMedian:        rate.gbpMedian,
      gbpP25:           rate.gbpP25,
      gbpP75:           rate.gbpP75,
      sampleSize:       rate.sampleSize,
      contributorCount: rate.contributorCount,
      scope:            rate.scope
    };
  }

  return NextResponse.json({ medians });
}
