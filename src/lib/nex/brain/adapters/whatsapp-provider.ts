// src/lib/nex/brain/adapters/whatsapp-provider.ts
//
// Stage 3.38 · WhatsAppProvider interface (Philip 2026-08-31).
//
// CONSTITUTIONAL:
//   · The provider is BELOW the state machine · it never controls
//     which ChainStage NEX advances to. It reports what happened at
//     the wire and the adapter maps it deterministically to an
//     AdapterOutcome (which is the ONLY shape the executor
//     understands).
//   · A provider "accepted" outcome maps to adapter "accepted" ·
//     which maps to chain UNKNOWN. Never rounded up to VERIFIED.
//   · A provider timeout maps to adapter "accepted" too · because
//     we don't know if the message went out. NEVER FAILED.
//   · A provider "delivered" outcome (with a real webhook-or-sync
//     delivery proof) is the ONLY path to chain VERIFIED.
//
// v1 ships this INTERFACE. First concrete provider (Meta Cloud API)
// lands as a separate credential-ops landing.

/**
 * The outcome shape every WhatsAppProvider must return from send().
 *
 * Note: providers MUST NOT invent a "delivered" outcome unless they
 * have received a real delivery-receipt event (usually via webhook)
 * OR their API returned synchronous delivery confirmation. If they
 * only got a "queued"/"accepted" response, they MUST return
 * `accepted` · never `delivered`. The adapter cannot audit this
 * downstream · providers carry the constitutional responsibility.
 */
export type ProviderSendOutcome =
  | {
      kind: "delivered";
      providerMessageId: string;
      providerRawStatus: string;
      deliveredAt: string;              // ISO
    }
  | {
      kind: "accepted";
      providerMessageId: string;
      providerRawStatus: string;        // "queued" · "sent" · etc.
    }
  | {
      kind: "rejected";
      reason: string;
      providerRawStatus?: string;
    }
  | {
      kind: "unreachable";
      reason: string;
    };

/** Optional shape for a reconciliation lookup once webhooks are wired. */
export type ProviderStatusOutcome =
  | { kind: "delivered"; deliveredAt: string; providerRawStatus: string }
  | { kind: "failed";    reason: string;      providerRawStatus?: string }
  | { kind: "unknown";   reason: string };

/**
 * The interface a real WhatsApp provider implementation must satisfy.
 * The provider is a black box to the adapter · the adapter never
 * inspects provider internals.
 */
export interface WhatsAppProvider {
  /** Stable identifier · "meta_cloud" · "twilio" · "wablas" · etc. */
  readonly id: string;
  /**
   * Does the provider accept an idempotency key on send? If false,
   * the outbox MUST refuse retry until reconciliation lands ·
   * because "send again" without dedup at the provider is a
   * duplicate-message risk.
   */
  readonly supportsIdempotencyKey: boolean;

  send(input: {
    toE164:         string;         // "+62812..."
    body:           string;
    /** The action-chain correlationId · MUST become the provider's
     *  idempotency key when supportsIdempotencyKey=true. */
    idempotencyKey: string;
  }): Promise<ProviderSendOutcome>;

  /**
   * Look up final status by providerMessageId. Called by the
   * reconciliation landing (not this landing) to resolve UNKNOWN
   * outbox entries.
   */
  getStatus?(providerMessageId: string): Promise<ProviderStatusOutcome>;
}
