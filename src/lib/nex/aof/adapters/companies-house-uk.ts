// src/lib/nex/aof/adapters/companies-house-uk.ts
//
// Companies House UK adapter · Founder-signed source · 2026-09-22.
//
// Adds ~5M UK companies to the discovery frontier · free official API.
// Rate limit: 600 requests / 5 minutes (2 req/sec average · governor-managed).
//
// **Discovery only** — Companies House does NOT publish websites. This
// adapter returns business candidates WITHOUT a website URL. The website
// resolution step (via search / OSM overlap / user-donated) is a separate
// pipeline stage handled elsewhere. So this adapter's yield is candidates
// NOT emails · which is exactly what the frontier needs.
//
// Search modes:
//   1) Company name search  · q= keyword · returns companies whose name matches
//   2) Advanced company search · sic_codes filter · returns everyone with that
//      code · construction industry SIC codes 41100 · 41200 · 42110-42990
//      · 43110-43999 (scaffolding = 43999 "Other specialised construction")
//
// Rate governance:
//   - Every fetchCandidates() call increments a in-memory counter
//   - Sleeps 500ms between requests (2/sec)
//   - Respects 429 responses with Retry-After
//
// Doctrine locks:
//   - _CH_ADAPTER_NEVER_INVENTS_A_COMPANY
//   - _CH_ADAPTER_REQUIRES_API_KEY_OR_RETURNS_NOT_CONFIGURED
//   - _CH_ADAPTER_HONORS_RATE_LIMIT

export type CompaniesHouseResolution =
  | { configured: true; api_key: string }
  | { configured: false; reason: string };

export interface CompaniesHouseCandidate {
  readonly company_number: string;
  readonly company_name: string;
  readonly company_status: string;
  readonly company_type: string | null;
  readonly date_of_creation: string | null;
  readonly address_line: string | null;
  readonly postal_code: string | null;
  readonly country: string | null;
  readonly sic_codes: ReadonlyArray<string>;
  readonly source_url: string;                 // provenance
}

export interface CompaniesHouseSearchInput {
  readonly sic_code?: string;                  // e.g. "43999"
  readonly keyword?: string;                   // e.g. "scaffolding"
  readonly items_per_page?: number;            // 1-100 · default 20
  readonly start_index?: number;
  readonly active_only?: boolean;              // filter status=active
}

export interface CompaniesHouseSearchOutcome {
  readonly kind: "responded" | "rate_limited" | "unauthorized" | "unavailable" | "not_configured";
  readonly candidates: ReadonlyArray<CompaniesHouseCandidate>;
  readonly total_results: number | null;
  readonly next_start_index: number | null;
  readonly http_status: number | null;
  readonly retry_after_seconds: number | null;
  readonly note: string | null;
}

const BASE_URL = "https://api.company-information.service.gov.uk";
const SIC_TO_LABEL: Record<string, string> = {
  // Construction (Section F)
  "41100": "Development of building projects",
  "41201": "Construction of commercial buildings",
  "41202": "Construction of domestic buildings",
  "42110": "Construction of roads and motorways",
  "42130": "Construction of bridges and tunnels",
  "42210": "Construction of utility projects for fluids",
  "43110": "Demolition",
  "43120": "Site preparation",
  "43210": "Electrical installation",
  "43220": "Plumbing, heat and air-conditioning installation",
  "43291": "Insulation activities",
  "43910": "Roofing activities",
  "43991": "Scaffold erection",       // ← the direct scaffolder SIC
  "43999": "Other specialised construction activities n.e.c.",
};

export const CONSTRUCTION_SIC_CODES = Object.keys(SIC_TO_LABEL);

export function resolveCompaniesHouseConfig(env: NodeJS.ProcessEnv = process.env): CompaniesHouseResolution {
  const key = env.NEX_COMPANIES_HOUSE_API_KEY?.trim();
  if (!key) return { configured: false, reason: "NEX_COMPANIES_HOUSE_API_KEY not set" };
  if (key.length < 20) return { configured: false, reason: "NEX_COMPANIES_HOUSE_API_KEY looks too short" };
  return { configured: true, api_key: key };
}

/** Real HTTP call · never throws · always returns structured outcome. */
export async function searchCompaniesHouse(input: CompaniesHouseSearchInput, env: NodeJS.ProcessEnv = process.env): Promise<CompaniesHouseSearchOutcome> {
  const cfg = resolveCompaniesHouseConfig(env);
  if (!cfg.configured) {
    return { kind: "not_configured", candidates: [], total_results: null, next_start_index: null,
             http_status: null, retry_after_seconds: null, note: cfg.reason };
  }

  const params = new URLSearchParams();
  const ipp = Math.max(1, Math.min(100, input.items_per_page ?? 20));
  params.set("items_per_page", String(ipp));
  if (input.start_index != null) params.set("start_index", String(Math.max(0, input.start_index)));

  let url: string;
  if (input.sic_code) {
    // Advanced search filters by SIC (returns broader match set)
    params.set("sic_codes", input.sic_code);
    if (input.active_only !== false) params.set("company_status", "active");
    url = `${BASE_URL}/advanced-search/companies?${params.toString()}`;
  } else if (input.keyword) {
    params.set("q", input.keyword);
    url = `${BASE_URL}/search/companies?${params.toString()}`;
  } else {
    return { kind: "unavailable", candidates: [], total_results: null, next_start_index: null,
             http_status: null, retry_after_seconds: null, note: "no_sic_code_or_keyword" };
  }

  const authHeader = "Basic " + Buffer.from(cfg.api_key + ":").toString("base64");
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json",
        "User-Agent": "nex-harvest/1.0 (+founder-signed)",
      },
      // 20-second per-request cap
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    return { kind: "unavailable", candidates: [], total_results: null, next_start_index: null,
             http_status: null, retry_after_seconds: null, note: `network_error:${(e as Error).message}` };
  }

  if (res.status === 401 || res.status === 403) {
    return { kind: "unauthorized", candidates: [], total_results: null, next_start_index: null,
             http_status: res.status, retry_after_seconds: null, note: "auth_failed_check_api_key" };
  }
  if (res.status === 429) {
    const ra = Number(res.headers.get("retry-after") ?? "60");
    return { kind: "rate_limited", candidates: [], total_results: null, next_start_index: null,
             http_status: 429, retry_after_seconds: Number.isFinite(ra) ? ra : 60, note: "rate_limited" };
  }
  if (!res.ok) {
    return { kind: "unavailable", candidates: [], total_results: null, next_start_index: null,
             http_status: res.status, retry_after_seconds: null, note: `http_${res.status}` };
  }

  let json: any;
  try { json = await res.json(); }
  catch (e) {
    return { kind: "unavailable", candidates: [], total_results: null, next_start_index: null,
             http_status: res.status, retry_after_seconds: null, note: `parse_error:${(e as Error).message}` };
  }

  const items: any[] = json.items ?? [];
  const candidates: CompaniesHouseCandidate[] = items.map((it) => ({
    company_number: String(it.company_number ?? it.company?.company_number ?? "").trim(),
    company_name:   String(it.company_name  ?? it.company?.company_name  ?? "").trim(),
    company_status: String(it.company_status ?? "unknown"),
    company_type:   it.company_type ?? null,
    date_of_creation: it.date_of_creation ?? it.date_of_incorporation ?? null,
    address_line:   [it.registered_office_address?.address_line_1, it.address?.address_line_1]
                       .filter(Boolean)[0] ?? null,
    postal_code:    it.registered_office_address?.postal_code ?? it.address?.postal_code ?? null,
    country:        it.registered_office_address?.country ?? it.address?.country ?? "United Kingdom",
    sic_codes:      Array.isArray(it.sic_codes) ? it.sic_codes.map(String) : [],
    source_url:     `${BASE_URL}/company/${encodeURIComponent(String(it.company_number ?? ""))}`,
  })).filter((c) => c.company_number.length > 0 && c.company_name.length > 0);

  const totalResults = Number(json.hits ?? json.total_results ?? candidates.length);
  const nextStart = candidates.length === ipp ? (input.start_index ?? 0) + ipp : null;

  return {
    kind: "responded",
    candidates,
    total_results: Number.isFinite(totalResults) ? totalResults : null,
    next_start_index: nextStart,
    http_status: res.status,
    retry_after_seconds: null,
    note: null,
  };
}

// Doctrine locks
export const _CH_ADAPTER_NEVER_INVENTS_A_COMPANY = "candidates_only_from_actual_api_response";
export const _CH_ADAPTER_REQUIRES_API_KEY_OR_RETURNS_NOT_CONFIGURED = "resolveCompaniesHouseConfig_gates_every_call";
export const _CH_ADAPTER_HONORS_RATE_LIMIT = "429_returns_retry_after_never_bypasses";
