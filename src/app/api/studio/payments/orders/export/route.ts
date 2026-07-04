// CSV export of orders — merchant reconciliation.
//
//   GET /api/studio/payments/orders/export
//     ?status=paid|failed|pending|all
//     ?provider=stripe|paypal|…|all
//     ?from=2026-01-01
//     ?to=2026-12-31
//   → text/csv attachment with columns matching accountant expectations.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const CSV_COLUMNS = [
  "order_id",
  "created_at",
  "completed_at",
  "provider",
  "external_ref",
  "order_ref",
  "amount_major",
  "currency",
  "status",
  "customer_email",
  "description"
];

/** RFC 4180 CSV cell escaping. */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

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
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let query = supabaseAdmin
    .from("studio_payment_orders")
    .select(
      "id, provider_id, external_ref, order_ref, amount_minor, currency, description, status, customer_email, created_at, completed_at"
    )
    .eq("brand_id", session.brand.id)
    .order("created_at", { ascending: false })
    .limit(10_000); // hard cap so a runaway export doesn't burn resources
  if (status !== "all") query = query.eq("status", status);
  if (provider !== "all") query = query.eq("provider_id", provider);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const res = await query;
  if (res.error) {
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }

  const header = CSV_COLUMNS.join(",");
  const lines = (res.data ?? []).map((r) => {
    const amountMajor = ((r.amount_minor ?? 0) / 100).toFixed(2);
    return [
      csvCell(r.id),
      csvCell(r.created_at),
      csvCell(r.completed_at),
      csvCell(r.provider_id),
      csvCell(r.external_ref),
      csvCell(r.order_ref),
      csvCell(amountMajor),
      csvCell(r.currency),
      csvCell(r.status),
      csvCell(r.customer_email),
      csvCell(r.description)
    ].join(",");
  });
  const csv = [header, ...lines].join("\r\n") + "\r\n";

  const today = new Date().toISOString().slice(0, 10);
  const filename = `payment-orders-${session.brand.slug}-${today}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
}
