// GET /api/cron/shadow-profile-scrape
//
// Nightly at 02:30 UTC. Pulls a batch of UK trade businesses from
// Companies House across our tracked SIC codes + rotating UK city
// list, inserts new records into hammerex_shadow_merchants with a
// reserved slug and pre-generated claim token, then queues them for
// the drip sequence.
//
// Rate-limit-safe: Companies House free tier = 600 req / 5 min. We
// batch 100 requests per run (well under the limit) and rotate
// cities across runs so the whole UK is covered over ~30 days.
//
// CRON_SECRET gated. Idempotent per (source, source_ref) — re-runs
// skip existing records instead of duplicating.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { searchTradesInCity, normaliseCHRecord, TRADE_SIC_CODES } from "@/lib/shadowMerchants/companiesHouse";
import { baseSlugFromBusinessName, reserveUniqueSlug, generateClaimToken } from "@/lib/shadowMerchants/slug";
import type { ShadowMerchant } from "@/lib/shadowMerchants/types";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const maxDuration = 300; // 5 min for the scrape batch

// Rotating UK city list — 30 cities × 16 SICs = 480 potential searches
// per run. We batch just enough per run to stay under CH's 600/5min limit
// while covering the whole UK over ~5-10 nights.
const UK_CITIES = [
  "London",    "Manchester", "Birmingham", "Leeds",     "Liverpool",
  "Glasgow",   "Edinburgh",  "Cardiff",    "Bristol",   "Sheffield",
  "Newcastle", "Nottingham", "Leicester",  "Coventry",  "Sunderland",
  "Belfast",   "Aberdeen",   "Dundee",     "Southampton","Portsmouth",
  "Cambridge", "Oxford",     "Brighton",   "Reading",   "York",
  "Plymouth",  "Norwich",    "Ipswich",    "Preston",   "Swansea"
];

const CITIES_PER_RUN = 3;   // 3 × 16 SIC × 20 results = up to 960 candidates/night
const RESULTS_PER_QUERY = 20;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (secret && bearer !== secret) {
    return NextResponse.json({ ok: false, error: "not-authorised" }, { status: 401 });
  }

  const startedAt = Date.now();
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (24 * 3600 * 1000));

  // Rotate through cities deterministically by day-of-year
  const startIdx = (dayOfYear * CITIES_PER_RUN) % UK_CITIES.length;
  const citiesTonight = Array.from({ length: CITIES_PER_RUN }, (_, i) =>
    UK_CITIES[(startIdx + i) % UK_CITIES.length]
  );

  let scannedCount    = 0;
  let insertedCount   = 0;
  let skippedExisting = 0;
  let errorCount      = 0;
  const errors: string[] = [];

  for (const city of citiesTonight) {
    for (const sic of TRADE_SIC_CODES) {
      try {
        const results = await searchTradesInCity({ sic, city, size: RESULTS_PER_QUERY });
        scannedCount += results.length;

        for (const company of results) {
          // Dedupe on (source, source_ref) — Companies House number is unique
          const existing = await supabaseAdmin
            .from("hammerex_shadow_merchants")
            .select("id")
            .eq("source", "companies_house")
            .eq("source_ref", company.companyNumber)
            .maybeSingle();

          if (existing.data) {
            skippedExisting++;
            continue;
          }

          // Build the shadow profile
          const partial = normaliseCHRecord(company);
          const businessName = partial.business_name ?? company.name;
          const cityForSlug  = partial.city ?? city;
          const baseSlug     = baseSlugFromBusinessName(businessName, cityForSlug);
          const reservedSlug = await reserveUniqueSlug(baseSlug);
          const claimToken   = generateClaimToken();

          const insertPayload: Partial<ShadowMerchant> = {
            ...partial,
            city:           partial.city ?? city,
            reserved_slug:  reservedSlug,
            claim_token:    claimToken,
            // CH gives us NO email — start in 'scraped' status. The
            // enrich cron will Google-lookup + website-scrape to find
            // an email, then promote to 'queued' + eligible for drip.
            status:         "scraped",
            next_step_index:  0,
            next_step_due_at: null
          };

          const ins = await supabaseAdmin
            .from("hammerex_shadow_merchants")
            .insert(insertPayload);

          if (ins.error) {
            errors.push(`insert ${company.companyNumber}: ${ins.error.message}`);
            errorCount++;
          } else {
            insertedCount++;
          }
        }

        // Throttle — 200ms between CH queries keeps us well under 600/5min
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        errorCount++;
        errors.push(`${city}/${sic}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
  }

  const summary = {
    ok:              true,
    citiesTonight,
    scannedCount,
    insertedCount,
    skippedExisting,
    errorCount,
    errors:          errors.slice(0, 10),
    durationMs:      Date.now() - startedAt,
    at:              new Date().toISOString()
  };
  console.log("[cron/shadow-profile-scrape]", summary);
  return NextResponse.json(summary);
}
