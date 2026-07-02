// GET /api/trade-off/orders/export.csv?slug=…&token=… — CSV export.
// Returns every order for the listing as text/csv. edit_token gated.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") ?? "";
  const token = url.searchParams.get("token") ?? "";
  if (!slug || !token) {
    return new Response("missing_fields", { status: 400 });
  }
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing.data) return new Response("listing_not_found", { status: 404 });
  if (listing.data.edit_token !== token) {
    return new Response("bad_token", { status: 403 });
  }

  const orders = await supabaseAdmin
    .from("hammerex_xrated_orders")
    .select(
      "order_ref, amount_pence, currency, provider, status, customer_email, customer_name, created_at, paid_at, fulfilled_at, note"
    )
    .eq("listing_id", listing.data.id)
    .order("created_at", { ascending: false })
    .limit(5000);

  const rows = orders.data ?? [];
  const header = [
    "order_ref",
    "amount_gbp",
    "currency",
    "provider",
    "status",
    "customer_name",
    "customer_email",
    "created_at",
    "paid_at",
    "fulfilled_at",
    "note"
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.order_ref),
        (Number(r.amount_pence) / 100).toFixed(2),
        csvEscape(r.currency),
        csvEscape(r.provider),
        csvEscape(r.status),
        csvEscape(r.customer_name),
        csvEscape(r.customer_email),
        csvEscape(r.created_at),
        csvEscape(r.paid_at),
        csvEscape(r.fulfilled_at),
        csvEscape(r.note)
      ].join(",")
    );
  }
  const csv = lines.join("\n");
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${slug}.csv"`
    }
  });
}
