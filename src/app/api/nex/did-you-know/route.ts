// GET /api/nex/did-you-know · Philip 2026-08-28
//
// Returns curated Indonesia Did You Know facts.
// Query params:
//   category=nature|geology|culture|history|language|food|rituals|science|society|symbols
//   region=<region_slug>
//   limit=1..500 (default 60)
//   ambient=1 → returns 1 random fact (ambient injection use)
//
// Response: { ok, facts: [{ id, slug, title, body, category, region_label, ... }] }

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

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const category = url.searchParams.get("category")?.trim().toLowerCase() ?? "";
  const region = url.searchParams.get("region")?.trim().toLowerCase() ?? "";
  const ambient = url.searchParams.get("ambient") === "1";
  const limitRaw = Number(url.searchParams.get("limit") ?? (ambient ? 1 : 60));
  const limit = ambient ? 1 : Math.max(1, Math.min(500, Number.isFinite(limitRaw) ? limitRaw : 60));

  try {
    const p = getPool();
    const client = await p.connect();
    try {
      const params: unknown[] = [limit];
      const wheres: string[] = ["is_active = true"];
      if (category) {
        params.push(category);
        wheres.push(`category = $${params.length}`);
      }
      if (region) {
        params.push(region);
        wheres.push(`region_slug = $${params.length}`);
      }

      const order = ambient ? "random()" : "priority DESC, random()";

      const { rows } = await client.query(
        `
        SELECT
          fact_id::text AS id, slug, title, body, title_id, body_id,
          category, region_slug, region_label, truth_class, difficulty,
          verified_source, source_url, priority
        FROM nex.brain_did_you_know_indonesia
        WHERE ${wheres.join(" AND ")}
        ORDER BY ${order}
        LIMIT $1
        `,
        params,
      );

      return NextResponse.json(
        { ok: true, facts: rows, count: rows.length },
        { headers: { "cache-control": "private, max-age=30" } },
      );
    } finally {
      client.release();
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
