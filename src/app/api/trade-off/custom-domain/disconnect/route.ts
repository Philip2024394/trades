// POST /api/trade-off/custom-domain/disconnect
// Magic-link authenticated. Body: { slug, edit_token }.
//
// Customer pressed Disconnect in the editor. Detaches BOTH apex + www
// from Vercel (idempotent — 404 treated as success) and clears the
// row's custom_domain_* fields. Listing keeps `addons_enabled.custom_domain`
// because the customer may want to attach a different domain in
// future without re-toggling the add-on.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  detachDomain,
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
    .select("id, edit_token, custom_domain")
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
      { ok: false, error: "No custom domain attached." },
      { status: 400 }
    );
  }

  // Detach is best-effort. If Vercel is offline / config missing we
  // still clear the DB row — the customer wants the disconnect to
  // succeed and we can sweep abandoned Vercel records via the audit
  // table later.
  if (isVercelConfigured()) {
    try {
      await detachDomain(domain);
      await detachDomain(`www.${domain}`);
    } catch (err) {
      if (!(err instanceof MissingVercelConfigError)) {
        const msg = err instanceof Error ? err.message : String(err);
        await logEvent(listing.data.id, domain, "attach_failed", {
          stage: "detach",
          error: msg
        });
      }
    }
  }

  const now = new Date().toISOString();
  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({
      custom_domain: null,
      custom_domain_apex: null,
      custom_domain_status: "disconnected",
      custom_domain_verification: null,
      custom_domain_vercel_id: null,
      custom_domain_last_check_at: now,
      custom_domain_last_error: null,
      custom_domain_failure_count: 0,
      custom_domain_addon_active: false
    })
    .eq("id", listing.data.id)
    .select("custom_domain_status")
    .maybeSingle();

  if (upd.error) {
    console.error("[custom-domain/disconnect] db update failed:", upd.error);
    return NextResponse.json(
      { ok: false, error: upd.error.message },
      { status: 500 }
    );
  }

  await logEvent(listing.data.id, domain, "disconnect", { domain });

  return NextResponse.json({ ok: true, status: "disconnected" });
}
