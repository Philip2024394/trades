// POST /api/plant-hire/reports — persists a delivery-evidence or
// damage-inspection report. Linked to a booking by reference when
// provided; otherwise stored as a standalone report.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Body = {
  listing_slug: string;
  kind: "delivery_evidence" | "damage_pre" | "damage_post";
  hire_reference?: string;
  machine_slug?: string;
  machine_label?: string;
  photo_urls?: string[];
  signature_url?: string;
  hour_meter?: number;
  fuel_percent?: number;
  damage_location?: string;
  damage_severity?: string;
  damage_description?: string;
  phase?: string;
  reporter_name: string;
  reporter_phone: string;
  reporter_email?: string;
  notes?: string;
};

function s(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    !body.listing_slug ||
    !["delivery_evidence", "damage_pre", "damage_post"].includes(body.kind) ||
    !body.reporter_name ||
    !body.reporter_phone
  ) {
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

  let bookingId: string | null = null;
  if (body.hire_reference) {
    const b = await supabaseAdmin
      .from("hammerex_plant_hire_bookings")
      .select("id")
      .eq("reference", s(body.hire_reference, 40))
      .maybeSingle();
    if (b.data) bookingId = b.data.id;
  }

  const photos = Array.isArray(body.photo_urls)
    ? body.photo_urls
        .map((u) => s(u, 800))
        .filter((u) => /^https?:\/\//i.test(u))
        .slice(0, 20)
    : [];

  const insert = await supabaseAdmin
    .from("hammerex_plant_hire_reports")
    .insert({
      booking_id: bookingId,
      listing_id: listing.data.id,
      kind: body.kind,
      hire_reference: s(body.hire_reference, 40),
      machine_slug: s(body.machine_slug, 40),
      machine_label: s(body.machine_label, 120),
      photo_urls: photos,
      signature_url: s(body.signature_url, 800),
      hour_meter:
        typeof body.hour_meter === "number" && Number.isFinite(body.hour_meter)
          ? body.hour_meter
          : null,
      fuel_percent:
        typeof body.fuel_percent === "number" && Number.isFinite(body.fuel_percent)
          ? Math.max(0, Math.min(100, Math.round(body.fuel_percent)))
          : null,
      damage_location: s(body.damage_location, 100),
      damage_severity: s(body.damage_severity, 40),
      damage_description: s(body.damage_description, 2000),
      phase: s(body.phase, 20),
      reporter_name: s(body.reporter_name, 120),
      reporter_phone: s(body.reporter_phone, 30),
      reporter_email: s(body.reporter_email, 200),
      notes: s(body.notes, 1000)
    })
    .select("id")
    .single();

  if (insert.error) {
    return NextResponse.json({ error: insert.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: insert.data.id });
}
