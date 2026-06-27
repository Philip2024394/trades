// POST /api/trade-off/custom-domain/attach
// Magic-link authenticated. Body: { slug, edit_token, domain }.
//
// Lifecycle:
//   1. Validate token + paid tier + clean domain format.
//   2. Attach BOTH apex + www at Vercel (idempotent on Vercel's side).
//      We always attach www so the customer can use either form.
//   3. Persist the DB row + verification challenge so the editor can
//      show the DNS instructions.
//   4. Log every attempt to hammerex_custom_domain_events so admin
//      can debug.
//
// Returns the Vercel verification records so the client can render
// the DNS-instructions card without a second round-trip.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { XRATED_ADDONS } from "@/lib/xratedAddons";
import { effectiveTier } from "@/lib/xratedTrades";
import {
  attachDomain,
  isVercelConfigured,
  MissingVercelConfigError,
  type VercelDomainVerification
} from "@/lib/vercelDomains";

export const runtime = "nodejs";

// RFC-1035-ish domain check. Allows multi-label TLDs (.co.uk),
// rejects bare TLDs and Vercel-reserved suffixes.
const DOMAIN_RE =
  /^(?!www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const APEX_DOMAIN_RE =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

const RESERVED_SUFFIXES = [
  ".vercel.app",
  ".xratedtrade.com",
  ".now.sh"
];

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normaliseApex(domain: string): string {
  return domain.startsWith("www.") ? domain.slice(4) : domain;
}

async function logEvent(
  listingId: string | null,
  domain: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  await supabaseAdmin.from("hammerex_custom_domain_events").insert({
    listing_id: listingId,
    domain,
    event_type: eventType,
    payload
  });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const slug = s(body.slug);
  const token = s(body.edit_token);
  const domainRaw = s(body.domain).toLowerCase();

  if (!slug || !token || !domainRaw) {
    return NextResponse.json(
      { ok: false, error: "Missing slug, edit_token, or domain." },
      { status: 400 }
    );
  }

  // Strip leading scheme + trailing slashes the customer might paste.
  const domain = domainRaw
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/^www\./, "");

  if (!APEX_DOMAIN_RE.test(domain)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "That doesn't look like a valid domain. Use the apex form, e.g. joeplumberleeds.co.uk."
      },
      { status: 400 }
    );
  }

  for (const suffix of RESERVED_SUFFIXES) {
    if (domain.endsWith(suffix)) {
      return NextResponse.json(
        { ok: false, error: "That domain is reserved." },
        { status: 400 }
      );
    }
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "id, edit_token, tier, trial_expires_at, addons_enabled, custom_domain, custom_domain_status"
    )
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

  const tier = effectiveTier({
    tier: listing.data.tier ?? "standard",
    trial_expires_at: listing.data.trial_expires_at ?? null
  });
  const isPaid = tier === "app_trial" || tier === "app_paid";
  const addon = XRATED_ADDONS.find((a) => a.slug === "custom_domain");
  if (!addon) {
    return NextResponse.json(
      { ok: false, error: "Add-on registry missing entry." },
      { status: 500 }
    );
  }
  if (!isPaid) {
    return NextResponse.json(
      { ok: false, error: "Upgrade required to connect a custom domain." },
      { status: 403 }
    );
  }

  // Reject a different listing already owning this domain. (UNIQUE
  // constraint will also catch it but we want a clean message.)
  const existing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id")
    .eq("custom_domain", domain)
    .neq("id", listing.data.id)
    .maybeSingle();
  if (existing.data) {
    return NextResponse.json(
      {
        ok: false,
        error: "That domain is already connected to another Xrated profile."
      },
      { status: 409 }
    );
  }

  if (!isVercelConfigured()) {
    await logEvent(listing.data.id, domain, "attach_failed", {
      reason: "missing_vercel_config"
    });
    return NextResponse.json(
      {
        ok: false,
        error:
          "Custom Domain requires VERCEL_API_TOKEN in env. Ask Hammerex admin to wire it up."
      },
      { status: 503 }
    );
  }

  await logEvent(listing.data.id, domain, "attach_attempt", { domain });

  let apexResult: Awaited<ReturnType<typeof attachDomain>>;
  let wwwResult: Awaited<ReturnType<typeof attachDomain>>;
  try {
    apexResult = await attachDomain(domain);
    wwwResult = await attachDomain(`www.${domain}`);
  } catch (err) {
    if (err instanceof MissingVercelConfigError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Custom Domain requires VERCEL_API_TOKEN in env."
        },
        { status: 503 }
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    await logEvent(listing.data.id, domain, "attach_failed", { error: msg });
    return NextResponse.json(
      { ok: false, error: `Vercel API error: ${msg}` },
      { status: 502 }
    );
  }

  if (apexResult.error) {
    await logEvent(listing.data.id, domain, "attach_failed", {
      stage: "apex",
      error: apexResult.error
    });
    return NextResponse.json(
      { ok: false, error: apexResult.error },
      { status: 502 }
    );
  }

  await logEvent(listing.data.id, domain, "attach_success", {
    apex: apexResult,
    www: wwwResult
  });

  // Merge verification challenges from both attaches so the editor's
  // DNS-instructions card can show every record the customer needs.
  const verification: VercelDomainVerification[] = [
    ...(apexResult.verification ?? []),
    ...(wwwResult.verification ?? [])
  ];

  const now = new Date().toISOString();
  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({
      custom_domain: domain,
      custom_domain_apex: normaliseApex(domain),
      custom_domain_status: "dns_pending",
      custom_domain_verification: verification,
      custom_domain_vercel_id: apexResult.id ?? null,
      custom_domain_added_at: now,
      custom_domain_last_error: null,
      custom_domain_failure_count: 0,
      custom_domain_addon_active: true
    })
    .eq("id", listing.data.id)
    .select("custom_domain, custom_domain_status, custom_domain_verification")
    .maybeSingle();

  if (upd.error || !upd.data) {
    console.error("[custom-domain/attach] db update failed:", upd.error);
    return NextResponse.json(
      { ok: false, error: upd.error?.message ?? "Database update failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    domain: upd.data.custom_domain,
    status: upd.data.custom_domain_status,
    verification: upd.data.custom_domain_verification ?? []
  });
}
