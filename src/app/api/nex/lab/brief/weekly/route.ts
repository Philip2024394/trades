// src/app/api/nex/lab/brief/weekly/route.ts
//
// GET /api/nex/lab/brief/weekly   → returns the current week's brief.
// Founder-facing · never blocks · always measured.

import { NextResponse } from "next/server";
import { composeWeeklyBrief } from "@/lib/nex/lab/weekly-brief";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadPool() {
  try {
    const { Pool } = await import("pg");
    return new Pool({
      connectionString: process.env.NEX_TAXONOMY_POSTGRES_URL
        ?? process.env.NEX_POSTGRES_URL
        ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
      max: 3,
      connectionTimeoutMillis: 5000,
    });
  } catch { return null; }
}

export async function GET() {
  const pool = await loadPool();
  if (!pool) return NextResponse.json({ error: "pg_missing" }, { status: 500 });
  try {
    const brief = await composeWeeklyBrief(pool);
    return NextResponse.json(brief, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 200) }, { status: 500 });
  } finally {
    await pool.end().catch(() => { /* ignore */ });
  }
}
