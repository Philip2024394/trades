// GET /api/cron/free-slug-expiry
//
// Scheduled daily by Vercel Cron. Walks free-tier merchants and
// enforces the 30-day activity policy that keeps their slug reserved.
//
// State machine per row (tier = 'standard' only):
//   ok        → warn-15 at 15 days inactive: first heads-up email
//   warn-15   → warn-25 at 25 days inactive: firmer reminder
//   warn-25   → warn-29 at 29 days inactive: 24-hour final warning
//   warn-29   → expired at 30 days inactive: slug archived, released
//
// Any login mid-cycle resets stage to 'ok' and updates last_login_at
// (handled in the login endpoint, not here).
//
// Auth: requires CRON_SECRET matching Authorization: Bearer <secret>.
// Vercel Cron sets this automatically per project config.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notifySlugExpiryStage, type SlugExpiryStage } from "@/lib/slugExpiry/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAGE_THRESHOLDS_DAYS = {
  "warn-15": 15,
  "warn-25": 25,
  "warn-29": 29,
  "expired": 30
} as const;

function daysAgo(iso: string | null): number {
  if (!iso) return 0;
  const then = Date.parse(iso);
  if (!then) return 0;
  return (Date.now() - then) / (1000 * 60 * 60 * 24);
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Pull free-tier rows that haven't already reached 'expired'.
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, tier, last_login_at, slug_expiry_stage, email, business_name")
    .eq("tier", "standard")
    .neq("slug_expiry_stage", "expired")
    .limit(500);

  if (res.error) {
    return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
  }
  const rows = res.data ?? [];

  let advanced = 0;
  let expired = 0;
  let warned = 0;
  let untouched = 0;

  for (const row of rows) {
    const days = daysAgo(row.last_login_at);
    const currentStage = row.slug_expiry_stage;
    let nextStage: string = currentStage;

    if (days >= STAGE_THRESHOLDS_DAYS["expired"]) {
      nextStage = "expired";
    } else if (days >= STAGE_THRESHOLDS_DAYS["warn-29"]) {
      nextStage = "warn-29";
    } else if (days >= STAGE_THRESHOLDS_DAYS["warn-25"]) {
      nextStage = "warn-25";
    } else if (days >= STAGE_THRESHOLDS_DAYS["warn-15"]) {
      nextStage = "warn-15";
    }

    if (nextStage === currentStage) {
      untouched += 1;
      continue;
    }

    // Capture the pre-transition slug (once expired we rename it so
    // the warning email needs the ORIGINAL slug in the copy).
    const originalSlug = row.slug;

    if (nextStage === "expired") {
      // Archive the slug: rename it so it's released from the pool.
      // Row is preserved (activity events, orders, etc. still FK to it)
      // but slug is now available for a new signup to claim.
      const archivedSlug = `archived-${row.id}`;
      const updateRes = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .update({
          slug: archivedSlug,
          slug_expiry_stage: "expired",
          slug_expiry_warning_at: new Date().toISOString()
        })
        .eq("id", row.id);
      // Best-effort — if the update failed, skip the email. Merchant
      // is not blocked from anything; next cron run picks it up.
      if (!updateRes.error) {
        expired += 1;
      }
    } else {
      // Warning stage. Bump stage + set warning_at so we track when
      // the last email was sent.
      const updateRes = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .update({
          slug_expiry_stage: nextStage,
          slug_expiry_warning_at: new Date().toISOString()
        })
        .eq("id", row.id);
      if (!updateRes.error) {
        advanced += 1;
        warned += 1;
      }
    }

    // Best-effort email dispatch. Errors swallowed; cron always
    // completes. Merchant never sees a hard failure.
    try {
      await notifySlugExpiryStage({
        toEmail:      row.email as string | null,
        slug:         originalSlug,
        businessName: (row.business_name as string | null) ?? originalSlug,
        stage:        nextStage as SlugExpiryStage
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[cron/free-slug-expiry] email dispatch failed (non-fatal):", err);
    }
  }

  return NextResponse.json({
    ok:        true,
    scanned:   rows.length,
    warned,
    expired,
    advanced,
    untouched
  });
}
