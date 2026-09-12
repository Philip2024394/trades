// GET /api/nex/bike-models · Philip 2026-08-29
// Returns bike taxonomy grouped by brand for cascading dropdown in onboarding.

import { NextResponse } from "next/server";
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

export async function GET() {
  const client = await getPool().connect();
  try {
    const { rows } = await client.query(
      `SELECT slug, brand, model, year_range, cc, category,
              base_image, base_color, common_colors
       FROM nex.bike_model
       WHERE is_active = true
       ORDER BY brand, category, model`,
    );
    return NextResponse.json(
      { ok: true, bikes: rows },
      { headers: { "cache-control": "public, max-age=600" } },
    );
  } finally {
    client.release();
  }
}
