// POST /api/apps/products/offers — merchant creates or upserts an offer.
// Entitlement gate: products.
import { NextResponse, type NextRequest } from "next/server";
import {
  requireMerchantSession,
  MerchantNotAuthenticatedError
} from "@/lib/os/merchantSession";
import { hasActiveEntitlement } from "@/lib/os/billing/entitlements";
import { upsertOffer } from "@/lib/products/offers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  canonicalProductId?: unknown;
  variantId?: unknown;
  merchantSku?: unknown;
  pricePence?: unknown;
  rrpPence?: unknown;
  vatRate?: unknown;
  stockStatus?: unknown;
  stockQuantity?: unknown;
  lowStockThreshold?: unknown;
  leadTimeDays?: unknown;
  supplierBusinessId?: unknown;
};

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireMerchantSession();
  } catch (e) {
    if (e instanceof MerchantNotAuthenticatedError) {
      return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
    }
    throw e;
  }
  const entitled = await hasActiveEntitlement(session.merchantId, "products");
  if (!entitled) {
    return NextResponse.json(
      { ok: false, error: "Products plan required." },
      { status: 402 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const canonicalProductId =
    typeof body.canonicalProductId === "string" ? body.canonicalProductId : "";
  const pricePence =
    typeof body.pricePence === "number" ? Math.round(body.pricePence) : NaN;
  if (!canonicalProductId || !Number.isFinite(pricePence) || pricePence < 0) {
    return NextResponse.json(
      { ok: false, error: "canonicalProductId and a valid pricePence are required." },
      { status: 400 }
    );
  }
  try {
    const offer = await upsertOffer({
      merchantId: session.merchantId,
      canonicalProductId,
      variantId: typeof body.variantId === "string" ? body.variantId : null,
      merchantSku: typeof body.merchantSku === "string" ? body.merchantSku : null,
      pricePence,
      rrpPence: typeof body.rrpPence === "number" ? body.rrpPence : null,
      vatRate: typeof body.vatRate === "number" ? body.vatRate : 0.2,
      stockStatus:
        typeof body.stockStatus === "string" &&
        ["in_stock", "low", "out", "preorder", "discontinued"].includes(
          body.stockStatus
        )
          ? (body.stockStatus as
              | "in_stock"
              | "low"
              | "out"
              | "preorder"
              | "discontinued")
          : "in_stock",
      stockQuantity:
        typeof body.stockQuantity === "number" ? body.stockQuantity : null,
      lowStockThreshold:
        typeof body.lowStockThreshold === "number"
          ? body.lowStockThreshold
          : null,
      leadTimeDays:
        typeof body.leadTimeDays === "number" ? body.leadTimeDays : null,
      supplierBusinessId:
        typeof body.supplierBusinessId === "string"
          ? body.supplierBusinessId
          : null
    });
    return NextResponse.json({ ok: true, offer });
  } catch (err) {
    console.error("[products.offers] upsert failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not save offer." },
      { status: 500 }
    );
  }
}
