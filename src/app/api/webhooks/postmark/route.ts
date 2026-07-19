// POST /api/webhooks/postmark
//
// Postmark webhook receiver for shadow-profile emails.
// Records: Delivery, Open, Click, Bounce, SpamComplaint, SubscriptionChange.
//
// Auto-adds to suppression list on Bounce / SpamComplaint / Unsubscribe.
//
// Auth: Postmark supports basic auth on webhook URLs. We accept a
// shared secret in the URL as ?token= to avoid needing Postmark's
// basic-auth config. Compare in constant time to prevent leaks.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { webhookEventTypeToInternal, type PostmarkWebhookEvent } from "@/lib/shadowMerchants/postmark";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: Request) {
  const expected = process.env.POSTMARK_WEBHOOK_SECRET || "";
  const url      = new URL(req.url);
  const given    = url.searchParams.get("token") || "";
  if (!expected || !safeEqual(given, expected)) {
    return NextResponse.json({ ok: false, error: "not-authorised" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as PostmarkWebhookEvent | null;
  if (!payload) return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });

  const eventType = webhookEventTypeToInternal(payload.RecordType);
  if (!eventType) {
    return NextResponse.json({ ok: true, ignored: payload.RecordType });
  }

  // Recover the shadow merchant via metadata (set on send)
  const shadowId  = payload.Metadata?.shadowMerchantId;
  const stepIndex = payload.Metadata?.stepIndex ? Number(payload.Metadata.stepIndex) : null;
  const email     = (payload.Recipient || payload.Email || "").toLowerCase();

  // Log the event even if we can't recover the merchant (auditability)
  const eventInsert = await supabaseAdmin
    .from("hammerex_shadow_email_events")
    .insert({
      shadow_merchant_id: shadowId || null,
      step_index:         stepIndex ?? 0,
      event_type:         eventType,
      message_id:         payload.MessageID,
      metadata:           payload as unknown as Record<string, unknown>
    })
    .select("id")
    .maybeSingle();

  const eventId = (eventInsert.data as { id?: string } | null)?.id || null;

  // Suppression side-effects
  if (eventType === "bounce" || eventType === "complaint" || eventType === "unsubscribe") {
    if (email) {
      await supabaseAdmin
        .from("hammerex_shadow_suppression")
        .upsert(
          {
            email,
            reason:          eventType,
            source_event_id: eventId
          },
          { onConflict: "email" }
        );
    }

    if (shadowId) {
      await supabaseAdmin
        .from("hammerex_shadow_merchants")
        .update({ status: "suppressed" })
        .eq("id", shadowId);
    }
  }

  return NextResponse.json({ ok: true, eventType, shadowId });
}
