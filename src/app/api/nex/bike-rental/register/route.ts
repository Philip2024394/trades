// POST /api/nex/bike-rental/register · Philip 2026-08-29
//
// UPSERTs a rental listing by slug. Validates:
//   · WhatsApp E.164 (+62...)
//   · Non-negative counts for helmets/raincoats
//   · Positive IDR pricing when supplied
//   · At least one price tier present
//   · buy_price required when has_buy_option = true

import { NextRequest, NextResponse } from "next/server";
import pg from "pg";

const { Pool } = pg;
let pool: pg.Pool | null = null;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.NEX_POSTGRES_URL ??
        "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
      max: 3,
    });
  }
  return pool;
}

function slugify(s: string): string {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
function validWa(w: unknown): string | null {
  if (typeof w !== "string") return null;
  const trimmed = w.trim().replace(/\s|-/g, "");
  return /^\+62\d{8,13}$/.test(trimmed) ? trimmed : null;
}
function intOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}
function nonNegInt(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try { payload = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }); }

  const name          = typeof payload.name === "string" ? payload.name.trim() : "";
  const city          = typeof payload.city === "string" ? payload.city.trim() : "";
  const neighbourhood = typeof payload.neighbourhood === "string" ? payload.neighbourhood.trim() || null : null;
  const whatsapp      = validWa(payload.whatsapp_e164);
  const helmets       = nonNegInt(payload.helmets_included, 1);
  const raincoats     = nonNegInt(payload.raincoats_included, 0);
  const dropoff       = Boolean(payload.hotel_villa_dropoff);
  const tankFull      = Boolean(payload.tank_full_on_rental);
  const airportPickup = Boolean(payload.airport_pickup_on_arrival);
  const pDay          = intOrNull(payload.price_per_day_idr);
  const pWeek         = intOrNull(payload.price_per_week_idr);
  const pMonth        = intOrNull(payload.price_per_month_idr);
  const hasBuy        = Boolean(payload.has_buy_option);
  const buyPrice      = intOrNull(payload.buy_price_idr);
  const preferredBikeSlug   = typeof payload.preferred_bike_slug === "string" ? payload.preferred_bike_slug.trim() || null : null;
  const preferredCategories = Array.isArray(payload.preferred_categories)
    ? (payload.preferred_categories as unknown[]).filter((c) => typeof c === "string" && c.length > 0) as string[]
    : [];

  const errors: string[] = [];
  if (name.length < 2 || name.length > 120) errors.push("name 2-120 chars");
  if (!city)                                 errors.push("city required");
  if (!whatsapp)                             errors.push("whatsapp_e164 invalid (expect +62...)");
  if (!pDay && !pWeek && !pMonth)            errors.push("at least one price tier required");
  if (hasBuy && !buyPrice)                   errors.push("buy_price_idr required when has_buy_option");
  if (errors.length > 0) return NextResponse.json({ ok: false, errors }, { status: 400 });

  const slug = slugify(`${name}-${city}`);

  const client = await getPool().connect();
  try {
    // Verify preferred_bike_slug exists if given
    if (preferredBikeSlug) {
      const exists = await client.query(
        `SELECT 1 FROM nex.bike_model WHERE slug = $1 AND is_active = true LIMIT 1`,
        [preferredBikeSlug],
      );
      if (exists.rowCount === 0) {
        return NextResponse.json({ ok: false, error: `preferred_bike_slug not found: ${preferredBikeSlug}` }, { status: 404 });
      }
    }

    const { rows } = await client.query(
      `INSERT INTO nex.bike_rental_listing
         (slug, name, city, neighbourhood, whatsapp_e164, preferred_bike_slug, preferred_categories,
          helmets_included, raincoats_included, hotel_villa_dropoff, tank_full_on_rental,
          airport_pickup_on_arrival,
          price_per_day_idr, price_per_week_idr, price_per_month_idr,
          has_buy_option, buy_price_idr)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (slug) DO UPDATE SET
         name                       = EXCLUDED.name,
         city                       = EXCLUDED.city,
         neighbourhood              = EXCLUDED.neighbourhood,
         whatsapp_e164              = EXCLUDED.whatsapp_e164,
         preferred_bike_slug        = EXCLUDED.preferred_bike_slug,
         preferred_categories       = EXCLUDED.preferred_categories,
         helmets_included           = EXCLUDED.helmets_included,
         raincoats_included         = EXCLUDED.raincoats_included,
         hotel_villa_dropoff        = EXCLUDED.hotel_villa_dropoff,
         tank_full_on_rental        = EXCLUDED.tank_full_on_rental,
         airport_pickup_on_arrival  = EXCLUDED.airport_pickup_on_arrival,
         price_per_day_idr          = EXCLUDED.price_per_day_idr,
         price_per_week_idr         = EXCLUDED.price_per_week_idr,
         price_per_month_idr        = EXCLUDED.price_per_month_idr,
         has_buy_option             = EXCLUDED.has_buy_option,
         buy_price_idr              = EXCLUDED.buy_price_idr,
         updated_at                 = now()
       RETURNING rental_id, slug, (xmax = 0) AS is_new`,
      [slug, name, city, neighbourhood, whatsapp, preferredBikeSlug, preferredCategories,
       helmets, raincoats, dropoff, tankFull, airportPickup,
       pDay, pWeek, pMonth, hasBuy, buyPrice],
    );
    return NextResponse.json({ ok: true, ...rows[0] });
  } finally {
    client.release();
  }
}
