// src/app/api/nex/agent/capability/live/route.ts
//
// NEX1 · MASTER CODE AGENT · live-activity endpoint.
//
// Returns everything the Capability Ladder needs to show real-time evidence:
//   · recent competency events (bar movements · last 10)
//   · recent tasks (what NEX1 has actually been coding · last 5)
//   · speed metrics (tasks/24h · median time-to-apply · verified-apply streak)
//   · top skills from learning-ledger.ts (bronze/silver/gold/mythic)
//   · weekly digest grade (A+/A/B/C)
//
// Reads only. Never writes. Every value comes from durable state (Postgres +
// data/nex1-learning/ledger.json). Founder's rule: evidence over confidence.

import { NextResponse } from "next/server";
import { Client } from "pg";
import { loadLedger, computeWeeklyDigest, type SkillEntry } from "@/lib/nex-agent/learning-ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL
      ?? process.env.NEX_POSTGRES_URL
      ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}

interface RecentEvent {
  recorded_at: string;
  domain_key: string | null;
  domain_label: string | null;
  delta: number;
  reason: string;
  evidence_kind: string | null;
  recorded_by: string;
}
interface RecentTask {
  task_id: string;
  submitted_at: string;
  updated_at: string;
  status: string;
  prompt_preview: string;
  submitted_by: string;
}
interface SpeedMetrics {
  tasks_per_24h: number;
  applied_per_24h: number;
  median_time_to_apply_ms: number | null;
  verified_apply_streak: number;
  last_verified_apply_at: string | null;
  regression_free_streak: number;
}
interface LatestVerdict {
  task_id: string | null;
  status: string | null;
  guardian_verdict: "ACCEPT" | "REJECT" | "PENDING" | null;
  ui_dna_verdict: "PASS" | "FAIL" | "PENDING" | null;
  security_verdict: "PASS" | "FAIL" | "PENDING" | null;
  tests_passed: number | null;
  tests_total: number | null;
  self_repair_cycles: number;
  last_step_kind: string | null;
  last_step_at: string | null;
}
interface ActivityState {
  state: "active" | "idle" | "stopped" | "no-data";
  last_step_seconds_ago: number | null;
  active_agent: string | null;
}
interface LivePayload {
  recent_events: RecentEvent[];
  recent_tasks: RecentTask[];
  speed: SpeedMetrics;
  top_skills: SkillEntry[];
  weekly_grade: "A+" | "A" | "B" | "C" | "no-data";
  weekly_reason: string;
  data_source: "postgres+ledger" | "ledger_only" | "empty";
  latest_verdict: LatestVerdict;
  activity: ActivityState;
  self_repair_cycles_24h: number;
}

const EMPTY_LIVE: LivePayload = {
  recent_events: [],
  recent_tasks: [],
  speed: {
    tasks_per_24h: 0,
    applied_per_24h: 0,
    median_time_to_apply_ms: null,
    verified_apply_streak: 0,
    last_verified_apply_at: null,
    regression_free_streak: 0,
  },
  top_skills: [],
  weekly_grade: "no-data",
  weekly_reason: "no activity data yet",
  data_source: "empty",
  latest_verdict: {
    task_id: null, status: null,
    guardian_verdict: null, ui_dna_verdict: null, security_verdict: null,
    tests_passed: null, tests_total: null,
    self_repair_cycles: 0, last_step_kind: null, last_step_at: null,
  },
  activity: { state: "no-data", last_step_seconds_ago: null, active_agent: null },
  self_repair_cycles_24h: 0,
};

const SKILL_ORDER = { mythic: 4, gold: 3, silver: 2, bronze: 1 } as const;

function loadTopSkills(): SkillEntry[] {
  const ledger = loadLedger();
  const skills = Object.values(ledger.skills);
  skills.sort((a, b) => {
    const la = SKILL_ORDER[a.level] ?? 0;
    const lb = SKILL_ORDER[b.level] ?? 0;
    if (lb !== la) return lb - la;
    if (b.xp !== a.xp) return b.xp - a.xp;
    return b.successes - a.successes;
  });
  return skills.slice(0, 8);
}

function weeklyGrade(): { grade: LivePayload["weekly_grade"]; reason: string } {
  const ledger = loadLedger();
  const d = computeWeeklyDigest(ledger);
  return { grade: d.grade, reason: d.reasoning };
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

export async function GET() {
  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  const topSkills = loadTopSkills();
  const wk = weeklyGrade();
  try {
    await c.connect();

    const events = (await c.query<RecentEvent>(`
      SELECT ev.recorded_at::text,
             cp.domain_key,
             cp.domain_label,
             ev.delta::float AS delta,
             ev.reason,
             ev.evidence_kind,
             ev.recorded_by
        FROM nex_agent.competency_events ev
        LEFT JOIN nex_agent.competencies cp ON cp.competency_id = ev.competency_id
       ORDER BY ev.recorded_at DESC
       LIMIT 10
    `)).rows;

    const tasks = (await c.query<RecentTask>(`
      SELECT task_id,
             submitted_at::text,
             updated_at::text,
             status,
             submitted_by,
             substr(prompt, 1, 160) AS prompt_preview
        FROM nex_agent.tasks
       ORDER BY submitted_at DESC
       LIMIT 5
    `)).rows;

    // Speed: task creation vs first "applied" step
    const speedRows = (await c.query<{ ms: number }>(`
      SELECT EXTRACT(EPOCH FROM (t.updated_at - t.submitted_at))::float * 1000 AS ms
        FROM nex_agent.tasks t
       WHERE t.status IN ('applied_verified','migration_applied','shipped')
         AND t.updated_at > now() - interval '30 days'
       ORDER BY t.updated_at DESC
       LIMIT 50
    `)).rows;
    const medMs = median(speedRows.map((r) => Math.round(r.ms)));

    const t24 = Number((await c.query(`SELECT count(*)::int c FROM nex_agent.tasks WHERE submitted_at > now() - interval '24 hours'`)).rows[0].c);
    const a24 = Number((await c.query(`SELECT count(*)::int c FROM nex_agent.tasks WHERE status IN ('applied_verified','migration_applied','shipped') AND updated_at > now() - interval '24 hours'`)).rows[0].c);

    // Verified-apply streak: how many consecutive most-recent tasks completed cleanly
    const streakRows = (await c.query<{ status: string; updated_at: string }>(`
      SELECT status, updated_at::text FROM nex_agent.tasks
       WHERE status NOT IN ('submitted','plan_ready','plan_approved')
       ORDER BY updated_at DESC LIMIT 20
    `)).rows;
    let streak = 0;
    for (const r of streakRows) {
      if (["applied_verified", "migration_applied", "shipped"].includes(r.status)) streak++;
      else break;
    }

    // Regression-free streak: consecutive most-recent applied tasks without an intervening rejection
    let regFree = 0;
    for (const r of streakRows) {
      if (["applied_verified", "migration_applied", "shipped"].includes(r.status)) regFree++;
      else if (["plan_rejected", "migration_failed"].includes(r.status)) break;
    }

    const lastVerified = streakRows.find((r) => ["applied_verified", "migration_applied", "shipped"].includes(r.status));

    // Latest attempt verdict · reads most recent task + its steps
    const latestTask = tasks[0];
    let latestVerdict: LatestVerdict = {
      task_id: null, status: null,
      guardian_verdict: null, ui_dna_verdict: null, security_verdict: null,
      tests_passed: null, tests_total: null,
      self_repair_cycles: 0, last_step_kind: null, last_step_at: null,
    };
    if (latestTask) {
      const stepsResult = await c.query<{ step_kind: string; body: unknown; actor: string; created_at: string }>(`
        SELECT step_kind, body, actor, created_at::text
          FROM nex_agent.task_steps
         WHERE task_id = $1
         ORDER BY created_at DESC
      `, [latestTask.task_id]);
      const steps = stepsResult.rows;
      const lastStep = steps[0];
      const findByKind = (k: string) => steps.find((s) => s.step_kind === k);
      const guardianStep = findByKind("guardian_verdict") ?? findByKind("guardian");
      const uiDnaStep = findByKind("ui_dna_verdict") ?? findByKind("ui_dna");
      const secStep = findByKind("security_verdict") ?? findByKind("security");
      const testStep = findByKind("test_result") ?? findByKind("tests");
      const selfRepair = steps.filter((s) => s.step_kind === "self_repair" || s.step_kind === "auto_correct").length;
      const readVerdict = (v: unknown): "ACCEPT" | "REJECT" | "PENDING" | null => {
        if (!v || typeof v !== "object") return null;
        const val = (v as { verdict?: string }).verdict;
        if (val === "ACCEPT" || val === "REJECT" || val === "PENDING") return val;
        return null;
      };
      const readPassFail = (v: unknown): "PASS" | "FAIL" | "PENDING" | null => {
        if (!v || typeof v !== "object") return null;
        const val = (v as { verdict?: string }).verdict;
        if (val === "PASS" || val === "FAIL" || val === "PENDING") return val;
        return null;
      };
      let testsPassed: number | null = null;
      let testsTotal: number | null = null;
      if (testStep && typeof testStep.body === "object" && testStep.body) {
        const tb = testStep.body as { passed?: number; total?: number };
        if (typeof tb.passed === "number") testsPassed = tb.passed;
        if (typeof tb.total === "number") testsTotal = tb.total;
      }
      latestVerdict = {
        task_id: latestTask.task_id,
        status: latestTask.status,
        guardian_verdict: guardianStep ? readVerdict(guardianStep.body) : null,
        ui_dna_verdict: uiDnaStep ? readPassFail(uiDnaStep.body) : null,
        security_verdict: secStep ? readPassFail(secStep.body) : null,
        tests_passed: testsPassed,
        tests_total: testsTotal,
        self_repair_cycles: selfRepair,
        last_step_kind: lastStep?.step_kind ?? null,
        last_step_at: lastStep?.created_at ?? null,
      };
    }

    // Live activity state · derived from most recent task_step timestamp anywhere
    const anyStepResult = await c.query<{ created_at: string; actor: string }>(`
      SELECT created_at::text, actor
        FROM nex_agent.task_steps
       ORDER BY created_at DESC
       LIMIT 1
    `);
    let activity: ActivityState = { state: "no-data", last_step_seconds_ago: null, active_agent: null };
    if (anyStepResult.rows[0]) {
      const row = anyStepResult.rows[0];
      const secondsAgo = Math.max(0, Math.floor((Date.now() - new Date(row.created_at).getTime()) / 1000));
      const state: ActivityState["state"] = secondsAgo < 60 ? "active" : secondsAgo < 1800 ? "idle" : "stopped";
      activity = { state, last_step_seconds_ago: secondsAgo, active_agent: row.actor };
    }

    // Self-repair cycles in last 24h · positive evidence per founder rule
    const selfRepair24h = Number((await c.query(`
      SELECT count(*)::int c FROM nex_agent.task_steps
       WHERE step_kind IN ('self_repair','auto_correct') AND created_at > now() - interval '24 hours'
    `)).rows[0].c);

    const live: LivePayload = {
      recent_events: events,
      recent_tasks: tasks,
      speed: {
        tasks_per_24h: t24,
        applied_per_24h: a24,
        median_time_to_apply_ms: medMs,
        verified_apply_streak: streak,
        regression_free_streak: regFree,
        last_verified_apply_at: lastVerified?.updated_at ?? null,
      },
      top_skills: topSkills,
      weekly_grade: wk.grade,
      weekly_reason: wk.reason,
      data_source: "postgres+ledger",
      latest_verdict: latestVerdict,
      activity,
      self_repair_cycles_24h: selfRepair24h,
    };
    return NextResponse.json({ ok: true, live }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    // Degrade gracefully · ledger-only payload
    return NextResponse.json({
      ok: false,
      error: (err as Error).message.slice(0, 200),
      live: {
        ...EMPTY_LIVE,
        top_skills: topSkills,
        weekly_grade: wk.grade,
        weekly_reason: wk.reason,
        data_source: topSkills.length > 0 ? "ledger_only" : "empty",
      },
    }, { status: 200 });
  } finally {
    try { await c.end(); } catch { /* ignore */ }
  }
}
