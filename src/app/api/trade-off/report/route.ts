// POST /api/trade-off/report
// Public abuse-report endpoint. Body: { listing_id, reason }.
// The DB trigger bumps report_count and auto-hides the listing at 3 reports,
// so this route stays simple — insert + return ok.
//
// Dedupe: if the same reporter_ip already reported this listing in the last
// hour, we no-op so a refresh-spam can't trip the auto-hide on its own.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const listingId = typeof body.listing_id === "string" ? body.listing_id.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 800) : "";

  if (!listingId) {
    return NextResponse.json({ ok: false, error: "Missing listing_id." }, { status: 400 });
  }

  // Validate the listing exists (defends against random uuid spam).
  const target = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id")
    .eq("id", listingId)
    .maybeSingle();
  if (!target.data) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }

  const ip = clientIp(req);
  if (ip) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const dupe = await supabaseAdmin
      .from("hammerex_trade_off_reports")
      .select("id")
      .eq("listing_id", listingId)
      .eq("reporter_ip", ip)
      .gte("created_at", oneHourAgo)
      .limit(1)
      .maybeSingle();
    if (dupe.data) {
      return NextResponse.json({ ok: true, deduped: true });
    }
  }

  const insert = await supabaseAdmin
    .from("hammerex_trade_off_reports")
    .insert({
      listing_id: listingId,
      reason: reason || null,
      reporter_ip: ip
    })
    .select("id")
    .maybeSingle();

  if (insert.error) {
    console.error("[trade-off/report] insert failed:", insert.error);
    return NextResponse.json(
      { ok: false, error: insert.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
