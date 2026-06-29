// WhatsApp Business API helper — STUB.
//
// Until WHATSAPP_BUSINESS_TOKEN + WHATSAPP_BUSINESS_PHONE_ID are
// configured in the deployment env, sendWhatsAppMessage() short-circuits
// with { ok: true, skipped: true } so callers can fire-and-forget without
// needing to branch.
//
// When you're ready to wire it for real:
//   1. Set the two env vars in Vercel project settings.
//   2. Replace the marked block below with a POST to
//      https://graph.facebook.com/v20.0/<phone_id>/messages
//      using `Authorization: Bearer <token>`.
//   3. Keep the no-key fallback intact so dev environments don't break.
import "server-only";

export type SendWhatsAppResult = {
  ok: boolean;
  skipped?: boolean;
  message_id?: string;
  error?: string;
};

export async function sendWhatsAppMessage(
  to: string,
  body: string
): Promise<SendWhatsAppResult> {
  const token = process.env.WHATSAPP_BUSINESS_TOKEN;
  const phoneId = process.env.WHATSAPP_BUSINESS_PHONE_ID;
  if (!token || !phoneId) {
    return { ok: true, skipped: true };
  }
  if (!to || !body) {
    return { ok: false, error: "Missing recipient or body." };
  }

  // TODO: implement when env vars set.
  //
  // Skeleton (uncomment when going live):
  //
  // const res = await fetch(
  //   `https://graph.facebook.com/v20.0/${phoneId}/messages`,
  //   {
  //     method: "POST",
  //     headers: {
  //       Authorization: `Bearer ${token}`,
  //       "Content-Type": "application/json"
  //     },
  //     body: JSON.stringify({
  //       messaging_product: "whatsapp",
  //       to: to.replace(/\D/g, ""),
  //       type: "text",
  //       text: { body }
  //     })
  //   }
  // );
  // const json = (await res.json().catch(() => ({}))) as {
  //   messages?: { id: string }[];
  //   error?: { message?: string };
  // };
  // if (!res.ok) {
  //   return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
  // }
  // return { ok: true, message_id: json.messages?.[0]?.id };

  return { ok: true, skipped: true };
}
