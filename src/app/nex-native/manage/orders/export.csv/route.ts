// src/app/nex-native/manage/orders/export.csv/route.ts
//
// Wave B Slice 4j · CSV export of the merchant's orders.
// Mirrors Slice 5e (analytics CSV) · owner-session gated · newest-first.
// One row per order. Notes are CSV-escaped so commas/quotes/newlines in
// customer_note or merchant_note don't corrupt the file.

import { NextResponse } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as orderService from "@/lib/nex-native/order-service";
import * as productService from "@/lib/nex-native/product-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(field: string | number | null | undefined): string {
  if (field === null || field === undefined) return "";
  const s = String(field);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const HEADER = [
  "order_id",
  "created_at",
  "state",
  "product_name",
  "currency",
  "price_pence",
  "price_major",
  "customer_note",
  "merchant_note",
  "dispatch_tracking_url",
] as const;

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

  // Slice 4h searchOrders · newest sort · no filter · high limit for full export
  const orders = await orderService.searchOrders(business.id, { sort: "newest", limit: 500 });

  // Enrich with product names (one lookup per unique product id)
  const productIds = Array.from(new Set(orders.map((o) => o.product_id)));
  const productsById = new Map<string, string>();
  await Promise.all(productIds.map(async (id) => {
    const p = await productService.getProductById(id);
    if (p) productsById.set(id, p.name);
  }));

  const rows: string[] = [HEADER.map(csvEscape).join(",")];
  for (const o of orders) {
    rows.push([
      o.id,
      o.created_at,
      o.state,
      productsById.get(o.product_id) ?? "",
      o.currency,
      o.price_pence,
      (o.price_pence / 100).toFixed(2),
      o.customer_note,
      o.merchant_note ?? "",
      o.dispatch_tracking_url,
    ].map(csvEscape).join(","));
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `nex-orders-${business.slug}-${stamp}.csv`;
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
