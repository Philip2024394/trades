// src/app/api/nex/lcc/observatory/route.ts
//
// Founder BEGIN Phase 2 · Live Chat Completion Observatory.
//
// Read-only aggregation over the knowledge factory tables. Feeds the future
// NEX HQ dashboard page. Returns per-category scorecard, worker health,
// gap depth, and top open gap intents.
//
// Zero LLM. Deterministic. Fast (single-digit ms once warm).

import { NextResponse } from "next/server";
import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";
import { ACTIVE_CATEGORIES } from "@/lib/nex/live-chat-completion/contract";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STALE_HEARTBEAT_MS = 90_000; // >90s stale ⇒ worker degraded

export async function GET() {
  const started = Date.now();
  try {
    const pool = getKnowledgeFactoryDbPool();

    // Per-category scorecard aggregation.
    const perCat = await pool.query(
      `SELECT
         q.domain,
         (SELECT COUNT(*)::int FROM nex.entity_index e WHERE e.domain = q.domain) AS entities,
         COUNT(*)::int AS question_variants,
         COUNT(*) FILTER (WHERE q.answer_status = 'candidate')::int AS candidate,
         COUNT(*) FILTER (WHERE q.answer_status = 'answered')::int AS answered,
         COUNT(*) FILTER (WHERE q.answer_status = 'partially_answered')::int AS partially_answered,
         COUNT(*) FILTER (WHERE q.answer_status = 'unknown')::int AS unknown_count,
         COUNT(*) FILTER (WHERE q.answer_status = 'conflicting')::int AS conflicting,
         COUNT(*) FILTER (WHERE q.answer_status = 'stale')::int AS stale,
         AVG(q.verification_latency_ms)::int AS avg_verify_ms
       FROM nex.question_variant q
       GROUP BY q.domain`,
    );
    const byDomain = new Map<string, Record<string, unknown>>();
    for (const row of perCat.rows) byDomain.set(String(row.domain), row);

    // Open gaps by domain.
    const gapCounts = await pool.query(
      `SELECT domain, COUNT(*)::int AS open, SUM(times_seen)::int AS demand
         FROM nex.knowledge_gap
         WHERE resolved_at IS NULL
         GROUP BY domain`,
    );
    const gapByDomain = new Map<string, { open: number; demand: number }>();
    for (const g of gapCounts.rows) gapByDomain.set(String(g.domain), { open: Number(g.open), demand: Number(g.demand) });

    // Rulebook targets.
    const rulebooks = await pool.query(
      `SELECT domain, question_variant_target FROM nex.master_rulebook`,
    );
    const targetByDomain = new Map<string, number>();
    for (const r of rulebooks.rows) targetByDomain.set(String(r.domain), Number(r.question_variant_target));

    // Assemble per-category scorecards. Include categories with 0 rows.
    const categories = ACTIVE_CATEGORIES.map((domain) => {
      const cat = byDomain.get(domain);
      const g = gapByDomain.get(domain) ?? { open: 0, demand: 0 };
      const target = targetByDomain.get(domain) ?? 1_000_000;
      const qv = cat ? Number(cat.question_variants) : 0;
      const answered = cat ? Number(cat.answered) : 0;
      const coverage_pct = target > 0 ? (qv / target) * 100 : 0;
      const answered_pct = qv > 0 ? (answered / qv) * 100 : 0;
      return {
        domain,
        entities: cat ? Number(cat.entities) : 0,
        question_variants: qv,
        candidate: cat ? Number(cat.candidate) : 0,
        answered,
        partially_answered: cat ? Number(cat.partially_answered) : 0,
        unknown: cat ? Number(cat.unknown_count) : 0,
        conflicting: cat ? Number(cat.conflicting) : 0,
        stale: cat ? Number(cat.stale) : 0,
        open_gaps: g.open,
        gap_demand_sum: g.demand,
        question_variant_target: target,
        coverage_pct: Math.round(coverage_pct * 10000) / 10000,
        answered_pct: Math.round(answered_pct * 100) / 100,
        avg_verify_ms: cat ? Number(cat.avg_verify_ms) : null,
      };
    });

    // Worker health.
    const workers = await pool.query(
      `SELECT worker_id, domain, worker_kind, state, current_task,
              last_success_at, last_failure_at, last_error,
              tasks_completed, tasks_failed, queue_depth, updated_at
         FROM nex.kf_worker_heartbeat
         ORDER BY updated_at DESC`,
    );
    const now = Date.now();
    const workerRows = workers.rows.map((w) => {
      const updatedAtMs = w.updated_at instanceof Date ? w.updated_at.getTime() : new Date(String(w.updated_at)).getTime();
      const stale_ms = now - updatedAtMs;
      return {
        worker_id: String(w.worker_id),
        domain: String(w.domain),
        worker_kind: String(w.worker_kind),
        reported_state: String(w.state),
        heartbeat_stale_ms: stale_ms,
        // Real state — supervisor doesn't trust reported_state alone.
        supervised_state: stale_ms > STALE_HEARTBEAT_MS ? "STALE" : String(w.state),
        current_task: w.current_task ? String(w.current_task) : null,
        last_success_at: w.last_success_at ? new Date(String(w.last_success_at)).toISOString() : null,
        last_failure_at: w.last_failure_at ? new Date(String(w.last_failure_at)).toISOString() : null,
        last_error: w.last_error ? String(w.last_error) : null,
        tasks_completed: Number(w.tasks_completed),
        tasks_failed: Number(w.tasks_failed),
        queue_depth: Number(w.queue_depth),
        updated_at: new Date(updatedAtMs).toISOString(),
      };
    });

    // Top open gap intents per category.
    const topGaps = await pool.query(
      `SELECT domain, intent_slug, COUNT(*)::int AS gaps, SUM(times_seen)::int AS demand
         FROM nex.knowledge_gap
         WHERE resolved_at IS NULL
         GROUP BY domain, intent_slug
         ORDER BY demand DESC
         LIMIT 40`,
    );

    // Founder BEGIN Phase 3.2 · Truth Engine observability.
    // Open fact conflicts per domain.
    let conflictsByDomain: Record<string, { open: number; total_seen: number }> = {};
    try {
      const c = await pool.query(
        `SELECT domain,
                COUNT(*) FILTER (WHERE resolved_at IS NULL)::int AS open,
                COUNT(*)::int AS total
           FROM nex.fact_conflict GROUP BY domain`,
      );
      conflictsByDomain = Object.fromEntries(
        c.rows.map((r) => [String(r.domain), { open: Number(r.open), total_seen: Number(r.total) }]),
      );
    } catch { /* table may not exist yet in some envs */ }

    // Retrieval hit distribution (last hour sample).
    let retrievalByLevel: Record<string, { total: number; matched: number; avg_ms: number }> = {};
    try {
      const r = await pool.query(
        `SELECT level,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE matched)::int AS matched,
                AVG(latency_ms)::int AS avg_ms
           FROM nex.retrieval_hit
           WHERE recorded_at > now() - interval '1 hour'
           GROUP BY level`,
      );
      retrievalByLevel = Object.fromEntries(
        r.rows.map((row) => [String(row.level), { total: Number(row.total), matched: Number(row.matched), avg_ms: Number(row.avg_ms) }]),
      );
    } catch { /* table may not exist yet */ }

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      latency_ms: Date.now() - started,
      categories,
      workers: workerRows,
      top_gap_intents: topGaps.rows.map((r) => ({
        domain: String(r.domain),
        intent_slug: String(r.intent_slug),
        gaps: Number(r.gaps),
        demand: Number(r.demand),
      })),
      // Founder BEGIN Phase 3.2 · Truth + Retrieval observability
      fact_conflicts_by_domain: conflictsByDomain,
      retrieval_by_level_last_hour: retrievalByLevel,
      instrument_version: "lcc-observatory-v2-truth-retrieval-2026-09-09",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e), latency_ms: Date.now() - started },
      { status: 500 },
    );
  }
}
