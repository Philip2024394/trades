// Anonymisation — turn a completed project into a fingerprint that
// carries useful signal but no identifiers.
//
// What we KEEP:
//   • trade (primary trade slug)
//   • project_type (derived from title keywords: "kitchen"/"loft"/…)
//   • property_type (domestic vs commercial — always domestic today)
//   • region (postcode AREA only, e.g. "M25 1AB" → "M")
//   • duration_days (completed_at - started_at)
//   • labour_hours, materials/labour spend (aggregate sums)
//   • crew_size (distinct trades on the project)
//
// What we DROP:
//   • project title free-text (may leak owner names)
//   • project description
//   • homeowner name / id
//   • merchant name / listing_id
//   • full address / postcode
//   • dates precise to the day (we keep completed_at because the
//     benchmark distributions are calibrated on it — but the anon_id
//     hash makes it non-reversible to the original project id)

import { createHash, randomBytes } from "node:crypto";
import type { ProjectFingerprint, PropertyTypeCategory } from "./types";

/** Runtime salt — new on every process boot. Fingerprints stay stable
 *  within a request/session but never across restarts, so nothing can
 *  correlate anon_ids across time to re-identify. */
const SALT = randomBytes(16).toString("hex");

const PROJECT_TYPE_RULES: Array<{ re: RegExp; type: string }> = [
  { re: /\bstair(case)?\b/i,          type: "staircase" },
  { re: /\bloft\b/i,                   type: "loft_conversion" },
  { re: /\bextension\b/i,              type: "extension" },
  { re: /\bkitchen\b/i,                type: "kitchen" },
  { re: /\bbathroom|shower|ensuite\b/i, type: "bathroom" },
  { re: /\broof|slate|felt\b/i,        type: "roofing" },
  { re: /\brender|plaster\b/i,         type: "plastering" },
  { re: /\bwindow|glaz\b/i,            type: "windows" },
  { re: /\bdriveway|paving|patio\b/i,  type: "driveway" },
  { re: /\bdecking\b/i,                type: "decking" },
  { re: /\bboiler|heating\b/i,         type: "heating" },
  { re: /\belectric|rewire\b/i,        type: "electrical" }
];

export function classifyProjectType(title: string, description?: string | null): string {
  const t = `${title} ${description ?? ""}`.trim();
  for (const r of PROJECT_TYPE_RULES) if (r.re.test(t)) return r.type;
  return "other";
}

export function extractRegion(postcode: string | null): string {
  if (!postcode) return "unknown";
  const cleaned = postcode.trim().toUpperCase().replace(/\s+/g, "");
  // Require a proper UK postcode shape: 1–2 letters followed by a digit
  // so "no-postcode-here" doesn't leak "NO" as a region.
  const m = cleaned.match(/^([A-Z]{1,2})\d/);
  return m ? m[1] : "unknown";
}

export function classifyPropertyType(): PropertyTypeCategory {
  // No property-type column exists yet; today every SiteBook project
  // is domestic (homeowner-owned). Return domestic until a commercial
  // flag lands.
  return "domestic";
}

export type RawProjectRow = {
  id:               string;
  title:            string;
  description?:     string | null;
  status:           string;
  address_postcode: string | null;
  started_at:       string | null;
  completed_at:     string | null;
};

export type RawAggregates = {
  members_count:         number | null;    // distinct trades
  labour_hours:          number | null;
  materials_spend_pence: number | null;
  labour_spend_pence:    number | null;
};

export function anonymiseProject(row: RawProjectRow, trade: string, agg: RawAggregates): ProjectFingerprint | null {
  if (!row.completed_at) return null;   // only completed projects contribute
  const anonId = "anon_" + createHash("sha256").update(`${row.id}|${SALT}`).digest("hex").slice(0, 16);
  const durationDays = row.started_at
    ? Math.max(0, Math.round((new Date(row.completed_at).getTime() - new Date(row.started_at).getTime()) / 86_400_000))
    : null;
  return {
    anon_id:               anonId,
    trade,
    project_type:          classifyProjectType(row.title, row.description ?? undefined),
    property_type:         classifyPropertyType(),
    region:                extractRegion(row.address_postcode),
    duration_days:         durationDays,
    labour_hours:          agg.labour_hours,
    materials_spend_pence: agg.materials_spend_pence,
    labour_spend_pence:    agg.labour_spend_pence,
    crew_size:             agg.members_count,
    completed_at:          row.completed_at
  };
}

/** Test-only: peek at the runtime salt so tests can build the
 *  expected anon_id. Never exposed via the public barrel. */
export function _testSalt(): string { return SALT; }
