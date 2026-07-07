// PATCH /api/apps/products/offers/[id]/stock — merchant updates stock.
import { NextResponse, type NextRequest } from "next/server";
import {
  requireMerchantSession,
  MerchantNotAuthenticatedError
} from "@/lib/os/merchantSession";
import { hasActiveEntitlement } from "@/lib/os/billing/entitlements";
import { updateOfferStock } from "@/lib/products/offers";
import type { StockStatus } from "@/lib/products/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  stockStatus?: unknown;
  stockQuantity?: unknown;
};

const VALID_STATUSES: StockStatus[] = [
  "in_stock",
  "low",
  "out",
  "preorder",
  "discontinued"
];

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  let session;
  try {
    session = await requireMerchantSession();
  } catch (e) {
    if (e instanceof MerchantNotAuthenticatedError) {
      return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
    }
    throw e;
  }
  if (!(await hasActiveEntitlement(session.merchantId, "products"))) {
    return NextResponse.json({ ok: false, error: "Products plan required." }, { status: 402 });
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const stockStatus = body.stockStatus as StockStatus | undefined;
  if (!stockStatus || !VALID_STATUSES.includes(stockStatus)) {
    return NextResponse.json(
      { ok: false, error: "Valid stockStatus required." },
      { status: 400 }
    );
  }
  try {
    const offer = await updateOfferStock({
      offerId: id,
      merchantId: session.merchantId,
      stockStatus,
      stockQuantity:
        typeof body.stockQuantity === "number" ? body.stockQuantity : null
    });
    return NextResponse.json({ ok: true, offer });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 400 });
  }
}
