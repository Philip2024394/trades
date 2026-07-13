// GET /api/trade-off/newsletter/export?slug=<slug>&token=<edit_token>
// Magic-link authenticated. Streams a CSV of the listing's currently-
// active newsletter subscribers. Includes the per-subscriber
// unsubscribe URL so the merchant can paste it into every email
// (PECR requires a working unsubscribe link in every marketing email).
//
// Columns: email, consent_at, subscribed_via, unsubscribe_url.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { absolute } from "@/lib/seo";

export const runtime = "nodejs";

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// Excel-safe CSV cell escape. Doubles internal quotes; wraps a cell
// in quotes when it contains commas / quotes / newlines. Also defends
// against CSV-injection by prefixing leading =/+/-/@ with a single
// quote (Excel formula evaluation gate).
function csvCell(value: string): string {
  let v = value;
  if (/^[=+\-@]/.test(v)) v = `'${v}`;
  const needsQuotes = /[",\r\n]/.test(v);
  const escaped = v.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = s(url.searchParams.get("slug"));
  const token = s(url.searchParams.get("token"));

  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or token." },
      { status: 400 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, edit_token, display_name")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing.data) {
    return NextResponse.json(
      { ok: false, error: "Listing not found." },
      { status: 404 }
    );
  }
  if (!constantTimeEq(listing.data.edit_token, token)) {
    return NextResponse.json(
      { ok: false, error: "Invalid edit token." },
      { status: 403 }
    );
  }

  const rows = await supabaseAdmin
    .from("hammerex_xrated_newsletter_subscribers")
    .select("email, consent_at, unsubscribe_token")
    .eq("listing_id", listing.data.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(10_000);
  if (rows.error) {
    console.error("[newsletter/export] select failed:", rows.error);
    return NextResponse.json(
      { ok: false, error: rows.error.message },
      { status: 500 }
    );
  }

  const subscribedVia = `thenetworkers.app/${listing.data.slug}`;
  const header = ["email", "consent_at", "subscribed_via", "unsubscribe_url"]
    .map(csvCell)
    .join(",");
  const lines = (rows.data ?? []).map((r) => {
    const unsub = absolute(`/newsletter/unsubscribe/${r.unsubscribe_token}`);
    return [
      csvCell(r.email),
      csvCell(r.consent_at),
      csvCell(subscribedVia),
      csvCell(unsub)
    ].join(",");
  });
  // BOM so Excel opens UTF-8 cleanly; CRLF newlines for Excel/Windows.
  const csv = "﻿" + [header, ...lines].join("\r\n") + "\r\n";

  const today = new Date().toISOString().slice(0, 10);
  const filename = `${listing.data.slug}-newsletter-${today}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
}
