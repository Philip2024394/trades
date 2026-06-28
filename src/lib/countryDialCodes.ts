// Curated list of country dial codes for the WhatsApp / phone inputs.
// Ordered: UK first (Xrated's home market), then largest-population
// English-speaking and Western European markets the platform serves.
// Add more as needed — the picker is a `<select>`, scaling is trivial.

export type CountryDialCode = {
  iso2: string;
  name: string;
  /** Includes the leading `+`. */
  dial: string;
  flag: string;
};

export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  { iso2: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { iso2: "IE", name: "Ireland", dial: "+353", flag: "🇮🇪" },
  { iso2: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { iso2: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { iso2: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
  { iso2: "NZ", name: "New Zealand", dial: "+64", flag: "🇳🇿" },
  { iso2: "DE", name: "Germany", dial: "+49", flag: "🇩🇪" },
  { iso2: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { iso2: "ES", name: "Spain", dial: "+34", flag: "🇪🇸" },
  { iso2: "IT", name: "Italy", dial: "+39", flag: "🇮🇹" },
  { iso2: "NL", name: "Netherlands", dial: "+31", flag: "🇳🇱" },
  { iso2: "PT", name: "Portugal", dial: "+351", flag: "🇵🇹" },
  { iso2: "PL", name: "Poland", dial: "+48", flag: "🇵🇱" },
  { iso2: "SE", name: "Sweden", dial: "+46", flag: "🇸🇪" },
  { iso2: "NO", name: "Norway", dial: "+47", flag: "🇳🇴" },
  { iso2: "DK", name: "Denmark", dial: "+45", flag: "🇩🇰" },
  { iso2: "FI", name: "Finland", dial: "+358", flag: "🇫🇮" },
  { iso2: "BE", name: "Belgium", dial: "+32", flag: "🇧🇪" },
  { iso2: "CH", name: "Switzerland", dial: "+41", flag: "🇨🇭" },
  { iso2: "AT", name: "Austria", dial: "+43", flag: "🇦🇹" },
  { iso2: "ID", name: "Indonesia", dial: "+62", flag: "🇮🇩" },
  { iso2: "SG", name: "Singapore", dial: "+65", flag: "🇸🇬" },
  { iso2: "MY", name: "Malaysia", dial: "+60", flag: "🇲🇾" },
  { iso2: "PH", name: "Philippines", dial: "+63", flag: "🇵🇭" },
  { iso2: "TH", name: "Thailand", dial: "+66", flag: "🇹🇭" },
  { iso2: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { iso2: "ZA", name: "South Africa", dial: "+27", flag: "🇿🇦" },
  { iso2: "AE", name: "United Arab Emirates", dial: "+971", flag: "🇦🇪" }
];

const ISO_INDEX: Record<string, CountryDialCode> = Object.fromEntries(
  COUNTRY_DIAL_CODES.map((c) => [c.iso2.toUpperCase(), c])
);

export function countryByIso2(iso2: string | null | undefined): CountryDialCode | null {
  if (!iso2) return null;
  return ISO_INDEX[iso2.toUpperCase()] ?? null;
}

/** Split a stored phone string into { dial, local } when it begins with
 *  one of our known dial codes. Falls back to { dial: UK, local: input }
 *  so old plain-digit UK numbers still slot into the new picker. */
export function splitPhone(value: string): { iso2: string; dial: string; local: string } {
  const v = (value ?? "").trim();
  if (!v) return { iso2: "GB", dial: "+44", local: "" };
  // Match the longest-prefix dial code first so "+1" doesn't shadow "+1xxx".
  const sorted = [...COUNTRY_DIAL_CODES].sort(
    (a, b) => b.dial.length - a.dial.length
  );
  for (const c of sorted) {
    if (v.startsWith(c.dial)) {
      return { iso2: c.iso2, dial: c.dial, local: v.slice(c.dial.length).trim() };
    }
  }
  // No dial-code prefix found — assume UK and use the whole input as local.
  return { iso2: "GB", dial: "+44", local: v };
}
