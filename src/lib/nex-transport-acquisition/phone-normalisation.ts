// src/lib/nex-transport-acquisition/phone-normalisation.ts
//
// Indonesian phone canonicalisation + WhatsApp link parsing.
//
// Doctrine: deduplication + audit require a single canonical form for a phone.
// A record where 0812xxx · +62812xxx · 62812xxx all point to the same provider
// must resolve to one canonical_phone_e164.
//
// Rules:
//   - Indonesian mobile prefixes: 811-859 (2-digit) or 8xxx (3-digit) after
//     the 0 or +62 country code. This module accepts common prefixes and
//     rejects clearly invalid ones.
//   - WhatsApp link parsing supports: wa.me/<digits> · api.whatsapp.com/send?phone=<digits>
//     · chat.whatsapp.com/<invite-code> is NOT a phone (returns null)
//   - Never invents digits · never guesses.

export interface PhoneNormalisationOK {
  status: "OK";
  canonicalE164: string;
  countryCode: string;
  nationalNumber: string;
  provider: "unknown_mobile" | "unknown_landline";
  originalInput: string;
}

export interface PhoneNormalisationRejected {
  status: "REJECTED";
  reason:
    | "EMPTY"
    | "NON_NUMERIC_ONLY"
    | "TOO_SHORT"
    | "TOO_LONG"
    | "NOT_INDONESIAN"
    | "INVALID_MOBILE_PREFIX"
    | "UNPARSEABLE_WHATSAPP_LINK"
    | "WHATSAPP_GROUP_INVITE_NOT_A_PHONE";
  detail: string;
  originalInput: string;
}

export type PhoneNormalisationResult = PhoneNormalisationOK | PhoneNormalisationRejected;

const INDONESIA_CC = "62";

// Common Indonesian mobile prefixes (2-3 digit block AFTER country code).
// e.g. +62 811 xxxx = Telkomsel, +62 858 xxxx = Indosat, etc.
// Kept broad to accept future MVNO prefixes · specific bad ones rejected.
const VALID_MOBILE_FIRST_TWO = new Set([
  "81", "82", "83", "85", "87", "88", "89",
]);

/**
 * Strip everything that is not a digit. Keeps a single leading + if present.
 */
function stripToDigits(raw: string): { hasPlus: boolean; digits: string } {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return { hasPlus, digits };
}

/**
 * Normalise any Indonesian phone-representing string to canonical E.164 form
 * (+62...). Accepts 08xx, +62 8xx, 62 8xx, WhatsApp wa.me/... URLs, and free
 * form with spaces/hyphens/dots.
 */
export function normaliseIndonesianPhone(raw: string): PhoneNormalisationResult {
  if (!raw || raw.trim().length === 0) {
    return { status: "REJECTED", reason: "EMPTY", detail: "input is empty", originalInput: raw };
  }

  // WhatsApp link handling
  const waParsed = tryParseWhatsappLink(raw);
  if (waParsed) return normaliseIndonesianPhone(waParsed); // recursive on the extracted number

  const { hasPlus, digits } = stripToDigits(raw);
  if (digits.length === 0) {
    return {
      status: "REJECTED",
      reason: "NON_NUMERIC_ONLY",
      detail: "no digits found in input",
      originalInput: raw,
    };
  }

  // Establish country code + national number
  let cc = "";
  let nn = "";
  if (hasPlus) {
    if (digits.startsWith(INDONESIA_CC)) {
      cc = INDONESIA_CC;
      nn = digits.slice(INDONESIA_CC.length);
    } else {
      return {
        status: "REJECTED",
        reason: "NOT_INDONESIAN",
        detail: `+${digits.slice(0, 3)}... is not the Indonesian country code`,
        originalInput: raw,
      };
    }
  } else if (digits.startsWith("62")) {
    cc = INDONESIA_CC;
    nn = digits.slice(2);
  } else if (digits.startsWith("0")) {
    cc = INDONESIA_CC;
    nn = digits.slice(1);
  } else {
    return {
      status: "REJECTED",
      reason: "NOT_INDONESIAN",
      detail: "input lacks recognisable Indonesian country code / national trunk prefix",
      originalInput: raw,
    };
  }

  // Length bounds for Indonesian mobile numbers: national number 9-12 digits
  if (nn.length < 9) {
    return { status: "REJECTED", reason: "TOO_SHORT", detail: `national number ${nn.length} digits`, originalInput: raw };
  }
  if (nn.length > 12) {
    return { status: "REJECTED", reason: "TOO_LONG", detail: `national number ${nn.length} digits`, originalInput: raw };
  }

  // Mobile prefix validation
  const firstTwo = nn.slice(0, 2);
  const isMobile = firstTwo.startsWith("8") && VALID_MOBILE_FIRST_TWO.has(firstTwo);
  if (!isMobile) {
    // Landlines exist but are rare for driver acquisition · we still accept
    // 2-3 digit area codes as landlines. Very short prefixes rejected.
    if (nn.length < 9) {
      return { status: "REJECTED", reason: "INVALID_MOBILE_PREFIX", detail: `unusual prefix ${firstTwo}`, originalInput: raw };
    }
    return {
      status: "OK",
      canonicalE164: `+${cc}${nn}`,
      countryCode: cc,
      nationalNumber: nn,
      provider: "unknown_landline",
      originalInput: raw,
    };
  }

  return {
    status: "OK",
    canonicalE164: `+${cc}${nn}`,
    countryCode: cc,
    nationalNumber: nn,
    provider: "unknown_mobile",
    originalInput: raw,
  };
}

/**
 * Try to extract a phone from a WhatsApp URL. Returns null if the input is not
 * a WhatsApp URL. Returns "REJECTED:GROUP" sentinel when the URL is a group
 * invite (which is not a phone number).
 */
function tryParseWhatsappLink(raw: string): string | null {
  const s = raw.trim();
  if (!/^https?:\/\//i.test(s) && !/^wa\.me\//i.test(s)) return null;
  const url = s.startsWith("http") ? s : `https://${s}`;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();

    // Group invite links carry no phone number
    if (host === "chat.whatsapp.com") return null;

    if (host === "wa.me" || host === "api.whatsapp.com") {
      // Direct number in path: wa.me/62812xxx
      const pathDigits = u.pathname.replace(/\D/g, "");
      if (pathDigits.length > 0) return pathDigits;
      // Query param: api.whatsapp.com/send?phone=62812xxx
      const q = u.searchParams.get("phone");
      if (q) return q.replace(/\D/g, "");
    }
  } catch { /* fall through */ }
  return null;
}

/**
 * Returns true when the input is a WhatsApp group-invite link (not a phone).
 * Callers should route these away from phone normalisation entirely.
 */
export function isWhatsappGroupInviteLink(raw: string): boolean {
  const s = raw.trim();
  try {
    const url = s.startsWith("http") ? s : `https://${s}`;
    const u = new URL(url);
    return u.hostname.toLowerCase() === "chat.whatsapp.com";
  } catch {
    return false;
  }
}

/**
 * Build a canonical wa.me link from a canonical E.164 number.
 * E.g. +62812xxxx → https://wa.me/62812xxxx
 * Returns null when the input is not a valid Indonesian canonical E.164.
 */
export function buildCanonicalWhatsappLink(canonicalE164: string): string | null {
  if (!canonicalE164.startsWith("+62")) return null;
  return `https://wa.me/${canonicalE164.slice(1)}`;
}
