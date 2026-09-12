// GET  /api/nex/marketing/segments
// POST /api/nex/marketing/segments

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { computeSegmentCount } from "@/lib/nex/marketing/segments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isFounderRequest(req: Request): boolean {
  const url = new URL(req.url);
  const host = url.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  const cookie = req.headers.get("cookie") ?? "";
  if (cookie.includes("admin_authed=1") || /x-admin-sig|nex_session=/.test(cookie)) return true;
  const token = req.headers.get("x-hq-token") ?? url.searchParams.get("hq_token");
  const expected = process.env.NEX_HQ_DASHBOARD_TOKEN;
  if (expected && expected.length >= 16 && token && token === expected) return true;
  return false;
}

export async function GET(req: Request) {
  if (!isFounderRequest(req)) return NextResponse.json({ error: "no_founder_credential" }, { status: 401 });
  const pool = await getPool();
  if (!pool) return NextResponse.json({ segments: [] });
  const c = await pool.connect();
  try {
    const r = await c.query(`SELECT * FROM nex.marketing_segment ORDER BY created_at DESC`);
    return NextResponse.json({ segments: r.rows });
  } finally { c.release(); }
}

export async function POST(req: Request) {
  if (!isFounderRequest(req)) return NextResponse.json({ error: "no_founder_credential" }, { status: 401 });
  const body = await req.json().catch(() => null) as {
    slug?: string; display_name?: string;
    category_group?: string; category_slug?: string; country?: string; city?: string; language?: string;
    extra_where?: string;
  } | null;
  if (!body?.slug || !body.display_name) return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  // extra_where guard · whitelist chars only
  if (body.extra_where && !/^[A-Za-z0-9_ '"=,()!<>]+$/.test(body.extra_where)) {
    return NextResponse.json({ error: "invalid_extra_where", detail: "only alphanumerics + comparison ops allowed" }, { status: 400 });
  }
  const count = await computeSegmentCount({
    category_group: body.category_group, category_slug: body.category_slug,
    country: body.country, city: body.city, language: body.language,
  }, body.extra_where);
  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "postgres_unavailable" }, { status: 500 });
  const c = await pool.connect();
  try {
    const r = await c.query(
      `INSERT INTO nex.marketing_segment (slug, display_name, category_group, category_slug, country, city, language, extra_where, last_computed_count, last_computed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
       ON CONFLICT (slug) DO UPDATE SET
         display_name=EXCLUDED.display_name, category_group=EXCLUDED.category_group,
         category_slug=EXCLUDED.category_slug, country=EXCLUDED.country, city=EXCLUDED.city,
         language=EXCLUDED.language, extra_where=EXCLUDED.extra_where,
         last_computed_count=EXCLUDED.last_computed_count, last_computed_at=now()
       RETURNING segment_id`,
      [body.slug, body.display_name, body.category_group ?? null, body.category_slug ?? null,
       body.country ?? null, body.city ?? null, body.language ?? null, body.extra_where ?? null, count]
    );
    return NextResponse.json({ ok: true, segment_id: r.rows[0].segment_id, count });
  } finally { c.release(); }
}
