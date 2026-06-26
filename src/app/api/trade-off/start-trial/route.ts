// POST /api/trade-off/start-trial
// Manual restart of the 30-day Xrated App trial for an existing listing.
// Body: { slug, edit_token }.
//
// Eligibility:
//   - tier === 'standard' (never trialled — fine, give them the trial), OR
//   - tier === 'app_expired' AND the previous trial ended > 90 days ago
//     (cool-off to prevent serial re-trial abuse).
//
// Returns { ok, trial_expires_at } on success.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { startTrialFor } from "@/lib/xratedTier";

export const runtime = "nodejs";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const slug = s(body.slug);
  const token = s(body.edit_token);
  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or edit_token." },
      { status: 400 }
    );
  }

  const row = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, tier, trial_expires_at")
    .eq("slug", slug)
    .maybeSingle();
  if (!row.data) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  if (!constantTimeEq(row.data.edit_token, token)) {
    return NextResponse.json({ ok: false, error: "Invalid edit token." }, { status: 403 });
  }

  const tier = row.data.tier as "standard" | "app_trial" | "app_paid" | "app_expired";

  if (tier === "app_trial") {
    return NextResponse.json(
      { ok: false, error: "Trial already active." },
      { status: 409 }
    );
  }
  if (tier === "app_paid") {
    return NextResponse.json(
      { ok: false, error: "You're already on the paid plan." },
      { status: 409 }
    );
  }

  // Standard listings: allow.
  // Expired listings: 90-day cool-off based on the previous trial end.
  if (tier === "app_expired") {
    const prevEnd = row.data.trial_expires_at
      ? new Date(row.data.trial_expires_at).getTime()
      : 0;
    if (prevEnd && Date.now() - prevEnd < NINETY_DAYS_MS) {
      const daysLeft = Math.ceil(
        (NINETY_DAYS_MS - (Date.now() - prevEnd)) / (24 * 60 * 60 * 1000)
      );
      return NextResponse.json(
        {
          ok: false,
          error: `You can restart the trial in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Upgrade now to skip the wait.`
        },
        { status: 403 }
      );
    }
  }

  const result = await startTrialFor(row.data.id);
  if (!result) {
    return NextResponse.json(
      { ok: false, error: "Could not start trial." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    tier: "app_trial",
    trial_started_at: result.trial_started_at,
    trial_expires_at: result.trial_expires_at
  });
}
