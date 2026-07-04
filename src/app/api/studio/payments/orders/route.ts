// Studio payment orders — reconciliation surface.
//
//   GET /api/studio/payments/orders
//     Query: ?status=paid|failed|pending|created|cancelled|refunded|all
//            ?provider=stripe|paypal|…|all
//            ?limit=50  ?before=<created_at ISO cursor>
//     → { ok, orders, nextCursor }

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "all";
  const provider = url.searchParams.get("provider") ?? "all";
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");
  const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 50));
  const before = url.searchParams.get("before");

  let query = supabaseAdmin
    .from("studio_payment_orders")
    .select(
      "id, provider_id, external_ref, order_ref, amount_minor, currency, description, status, customer_email, created_at, updated_at, completed_at, metadata"
    )
    .eq("brand_id", session.brand.id)
    .order("created_at", { ascending: false })
    .limit(limit + 1);
  if (status !== "all") query = query.eq("status", status);
  if (provider !== "all") query = query.eq("provider_id", provider);
  if (before) query = query.lt("created_at", before);

  const res = await query;
  if (res.error) {
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }
  const rows = res.data ?? [];
  const hasMore = rows.length > limit;
  const orders = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? orders[orders.length - 1].created_at : null;

  return NextResponse.json({
    ok: true,
    orders: orders.map((r) => ({
      id: r.id,
      providerId: r.provider_id,
      externalRef: r.external_ref,
      orderRef: r.order_ref,
      amountMinor: r.amount_minor,
      currency: r.currency,
      description: r.description,
      status: r.status,
      customerEmail: r.customer_email,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      completedAt: r.completed_at,
      metadata: r.metadata
    })),
    nextCursor
  });
}
