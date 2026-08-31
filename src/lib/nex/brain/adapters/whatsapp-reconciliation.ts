// src/lib/nex/brain/adapters/whatsapp-reconciliation.ts
//
// Stage 3.39 · Webhook → outbox reconciliation (Philip 2026-08-31).
//
// CONSTITUTIONAL:
//   · A webhook event is EVIDENCE of what happened at the wire.
//     Reconciliation is the ONLY path that converts an ACCEPTED
//     outbox row into CONFIRMED.
//   · CONFIRMED NEVER regresses. A late-arriving "sent" event for a
//     row that has already gone CONFIRMED (via delivered/read) is a
//     no-op. Enforced at the outbox driver.
//   · Unknown wamid → outcome "no_matching_entry". Never fabricates
//     an outbox row from a webhook · that would make the wamid the
//     source of truth over the outbox.
//   · Idempotent: replaying the same webhook event yields the same
//     terminal state.

import { findOutboxByProviderMessageId, markOutcome } from "./whatsapp-outbox";
import type { OutboxEntry } from "./whatsapp-outbox";

/**
 * Canonical shape of one status event extracted from Meta's webhook
 * payload (`entry[].changes[].value.statuses[]`).
 *
 * See Meta Cloud API docs:
 *   status ∈ { "sent", "delivered", "read", "failed" }
 *   errors[] present when status == "failed"
 */
export type MetaStatusEvent = {
  wamid:      string;         // "wamid.xxx" · provider_message_id
  status:     "sent" | "delivered" | "read" | "failed";
  timestamp:  string;         // ISO or unix seconds — caller normalises
  errorText?: string;
  errorCode?: number;
};

export type ReconciliationOutcome =
  | { kind: "resolved";         entry: OutboxEntry; reason: string }
  | { kind: "no_change";        entry: OutboxEntry; reason: string }
  | { kind: "no_matching_entry"; wamid: string; reason: string };

/**
 * Apply one Meta status event to the outbox. Deterministic mapping:
 *   sent      → ACCEPTED  (no-op if already CONFIRMED)
 *   delivered → CONFIRMED
 *   read      → CONFIRMED (delivery implies read is stronger evidence)
 *   failed    → REJECTED  (unless already CONFIRMED · CONFIRMED wins)
 */
export async function reconcileMetaStatus(
  event: MetaStatusEvent,
  opts: { now?: () => string } = {},
): Promise<ReconciliationOutcome> {
  const now = opts.now ?? (() => new Date().toISOString());

  const entry = await findOutboxByProviderMessageId(event.wamid);
  if (!entry) {
    // We never inbox a row from a webhook · the outbox is source of
    // truth. Return honest not-found · webhook handler should log
    // this as a warning (possible drift / dev environment mismatch /
    // messages sent outside our system).
    return {
      kind: "no_matching_entry",
      wamid: event.wamid,
      reason: `webhook received for wamid=${event.wamid} but no outbox row matches · this system did not send this message`,
    };
  }

  const mapped = mapStatus(event);
  if (!mapped) {
    return {
      kind: "no_change",
      entry,
      reason: `event status "${event.status}" has no outbox mapping · ignored`,
    };
  }

  // If the current entry is already CONFIRMED, the outbox layer will
  // block a regression to ACCEPTED/REJECTED. We still call markOutcome
  // so any late-arriving read receipt updates resolution_reason
  // consistently.
  const next = await markOutcome(entry.correlationId, {
    status:           mapped,
    providerMessageId: event.wamid,
    resolutionReason: buildResolutionReason(event, mapped),
    now,
  });
  if (next.status === entry.status && next.resolvedAt === entry.resolvedAt) {
    return { kind: "no_change", entry: next, reason: "already at this status" };
  }
  return {
    kind: "resolved",
    entry: next,
    reason: `status ${event.status} → outbox ${mapped}`,
  };
}

function mapStatus(event: MetaStatusEvent): "ACCEPTED" | "CONFIRMED" | "REJECTED" | null {
  switch (event.status) {
    case "sent":      return "ACCEPTED";
    case "delivered": return "CONFIRMED";
    case "read":      return "CONFIRMED";
    case "failed":    return "REJECTED";
    default:          return null;
  }
}

function buildResolutionReason(event: MetaStatusEvent, mapped: string): string {
  const parts = [`meta webhook: status=${event.status} at=${event.timestamp} → outbox=${mapped}`];
  if (event.errorText) parts.push(`error=${event.errorText}`);
  if (event.errorCode) parts.push(`code=${event.errorCode}`);
  return parts.join(" · ");
}

// ─── Batch extractor · unpack Meta webhook body into events ────────

type MetaWebhookBody = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        statuses?: Array<{
          id?:        string;
          status?:    string;
          timestamp?: string;
          errors?: Array<{ title?: string; message?: string; code?: number }>;
        }>;
      };
    }>;
  }>;
};

/**
 * Turn a raw Meta webhook body into a flat list of `MetaStatusEvent`.
 * Ignores non-status events (message-received etc.) · this landing is
 * only concerned with outbound reconciliation.
 */
export function extractStatusEvents(body: unknown): MetaStatusEvent[] {
  const out: MetaStatusEvent[] = [];
  const b = body as MetaWebhookBody;
  if (!b?.entry) return out;
  for (const e of b.entry) {
    for (const ch of e.changes ?? []) {
      for (const s of ch.value?.statuses ?? []) {
        if (!s.id || !s.status || !s.timestamp) continue;
        if (!["sent", "delivered", "read", "failed"].includes(s.status)) continue;
        out.push({
          wamid:     s.id,
          status:    s.status as MetaStatusEvent["status"],
          timestamp: s.timestamp,
          errorText: s.errors?.[0]?.message ?? s.errors?.[0]?.title,
          errorCode: s.errors?.[0]?.code,
        });
      }
    }
  }
  return out;
}
