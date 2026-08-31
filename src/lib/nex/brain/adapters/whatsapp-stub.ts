// src/lib/nex/brain/adapters/whatsapp-stub.ts
//
// Stage 3.36 · Adapter: contact_via_whatsapp · STUB (Philip 2026-08-31).
//
// CONSTITUTIONAL choice: this adapter always returns "accepted", never
// "delivered". That is deliberate. The point of this landing is to
// prove the UNKNOWN pipeline works end-to-end without shipping a
// fabrication risk.
//
// When a real Twilio/Meta integration lands, it will produce
// "delivered" (with a real delivery_receipt proof) only when it has
// received a webhook confirming delivery. Until then, every real send
// is honestly UNKNOWN.
//
// This adapter also validates that the target has a whatsapp channel
// with a phone number · without it the adapter rejects (never guesses
// a number).

import type { ActionAdapter, AdapterOutcome } from "../action-audit";

/**
 * Loose phone-number sanity check · doesn't attempt to be an E.164
 * validator, just refuses obviously empty/garbage input. Real
 * validation belongs in the WhatsApp provider.
 */
function looksLikePhone(v: string): boolean {
  return /^\+?[\d\s\-()]{7,}$/.test(v.trim());
}

export const whatsappStubAdapter: ActionAdapter = {
  kind: "contact_via_whatsapp",
  async execute({ target, correlationId }): Promise<AdapterOutcome> {
    const ch = target.contactChannel;
    if (!ch || ch.kind !== "whatsapp") {
      return {
        kind: "rejected",
        reason: "target has no whatsapp contact channel · I won't guess a number",
      };
    }
    if (!looksLikePhone(ch.value)) {
      return {
        kind: "rejected",
        reason: `whatsapp channel value "${ch.value}" doesn't look like a phone number`,
      };
    }
    // Simulate the "call succeeded but delivery not confirmable" state.
    // A real adapter would post to Twilio here and, in the absence of a
    // delivery webhook, return exactly this shape.
    return {
      kind: "accepted",
      pending: {
        correlationId,
        awaitingKind: "not_wired",
        reason: "whatsapp stub v1 · no delivery-receipt integration wired yet · every send is honestly UNKNOWN",
      },
    };
  },
};
