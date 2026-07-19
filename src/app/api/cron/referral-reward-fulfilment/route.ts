// GET /api/cron/referral-reward-fulfilment
//
// Every 15 minutes: reads pending rows from hammerex_merchant_referral_rewards
// and credits the referrer's washer bag by reward_meta.washers.
// Flips reward_status to `fulfilled` + stamps fulfilled_at.
//
// The `signup` reward type credits BOTH sides (referrer + referred).
// The `first-paid-upgrade` reward type credits the referrer only.
// See src/lib/merchantReferrals.ts for the queue producer.
//
// Idempotent — only touches `pending` rows. Per-row best-effort:
// one failure doesn't block others. `CRON_SECRET` gated.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (secret && bearer !== secret) {
    return NextResponse.json({ ok: false, error: "not-authorised" }, { status: 401 });
  }

  const now = new Date();

  // Fetch pending rewards. Cap at 500 per run so a large backlog
  // spreads across multiple cron ticks rather than blocking.
  const pending = await supabaseAdmin
    .from("hammerex_merchant_referral_rewards")
    .select("id, referrer_slug, referred_slug, reward_type, reward_meta")
    .eq("reward_status", "pending")
    .order("created_at", { ascending: true })
    .limit(500);

  if (pending.error) {
    console.error("[cron/referral-reward-fulfilment] read failed:", pending.error);
    return NextResponse.json({ ok: false, error: "read-failed" }, { status: 500 });
  }

  type Row = {
    id:             string;
    referrer_slug:  string;
    referred_slug:  string;
    reward_type:    "signup" | "first-paid-upgrade";
    reward_meta:    { washers?: number; both_sides?: boolean } | null;
  };
  const rows = (pending.data ?? []) as Row[];

  let fulfilled = 0;
  let skipped   = 0;
  let errors    = 0;
  const notes: string[] = [];

  for (const row of rows) {
    const washers = Number(row.reward_meta?.washers ?? 0);
    if (!Number.isFinite(washers) || washers <= 0) {
      // No credit configured — nothing to do; mark fulfilled with a note.
      await supabaseAdmin
        .from("hammerex_merchant_referral_rewards")
        .update({
          reward_status: "fulfilled",
          fulfilled_at:  now.toISOString(),
          notes:         "no-washers-in-meta"
        })
        .eq("id", row.id);
      skipped++;
      continue;
    }

    // Resolve the receiving merchant listings. `signup` type with
    // both_sides=true credits BOTH referrer + referred; every other
    // shape credits the referrer only.
    const bothSides = row.reward_type === "signup" && row.reward_meta?.both_sides === true;
    const recipients = bothSides
      ? [row.referrer_slug, row.referred_slug]
      : [row.referrer_slug];

    let anyFailed = false;
    const receiptNotes: string[] = [];
    for (const slug of recipients) {
      const listing = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!listing.data) {
        receiptNotes.push(`${slug}: listing-not-found`);
        anyFailed = true;
        continue;
      }
      const listingId = listing.data.id as string;
      const bag = await supabaseAdmin
        .from("hammerex_washer_bags")
        .select("id, balance")
        .eq("listing_id", listingId)
        .maybeSingle();
      if (bag.data) {
        const upd = await supabaseAdmin
          .from("hammerex_washer_bags")
          .update({ balance: (bag.data.balance ?? 0) + washers })
          .eq("id", bag.data.id as string);
        if (upd.error) {
          receiptNotes.push(`${slug}: update-failed`);
          anyFailed = true;
        } else {
          receiptNotes.push(`${slug}: +${washers}`);
        }
      } else {
        const ins = await supabaseAdmin
          .from("hammerex_washer_bags")
          .insert({ listing_id: listingId, balance: washers });
        if (ins.error) {
          receiptNotes.push(`${slug}: insert-failed`);
          anyFailed = true;
        } else {
          receiptNotes.push(`${slug}: created+${washers}`);
        }
      }
    }

    if (anyFailed) {
      // Don't mark fulfilled — leave it pending so next cron tick
      // retries. But log the receipt so admin can debug persistent
      // failures.
      await supabaseAdmin
        .from("hammerex_merchant_referral_rewards")
        .update({ notes: receiptNotes.join(" · ") })
        .eq("id", row.id);
      errors++;
      notes.push(`row ${row.id}: ${receiptNotes.join(" · ")}`);
      continue;
    }

    await supabaseAdmin
      .from("hammerex_merchant_referral_rewards")
      .update({
        reward_status: "fulfilled",
        fulfilled_at:  now.toISOString(),
        notes:         receiptNotes.join(" · ")
      })
      .eq("id", row.id);
    fulfilled++;
  }

  const summary = {
    ok:        true,
    fulfilled,
    skipped,
    errors,
    processed: rows.length,
    at:        now.toISOString(),
    ...(notes.length > 0 ? { errorNotes: notes.slice(0, 10) } : {})
  };
  console.log("[cron/referral-reward-fulfilment]", summary);
  return NextResponse.json(summary);
}
