// GET /api/cron/custom-domain-health
//
// Vercel Cron — runs every 6 hours (see vercel.json). For every listing
// with custom_domain_status='live' we ask Vercel for the latest
// verification + misconfiguration flags. Three consecutive failures
// flips the row to 'dns_lost' so the dashboard can surface the warning.
//
// Auth: shared secret in CRON_SECRET env var. Vercel Cron requests
// carry `Authorization: Bearer <secret>`. Any other request 401s.
//
// We cap each run at 100 domains so even a busy cron doesn't blow past
// the function timeout. The next run picks up the rest 6 hours later.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getDomainStatus,
  isVercelConfigured,
  MissingVercelConfigError
} from "@/lib/vercelDomains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PER_RUN_CAP = 100;
const FAILURE_THRESHOLD = 3;

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

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
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

  const rows = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "id, custom_domain, custom_domain_status, custom_domain_failure_count"
    )
    .eq("custom_domain_status", "live")
    .not("custom_domain", "is", null)
    .order("custom_domain_last_check_at", { ascending: true, nullsFirst: true })
    .limit(PER_RUN_CAP);

  if (rows.error) {
    return NextResponse.json(
      { ok: false, error: rows.error.message },
      { status: 500 }
    );
  }

  let checked = 0;
  let degraded = 0;
  let lost = 0;
  let ok = 0;

  for (const row of rows.data ?? []) {
    const domain = row.custom_domain as string;
    let status;
    try {
      status = await getDomainStatus(domain);
    } catch (err) {
      if (err instanceof MissingVercelConfigError) break;
      const msg = err instanceof Error ? err.message : String(err);
      await logEvent(row.id, domain, "health_check_failed", { error: msg });
      checked++;
      continue;
    }

    const now = new Date().toISOString();
    const healthy = status.verified === true && !status.misconfigured;

    if (healthy) {
      ok++;
      await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .update({
          custom_domain_last_check_at: now,
          custom_domain_last_error: null,
          custom_domain_failure_count: 0
        })
        .eq("id", row.id);
      await logEvent(row.id, domain, "health_check_ok", {});
    } else {
      degraded++;
      const newFailures = (row.custom_domain_failure_count ?? 0) + 1;
      const errMsg =
        status.error ??
        (status.misconfigured ? "DNS misconfigured" : "Not verified");

      if (newFailures >= FAILURE_THRESHOLD) {
        lost++;
        await supabaseAdmin
          .from("hammerex_trade_off_listings")
          .update({
            custom_domain_status: "dns_lost",
            custom_domain_last_check_at: now,
            custom_domain_last_error: errMsg,
            custom_domain_failure_count: newFailures
          })
          .eq("id", row.id);
        await logEvent(row.id, domain, "dns_lost", {
          failure_count: newFailures,
          error: errMsg
        });
        // TODO(admin email): wire Resend ping on first transition to
        // 'dns_lost'. Not blocking v1 ship.
      } else {
        await supabaseAdmin
          .from("hammerex_trade_off_listings")
          .update({
            custom_domain_last_check_at: now,
            custom_domain_last_error: errMsg,
            custom_domain_failure_count: newFailures
          })
          .eq("id", row.id);
        await logEvent(row.id, domain, "health_check_failed", {
          failure_count: newFailures,
          error: errMsg
        });
      }
    }
    checked++;
  }

  return NextResponse.json({
    ok: true,
    checked,
    healthy: ok,
    degraded,
    lost
  });
}
