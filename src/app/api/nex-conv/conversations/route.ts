// GET /api/nex-conv/conversations
// Read-only admin summary of every conversation the pipeline has seen.
// Reads directly from nex.conv_turns + nex.conv_states.
// Query: ?limit=50&conversation_id=<uuid> · both optional.

import { NextResponse, type NextRequest } from "next/server";
import pg from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

let _pool: pg.Pool | null = null;
function getPool() {
  if (_pool) return _pool;
  _pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 4 });
  return _pool;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const conversationId = url.searchParams.get("conversation_id");
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));

  const pool = getPool();

  if (conversationId) {
    const { rows: turnRows } = await pool.query(
      `SELECT id, conversation_id, turn_index, speaker, text, detected_intent,
              detected_entities, used_item_ids, latency_ms, created_at
       FROM nex.conv_turns
       WHERE conversation_id = $1
       ORDER BY turn_index ASC`,
      [conversationId]
    );
    const { rows: stateRows } = await pool.query(
      `SELECT state, created_at, updated_at FROM nex.conv_states WHERE conversation_id = $1 LIMIT 1`,
      [conversationId]
    );
    const state = stateRows[0]?.state ?? null;
    return NextResponse.json({
      conversation_id: conversationId,
      turn_count: turnRows.length,
      state_snapshot: state ? {
        turn_count: state.turn_count,
        current_topic: state.current_topic,
        established_facts: state.established_facts,
        entities_in_focus: state.entities_in_focus,
        constraints: state.constraints,
        current_emotion: state.current_emotion,
        handoff_recommended: state.handoff_recommended,
        corrections_logged: (state.corrections_log ?? []).length,
        stage: state.stage,
      } : null,
      turns: turnRows,
    });
  }

  // Summary of recent conversations · one row per convo
  const { rows } = await pool.query(
    `SELECT
       c.conversation_id,
       COUNT(*) FILTER (WHERE c.speaker = 'customer')::int AS customer_turns,
       COUNT(*) FILTER (WHERE c.speaker = 'nex')::int AS nex_turns,
       MIN(c.created_at) AS started_at,
       MAX(c.created_at) AS last_turn_at,
       (SELECT text FROM nex.conv_turns t
        WHERE t.conversation_id = c.conversation_id AND t.speaker='customer'
        ORDER BY t.turn_index ASC LIMIT 1) AS first_customer_message,
       s.state ->> 'current_topic' AS current_topic,
       (s.state -> 'established_facts' -> 'material_primary' ->> 'value') AS material,
       (s.state -> 'established_facts' -> 'style_intent' ->> 'value') AS style,
       (s.state ->> 'current_emotion') AS emotion,
       ((s.state ->> 'handoff_recommended')::boolean) AS handoff_recommended
     FROM nex.conv_turns c
     LEFT JOIN nex.conv_states s ON s.conversation_id = c.conversation_id
     GROUP BY c.conversation_id, s.state
     ORDER BY MAX(c.created_at) DESC
     LIMIT $1`,
    [limit]
  );

  const { rows: countRows } = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM nex.conv_turns) AS total_turns,
      (SELECT COUNT(DISTINCT conversation_id)::int FROM nex.conv_turns) AS total_conversations,
      (SELECT COUNT(*)::int FROM nex.conv_knowledge_items) AS total_items,
      (SELECT COUNT(*)::int FROM nex.conv_knowledge_items WHERE NOT draft_only) AS live_items,
      (SELECT COUNT(*)::int FROM nex.conv_knowledge_items WHERE draft_only) AS draft_items,
      (SELECT COUNT(*)::int FROM nex.conv_knowledge_items WHERE source_batch = 'live-conversations-2026-08-15') AS from_live,
      (SELECT COUNT(*)::int FROM nex.conv_edges) AS total_edges
  `);

  return NextResponse.json({
    aggregate: countRows[0] ?? null,
    conversations: rows,
  });
}
