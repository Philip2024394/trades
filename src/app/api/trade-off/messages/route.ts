// POST /api/trade-off/messages
// Public endpoint for the premium-tier ContactFormPanel. Validates the
// payload, hashes the client IP (SHA-256 first 16 hex), and inserts a
// row into hammerex_trade_off_messages. Best-effort: any failure logs
// server-side but never leaks DB internals to the customer.

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const listing_id = s(body.listing_id);
  const sender_name = s(body.sender_name);
  const sender_email = s(body.sender_email);
  const sender_phone = s(body.sender_phone);
  const message = s(body.message);
  const postcode = s(body.postcode).toUpperCase().replace(/\s+/g, " ");
  const project_type = s(body.project_type);
  const project_stage = s(body.project_stage);
  const earliest_start = s(body.earliest_start);
  const photo_urls = Array.isArray(body.photo_urls)
    ? body.photo_urls
        .filter((u: unknown): u is string => typeof u === "string")
        .slice(0, 6)
    : [];

  const PROJECT_TYPES = new Set(["new_build", "renovation", "repair"]);
  const PROJECT_STAGES = new Set([
    "ready_to_book",
    "comparing_quotes",
    "just_researching"
  ]);
  // UK postcode — partial-format permissive, must contain at least
  // one digit and one letter so "1234" and "ABCD" don't sneak through.
  const UK_POSTCODE_RE = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/;

  if (!listing_id) {
    return NextResponse.json(
      { ok: false, error: "Missing listing id." },
      { status: 400 }
    );
  }
  if (sender_name.length < 2 || sender_name.length > 80) {
    return NextResponse.json(
      { ok: false, error: "Name must be 2–80 characters." },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(sender_email) || sender_email.length > 120) {
    return NextResponse.json(
      { ok: false, error: "Please enter a valid email." },
      { status: 400 }
    );
  }
  if (message.length < 50 || message.length > 500) {
    return NextResponse.json(
      { ok: false, error: "Message must be 50–500 characters." },
      { status: 400 }
    );
  }
  if (postcode && !UK_POSTCODE_RE.test(postcode)) {
    return NextResponse.json(
      { ok: false, error: "Please enter a valid UK postcode." },
      { status: 400 }
    );
  }
  if (project_type && !PROJECT_TYPES.has(project_type)) {
    return NextResponse.json(
      { ok: false, error: "Invalid project type." },
      { status: 400 }
    );
  }
  if (project_stage && !PROJECT_STAGES.has(project_stage)) {
    return NextResponse.json(
      { ok: false, error: "Invalid project stage." },
      { status: 400 }
    );
  }

  // Cheap existence check — also guards against random UUID spam.
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, contact_form_enabled, status")
    .eq("id", listing_id)
    .maybeSingle();
  if (!listing.data) {
    return NextResponse.json(
      { ok: false, error: "Listing not found." },
      { status: 404 }
    );
  }
  if (listing.data.status !== "live" || !listing.data.contact_form_enabled) {
    return NextResponse.json(
      { ok: false, error: "Contact form is not active for this listing." },
      { status: 403 }
    );
  }

  const ip = clientIp(req);
  const ip_hash = ip ? hashIp(ip) : null;

  const insert = await supabaseAdmin
    .from("hammerex_trade_off_messages")
    .insert({
      listing_id,
      sender_name,
      sender_email,
      sender_phone: sender_phone || null,
      message,
      ip_hash,
      postcode: postcode || null,
      project_type: project_type || null,
      project_stage: project_stage || null,
      earliest_start: earliest_start || null,
      photo_urls
    })
    .select("id")
    .maybeSingle();

  if (insert.error || !insert.data) {
    console.error("[trade-off/messages] insert failed:", insert.error);
    return NextResponse.json(
      { ok: false, error: "Could not send your message — try again later." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: insert.data.id });
}
