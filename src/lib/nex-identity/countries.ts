// NEX country picker data · used by first-time identity onboarding.
//
// Extendable: every future market NEX enters adds a row here — no code
// changes elsewhere. Ordering below reflects Philip 2026-08-21 initial
// launch markets (Indonesia + UK first, regional neighbours after).
//
// `initialLanguage` is a HINT, not a lock. NEX brain still auto-adapts
// per conversation turn from the customer's actual speech (see pinned
// Language-Neutral Brain invariant + Voice V2 Indonesian). Adding a
// language default here does NOT expose a language control anywhere in
// the UI — that would violate pinned `project_nex_should_know_not_ask`.

import type { NexVoiceLanguage } from "@/lib/nex-voice";

export type NexCountry = {
  /** ISO 3166-1 alpha-2 code (upper case) · canonical identifier. */
  code: string;
  /** Human name · shown in the picker. */
  name: string;
  /** International calling code including leading + (e.g. "+62"). */
  dialCode: string;
  /** Emoji flag · used in the picker UI. */
  flag: string;
  /** Initial `conversation_language` for a customer from this country.
   *  HINT ONLY — brain adapts from actual speech. */
  initialLanguage: NexVoiceLanguage;
};

export const NEX_COUNTRIES: readonly NexCountry[] = [
  // Initial launch markets · Philip 2026-08-21 (Yogyakarta food V1 + UK trades)
  { code: "ID", name: "Indonesia",          dialCode: "+62",  flag: "🇮🇩", initialLanguage: "id" },
  { code: "GB", name: "United Kingdom",     dialCode: "+44",  flag: "🇬🇧", initialLanguage: "en" },

  // English-speaking + high-affinity markets
  { code: "US", name: "United States",      dialCode: "+1",   flag: "🇺🇸", initialLanguage: "en" },
  { code: "AU", name: "Australia",          dialCode: "+61",  flag: "🇦🇺", initialLanguage: "en" },
  { code: "CA", name: "Canada",             dialCode: "+1",   flag: "🇨🇦", initialLanguage: "en" },
  { code: "IE", name: "Ireland",            dialCode: "+353", flag: "🇮🇪", initialLanguage: "en" },
  { code: "NZ", name: "New Zealand",        dialCode: "+64",  flag: "🇳🇿", initialLanguage: "en" },

  // Southeast Asia · regional to Indonesia
  { code: "SG", name: "Singapore",          dialCode: "+65",  flag: "🇸🇬", initialLanguage: "en" },
  { code: "MY", name: "Malaysia",           dialCode: "+60",  flag: "🇲🇾", initialLanguage: "en" },
  { code: "PH", name: "Philippines",        dialCode: "+63",  flag: "🇵🇭", initialLanguage: "en" },
  { code: "TH", name: "Thailand",           dialCode: "+66",  flag: "🇹🇭", initialLanguage: "en" },
  { code: "VN", name: "Vietnam",            dialCode: "+84",  flag: "🇻🇳", initialLanguage: "en" },

  // Rest of world · commonly requested
  { code: "IN", name: "India",              dialCode: "+91",  flag: "🇮🇳", initialLanguage: "en" },
  { code: "DE", name: "Germany",            dialCode: "+49",  flag: "🇩🇪", initialLanguage: "en" },
  { code: "FR", name: "France",             dialCode: "+33",  flag: "🇫🇷", initialLanguage: "en" },
  { code: "ES", name: "Spain",              dialCode: "+34",  flag: "🇪🇸", initialLanguage: "en" },
  { code: "IT", name: "Italy",              dialCode: "+39",  flag: "🇮🇹", initialLanguage: "en" },
  { code: "NL", name: "Netherlands",        dialCode: "+31",  flag: "🇳🇱", initialLanguage: "en" },
  { code: "JP", name: "Japan",              dialCode: "+81",  flag: "🇯🇵", initialLanguage: "en" },
  { code: "KR", name: "South Korea",        dialCode: "+82",  flag: "🇰🇷", initialLanguage: "en" },
  { code: "BR", name: "Brazil",             dialCode: "+55",  flag: "🇧🇷", initialLanguage: "en" },
  { code: "MX", name: "Mexico",             dialCode: "+52",  flag: "🇲🇽", initialLanguage: "en" },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪", initialLanguage: "en" },
  { code: "SA", name: "Saudi Arabia",       dialCode: "+966", flag: "🇸🇦", initialLanguage: "en" },
];

export const DEFAULT_COUNTRY_CODE = "ID";

export function findCountry(code: string | undefined | null): NexCountry | undefined {
  if (!code) return undefined;
  const upper = code.toUpperCase();
  return NEX_COUNTRIES.find((c) => c.code === upper);
}

/**
 * Normalise a user-entered phone number to E.164 international format
 * given a country dial code. Strips spaces / dashes / brackets. If the
 * user already prefixed with '+', trusts it; otherwise prepends the
 * country's dial code. Returns null if the result doesn't have enough
 * digits to be plausibly valid (minimum 6 after the '+' — very loose;
 * proper libphonenumber validation is a nice-to-have upgrade).
 */
export function normaliseE164(rawPhone: string, dialCode: string): string | null {
  const clean = (rawPhone ?? "").replace(/[\s\-().]/g, "");
  if (!clean) return null;
  const withPrefix = clean.startsWith("+") ? clean : `${dialCode}${clean.replace(/^0+/, "")}`;
  // Strict-ish sanity: '+' followed by digits, at least 7 total chars.
  if (!/^\+\d{6,15}$/.test(withPrefix)) return null;
  return withPrefix;
}
