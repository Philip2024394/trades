// NEX Notifications · WhatsApp Meta Business Cloud adapter
//
// Meta's WhatsApp Business Cloud API (Graph API v18+). Env:
//   META_WHATSAPP_PHONE_NUMBER_ID  · required · sender phone number id
//   META_WHATSAPP_ACCESS_TOKEN     · required · access token (secret)
//   META_WHATSAPP_OTP_TEMPLATE     · optional · pre-approved template name
//   META_WHATSAPP_OTP_TEMPLATE_LANG · optional · defaults to en_GB
//
// This is the ONLY file in the codebase permitted to hit
// https://graph.facebook.com/*/messages · every other WhatsApp send
// must route through the Notifications Runtime.

import type { NotificationAdapter, NotificationCapabilities, NotificationMessage, NotificationSendResult } from "../types";

const GRAPH_VERSION = "v20.0";

export const whatsappMetaAdapter: NotificationAdapter = {
  name: "meta",
  channel: "whatsapp",
  capabilities: {
    supportsBody: true,
    supportsMedia: false,                     // Phase 3d.2b · media message support
    supportsTemplate: true,
    supportsDataPayload: false,
    supportsDeliveryReceipts: true,           // Meta sends webhooks · runtime doesn't consume them yet
  },
  async send(msg: NotificationMessage): Promise<NotificationSendResult> {
    const started = Date.now();
    const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
    if (!phoneId || !token) {
      return { ok: false, provider: "meta", reason: "META_WHATSAPP_PHONE_NUMBER_ID or META_WHATSAPP_ACCESS_TOKEN not set", retryable: false };
    }
    const to = msg.to[0];
    if (!to?.address) {
      return { ok: false, provider: "meta", reason: "no recipient", retryable: false };
    }
    // Digit-only phone · Meta rejects "+" prefix but accepts leading digits.
    const phone = to.address.replace(/[^\d]/g, "");
    if (phone.length < 6) {
      return { ok: false, provider: "meta", reason: "invalid phone", retryable: false };
    }

    // Two shapes: template send (msg.template set) OR text send (msg.body set).
    let body: Record<string, unknown>;
    if (msg.template) {
      body = {
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: msg.template,
          language: { code: process.env.META_WHATSAPP_OTP_TEMPLATE_LANG ?? "en_GB" },
          ...(msg.template_params && Object.keys(msg.template_params).length > 0
            ? { components: [{ type: "body", parameters: Object.values(msg.template_params).map((v) => ({ type: "text", text: v })) }] }
            : {}),
        },
      };
    } else if (msg.body) {
      body = {
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { preview_url: false, body: msg.body },
      };
    } else {
      return { ok: false, provider: "meta", reason: "message needs body or template", retryable: false };
    }

    try {
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { messages?: Array<{ id: string }>; error?: { message?: string; code?: number } };
      if (!res.ok || json.error) {
        return {
          ok: false, provider: "meta",
          reason: `${json.error?.code ?? res.status}: ${json.error?.message ?? res.statusText}`,
          retryable: res.status >= 500 || res.status === 429,
        };
      }
      const messageId = json.messages?.[0]?.id ?? `meta-${started}`;
      return {
        ok: true, provider: "meta",
        provider_message_id: messageId,
        sent_at: new Date().toISOString(),
      };
    } catch (err) {
      return {
        ok: false, provider: "meta",
        reason: err instanceof Error ? err.message : "unknown",
        retryable: true,
      };
    }
  },
};

export async function isWhatsappMetaHealthy(): Promise<{ healthy: boolean; detail?: string }> {
  if (!process.env.META_WHATSAPP_PHONE_NUMBER_ID) return { healthy: false, detail: "META_WHATSAPP_PHONE_NUMBER_ID not set" };
  if (!process.env.META_WHATSAPP_ACCESS_TOKEN) return { healthy: false, detail: "META_WHATSAPP_ACCESS_TOKEN not set" };
  return { healthy: true, detail: "meta whatsapp env present · deliverability proven by audit success rate" };
}

// Guard type · used by the registry's capabilities probe.
export const whatsappMetaCapabilities: NotificationCapabilities = whatsappMetaAdapter.capabilities;
