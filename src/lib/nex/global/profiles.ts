// Country profiles — one structured summary per supported country.
// Deliberately conservative: labour baselines are wide bands (not
// specific quotes), climate is a broad zone label, trade bodies +
// government links point at official/authoritative sites we've
// verified.

import { evidenceFor, type CountryProfile } from "./types";
import type { CountryCode } from "../world/types";

const PROFILES: Record<CountryCode, CountryProfile> = {
  UK: {
    country:        "UK",
    country_label:  "United Kingdom (England + Wales)",
    industry_overview: "Housing-led construction. Trades regulated by CITB scheme + CSCS card system. Most residential work uses masonry cavity walls; commercial trends towards steel + concrete frame.",
    typical_materials: ["cavity brickwork", "plasterboard on stud", "concrete tile roofs", "timber trussed roofs"],
    climate_zone:   "temperate_wet",
    labour_baseline: "£30–55 per skilled-trade hour (region-dependent)",
    currency_symbol: "£",
    trade_bodies: [
      { name: "Federation of Master Builders (FMB)",  url: "https://www.fmb.org.uk/" },
      { name: "Construction Industry Training Board (CITB)", url: "https://www.citb.co.uk/" },
      { name: "TrustMark (Government-endorsed quality scheme)", url: "https://www.trustmark.org.uk/" }
    ],
    government_link: { name: "gov.uk building regulations collection", url: "https://www.gov.uk/government/collections/approved-documents" },
    notes: [
      "Northern Ireland uses its own Building Regulations — treat separately when a project sits there.",
      "Scotland uses the Building Standards technical handbooks — separate from Approved Documents."
    ],
    evidence: evidenceFor("UK profile", [])
  },

  IE: {
    country:        "IE",
    country_label:  "Republic of Ireland",
    industry_overview: "Similar residential mix to UK but faster-growing timber-frame + steel-frame commercial share. Regulated via Building Control Amendment Regulations (BCAR).",
    typical_materials: ["cavity blockwork", "concrete tile roofs", "increasing timber frame + insulated concrete formwork"],
    climate_zone:   "temperate_wet",
    labour_baseline: "€35–55 per skilled-trade hour",
    currency_symbol: "€",
    trade_bodies: [
      { name: "Construction Industry Federation (CIF)",  url: "https://cif.ie/" },
      { name: "Register of Electrical Contractors of Ireland (RECI)", url: "https://www.safeelectric.ie/" }
    ],
    government_link: { name: "gov.ie building regulations", url: "https://www.gov.ie/en/publication/building-regulations/" },
    notes: [
      "The Republic uses TGDs (Technical Guidance Documents), not the UK's Approved Documents.",
      "BC(A)R requires certifiable design + assigned certifier on many projects."
    ],
    evidence: evidenceFor("IE profile", [])
  },

  AU: {
    country:        "AU",
    country_label:  "Australia",
    industry_overview: "Timber frame is dominant residentially, concrete + steel frame commercially. National Construction Code (NCC) is federal but each state administers licensing.",
    typical_materials: ["timber frame + brick veneer", "concrete tile / colorbond roof", "double glazing more common in cold-climate states"],
    climate_zone:   "mixed",
    labour_baseline: "A$45–75 per skilled-trade hour (state-dependent)",
    currency_symbol: "A$",
    trade_bodies: [
      { name: "Master Builders Australia (MBA)",     url: "https://www.masterbuilders.com.au/" },
      { name: "Housing Industry Association (HIA)", url: "https://hia.com.au/" }
    ],
    government_link: { name: "Australian Building Codes Board (ABCB)", url: "https://ncc.abcb.gov.au/" },
    notes: [
      "Bushfire Attack Level (BAL) requirements + cyclone zones drive material choice in many regions."
    ],
    evidence: evidenceFor("AU profile", [])
  },

  US: {
    country:        "US",
    country_label:  "United States",
    industry_overview: "Predominantly light-timber-frame residential + steel/concrete commercial. Codes are adopted state-by-state (IBC + IRC + NEC + others) with local amendments.",
    typical_materials: ["stick-built timber frame", "asphalt shingle roofs", "vinyl siding common in residential"],
    climate_zone:   "mixed",
    labour_baseline: "$45–85 per skilled-trade hour (state-dependent)",
    currency_symbol: "$",
    trade_bodies: [
      { name: "National Association of Home Builders (NAHB)",       url: "https://www.nahb.org/" },
      { name: "Associated General Contractors of America (AGC)",   url: "https://www.agc.org/" }
    ],
    government_link: { name: "International Code Council (ICC) — codes.iccsafe.org", url: "https://codes.iccsafe.org/" },
    notes: [
      "Sales tax varies by state — no single federal rate.",
      "Snow load / seismic zones vary widely; confirm the amendment adopted by the local jurisdiction."
    ],
    evidence: evidenceFor("US profile", [])
  },

  CA: {
    country:        "CA",
    country_label:  "Canada",
    industry_overview: "Cold-climate residential dominated by wood-frame with heavy insulation. Provinces adopt National Building Code with amendments (BC, Ontario, Alberta, Québec each maintain their own code books).",
    typical_materials: ["wood frame + rigid insulation", "asphalt shingle / metal roofs", "poured concrete basements"],
    climate_zone:   "cold",
    labour_baseline: "C$45–75 per skilled-trade hour (province-dependent)",
    currency_symbol: "C$",
    trade_bodies: [
      { name: "Canadian Home Builders' Association (CHBA)", url: "https://www.chba.ca/" },
      { name: "Canadian Construction Association (CCA)",   url: "https://www.cca-acc.com/" }
    ],
    government_link: { name: "Codes Canada — nrc.canada.ca", url: "https://nrc.canada.ca/en/certifications-evaluations-standards/codes-canada" },
    notes: [
      "Québec uses the Construction Code Chapter I — Building rather than NBC directly.",
      "Provincial PST/HST stacks on top of federal GST — quote regionally."
    ],
    evidence: evidenceFor("CA profile", [])
  },

  NZ: {
    country:        "NZ",
    country_label:  "New Zealand",
    industry_overview: "Seismic + damp climate drives heavy timber-frame + light-metal-clad practice. NZBC is performance-based with Acceptable Solutions.",
    typical_materials: ["timber frame + weatherboard/monolithic cladding", "long-run steel roofing", "seismic bracing rules apply"],
    climate_zone:   "temperate_wet",
    labour_baseline: "NZ$45–75 per skilled-trade hour",
    currency_symbol: "NZ$",
    trade_bodies: [
      { name: "Registered Master Builders",           url: "https://www.masterbuilder.org.nz/" },
      { name: "Building Officials Institute of NZ",   url: "https://www.boinz.org.nz/" }
    ],
    government_link: { name: "MBIE building.govt.nz", url: "https://www.building.govt.nz/" },
    notes: [
      "Restricted Building Work must be done by (or supervised by) a Licensed Building Practitioner."
    ],
    evidence: evidenceFor("NZ profile", [])
  },

  AE: {
    country:        "AE",
    country_label:  "United Arab Emirates",
    industry_overview: "Hot / dry climate drives heavy insulation + reflective envelopes. Concrete frame + block infill is dominant. Dubai + Abu Dhabi maintain distinct code books.",
    typical_materials: ["reinforced concrete frame", "concrete block infill", "insulated aluminium curtain walls in commercial"],
    climate_zone:   "desert",
    labour_baseline: "AED 60–120 per skilled-trade hour (emirate-dependent)",
    currency_symbol: "AED ",
    trade_bodies: [
      { name: "Dubai Municipality",  url: "https://www.dm.gov.ae/" },
      { name: "UAE Society of Engineers", url: null }
    ],
    government_link: { name: "Dubai Municipality — Buildings Development", url: "https://www.dm.gov.ae/en/Business/Buildings-Development/" },
    notes: [
      "UAE Fire and Life Safety Code of Practice is authoritative for fire-safety design.",
      "Each emirate has its own building department — confirm the correct authority for the project's emirate."
    ],
    evidence: evidenceFor("AE profile", [])
  },

  unknown: {
    country:        "unknown",
    country_label:  "Unknown location",
    industry_overview: "No location resolved — country profile suppressed until Nex can identify your country.",
    typical_materials: [],
    climate_zone:   "mixed",
    labour_baseline: "unavailable",
    currency_symbol: "£",
    trade_bodies:   [],
    government_link: { name: "-", url: null },
    notes:          ["Set your country in Studio to unlock the country profile."],
    evidence: evidenceFor("unknown profile", [])
  }
};

export function profileFor(country: CountryCode): CountryProfile {
  return PROFILES[country] ?? PROFILES.unknown;
}

/** Every country label + code, for the clarification prompt UI. */
export function supportedCountries(): Array<{ code: CountryCode; label: string }> {
  return (Object.keys(PROFILES) as CountryCode[])
    .filter((c) => c !== "unknown")
    .map((c) => ({ code: c, label: PROFILES[c].country_label }));
}
