// src/lib/nex-native/emergency/local-emergency-numbers.ts
//
// NEX Emergency Help · country → local emergency number lookup.
// Sealed 2026-10-10 by the Radius + Report-to-Police agent (H2).
// --------------------------------------------------------------
// Purpose:
//   The responder-side "Report to Police" hand-off opens the user's
//   device dialer at `tel:<number>` so the responder can speak to a
//   real emergency operator. The number MUST be chosen by the
//   responder's locale, not the requester's — because the responder
//   is the one placing the call from their device.
//
// Doctrine · hands-off, never auto-dial:
//   · This module is a lookup table ONLY. It never dials, never
//     notifies emergency services, never claims to have done so.
//   · The "NEX has not contacted emergency services" invariant lives
//     in `ReportToPolicePanel.tsx`. Do not weaken it here.
//
// Source register — the seed below is a reasonable starting point
// drawn from Wikipedia's "List of emergency telephone numbers" and
// each country's official government guidance circa 2026. BEFORE
// live-mode activation (SIMULATED chip flipped off), the operator
// MUST verify every row against the current official directive for
// that jurisdiction. Numbers do change (e.g. Indonesia's PSAP
// migration to a unified 112 line, parts of Europe migrating from
// legacy 999 to 112). See
//   `docs/doctrine/nex-emergency-help-police-handoff-2026-10-10.md`.
//
// Fallback: the international ITU-T E.161 recommendation 112 is used
// when the country code is unknown, missing, or malformed. Many GSM
// handsets will route 112 to the local emergency centre even without
// a SIM, so it is the safest universal default.

export interface LocalEmergencyNumber {
  /** ISO 3166-1 alpha-2, UPPER-case (e.g. "ID", "US", "GB"). */
  readonly countryCode: string;
  /** Human-readable country name (English, no translation layer). */
  readonly countryName: string;
  /**
   * General emergency number — the digit the dialer should route
   * through if there is only one line available. Always set.
   */
  readonly generalNumber: string;
  /** Dedicated police line, when distinct from `generalNumber`. */
  readonly policeNumber?: string;
  /** Dedicated ambulance line, when distinct from `generalNumber`. */
  readonly ambulanceNumber?: string;
  /** Dedicated fire line, when distinct from `generalNumber`. */
  readonly fireNumber?: string;
}

/**
 * International fallback — the ITU-T E.161 recommendation. Reachable
 * on most GSM / 3G / 4G / 5G networks worldwide and often routes to
 * the local emergency centre even on a locked / no-SIM handset.
 */
export const INTERNATIONAL_FALLBACK: LocalEmergencyNumber = Object.freeze({
  countryCode: "ZZ",
  countryName: "International (fallback)",
  generalNumber: "112",
});

/**
 * Country-code → emergency-number lookup. Keys are ISO 3166-1
 * alpha-2, UPPER case. Expand only via verified sources (see module
 * header). Keep the shape stable so UI and tests can trust it.
 */
export const LOCAL_EMERGENCY_NUMBERS: Readonly<Record<string, LocalEmergencyNumber>> = Object.freeze({
  ID: {
    countryCode: "ID",
    countryName: "Indonesia",
    generalNumber: "112",
    policeNumber: "110",
    ambulanceNumber: "118",
    fireNumber: "113",
  },
  AU: {
    countryCode: "AU",
    countryName: "Australia",
    generalNumber: "000",
    policeNumber: "000",
    ambulanceNumber: "000",
    fireNumber: "000",
  },
  GB: {
    countryCode: "GB",
    countryName: "United Kingdom",
    generalNumber: "999",
    policeNumber: "999",
    ambulanceNumber: "999",
    fireNumber: "999",
  },
  US: {
    countryCode: "US",
    countryName: "United States",
    generalNumber: "911",
    policeNumber: "911",
    ambulanceNumber: "911",
    fireNumber: "911",
  },
  NZ: {
    countryCode: "NZ",
    countryName: "New Zealand",
    generalNumber: "111",
    policeNumber: "111",
    ambulanceNumber: "111",
    fireNumber: "111",
  },
  JP: {
    countryCode: "JP",
    countryName: "Japan",
    generalNumber: "110",
    policeNumber: "110",
    ambulanceNumber: "119",
    fireNumber: "119",
  },
  CN: {
    countryCode: "CN",
    countryName: "China",
    generalNumber: "110",
    policeNumber: "110",
    ambulanceNumber: "120",
    fireNumber: "119",
  },
  IN: {
    countryCode: "IN",
    countryName: "India",
    generalNumber: "112",
    policeNumber: "100",
    ambulanceNumber: "102",
    fireNumber: "101",
  },
  DE: {
    countryCode: "DE",
    countryName: "Germany",
    generalNumber: "112",
    policeNumber: "110",
    ambulanceNumber: "112",
    fireNumber: "112",
  },
  FR: {
    countryCode: "FR",
    countryName: "France",
    generalNumber: "112",
    policeNumber: "17",
    ambulanceNumber: "15",
    fireNumber: "18",
  },
  ES: {
    countryCode: "ES",
    countryName: "Spain",
    generalNumber: "112",
    policeNumber: "091",
    ambulanceNumber: "061",
    fireNumber: "080",
  },
  IT: {
    countryCode: "IT",
    countryName: "Italy",
    generalNumber: "112",
    policeNumber: "113",
    ambulanceNumber: "118",
    fireNumber: "115",
  },
  BR: {
    countryCode: "BR",
    countryName: "Brazil",
    generalNumber: "190",
    policeNumber: "190",
    ambulanceNumber: "192",
    fireNumber: "193",
  },
  ZA: {
    countryCode: "ZA",
    countryName: "South Africa",
    generalNumber: "10111",
    policeNumber: "10111",
    ambulanceNumber: "10177",
    fireNumber: "10111",
  },
  KR: {
    countryCode: "KR",
    countryName: "South Korea",
    generalNumber: "112",
    policeNumber: "112",
    ambulanceNumber: "119",
    fireNumber: "119",
  },
  TH: {
    countryCode: "TH",
    countryName: "Thailand",
    generalNumber: "191",
    policeNumber: "191",
    ambulanceNumber: "1669",
    fireNumber: "199",
  },
  SG: {
    countryCode: "SG",
    countryName: "Singapore",
    generalNumber: "999",
    policeNumber: "999",
    ambulanceNumber: "995",
    fireNumber: "995",
  },
  MY: {
    countryCode: "MY",
    countryName: "Malaysia",
    generalNumber: "999",
    policeNumber: "999",
    ambulanceNumber: "999",
    fireNumber: "994",
  },
  PH: {
    countryCode: "PH",
    countryName: "Philippines",
    generalNumber: "911",
    policeNumber: "911",
    ambulanceNumber: "911",
    fireNumber: "911",
  },
  VN: {
    countryCode: "VN",
    countryName: "Vietnam",
    generalNumber: "113",
    policeNumber: "113",
    ambulanceNumber: "115",
    fireNumber: "114",
  },
});

/**
 * Resolve the emergency-number record for a given country code.
 *
 *   · Matching is case-insensitive · `"id"`, `"ID"`, `" Id "` all
 *     resolve to the Indonesia row.
 *   · `null`, `undefined`, blank, or any value not present in the
 *     seed table falls back to the international record (112).
 *   · This function MUST never throw · the UI depends on receiving
 *     a usable value on every call.
 */
export function resolveEmergencyNumber(
  countryCode: string | null | undefined,
): LocalEmergencyNumber {
  if (typeof countryCode !== "string") return INTERNATIONAL_FALLBACK;
  const normalised = countryCode.trim().toUpperCase();
  if (normalised.length === 0) return INTERNATIONAL_FALLBACK;
  const match = LOCAL_EMERGENCY_NUMBERS[normalised];
  return match ?? INTERNATIONAL_FALLBACK;
}
