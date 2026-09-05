// src/lib/nex/brain/company-intelligence.ts
//
// NEX Business International Market Intelligence v1
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE · §7 §12 §13 §14 §22 §24 §33
//
// PURPOSE
//   Model + storage for EXTERNAL companies discovered as potential
//   commercial opportunities. This is NEX-AUTHORED market intelligence
//   about entities OUTSIDE the business's own owned data.
//
// STRICT DISCIPLINE
//   §33 Customer-facing safety · fabricated companies/emails/websites
//   are NEVER permitted. Every field carries evidence state; missing
//   evidence remains UNKNOWN and NEVER becomes false or invented.
//
//   §22 Provenance is preserved · every company entity records its
//   source and confidence.
//
//   §24 Provider independence · retrieval accepts a pluggable
//   source-adapter interface; the runtime does NOT ship any specific
//   external adapter in v1. Actual external acquisition belongs to a
//   future authorised slice.

import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { BusinessProvenance } from "./business-context";

// ─── Types ─────────────────────────────────────────────────────

export type CompanyAttributeState = "KNOWN_YES" | "UNKNOWN" | "UNVERIFIED" | "CONFLICTING" | "STALE";

export type CompanySource =
  | "SEED_FIXTURE"           // v1 fixture data for demonstration/testing
  | "OFFICIAL_COMPANY"       // company's own public website
  | "GOVERNMENT"             // gov registries / official statistics
  | "INDUSTRY_ASSOCIATION"   // trade associations
  | "PUBLIC_BUSINESS_DIRECTORY"
  | "PUBLIC_TRADE_SOURCE"
  | "OTHER_LEGITIMATE_PUBLIC_SOURCE"
  | "UNKNOWN";

/** A discovered external company entity. Every attribute carries
 *  evidence discipline. */
export type DiscoveredCompany = {
  company_id: string;
  name: string;
  country: string;
  region?: string | null;
  city?: string | null;
  industry?: string | null;
  business_type?: string | null;
  public_website?: string | null;
  short_description?: string | null;
  public_contact: PublicContact | null;
  /** Reasons this company appears relevant · derived from evidence. */
  relevance_evidence: RelevanceEvidence[];
  attributes: Record<string, CompanyAttributeValue>;
  provenance: BusinessProvenance & { source_class: CompanySource };
  discovered_at: string;
};

export type CompanyAttributeValue = {
  value: string | number | boolean | null;
  state: CompanyAttributeState;
  provenance: BusinessProvenance & { source_class: CompanySource };
};

export type RelevanceEvidence = {
  claim: string;                       // e.g. "imports seafood from ASEAN"
  supporting_source: string;
  supporting_url?: string | null;
  supporting_snippet?: string | null;
  confidence: number;
  evidence_state: CompanyAttributeState;
};

/** Public business contact channel. Fabrication forbidden (§8 §33). */
export type PublicContact = {
  email?: {
    address: string;
    state: CompanyAttributeState;
    source: string;
    source_url?: string | null;
    verified_at?: string | null;
  };
  website?: {
    url: string;
    state: CompanyAttributeState;
    source: string;
  };
  phone?: {
    number: string;
    state: CompanyAttributeState;
    source: string;
  };
  whatsapp?: {
    number: string;
    state: CompanyAttributeState;
    source: string;
  };
  contact_form?: {
    url: string;
    state: CompanyAttributeState;
    source: string;
  };
};

// ─── Storage ───────────────────────────────────────────────────

export function companyIntelligenceDir(): string {
  const override = process.env.NEX_BUSINESS_DIR;
  if (override && override.trim().length > 0) return override;
  return path.resolve(process.cwd(), "data", "nex-business");
}

class ForbiddenCompanyWrite extends Error {
  constructor(target: string) { super(`nex-business/company forbidden write: ${target}`); }
}

function pathFor(filename: string): string {
  const root = companyIntelligenceDir();
  const p = path.resolve(root, filename);
  if (!p.startsWith(root + path.sep) && p !== root) {
    throw new ForbiddenCompanyWrite(p);
  }
  return p;
}

function ensureDir(): void {
  const dir = companyIntelligenceDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const COMPANIES_FILE = "discovered_companies.jsonl";

// ─── Persistence ───────────────────────────────────────────────

export function persistDiscoveredCompany(company: DiscoveredCompany): void {
  // §33 · minimal fabrication guard: refuse companies whose name looks
  // like a placeholder (Demo Company, Example Corp, etc.) unless the
  // source_class is explicitly SEED_FIXTURE. This defends against
  // accidental fabrication leaking into production data.
  const placeholderRx = /^(demo|example|test|fake|sample|placeholder|acme)\b/i;
  if (placeholderRx.test(company.name) && company.provenance.source_class !== "SEED_FIXTURE") {
    throw new Error(`refused_placeholder_name:${company.name}`);
  }
  ensureDir();
  appendFileSync(pathFor(COMPANIES_FILE), JSON.stringify(company) + "\n", "utf8");
}

export function readAllCompanies(): DiscoveredCompany[] {
  const p = pathFor(COMPANIES_FILE);
  if (!existsSync(p)) return [];
  const raw = readFileSync(p, "utf8");
  const out: DiscoveredCompany[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try { out.push(JSON.parse(trimmed) as DiscoveredCompany); }
    catch { /* skip malformed */ }
  }
  return out;
}

// ─── Retrieval ─────────────────────────────────────────────────

export type CompanyQuery = {
  country?: string;
  industry?: string;
  objective_kind?: string;    // "FIND_BUYERS" · "FIND_IMPORTERS" · etc.
  product_hint?: string;
  limit?: number;
};

/** Deterministic retrieval over the local company store. Never
 *  fabricates. Returns companies whose declared country/industry
 *  matches the query. */
export function retrieveCompanies(q: CompanyQuery): DiscoveredCompany[] {
  const all = readAllCompanies();
  const limit = q.limit ?? 10;
  const countryNorm = q.country?.toLowerCase().trim();
  const industryNorm = q.industry?.toLowerCase().trim();
  const productNorm = q.product_hint?.toLowerCase().trim();
  const filtered = all.filter((c) => {
    if (countryNorm && c.country.toLowerCase() !== countryNorm) return false;
    if (industryNorm && (c.industry ?? "").toLowerCase().includes(industryNorm) === false) return false;
    if (productNorm) {
      const inRelevance = c.relevance_evidence.some((r) => r.claim.toLowerCase().includes(productNorm));
      const inAttributes = Object.values(c.attributes).some((a) =>
        typeof a.value === "string" && a.value.toLowerCase().includes(productNorm),
      );
      if (!inRelevance && !inAttributes) return false;
    }
    return true;
  });
  return filtered.slice(0, limit);
}

// ─── Convenience builders ──────────────────────────────────────

export function computeCompanyId(input: { name: string; country: string }): string {
  const canonical = `${input.name.trim().toUpperCase()}|${input.country.trim().toUpperCase()}`;
  return "co_" + createHash("sha256").update(canonical).digest("hex").slice(0, 20);
}

// ─── Test-only reset ──────────────────────────────────────────

export function _resetCompanyStoreForTests(): void {
  ensureDir();
  writeFileSync(pathFor(COMPANIES_FILE), "", "utf8");
}

export { ForbiddenCompanyWrite };
