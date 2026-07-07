// WhatsApp send helper.
//
// Every attempt gets logged to os_whatsapp_logs, whether or not it
// actually leaves the building. This gives the admin dashboard a full
// audit trail: "did we try to send, what was the payload, did it
// succeed?"
//
// Provider: Meta WhatsApp Cloud API (direct — no third-party middle).
// Required env:
//   META_WHATSAPP_TOKEN            — Bearer token from Meta Business
//   META_WHATSAPP_PHONE_NUMBER_ID  — the sender phone number ID
// If either is missing, we log the attempt with status
// 'skipped_no_provider' and return. The admin dashboard shows this
// state so it's obvious we need credentials before messages fly.
//
// No opt-in verification — homeowner puts a WhatsApp number in the
// wizard, we treat that as consent to receive brief-related
// notifications from the trades they selected.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const META_TOKEN = process.env.META_WHATSAPP_TOKEN;
const META_PHONE_ID = process.env.META_WHATSAPP_PHONE_NUMBER_ID;

export type WhatsAppPurpose =
  | "brief_to_trade"
  | "reply_to_homeowner"
  | "admin_test"
  | "other";

export type WhatsAppSendInput = {
  purpose: WhatsAppPurpose;
  toNumber: string;
  body: string;
  fromNumber?: string;
  linkedProjectId?: string | null;
  linkedBusinessId?: string | null;
  linkedPartyId?: string | null;
};

export type WhatsAppSendResult = {
  ok: boolean;
  status: string;
  logId: string | null;
  error?: string;
};

// Rough E.164 sanity — expects `+<country><subscriber>`, 8–15 digits
// after the +. We do not reject invalid formats — we log them with
// status='skipped_no_number' so admin can see what came in.
function looksLikeE164(n: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(n.replace(/\s+/g, ""));
}

function normalise(n: string): string {
  return n.replace(/\s+/g, "");
}

async function logAttempt(
  input: WhatsAppSendInput,
  status: string,
  extras: {
    provider?: string;
    providerMessageId?: string;
    errorMessage?: string;
  } = {}
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("os_whatsapp_logs")
    .insert({
      purpose: input.purpose,
      from_number: input.fromNumber ?? null,
      to_number: input.toNumber,
      body: input.body,
      status,
      provider: extras.provider ?? null,
      provider_message_id: extras.providerMessageId ?? null,
      error_message: extras.errorMessage ?? null,
      linked_project_id: input.linkedProjectId ?? null,
      linked_business_id: input.linkedBusinessId ?? null,
      linked_party_id: input.linkedPartyId ?? null,
      sent_at:
        status === "sent" || status === "delivered"
          ? new Date().toISOString()
          : null
    })
    .select("id")
    .single();
  return (data?.id as string) ?? null;
}

export async function sendWhatsapp(
  input: WhatsAppSendInput
): Promise<WhatsAppSendResult> {
  const to = normalise(input.toNumber);

  if (!to) {
    const id = await logAttempt(
      { ...input, toNumber: to },
      "skipped_no_number"
    );
    return { ok: false, status: "skipped_no_number", logId: id };
  }

  if (!META_TOKEN || !META_PHONE_ID) {
    const id = await logAttempt(
      { ...input, toNumber: to },
      "skipped_no_provider"
    );
    return { ok: false, status: "skipped_no_provider", logId: id };
  }

  if (!looksLikeE164(to)) {
    const id = await logAttempt(
      { ...input, toNumber: to },
      "skipped_no_number",
      { errorMessage: "invalid E.164 format" }
    );
    return { ok: false, status: "skipped_no_number", logId: id };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${META_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${META_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.replace(/^\+/, ""), // Meta wants no leading +
          type: "text",
          text: { body: input.body.slice(0, 4096) }
        })
      }
    );
    const raw = await res.text();
    let parsed: { messages?: Array<{ id: string }>; error?: { message: string } } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* non-JSON response */
    }
    if (!res.ok) {
      const errMsg = parsed.error?.message ?? `HTTP ${res.status}`;
      const id = await logAttempt(
        { ...input, toNumber: to },
        "failed",
        { provider: "meta", errorMessage: errMsg }
      );
      return { ok: false, status: "failed", logId: id, error: errMsg };
    }
    const messageId = parsed.messages?.[0]?.id;
    const id = await logAttempt(
      { ...input, toNumber: to },
      "sent",
      { provider: "meta", providerMessageId: messageId }
    );
    return { ok: true, status: "sent", logId: id };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "unknown error";
    const id = await logAttempt(
      { ...input, toNumber: to },
      "failed",
      { provider: "meta", errorMessage: errMsg }
    );
    return { ok: false, status: "failed", logId: id, error: errMsg };
  }
}

// Bulk send — used when a homeowner picks multiple trades.
// Fires in parallel; each result contains its own status.
export async function sendWhatsappBulk(
  items: WhatsAppSendInput[]
): Promise<WhatsAppSendResult[]> {
  return Promise.all(items.map((i) => sendWhatsapp(i)));
}
