// Location resolver — priority chain per Phase 20 mandate.
//
//   1. Merchant's saved business country/region (highest priority)
//   2. Active project location or property address
//   3. Customer's selected country
//   4. Device or browser location (with permission)
//   5. IP address (fallback only)
//   6. Engine default (unknown)
//
// The signal used is recorded on LocationContext.source so the
// merchant can see WHY Nex picked a country. They can always override
// per-request or per-project.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type CountryCode, type LocationContext, type LocationSource } from "./types";

const COUNTRY_ALIASES: Array<{ re: RegExp; code: CountryCode }> = [
  { re: /^(united\s+kingdom|uk|great\s+britain|gb|england|wales|scotland|northern\s+ireland)$/i, code: "UK" },
  { re: /^(ireland|republic\s+of\s+ireland|ie|éire|eire)$/i,                                       code: "IE" },
  { re: /^(australia|au|aus)$/i,                                                                    code: "AU" },
  { re: /^(united\s+states|usa|us|america)$/i,                                                      code: "US" },
  { re: /^(canada|ca|can)$/i,                                                                       code: "CA" },
  { re: /^(new\s+zealand|nz|nzl|aotearoa)$/i,                                                       code: "NZ" },
  { re: /^(united\s+arab\s+emirates|uae|ae|dubai|abu\s+dhabi)$/i,                                   code: "AE" }
];

/** Normalise a free-text country string to a CountryCode. Returns
 *  "unknown" rather than fabricating a match. */
export function normaliseCountry(text: string | null | undefined): CountryCode {
  if (!text) return "unknown";
  const t = text.trim().toLowerCase();
  for (const a of COUNTRY_ALIASES) if (a.re.test(t)) return a.code;
  return "unknown";
}

export type ResolveLocationInput = {
  merchantSlug?:  string;
  /** Optional pinned project — bumps its address into priority 2. */
  projectId?:     string;
  /** Optional pinned customer contact id. */
  contactId?:     string;
  /** Explicit override — e.g. from a URL param. Highest of all when
   *  supplied. */
  override?:      { country?: CountryCode; region?: string; city?: string };
  /** For device / IP fallback — free-text values the caller passes
   *  in. We never call an external geo-IP service here. */
  device?:        { country?: string; region?: string; city?: string };
  ip_country?:    string;
};

export async function resolveLocation(input: ResolveLocationInput): Promise<LocationContext> {
  // Explicit override — treated as merchant_setting for provenance.
  if (input.override && input.override.country) {
    return {
      country:   input.override.country,
      region:    input.override.region ?? null,
      city:      input.override.city   ?? null,
      postcode:  null,
      source:    "merchant_setting",
      reason:    "Per-request override supplied by caller.",
      evidence:  evidenceFor("caller override", [])
    };
  }

  // Priority 1 — merchant listing country.
  if (input.merchantSlug) {
    const r = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("country, city, postcode_prefix")
      .eq("slug", input.merchantSlug)
      .maybeSingle();
    if (r.data && r.data.country) {
      const country = normaliseCountry(String(r.data.country));
      if (country !== "unknown") {
        return build(country, null, String(r.data.city ?? "") || null, String(r.data.postcode_prefix ?? "") || null, "merchant_setting", "From merchant business listing.");
      }
    }
  }

  // Priority 2 — active project address.
  if (input.projectId) {
    const r = await supabaseAdmin
      .from("hammerex_sitebook_projects")
      .select("address_city, address_postcode")
      .eq("id", input.projectId)
      .maybeSingle();
    if (r.data) {
      const postcode = (r.data.address_postcode as string | null) ?? null;
      // Infer country from postcode shape — UK/IE differ in shape.
      const country = countryFromPostcode(postcode);
      if (country !== "unknown") {
        return build(country, null, (r.data.address_city as string | null) ?? null, postcode, "active_project", "From the active project's address.");
      }
    }
  }

  // Priority 3 — customer contact.
  if (input.contactId) {
    const r = await supabaseAdmin
      .from("app_crm_contacts")
      .select("postcode")
      .eq("id", input.contactId)
      .maybeSingle();
    if (r.data && r.data.postcode) {
      const country = countryFromPostcode(String(r.data.postcode));
      if (country !== "unknown") {
        return build(country, null, null, String(r.data.postcode), "customer", "From the customer contact's postcode.");
      }
    }
  }

  // Priority 4 — device.
  if (input.device && input.device.country) {
    const c = normaliseCountry(input.device.country);
    if (c !== "unknown") return build(c, input.device.region ?? null, input.device.city ?? null, null, "device", "From device / browser location.");
  }

  // Priority 5 — IP fallback.
  if (input.ip_country) {
    const c = normaliseCountry(input.ip_country);
    if (c !== "unknown") return build(c, null, null, null, "ip_fallback", "From IP-address geolocation (fallback).");
  }

  // Priority 6 — engine default (unknown).
  return build("unknown", null, null, null, "engine_default", "No signal — Trade OS engine default. Set your country in Studio to fix this.");
}

function build(country: CountryCode, region: string | null, city: string | null, postcode: string | null, source: LocationSource, reason: string): LocationContext {
  return {
    country, region, city, postcode, source, reason,
    evidence: evidenceFor(`resolveLocation via ${source}`, ["hammerex_trade_off_listings", "hammerex_sitebook_projects", "app_crm_contacts"])
  };
}

/** Extremely conservative postcode → country. Only reports a country
 *  when the postcode shape is unambiguously UK or IE. Returns
 *  "unknown" for anything else. */
export function countryFromPostcode(pc: string | null): CountryCode {
  if (!pc) return "unknown";
  const t = pc.trim().toUpperCase();
  // UK: 1-2 letters + digit(s) optionally with letter + space + digit + 2 letters
  if (/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/.test(t)) return "UK";
  // UK short — outward only
  if (/^[A-Z]{1,2}\d[A-Z\d]?$/.test(t)) return "UK";
  // IE (Eircode): letter + 2 digits + space + 4 alphanumerics
  if (/^[A-Z]\d{2}\s*[A-Z0-9]{4}$/.test(t)) return "IE";
  return "unknown";
}
