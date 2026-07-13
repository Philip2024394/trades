// GET  /api/rates/menu?discipline=plastering — read the trade's
//   published menu from app_rates_submissions (source_type='menu-rate').
// PUT  /api/rates/menu — save the trade's menu. Body:
//   { discipline, regionCode, citySlug?, entries: [{ serviceSlug,
//     rateType, gbpAmount, notes? }] }
//
// Behaviour: each entry becomes one row in app_rates_submissions with
// source_type='menu-rate'. Upsert on (trade_id, service_slug, month)
// so re-saving in the same month replaces the current month's row.
// Older months' rows are preserved so the aggregation window keeps
// the historical signal.
//
// Evidence-or-silence: no fabrication. Rate = what the trade typed.
// Aggregation runs over all VTI trades' menu rates + job rates to
// produce the network median.

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/tradeAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NUTS1_REGIONS, UK_CITIES } from "@/lib/rates/taxonomy";

export const dynamic = "force-dynamic";

const RATE_TYPES = new Set(["sqm", "linear-metre", "each", "per-job", "per-hour", "per-day", "percent", "hourly", "daily", "annual"]);

type MenuEntry = {
  serviceSlug: string;
  rateType: string;
  gbpAmount: number;
  notes?: string;
};

export async function GET(req: Request) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ entries: [] });

  const url = new URL(req.url);
  const discipline = url.searchParams.get("discipline");
  if (!discipline) {
    return NextResponse.json({ error: "missing_discipline" }, { status: 400 });
  }

  try {
    // Read the caller's own menu-rate submissions for this discipline.
    // Latest per service_slug wins (in case there are multiple months).
    const { data, error } = await supabaseAdmin
      .from("app_rates_submissions")
      .select("service_slug, rate_type, gbp_amount, date_of_work, region_code, city_slug")
      .eq("trade_id", user.id)
      .eq("trade_slug", discipline)
      .eq("source_type", "menu-rate")
      .not("service_slug", "is", null)
      .order("date_of_work", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Dedupe by service_slug keeping the latest.
    const map = new Map<string, {
      serviceSlug: string;
      rateType: string;
      gbpAmount: number;
      dateOfWork: string;
      regionCode: string;
      citySlug: string | null;
    }>();
    for (const row of (data ?? []) as Array<{
      service_slug: string;
      rate_type: string;
      gbp_amount: number | string;
      date_of_work: string;
      region_code: string;
      city_slug: string | null;
    }>) {
      if (!map.has(row.service_slug)) {
        map.set(row.service_slug, {
          serviceSlug: row.service_slug,
          rateType:    row.rate_type,
          gbpAmount:   Number(row.gbp_amount),
          dateOfWork:  row.date_of_work,
          regionCode:  row.region_code,
          citySlug:    row.city_slug
        });
      }
    }
    return NextResponse.json({ entries: Array.from(map.values()) });
  } catch {
    // Migration not applied yet — return empty so the client shows the
    // honest empty state (blank inputs).
    return NextResponse.json({ entries: [] });
  }
}

export async function PUT(req: Request) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const discipline = String(payload.discipline ?? "").trim();
  const regionCode = String(payload.regionCode ?? "").trim();
  const citySlugRaw = payload.citySlug === undefined || payload.citySlug === null
    ? undefined
    : String(payload.citySlug).trim();
  const citySlug = citySlugRaw && citySlugRaw !== "" ? citySlugRaw : undefined;
  const entries = Array.isArray(payload.entries) ? (payload.entries as MenuEntry[]) : [];

  if (!discipline) {
    return NextResponse.json({ error: "missing_discipline" }, { status: 400 });
  }
  if (!NUTS1_REGIONS.some((r) => r.code === regionCode)) {
    return NextResponse.json({ error: "invalid_region_code" }, { status: 400 });
  }
  if (citySlug) {
    const city = UK_CITIES.find((c) => c.slug === citySlug);
    if (!city || city.regionCode !== regionCode) {
      return NextResponse.json({ error: "invalid_city" }, { status: 400 });
    }
  }
  if (entries.length === 0) {
    return NextResponse.json({ ok: true, saved: 0 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows = entries
    .filter((e) => e.serviceSlug && Number.isFinite(e.gbpAmount) && e.gbpAmount > 0)
    .filter((e) => RATE_TYPES.has(e.rateType))
    .map((e) => ({
      trade_id:     user.id,
      trade_slug:   discipline,
      region_code:  regionCode,
      city_slug:    citySlug ?? null,
      service_slug: e.serviceSlug,
      rate_type:    e.rateType,
      gbp_amount:   e.gbpAmount,
      date_of_work: today,
      source_type:  "menu-rate",
      approved:     false
    }));

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, saved: 0 });
  }

  try {
    // Two-step: delete this month's menu-rate rows for this trade +
    // discipline, then insert the new set. Simpler than reasoning
    // about ON CONFLICT with functional indexes. Older months' rows
    // are preserved so the 3-month aggregation window keeps signal.
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    await supabaseAdmin
      .from("app_rates_submissions")
      .delete()
      .eq("trade_id", user.id)
      .eq("trade_slug", discipline)
      .eq("source_type", "menu-rate")
      .gte("date_of_work", monthStartStr);
    const { error } = await supabaseAdmin
      .from("app_rates_submissions")
      .insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, saved: rows.length });
  } catch {
    return NextResponse.json({ error: "submissions_table_missing" }, { status: 503 });
  }
}
