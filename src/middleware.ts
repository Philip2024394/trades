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

// ── W-OBS-1 Path A Layer 1 · CID injection ──────────────────────────
//
// Middleware runs in Edge runtime · AsyncLocalStorage is NOT available
// here. The middleware's role is limited to guaranteeing an
// `x-request-id` header on every page response so client-side error
// reports can be correlated to server logs. Route handlers under
// `/api/*` (which the middleware matcher excludes) handle their own
// CID lifecycle via `runFromRequest` in the Node runtime.
//
// CID_PATTERN is inlined here (not imported from ./lib/nex/observability/
// correlation) because Edge runtime cannot resolve node:async_hooks
// transitively even for the un-used code path. The regex is identical.

const CID_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

function resolveCorrelationId(req: NextRequest): string {
  const inbound = req.headers.get("x-request-id");
  if (typeof inbound === "string" && CID_PATTERN.test(inbound)) {
    // Page-request trust rule: adopt inbound if format-valid.
    // (API-route trust matrix lives in runFromRequest for /api/*.)
    return inbound;
  }
  return crypto.randomUUID();
}

function attachCid<T extends NextResponse>(res: T, cid: string): T {
  res.headers.set("x-request-id", cid);
  return res;
}

// Lowercased hosts that bypass the host-router. Keep in sync with
// the Vercel project's primary + preview domains.
const SYSTEM_HOSTS = new Set<string>([
  "thenetworkers.app",
  "www.thenetworkers.app",
  "localhost",
  "trades-philip2024394.vercel.app"
]);

// Root domains under which subdomains resolve to trade profiles.
// bobs-plumbing.thenetworkers.app → /trade/bobs-plumbing.
const SUBDOMAIN_ROOTS = ["thenetworkers.app"];

// Reserved subdomains that must NOT be treated as trade slugs — these
// are our own subdomains for admin / API / marketing surfaces.
const RESERVED_SUBDOMAINS = new Set<string>([
  "www",
  "api",
  "admin",
  "app",
  "cdn",
  "static",
  "docs",
  "mail",
  "help",
  "blog",
  "assets"
]);

// Slug validator — matches the DB slug shape (lowercase kebab, no dots).
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

// Static asset and API prefixes never need the rewrite. We also let
// the matcher below exclude these for free, but the explicit check
// here keeps the middleware bullet-proof against future matcher edits.
const BYPASS_PATH_PREFIXES = ["/_next/", "/api/", "/favicon"];

// ------------------------------------------------------------------
// LEGACY MARKETPLACE REDIRECTS (Philip 2026-07-27)
// ------------------------------------------------------------------
// /nex-app/centre is the SINGLE marketplace surface. Every prior
// marketplace-adjacent route redirects to it so there is one place
// customers see merchant + trade posts.
//
// 302 (temporary) initially — promote to 301 once we are certain
// nothing else in the app links back to the retired paths. The
// underlying tradecenter app code + APIs + data pipeline are LEFT
// IN PLACE so /nex-app/centre can continue to pull the same data;
// only the customer-facing routes are redirected.
//
// NOT redirected (merchant-editing surfaces, replaced by the future
// Merchant Assistant in Phase 7):
//   - /trade-off/trade-center
//   - /trade-off/edit/[slug]/trade-center-picks
//   - /trade/[slug]/trade-center-picks
//   - /api/trade-off/trade-center-picks/*
// ------------------------------------------------------------------
const LEGACY_MARKETPLACE_PREFIXES = [
  "/tc/trade-center",
  "/tc/trade-counter"
];
const MARKETPLACE_CANONICAL_PATH = "/nex-app/centre";

// Affiliate cookie carries the numeric affiliate_id for 30 days.
const AFFILIATE_REF_COOKIE = "xrated_affiliate_ref";
const AFFILIATE_REF_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const ADMIN_PATH_PREFIXES = ["/admin", "/api/"];

// Merchant-to-merchant referral cookie carries the referrer slug for
// 30 days. Coexists with the affiliate cookie — same visitor can carry
// both. Signup path reads this cookie to attribute new listings back
// to the referring merchant.
const MREF_COOKIE = "tn_mref";
const MREF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const MREF_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export const config = {
  // Skip Next.js internals, API routes, and favicons. Everything else
  // gets the host check.
  matcher: ["/((?!_next/|api/|favicon).*)"]
};

/**
 * Set the affiliate cookie + fire a tracking request when ?ref=N is
 * present and valid. The fetch is fire-and-forget — we never await it
 * with the user blocked. Returns the response (with cookie set) when
 * we want to update the response, or null when no ref was found.
 */
function applyAffiliateRef(
  req: NextRequest,
  response: NextResponse
): NextResponse {
  const ref = req.nextUrl.searchParams.get("ref");
  const pathname = req.nextUrl.pathname;

  // Skip admin and api paths.
  for (const prefix of ADMIN_PATH_PREFIXES) {
    if (pathname.startsWith(prefix)) return response;
  }

  if (!ref) return response;

  const refId = Number(ref);
  if (!Number.isFinite(refId) || refId <= 0) return response;

  // Set the 30-day cookie. We don't validate the affiliate exists here
  // (would require a DB round-trip on every request) — the track-click
  // endpoint validates before insertion, and the listing-create stamp
  // also re-validates before writing affiliate_referrer_id.
  response.cookies.set(AFFILIATE_REF_COOKIE, String(refId), {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AFFILIATE_REF_MAX_AGE
  });

  // Fire-and-forget click log. We use a same-origin fetch to our own
  // tracking endpoint — no waitUntil needed, the request runs to
  // completion in the background after the response is sent.
  const trackUrl = new URL("/api/affiliates/track-click", req.nextUrl.origin);
  fetch(trackUrl.toString(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": req.headers.get("user-agent") ?? "",
      "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "",
      "cf-ipcountry": req.headers.get("cf-ipcountry") ?? "",
      "x-vercel-ip-country": req.headers.get("x-vercel-ip-country") ?? ""
    },
    body: JSON.stringify({
      affiliate_id: refId,
      landing_page: pathname,
      referrer_url: req.headers.get("referer") ?? null,
      country:
        req.headers.get("cf-ipcountry") ??
        req.headers.get("x-vercel-ip-country") ??
        null
    })
  }).catch(() => {
    // Swallow — never block the user request on a tracking failure.
  });

  return response;
}

/** Merchant-to-merchant referral cookie. Distinct from the affiliate
 *  ref above — same visitor can carry both. Slug (string) not integer.
 *  Validation is cheap regex-only here; the signup path re-verifies
 *  the slug matches a live listing before writing the attribution. */
function applyMerchantRef(
  req: NextRequest,
  response: NextResponse
): NextResponse {
  const mref = req.nextUrl.searchParams.get("mref");
  const pathname = req.nextUrl.pathname;

  for (const prefix of ADMIN_PATH_PREFIXES) {
    if (pathname.startsWith(prefix)) return response;
  }
  if (!mref) return response;
  if (!MREF_SLUG_RE.test(mref)) return response;

  response.cookies.set(MREF_COOKIE, mref, {
    httpOnly: false,
    sameSite: "lax",
    secure:   process.env.NODE_ENV === "production",
    path:     "/",
    maxAge:   MREF_COOKIE_MAX_AGE
  });

  return response;
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  // W-OBS-1 Path A Layer 1 · resolve CID once per request · every
  // return below routes through attachCid() so the response carries
  // the header for client-side forensics.
  const cid = resolveCorrelationId(req);

  // Bypass for static and API paths.
  const pathname = req.nextUrl.pathname;
  for (const prefix of BYPASS_PATH_PREFIXES) {
    if (pathname.startsWith(prefix)) return attachCid(NextResponse.next(), cid);
  }

  // Legacy marketplace redirect — Philip 2026-07-27. /nex-app/centre
  // is the single marketplace surface; every prior route bounces to it.
  for (const legacy of LEGACY_MARKETPLACE_PREFIXES) {
    if (pathname === legacy || pathname.startsWith(`${legacy}/`)) {
      const target = req.nextUrl.clone();
      target.pathname = MARKETPLACE_CANONICAL_PATH;
      // Preserve any query string (search terms etc.)
      return attachCid(NextResponse.redirect(target, 302), cid);
    }
  }

  const rawHost = req.headers.get("host") ?? "";
  const host = rawHost.toLowerCase().replace(/:\d+$/, "");
  if (!host || SYSTEM_HOSTS.has(host)) {
    // Even on system hosts we still want to capture the ?ref= cookie.
    return attachCid(applyMerchantRef(req, applyAffiliateRef(req, NextResponse.next())), cid);
  }

  // *.vercel.app preview hosts also bypass — they're system, just
  // dynamically named by Vercel.
  if (host.endsWith(".vercel.app")) {
    return attachCid(applyMerchantRef(req, applyAffiliateRef(req, NextResponse.next())), cid);
  }

  // Subdomain-per-trade — bobs-plumbing.thenetworkers.app
  // resolves to /trade/bobs-plumbing without any DB lookup or any DNS
  // config beyond a wildcard *.thenetworkers.app A record on
  // Cloudflare. This is the make-or-break for the "canonical business
  // page" slogan (memory: project_construction_notebook_slogan.md).
  //
  // Ordering: we test THIS BEFORE the custom-domain DB lookup so we
  // never spend a query on requests we can route from the host alone.
  for (const root of SUBDOMAIN_ROOTS) {
    if (!host.endsWith(`.${root}`)) continue;
    const sub = host.slice(0, host.length - root.length - 1);
    // Exclude reserved subdomains + malformed slugs. Everything left
    // is a live trade slug candidate.
    if (RESERVED_SUBDOMAINS.has(sub) || !SLUG_RE.test(sub)) break;
    const rewritten = req.nextUrl.clone();
    rewritten.pathname =
      pathname === "/" ? `/trade/${sub}` : `/trade/${sub}${pathname}`;
    return attachCid(applyMerchantRef(req, applyAffiliateRef(req, NextResponse.rewrite(rewritten))), cid);
  }

  // Strip leading www. so the partial UNIQUE index matches either form.
  // We attach both at Vercel, but only store the apex in the DB row.
  const candidates = host.startsWith("www.")
    ? [host, host.slice(4)]
    : [host, `www.${host}`];

  // Lazy-init Supabase. Middleware runs on the Edge runtime by default
  // and cold-starts often; the client is cheap to create per request.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return attachCid(NextResponse.next(), cid);

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

  if (!data || !data.slug) {
    return attachCid(applyMerchantRef(req, applyAffiliateRef(req, NextResponse.next())), cid);
  }

  // Rewrite the request to /<slug>/<rest>. The marketing site's
  // afterFiles rewrites in next.config.mjs further point /<slug> at
  // /trade/<slug>, so the existing public profile renderer takes over
  // with no extra code change.
  const url2 = req.nextUrl.clone();
  url2.pathname =
    pathname === "/" ? `/${data.slug}` : `/${data.slug}${pathname}`;
  return attachCid(applyMerchantRef(req, applyAffiliateRef(req, NextResponse.rewrite(url2))), cid);
}
