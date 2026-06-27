// POST /api/trade-off/custom-domain/verify
// Magic-link authenticated. Body: { slug, edit_token }.
//
// Triggered by the editor's "I've added the records — check now" button.
// Calls Vercel's verify endpoint for BOTH apex + www and updates the
// row to:
//   - 'verifying' if DNS now points right but SSL still issuing
//   - 'live'      if both apex + www verified
//   - keeps 'dns_pending' otherwise (with last_error updated)
//
// We DO NOT block on SSL here — the editor polls /status periodically,
// and the 6-hour health-check cron will catch any silent SSL hang.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  verifyDomain,
  getDomainStatus,
  isVercelConfigured,
  MissingVercelConfigError
} from "@/lib/vercelDomains";

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

  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or edit_token." },
      { status: 400 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "id, edit_token, custom_domain, custom_domain_apex, custom_domain_status"
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

  const domain = listing.data.custom_domain;
  if (!domain) {
    return NextResponse.json(
      { ok: false, error: "No custom domain on this listing." },
      { status: 400 }
    );
  }

  if (!isVercelConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Custom Domain requires VERCEL_API_TOKEN in env."
      },
      { status: 503 }
    );
  }

  await logEvent(listing.data.id, domain, "verify_attempt", {});

  let apexCheck;
  let wwwCheck;
  let apexStatus;
  let wwwStatus;
  try {
    apexCheck = await verifyDomain(domain);
    wwwCheck = await verifyDomain(`www.${domain}`);
    apexStatus = await getDomainStatus(domain);
    wwwStatus = await getDomainStatus(`www.${domain}`);
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
    await logEvent(listing.data.id, domain, "verify_failed", { error: msg });
    return NextResponse.json(
      { ok: false, error: `Vercel API error: ${msg}` },
      { status: 502 }
    );
  }

  const bothVerified = apexCheck.verified === true && wwwCheck.verified === true;
  const bothLive =
    apexStatus.verified === true &&
    wwwStatus.verified === true &&
    !apexStatus.misconfigured &&
    !wwwStatus.misconfigured;

  const now = new Date().toISOString();
  let newStatus: "live" | "verifying" | "dns_pending" =
    listing.data.custom_domain_status === "live"
      ? "live"
      : bothLive
        ? "live"
        : bothVerified
          ? "verifying"
          : "dns_pending";

  // Merge verification record updates back into the DB so the editor
  // can show the latest reason strings.
  const mergedVerification = [
    ...(apexCheck.verification ?? []),
    ...(wwwCheck.verification ?? [])
  ];

  const patch: Record<string, unknown> = {
    custom_domain_status: newStatus,
    custom_domain_verification:
      mergedVerification.length > 0 ? mergedVerification : null,
    custom_domain_last_check_at: now,
    custom_domain_last_error:
      apexCheck.error ?? wwwCheck.error ?? null,
    custom_domain_failure_count: bothVerified ? 0 : undefined
  };
  if (newStatus === "live") {
    patch.custom_domain_verified_at = now;
    patch.custom_domain_ssl_verified_at = now;
  }
  // Strip undefined so PostgREST doesn't try to write them.
  Object.keys(patch).forEach((k) => {
    if (patch[k] === undefined) delete patch[k];
  });

  await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update(patch)
    .eq("id", listing.data.id);

  await logEvent(
    listing.data.id,
    domain,
    newStatus === "live" ? "verify_success" : "verify_attempt",
    {
      apexCheck,
      wwwCheck,
      apexStatus,
      wwwStatus,
      newStatus
    }
  );

  return NextResponse.json({
    ok: true,
    status: newStatus,
    verification: mergedVerification
  });
}
