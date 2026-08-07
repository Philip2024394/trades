// NEX Email · compliance gate
//
// Pure functions. Same rules NEX enforces at every send, regardless of
// caller. The Communications Centre workspace and every worker send goes
// through this. If a contact fails compliance, we NEVER send.
//
// Legal basis: UK PECR + GDPR · Australian Spam Act · Canadian CASL · US
// CAN-SPAM. Every rule below is a statutory floor, not a preference.

import type { EmailKind } from "./types";

// Slim contact shape · every field the compliance gate reads.
export type ComplianceContact = {
  email: string | null | undefined;
  never_contact?: boolean | null;
  unsubscribe_at?: string | null;            // ISO — presence means UNSUBSCRIBED, regardless of date
  consent_marketing?: boolean | null;
  consent_transactional?: boolean | null;
};

export type ComplianceReason =
  | "invalid_email"
  | "never_contact"
  | "unsubscribed"
  | "no_marketing_consent"
  | "no_transactional_consent";

export type ComplianceResult =
  | { allowed: true }
  | { allowed: false; reason: ComplianceReason; detail: string };

// RFC-5321 loose sanity check — good enough for the gate. Actual delivery
// failures still surface via the provider.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Runs the same rules NEX applies to every outbound message.
 * Returns { allowed: true } only if EVERY relevant rule passes.
 */
export function checkCompliance(contact: ComplianceContact, kind: EmailKind): ComplianceResult {
  const email = contact.email?.trim();
  if (!email || !EMAIL_RE.test(email)) {
    return { allowed: false, reason: "invalid_email", detail: "email missing or malformed" };
  }
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
    // NULL / undefined is permitted for transactional (implied consent for
    // things like receipts / password resets). Only an explicit FALSE blocks.
    return { allowed: false, reason: "no_transactional_consent", detail: "consent_transactional explicitly FALSE" };
  }
  return { allowed: true };
}
