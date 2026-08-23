// POST /api/nex/cle/promote-candidate
//
// Task #76 Bundle B · 2026-08-22 · admin promotion gate for CLE candidates.
//
// Constitutional boundary (project_nex_cle_constitutional_boundary_2026_08_22):
//   "Conversation does not automatically teach NEX. The CLE pipeline should:
//    observe → compare → candidate → evidence → admin promotion → knowledge."
//
// This route IS the "admin promotion" step. It is the ONLY code path that
// can transition a nex.conv_learning_candidate from pending_review to
// promoted (with a resulting nex.knowledge_records row at status=UNDER_REVIEW).
//
// Rejection is also handled here · rejected candidates stay for audit ·
// never deleted.
//
// Request body:
//   { candidate_id: string, action: "promote" | "reject", reviewer?: string, rejection_reason?: string }
//
// Response:
//   promote → { ok: true, action: "promote", record_id: string, knowledge_record_id: string }
//   reject  → { ok: true, action: "reject", rejection_reason: string }
//   error   → { ok: false, error: string, status: number }
//
// EN + ID both go through this identical gate · language is metadata only.

import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getFoodDbPool } from "@/lib/nex-food/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  candidate_id: z.string().uuid(),
  action: z.enum(["promote", "reject"]),
  reviewer: z.string().min(1).max(100).optional(),
  rejection_reason: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", detail: parsed.error.issues }, { status: 400 });
  }
  const { candidate_id, action, reviewer, rejection_reason } = parsed.data;
  const reviewer_id = reviewer ?? "admin:hq";

  const pool = getFoodDbPool();

  // Load candidate · verify status=pending_review · reject double-promotion
  const c = await pool.query(
    `SELECT candidate_id, cycle_run_id, from_turn_ids, language, brain, candidate_kind,
            candidate_payload, score, status
       FROM nex.conv_learning_candidate
      WHERE candidate_id = $1`,
    [candidate_id],
  );
  if (c.rowCount === 0) {
    return NextResponse.json({ ok: false, error: "candidate_not_found" }, { status: 404 });
  }
  const cand = c.rows[0];
  if (cand.status !== "pending_review") {
    return NextResponse.json({
      ok: false,
      error: "candidate_already_reviewed",
      detail: { current_status: cand.status },
    }, { status: 409 });
  }

  if (action === "reject") {
    await pool.query(
      `UPDATE nex.conv_learning_candidate
          SET status = 'rejected',
              reviewed_at = now(),
              reviewed_by = $2,
              rejection_reason = $3
        WHERE candidate_id = $1`,
      [candidate_id, reviewer_id, rejection_reason ?? "no reason provided"],
    );
    return NextResponse.json({
      ok: true,
      action: "reject",
      candidate_id,
      rejection_reason: rejection_reason ?? "no reason provided",
    });
  }

  // action === "promote" · create the knowledge_records row + link back
  const record_id = `cle-${cand.language}-${randomUUID().slice(0, 8)}`;
  const payload = cand.candidate_payload as Record<string, unknown>;
  const title = String(
    payload.question_text
    ?? payload.slug
    ?? `CLE candidate ${cand.candidate_kind}`
  ).slice(0, 200);
  const summary = `Promoted from CLE candidate ${candidate_id} · kind=${cand.candidate_kind} · language=${cand.language} · brain=${cand.brain}`;
  const body_markdown = JSON.stringify(payload, null, 2);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // 1. Create the knowledge_records row (UNDER_REVIEW gate · not AUTHORITATIVE yet).
    // Per doctrine: even admin promotion of a CLE candidate lands at UNDER_REVIEW ·
    // AUTHORITATIVE status requires a second reviewer confirmation via the standard
    // /api/nex/brain/review route. Two-gate discipline.
    const ins = await client.query(
      `INSERT INTO nex.knowledge_records
         (id, record_id, record_version, status, canonical_owner, authored_by, reviewed_by,
          title, category, subcategory, summary, body_markdown, primary_audience, created_at)
       VALUES
         (gen_random_uuid(), $1, 'v1', 'UNDER_REVIEW', 'cle', 'cle:conversation-teacher', $2,
          $3, 'conversation-learned', $4, $5, $6, 'homeowner', now())
       RETURNING id, record_id`,
      [
        record_id,
        reviewer_id,
        title,
        cand.candidate_kind,
        summary,
        body_markdown,
      ],
    );
    const created = ins.rows[0];

    // 2. Link candidate → knowledge_record · flip status to promoted.
    await client.query(
      `UPDATE nex.conv_learning_candidate
          SET status = 'promoted',
              reviewed_at = now(),
              reviewed_by = $2,
              promotion_target_record_id = $3
        WHERE candidate_id = $1`,
      [candidate_id, reviewer_id, created.id],
    );

    await client.query("COMMIT");
    return NextResponse.json({
      ok: true,
      action: "promote",
      candidate_id,
      record_id: created.record_id,
      knowledge_record_id: created.id,
      status: "UNDER_REVIEW",
      note: "Second reviewer must approve via /api/nex/brain/review to reach AUTHORITATIVE",
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: "promote_failed", detail: message }, { status: 500 });
  } finally {
    client.release();
  }
}
