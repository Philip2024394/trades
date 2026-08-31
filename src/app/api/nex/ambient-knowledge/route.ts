// GET /api/nex/ambient-knowledge · Philip 2026-08-28
//
// Returns a pool of knowledge_inbox entries that the client-side ambient
// injector can select from during quiet chat moments. Optional ?topic=
// query narrows the pool by substring match on title/preview_text.
//
// Doctrine: project_nex_ambient_knowledge_injector_doctrine_2026_08_28.md
// The injector NEVER fetches on every trigger · fetches once at session
// start and keeps a client-side pool. This route is intentionally cheap
// and cacheable.

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
  const topic = req.nextUrl.searchParams.get("topic")?.trim() ?? "";
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 40);
  const limit = Math.max(10, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 40));

  try {
    const p = getPool();
    const client = await p.connect();
    try {
      // Layer 1 · premium curated facts from did_you_know_indonesia
      // (Philip 2026-08-28 · always preferred over Wikipedia dump).
      const dykParams: unknown[] = [limit];
      let dykWhere = "is_active = true";
      if (topic) {
        dykParams.push(`%${topic}%`);
        dykWhere += ` AND (title ILIKE $${dykParams.length} OR body ILIKE $${dykParams.length} OR region_slug ILIKE $${dykParams.length})`;
      }
      const { rows: dykRows } = await client.query(
        `
        SELECT
          fact_id::text AS id, title, body, category, truth_class,
          region_slug, region_label, priority
        FROM nex.brain_did_you_know_indonesia
        WHERE ${dykWhere}
        ORDER BY priority DESC, random()
        LIMIT $1
        `,
        dykParams,
      );

      const dyk_items = dykRows.map((r) => ({
        id: `dyk:${r.id}`,
        title: r.title as string,
        body: r.body as string,
        source: "curated_did_you_know_v1",
        truthClass: r.truth_class as string,
        topicKey: (r.region_slug as string | null) ?? (r.category as string),
      }));

      // Layer 2 · fall back to walker-derived Wikipedia if we need more.
      const need = Math.max(0, limit - dyk_items.length);
      const params: unknown[] = [need > 0 ? need : 1];
      let where = `brain_slug = 'indonesia'
        AND preview_text IS NOT NULL
        AND LENGTH(preview_text) BETWEEN 60 AND 500
        AND truth_class IS NOT NULL`;

      if (topic) {
        params.push(`%${topic}%`);
        where += ` AND (title ILIKE $${params.length} OR preview_text ILIKE $${params.length})`;
      }

      const walker_rows = need > 0
        ? (await client.query(
            `
            SELECT
              id, title, preview_text, source, truth_class, topic_key,
              created_at_iso
            FROM nex.knowledge_inbox
            WHERE ${where}
            ORDER BY random()
            LIMIT $1
            `,
            params,
          )).rows
        : [];

      const walker_items = walker_rows.map((r) => ({
        id: r.id as string,
        title: r.title as string,
        body: r.preview_text as string,
        source: r.source as string,
        truthClass: r.truth_class as string,
        topicKey: r.topic_key as string | null,
      }));

      const pool_items = [...dyk_items, ...walker_items];

      return NextResponse.json(
        { ok: true, pool: pool_items, size: pool_items.length },
        { headers: { "cache-control": "private, max-age=60" } },
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
