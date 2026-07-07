// PATCH /api/apps/products/offers/[id]/price — merchant changes price.
import { NextResponse, type NextRequest } from "next/server";
import {
  requireMerchantSession,
  MerchantNotAuthenticatedError
} from "@/lib/os/merchantSession";
import { hasActiveEntitlement } from "@/lib/os/billing/entitlements";
import { updateOfferPrice } from "@/lib/products/offers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  pricePence?: unknown;
  rrpPence?: unknown;
  promotion?: unknown;
};

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
  const pricePence =
    typeof body.pricePence === "number" ? Math.round(body.pricePence) : NaN;
  if (!Number.isFinite(pricePence) || pricePence < 0) {
    return NextResponse.json(
      { ok: false, error: "Valid pricePence required." },
      { status: 400 }
    );
  }
  try {
    const offer = await updateOfferPrice({
      offerId: id,
      merchantId: session.merchantId,
      pricePence,
      rrpPence: typeof body.rrpPence === "number" ? body.rrpPence : null,
      promotion:
        typeof body.promotion === "object" && body.promotion !== null
          ? (body.promotion as { kind?: string; percentage?: number; ends_at?: string; label?: string })
          : null
    });
    return NextResponse.json({ ok: true, offer });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 400 }
    );
  }
}
