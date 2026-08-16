// NEX geography · country-aware address renderer.
//
// One pure formatter · every card/profile touches it once. Per-country
// rules per the international-readiness plan (Philip 2026-08-16):
//   GB  → [city, county, postcode_prefix]
//   IE  → [city, "Co. <county>", eircode_prefix]     (de-dupe when town == county)
//   US  → [city, "<STATE> <ZIP>"]                    (region field = state code)
//   AU  → [city, "<STATE> <postcode>"]               (region field = state code)
//   fallback → [city, postcode_prefix] · never literal "UK"

export type AddressInput = {
  country?: string | null;      // canonical directory_seeds.country
  city?: string | null;         // town / city
  county?: string | null;       // UK county / IE county (free-text)
  region?: string | null;       // US state code / country-scoped region
  postcode?: string | null;     // full postcode / ZIP / Eircode
  postcode_prefix?: string | null; // outward-code / ZIP first-5 / Eircode routing key
};

function trim(x: string | null | undefined): string {
  return (x ?? "").trim();
}

function firstToken(s: string | null | undefined): string {
  const t = trim(s);
  if (!t) return "";
  return t.split(/\s+/)[0];
}

/** Compact card location (single line, no country label). */
export function formatCardLocation(input: AddressInput): string {
  const country = trim(input.country);
  const city = trim(input.city);
  const pcPrefix = trim(input.postcode_prefix) || firstToken(input.postcode);

  if (country === "USA") {
    const state = trim(input.region);
    const zip = firstToken(input.postcode) || pcPrefix;
    if (city && (state || zip)) return `${city}, ${[state, zip].filter(Boolean).join(" ")}`;
    if (city) return city;
    return [state, zip].filter(Boolean).join(" ");
  }
  if (country === "Ireland") {
    const county = trim(input.county);
    const eircode = pcPrefix;
    const showCounty = county && county.toLowerCase() !== city.toLowerCase();
    const parts = [city, showCounty ? `Co. ${county}` : "", eircode].filter(Boolean);
    return parts.join(", ");
  }
  if (country === "Australia") {
    const state = trim(input.region);
    const pc = firstToken(input.postcode) || pcPrefix;
    if (city && (state || pc)) return `${city}, ${[state, pc].filter(Boolean).join(" ")}`;
    if (city) return city;
    return [state, pc].filter(Boolean).join(" ");
  }
  // United Kingdom + fallback
  const parts = [city, pcPrefix].filter(Boolean);
  return parts.join(", ");
}

/** Full profile-line address (fuller, still one line, no country label). */
export function formatProfileLocation(input: AddressInput): string {
  const country = trim(input.country);
  const city = trim(input.city);
  const pcFull = trim(input.postcode);

  if (country === "USA") {
    const state = trim(input.region);
    const zip = pcFull;
    if (city && (state || zip)) return `${city}, ${[state, zip].filter(Boolean).join(" ")}`;
    if (city) return city;
    return [state, zip].filter(Boolean).join(" ");
  }
  if (country === "Ireland") {
    const county = trim(input.county);
    const showCounty = county && county.toLowerCase() !== city.toLowerCase();
    return [city, showCounty ? `Co. ${county}` : "", pcFull].filter(Boolean).join(", ");
  }
  if (country === "Australia") {
    const state = trim(input.region);
    if (city && (state || pcFull)) return `${city}, ${[state, pcFull].filter(Boolean).join(" ")}`;
    if (city) return city;
    return [state, pcFull].filter(Boolean).join(" ");
  }
  // UK + fallback
  const county = trim(input.county);
  return [city, county, pcFull].filter(Boolean).join(", ");
}
