// GET /api/cron/shadow-profile-send
//
// Runs every 15 minutes. Picks shadow merchants whose next drip step
// is due AND who are:
//   - status IN ('queued', 'sending')
//   - have an email address
//   - are NOT on the suppression list
// Sends via Postmark, logs the event, advances their step counter.
//
// Throttle: max 200 sends per run keeps deliverability stable and
// prevents any burst from tripping spam filters. At 96 runs/day
// (every 15 min) that's a ceiling of ~19,200 emails/day — plenty
// of headroom vs the scraper's ~500/day insert rate.
//
// CRON_SECRET gated. Business-hours-aware: skips 6pm-8am UK local
// so recipients get emails during their working day.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPostmarkEmail } from "@/lib/shadowMerchants/postmark";
import { templateForStep } from "@/lib/shadowMerchants/templates";
import { buildEmailContext } from "@/lib/shadowMerchants/personalizer";
import type { ShadowMerchant } from "@/lib/shadowMerchants/types";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const maxDuration = 300;

const MAX_SENDS_PER_RUN = 200;

// UK business-hours guard (09:00–17:59 UK local). Postmark cares
// about deliverability + recipients respond better to daytime emails.
function isBusinessHoursUk(now: Date): boolean {
  const ukHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour:     "2-digit",
      hour12:   false
    }).format(now)
  );
  const ukDow = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday:  "short"
  }).format(now);
  const isWeekday = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(ukDow);
  return isWeekday && ukHour >= 9 && ukHour <= 17;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (secret && bearer !== secret) {
    return NextResponse.json({ ok: false, error: "not-authorised" }, { status: 401 });
  }

  const now = new Date();

  if (!isBusinessHoursUk(now)) {
    return NextResponse.json({
      ok:     true,
      skipped:"outside-business-hours",
      at:     now.toISOString()
    });
  }

  // Fetch eligible batch: due now, not suppressed, has email
  const dueRes = await supabaseAdmin
    .from("hammerex_shadow_merchants")
    .select("*")
    .in("status", ["queued", "sending"])
    .lte("next_step_due_at", now.toISOString())
    .not("email", "is", null)
    .order("next_step_due_at", { ascending: true })
    .limit(MAX_SENDS_PER_RUN);

  if (dueRes.error) {
    console.error("[cron/shadow-profile-send] fetch failed", dueRes.error);
    return NextResponse.json({ ok: false, error: "fetch-failed" }, { status: 500 });
  }

  const merchants = (dueRes.data ?? []) as ShadowMerchant[];

  // Suppression check (batched) — pull ALL suppressed emails for the batch
  const emails = merchants.map((m) => (m.email || "").toLowerCase()).filter(Boolean);
  const suppRes = emails.length > 0
    ? await supabaseAdmin
        .from("hammerex_shadow_suppression")
        .select("email")
        .in("email", emails)
    : { data: [] as Array<{ email: string }> };

  const suppressed = new Set(((suppRes.data as Array<{ email: string }> | null) ?? []).map((r) => r.email.toLowerCase()));

  let sent          = 0;
  let dryRun        = 0;
  let suppressedCnt = 0;
  let released      = 0;
  let errored       = 0;

  for (const m of merchants) {
    // Suppression short-circuit
    if (m.email && suppressed.has(m.email.toLowerCase())) {
      await supabaseAdmin
        .from("hammerex_shadow_merchants")
        .update({ status: "suppressed" })
        .eq("id", m.id);
      suppressedCnt++;
      continue;
    }

    const template = templateForStep(m.next_step_index);
    if (!template) {
      // Sequence exhausted — release the slug back to the pool
      await supabaseAdmin
        .from("hammerex_shadow_merchants")
        .update({ status: "released", released_at: now.toISOString() })
        .eq("id", m.id);
      released++;
      continue;
    }

    try {
      const ctx      = await buildEmailContext(m);
      const subject  = template.subject(ctx);
      const body     = template.body(ctx);

      const sendRes = await sendPostmarkEmail({
        From:          `${ctx.senderName} <${ctx.senderEmail}>`,
        To:            m.email!,
        Subject:       subject,
        TextBody:      body,
        ReplyTo:       ctx.senderEmail,
        MessageStream: process.env.POSTMARK_MESSAGE_STREAM || "broadcast",
        Metadata: {
          shadowMerchantId: m.id,
          stepIndex:        String(m.next_step_index),
          stepSlug:         template.slug
        }
      });

      if (!sendRes.ok) {
        errored++;
        await supabaseAdmin.from("hammerex_shadow_email_events").insert({
          shadow_merchant_id: m.id,
          step_index:         m.next_step_index,
          event_type:         "bounce",
          metadata:           { error: sendRes.error, errorCode: sendRes.errorCode }
        });
        continue;
      }

      if (sendRes.dryRun) dryRun++; else sent++;

      // Log the send event
      await supabaseAdmin.from("hammerex_shadow_email_events").insert({
        shadow_merchant_id: m.id,
        step_index:         m.next_step_index,
        event_type:         "sent",
        message_id:         sendRes.messageId,
        metadata:           { subject, dryRun: sendRes.dryRun }
      });

      // Advance the step counter
      const nextStepIdx = m.next_step_index + 1;
      const nextTemplate = templateForStep(nextStepIdx);
      const nextDueAt    = nextTemplate
        ? new Date(now.getTime() + nextTemplate.delayFromPrevMs).toISOString()
        : null;

      await supabaseAdmin
        .from("hammerex_shadow_merchants")
        .update({
          status:            nextTemplate ? "sending" : "sending",  // released next cycle by exhaustion branch
          next_step_index:   nextStepIdx,
          next_step_due_at:  nextDueAt,
          last_step_sent_at: now.toISOString()
        })
        .eq("id", m.id);
    } catch (err) {
      errored++;
      console.error(`[cron/shadow-profile-send] merchant ${m.id} failed`, err);
    }
  }

  const summary = {
    ok:            true,
    batchSize:     merchants.length,
    sent,
    dryRun,
    suppressed:    suppressedCnt,
    released,
    errored,
    at:            now.toISOString()
  };
  console.log("[cron/shadow-profile-send]", summary);
  return NextResponse.json(summary);
}
