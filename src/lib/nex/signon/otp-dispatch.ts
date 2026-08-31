// src/lib/nex/signon/otp-dispatch.ts
//
// Stage 3.33 · Phase 26 · OTP dispatch adapters (Philip 2026-08-31).
//
// Honesty invariant (matches the Brain's boundary doctrine): when the
// provider credentials aren't configured, the dispatch function returns
// an honest `{ok:false, reason:'provider_not_configured'}` rather than
// silently succeeding. The route surfaces this as HTTP 501 so:
//   · local dev can't accidentally "verify" without a real provider
//   · production alarms fire the moment credentials drop out
//   · tests must explicitly stub the dispatcher
//
// Provider adapter selection:
//   +62 (Indonesia)                → whatsapp (WhatsApp Business API)
//   +44 / +1 / +61 / +65 / +64 / +91 → sms (Twilio-compatible)
//
// Both adapters are pluggable via environment variables. Rotating
// providers (e.g. moving off Twilio) means changing only the adapter
// implementation · the route + client contract stays identical.

export type DispatchChannel = "whatsapp" | "sms";

export type DispatchResult =
  | { ok: true; providerMessageId: string; channel: DispatchChannel }
  | { ok: false; reason: "provider_not_configured" | "provider_error"; detail?: string; channel: DispatchChannel };

/**
 * Map an E.164 prefix to the dispatch channel we use for that market.
 * Kept in ONE place so a business-side decision (e.g. "switch UK from
 * SMS to WhatsApp") is a single line change.
 */
export function channelForPrefix(prefix: string): DispatchChannel {
  return prefix === "+62" ? "whatsapp" : "sms";
}

/**
 * Send an OTP code. Selects the adapter based on prefix. All adapters
 * share the same {ok, reason} contract so the route doesn't branch on
 * channel to interpret the result.
 */
export async function dispatchOtp(input: {
  fullE164: string;
  prefix: string;
  code: string;
}): Promise<DispatchResult> {
  const channel = channelForPrefix(input.prefix);
  if (channel === "whatsapp") {
    return sendViaWhatsApp(input.fullE164, input.code);
  }
  return sendViaSms(input.fullE164, input.code);
}

// ─── WhatsApp Business API adapter ──────────────────────────────────
//
// Env vars: WA_ACCESS_TOKEN · WA_PHONE_NUMBER_ID · WA_TEMPLATE_NAME
// (defaults to "nex_otp" · must exist + be approved in the WhatsApp
// business manager before this works in production).

async function sendViaWhatsApp(fullE164: string, code: string): Promise<DispatchResult> {
  const token   = process.env.WA_ACCESS_TOKEN;
  const phoneId = process.env.WA_PHONE_NUMBER_ID;
  const templateName = process.env.WA_TEMPLATE_NAME ?? "nex_otp";
  if (!token || !phoneId) {
    return { ok: false, reason: "provider_not_configured", channel: "whatsapp" };
  }
  try {
    const to = fullE164.replace(/^\+/, ""); // WA wants no leading +
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: "id" }, // template is authored in ID for Indonesian market
          components: [{
            type: "body",
            parameters: [{ type: "text", text: code }],
          }],
        },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, reason: "provider_error", detail: `whatsapp ${res.status}: ${detail}`, channel: "whatsapp" };
    }
    const body = await res.json().catch(() => null) as { messages?: Array<{ id: string }> } | null;
    const providerMessageId = body?.messages?.[0]?.id ?? "unknown";
    return { ok: true, providerMessageId, channel: "whatsapp" };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "provider_error", detail, channel: "whatsapp" };
  }
}

// ─── SMS adapter · Twilio-compatible ────────────────────────────────
//
// Env vars: TWILIO_ACCOUNT_SID · TWILIO_AUTH_TOKEN · TWILIO_FROM_NUMBER
// The From number must be verified for the destination country in the
// Twilio console. For UK/AU/NZ etc use an SMS-enabled sender.

async function sendViaSms(fullE164: string, code: string): Promise<DispatchResult> {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    return { ok: false, reason: "provider_not_configured", channel: "sms" };
  }
  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const body = new URLSearchParams({
      To:   fullE164,
      From: from,
      Body: `Your NEX code is ${code}. It expires in 5 minutes.`,
    });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type":  "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, reason: "provider_error", detail: `twilio ${res.status}: ${detail}`, channel: "sms" };
    }
    const parsed = await res.json().catch(() => null) as { sid?: string } | null;
    const providerMessageId = parsed?.sid ?? "unknown";
    return { ok: true, providerMessageId, channel: "sms" };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "provider_error", detail, channel: "sms" };
  }
}
