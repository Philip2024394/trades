// GET /api/nex-conv/drafts
// Lists draft knowledge_items (draft_only=true) awaiting human review.
//
// Query params (all optional):
//   ?conversation_id=<uuid>   — only drafts from this conversation
//   ?source_batch=<string>    — filter by batch id
//   ?limit=<n>                — max items (default 100)
//   ?since=<iso-date>         — only items created after this date

import { NextResponse, type NextRequest } from "next/server";
import pg from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

let _pool: pg.Pool | null = null;
function getPool() {
  if (_pool) return _pool;
  _pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 4 });
  return _pool;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const conversationId = url.searchParams.get("conversation_id");
  const sourceBatch = url.searchParams.get("source_batch");
  const since = url.searchParams.get("since");
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));

  const pool = getPool();
  const clauses: string[] = ["draft_only = true"];
  const params: unknown[] = [];
  if (conversationId) {
    params.push(`live-conv/${conversationId}#%`);
    clauses.push(`source_ref LIKE $${params.length}`);
  }
  if (sourceBatch) {
    params.push(sourceBatch);
    clauses.push(`source_batch = $${params.length}`);
  }
  if (since) {
    params.push(since);
    clauses.push(`created_at >= $${params.length}`);
  }
  params.push(limit);
  const where = clauses.join(" AND ");

  const { rows } = await pool.query(
    `SELECT id, brain, source_batch, source_ref, kind,
            question_text, answer_text, canonical_intent, entities, topics,
            confidence, created_at
       FROM nex.conv_knowledge_items
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length}`,
    params
  );

  // Aggregate counts (help the UI show totals)
  const { rows: aggRows } = await pool.query(`
    SELECT
      COUNT(*)::int AS total_drafts,
      COUNT(*) FILTER (WHERE source_batch = 'live-conversations-2026-08-15')::int AS from_live,
      COUNT(DISTINCT SPLIT_PART(SPLIT_PART(source_ref, '/', 2), '#', 1))
        FILTER (WHERE source_ref LIKE 'live-conv/%')::int AS conversations_represented
    FROM nex.conv_knowledge_items
    WHERE draft_only = true
  `);

  return NextResponse.json({
    aggregate: aggRows[0] ?? null,
    filter: { conversationId, sourceBatch, since, limit },
    drafts: rows.map(r => ({
      ...r,
      confidence: Number(r.confidence),
    })),
  });
}
