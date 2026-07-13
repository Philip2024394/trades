// GET /api/signup/slug-check?slug=<candidate>
//
// Returns whether a proposed vanity slug is available for a new
// signup. Used by the client-side useSlugAvailability hook to give
// live feedback as the tradie types their preferred URL — Shopify-
// grade micro-interaction that lands the "you own something" moment
// in the first 20 seconds of signup.
//
// Contract:
//   200 { available: true }
//   200 { available: false, reason: "taken" | "invalid" | "reserved" | "too-short" | "too-long" }

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Slugs shorter than 3 chars are noise; longer than 40 chars won't fit
// well in URL preview UI or on business cards.
const MIN_LEN = 3;
const MAX_LEN = 40;

// Reserved: platform paths and generic terms. Never issue these as
// vanity slugs regardless of DB state — they'd conflict with the
// routing tree or read as squatting.
const RESERVED = new Set([
  "admin", "api", "app", "auth", "billing", "cart", "checkout",
  "contact", "dashboard", "faq", "help", "home", "index", "info",
  "login", "logout", "network", "pricing", "privacy", "profile",
  "search", "settings", "signup", "signin", "shop", "store", "support",
  "system", "terms", "trade", "trade-center", "trade-off", "user",
  "www", "xrated", "xratedtrade", "theconstruction", "construction"
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = (url.searchParams.get("slug") ?? "").trim().toLowerCase();

  if (raw.length === 0) {
    return NextResponse.json({ available: false, reason: "invalid" as const });
  }
  if (raw.length < MIN_LEN) {
    return NextResponse.json({ available: false, reason: "too-short" as const });
  }
  if (raw.length > MAX_LEN) {
    return NextResponse.json({ available: false, reason: "too-long" as const });
  }
  if (!SLUG_PATTERN.test(raw)) {
    return NextResponse.json({ available: false, reason: "invalid" as const });
  }
  if (RESERVED.has(raw)) {
    return NextResponse.json({ available: false, reason: "reserved" as const });
  }

  const { data, error } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id")
    .eq("slug", raw)
    .maybeSingle();

  if (error) {
    // Fail open on transient DB errors — the create endpoint does
    // its own collision check on submit, so a false positive here is
    // recoverable (the create flow just falls back to an auto-slug).
    return NextResponse.json({ available: true });
  }

  if (data) {
    return NextResponse.json({ available: false, reason: "taken" as const });
  }
  return NextResponse.json({ available: true });
}
