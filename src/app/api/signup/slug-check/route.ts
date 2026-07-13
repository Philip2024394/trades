// GET /api/signup/slug-check?slug=<candidate>
//
// Returns whether a proposed vanity slug is available for a new
// signup. Used by the client-side useSlugAvailability hook to give
// live feedback as the tradie types their preferred URL — Shopify-
// grade micro-interaction that lands the "you own something" moment
// in the first 20 seconds of signup.
//
// Anti-squatting rules — 2026-07-13 hardening:
//   1. System / platform paths blocked (admin, api, etc)
//   2. Generic trade categories blocked as single words ("kitchens",
//      "electrician") — merchants must include their business name
//   3. UK cities / regions blocked as single words ("london",
//      "manchester") — location alone is squatter bait
//   4. Marketing qualifier words blocked ("best", "cheap", "top",
//      "verified") — even as prefixes ("best-*", "top-*")
//   5. Compound slugs where every part is reserved → blocked
//      (e.g. "kitchens-london" = trade + city = squatter play)
//
// Slug policy:
//   - Free tier: slug held while merchant logs in at least once
//     every 30 days. Otherwise released back to the pool.
//   - Paid tier: slug reserved for life while subscription active.
//
// Contract:
//   200 { available: true }
//   200 { available: false, reason: "taken" | "invalid" | "reserved" |
//         "too-short" | "too-long" | "reserved-trade" | "reserved-city" |
//         "reserved-qualifier" }

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const MIN_LEN = 3;
const MAX_LEN = 40;

// System / platform paths — conflict with routing or read as fake.
const RESERVED_SYSTEM = new Set([
  "admin", "api", "app", "apps", "auth", "billing", "cart", "checkout",
  "contact", "dashboard", "docs", "faq", "help", "home", "index", "info",
  "join", "login", "logout", "network", "networkers", "pricing", "privacy",
  "profile", "register", "search", "settings", "signup", "signin", "shop",
  "store", "support", "system", "terms", "thenetworkers", "trade",
  "trade-center", "trade-off", "user", "verified", "www", "yard",
  "xrated", "xratedtrade", "theconstruction", "construction", "packages",
  "canteen", "marketplace", "ultimate", "free"
]);

// Trade categories — merchants must include their business name.
// Blocks pure "kitchens" or "electrician" registrations.
const RESERVED_TRADES = new Set([
  // Building trades
  "builder", "builders", "bricklayer", "bricklayers", "carpenter",
  "carpenters", "joiner", "joiners", "plasterer", "plasterers",
  "roofer", "roofers", "scaffolder", "scaffolders", "steelworker",
  "steelworkers",
  // Fitting trades
  "kitchen", "kitchens", "kitchen-fitter", "kitchen-fitters",
  "bathroom", "bathrooms", "bathroom-fitter", "bathroom-fitters",
  "flooring", "floorer", "floorers", "tiler", "tilers", "carpet",
  "carpets", "carpet-fitter", "carpet-fitters",
  // Services / MEP
  "electrician", "electricians", "sparky", "sparkies", "plumber",
  "plumbers", "gasengineer", "gas-engineer", "gas-engineers", "heating",
  "heating-engineer", "boiler", "boilers", "boiler-engineer",
  // Exterior / land
  "landscaper", "landscapers", "landscaping", "gardener", "gardeners",
  "fencer", "fencers", "fencing", "decking", "driveway", "driveways",
  "paving", "patio", "patios", "conservatory", "conservatories",
  // Finish
  "painter", "painters", "painter-decorator", "painters-decorators",
  "decorator", "decorators", "wallpaper", "paint",
  // Speciality
  "handyman", "handymen", "cleaner", "cleaners", "cleaning",
  "locksmith", "locksmiths", "welder", "welders", "welding",
  "glazier", "glaziers", "glazing", "windows", "double-glazing",
  "windows-doors", "doors", "garage", "garages", "garage-door",
  "garage-doors",
  // Skips / plant
  "skip", "skips", "skip-hire", "plant-hire", "digger", "diggers",
  "excavator", "excavators", "haulage", "removals",
  // Trades meta
  "trades", "tradesperson", "tradesmen", "tradeswomen", "trader",
  "traders", "contractor", "contractors", "professional", "professionals"
]);

// Major UK cities / regions — location squatting is a common tactic.
// Not exhaustive; blocks the top ~60 population centres + all UK
// countries and major regions.
const RESERVED_CITIES = new Set([
  // Countries + regions
  "uk", "england", "scotland", "wales", "northern-ireland",
  "north", "south", "east", "west", "midlands", "north-east",
  "north-west", "south-east", "south-west", "east-midlands",
  "west-midlands", "yorkshire",
  // Major cities
  "london", "birmingham", "manchester", "liverpool", "leeds",
  "sheffield", "bristol", "newcastle", "nottingham", "leicester",
  "coventry", "hull", "stoke", "sunderland", "wolverhampton",
  "plymouth", "derby", "southampton", "portsmouth", "brighton",
  "bournemouth", "reading", "oxford", "cambridge", "cardiff",
  "swansea", "edinburgh", "glasgow", "aberdeen", "dundee",
  "belfast", "york", "bath", "canterbury", "chester", "durham",
  "exeter", "gloucester", "hereford", "lancaster", "lincoln",
  "norwich", "peterborough", "salisbury", "st-albans", "truro",
  "winchester", "worcester", "carlisle",
  // London boroughs (common squats)
  "camden", "islington", "shoreditch", "hackney", "westminster",
  "chelsea", "kensington", "greenwich", "wimbledon", "croydon",
  "bromley", "richmond", "clapham", "brixton", "hammersmith"
]);

// Marketing qualifier words — squatter bait for "cheap-plumber"
// and "best-electrician". Blocked both as exact single words AND
// as prefixes ("best-*", "top-*", etc).
const RESERVED_QUALIFIERS = new Set([
  "best", "top", "cheap", "cheapest", "affordable", "budget",
  "pro", "premium", "elite", "official", "certified", "approved",
  "trusted", "verified", "expert", "experts", "reliable", "quality",
  "professional", "professionals", "local", "nearby", "24-hour",
  "24hr", "emergency", "urgent", "fast", "quick", "same-day"
]);

// Merge everything for the fast-path check.
const RESERVED_ALL = new Set([
  ...RESERVED_SYSTEM,
  ...RESERVED_TRADES,
  ...RESERVED_CITIES,
  ...RESERVED_QUALIFIERS
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

  // Single-word exact match against the full reserved set.
  if (RESERVED_ALL.has(raw)) {
    if (RESERVED_TRADES.has(raw)) {
      return NextResponse.json({ available: false, reason: "reserved-trade" as const });
    }
    if (RESERVED_CITIES.has(raw)) {
      return NextResponse.json({ available: false, reason: "reserved-city" as const });
    }
    if (RESERVED_QUALIFIERS.has(raw)) {
      return NextResponse.json({ available: false, reason: "reserved-qualifier" as const });
    }
    return NextResponse.json({ available: false, reason: "reserved" as const });
  }

  // Qualifier prefix — "best-plumber", "cheap-electrician" etc.
  // Squatters love this pattern; block the whole prefix class.
  const parts = raw.split("-");
  if (parts.length > 1 && RESERVED_QUALIFIERS.has(parts[0])) {
    return NextResponse.json({ available: false, reason: "reserved-qualifier" as const });
  }

  // Compound slug where every part is reserved — e.g. "kitchens-london"
  // is trade + city with no business name = squatter play.
  if (parts.length >= 2 && parts.every((p) => RESERVED_ALL.has(p))) {
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
