// src/app/nex-native/manage/analytics/export.csv/route.ts
//
// Wave B Slice 5e · CSV export of the merchant's month-over-month revenue.
// Owner-session gated (uses the same resolver as the Server Actions).
// One row per (month, currency) across a 6-month window · zero-fill inclusive
// so downstream tools see stable shape even in quiet months.

import { NextResponse } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as analyticsService from "@/lib/nex-native/analytics-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOM_MONTHS = 6;

function csvEscape(field: string | number): string {
  const s = String(field);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const business = owned[0];
  if (!business) {
    return NextResponse.json({ error: "no_business" }, { status: 404 });
  }

  // Overview gives us the list of currencies the merchant has activity in.
  const overview = await analyticsService.getMerchantOverview(business.id);
  const currencies = Array.from(
    new Set<string>([
      ...Object.keys(overview.gross_revenue_by_currency),
      ...Object.keys(overview.net_revenue_by_currency),
      ...Object.keys(overview.refunded_amount_by_currency),
    ]),
  ).sort();

  // Header
  const rows: string[] = [
    ["month", "currency", "order_count", "gross_revenue_pence", "gross_revenue_major"]
      .map(csvEscape)
      .join(","),
  ];

  // Body · one row per (currency, month) · month buckets in chronological order.
  // If merchant has zero activity anywhere, we still emit a stable header + no rows.
  for (const currency of currencies) {
    const mom = await analyticsService.getMonthOverMonthRevenue(business.id, MOM_MONTHS, currency);
    for (const bucket of mom) {
      const majorAmount = (bucket.gross_revenue_pence / 100).toFixed(2);
      rows.push(
        [
          bucket.month,
          currency,
          bucket.order_count,
          bucket.gross_revenue_pence,
          majorAmount,
        ]
          .map(csvEscape)
          .join(","),
      );
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `nex-analytics-${business.slug}-${stamp}.csv`;
  const body = rows.join("\r\n") + "\r\n";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
