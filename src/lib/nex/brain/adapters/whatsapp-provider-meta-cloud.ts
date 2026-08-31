// src/lib/nex/brain/adapters/whatsapp-provider-meta-cloud.ts
//
// Stage 3.38 · Meta Cloud API provider skeleton (Philip 2026-08-31).
//
// The FIRST concrete WhatsAppProvider that will land credentials.
// This file ships the SHAPE — request/response mapping to
// ProviderSendOutcome — but NOT the network call. That lands with the
// credential ops pass (env var wiring, business-account verification,
// webhook endpoint, secrets rotation).
//
// Meta Cloud API relevant notes for future implementation:
//   · Endpoint: POST https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages
//   · Headers: Authorization: Bearer {ACCESS_TOKEN}
//   · Request: { messaging_product: "whatsapp", to: "<E164 no plus>", type: "text", text: { body } }
//   · Response (2xx): { messages: [{ id: "wamid.xxx" }] } · this is the providerMessageId
//   · Delivery evidence arrives via Webhook (Meta calls YOUR endpoint)
//     with { entry[].changes[].value.statuses[].status = "delivered" | "read" | "failed" }
//   · Rate limit: 250/s per phone number for the messaging tier
//   · Idempotency: Meta does NOT support an idempotency key on this
//     endpoint · we must rely on outbox + no-auto-retry to prevent
//     duplicates.

import type { WhatsAppProvider, ProviderSendOutcome, ProviderStatusOutcome } from "./whatsapp-provider";

export type MetaCloudCredentials = {
  phoneNumberId: string;
  accessToken:   string;
  apiVersion?:   string;         // default "v20.0"
};

/**
 * Build a Meta Cloud provider. `fetchImpl` is injectable so tests can
 * exercise the request-mapping without hitting the network · the
 * default reaches for global.fetch which will fail at credential-
 * landing-time until the ops pass wires it.
 */
export function makeMetaCloudProvider(input: {
  credentials: MetaCloudCredentials;
  fetchImpl?: (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }>;
}): WhatsAppProvider {
  const apiVersion = input.credentials.apiVersion ?? "v20.0";
  const url = `https://graph.facebook.com/${apiVersion}/${input.credentials.phoneNumberId}/messages`;
  const fetchImpl = input.fetchImpl ?? (globalThis.fetch as unknown as typeof input.fetchImpl);

  return {
    id: "meta_cloud",
    // Meta Cloud API does NOT support an idempotency header. Outbox
    // + no-auto-retry MUST enforce dedup instead.
    supportsIdempotencyKey: false,

    async send({ toE164, body }): Promise<ProviderSendOutcome> {
      if (!fetchImpl) {
        // Credentials landing hasn't wired global.fetch or an
        // injectable · treat as unreachable rather than throw.
        return { kind: "unreachable", reason: "meta_cloud provider: no fetch implementation available" };
      }
      const to = toE164.replace(/^\+/, "");
      const payload = {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      };
      let res: Awaited<ReturnType<NonNullable<typeof input.fetchImpl>>>;
      try {
        res = await fetchImpl(url, {
          method: "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${input.credentials.accessToken}`,
          },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        return {
          kind: "unreachable",
          reason: `meta_cloud fetch threw: ${err instanceof Error ? err.message : String(err)}`,
        };
      }

      if (res.status >= 500) {
        // Server error · we don't know if the message queued.
        return { kind: "unreachable", reason: `meta_cloud ${res.status}` };
      }
      let json: unknown;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (!res.ok) {
        const reason = extractError(json) ?? `meta_cloud ${res.status}`;
        return { kind: "rejected", reason, providerRawStatus: `http_${res.status}` };
      }

      const messageId = extractMessageId(json);
      if (!messageId) {
        // 2xx but no message id · odd · treat as unreachable rather
        // than fabricate a providerMessageId.
        return { kind: "unreachable", reason: "meta_cloud 2xx without message id" };
      }

      // Meta returns "accepted" semantics on 2xx · delivery evidence
      // arrives later via webhook. We NEVER claim delivered here.
      return {
        kind: "accepted",
        providerMessageId: messageId,
        providerRawStatus: "accepted",
      };
    },

    async getStatus(providerMessageId): Promise<ProviderStatusOutcome> {
      // Meta Cloud doesn't expose per-message polling · the canonical
      // status source is the incoming webhook. Reconciliation landing
      // stores webhook events keyed by wamid, then getStatus reads
      // from that store. Until then, honest UNKNOWN.
      return {
        kind: "unknown",
        reason: `meta_cloud getStatus not wired · webhook reconciliation is the canonical source (${providerMessageId})`,
      };
    },
  };
}

function extractMessageId(json: unknown): string | undefined {
  if (!json || typeof json !== "object") return undefined;
  const j = json as { messages?: Array<{ id?: string }> };
  return j.messages?.[0]?.id;
}

function extractError(json: unknown): string | undefined {
  if (!json || typeof json !== "object") return undefined;
  const j = json as { error?: { message?: string; code?: number } };
  if (!j.error) return undefined;
  return `meta_cloud error: ${j.error.message ?? "unknown"} (code ${j.error.code ?? "-"})`;
}
