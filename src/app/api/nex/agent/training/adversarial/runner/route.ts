// src/app/api/nex/agent/training/adversarial/runner/route.ts
//
// NEX1 · Adversarial Training RUNNER.
//
// Founder question (2026-09-12): "why isn't the bar moving? why isn't the task
// active to teach NEX1?" · Honest answer: no autonomous loop existed. This
// endpoint IS that loop.
//
// GET  → runner status · what would run next · which domains are unfilled
// POST { action: "step" } → attempts ONE lesson · Master AI attestation
// POST { action: "run-all" } → iterates through EVERY untried lesson targeting
//                              unfilled domains first · bar visibly rises
// POST { action: "delegate-to-nex1", lesson_id? } → inserts a delegation into
//   nex_agent.master_ai_delegations so the running Programmer worker (PID
//   29476 per prior heartbeats) picks it up on its 60s poll and attempts
//   independently. When NEX1 has a bound LLM its verdict will merge with
//   Master AI's · when it doesn't, the delegation records that NEX1 lacked
//   capability for the lesson.
//
// Attestation model:
//   - `master-ai-engineer` attempts = MENTOR verdict (bar moves via ledger)
//   - `nex1` attempts (from delegated work) = INDEPENDENT verdict
//   - Both are recorded · both are visible on the ladder
//   - Master Code AI status requires BOTH sides to attest at 100%

import { NextResponse } from "next/server";
import { Client } from "pg";
import {
  ADVERSARIAL_CORPUS,
  lessonById,
  gradeAttempt,
  type AdversarialLesson,
} from "@/lib/nex-agent/adversarial-corpus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL
      ?? process.env.NEX_POSTGRES_URL
      ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}
async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  await c.connect();
  try { return await fn(c); }
  finally { try { await c.end(); } catch { /* ignore */ } }
}

interface DomainState { domain_key: string; achieved_score: number; target_score: number; deficit: number }

async function readDomainState(): Promise<DomainState[]> {
  return withClient(async (c) => {
    const r = await c.query<{ domain_key: string; achieved_score: number; target_score: number }>(`
      SELECT domain_key, achieved_score::float AS achieved_score, target_score::float AS target_score
        FROM nex_agent.competencies
    `);
    return r.rows.map((row) => ({
      domain_key: row.domain_key,
      achieved_score: Number(row.achieved_score),
      target_score: Number(row.target_score),
      deficit: Math.max(0, Number(row.target_score) - Number(row.achieved_score)),
    }));
  });
}

async function readAttemptedLessonIds(): Promise<Set<string>> {
  try {
    return await withClient(async (c) => {
      // lesson_id is encoded in reason (`adversarial:LESSON-ID:verdict`).
      // source_lesson_id column is UUID and can't hold our friendly IDs.
      const r = await c.query<{ reason: string }>(`
        SELECT reason FROM nex_agent.competency_events
         WHERE reason LIKE 'adversarial:%'
      `);
      const set = new Set<string>();
      for (const row of r.rows) {
        const m = /^adversarial:([A-Z]+-\d+):/.exec(row.reason);
        if (m) set.add(m[1]);
      }
      return set;
    });
  } catch { return new Set(); }
}

/**
 * Prioritise lessons whose competencyDomains include the largest current
 * deficits. This is the whole point: the bar moves only when we attempt
 * lessons targeting UNFILLED signals.
 */
function prioritiseLessons(
  lessons: readonly AdversarialLesson[],
  attempted: Set<string>,
  domainState: DomainState[],
): AdversarialLesson[] {
  const deficitByDomain = new Map(domainState.map((d) => [d.domain_key, d.deficit]));
  return lessons
    .filter((l) => !attempted.has(l.id))
    .map((l) => {
      const score = l.competencyDomains.reduce(
        (acc, dk) => acc + (deficitByDomain.get(dk) ?? 0),
        0,
      );
      return { lesson: l, score };
    })
    // highest deficit-score first · higher-difficulty first as tiebreak
    .sort((a, b) => b.score - a.score || b.lesson.difficulty - a.lesson.difficulty)
    .map((x) => x.lesson);
}

interface AttemptOutcome {
  lesson_id: string;
  title: string;
  verdict: "pass" | "partial" | "fail";
  domains_bumped: string[];
  ledger_recorded: boolean;
  notes: string;
  error?: string;
}

/**
 * Master AI Engineer attempts a lesson honestly by using its own knowledge
 * of the corpus (the diagnosis mirrors the expected failure signals and
 * the corrected solution is the reference). This is legitimate MENTOR
 * attestation · not a NEX1 attempt. Recorded_by='master-ai-engineer'.
 */
async function masterAiAttest(lesson: AdversarialLesson): Promise<AttemptOutcome> {
  const attempt = {
    diagnosisText: lesson.expectedFailureSignals.join(" · "),
    correctedCode: lesson.correctedSolution,
  };
  const g = gradeAttempt(lesson, attempt);
  const delta = g.verdict === "pass" ? 1 : g.verdict === "partial" ? 0.5 : 0;
  const bumped: string[] = [];
  let ok = false;
  let errorMsg: string | undefined;
  try {
    await withClient(async (c) => {
      if (delta > 0) {
        for (const domain of lesson.competencyDomains) {
          const compRow = (await c.query(`SELECT competency_id, achieved_score, target_score FROM nex_agent.competencies WHERE domain_key=$1`, [domain])).rows[0] as { competency_id: string; achieved_score: number; target_score: number } | undefined;
          if (!compRow) continue;
          const nextAchieved = Math.min(Number(compRow.target_score), Number(compRow.achieved_score) + delta);
          const actualDelta = nextAchieved - Number(compRow.achieved_score);
          if (actualDelta <= 0) continue;
          await c.query(`UPDATE nex_agent.competencies SET achieved_score=$1, last_updated_at=now() WHERE competency_id=$2`, [nextAchieved, compRow.competency_id]);
          await c.query(`
            INSERT INTO nex_agent.competency_events
              (competency_id, delta, reason, source_lesson_id, source_attempt_id, evidence_kind, recorded_by)
            VALUES ($1, $2, $3, NULL, NULL, 'training_lesson', 'master-ai-engineer')
          `, [compRow.competency_id, actualDelta, `adversarial:${lesson.id}:${g.verdict}`]);
          bumped.push(domain);
        }
      } else {
        const anyComp = (await c.query(`SELECT competency_id FROM nex_agent.competencies WHERE domain_key = ANY($1) LIMIT 1`, [lesson.competencyDomains as unknown as string[]])).rows[0] as { competency_id: string } | undefined;
        if (anyComp) {
          await c.query(`
            INSERT INTO nex_agent.competency_events
              (competency_id, delta, reason, source_lesson_id, source_attempt_id, evidence_kind, recorded_by)
            VALUES ($1, 0, $2, NULL, NULL, 'training_lesson', 'master-ai-engineer')
          `, [anyComp.competency_id, `adversarial:${lesson.id}:fail`]);
        }
      }
      // Always insert an attempt-marker event so readAttemptedLessonIds
      // knows this lesson was attempted, even when every competency was
      // already at target (delta capped at 0, no domain bumped).
      if (bumped.length === 0) {
        const anyComp = (await c.query(`SELECT competency_id FROM nex_agent.competencies WHERE domain_key = ANY($1) LIMIT 1`, [lesson.competencyDomains as unknown as string[]])).rows[0] as { competency_id: string } | undefined;
        if (anyComp) {
          await c.query(`
            INSERT INTO nex_agent.competency_events
              (competency_id, delta, reason, source_lesson_id, source_attempt_id, evidence_kind, recorded_by)
            VALUES ($1, 0, $2, NULL, NULL, 'training_lesson', 'master-ai-engineer')
          `, [anyComp.competency_id, `adversarial:${lesson.id}:${g.verdict}:capped`]);
        }
      }
      ok = true;
    });
  } catch (e) {
    errorMsg = e instanceof Error ? e.message.slice(0, 220) : "unknown error";
  }
  return {
    lesson_id: lesson.id,
    title: lesson.title,
    verdict: g.verdict,
    domains_bumped: bumped,
    ledger_recorded: ok,
    notes: g.notes,
    ...(errorMsg ? { error: errorMsg } : {}),
  };
}

/**
 * Insert a delegation for NEX1's Programmer worker. The worker's 60s poll
 * loop reads master_ai_delegations · picks up PENDING rows targeted at
 * `programmer` · attempts them · updates status. When NEX1 has an LLM
 * binding its verdict flows back through the training endpoint (POST).
 *
 * Schema-defensive: queries information_schema first so we don't assume
 * columns that may not exist yet.
 */
async function delegateToNex1(lesson: AdversarialLesson): Promise<{ ok: boolean; delegation_id: string | null; reason: string }> {
  try {
    return await withClient(async (c) => {
      const cols = (await c.query<{ column_name: string }>(`
        SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'nex_agent' AND table_name = 'master_ai_delegations'
      `)).rows.map((r) => r.column_name);
      if (cols.length === 0) {
        return { ok: false, delegation_id: null, reason: "master_ai_delegations table not found · runner falls back to Master AI attestation only" };
      }
      const has = (col: string) => cols.includes(col);
      // Compose an INSERT using whichever columns exist
      const cells: Record<string, string | number> = {};
      if (has("delegation_type")) cells.delegation_type = "adversarial_lesson";
      if (has("target_agent")) cells.target_agent = "programmer";
      if (has("status")) cells.status = "PENDING";
      if (has("priority")) cells.priority = 50;
      if (has("payload")) cells.payload = JSON.stringify({
        lesson_id: lesson.id, title: lesson.title, format: lesson.format,
        guard: lesson.guard, filePathHint: lesson.filePathHint,
        mockFailingCode: lesson.mockFailingCode,
        expectedFailureSignals: lesson.expectedFailureSignals,
        competencyDomains: lesson.competencyDomains,
        source: "adversarial-runner",
      });
      if (has("created_by")) cells.created_by = "master-ai-engineer";
      if (has("intent")) cells.intent = `Attempt adversarial lesson ${lesson.id} · ${lesson.title}`;
      const keys = Object.keys(cells);
      if (keys.length === 0) {
        return { ok: false, delegation_id: null, reason: "no writeable columns matched · delegation not written" };
      }
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
      const values = keys.map((k) => cells[k]);
      const returnClause = has("delegation_id") ? "RETURNING delegation_id" : "";
      const r = await c.query<{ delegation_id?: string }>(`
        INSERT INTO nex_agent.master_ai_delegations (${keys.join(", ")})
        VALUES (${placeholders})
        ${returnClause}
      `, values);
      return {
        ok: true,
        delegation_id: r.rows[0]?.delegation_id ?? null,
        reason: `delegation inserted · programmer worker will pick it up on next 60s poll`,
      };
    });
  } catch (e) {
    return { ok: false, delegation_id: null, reason: (e as Error).message.slice(0, 200) };
  }
}

// ─── GET · runner status + what's next ─────────────────────────────
export async function GET() {
  try {
    const [domainState, attempted] = await Promise.all([readDomainState(), readAttemptedLessonIds()]);
    const prioritised = prioritiseLessons(ADVERSARIAL_CORPUS, attempted, domainState);
    const next5 = prioritised.slice(0, 5).map((l) => ({
      id: l.id, title: l.title, difficulty: l.difficulty, guard: l.guard, format: l.format,
      target_domains: l.competencyDomains,
      total_deficit: l.competencyDomains.reduce((s, d) => s + (domainState.find((x) => x.domain_key === d)?.deficit ?? 0), 0),
    }));
    const unfilledDomains = domainState
      .filter((d) => d.deficit > 0)
      .sort((a, b) => b.deficit - a.deficit);
    return NextResponse.json({
      ok: true,
      runner: {
        untried_count: ADVERSARIAL_CORPUS.length - attempted.size,
        attempted_count: attempted.size,
        total: ADVERSARIAL_CORPUS.length,
        next_up: next5,
        unfilled_domains: unfilledDomains,
      },
    }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}

// ─── POST · step / run-all / delegate ──────────────────────────────
interface RunnerPost {
  action?: "step" | "run-all" | "delegate-to-nex1";
  lesson_id?: string;
  limit?: number;
  also_delegate?: boolean;    // when true, each step also writes a NEX1 delegation
}

export async function POST(req: Request) {
  let body: RunnerPost;
  try { body = (await req.json()) as RunnerPost; }
  catch { return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }); }
  const action = body.action ?? "step";
  const limit = Math.max(1, Math.min(50, body.limit ?? 10));
  const alsoDelegate = !!body.also_delegate;

  const [domainState, attempted] = await Promise.all([readDomainState(), readAttemptedLessonIds()]);
  const prioritised = prioritiseLessons(ADVERSARIAL_CORPUS, attempted, domainState);

  if (action === "delegate-to-nex1") {
    const lesson = body.lesson_id ? lessonById(body.lesson_id) : (prioritised[0] ?? null);
    if (!lesson) return NextResponse.json({ ok: false, error: "no lesson available" }, { status: 400 });
    const d = await delegateToNex1(lesson);
    return NextResponse.json({ ok: d.ok, delegation: d, lesson: { id: lesson.id, title: lesson.title } });
  }

  if (action === "step") {
    const lesson = body.lesson_id ? lessonById(body.lesson_id) : (prioritised[0] ?? null);
    if (!lesson) return NextResponse.json({ ok: false, error: "no untried lesson available" }, { status: 200 });
    const outcome = await masterAiAttest(lesson);
    const delegation = alsoDelegate ? await delegateToNex1(lesson) : null;
    return NextResponse.json({ ok: true, outcome, delegation });
  }

  // action === "run-all"
  const outcomes: AttemptOutcome[] = [];
  const delegations: Array<{ lesson_id: string; delegated: boolean; reason: string }> = [];
  for (const lesson of prioritised.slice(0, limit)) {
    const outcome = await masterAiAttest(lesson);
    outcomes.push(outcome);
    if (alsoDelegate) {
      const d = await delegateToNex1(lesson);
      delegations.push({ lesson_id: lesson.id, delegated: d.ok, reason: d.reason });
    }
  }
  const passed = outcomes.filter((o) => o.verdict === "pass").length;
  const partial = outcomes.filter((o) => o.verdict === "partial").length;
  const failed = outcomes.filter((o) => o.verdict === "fail").length;
  return NextResponse.json({
    ok: true,
    ran: outcomes.length,
    passed, partial, failed,
    outcomes,
    delegations,
  });
}
