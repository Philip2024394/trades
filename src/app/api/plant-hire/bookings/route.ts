// POST /api/plant-hire/bookings — creates a booking row from the wizard
// submission. Returns { id, reference } so the client can then either
// (a) redirect to /plant-hire/pay?booking=<ref> if the merchant has
// Stripe wired, or (b) open a WhatsApp deep-link with the reference in
// the message.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Body = {
  listing_slug: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  machine_slug: string;
  machine_label?: string;
  duration: "day" | "week" | "month";
  quantity: number;
  wet_hire?: boolean;
  date_from?: string;
  date_to?: string;
  delivery_postcode?: string;
  site_address?: string;
  attachments?: string;
  notes?: string;
  subtotal_pence?: number;
  deposit_pence?: number;
};

function s(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function n(v: unknown): number | null {
  const num = Number(v);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num);
}

function buildReference(listingPrefix: string): string {
  const year = new Date().getFullYear();
  const rnd = Math.floor(10000 + Math.random() * 90000);
  return `${listingPrefix}-${year}-${rnd}`;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.listing_slug || !body.customer_name || !body.customer_phone || !body.machine_slug) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, display_name, slug")
    .eq("slug", body.listing_slug)
    .maybeSingle();
  if (!listing.data) {
    return NextResponse.json({ error: "listing_not_found" }, { status: 404 });
  }

  const prefix = (listing.data.display_name ?? listing.data.slug ?? "PH")
    .split(" ")
    .map((p: string) => p[0] ?? "")
    .join("")
    .slice(0, 4)
    .toUpperCase()
    .replace(/[^A-Z]/g, "") || "PH";
  const reference = buildReference(prefix);

  const insertRes = await supabaseAdmin
    .from("hammerex_plant_hire_bookings")
    .insert({
      listing_id: listing.data.id,
      reference,
      customer_name: s(body.customer_name, 120),
      customer_phone: s(body.customer_phone, 30),
      customer_email: s(body.customer_email, 200),
      machine_slug: s(body.machine_slug, 40),
      machine_label: s(body.machine_label, 120),
      duration: ["day", "week", "month"].includes(body.duration) ? body.duration : "day",
      quantity: Math.max(1, Math.min(99, Math.round(Number(body.quantity) || 1))),
      wet_hire: body.wet_hire === true,
      date_from: body.date_from && /^\d{4}-\d{2}-\d{2}$/.test(body.date_from) ? body.date_from : null,
      date_to: body.date_to && /^\d{4}-\d{2}-\d{2}$/.test(body.date_to) ? body.date_to : null,
      delivery_postcode: s(body.delivery_postcode, 12).toUpperCase(),
      site_address: s(body.site_address, 300),
      attachments: s(body.attachments, 300),
      notes: s(body.notes, 1000),
      subtotal_pence: n(body.subtotal_pence),
      deposit_pence: n(body.deposit_pence),
      deposit_status: "pending",
      hire_status: "requested"
    })
    .select("id, reference")
    .single();

  if (insertRes.error) {
    return NextResponse.json({ error: insertRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: insertRes.data.id,
    reference: insertRes.data.reference
  });
}
