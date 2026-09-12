// GET /api/nex/bike-rentals · Philip 2026-08-29
// Returns rental listings joined with taxonomy bike info.

import { NextRequest, NextResponse } from "next/server";
import pg from "pg";
import { getPostgresUrl } from "@/lib/nex/config/pg";

const { Pool } = pg;
let pool: pg.Pool | null = null;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getPostgresUrl(),
      max: 2,
    });
  }
  return pool;
}

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city")?.trim();
  const limit = Math.min(50, Number(req.nextUrl.searchParams.get("limit") ?? 20));

  const client = await getPool().connect();
  try {
    const params: unknown[] = [limit];
    let where = `status = 'active'`;
    if (city) {
      params.push(city);
      where += ` AND city = $${params.length}`;
    }
    const { rows } = await client.query(
      `SELECT rental_id, slug, name, city, neighbourhood, whatsapp_e164,
              preferred_bike_slug, preferred_categories,
              helmets_included, raincoats_included,
              hotel_villa_dropoff, tank_full_on_rental, airport_pickup_on_arrival,
              price_per_day_idr, price_per_week_idr, price_per_month_idr,
              has_buy_option, buy_price_idr,
              rating_avg, rating_count
       FROM nex.bike_rental_listing
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $1`,
      params,
    );
    return NextResponse.json(
      { ok: true, rentals: rows },
      { headers: { "cache-control": "public, max-age=60" } },
    );
  } finally {
    client.release();
  }
}
