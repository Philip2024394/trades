// POST /api/rates/submit — user contributes a real-world rate.
//
// Enforces the constitutional submission rules:
//   • Must be signed in (auth.uid() → trade_id)
//   • Auto-reject if outside 30-200% of the ONS baseline for the
//     same trade+region (obvious garbage / typo guard)
//   • Unique on (trade_id, trade_slug, region_code, rate_type, month)
//     — one submission per contributor per topic per month
//   • Row starts approved=false and enters aggregate only after a
//     24-hour cool-down (fraud review window)
//
// Returns { ok: true, submissionId } or { error: "…" }.

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/tradeAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getGovernmentRate } from "@/lib/rates/getGovernmentRate";
import { SOC_TO_TRADE_SLUG, NUTS1_REGIONS, UK_CITIES } from "@/lib/rates/taxonomy";

export const dynamic = "force-dynamic";

const MIN_SANITY_MULTIPLIER = 0.30; // reject if <30% of ONS median
const MAX_SANITY_MULTIPLIER = 2.00; // reject if >200% of ONS median

const RATE_TYPES = new Set(["hourly", "daily", "annual"]);
const SOURCE_TYPES = new Set(["invoice", "quote", "hourly-rate", "day-rate", "contract"]);

export async function POST(req: Request) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const tradeSlug   = String(payload.tradeSlug   ?? "").trim();
  const regionCode  = String(payload.regionCode  ?? "").trim();
  const citySlugRaw = payload.citySlug === undefined ? undefined : String(payload.citySlug).trim();
  const citySlug    = citySlugRaw && citySlugRaw !== "" ? citySlugRaw : undefined;
  const rateType    = String(payload.rateType    ?? "").trim();
  const gbpAmount   = Number(payload.gbpAmount ?? 0);
  const dateOfWork  = String(payload.dateOfWork ?? "").trim();
  const sourceType  = String(payload.sourceType ?? "").trim();

  // Basic shape validation.
  if (!SOC_TO_TRADE_SLUG.some((r) => r.slug === tradeSlug)) {
    return NextResponse.json({ error: "invalid_trade_slug" }, { status: 400 });
  }
  if (!NUTS1_REGIONS.some((r) => r.code === regionCode)) {
    return NextResponse.json({ error: "invalid_region_code" }, { status: 400 });
  }
  if (citySlug !== undefined) {
    const city = UK_CITIES.find((c) => c.slug === citySlug);
    if (!city) {
      return NextResponse.json({ error: "invalid_city_slug" }, { status: 400 });
    }
    if (city.regionCode !== regionCode) {
      return NextResponse.json({ error: "city_region_mismatch" }, { status: 400 });
    }
  }
  if (!RATE_TYPES.has(rateType)) {
    return NextResponse.json({ error: "invalid_rate_type" }, { status: 400 });
  }
  if (!SOURCE_TYPES.has(sourceType)) {
    return NextResponse.json({ error: "invalid_source_type" }, { status: 400 });
  }
  if (!Number.isFinite(gbpAmount) || gbpAmount <= 0) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfWork)) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }

  // Anti-typo sanity clamp: reject if outside 30-200% of ONS baseline.
  // If we don't have an ONS baseline for the trade+region, we accept
  // the submission and let the stdev threshold catch outliers at
  // aggregation time.
  const baseline = await getGovernmentRate({
    tradeSlug,
    regionCode,
    rateType: rateType as "hourly" | "daily" | "annual"
  });
  if (baseline) {
    const min = baseline.gbpMedian * MIN_SANITY_MULTIPLIER;
    const max = baseline.gbpMedian * MAX_SANITY_MULTIPLIER;
    if (gbpAmount < min || gbpAmount > max) {
      return NextResponse.json(
        {
          error: "rate_out_of_sanity_range",
          detail: `Rate ${gbpAmount} is outside the sanity range (${min.toFixed(2)}-${max.toFixed(2)}) for ${tradeSlug} in ${regionCode}. Government baseline median: ${baseline.gbpMedian}.`
        },
        { status: 400 }
      );
    }
  }

  // Insert. Unique constraint prevents ballot-stuffing (one submission
  // per trade × region × rate_type × month). approved=false — enters
  // aggregate after a 24-hour cool-down handled by the aggregation job.
  try {
    const { data, error } = await supabaseAdmin
      .from("app_rates_submissions")
      .insert({
        trade_id:     user.id,
        trade_slug:   tradeSlug,
        region_code:  regionCode,
        city_slug:    citySlug ?? null,
        rate_type:    rateType,
        gbp_amount:   gbpAmount,
        date_of_work: dateOfWork,
        source_type:  sourceType,
        approved:     false
      })
      .select("id")
      .single();
    if (error) {
      // 23505 = unique_violation (Postgres): they already submitted for this month.
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "already_submitted_this_month" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, submissionId: data.id });
  } catch {
    // Migration not applied yet in dev.
    return NextResponse.json({ error: "submissions_table_missing" }, { status: 503 });
  }
}
