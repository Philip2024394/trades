// POST /api/plan/stone-effect-render/estimate
//
// Server-side pricing math. Never returns rates without citations.
// Uses hammerex_trade_rates for line items, hammerex_regional_cost_multipliers
// for postcode adjustment.
//
// Body:
//   { postcode, finish, elevations: [{ width_m, height_m, gable_rise_m, openings: [{ width_m, height_m, count }] }] }
//
// Returns aggregated £ range + per-line breakdown + citations +
// list of extras excluded (for the mandatory "extras on top" panel).

import { NextResponse } from "next/server";
import {
  getRatesForFinish, getRegionForPostcode, applyRate, aggregatePricedRates,
  type TradeRate, type PricedRate
} from "@/lib/rates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRADE_SLUG    = "decorative-rendering";

// Mapping of finish slug → line item slug in the rates table
const FINISH_TO_LINE_ITEM: Record<string, string> = {
  "stone-effect":  "render-stone-effect-ashlar",
  "brick-effect":  "render-brick-effect",
  "timber-effect": "render-timber-effect",
  "rock-face":     "render-rock-face",
  "monocouche":    "render-monocouche",
  "silicone":      "render-silicone-thin-coat",
  "acrylic":       "render-acrylic-thin-coat",
  "lime":          "render-lime-3coat",
  "pebble-dash":   "render-pebble-dash",
  "roughcast":     "render-roughcast-harling",
  "tyrolean":      "render-tyrolean",
  "venetian":      "render-venetian-plaster"
};

// Always-included prep/aux line items (with default sizing rules)
const AUX_LINE_ITEMS_ALWAYS = [
  "prep-clean-prime"          // basic prep applied to whole net area
];

// Extras excluded — shown as bold callout to homeowner
const EXTRAS_EXCLUDED = [
  "Scaffolding (typically £600 – £3,000 depending on height + duration)",
  "Corner beads, drip beads, stop beads",
  "Substrate preparation beyond basic (damp treatment, deep patching, stripping old render, mesh reinforcement)",
  "Chosen product brand + specific colour premium",
  "Sealer / water-repellent (recommended for exterior — add £4-9/m²)",
  "Access charges (restricted parking, HGV constraints)",
  "Waste removal / skip hire",
  "VAT if the trade is VAT-registered",
  "Weather delays"
];

type Opening    = { width_m: number; height_m: number; count: number };
type Elevation  = { width_m: number; height_m: number; gable_rise_m: number; openings: Opening[] };
type Body       = { postcode?: string; finish: string; elevations: Elevation[] };

export async function POST(req: Request) {
  let body: Body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }

  if (!body.finish || !FINISH_TO_LINE_ITEM[body.finish]) {
    return NextResponse.json({ ok: false, error: "unknown-finish" }, { status: 400 });
  }
  if (!Array.isArray(body.elevations) || body.elevations.length === 0) {
    return NextResponse.json({ ok: false, error: "no-elevations" }, { status: 400 });
  }

  // ─── Net render area ─────────────────────────────────────────
  const netAreaM2 = body.elevations.reduce((acc, e) => {
    const gross = (e.width_m * e.height_m) + (e.gable_rise_m > 0 ? 0.5 * e.width_m * e.gable_rise_m : 0);
    const openings = e.openings.reduce((s, o) => s + (o.width_m * o.height_m * (o.count || 1)), 0);
    return acc + Math.max(0, gross - openings);
  }, 0);

  if (netAreaM2 <= 0) {
    return NextResponse.json({ ok: false, error: "zero-area", message: "Wall area minus openings is zero or negative — check your measurements." }, { status: 400 });
  }

  // ─── Region ──────────────────────────────────────────────────
  const region = body.postcode ? await getRegionForPostcode(body.postcode) : null;

  // ─── Fetch all rates for this finish (finish-specific + aux prep) ─
  const rates = await getRatesForFinish(TRADE_SLUG, body.finish);
  const finishLineItem = FINISH_TO_LINE_ITEM[body.finish];
  const finishRate = rates.find(r => r.line_item_slug === finishLineItem);
  if (!finishRate) {
    return NextResponse.json({ ok: false, error: "rate-not-found", missing: finishLineItem }, { status: 500 });
  }

  const priced: PricedRate[] = [];

  // Finish line
  priced.push(applyRate(finishRate, Math.round(netAreaM2 * 100) / 100, region));

  // Always-included aux line items (basic prep applied to net area)
  for (const auxSlug of AUX_LINE_ITEMS_ALWAYS) {
    const auxRate = rates.find(r => r.line_item_slug === auxSlug);
    if (auxRate) priced.push(applyRate(auxRate, Math.round(netAreaM2 * 100) / 100, region));
  }

  const agg = aggregatePricedRates(priced);

  return NextResponse.json({
    ok:                true,
    total_low_pence:   agg.low_pence,
    total_high_pence:  agg.high_pence,
    render_area_m2:    Math.round(netAreaM2 * 100) / 100,
    region_display:    region?.display_name ?? null,
    region_multiplier: region?.multiplier ?? 1.0,
    region_source_url: region?.source_url ?? null,
    confidence:        finishRate.confidence,
    finish_display:    finishRate.display_name,
    lines: priced.map(p => ({
      line_item_slug: p.rate.line_item_slug,
      display_name:   p.rate.display_name,
      quantity:       p.quantity,
      unit:           p.quantity_unit,
      low_pence:      p.low_pence,
      high_pence:     p.high_pence,
      citation_text:  p.citation_text,
      source_url:     p.rate.source_url,
      excludes_notes: p.rate.excludes_notes
    })),
    extras_excluded:   EXTRAS_EXCLUDED,
    stale_any:         agg.stale_any
  });
}
