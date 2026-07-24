// Region configuration.
//
// The regulation source links are OFFICIAL government-published URLs
// where we have them. When we DON'T have a country-specific source
// for a topic, the field is null and callers surface
// NO_LOCAL_SOURCE_MESSAGE — never a made-up URL.

import { evidenceFor, NO_LOCAL_SOURCE_MESSAGE, type CountryCode, type RegionConfig, type RegulationSource } from "./types";

const uk_building: RegulationSource = { label: "Approved Documents (Building Regulations 2010, England)", short: "AD", url: "https://www.gov.uk/government/collections/approved-documents" };
const uk_stairs:   RegulationSource = { label: "Approved Document K — Protection from falling, collision and impact", short: "Part K", url: "https://www.gov.uk/government/publications/protection-from-falling-collision-and-impact-approved-document-k" };
const uk_fire:     RegulationSource = { label: "Approved Document B — Fire safety", short: "Part B", url: "https://www.gov.uk/government/publications/fire-safety-approved-document-b" };
const uk_access:   RegulationSource = { label: "Approved Document M — Access to and use of buildings", short: "Part M", url: "https://www.gov.uk/government/publications/access-to-and-use-of-buildings-approved-document-m" };
const uk_electric: RegulationSource = { label: "Approved Document P — Electrical safety (dwellings) + BS 7671 IET Wiring Regulations", short: "Part P / BS 7671", url: "https://www.gov.uk/government/publications/electrical-safety-approved-document-p" };
const uk_energy:   RegulationSource = { label: "Approved Document L — Conservation of fuel and power", short: "Part L", url: "https://www.gov.uk/government/publications/conservation-of-fuel-and-power-approved-document-l" };
const uk_plumbing: RegulationSource = { label: "Approved Document G — Sanitation, hot water safety and water efficiency", short: "Part G", url: "https://www.gov.uk/government/publications/sanitation-hot-water-safety-and-water-efficiency-approved-document-g" };

const ie_building: RegulationSource = { label: "Irish Building Regulations Technical Guidance Documents (TGDs)", short: "TGDs", url: "https://www.gov.ie/en/publication/building-regulations/" };
const ie_stairs:   RegulationSource = { label: "TGD K — Stairs, ladders, ramps and guards", short: "TGD K", url: "https://www.gov.ie/en/publication/building-regulations-technical-guidance-documents/" };
const ie_fire:     RegulationSource = { label: "TGD B — Fire safety", short: "TGD B", url: "https://www.gov.ie/en/publication/building-regulations-technical-guidance-documents/" };
const ie_access:   RegulationSource = { label: "TGD M — Access and use", short: "TGD M", url: "https://www.gov.ie/en/publication/building-regulations-technical-guidance-documents/" };

const au_ncc:      RegulationSource = { label: "National Construction Code (NCC) — Volumes One + Two", short: "NCC", url: "https://ncc.abcb.gov.au/" };

const us_ibc:      RegulationSource = { label: "International Building Code (IBC) — commercial", short: "IBC", url: "https://codes.iccsafe.org/" };
const us_irc:      RegulationSource = { label: "International Residential Code (IRC) — residential", short: "IRC", url: "https://codes.iccsafe.org/" };

const CONFIGS: Record<CountryCode, RegionConfig> = {
  UK: {
    country:          "UK",
    country_label:    "United Kingdom (England + Wales)",
    currency:         "GBP",
    currency_symbol:  "£",
    vat_or_gst_rate:  20,
    vat_or_gst_label: "VAT",
    unit_system:      "metric",
    regulations: {
      building:      uk_building,
      fire:          uk_fire,
      accessibility: uk_access,
      electrical:    uk_electric,
      plumbing:      uk_plumbing,
      stairs:        uk_stairs,
      energy:        uk_energy
    },
    evidence:         evidenceFor("Approved Documents — gov.uk", [])
  },

  IE: {
    country:          "IE",
    country_label:    "Republic of Ireland",
    currency:         "EUR",
    currency_symbol:  "€",
    vat_or_gst_rate:  23,
    vat_or_gst_label: "VAT",
    unit_system:      "metric",
    regulations: {
      building:      ie_building,
      fire:          ie_fire,
      accessibility: ie_access,
      electrical:    null,   // no ETCI TGD link on file
      plumbing:      null,
      stairs:        ie_stairs,
      energy:        null
    },
    evidence:         evidenceFor("Irish Building Regs TGDs — gov.ie", [])
  },

  AU: {
    country:          "AU",
    country_label:    "Australia",
    currency:         "AUD",
    currency_symbol:  "A$",
    vat_or_gst_rate:  10,
    vat_or_gst_label: "GST",
    unit_system:      "metric",
    regulations: {
      building:      au_ncc,
      fire:          au_ncc,
      accessibility: au_ncc,
      electrical:    null,   // AS/NZS 3000 not yet on file
      plumbing:      null,
      stairs:        au_ncc,
      energy:        au_ncc
    },
    evidence:         evidenceFor("National Construction Code — abcb.gov.au", [])
  },

  US: {
    country:          "US",
    country_label:    "United States",
    currency:         "USD",
    currency_symbol:  "$",
    vat_or_gst_rate:  0,      // state-level sales tax, not federal — 0 as sentinel
    vat_or_gst_label: "Sales Tax",
    unit_system:      "imperial",
    regulations: {
      building:      us_ibc,
      fire:          us_ibc,
      accessibility: us_ibc,
      electrical:    null,   // NEC / NFPA 70 not on file
      plumbing:      null,
      stairs:        us_irc,
      energy:        null
    },
    evidence:         evidenceFor("ICC codes — codes.iccsafe.org", [])
  },

  CA: {
    country:          "CA",
    country_label:    "Canada",
    currency:         "CAD",
    currency_symbol:  "C$",
    vat_or_gst_rate:  5,               // federal GST — provinces add PST/HST on top
    vat_or_gst_label: "GST",
    unit_system:      "metric",
    regulations: {
      building:      { label: "National Building Code of Canada (NBC)",                     short: "NBC",   url: "https://nrc.canada.ca/en/certifications-evaluations-standards/codes-canada/codes-canada-publications" },
      fire:          { label: "National Fire Code of Canada (NFC)",                          short: "NFC",   url: "https://nrc.canada.ca/en/certifications-evaluations-standards/codes-canada/codes-canada-publications" },
      accessibility: { label: "CSA B651 — Accessible design for the built environment",     short: "CSA B651", url: "https://www.csagroup.org/store/product/CSA%20B651%3A18/" },
      electrical:    { label: "CSA C22.1 — Canadian Electrical Code Part I",                short: "CEC",   url: "https://www.csagroup.org/store/product/2701170/" },
      plumbing:      null,
      stairs:        { label: "NBC Section 9.8 — Stairs, ramps, handrails and guards",      short: "NBC 9.8", url: "https://nrc.canada.ca/en/certifications-evaluations-standards/codes-canada/codes-canada-publications" },
      energy:        { label: "NBC Section 9.36 — Energy efficiency",                        short: "NBC 9.36", url: "https://nrc.canada.ca/en/certifications-evaluations-standards/codes-canada/codes-canada-publications" }
    },
    evidence:         evidenceFor("Canadian Codes — nrc.canada.ca + CSA", [])
  },

  NZ: {
    country:          "NZ",
    country_label:    "New Zealand",
    currency:         "NZD",
    currency_symbol:  "NZ$",
    vat_or_gst_rate:  15,
    vat_or_gst_label: "GST",
    unit_system:      "metric",
    regulations: {
      building:      { label: "New Zealand Building Code (NZBC) — Acceptable Solutions and Verification Methods", short: "NZBC", url: "https://www.building.govt.nz/building-code-compliance/" },
      fire:          { label: "NZBC Clause C — Protection from fire",                                              short: "NZBC C", url: "https://www.building.govt.nz/building-code-compliance/c-protection-from-fire/" },
      accessibility: { label: "NZBC Clause D1 — Access routes",                                                    short: "NZBC D1", url: "https://www.building.govt.nz/building-code-compliance/d-access/d1-access-routes/" },
      electrical:    null,   // AS/NZS 3000 not on file
      plumbing:      null,   // NZBC G12 not linked yet
      stairs:        { label: "NZBC Clause D1/AS1 — Access routes acceptable solution",                            short: "NZBC D1/AS1", url: "https://www.building.govt.nz/building-code-compliance/d-access/d1-access-routes/" },
      energy:        { label: "NZBC Clause H1 — Energy efficiency",                                                short: "NZBC H1", url: "https://www.building.govt.nz/building-code-compliance/h-energy-efficiency/" }
    },
    evidence:         evidenceFor("New Zealand Building Code — building.govt.nz", [])
  },

  AE: {
    country:          "AE",
    country_label:    "United Arab Emirates",
    currency:         "AED",
    currency_symbol:  "AED ",
    vat_or_gst_rate:  5,
    vat_or_gst_label: "VAT",
    unit_system:      "metric",
    regulations: {
      building:      { label: "Dubai Building Code",                                                                   short: "DBC", url: "https://www.dm.gov.ae/en/Business/Buildings-Development/Pages/Dubai-Building-Code.aspx" },
      fire:          { label: "UAE Fire and Life Safety Code of Practice",                                             short: "UAE FLS Code", url: null },
      accessibility: null,
      electrical:    null,
      plumbing:      null,
      stairs:        null,
      energy:        null
    },
    evidence:         evidenceFor("UAE codes — dm.gov.ae + Civil Defence", [])
  },

  unknown: {
    country:          "unknown",
    country_label:    "Unknown location",
    currency:         "GBP",   // Trade OS default until located
    currency_symbol:  "£",
    vat_or_gst_rate:  20,
    vat_or_gst_label: "VAT",
    unit_system:      "metric",
    regulations: {
      building:      null,
      fire:          null,
      accessibility: null,
      electrical:    null,
      plumbing:      null,
      stairs:        null,
      energy:        null
    },
    evidence:         evidenceFor("No location resolved — engine default", [])
  }
};

export function regionConfigFor(country: CountryCode): RegionConfig {
  return CONFIGS[country] ?? CONFIGS.unknown;
}

/** Return the correct regulation source for a topic in a country, or
 *  null when no country-specific source is on file. Callers must
 *  then surface NO_LOCAL_SOURCE_MESSAGE — never a generic pointer. */
export function regulationFor(country: CountryCode, topic: keyof RegionConfig["regulations"]): RegulationSource | null {
  const cfg = regionConfigFor(country);
  return cfg.regulations[topic] ?? null;
}

export { NO_LOCAL_SOURCE_MESSAGE };
