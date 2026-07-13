// Companies House search — used by the signup flow to auto-suggest
// a Verified match when a paid-tier merchant's chosen slug looks like
// a real UK-registered business name.
//
// Companies House free public search API:
//   docs: https://developer-specs.company-information.service.gov.uk/
//   endpoint: GET /search/companies?q={query}&items_per_page=5
//   auth: HTTP Basic, API key as username, empty password
//
// Returns the top few active-company candidates ranked by
// name-similarity. Consumer displays them and lets the merchant
// confirm the match; on confirm we auto-verify.

const BASE = "https://api.company-information.service.gov.uk";

export type CompanyMatch = {
  companyName: string;
  companyNumber: string;
  status: string;
  address: string | null;
  dateOfCreation: string | null;
  /** Similarity 0-1 between the query and the company name. */
  similarity: number;
};

/** Slug → readable name: "mikes-kitchens-manchester" → "mikes kitchens manchester" */
export function slugToQuery(slug: string): string {
  return slug.replace(/-/g, " ").trim();
}

/** Jaccard token-set similarity — cheap fuzzy match that handles word
 *  order + partial overlap. "Mikes Kitchens" vs "Mike's Kitchens Ltd"
 *  scores ~0.66; strict enough to prevent false auto-verify. */
function similarity(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  const setA = new Set(norm(a));
  const setB = new Set(norm(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  setA.forEach((t) => {
    if (setB.has(t)) intersection += 1;
  });
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

export async function searchCompanies(query: string, opts?: { limit?: number }): Promise<CompanyMatch[]> {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) return [];
  const q = query.trim();
  if (q.length < 3) return [];
  const auth = Buffer.from(`${apiKey}:`).toString("base64");
  const limit = opts?.limit ?? 5;

  let res: Response;
  try {
    res = await fetch(
      `${BASE}/search/companies?q=${encodeURIComponent(q)}&items_per_page=${limit}`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json"
        }
      }
    );
  } catch {
    return [];
  }

  if (!res.ok) return [];

  const raw = (await res.json()) as {
    items?: Array<{
      title?: string;
      company_number?: string;
      company_status?: string;
      address_snippet?: string | null;
      date_of_creation?: string | null;
    }>;
  };
  const items = raw.items ?? [];

  // Filter to active companies, score similarity, sort desc.
  return items
    .filter((it) => it.company_status === "active" || it.company_status === "voluntary-arrangement")
    .map<CompanyMatch>((it) => ({
      companyName:    it.title ?? "",
      companyNumber:  it.company_number ?? "",
      status:         it.company_status ?? "unknown",
      address:        it.address_snippet ?? null,
      dateOfCreation: it.date_of_creation ?? null,
      similarity:     similarity(q, it.title ?? "")
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/** Best-effort auto-match. Returns the top candidate only if the
 *  similarity is high enough to auto-suggest (>= 0.75). Below that,
 *  merchants get a "pick from a list" flow instead. */
export async function bestMatchForSlug(slug: string): Promise<CompanyMatch | null> {
  const query = slugToQuery(slug);
  const matches = await searchCompanies(query, { limit: 3 });
  if (matches.length === 0) return null;
  const top = matches[0];
  if (top.similarity < 0.75) return null;
  return top;
}
