// POST /api/nex/merchant-assistant/approve
//
// The UI's explicit "Publish this draft" button. Distinct from NEX's
// publish_product tool (which fires from inside the chat loop) but
// calls the same executor with confirm=true so the ownership check +
// event fire path is identical.
//
// Body: { product_id: string }
// Returns:
//   200 { ok: true, product_id, lifecycle_status: "active" }
//   401 { ok: false, error: "not_authenticated" }
//   400 { ok: false, error: "missing_product_id" | ... }
//   500 { ok: false, error: "internal" }
//
// Reference: docs/brains/PHASE_7_IMPLEMENTATION_PLAN.md · Section 7.1

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { loadMerchantContextFromSession } from "@/lib/nex/merchant-assistant/contextLoader";
import { executePublishProduct } from "@/lib/nex/merchant-assistant/toolExecutors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await loadMerchantContextFromSession();
  if (!ctx) {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401 }
    );
  }

  let body: { product_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 }
    );
  }

  const productId =
    typeof body.product_id === "string" ? body.product_id.trim() : "";
  if (!productId) {
    return NextResponse.json(
      { ok: false, error: "missing_product_id" },
      { status: 400 }
    );
  }

  // Explicit approval → confirm=true is safe here because the UI
  // requires a click to reach this endpoint. Ownership + all other
  // rules are re-checked inside the executor.
  const result = await executePublishProduct(ctx, {
    product_id: productId,
    confirm: true,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "publish_failed" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    product_id: productId,
    lifecycle_status: "active",
  });
}
