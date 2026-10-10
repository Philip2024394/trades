// src/lib/nex-native/emergency/emergency-notification-service.ts
//
// NEX Emergency Help · multi-channel fan-out service (L3).
//
// Public contract called by L1's `_notification-hook.ts` on every
// incident state transition:
//
//   await fanOutForTransition({
//     incidentId,
//     transition,              // one of the 5 sealed transitions
//     requesterAccountId,
//     requesterLabel,          // display-friendly name (falls back to anon)
//     simulated,               // v1 PILOT always TRUE
//   });
//
// Semantics (sealed 2026-10-10):
//   · transition="pending_confirmation"   · FIRST-FAN-OUT to trusted
//     contacts (email where present · SMS stub where present ·
//     in-app push stub).
//   · transition="active"                 · CONFIRMED-FAN-OUT to the
//     same trusted contacts + opted-in nearby responders (in-app push).
//   · transition="revoked_within_window"  · REVOKED-FAN-OUT to anyone
//     who received the first-fan-out.
//   · transition="cancelled" / "resolved" · CLOSED-FAN-OUT to anyone
//     notified so far.
//
// Idempotency guarantees:
//   · Each (incident, transition, channel, recipient) attempt derives
//     a stable key via sha256. Re-firing the same transition is a
//     no-op (the audit log swallows duplicate inserts).
//
// Honesty guarantees:
//   · SMS/WhatsApp attempts always write an 'honest_blocked' audit
//     row with the sealed reason. We never fabricate delivery.
//   · In-app push is stub-only until the push infra is wired. The
//     audit row records 'honest_blocked' with reason='in_app_push_not_wired'.
//   · Email in v1 is simulated · the audit records 'ok' with
//     `simulated=true` and the synthetic provider_message_id.
//
// Side-effect freedom on import:
//   · The module makes NO queries on import. L1's dynamic-import
//     resolver is safe. All DB access happens inside the exported
//     fanOutForTransition().

import "server-only";

import { listContacts } from "./trusted-contacts-service";
import { withClient } from "@/lib/nex/db";
import {
  composeEmergencyEmailBody,
  sendEmergencyEmail,
} from "./_email-adapter-for-emergency";
import { sendEmergencySMS } from "./_sms-adapter-stub";
import {
  identifierFromAccount,
  identifierFromEmail,
  identifierFromPhone,
  makeIdempotencyKey,
  writeFanOutAudit,
  type FanOutChannel,
  type FanOutOutcome,
  type FanOutTransition,
} from "./_fanout-audit-log";

// =====================================================================
// Public contract
// =====================================================================

export interface FanOutArgs {
  readonly incidentId: string;
  readonly transition: FanOutTransition;
  readonly requesterAccountId: string;
  readonly requesterLabel?: string;
  /** Keep simulated=true in v1 PILOT. The service refuses to flip
   *  non-simulated unless the email adapter also authorises it. */
  readonly simulated?: boolean;
}

export interface FanOutAttemptSummary {
  readonly channel: FanOutChannel;
  readonly recipientIdentifier: string;
  readonly outcome: FanOutOutcome;
  readonly reason: string | null;
  readonly alreadyLogged: boolean;
}

export interface FanOutResult {
  readonly incidentId: string;
  readonly transition: FanOutTransition;
  readonly attempted: number;
  readonly succeeded: number;
  readonly failed: readonly FanOutAttemptSummary[];
  readonly honestBlocked: readonly FanOutAttemptSummary[];
  readonly simulated: boolean;
}

// =====================================================================
// Internal helpers
// =====================================================================

interface TrustedContactLike {
  readonly contactAccountId: string | null;
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
}

function shortId(incidentId: string): string {
  const trimmed = incidentId.trim();
  if (trimmed.length <= 8) return trimmed;
  return trimmed.slice(0, 8);
}

/** Fetch opted-in nearby responder account ids for the incident, if any. */
async function resolveActiveResponderAccountIds(
  incidentId: string,
): Promise<string[]> {
  const r = await withClient(async (client) => {
    const q = await client.query(
      `SELECT recipient_account_id
         FROM nex.incident_recipient
        WHERE incident_id = $1
          AND layer = 'nearby_opted_in'`,
      [incidentId.trim()],
    );
    return q.rows.map((row) => String((row as Record<string, unknown>).recipient_account_id));
  });
  return r ?? [];
}

/** The transition decides which recipient set + which channels fire. */
interface FanOutPlan {
  readonly includeTrustedContacts: boolean;
  readonly includeNearbyResponders: boolean;
  readonly channels: {
    readonly email: boolean;
    readonly sms: boolean;
    readonly inApp: boolean;
  };
}

function planForTransition(t: FanOutTransition): FanOutPlan {
  switch (t) {
    case "pending_confirmation":
      return {
        includeTrustedContacts: true,
        includeNearbyResponders: false,
        channels: { email: true, sms: true, inApp: true },
      };
    case "active":
      return {
        includeTrustedContacts: true,
        includeNearbyResponders: true,
        channels: { email: true, sms: true, inApp: true },
      };
    case "revoked_within_window":
      return {
        includeTrustedContacts: true,
        includeNearbyResponders: false,
        channels: { email: true, sms: true, inApp: true },
      };
    case "cancelled":
    case "resolved":
      return {
        includeTrustedContacts: true,
        includeNearbyResponders: true,
        channels: { email: true, sms: true, inApp: true },
      };
  }
}

async function attemptEmail(args: {
  incidentId: string;
  transition: FanOutTransition;
  email: string;
  requesterLabel: string;
  simulated: boolean;
}): Promise<FanOutAttemptSummary> {
  const identifier = identifierFromEmail(args.email);
  const idempotencyKey = makeIdempotencyKey({
    incidentId: args.incidentId,
    transition: args.transition,
    channel: "email",
    recipientIdentifier: identifier,
  });
  const body = composeEmergencyEmailBody({
    transition: args.transition,
    requesterLabel: args.requesterLabel,
    incidentIdShort: shortId(args.incidentId),
    simulated: args.simulated,
  });
  const sendResult = await sendEmergencyEmail({
    to: args.email,
    subject: body.subject,
    textBody: body.textBody,
    htmlBody: body.htmlBody,
    idempotencyKey,
    simulated: args.simulated,
  });
  const outcome: FanOutOutcome = sendResult.ok ? "ok" : "provider_error";
  const reason = sendResult.ok ? null : sendResult.reason;
  const audit = await writeFanOutAudit({
    incidentId: args.incidentId,
    transition: args.transition,
    channel: "email",
    recipientIdentifier: identifier,
    outcome,
    reason,
    idempotencyKey,
    simulated: args.simulated,
  });
  return {
    channel: "email",
    recipientIdentifier: identifier,
    outcome,
    reason,
    alreadyLogged: audit.alreadyLogged,
  };
}

async function attemptSms(args: {
  incidentId: string;
  transition: FanOutTransition;
  phone: string;
  simulated: boolean;
}): Promise<FanOutAttemptSummary> {
  const identifier = identifierFromPhone(args.phone);
  const idempotencyKey = makeIdempotencyKey({
    incidentId: args.incidentId,
    transition: args.transition,
    channel: "sms",
    recipientIdentifier: identifier,
  });
  const r = await sendEmergencySMS({
    to: args.phone,
    textBody: `NEX safety alert · ${args.transition}`,
    idempotencyKey,
    simulated: args.simulated,
  });
  // Always honest-blocked in v1.
  const audit = await writeFanOutAudit({
    incidentId: args.incidentId,
    transition: args.transition,
    channel: "sms",
    recipientIdentifier: identifier,
    outcome: "honest_blocked",
    reason: r.reason,
    idempotencyKey,
    simulated: args.simulated,
  });
  return {
    channel: "sms",
    recipientIdentifier: identifier,
    outcome: "honest_blocked",
    reason: r.reason,
    alreadyLogged: audit.alreadyLogged,
  };
}

async function attemptInAppPush(args: {
  incidentId: string;
  transition: FanOutTransition;
  accountId: string;
  simulated: boolean;
}): Promise<FanOutAttemptSummary> {
  const identifier = identifierFromAccount(args.accountId);
  const idempotencyKey = makeIdempotencyKey({
    incidentId: args.incidentId,
    transition: args.transition,
    channel: "in_app",
    recipientIdentifier: identifier,
  });
  // In v1, push subscription infra is NOT wired. Honest-blocked.
  // When push is wired, this attempt flips to an actual push_send
  // call and the outcome becomes 'ok' or 'provider_error'.
  const audit = await writeFanOutAudit({
    incidentId: args.incidentId,
    transition: args.transition,
    channel: "in_app",
    recipientIdentifier: identifier,
    outcome: "honest_blocked",
    reason: "in_app_push_not_wired",
    idempotencyKey,
    simulated: args.simulated,
  });
  return {
    channel: "in_app",
    recipientIdentifier: identifier,
    outcome: "honest_blocked",
    reason: "in_app_push_not_wired",
    alreadyLogged: audit.alreadyLogged,
  };
}

// =====================================================================
// Public: fanOutForTransition
// =====================================================================

export async function fanOutForTransition(
  args: FanOutArgs,
): Promise<FanOutResult> {
  if (typeof args.incidentId !== "string" || args.incidentId.trim().length === 0) {
    throw new Error("fanout.invalid_incident_id");
  }
  if (typeof args.requesterAccountId !== "string" || args.requesterAccountId.trim().length === 0) {
    throw new Error("fanout.invalid_requester");
  }

  const simulated = args.simulated !== false; // defaults to TRUE
  const requesterLabel = args.requesterLabel?.trim() ?? "";
  const plan = planForTransition(args.transition);

  const attempts: FanOutAttemptSummary[] = [];

  // Pull trusted contacts for the requester.
  let contacts: TrustedContactLike[] = [];
  if (plan.includeTrustedContacts) {
    try {
      contacts = (await listContacts(args.requesterAccountId, 100)) as TrustedContactLike[];
    } catch {
      // DB unavailable or similar · we still fire 0 attempts, no fabrication.
      contacts = [];
    }
  }

  // Email channel · one per contact that has contact_email set.
  if (plan.channels.email) {
    for (const c of contacts) {
      if (!c.contactEmail) continue;
      try {
        attempts.push(
          await attemptEmail({
            incidentId: args.incidentId,
            transition: args.transition,
            email: c.contactEmail,
            requesterLabel,
            simulated,
          }),
        );
      } catch (err) {
        // Audit failed · record failure without fabricating success.
        attempts.push({
          channel: "email",
          recipientIdentifier: identifierFromEmail(c.contactEmail),
          outcome: "provider_error",
          reason: `audit_failure:${
            err instanceof Error ? err.message.slice(0, 80) : "unknown"
          }`,
          alreadyLogged: false,
        });
      }
    }
  }

  // SMS channel · one per contact that has contact_phone set.
  if (plan.channels.sms) {
    for (const c of contacts) {
      if (!c.contactPhone) continue;
      try {
        attempts.push(
          await attemptSms({
            incidentId: args.incidentId,
            transition: args.transition,
            phone: c.contactPhone,
            simulated,
          }),
        );
      } catch (err) {
        attempts.push({
          channel: "sms",
          recipientIdentifier: identifierFromPhone(c.contactPhone),
          outcome: "provider_error",
          reason: `audit_failure:${
            err instanceof Error ? err.message.slice(0, 80) : "unknown"
          }`,
          alreadyLogged: false,
        });
      }
    }
  }

  // In-app push · for responders (CONFIRMED fan-out) + for NEX
  // trusted contacts who are themselves NEX accounts.
  if (plan.channels.inApp) {
    const inAppRecipients: string[] = [];
    for (const c of contacts) {
      if (c.contactAccountId) inAppRecipients.push(c.contactAccountId);
    }
    if (plan.includeNearbyResponders) {
      try {
        const responders = await resolveActiveResponderAccountIds(args.incidentId);
        for (const r of responders) inAppRecipients.push(r);
      } catch {
        // ignore · continue with trusted-contact in-app pushes only
      }
    }
    const seen = new Set<string>();
    for (const accountId of inAppRecipients) {
      if (seen.has(accountId)) continue;
      seen.add(accountId);
      try {
        attempts.push(
          await attemptInAppPush({
            incidentId: args.incidentId,
            transition: args.transition,
            accountId,
            simulated,
          }),
        );
      } catch (err) {
        attempts.push({
          channel: "in_app",
          recipientIdentifier: identifierFromAccount(accountId),
          outcome: "provider_error",
          reason: `audit_failure:${
            err instanceof Error ? err.message.slice(0, 80) : "unknown"
          }`,
          alreadyLogged: false,
        });
      }
    }
  }

  const succeeded = attempts.filter((a) => a.outcome === "ok").length;
  const failed = attempts.filter((a) => a.outcome === "provider_error");
  const honestBlocked = attempts.filter((a) => a.outcome === "honest_blocked");

  return {
    incidentId: args.incidentId,
    transition: args.transition,
    attempted: attempts.length,
    succeeded,
    failed,
    honestBlocked,
    simulated,
  };
}
