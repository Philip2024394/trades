// NEX Notifications · compliance gate
//
// Same rules as the Email Runtime's compliance gate · adapted to
// notification channels. Every send passes through here regardless of
// channel · one-way ratchet toward safety.

import type { NotificationChannel, NotificationKind } from "./types";

export type ComplianceContact = {
  phone?: string | null;
  email?: string | null;
  never_contact?: boolean | null;
  unsubscribe_at?: string | null;
  consent_marketing?: boolean | null;
  consent_transactional?: boolean | null;
};

export type ComplianceReason =
  | "invalid_recipient"
  | "never_contact"
  | "unsubscribed"
  | "no_marketing_consent"
  | "no_transactional_consent"
  | "channel_not_permitted";

export type ComplianceResult =
  | { allowed: true }
  | { allowed: false; reason: ComplianceReason; detail: string };

const PHONE_RE = /^\+?\d{6,}$/;

export function checkNotificationCompliance(
  contact: ComplianceContact,
  channel: NotificationChannel,
  kind: NotificationKind,
  recipient: string,
): ComplianceResult {
  // Recipient shape check · varies by channel.
  const clean = recipient.trim();
  if (!clean) return { allowed: false, reason: "invalid_recipient", detail: "empty recipient" };
  if (channel === "whatsapp" || channel === "sms") {
    const digits = clean.replace(/[^\d+]/g, "");
    if (!PHONE_RE.test(digits)) return { allowed: false, reason: "invalid_recipient", detail: `"${clean}" is not a valid phone number` };
  }
  // For push and in_app the recipient is a contact_id · runtime validates upstream.

  if (contact.never_contact === true) {
    return { allowed: false, reason: "never_contact", detail: "contact flagged never_contact = true" };
  }
  if (contact.unsubscribe_at) {
    return { allowed: false, reason: "unsubscribed", detail: `unsubscribed at ${contact.unsubscribe_at}` };
  }
  if (kind === "marketing" && contact.consent_marketing !== true) {
    return { allowed: false, reason: "no_marketing_consent", detail: "consent_marketing is not TRUE" };
  }
  if (kind === "transactional" && contact.consent_transactional === false) {
    return { allowed: false, reason: "no_transactional_consent", detail: "consent_transactional explicitly FALSE" };
  }
  return { allowed: true };
}
