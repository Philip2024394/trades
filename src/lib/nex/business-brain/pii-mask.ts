// PII masking for Supplier Memory persistence (Philip 2026-08-02).
//
// RULE (Philip): "Mask emails and phone numbers before persistence. Do not
// store customer personal contact details inside brief_record. Conversation_id
// remains the internal reference."
//
// SCOPE:
//   - Emails · replaced with [email-redacted]
//   - Phone numbers (international, US, UK formats) · replaced with [phone-redacted]
//   - UK/IE full postcodes (SW1A 1AA style) · truncated to sector (SW1A)
//   - US ZIP+4 · truncated to 5-digit
//
// Everything else in the brief_record is trade context (materials · style ·
// staircase_type · quantity · timeframe). Those stay intact — they're not PII,
// they're specification.
//
// Applied recursively to every string value in the record so free-form
// admin_notes / project_location / decline_reason fields are also masked.

import "server-only";

const EMAIL_RX = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;

// International + national phone formats. Deliberately permissive on separators
// (space · dot · dash) so common human-typed forms are caught. Minimum 7 digits
// to avoid false-positives on years, sizes, or prices.
const PHONE_RX = /(\+?\d[\d\s.\-()]{6,}\d)/g;

// UK/IE full postcodes (outward + inward) → keep only outward (sector).
// e.g. "SW1A 1AA" → "SW1A" · "M1 1AB" → "M1"
const UK_POSTCODE_FULL_RX = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}\b/gi;

// US ZIP+4 (e.g. 94103-1234) → 94103. Plain 5-digit ZIPs unaffected.
const US_ZIP_PLUS4_RX = /\b(\d{5})-\d{4}\b/g;

// Philip 2026-08-02 · ISO-8601 date/timestamp exclusion. Chain validation
// surfaced that the phone regex was over-eating ISO date fragments like
// "2026-08-02" (8 digits with hyphens · exceeds the 7-digit threshold),
// which would clobber persisted brief_record.prepared_at fields with
// [phone-redacted]. Timestamps are never PII · this guard skips them.
const ISO_DATE_PREFIX_RX = /^\d{4}-\d{2}-\d{2}/;

function maskString(input: string): string {
  if (!input) return input;
  let out = input;
  // Order matters:
  //   1. Emails first (unambiguous · @ character can't collide with other rules)
  //   2. UK/US postcodes BEFORE phone · otherwise a ZIP+4 like "94103-1234"
  //      gets greedily consumed by the phone rule as a "long digit sequence".
  //   3. Phone rule last · now safe to match remaining long digit sequences.
  out = out.replace(EMAIL_RX, "[email-redacted]");
  out = out.replace(UK_POSTCODE_FULL_RX, "$1");
  out = out.replace(US_ZIP_PLUS4_RX, "$1");
  out = out.replace(PHONE_RX, (match) => {
    // Skip matches with fewer than 7 digits (already enforced by regex but
    // belt-and-braces after the replace passes).
    const digits = match.replace(/\D/g, "");
    if (digits.length < 7) return match;
    // Skip ISO-8601 date/timestamp fragments · Philip 2026-08-02 · timestamps
    // are never PII. Prevents "2026-08-02T13:45:23Z" collapsing to [phone-redacted].
    if (ISO_DATE_PREFIX_RX.test(match)) return match;
    return "[phone-redacted]";
  });
  return out;
}

/**
 * Deep-mask any PII strings inside a record before persistence.
 * Idempotent · safe to run multiple times · preserves structure.
 */
export function maskPII<T = unknown>(value: T): T {
  if (value == null) return value;
  if (typeof value === "string") return maskString(value) as unknown as T;
  if (Array.isArray(value)) return value.map(maskPII) as unknown as T;
  if (typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src)) out[k] = maskPII(v);
    return out as unknown as T;
  }
  return value;
}
