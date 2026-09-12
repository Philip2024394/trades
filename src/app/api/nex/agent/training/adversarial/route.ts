// src/app/api/nex/agent/training/adversarial/route.ts
//
// NEX1 · Adversarial Training endpoint.
//
// GET  → list the whole corpus + summary stats (used by the workstation UI)
// GET  ?id=HK-01 → return a single lesson (for NEX1 to attempt)
// POST → submit NEX1's attempt · grade it · record the outcome as a competency
//        event (bumps the Capability Ladder when passed · records anti-pattern
//        when failed so NEX1 doesn't repeat the mistake).

import { NextResponse } from "next/server";
import { Client } from "pg";
import {
  ADVERSARIAL_CORPUS,
  corpusStats,
  lessonById,
  gradeAttempt,
  type AdversarialLesson,
} from "@/lib/nex-agent/adversarial-corpus";
import {
  loadLedger,
  recordSkillSuccess,
  recordSkillFailure,
  recordAntiPattern,
  recordPattern,
  saveLedger,
} from "@/lib/nex-agent/learning-ledger";
import { createHash } from "node:crypto";

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

interface AttemptHistoryRow {
  lesson_id: string;
  verdict: "pass" | "partial" | "fail";
  recorded_at: string;
  attempts: number;
}

async function loadAttemptHistory(): Promise<AttemptHistoryRow[]> {
  try {
    return await withClient(async (c) => {
      // Reads competency_events + parses reason for adversarial:LESSON-ID marker
      const r = await c.query<{ reason: string; recorded_at: string }>(`
        SELECT reason, recorded_at::text
          FROM nex_agent.competency_events
         WHERE reason LIKE 'adversarial:%'
         ORDER BY recorded_at DESC
      `);
      // reason format: `adversarial:LESSON-ID:verdict`
      const byLesson = new Map<string, AttemptHistoryRow>();
      for (const row of r.rows) {
        const m = /^adversarial:([A-Z]+-\d+):(pass|partial|fail)/.exec(row.reason);
        if (!m) continue;
        const [, id, verdict] = m;
        const existing = byLesson.get(id);
        if (existing) {
          existing.attempts += 1;
        } else {
          byLesson.set(id, {
            lesson_id: id,
            verdict: verdict as "pass" | "partial" | "fail",
            recorded_at: row.recorded_at,
            attempts: 1,
          });
        }
      }
      return Array.from(byLesson.values());
    });
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (id) {
    const lesson = lessonById(id);
    if (!lesson) return NextResponse.json({ ok: false, error: `lesson ${id} not found` }, { status: 404 });
    return NextResponse.json({ ok: true, lesson }, { headers: { "cache-control": "no-store" } });
  }

  const stats = corpusStats();
  const history = await loadAttemptHistory();
  const passed = history.filter((h) => h.verdict === "pass").length;
  const partial = history.filter((h) => h.verdict === "partial").length;
  const failed = history.filter((h) => h.verdict === "fail").length;
  const untried = ADVERSARIAL_CORPUS
    .filter((l) => !history.some((h) => h.lesson_id === l.id))
    .map((l) => ({ id: l.id, title: l.title, difficulty: l.difficulty, guard: l.guard, format: l.format }));

  return NextResponse.json({
    ok: true,
    corpus: {
      stats,
      history,
      summary: {
        total: ADVERSARIAL_CORPUS.length,
        passed,
        partial,
        failed,
        untried: untried.length,
        pass_rate_pct: history.length === 0 ? 0 : Math.round((passed / history.length) * 100),
      },
      untried_next_up: untried.slice(0, 5),
      lessons: ADVERSARIAL_CORPUS.map((l) => ({
        id: l.id, title: l.title, category: l.category,
        format: l.format, difficulty: l.difficulty, guard: l.guard,
        filePathHint: l.filePathHint, competencyDomains: l.competencyDomains,
      })),
    },
  }, { headers: { "cache-control": "no-store" } });
}

interface AttemptBody {
  lesson_id?: string;
  diagnosis?: string;
  corrected_code?: string;
  attempted_by?: string;
}

export async function POST(req: Request) {
  let body: AttemptBody;
  try { body = (await req.json()) as AttemptBody; }
  catch { return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }); }

  if (!body.lesson_id) return NextResponse.json({ ok: false, error: "lesson_id required" }, { status: 400 });
  const lesson = lessonById(body.lesson_id);
  if (!lesson) return NextResponse.json({ ok: false, error: `lesson ${body.lesson_id} not found` }, { status: 404 });

  const attempt = {
    diagnosisText: body.diagnosis ?? "",
    correctedCode: body.corrected_code ?? "",
  };
  const grade = gradeAttempt(lesson, attempt);
  const attemptedBy = body.attempted_by ?? "nex1";

  // Learning ledger side · records skill exercise + pattern/anti-pattern
  try {
    let ledger = loadLedger();
    const primarySkill = `${lesson.guard}:${lesson.format}`;
    if (grade.verdict === "pass") {
      ledger = recordSkillSuccess(ledger, primarySkill, 6);
      ledger = recordPattern(ledger, {
        id: createHash("sha256").update(`${lesson.id}:${attempt.correctedCode}`).digest("hex").slice(0, 16),
        title: `Passed adversarial ${lesson.id} · ${lesson.title}`,
        skills: [primarySkill, ...lesson.competencyDomains],
        capturedAt: new Date().toISOString(),
        taskId: `adversarial:${lesson.id}`,
      });
    } else if (grade.verdict === "partial") {
      ledger = recordSkillSuccess(ledger, primarySkill, 2);
    } else {
      ledger = recordSkillFailure(ledger, primarySkill, 4);
      ledger = recordAntiPattern(ledger, {
        id: createHash("sha256").update(`${lesson.id}:fail`).digest("hex").slice(0, 16),
        title: `Failed adversarial ${lesson.id} · ${lesson.title}`,
        rejectionCode: `signal_match_${grade.matchedSignals.length}_of_${lesson.expectedFailureSignals.length}`,
        capturedAt: new Date().toISOString(),
        taskId: `adversarial:${lesson.id}`,
      });
    }
    saveLedger(ledger);
  } catch (_e) { /* ledger persistence best-effort */ }

  // Competency-ledger side · records event for the Capability Ladder to consume
  let ledgerRecorded = false;
  try {
    await withClient(async (c) => {
      // Bump competency across each domain the lesson exercises · pass=1 · partial=0.5 · fail=0
      const delta = grade.verdict === "pass" ? 1 : grade.verdict === "partial" ? 0.5 : 0;
      if (delta > 0) {
        for (const domain of lesson.competencyDomains) {
          const comp = (await c.query(`SELECT competency_id, achieved_score, target_score FROM nex_agent.competencies WHERE domain_key=$1`, [domain])).rows[0] as { competency_id: string; achieved_score: number; target_score: number } | undefined;
          if (!comp) continue;
          const nextAchieved = Math.min(Number(comp.target_score), Number(comp.achieved_score) + delta);
          const actualDelta = nextAchieved - Number(comp.achieved_score);
          if (actualDelta <= 0) continue;
          await c.query(`UPDATE nex_agent.competencies SET achieved_score=$1, last_updated_at=now() WHERE competency_id=$2`, [nextAchieved, comp.competency_id]);
          await c.query(`
            INSERT INTO nex_agent.competency_events
              (competency_id, delta, reason, source_lesson_id, source_attempt_id, evidence_kind, recorded_by)
            VALUES ($1, $2, $3, NULL, NULL, 'training_lesson', $4)
          `, [comp.competency_id, actualDelta, `adversarial:${lesson.id}:${grade.verdict}`, attemptedBy]);
        }
      } else {
        // Failure · record the event so the ladder shows the attempt happened
        const anyComp = (await c.query(`SELECT competency_id FROM nex_agent.competencies WHERE domain_key = ANY($1) LIMIT 1`, [lesson.competencyDomains as unknown as string[]])).rows[0] as { competency_id: string } | undefined;
        if (anyComp) {
          await c.query(`
            INSERT INTO nex_agent.competency_events
              (competency_id, delta, reason, source_lesson_id, source_attempt_id, evidence_kind, recorded_by)
            VALUES ($1, 0, $2, NULL, NULL, 'training_lesson', $3)
          `, [anyComp.competency_id, `adversarial:${lesson.id}:fail`, attemptedBy]);
        }
      }
      ledgerRecorded = true;
    });
  } catch (_e) { /* Postgres may be unreachable · ladder degrades gracefully */ }

  // Teaching payload · returned to the caller when the attempt is not a pass
  const teachingPayload = grade.verdict === "pass" ? null : {
    lesson_title: lesson.title,
    teaching: lesson.teaching,
    corrected_solution: lesson.correctedSolution,
    expected_failure_signals: lesson.expectedFailureSignals,
    missed_signals: grade.missedSignals,
    file_path_hint: lesson.filePathHint,
    format: lesson.format,
    guard: lesson.guard,
  };

  return NextResponse.json({
    ok: true,
    grade,
    ledger_recorded: ledgerRecorded,
    teaching: teachingPayload,
  }, { headers: { "cache-control": "no-store" } });
}
