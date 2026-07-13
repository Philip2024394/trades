// Trade auth + merchant notifications — dispatch adapters.
//
// Two use-cases share the same channel plumbing:
//   1. Trade OTP send (WhatsApp / SMS / Email) via dispatchOtp()
//   2. Merchant quote-request notification via dispatchMerchantNotification()
//
// Both fall back to console-log in dev when the provider env is missing.
//
// Providers are selected by env vars. If none is configured, the
// dispatch is a no-op that only logs to the server console (dev mode).
//
// Env matrix:
//   WhatsApp:
//     META_WHATSAPP_PHONE_NUMBER_ID
//     META_WHATSAPP_ACCESS_TOKEN
//     META_WHATSAPP_OTP_TEMPLATE   (e.g. "trade_center_otp")
//     META_WHATSAPP_OTP_TEMPLATE_LANG (defaults "en_GB")
//   SMS:
//     TWILIO_ACCOUNT_SID
//     TWILIO_AUTH_TOKEN
//     TWILIO_MESSAGING_SERVICE_SID (or TWILIO_FROM_NUMBER)
//   Email:
//     RESEND_API_KEY
//     RESEND_FROM_ADDRESS          (defaults noreply@theconstructionnotebook.com)

import "server-only";

export type OtpChannel = "whatsapp" | "sms" | "email";

/** Best-effort OTP send. Never throws to the caller. */
export async function dispatchOtp(
  channel: OtpChannel,
  destination: string,
  code: string
): Promise<{ ok: boolean; provider: string; note?: string }> {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(`[TC AUTH · ${channel.toUpperCase()}] Code ${code} → ${destination}`);
  }

  try {
    switch (channel) {
      case "whatsapp": return await sendWhatsApp(destination, code);
      case "sms":      return await sendSms(destination, code);
      case "email":    return await sendEmail(destination, code);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[TC AUTH] dispatch failed:", err);
    return { ok: false, provider: "unknown", note: err instanceof Error ? err.message : "err" };
  }
}

// -----------------------------------------------------------
// Merchant notification — new quote request landed
// -----------------------------------------------------------
export type MerchantNotificationInput = {
  merchantWhatsApp?: string | null;    // E.164 including +
  merchantEmail?: string | null;
  merchantName: string;
  tradeDisplayName: string;
  itemCount: number;
  totalGbpEstimate: number;
  deliveryTiming: string;
  requestUrl: string;                  // where the merchant opens it
};

export async function dispatchMerchantNotification(input: MerchantNotificationInput): Promise<{ ok: boolean; channels: string[] }> {
  const channels: string[] = [];
  const message =
    `New Trade Center quote request\n` +
    `From: ${input.tradeDisplayName}\n` +
    `${input.itemCount} item${input.itemCount === 1 ? "" : "s"} · est. £${input.totalGbpEstimate.toFixed(2)}\n` +
    `Delivery: ${input.deliveryTiming}\n\n` +
    `Price it here: ${input.requestUrl}`;

  if (input.merchantWhatsApp) {
    const wa = await sendWhatsAppText(input.merchantWhatsApp, message);
    if (wa.ok) channels.push("whatsapp");
  }
  if (input.merchantEmail) {
    const em = await sendMerchantEmail(input.merchantEmail, input.merchantName, message, input.requestUrl);
    if (em.ok) channels.push("email");
  }
  if (channels.length === 0 && process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(`[TC MERCHANT NOTIFY] (no channel configured) ${input.merchantName}:\n${message}`);
    channels.push("dev-console");
  }
  return { ok: channels.length > 0, channels };
}

async function sendWhatsAppText(dest: string, message: string): Promise<{ ok: boolean }> {
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const token   = process.env.META_WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) return { ok: false };
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method:  "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: dest.replace(/^\+/, ""),
        type: "text",
        text: { preview_url: true, body: message }
      })
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

async function sendMerchantEmail(
  dest: string,
  merchantName: string,
  body: string,
  url: string
): Promise<{ ok: boolean }> {
  const key  = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_ADDRESS ?? "Trade Center <noreply@theconstructionnotebook.com>";
  if (!key) return { ok: false };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [dest],
        subject: `New quote request — ${merchantName}`,
        text: body,
        html:
          `<p style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">` +
          body.replace(/\n/g, "<br>") +
          `</p><p style="margin-top:24px"><a href="${url}" style="display:inline-block;background:#166534;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:900;letter-spacing:0.04em;text-transform:uppercase">Price it now</a></p>`
      })
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

// -----------------------------------------------------------
// WhatsApp Business Cloud API — OTP send (template message)
// -----------------------------------------------------------
async function sendWhatsApp(dest: string, code: string): Promise<{ ok: boolean; provider: string; note?: string }> {
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const token   = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const tmpl    = process.env.META_WHATSAPP_OTP_TEMPLATE;
  const lang    = process.env.META_WHATSAPP_OTP_TEMPLATE_LANG ?? "en_GB";
  if (!phoneId || !token || !tmpl) {
    return { ok: false, provider: "whatsapp", note: "env_missing_dev_only" };
  }

  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method:  "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: dest.replace(/^\+/, ""),
      type: "template",
      template: {
        name: tmpl,
        language: { code: lang },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: code }]
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: code }]
          }
        ]
      }
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, provider: "whatsapp", note: `${res.status}: ${body.slice(0, 200)}` };
  }
  return { ok: true, provider: "whatsapp" };
}

// -----------------------------------------------------------
// Twilio SMS
// -----------------------------------------------------------
async function sendSms(dest: string, code: string): Promise<{ ok: boolean; provider: string; note?: string }> {
  const sid    = process.env.TWILIO_ACCOUNT_SID;
  const token  = process.env.TWILIO_AUTH_TOKEN;
  const from   = process.env.TWILIO_FROM_NUMBER;
  const svc    = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!sid || !token || (!from && !svc)) {
    return { ok: false, provider: "sms", note: "env_missing_dev_only" };
  }

  const body = new URLSearchParams();
  body.set("To", dest);
  body.set("Body", `Trade Center code: ${code}. Never share this code.`);
  if (svc) body.set("MessagingServiceSid", svc);
  else if (from) body.set("From", from);

  const authHeader = "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method:  "POST",
    headers: { authorization: authHeader, "content-type": "application/x-www-form-urlencoded" },
    body:    body.toString()
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    return { ok: false, provider: "sms", note: `${res.status}: ${errBody.slice(0, 200)}` };
  }
  return { ok: true, provider: "sms" };
}

// -----------------------------------------------------------
// Resend email
// -----------------------------------------------------------
async function sendEmail(dest: string, code: string): Promise<{ ok: boolean; provider: string; note?: string }> {
  const key  = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_ADDRESS ?? "Trade Center <noreply@theconstructionnotebook.com>";
  if (!key) return { ok: false, provider: "email", note: "env_missing_dev_only" };

  const res = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [dest],
      subject: "Your Trade Center sign-in code",
      html: `<p>Your sign-in code:</p><p style="font-size:28px;font-weight:900;letter-spacing:0.4em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${code}</p><p>Expires in 5 minutes. If you didn't request this, ignore this email.</p>`,
      text: `Your Trade Center sign-in code: ${code}\n\nExpires in 5 minutes. If you didn't request this, ignore this email.`
    })
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    return { ok: false, provider: "email", note: `${res.status}: ${errBody.slice(0, 200)}` };
  }
  return { ok: true, provider: "email" };
}
