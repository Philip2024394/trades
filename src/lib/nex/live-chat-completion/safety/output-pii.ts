// src/lib/nex/live-chat-completion/safety/output-pii.ts
//
// Founder BEGIN Phase 3.7 · Output PII scrubber.
//
// Removes PII from replies that isn't owner-verified in the canonical
// facts of the resolved entity. Keeps ONE class of allowlist:
//   - phone numbers / emails that appear in the FACT bundle for
//     `entity_ref` come from either canonical rows (owner-verified) or
//     evidence (trusted source). Those pass through.
//
// Every other phone number / email / IBAN-style / passport-like token
// gets replaced with a redaction placeholder.
//
// Zero LLM. Deterministic. Fast. Non-fatal on any failure.

import type { OutputGuardrail, OutputGuardrailVerdict, OutputTurn } from "./guardrails";
import { factHotGet } from "@/lib/nex/intelligence-storage-grid/accommodation/hot-tier-facts";

// Conservative regexes · designed to catch obvious PII patterns without
// eating legitimate content. Numeric-only patterns require 6+ digits so
// pricing like "$100/night" and small counts like "3 hotels" are safe.
const RX_INTERNATIONAL_PHONE = /\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;
const RX_LONG_DIGITS = /\b\d{9,}\b/g;                      // long digit strings (phone-like · passports)
const RX_EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const RX_INDONESIA_PHONE = /\b(?:\+62|0)8[0-9]{8,11}\b/g;  // 08xx / +628xx

const REDACTED_PHONE = "[phone redacted]";
const REDACTED_EMAIL = "[email redacted]";
const REDACTED_ID = "[id redacted]";

function allowedSetForEntity(entity_ref: string | null): { phones: Set<string>; emails: Set<string> } {
  const phones = new Set<string>();
  const emails = new Set<string>();
  if (!entity_ref) return { phones, emails };
  try {
    const hit = factHotGet(entity_ref);
    if (!hit) return { phones, emails };
    const bundle = hit.bundle;
    // Only these fact slugs are owner-verifiable phones / emails.
    const phoneFact = bundle.facts["property_phone"];
    const waFact = bundle.facts["property_whatsapp"];
    const emailFact = bundle.facts["property_email"];
    const collect = (v: unknown, into: Set<string>) => {
      if (typeof v === "string" && v.trim().length > 0) into.add(v.trim());
      if (Array.isArray(v)) for (const x of v) if (typeof x === "string") into.add(x.trim());
    };
    if (phoneFact && !phoneFact.unknown) collect(phoneFact.value, phones);
    if (waFact && !waFact.unknown) collect(waFact.value, phones);
    if (emailFact && !emailFact.unknown) collect(emailFact.value, emails);
  } catch { /* non-fatal */ }
  return { phones, emails };
}

function isSubstringOfAny(candidate: string, allowlist: Set<string>): boolean {
  if (allowlist.size === 0) return false;
  const norm = candidate.replace(/[\s.()-]/g, "");
  for (const v of allowlist) {
    const nv = v.replace(/[\s.()-]/g, "");
    if (nv.length >= 6 && (norm === nv || norm.includes(nv) || nv.includes(norm))) return true;
  }
  return false;
}

export function makeOutputPiiGuardrail(): OutputGuardrail {
  return {
    name: "output_pii",
    evaluate(out: OutputTurn): OutputGuardrailVerdict {
      const { phones, emails } = allowedSetForEntity(out.entity_ref);
      let text = out.reply_text;

      // Emails
      text = text.replace(RX_EMAIL, (m) => {
        if (emails.has(m) || emails.has(m.toLowerCase())) return m;
        return REDACTED_EMAIL;
      });

      // Indonesian domestic phone format (very specific)
      text = text.replace(RX_INDONESIA_PHONE, (m) => (isSubstringOfAny(m, phones) ? m : REDACTED_PHONE));

      // International phone patterns
      text = text.replace(RX_INTERNATIONAL_PHONE, (m) => {
        // Guard: if the match is short-ish (< 10 non-space chars), skip · likely a price or model number.
        const digitsOnly = m.replace(/\D/g, "");
        if (digitsOnly.length < 8) return m;
        return isSubstringOfAny(m, phones) ? m : REDACTED_PHONE;
      });

      // Very long digit strings (passports, IDs)
      text = text.replace(RX_LONG_DIGITS, (m) => (isSubstringOfAny(m, phones) ? m : REDACTED_ID));

      return { pass: true, reply_text: text };
    },
  };
}
