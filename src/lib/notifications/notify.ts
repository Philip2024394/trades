// Notification Engine · unified delivery pipeline.
//
// Every product calls notify() with a recipient + template + channels[].
// The engine records the intent, invokes adapters, updates status.
// Fire-and-forget by default (Rule 3 — notification failure must
// never break the parent action).
//
// Adapters shipped in v1:
//   * email   — Postmark
//   * whatsapp — deep-link URL (no delivery API; product renders it)
//   * in_app  — writes to hammerex_in_app_notifications
//
// Not shipped in v1 (stubs return skipped):
//   * web_push — awaits PWA push work
//   * sms      — awaits Twilio integration

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { renderTemplate, type TemplateSlug } from "./templates";

export type NotificationChannel = "email" | "whatsapp" | "web_push" | "sms" | "in_app";

export type NotificationRecipient = {
  kind:     "homeowner" | "trade" | "merchant" | "admin" | "guest";
  id?:      string | null;
  email?:   string | null;
  phone?:   string | null;    // E.164
  display?: string | null;
};

export type NotifyPayload = {
  to:            NotificationRecipient;
  template:      TemplateSlug;
  data?:         Record<string, unknown>;
  channels:      NotificationChannel[];
  product?:      string;
  relatedTargetKind?: string;
  relatedTargetId?:   string;
};

export type NotifyResult = {
  intentId:     string;
  status:       "sent" | "failed" | "skipped";
  deliveredVia: NotificationChannel | null;
  error?:       string;
};

/** Fire a notification through the engine.
 *  Fire-and-forget by default; use `await` if the caller needs the result. */
export async function notify(payload: NotifyPayload): Promise<NotifyResult> {
  // 1. Record the intent
  const ins = await supabaseAdmin
    .from("hammerex_notification_intents")
    .insert({
      recipient_kind:      payload.to.kind,
      recipient_id:        payload.to.id      ?? null,
      recipient_email:     payload.to.email   ?? null,
      recipient_phone:     payload.to.phone   ?? null,
      recipient_display:   payload.to.display ?? null,
      template_slug:       payload.template,
      template_data:       payload.data ?? null,
      channels:            payload.channels,
      product:             payload.product ?? null,
      related_target_kind: payload.relatedTargetKind ?? null,
      related_target_id:   payload.relatedTargetId   ?? null,
      status:              "pending"
    })
    .select("id")
    .maybeSingle();
  if (ins.error || !ins.data) {
    console.error("[notify] intent insert failed", ins.error);
    return { intentId: "", status: "failed", deliveredVia: null, error: "intent-insert-failed" };
  }
  const intentId = ins.data.id as string;

  // 2. Render the template
  const rendered = renderTemplate(payload.template, payload.data ?? {});

  // 3. Try channels in the order given; first success wins
  for (const channel of payload.channels) {
    const result = await deliver(channel, payload.to, rendered, intentId);
    if (result.ok) {
      await supabaseAdmin
        .from("hammerex_notification_intents")
        .update({
          status: "sent",
          delivered_via: channel,
          delivery_provider_id: result.providerId ?? null,
          sent_at: new Date().toISOString()
        })
        .eq("id", intentId);
      return { intentId, status: "sent", deliveredVia: channel };
    }
    // else — try next channel
  }

  // All channels failed
  await supabaseAdmin
    .from("hammerex_notification_intents")
    .update({
      status: "failed",
      failed_at: new Date().toISOString(),
      error_message: "all-channels-failed"
    })
    .eq("id", intentId);
  return { intentId, status: "failed", deliveredVia: null, error: "all-channels-failed" };
}

// ─── Adapters ──────────────────────────────────────────────────────

type Rendered = { subject: string; body: string; actionUrl: string | null; iconSlug: string | null };
type DeliveryResult = { ok: boolean; providerId?: string; error?: string };

async function deliver(
  channel: NotificationChannel,
  to: NotificationRecipient,
  rendered: Rendered,
  intentId: string
): Promise<DeliveryResult> {
  switch (channel) {
    case "email":    return deliverEmail(to, rendered);
    case "whatsapp": return deliverWhatsApp(to, rendered);
    case "in_app":   return deliverInApp(to, rendered, intentId);
    case "web_push": return { ok: false, error: "web_push-not-implemented" };
    case "sms":      return { ok: false, error: "sms-not-implemented" };
  }
}

async function deliverEmail(to: NotificationRecipient, r: Rendered): Promise<DeliveryResult> {
  if (!to.email) return { ok: false, error: "no-email" };
  const postmarkToken = process.env.POSTMARK_SERVER_TOKEN;
  if (!postmarkToken) {
    console.warn("[notify.email] POSTMARK_SERVER_TOKEN missing — skipping");
    return { ok: false, error: "no-postmark-token" };
  }
  try {
    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": postmarkToken
      },
      body: JSON.stringify({
        From:     process.env.POSTMARK_FROM || "hello@thenetworkers.app",
        To:       to.email,
        Subject:  r.subject,
        HtmlBody: r.body,
        MessageStream: "outbound"
      })
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `postmark-${res.status}: ${text.slice(0, 200)}` };
    }
    const data = await res.json();
    return { ok: true, providerId: data.MessageID };
  } catch (err) {
    return { ok: false, error: `postmark-threw: ${(err as Error).message}` };
  }
}

async function deliverWhatsApp(to: NotificationRecipient, _r: Rendered): Promise<DeliveryResult> {
  // WhatsApp delivery is a deep-link URL, not a push. The product's UI
  // that triggers this notification renders the wa.me link. The engine
  // records the intent for audit + retry, but "delivery" here is nominal.
  if (!to.phone) return { ok: false, error: "no-phone" };
  return { ok: true, providerId: `wa:${to.phone}` };
}

async function deliverInApp(to: NotificationRecipient, r: Rendered, intentId: string): Promise<DeliveryResult> {
  if (!to.id) return { ok: false, error: "no-recipient-id" };
  const ins = await supabaseAdmin
    .from("hammerex_in_app_notifications")
    .insert({
      intent_id:      intentId,
      recipient_kind: to.kind,
      recipient_id:   to.id,
      title:          r.subject,
      body:           r.body,
      action_url:     r.actionUrl,
      icon_slug:      r.iconSlug
    })
    .select("id")
    .maybeSingle();
  if (ins.error) return { ok: false, error: `in_app-insert-failed: ${ins.error.message}` };
  return { ok: true, providerId: ins.data?.id };
}
