// POST /api/plant-hire/bookings/lookup — phone-based lookup for the
// customer portal. Returns bookings + reports for a phone number
// (scoped to a single merchant so cross-merchant privacy is preserved).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Body = { listing_slug: string; phone: string };

function normalisePhone(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const phone = normalisePhone(body.phone ?? "");
  if (!body.listing_slug || phone.length < 6) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id")
    .eq("slug", body.listing_slug)
    .maybeSingle();
  if (!listing.data) {
    return NextResponse.json({ error: "listing_not_found" }, { status: 404 });
  }

  // Match any customer_phone that normalises to the same digits.
  const bookings = await supabaseAdmin
    .from("hammerex_plant_hire_bookings")
    .select(
      "id, reference, machine_slug, machine_label, duration, quantity, wet_hire, date_from, date_to, delivery_postcode, subtotal_pence, deposit_pence, deposit_status, hire_status, created_at, customer_phone"
    )
    .eq("listing_id", listing.data.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (bookings.error) {
    return NextResponse.json({ error: bookings.error.message }, { status: 500 });
  }

  const matched = (bookings.data ?? []).filter(
    (b: { customer_phone: string }) => normalisePhone(b.customer_phone) === phone
  );

  const bookingIds = matched.map((b: { id: string }) => b.id);
  let reports: Array<Record<string, unknown>> = [];
  if (bookingIds.length > 0) {
    const rres = await supabaseAdmin
      .from("hammerex_plant_hire_reports")
      .select("*")
      .in("booking_id", bookingIds)
      .order("created_at", { ascending: false });
    reports = rres.data ?? [];
  }
  // Also allow reports that reference the same phone but no booking link.
  const orphanReports = await supabaseAdmin
    .from("hammerex_plant_hire_reports")
    .select("*")
    .eq("listing_id", listing.data.id)
    .is("booking_id", null)
    .order("created_at", { ascending: false })
    .limit(50);
  reports = [
    ...reports,
    ...((orphanReports.data ?? []).filter(
      (r: { reporter_phone: string }) => normalisePhone(r.reporter_phone) === phone
    ) as Array<Record<string, unknown>>)
  ];

  return NextResponse.json({
    ok: true,
    bookings: matched,
    reports
  });
}
