import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Body = { slug: string; token: string; order_id: string; fulfilled: boolean };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.slug || !body.token || !body.order_id) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const row = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", body.slug)
    .maybeSingle();
  if (!row.data) return NextResponse.json({ error: "listing_not_found" }, { status: 404 });
  if (row.data.edit_token !== body.token) {
    return NextResponse.json({ error: "bad_token" }, { status: 403 });
  }
  const fulfilledAt = body.fulfilled ? new Date().toISOString() : null;
  const upd = await supabaseAdmin
    .from("hammerex_xrated_orders")
    .update({ fulfilled_at: fulfilledAt })
    .eq("id", body.order_id)
    .eq("listing_id", row.data.id)
    .select("fulfilled_at")
    .single();
  if (upd.error) {
    return NextResponse.json({ error: upd.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, fulfilled_at: upd.data.fulfilled_at });
}
