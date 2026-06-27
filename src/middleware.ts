// Xrated Trades — host-routing middleware for the Custom Domain add-on.
//
// On every non-system, non-static request we look at the incoming
// `Host` header. If it matches a row in hammerex_trade_off_listings
// where custom_domain_status='live', we INTERNALLY rewrite the request
// to `/<slug>` (the existing public profile route) — the URL bar still
// reads the tradesperson's own domain.
//
// Why not use Next.js rewrites in next.config.mjs: those rewrites are
// static at build time. Custom domains are tenant-data — we need a DB
// lookup per request, which middleware lets us do at the edge.
//
// The DB query is fast because the migration adds a partial UNIQUE
// index on (custom_domain) WHERE custom_domain_status='live'. Index
// size = number of live custom domains, not the whole listings table.
//
// SYSTEM_HOSTS lets the Xrated marketing site, localhost dev, and the
// vercel.app preview URL bypass the rewrite. Anything not in the set
// is treated as a tenant domain candidate.
//
// www → apex normalisation happens inside the lookup: we strip a
// leading "www." before querying, AND we attached the apex form to
// Vercel as the canonical domain, so the customer's own www DNS hits
// land on the right row regardless of which form is the "primary".

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Lowercased hosts that bypass the host-router. Keep in sync with
// the Vercel project's primary + preview domains.
const SYSTEM_HOSTS = new Set<string>([
  "xratedtrade.com",
  "www.xratedtrade.com",
  "localhost",
  "trades-philip2024394.vercel.app"
]);

// Static asset and API prefixes never need the rewrite. We also let
// the matcher below exclude these for free, but the explicit check
// here keeps the middleware bullet-proof against future matcher edits.
const BYPASS_PATH_PREFIXES = ["/_next/", "/api/", "/favicon"];

export const config = {
  // Skip Next.js internals, API routes, and favicons. Everything else
  // gets the host check.
  matcher: ["/((?!_next/|api/|favicon).*)"]
};

export async function middleware(req: NextRequest): Promise<NextResponse> {
  // Bypass for static and API paths.
  const pathname = req.nextUrl.pathname;
  for (const prefix of BYPASS_PATH_PREFIXES) {
    if (pathname.startsWith(prefix)) return NextResponse.next();
  }

  const rawHost = req.headers.get("host") ?? "";
  const host = rawHost.toLowerCase().replace(/:\d+$/, "");
  if (!host || SYSTEM_HOSTS.has(host)) return NextResponse.next();

  // *.vercel.app preview hosts also bypass — they're system, just
  // dynamically named by Vercel.
  if (host.endsWith(".vercel.app")) return NextResponse.next();

  // Strip leading www. so the partial UNIQUE index matches either form.
  // We attach both at Vercel, but only store the apex in the DB row.
  const candidates = host.startsWith("www.")
    ? [host, host.slice(4)]
    : [host, `www.${host}`];

  // Lazy-init Supabase. Middleware runs on the Edge runtime by default
  // and cold-starts often; the client is cheap to create per request.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.next();

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // Partial index on (custom_domain) WHERE custom_domain_status='live'
  // makes this lookup O(log n) over the live-domains-only subset.
  const { data } = await supabase
    .from("hammerex_trade_off_listings")
    .select("slug, custom_domain")
    .in("custom_domain", candidates)
    .eq("custom_domain_status", "live")
    .limit(1)
    .maybeSingle();

  if (!data || !data.slug) return NextResponse.next();

  // Rewrite the request to /<slug>/<rest>. The marketing site's
  // afterFiles rewrites in next.config.mjs further point /<slug> at
  // /trade/<slug>, so the existing public profile renderer takes over
  // with no extra code change.
  const url2 = req.nextUrl.clone();
  url2.pathname =
    pathname === "/" ? `/${data.slug}` : `/${data.slug}${pathname}`;
  return NextResponse.rewrite(url2);
}
