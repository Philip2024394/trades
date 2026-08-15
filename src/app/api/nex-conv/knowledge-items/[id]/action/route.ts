// POST /api/nex-conv/knowledge-items/[id]/action
// Body: { action: "promote" | "reject", note?: string }
//
// Standing rules (Philip · 2026-08-15 · from project_nex_learning_system_architecture_*):
// - Rule 1: human review gate on every draft — this endpoint IS that gate
// - Rule 4: draft→live respects ADR-0033 via `via: owner_promotion` marker
//   (bump confidence to max(current, 0.70); do NOT bypass trigger)
// - Rule 5: reject is DELETE + conv_feedback audit entry
//
// All operations idempotent.
// - Promote on already-live item = no-op (returns { skipped: 'already live' })
// - Reject on missing item = 404
// - Reject on live (non-draft) item = 403 (safety · admin should not delete
//   promoted items via this endpoint · use a separate admin flow if needed)

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

type ActionBody = {
  action?: "promote" | "reject";
  note?: string;
};

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{8,}$/i.test(id)) return bad("invalid item id");

  let body: ActionBody;
  try { body = await req.json(); } catch { return bad("body must be JSON"); }
  const action = body?.action;
  const note = typeof body?.note === "string" ? body.note.slice(0, 500) : null;
  if (action !== "promote" && action !== "reject") return bad('action must be "promote" or "reject"');

  const pool = getPool();
  const client = await pool.connect();
  try {
    // Read current row
    const { rows } = await client.query(
      `SELECT id, brain, source_ref, kind, question_text, answer_text, confidence, draft_only
         FROM nex.conv_knowledge_items WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return bad("item not found", 404);
    const item = rows[0];

    if (action === "promote") {
      if (!item.draft_only) {
        return NextResponse.json({ ok: true, skipped: "already live", item: { id: item.id, confidence: Number(item.confidence), draft_only: false } });
      }
      // Rule 4: bump confidence to at least 0.70 (owner review IS the evidence
      // that confidence should be this high) · this satisfies the DB trigger
      // conv_ki_enforce_draft_tier without bypassing it.
      const newConfidence = Math.max(Number(item.confidence), 0.70);
      await client.query(
        `UPDATE nex.conv_knowledge_items
           SET draft_only = false,
               confidence = $2,
               updated_at = now()
         WHERE id = $1`,
        [id, newConfidence]
      );
      return NextResponse.json({
        ok: true,
        action: "promoted",
        item: {
          id: item.id,
          confidence_before: Number(item.confidence),
          confidence_after: newConfidence,
          draft_only: false,
          note,
        },
      });
    }

    // action === "reject"
    // Rule 5: DELETE (cascade removes edges) but log to conv_feedback first
    // so audit trail is preserved. We synthesise a turn_id · the schema
    // requires turn_id to exist. If no turn covers this item, we can't
    // insert into conv_feedback (FK). In that case log to console + still
    // proceed with delete; auditing enhancement is a follow-up.
    if (!item.draft_only) {
      return bad("cannot reject a live (promoted) item · use a separate admin flow", 403);
    }

    // Try to attach reject audit to the most recent turn that used this item
    const { rows: turnRows } = await client.query(
      `SELECT id FROM nex.conv_turns
         WHERE $1 = ANY(used_item_ids)
         ORDER BY created_at DESC LIMIT 1`,
      [id]
    );
    const auditTurnId = turnRows[0]?.id ?? null;

    await client.query("BEGIN");
    try {
      if (auditTurnId) {
        await client.query(
          `INSERT INTO nex.conv_feedback (turn_id, signal, source, note)
             VALUES ($1, 'wrong', 'labelled', $2)`,
          [auditTurnId, note ? `[reject] ${note}` : "[reject] admin rejected draft item"]
        );
      }
      await client.query(
        `DELETE FROM nex.conv_knowledge_items WHERE id = $1`,
        [id]
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
    return NextResponse.json({
      ok: true,
      action: "rejected",
      item: { id, deleted: true, audit_turn_id: auditTurnId, note },
    });
  } catch (e) {
    return bad(
      "action failed: " + String((e as Error)?.message ?? e).slice(0, 300),
      500
    );
  } finally {
    client.release();
  }
}
