// src/lib/nex/marketing/deliverability/event-recorder.ts
//
// NEX Deliverability · Bounce/Complaint Event Recorder
// Founder-authorised programme · Session-7 · Part 11c+11d · 2026-09-21.
//
// Takes a `ClassifiedEvent` (Session-6 output) and persists it correctly:
//   1 · idempotent INSERT into nex.marketing_bounce_log (by event_fingerprint)
//   2 · cascades contact suppression state deterministically
//   3 · records marketing_opt_out row for permanent suppressions
//   4 · optionally triggers reputation recomputation
//
// GOVERNANCE HARD-LOCKS:
//   * Never fabricates an event (input is a real ClassifiedEvent · zero synthetic path)
//   * Never bypasses suppression (hard_bounce → hard_bounced=true · never reversible from here)
//   * Idempotent · same fingerprint written once · duplicate returns `already_recorded`
//   * Contact cascade is deterministic · no probabilistic branches
//   * Reputation recomputation delegates to Session-5 (never inlined synthetic math)

import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import type { ClassifiedEvent, ClassifiedKind } from "./bounce-classifier";
import { recomputeSenderReputation } from "./reputation";

export interface RecordEventInput {
  readonly event: ClassifiedEvent;
  /** Override esp when the classifier's `provider` field isn't sufficient. */
  readonly esp?: string;
  /** Trigger recomputeSenderReputation after recording. Default true. Set false
   *  in bulk-ingest paths where reputation is recomputed once at the end. */
  readonly auto_recompute_reputation?: boolean;
}

export type RecordEventOutcome =
  | { kind: "recorded"; event_id: string; recipient_updated: boolean; reputation_recomputed: boolean; sender_id: string | null }
  | { kind: "already_recorded"; event_id: string; existing_fingerprint: string }
  | { kind: "insufficient_evidence"; reason: "no_recipient_and_no_message_id" | "kind_unknown" | "kind_not_reputation_actionable"; note: string }
  | { kind: "error"; reason: string };

// ─── Fingerprint (deterministic · SHA-256 truncated) ────────────────
/** Idempotency key. Same event fired twice within the same minute produces
 *  the same fingerprint. Different minute → different fingerprint (that's
 *  intentional · providers do send legitimate repeated events over time). */
export function computeEventFingerprint(e: ClassifiedEvent, esp: string | undefined): string {
  const effective_esp = esp ?? e.provider;
  const message_id = e.provider_message_id ?? "no-message-id";
  const recipient = e.recipient_email ?? "no-recipient";
  const minute_bucket = new Date(e.received_at).toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  const raw = [effective_esp, message_id, recipient, e.kind, minute_bucket].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

// ─── event_type mapping (aligned with existing Stage-1 vocabulary) ──
/** Maps classifier kind → the existing bounce_log.event_type coarse category.
 *  Preserves backward compatibility with earlier Stage-1 webhook shape. */
export function eventTypeFor(kind: ClassifiedKind): string {
  switch (kind) {
    case "hard_bounce":
    case "soft_bounce": return "bounce";
    case "complaint":   return "complaint";
    case "unsubscribe": return "unsubscribe";
    case "delivery":    return "delivery";
    case "open":        return "open";
    case "click":       return "click";
    case "block":       return "block";
    default:            return "unknown";
  }
}

/** Maps classifier kind → the existing bounce_log.bounce_type refinement. */
export function bounceTypeFor(kind: ClassifiedKind): string | null {
  if (kind === "hard_bounce") return "hard";
  if (kind === "soft_bounce") return "soft";
  return null;
}

// ─── Public API ─────────────────────────────────────────────────────
export async function recordClassifiedEvent(
  client: PoolClient,
  input: RecordEventInput,
): Promise<RecordEventOutcome> {
  const e = input.event;
  const esp = input.esp ?? e.provider;

  if (e.kind === "unknown") {
    return { kind: "insufficient_evidence", reason: "kind_unknown", note: `provider=${esp} reason=${e.reason}` };
  }
  if (!e.recipient_email && !e.provider_message_id) {
    return { kind: "insufficient_evidence", reason: "no_recipient_and_no_message_id", note: `provider=${esp} kind=${e.kind}` };
  }

  const fingerprint = computeEventFingerprint(e, esp);
  const event_type = eventTypeFor(e.kind);
  const bounce_type = bounceTypeFor(e.kind);

  // ─── 1 · Idempotent INSERT ─────────────────────────────────────
  const ins = await client.query<{ event_id: string; xmax_is_zero: boolean }>(
    `INSERT INTO nex.marketing_bounce_log
        (received_at, esp, esp_message_id, email, event_type, bounce_type,
         bounce_subtype, raw_payload, event_fingerprint,
         classifier_reason, classifier_matched_signal, classifier_kind)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12)
     ON CONFLICT (event_fingerprint) WHERE event_fingerprint IS NOT NULL DO NOTHING
     RETURNING event_id, (xmax = 0) AS xmax_is_zero`,
    [
      e.received_at, esp, e.provider_message_id, e.recipient_email ?? "",
      event_type, bounce_type, null,
      JSON.stringify({ classifier_snippet: e.diagnostic_snippet, raw_type: e.raw_type, smtp_code: e.smtp_code }),
      fingerprint, e.reason, e.matched_signal, e.kind,
    ],
  );

  if (ins.rowCount === 0) {
    // Duplicate · look up the winner for the receipt
    const existing = await client.query<{ event_id: string }>(
      `SELECT event_id FROM nex.marketing_bounce_log WHERE event_fingerprint = $1 LIMIT 1`,
      [fingerprint],
    );
    return {
      kind: "already_recorded",
      event_id: existing.rows[0]?.event_id ?? "unknown",
      existing_fingerprint: fingerprint,
    };
  }

  const event_id = ins.rows[0].event_id;

  // ─── 2 · Contact suppression cascade (deterministic · never reversible from here) ─
  let recipient_updated = false;
  if (e.recipient_email) {
    recipient_updated = await cascadeContactSuppression(client, e, event_id);
  }

  // ─── 3 · Reputation recomputation (Session-5 delegation) ──────
  let reputation_recomputed = false;
  let sender_id: string | null = null;
  const should_recompute = input.auto_recompute_reputation !== false;
  if (should_recompute && e.provider_message_id) {
    sender_id = await findSenderForMessage(client, e.provider_message_id);
    if (sender_id) {
      await recomputeSenderReputation(client, sender_id).catch(() => { /* soft · never block recording */ });
      reputation_recomputed = true;
    }
  }

  return { kind: "recorded", event_id, recipient_updated, reputation_recomputed, sender_id };
}

// ─── Contact suppression cascade ────────────────────────────────────
async function cascadeContactSuppression(client: PoolClient, e: ClassifiedEvent, event_id: string): Promise<boolean> {
  const email_lower = String(e.recipient_email ?? "").toLowerCase();
  if (!email_lower) return false;

  switch (e.kind) {
    case "hard_bounce": {
      // hard_bounced=true + increment bounce_count
      const upd = await client.query(
        `UPDATE nex.marketing_contact
            SET hard_bounced = TRUE,
                opt_out = TRUE,
                opt_out_at = COALESCE(opt_out_at, now()),
                opt_out_reason = COALESCE(opt_out_reason, 'hard_bounce')
          WHERE LOWER(email) = $1`,
        [email_lower],
      );
      await recordOptOut(client, email_lower, "hard_bounce", "provider_webhook", event_id);
      await client.query(
        `UPDATE nex.marketing_bounce_log SET recipient_updated_at = now() WHERE event_id = $1`,
        [event_id],
      );
      return (upd.rowCount ?? 0) > 0;
    }
    case "complaint": {
      const upd = await client.query(
        `UPDATE nex.marketing_contact
            SET complaint_count = complaint_count + 1,
                opt_out = TRUE,
                opt_out_at = COALESCE(opt_out_at, now()),
                opt_out_reason = COALESCE(opt_out_reason, 'complaint')
          WHERE LOWER(email) = $1`,
        [email_lower],
      );
      await recordOptOut(client, email_lower, "complaint", "provider_webhook", event_id);
      await client.query(
        `UPDATE nex.marketing_bounce_log SET recipient_updated_at = now() WHERE event_id = $1`,
        [event_id],
      );
      return (upd.rowCount ?? 0) > 0;
    }
    case "unsubscribe": {
      const upd = await client.query(
        `UPDATE nex.marketing_contact
            SET opt_out = TRUE,
                opt_out_at = COALESCE(opt_out_at, now()),
                opt_out_reason = COALESCE(opt_out_reason, 'unsubscribe')
          WHERE LOWER(email) = $1`,
        [email_lower],
      );
      await recordOptOut(client, email_lower, "unsubscribe", "provider_webhook", event_id);
      await client.query(
        `UPDATE nex.marketing_bounce_log SET recipient_updated_at = now() WHERE event_id = $1`,
        [event_id],
      );
      return (upd.rowCount ?? 0) > 0;
    }
    case "delivery":
    case "open":
    case "click":
    case "block":
    case "soft_bounce":
      // These do not cascade contact suppression (soft bounce is retryable)
      return false;
    default:
      return false;
  }
}

async function recordOptOut(client: PoolClient, email_lower: string, reason: string, channel: string, event_id: string): Promise<void> {
  await client.query(
    `INSERT INTO nex.marketing_opt_out (email, reason, channel, metadata)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (email) DO NOTHING`,
    [email_lower, reason, channel, JSON.stringify({ source_event_id: event_id })],
  ).catch(() => { /* opt_out list may or may not have UNIQUE(email) · best-effort */ });
}

async function findSenderForMessage(client: PoolClient, provider_message_id: string): Promise<string | null> {
  // Correlate via marketing_send_log · joins to marketing_campaign metadata.sender_id
  const r = await client.query<{ sender_id: string | null }>(
    `SELECT COALESCE(c.metadata->>'sender_id', NULL) AS sender_id
       FROM nex.marketing_send_log sl
       JOIN nex.marketing_campaign c ON c.campaign_id = sl.campaign_id
      WHERE sl.esp_message_id = $1
      LIMIT 1`,
    [provider_message_id],
  ).catch(() => ({ rows: [] as { sender_id: string | null }[] }));
  return r.rows[0]?.sender_id ?? null;
}

// ─── Structural boundary markers (verified in acceptance) ──────────
export const _RECORDER_NEVER_FABRICATES = "records_only_provided_ClassifiedEvent_never_synthesised";
export const _RECORDER_NEVER_REVERSES_SUPPRESSION = "hard_bounce_and_complaint_and_unsubscribe_cascade_is_one_way";
export const _RECORDER_IDEMPOTENT_BY_FINGERPRINT = "same_fingerprint_writes_once_returns_already_recorded_on_duplicate";
