// src/lib/nex/config/whatsapp.ts
//
// Stage 3.39 · WhatsApp production config loader (Philip 2026-08-31).
//
// Env vars (read at function entry · never cached globally · per repo
// convention):
//
//   NEX_META_PHONE_NUMBER_ID
//     Meta phone-number-id (numeric string · comes from Meta Business
//     WhatsApp Manager). Used as {phoneNumberId} in the API URL.
//
//   NEX_META_ACCESS_TOKEN
//     Bearer token for Meta Cloud API. Rotate on schedule · never log.
//
//   NEX_META_APP_SECRET
//     Meta App Secret · used to verify HMAC-SHA256 on inbound webhook
//     bodies. If not set, the webhook route rejects all POSTs (401).
//
//   NEX_WHATSAPP_WEBHOOK_VERIFY_TOKEN
//     Token you configured in Meta's webhook subscription form. Used
//     by the GET verification handshake. Absent → 403 all GETs.
//
//   NEX_WHATSAPP_OUTBOX_DRIVER = "memory" | "postgres"
//     Selects which outbox driver is active. Default "memory" (safe
//     for dev/test). Production must set "postgres" explicitly.
//
//   NEX_META_API_VERSION (optional · default "v20.0")
//     Meta Graph API version pinned in the request URL. Bump in
//     controlled steps · Meta deprecates old versions on a schedule.
//
// DOCTRINE:
//   · Getters return `undefined` (not empty string) when the env var
//     is missing or blank. Callers must decide what to do (usually:
//     refuse to operate).
//   · No secret value ever appears in a log line · toString() the
//     shape not the values.

export type WhatsAppConfig = {
  metaPhoneNumberId?:  string;
  metaAccessToken?:    string;
  metaAppSecret?:      string;
  webhookVerifyToken?: string;
  outboxDriver:        "memory" | "postgres";
  metaApiVersion:      string;
};

function nonBlank(v: string | undefined): string | undefined {
  if (v == null) return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

export function loadWhatsAppConfig(): WhatsAppConfig {
  const rawDriver = nonBlank(process.env.NEX_WHATSAPP_OUTBOX_DRIVER)?.toLowerCase();
  const driver: "memory" | "postgres" =
    rawDriver === "postgres" ? "postgres" : "memory";
  return {
    metaPhoneNumberId:  nonBlank(process.env.NEX_META_PHONE_NUMBER_ID),
    metaAccessToken:    nonBlank(process.env.NEX_META_ACCESS_TOKEN),
    metaAppSecret:      nonBlank(process.env.NEX_META_APP_SECRET),
    webhookVerifyToken: nonBlank(process.env.NEX_WHATSAPP_WEBHOOK_VERIFY_TOKEN),
    outboxDriver:       driver,
    metaApiVersion:     nonBlank(process.env.NEX_META_API_VERSION) ?? "v20.0",
  };
}

/** Return whether the config is complete enough to SEND (not just receive webhooks). */
export function canSendWhatsApp(cfg: WhatsAppConfig): boolean {
  return !!(cfg.metaPhoneNumberId && cfg.metaAccessToken);
}

/** Return whether the config is complete enough to RECEIVE webhooks. */
export function canReceiveWhatsAppWebhooks(cfg: WhatsAppConfig): boolean {
  return !!(cfg.metaAppSecret && cfg.webhookVerifyToken);
}
