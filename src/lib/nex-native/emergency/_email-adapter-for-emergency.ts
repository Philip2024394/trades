// src/lib/nex-native/emergency/_email-adapter-for-emergency.ts
//
// NEX Emergency Help · thin email adapter for the multi-channel
// fan-out service.
//
// Reuses the sealed SMTP transport at `@/lib/nex/listing-chat/smtp`
// (the same adapter the owner-claim path uses via
// `sendOwnerInviteEmail`). We do NOT reinvent transport. This file
// is a semantic shim: it maps the fan-out contract (idempotencyKey,
// simulated flag, honest success/failure shape) onto the sealed
// `enqueueEmail()` primitive.
//
// Doctrine:
//   · NEVER lie about delivery. If SMTP is not configured, the
//     return value says so faithfully.
//   · In v1 PILOT (`simulated=true`), do NOT attempt a real send.
//     Return `ok:true` with a synthetic providerMessageId so the
//     audit log records exactly what would have been attempted.
//   · In live mode (`simulated=false`) the real send is ONLY
//     attempted when `NEX_EMERGENCY_EMAIL_REAL_SEND=true`. Both
//     flags are required; the service layer passes `simulated=false`
//     only when founder sign-off has been recorded.
//   · Idempotency: the caller is responsible for computing the key
//     and persisting it to the audit log BEFORE calling this adapter.
//     This adapter does not de-duplicate internally.

import "server-only";

export interface EmergencyEmailArgs {
  readonly to: string;
  readonly subject: string;
  readonly textBody: string;
  readonly htmlBody?: string;
  readonly idempotencyKey: string;
  readonly simulated: boolean;
}

export type EmergencyEmailResult =
  | { readonly ok: true; readonly providerMessageId: string | null; readonly simulated: boolean; readonly note: string }
  | { readonly ok: false; readonly reason: string; readonly simulated: boolean };

const REAL_SEND_FLAG = "NEX_EMERGENCY_EMAIL_REAL_SEND";

function isPlausibleEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export function isRealSendAuthorised(): boolean {
  return process.env[REAL_SEND_FLAG] === "true";
}

/**
 * Dispatches a single emergency fan-out email. See file header for
 * the simulated-vs-live decision rules.
 *
 * Return shape is a tagged union so callers never have to catch
 * exceptions — adapter failures are first-class return values.
 */
export async function sendEmergencyEmail(
  args: EmergencyEmailArgs,
): Promise<EmergencyEmailResult> {
  if (typeof args.to !== "string" || !isPlausibleEmail(args.to)) {
    return {
      ok: false,
      reason: "invalid_recipient_email",
      simulated: args.simulated,
    };
  }
  if (typeof args.subject !== "string" || args.subject.trim().length === 0) {
    return { ok: false, reason: "missing_subject", simulated: args.simulated };
  }
  if (typeof args.textBody !== "string" || args.textBody.trim().length === 0) {
    return { ok: false, reason: "missing_body", simulated: args.simulated };
  }
  if (typeof args.idempotencyKey !== "string" || args.idempotencyKey.trim().length === 0) {
    return {
      ok: false,
      reason: "missing_idempotency_key",
      simulated: args.simulated,
    };
  }

  // v1 PILOT · simulated path. No external I/O.
  if (args.simulated) {
    return {
      ok: true,
      providerMessageId: `simulated:${args.idempotencyKey}`,
      simulated: true,
      note: "simulated_fan_out_v1_pilot",
    };
  }

  // Live mode gate · requires explicit env opt-in.
  if (!isRealSendAuthorised()) {
    return {
      ok: false,
      reason: "live_send_not_authorised",
      simulated: false,
    };
  }

  // Dynamic import so test boots do not pull in the SMTP module and
  // its KF-pool dependency. The sealed enqueueEmail owns transport,
  // the outbound_email row, and failure recording.
  try {
    const dyn = new Function("m", "return import(m)") as (
      m: string,
    ) => Promise<unknown>;
    const mod = (await dyn("@/lib/nex/listing-chat/smtp").catch(() => null)) as
      | {
          enqueueEmail: (args: {
            purpose: "transactional" | "owner_invite" | "marketing_intro" | "claim_reminder";
            to_email: string;
            subject: string;
            body_text: string;
            body_html?: string;
            related_thread_id?: string | null;
          }) => Promise<{
            email_id: string;
            status: string;
            provider: string | null;
            smtp_configured: boolean;
            note: string;
          }>;
        }
      | null;
    if (!mod) {
      return {
        ok: false,
        reason: "smtp_module_unavailable",
        simulated: false,
      };
    }
    const r = await mod.enqueueEmail({
      purpose: "transactional",
      to_email: args.to,
      subject: args.subject,
      body_text: args.textBody,
      body_html: args.htmlBody,
      related_thread_id: null,
    });
    if (r.status === "sent" || r.status === "queued") {
      return {
        ok: true,
        providerMessageId: r.email_id,
        simulated: false,
        note: r.note,
      };
    }
    return {
      ok: false,
      reason: `smtp_status_${r.status}`,
      simulated: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 300) : String(err);
    return {
      ok: false,
      reason: `smtp_exception:${msg}`,
      simulated: false,
    };
  }
}

/** Composes the plaintext + HTML bodies for the four fan-out
 *  transitions. Pure · exported for test. */
export function composeEmergencyEmailBody(args: {
  readonly transition:
    | "pending_confirmation"
    | "active"
    | "revoked_within_window"
    | "cancelled"
    | "resolved";
  readonly requesterLabel: string;
  readonly incidentIdShort: string;
  readonly simulated: boolean;
}): { subject: string; textBody: string; htmlBody: string } {
  const simTag = args.simulated ? " [SIMULATED · v1 pilot]" : "";
  const nameSafe = args.requesterLabel.trim().length > 0
    ? args.requesterLabel.trim()
    : "A NEX user";
  switch (args.transition) {
    case "pending_confirmation": {
      const subject = `NEX safety alert · ${nameSafe} may need help${simTag}`;
      const textBody = `${nameSafe} has just tapped the NEX emergency button.

They have a 10-second safety window to cancel this alert. If it is not cancelled, you will receive a CONFIRMED message with location details.

No action is required yet. Keep your phone nearby.

Reference: ${args.incidentIdShort}
${args.simulated ? "\n(SIMULATED · v1 pilot · no real alert fired)" : ""}

— NEX Emergency Help`;
      const htmlBody = `<p><strong>${escapeHtml(nameSafe)}</strong> has just tapped the NEX emergency button.</p>
<p>They have a 10-second safety window to cancel this alert. If it is not cancelled, you will receive a <strong>CONFIRMED</strong> message with location details.</p>
<p>No action is required yet. Keep your phone nearby.</p>
<p style="color:#71717a;font-size:12px;">Reference: ${escapeHtml(args.incidentIdShort)}${args.simulated ? "<br/>(SIMULATED · v1 pilot · no real alert fired)" : ""}</p>
<p style="color:#a1a1aa;font-size:12px;">— NEX Emergency Help</p>`;
      return { subject, textBody, htmlBody };
    }
    case "active": {
      const subject = `NEX CONFIRMED · ${nameSafe} needs help${simTag}`;
      const textBody = `${nameSafe} has confirmed they need help. The 10-second safety window has passed.

If you can respond, open NEX and go to Emergency to see the request.

Reference: ${args.incidentIdShort}
${args.simulated ? "\n(SIMULATED · v1 pilot · no real alert fired)" : ""}

— NEX Emergency Help`;
      const htmlBody = `<p><strong>${escapeHtml(nameSafe)}</strong> has confirmed they need help. The 10-second safety window has passed.</p>
<p>If you can respond, open NEX and go to Emergency to see the request.</p>
<p style="color:#71717a;font-size:12px;">Reference: ${escapeHtml(args.incidentIdShort)}${args.simulated ? "<br/>(SIMULATED · v1 pilot · no real alert fired)" : ""}</p>
<p style="color:#a1a1aa;font-size:12px;">— NEX Emergency Help</p>`;
      return { subject, textBody, htmlBody };
    }
    case "revoked_within_window": {
      const subject = `NEX safety alert cancelled · no action required${simTag}`;
      const textBody = `The alert from ${nameSafe} that was sent moments ago was cancelled by the requester within the 10-second safety window. No action is required.

Reference: ${args.incidentIdShort}
${args.simulated ? "\n(SIMULATED · v1 pilot)" : ""}

— NEX Emergency Help`;
      const htmlBody = `<p>The alert from <strong>${escapeHtml(nameSafe)}</strong> that was sent moments ago was <strong>cancelled by the requester within the 10-second safety window</strong>.</p>
<p>No action is required.</p>
<p style="color:#71717a;font-size:12px;">Reference: ${escapeHtml(args.incidentIdShort)}${args.simulated ? "<br/>(SIMULATED · v1 pilot)" : ""}</p>
<p style="color:#a1a1aa;font-size:12px;">— NEX Emergency Help</p>`;
      return { subject, textBody, htmlBody };
    }
    case "cancelled": {
      const subject = `NEX alert closed · ${nameSafe} cancelled the request${simTag}`;
      const textBody = `${nameSafe} has cancelled their emergency request. No further action is required.

Reference: ${args.incidentIdShort}
${args.simulated ? "\n(SIMULATED · v1 pilot)" : ""}

— NEX Emergency Help`;
      const htmlBody = `<p><strong>${escapeHtml(nameSafe)}</strong> has cancelled their emergency request. No further action is required.</p>
<p style="color:#71717a;font-size:12px;">Reference: ${escapeHtml(args.incidentIdShort)}${args.simulated ? "<br/>(SIMULATED · v1 pilot)" : ""}</p>
<p style="color:#a1a1aa;font-size:12px;">— NEX Emergency Help</p>`;
      return { subject, textBody, htmlBody };
    }
    case "resolved": {
      const subject = `NEX alert resolved · ${nameSafe} is safe${simTag}`;
      const textBody = `${nameSafe}'s emergency has been marked resolved. Thank you for being part of the NEX safety network.

Reference: ${args.incidentIdShort}
${args.simulated ? "\n(SIMULATED · v1 pilot)" : ""}

— NEX Emergency Help`;
      const htmlBody = `<p><strong>${escapeHtml(nameSafe)}</strong>'s emergency has been marked <strong>resolved</strong>. Thank you for being part of the NEX safety network.</p>
<p style="color:#71717a;font-size:12px;">Reference: ${escapeHtml(args.incidentIdShort)}${args.simulated ? "<br/>(SIMULATED · v1 pilot)" : ""}</p>
<p style="color:#a1a1aa;font-size:12px;">— NEX Emergency Help</p>`;
      return { subject, textBody, htmlBody };
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
