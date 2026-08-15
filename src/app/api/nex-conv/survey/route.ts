// POST /api/nex-conv/survey
// Body: { conversation_id, responses: {q1..q15}, moderator_notes?: string }
//
// Writes the 15-question M4 blind-user-test survey to nex.conv_outcomes.
// No migration needed · uses existing schema (outcome enum mapped from Q5,
// outcome_note holds the full JSON payload).

import { NextResponse, type NextRequest } from "next/server";
import pg from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

let _pool: pg.Pool | null = null;
function getPool() {
  if (_pool) return _pool;
  _pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 4 });
  return _pool;
}

type Responses = {
  // Dimension 1 · AI detection
  q1_thought?: "person" | "ai" | "both" | "unsure";
  q2_confidence?: 1 | 2 | 3 | 4 | 5;
  q3_reason?: string;
  // Dimension 2 · Usefulness
  q4_helped?: 1 | 2 | 3 | 4 | 5;
  q5_outcome?: "yes" | "partial" | "no";
  q6_would_use_again?: "yes" | "maybe" | "no";
  // Dimension 3 · Correctness / trust
  q7_trust?: 1 | 2 | 3 | 4 | 5;
  q8_wrong?: "yes" | "no";
  q8_wrong_detail?: string;
  // Dimension 4 · Conversation quality
  q9_understood?: 1 | 2 | 3 | 4 | 5;
  q10_repeated?: "yes" | "no";
  q11_misunderstood?: "yes" | "no";
  q11_misunderstood_detail?: string;
  q12_frustrated?: "yes" | "no";
  q12_frustrated_detail?: string;
  // Dimension 5 · Business outcome
  q13_nps?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  q14_would_enquire?: "yes" | "maybe" | "no";
  q15_other?: string;
};

type Body = {
  conversation_id?: string;
  responses?: Responses;
  moderator_notes?: string;
  participant_age_band?: "18-30" | "30-45" | "45-60" | "60+";
  participant_tech_comfort?: "low" | "medium" | "high";
};

function outcomeFromQ5(q5: string | undefined): string {
  switch (q5) {
    case "yes": return "resolved";
    case "partial": return "clarification_completed";
    case "no": return "user_abandoned";
    default: return "pending";
  }
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: NextRequest) {
  let body: Body;
  try { body = await req.json(); } catch { return bad("body must be JSON"); }

  const convId = body?.conversation_id;
  if (!convId || !/^[0-9a-f-]{8,}$/i.test(convId)) return bad("invalid conversation_id");
  const responses = body?.responses ?? {};

  const payload = {
    survey_version: "m4-2026-08-15",
    submitted_at: new Date().toISOString(),
    participant: {
      age_band: body.participant_age_band ?? null,
      tech_comfort: body.participant_tech_comfort ?? null,
    },
    moderator_notes: body.moderator_notes ?? null,
    responses,
  };

  const outcome = outcomeFromQ5(responses.q5_outcome);

  const pool = getPool();
  try {
    await pool.query(
      `INSERT INTO nex.conv_outcomes (conversation_id, outcome, outcome_note, labelled_by)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (conversation_id) DO UPDATE SET
         outcome = EXCLUDED.outcome,
         outcome_note = EXCLUDED.outcome_note,
         labelled_by = EXCLUDED.labelled_by,
         labelled_at = now()`,
      [convId, outcome, JSON.stringify(payload)]
    );
    return NextResponse.json({
      ok: true,
      conversation_id: convId,
      outcome_mapped: outcome,
      survey_version: payload.survey_version,
    });
  } catch (e) {
    return bad("survey save failed: " + String((e as Error)?.message ?? e).slice(0, 300), 500);
  }
}

// GET returns the survey for one conversation OR an aggregate over all
// M4 surveys · used by the results dashboard.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const convId = url.searchParams.get("conversation_id");
  const pool = getPool();

  if (convId) {
    const { rows } = await pool.query(
      `SELECT conversation_id, outcome, outcome_note, labelled_by, labelled_at
         FROM nex.conv_outcomes WHERE conversation_id = $1`,
      [convId]
    );
    if (rows.length === 0) return NextResponse.json({ error: "no survey for this conversation" }, { status: 404 });
    const r = rows[0];
    let payload: unknown = null;
    try { payload = typeof r.outcome_note === "string" ? JSON.parse(r.outcome_note) : r.outcome_note; }
    catch { payload = { parse_error: true, raw: r.outcome_note }; }
    return NextResponse.json({
      conversation_id: r.conversation_id,
      outcome: r.outcome,
      labelled_at: r.labelled_at,
      payload,
    });
  }

  // Aggregate across all M4 survey submissions
  const { rows } = await pool.query(
    `SELECT conversation_id, outcome, outcome_note, labelled_at
       FROM nex.conv_outcomes
      WHERE outcome_note::text LIKE '%"survey_version":"m4-2026-08-15"%'
      ORDER BY labelled_at DESC`
  );
  const submissions = rows.map(r => {
    let payload: any = null;
    try { payload = typeof r.outcome_note === "string" ? JSON.parse(r.outcome_note) : r.outcome_note; }
    catch { payload = null; }
    return {
      conversation_id: r.conversation_id,
      outcome: r.outcome,
      labelled_at: r.labelled_at,
      responses: payload?.responses ?? {},
      participant: payload?.participant ?? {},
    };
  });

  // Aggregate helpers
  const N = submissions.length;
  const pct = (n: number) => N ? Math.round((n / N) * 100) : 0;
  const countIf = (fn: (r: any) => boolean) => submissions.filter(s => fn(s.responses)).length;
  const meanOf = (getter: (r: any) => number | undefined) => {
    const vals = submissions.map(s => getter(s.responses)).filter((v): v is number => typeof v === "number");
    if (vals.length === 0) return null;
    return +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
  };

  const nps = (() => {
    const vals = submissions.map(s => s.responses?.q13_nps).filter((v: any): v is number => typeof v === "number");
    if (vals.length === 0) return { score: null, promoters: 0, passives: 0, detractors: 0, n: 0 };
    const promoters = vals.filter(v => v >= 9).length;
    const detractors = vals.filter(v => v <= 6).length;
    const passives = vals.length - promoters - detractors;
    return { score: Math.round(((promoters - detractors) / vals.length) * 100), promoters, passives, detractors, n: vals.length };
  })();

  return NextResponse.json({
    n_submissions: N,
    dimension_1_ai_detection: {
      thought_person: pct(countIf(r => r.q1_thought === "person")),
      thought_ai: pct(countIf(r => r.q1_thought === "ai")),
      thought_both: pct(countIf(r => r.q1_thought === "both")),
      thought_unsure: pct(countIf(r => r.q1_thought === "unsure")),
      mean_confidence: meanOf(r => r.q2_confidence),
      correctly_identified_ai_high_confidence_pct: pct(countIf(r => r.q1_thought === "ai" && (r.q2_confidence ?? 0) >= 4)),
    },
    dimension_2_usefulness: {
      mean_helped: meanOf(r => r.q4_helped),
      outcome_yes_pct: pct(countIf(r => r.q5_outcome === "yes")),
      outcome_partial_pct: pct(countIf(r => r.q5_outcome === "partial")),
      outcome_no_pct: pct(countIf(r => r.q5_outcome === "no")),
      would_use_again_yes_or_maybe_pct: pct(countIf(r => r.q6_would_use_again === "yes" || r.q6_would_use_again === "maybe")),
    },
    dimension_3_correctness_trust: {
      mean_trust: meanOf(r => r.q7_trust),
      wrong_reported_pct: pct(countIf(r => r.q8_wrong === "yes")),
    },
    dimension_4_conversation_quality: {
      mean_understood: meanOf(r => r.q9_understood),
      repeated_pct: pct(countIf(r => r.q10_repeated === "yes")),
      misunderstood_pct: pct(countIf(r => r.q11_misunderstood === "yes")),
      frustrated_pct: pct(countIf(r => r.q12_frustrated === "yes")),
    },
    dimension_5_business_outcome: {
      nps,
      would_enquire_yes_or_maybe_pct: pct(countIf(r => r.q14_would_enquire === "yes" || r.q14_would_enquire === "maybe")),
    },
    submissions,
  });
}
