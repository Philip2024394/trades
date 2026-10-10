// src/lib/nex/marketing/founder/inventory.ts
//
// NEX Email Marketing HQ · Founder Control Centre · Email Storage inventory
// Founder-authorised programme (Email Storage UI wave · 2026-09-21).
//
// **Absolute rule (§13)**: returns counts + aggregate metadata only.
// Never returns email addresses. Never returns contact_id lists.
// The receipt-integrity canary in the acceptance suite verifies these
// functions cannot leak individual rows.
//
// Reuses the existing `countAudience` for per-country×category totals.
// This module is a thin aggregate reader over `nex.marketing_contact` ·
// no new tables · no new schema · no send · no provider call.

import type { PoolClient } from "pg";
import type { FounderAuthContext } from "./types";
import { assertFounder } from "./founder-service";

// ─── Response types ─────────────────────────────────────────────────
export interface CountryInventoryRow {
  readonly iso: string;
  readonly name: string;
  readonly total: number;
  readonly not_suppressed: number;
}

export interface CategoryInventoryRow {
  readonly key: string;                                // e.g. "accommodation"
  readonly label: string;                              // "Accommodation"
  readonly total: number;
  readonly not_suppressed: number;
}

export interface SourceInventoryRow {
  readonly source_table: string;
  readonly n: number;
}

export interface EmailStorageInventory {
  readonly total: number;
  readonly distinct_lower_email: number;
  readonly not_suppressed: number;
  readonly suppressed: {
    readonly opt_out: number;
    readonly hard_bounced: number;
    readonly complaint: number;
    readonly total: number;
  };
  readonly countries: ReadonlyArray<CountryInventoryRow>;
  readonly categories: ReadonlyArray<CategoryInventoryRow>;
  readonly sources: ReadonlyArray<SourceInventoryRow>;
  readonly activity: {
    readonly last_first_seen_at: string | null;
    readonly last_ingestion_at: string | null;
    readonly new_last_7_days: number | null;
  };
  readonly contact_proof_available: false;             // §10 · backend capability not yet implemented
  readonly computed_at: string;
}

// ─── Country ISO → display-name (small · deliberate · not inferred) ─
const COUNTRY_NAMES: Record<string, string> = {
  ID: "Indonesia",   US: "United States",     GB: "United Kingdom", CA: "Canada",
  AU: "Australia",   NZ: "New Zealand",       DE: "Germany",        FR: "France",
  IT: "Italy",       ES: "Spain",             NL: "Netherlands",    IE: "Ireland",
  PT: "Portugal",    BE: "Belgium",           LU: "Luxembourg",     CH: "Switzerland",
  AT: "Austria",     DK: "Denmark",           SE: "Sweden",         NO: "Norway",
  FI: "Finland",     IS: "Iceland",           PL: "Poland",         CZ: "Czech Republic",
  SK: "Slovakia",    HU: "Hungary",           RO: "Romania",        BG: "Bulgaria",
  GR: "Greece",      HR: "Croatia",           SI: "Slovenia",       EE: "Estonia",
  LV: "Latvia",      LT: "Lithuania",         MX: "Mexico",         BR: "Brazil",
  AR: "Argentina",   CL: "Chile",             CO: "Colombia",       PE: "Peru",
  UY: "Uruguay",     EC: "Ecuador",           PY: "Paraguay",       BO: "Bolivia",
  VE: "Venezuela",   ZA: "South Africa",      NG: "Nigeria",        KE: "Kenya",
  EG: "Egypt",       MA: "Morocco",           GH: "Ghana",          TN: "Tunisia",
  DZ: "Algeria",     ET: "Ethiopia",          UG: "Uganda",         TZ: "Tanzania",
  FJ: "Fiji",        PG: "Papua New Guinea",  AE: "United Arab Emirates",
  SA: "Saudi Arabia", IL: "Israel",           TR: "Turkey",         QA: "Qatar",
  OM: "Oman",        KW: "Kuwait",            BH: "Bahrain",        JO: "Jordan",
  LB: "Lebanon",     JP: "Japan",             KR: "South Korea",    CN: "China",
  TW: "Taiwan",      HK: "Hong Kong",         SG: "Singapore",      MY: "Malaysia",
  TH: "Thailand",    VN: "Vietnam",           PH: "Philippines",    IN: "India",
  PK: "Pakistan",    BD: "Bangladesh",        LK: "Sri Lanka",      NP: "Nepal",
};

const CATEGORY_LABELS: Record<string, string> = {
  accommodation: "Accommodation",
  activities:    "Activities",
  food:          "Food",
  business:      "Business",
  transport:     "Transport",
  retail:        "Retail",
  services:      "Services",
  unclassified:  "Unclassified",
  construction:  "Construction",
};

/** Human-readable label for a category_group. Falls back to Title-Case of the key. */
function labelForCategory(key: string): string {
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  return key.split(/[-_ ]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// ─── Load full inventory (aggregate reads only) ─────────────────────
export async function loadEmailStorageInventory(
  client: PoolClient,
  ctx: FounderAuthContext,
): Promise<EmailStorageInventory> {
  assertFounder(ctx);

  // Totals + suppression buckets (single aggregate scan · no addresses)
  const totals = await client.query<{
    total: number; distinct_lower_email: number; not_suppressed: number;
    opt_out: number; hard_bounced: number; complaint: number;
    last_first_seen_at: string | null; last_ingestion_at: string | null;
  }>(`
    SELECT
      COUNT(*)::int                                                                          AS total,
      COUNT(DISTINCT LOWER(email))::int                                                      AS distinct_lower_email,
      COUNT(*) FILTER (WHERE opt_out = FALSE AND hard_bounced = FALSE AND complaint_count = 0)::int AS not_suppressed,
      COUNT(*) FILTER (WHERE opt_out = TRUE)::int                                             AS opt_out,
      COUNT(*) FILTER (WHERE hard_bounced = TRUE)::int                                        AS hard_bounced,
      COUNT(*) FILTER (WHERE complaint_count > 0)::int                                        AS complaint,
      MAX(first_seen_at)                                                                     AS last_first_seen_at,
      MAX(last_seen_at)                                                                      AS last_ingestion_at
    FROM nex.marketing_contact
  `);
  const t = totals.rows[0] ?? { total: 0, distinct_lower_email: 0, not_suppressed: 0, opt_out: 0, hard_bounced: 0, complaint: 0, last_first_seen_at: null, last_ingestion_at: null };
  const suppressed_total = Math.max(0, t.total - t.not_suppressed);

  // Country distribution (aggregate)
  const countryRes = await client.query<{ country: string; total: number; not_suppressed: number }>(`
    SELECT COALESCE(NULLIF(country, ''), 'UNKNOWN') AS country,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE opt_out = FALSE AND hard_bounced = FALSE AND complaint_count = 0)::int AS not_suppressed
      FROM nex.marketing_contact
     GROUP BY 1
     ORDER BY total DESC
  `);

  // Category distribution (by category_group · same grouping the founder sees)
  const categoryRes = await client.query<{ category_group: string | null; total: number; not_suppressed: number }>(`
    SELECT COALESCE(category_group, 'unclassified') AS category_group,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE opt_out = FALSE AND hard_bounced = FALSE AND complaint_count = 0)::int AS not_suppressed
      FROM nex.marketing_contact
     GROUP BY 1
     ORDER BY total DESC
  `);

  // Source distribution (aggregate · from source_tables[] array)
  const sourceRes = await client.query<{ source_table: string; n: number }>(`
    SELECT unnest(source_tables) AS source_table, COUNT(*)::int AS n
      FROM nex.marketing_contact
     GROUP BY 1
     ORDER BY n DESC
     LIMIT 20
  `);

  // Activity · new in last 7 days
  const activityRes = await client.query<{ new_last_7_days: number }>(`
    SELECT COUNT(*)::int AS new_last_7_days
      FROM nex.marketing_contact
     WHERE first_seen_at >= now() - INTERVAL '7 days'
  `);

  const countries: CountryInventoryRow[] = countryRes.rows.map(r => ({
    iso: r.country,
    name: COUNTRY_NAMES[r.country] ?? r.country,
    total: r.total,
    not_suppressed: r.not_suppressed,
  }));

  const categories: CategoryInventoryRow[] = categoryRes.rows.map(r => {
    const key = (r.category_group ?? "unclassified").toString();
    return {
      key,
      label: labelForCategory(key),
      total: r.total,
      not_suppressed: r.not_suppressed,
    };
  });

  const sources: SourceInventoryRow[] = sourceRes.rows.map(r => ({
    source_table: r.source_table,
    n: r.n,
  }));

  return {
    total: t.total,
    distinct_lower_email: t.distinct_lower_email,
    not_suppressed: t.not_suppressed,
    suppressed: {
      opt_out: t.opt_out,
      hard_bounced: t.hard_bounced,
      complaint: t.complaint,
      total: suppressed_total,
    },
    countries,
    categories,
    sources,
    activity: {
      last_first_seen_at: t.last_first_seen_at,
      last_ingestion_at: t.last_ingestion_at,
      new_last_7_days: activityRes.rows[0]?.new_last_7_days ?? null,
    },
    contact_proof_available: false,
    computed_at: new Date().toISOString(),
  };
}

// ─── Structural contact-boundary marker · verified by tests (§13) ───
export const _EMAIL_STORAGE_INVENTORY_BOUNDARY = "counts_and_aggregates_only_no_addresses";
