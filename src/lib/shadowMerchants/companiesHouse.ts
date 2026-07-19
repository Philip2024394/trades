// Companies House API client — public-data scraper for the
// shadow-profile system.
//
// Free API tier: https://developer-specs.company-information.service.gov.uk/
// Rate limit: 600 requests / 5 minutes. Throttle scraper accordingly.
//
// SIC codes we search — UK trades:
//   43110 — Demolition
//   43120 — Site preparation
//   43130 — Test drilling and boring
//   43210 — Electrical installation
//   43220 — Plumbing, heat and air-conditioning installation
//   43290 — Other construction installation
//   43310 — Plastering
//   43320 — Joinery
//   43330 — Floor and wall covering
//   43341 — Painting
//   43342 — Glazing
//   43390 — Other building completion
//   43910 — Roofing
//   43991 — Scaffolds and work platforms erection
//   43999 — Other specialised construction n.e.c.
//   81300 — Landscape service activities
//
// Auth: HTTP Basic with API key as username, no password (yes really).

import type { ShadowMerchant } from "./types";

const CH_BASE = "https://api.company-information.service.gov.uk";
const API_KEY = process.env.COMPANIES_HOUSE_API_KEY || "";

export const TRADE_SIC_CODES = [
  "43110", "43120", "43130", "43210", "43220", "43290",
  "43310", "43320", "43330", "43341", "43342", "43390",
  "43910", "43991", "43999", "81300"
] as const;

// Map SIC → canonical trade slug used across the platform
export const SIC_TO_TRADE: Record<string, string> = {
  "43110": "demolition",
  "43120": "site-preparation",
  "43130": "test-drilling",
  "43210": "electrician",
  "43220": "plumber",
  "43290": "installer",
  "43310": "plasterer",
  "43320": "joiner",
  "43330": "tiler",
  "43341": "painter",
  "43342": "glazier",
  "43390": "builder",
  "43910": "roofer",
  "43991": "scaffolder",
  "43999": "specialist-trade",
  "81300": "landscaper"
};

type CHSearchResult = {
  items?: Array<{
    company_number: string;
    title:          string;
    company_status: string;
    date_of_creation?: string;
    address?: {
      address_line_1?: string;
      address_line_2?: string;
      locality?:       string;
      region?:         string;
      postal_code?:    string;
      country?:        string;
    };
    sic_codes?: string[];
  }>;
};

type CHCompanyProfile = {
  company_name:      string;
  company_number:    string;
  company_status:    string;
  date_of_creation?: string;
  registered_office_address?: {
    address_line_1?: string;
    address_line_2?: string;
    locality?:       string;
    region?:         string;
    postal_code?:    string;
    country?:        string;
  };
  sic_codes?: string[];
};

function authHeader(): string {
  return "Basic " + Buffer.from(`${API_KEY}:`).toString("base64");
}

/**
 * Search companies by SIC code. CH doesn't natively support SIC
 * search in the free tier, so we combine keyword + SIC filter.
 * Returns up to `size` results per page.
 */
export async function searchTradesInCity(opts: {
  sic:  string;
  city: string;
  size?: number;
  startIndex?: number;
}): Promise<Array<{
  companyNumber: string;
  name:          string;
  status:        string;
  dateOfCreation: string | null;
  address: { line1: string; locality: string; postal: string } | null;
  sicCodes:      string[];
}>> {
  if (!API_KEY) {
    console.warn("[companiesHouse] COMPANIES_HOUSE_API_KEY not set — returning empty");
    return [];
  }

  // Use advanced search endpoint — allows SIC + location filter
  const params = new URLSearchParams({
    sic_codes:    opts.sic,
    location:     opts.city,
    size:         String(opts.size ?? 20),
    start_index:  String(opts.startIndex ?? 0)
  });

  const res = await fetch(`${CH_BASE}/advanced-search/companies?${params}`, {
    headers: { Authorization: authHeader() }
  });

  if (!res.ok) {
    console.error(`[companiesHouse] search failed ${res.status}`, await res.text());
    return [];
  }

  const data = (await res.json()) as CHSearchResult;
  return (data.items || []).map((c) => ({
    companyNumber:  c.company_number,
    name:           c.title,
    status:         c.company_status,
    dateOfCreation: c.date_of_creation || null,
    address: c.address
      ? {
          line1:    [c.address.address_line_1, c.address.address_line_2].filter(Boolean).join(", "),
          locality: c.address.locality || "",
          postal:   c.address.postal_code || ""
        }
      : null,
    sicCodes: c.sic_codes || []
  }));
}

/**
 * Fetch full company profile — used for enrichment after search hit.
 */
export async function fetchCompanyProfile(companyNumber: string): Promise<CHCompanyProfile | null> {
  if (!API_KEY) return null;
  const res = await fetch(`${CH_BASE}/company/${companyNumber}`, {
    headers: { Authorization: authHeader() }
  });
  if (!res.ok) return null;
  return (await res.json()) as CHCompanyProfile;
}

/**
 * Normalise a CH company record into a ShadowMerchant-insertable shape.
 * NB: CH does NOT expose phone/email/website. Enrichment for those
 * fields comes from Google Places or Yell — separate scraper module.
 */
export function normaliseCHRecord(company: {
  companyNumber:  string;
  name:           string;
  dateOfCreation: string | null;
  address: { line1: string; locality: string; postal: string } | null;
  sicCodes: string[];
}): Partial<ShadowMerchant> {
  const tradeSic = company.sicCodes.find((s) => SIC_TO_TRADE[s]);
  const trade    = tradeSic ? SIC_TO_TRADE[tradeSic] : null;
  const yearsEst = company.dateOfCreation
    ? Math.floor((Date.now() - new Date(company.dateOfCreation).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  return {
    source:                 "companies_house",
    source_ref:             company.companyNumber,
    business_name:          company.name,
    trade_type:             trade,
    trade_type_raw:         tradeSic || null,
    city:                   company.address?.locality || null,
    postcode:               company.address?.postal   || null,
    address_line:           company.address?.line1    || null,
    companies_house_number: company.companyNumber,
    years_established:      yearsEst
  };
}
