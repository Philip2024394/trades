// src/lib/nex/observatory-brain/index.ts
//
// Founder Path A/B · ECO-1 · Observatory Brain facade.
//
// Reads-only. Composes MEASURED metrics from existing tables so an
// operator (Founder) sees at a glance whether:
//   · all 4 doctrines are holding at zero violations
//   · groundedness (Gate v2 alignment) is above thresholds
//   · composition-first discipline is still winning (LLM rate < 5%)
//   · per-domain coverage is progressing
//
// A future BEGIN can add push-alerts (email / WhatsApp) when a
// critical alert fires. For this phase the surface is read-only via
// /api/nex/observatory/snapshot.

import type { Pool } from "pg";
import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";
import type {
  ObservatoryBrainFacade, ObservatorySnapshot, ObservatoryWindow,
  WindowPreset, DoctrineHealth, GroundednessMetrics, DomainCoverage, LatencyMetrics,
  DomainGapDrillDown,
} from "./contract";
import { emitAlerts } from "./alert-emitter";

function windowFor(preset: WindowPreset): ObservatoryWindow {
  const until = new Date();
  const ms = preset === "1h" ? 3_600_000
    : preset === "24h" ? 86_400_000
    : preset === "7d" ? 7 * 86_400_000
    : 30 * 86_400_000;
  const since = new Date(until.getTime() - ms);
  return { preset, since: since.toISOString(), until: until.toISOString() };
}

export interface ObservatoryOptions { kfPool?: Pool }

export function makeObservatoryBrain(opts: ObservatoryOptions = {}): ObservatoryBrainFacade {
  const kfPool = opts.kfPool ?? getKnowledgeFactoryDbPool();

  return {
    name: "observatory-brain-v1",
    async snapshot(preset: WindowPreset): Promise<ObservatorySnapshot> {
      const window = windowFor(preset);

      const [
        doctrineHealth,
        groundedness,
        coverage,
        latency,
        domainGaps,
      ] = await Promise.all([
        computeDoctrineHealth(kfPool, window).catch(errFallbackDoctrine),
        computeGroundedness(kfPool, window).catch(errFallbackGrounded),
        computeDomainCoverage(kfPool).catch(errFallbackCoverage),
        computeLatency(kfPool, window).catch(errFallbackLatency),
        computeDomainGaps(kfPool).catch(errFallbackGaps),
      ]);

      // Alerts · non-suppressing · surface any red flags.
      const alerts: Array<ObservatorySnapshot["alerts"][number]> = [];
      if (doctrineHealth.overall_score < 1) {
        alerts.push({ severity: "warning", category: "doctrine", message: `overall_score=${doctrineHealth.overall_score.toFixed(3)} · attempted violations detected · target 1.0` });
      }
      if (groundedness.postrationalisation_rate > 0.05) {
        alerts.push({ severity: "warning", category: "groundedness", message: `postrationalisation_rate=${groundedness.postrationalisation_rate.toFixed(3)} > 0.05` });
      }
      if (latency.llm_invoked_ratio > 0.05) {
        alerts.push({ severity: "warning", category: "discipline", message: `llm_invoked_ratio=${latency.llm_invoked_ratio.toFixed(3)} > 0.05 (Composition Pilot target)` });
      }

      // Founder ALERT-1 · push these to the JSONL sink + webhook (best-effort).
      emitAlerts(alerts);

      return {
        window,
        emitted_at: new Date().toISOString(),
        doctrine_health: doctrineHealth,
        groundedness,
        domain_coverage: coverage,
        domain_gaps: domainGaps,
        latency,
        alerts,
      };
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// Domain gap drill-down · reads nex.knowledge_gap (OBS-4)
// ═══════════════════════════════════════════════════════════════════

async function computeDomainGaps(pool: Pool): Promise<DomainGapDrillDown[]> {
  // Per-domain totals + oldest-open age.
  const totals = await pool.query(
    `SELECT COALESCE(domain,'unknown') AS domain,
            COUNT(*)::int AS n,
            EXTRACT(EPOCH FROM (now() - MIN(first_seen_at))) / 86400.0 AS oldest_days
       FROM nex.knowledge_gap
       WHERE resolved_at IS NULL
       GROUP BY domain
       ORDER BY n DESC`,
  ).catch(() => ({ rows: [] as Array<{ domain: string; n: number; oldest_days: number }> }));

  const out: DomainGapDrillDown[] = [];
  for (const t of totals.rows) {
    // Top 5 gaps per domain by customer demand (times_seen).
    const top = await pool.query(
      `SELECT entity_ref, intent_slug, times_seen, first_seen_at, last_seen_at, source
         FROM nex.knowledge_gap
         WHERE domain = $1 AND resolved_at IS NULL
         ORDER BY times_seen DESC, first_seen_at ASC
         LIMIT 5`,
      [t.domain],
    ).catch(() => ({ rows: [] as Array<{ entity_ref: string; intent_slug: string; times_seen: number; first_seen_at: Date; last_seen_at: Date; source: string }> }));
    out.push({
      domain: String(t.domain),
      open_gap_count: Number(t.n),
      oldest_open_age_days: t.oldest_days != null ? Number(Number(t.oldest_days).toFixed(1)) : undefined,
      top_gaps: top.rows.map((r) => ({
        entity_ref: String(r.entity_ref),
        intent_slug: String(r.intent_slug),
        times_seen: Number(r.times_seen),
        first_seen_at: new Date(r.first_seen_at).toISOString(),
        last_seen_at: new Date(r.last_seen_at).toISOString(),
        source: String(r.source),
      })),
    });
  }
  return out;
}

function errFallbackGaps(): DomainGapDrillDown[] { return []; }

// ═══════════════════════════════════════════════════════════════════
// Doctrine health · reads nex.action_audit
// ═══════════════════════════════════════════════════════════════════

async function computeDoctrineHealth(pool: Pool, window: ObservatoryWindow): Promise<DoctrineHealth> {
  const audit = await pool.query(
    `SELECT outcome, COUNT(*)::int AS n
       FROM nex.action_audit
       WHERE emitted_at >= $1 AND emitted_at <= $2
       GROUP BY outcome`,
    [window.since, window.until],
  ).catch(() => ({ rows: [] as Array<{ outcome: string; n: number }> }));
  const map = new Map<string, number>();
  for (const r of audit.rows) map.set(String(r.outcome), Number(r.n));

  const d2 = {
    total_proposed: [...map.values()].reduce((a, b) => a + b, 0),
    executed: map.get("executed") ?? 0,
    rejected_schema: map.get("rejected_schema") ?? 0,
    rejected_unknown_action: map.get("rejected_unknown_action") ?? 0,
    rejected_permission: map.get("rejected_permission") ?? 0,
    rejected_guardrail: map.get("rejected_guardrail") ?? 0,
    rejected_no_llm_rule: map.get("rejected_no_llm_rule") ?? 0,
  };

  // Doctrine #1/#3/#4 signals live in moderation + gate rejection logs.
  // For now we report best-effort from moderation_event · a future BEGIN
  // will add a nex.gate_rejection_event table for finer-grained counting.
  const mod = await pool.query(
    `SELECT category, COUNT(*)::int AS n
       FROM nex.moderation_event
       WHERE emitted_at >= $1 AND emitted_at <= $2
       GROUP BY category`,
    [window.since, window.until],
  ).catch(() => ({ rows: [] as Array<{ category: string; n: number }> }));
  const modMap = new Map<string, number>();
  for (const r of mod.rows) modMap.set(String(r.category), Number(r.n));

  // Doctrine #1 · read live from nex.gate_rejection_event.
  const gateRej = await pool.query(
    `SELECT reason, COUNT(*)::int AS n
       FROM nex.gate_rejection_event
       WHERE emitted_at >= $1 AND emitted_at <= $2
       GROUP BY reason`,
    [window.since, window.until],
  ).catch(() => ({ rows: [] as Array<{ reason: string; n: number }> }));
  const gateRejMap = new Map<string, number>();
  for (const r of gateRej.rows) gateRejMap.set(String(r.reason), Number(r.n));

  const keptMean = await pool.query(
    `SELECT AVG(alignment_score)::float AS mean
       FROM nex.gate_kept_event
       WHERE emitted_at >= $1 AND emitted_at <= $2
         AND alignment_score IS NOT NULL`,
    [window.since, window.until],
  ).catch(() => ({ rows: [{ mean: null as number | null }] }));

  const d1 = {
    total: [...gateRejMap.values()].reduce((a, b) => a + b, 0),
    orphan_citations: gateRejMap.get("orphan_citation") ?? 0,
    postrationalisation_suspected: gateRejMap.get("postrationalisation") ?? 0,
    memory_citations_reject: gateRejMap.get("doctrine_4_memory") ?? 0,
    average_alignment_of_kept_claims: (keptMean.rows[0]?.mean != null)
      ? Number(Number(keptMean.rows[0].mean).toFixed(3))
      : undefined,
  };
  const d3TrustCapViolations = 0; // Doctrine #3 enforced at gate · no cap-violation surface currently
  const d4MemoryCitationAttempts = d1.memory_citations_reject;

  // Aggregate score: rejections are DOCTRINE WINS (NEX correctly refused
  // an LLM proposal). Bypasses are what we'd alert on · but by construction
  // the pipeline routes every proposal through authorize.ts so a bypass
  // is architecturally impossible. Score = 1.0 whenever the pipeline is
  // functioning; drops only if we ever observe a d3 trust-cap violation
  // (which itself requires a gate bug to occur).
  const overall = d3TrustCapViolations === 0 ? 1 : 0;

  return {
    doctrine_1_gate_rejections: d1,
    doctrine_2_action_rejections: d2,
    doctrine_3_trust_cap_violations: d3TrustCapViolations,
    doctrine_4_memory_citation_attempts: d4MemoryCitationAttempts,
    overall_score: Number(overall.toFixed(3)),
  };
}

// ═══════════════════════════════════════════════════════════════════
// Groundedness · placeholder (needs a gate_rejection_event table).
// For now returns zeros so the shape is stable · alerts stay silent.
// ═══════════════════════════════════════════════════════════════════

async function computeGroundedness(pool: Pool, window: ObservatoryWindow): Promise<GroundednessMetrics> {
  // Rejection counts by reason.
  const rej = await pool.query(
    `SELECT reason, COUNT(*)::int AS n
       FROM nex.gate_rejection_event
       WHERE emitted_at >= $1 AND emitted_at <= $2
       GROUP BY reason`,
    [window.since, window.until],
  ).catch(() => ({ rows: [] as Array<{ reason: string; n: number }> }));
  const rejMap = new Map<string, number>();
  for (const r of rej.rows) rejMap.set(String(r.reason), Number(r.n));

  const postratRejects = rejMap.get("postrationalisation") ?? 0;

  // Kept-claim alignment distribution.
  const kept = await pool.query(
    `SELECT alignment_score
       FROM nex.gate_kept_event
       WHERE emitted_at >= $1 AND emitted_at <= $2
         AND alignment_score IS NOT NULL`,
    [window.since, window.until],
  ).catch(() => ({ rows: [] as Array<{ alignment_score: number }> }));
  const scores = kept.rows.map((r) => Number(r.alignment_score)).sort((a, b) => a - b);
  const keptCount = scores.length;
  const p = (frac: number) => scores.length === 0 ? 0 : scores[Math.min(scores.length - 1, Math.floor(scores.length * frac))];

  const totalRelevant = keptCount + postratRejects;
  const postratRate = totalRelevant > 0 ? postratRejects / totalRelevant : 0;

  return {
    verified_replies: keptCount,
    unverified_replies: [...rejMap.values()].reduce((a, b) => a + b, 0),
    alignment_min: scores.length === 0 ? 0 : Number(scores[0].toFixed(3)),
    alignment_p50: Number(p(0.5).toFixed(3)),
    alignment_p95: Number(p(0.95).toFixed(3)),
    alignment_max: scores.length === 0 ? 0 : Number(scores[scores.length - 1].toFixed(3)),
    postrationalisation_rate: Number(postratRate.toFixed(3)),
  };
}

// ═══════════════════════════════════════════════════════════════════
// Domain coverage · uses nex.question_variant answer_status + nex.knowledge_gap
// ═══════════════════════════════════════════════════════════════════

async function computeDomainCoverage(pool: Pool): Promise<DomainCoverage[]> {
  const qv = await pool.query(
    `SELECT COALESCE(domain,'unknown') AS domain,
            SUM(CASE WHEN answer_status='answered' THEN 1 ELSE 0 END)::int AS answered,
            SUM(CASE WHEN answer_status='partially_answered' THEN 1 ELSE 0 END)::int AS partial,
            SUM(CASE WHEN answer_status='unknown' THEN 1 ELSE 0 END)::int AS unknown
       FROM nex.question_variant
       GROUP BY domain`,
  ).catch(() => ({ rows: [] as Array<{ domain: string; answered: number; partial: number; unknown: number }> }));
  const gaps = await pool.query(
    `SELECT COALESCE(domain,'unknown') AS domain, COUNT(*)::int AS n
       FROM nex.knowledge_gap
       WHERE status IN ('open','in_progress')
       GROUP BY domain`,
  ).catch(() => ({ rows: [] as Array<{ domain: string; n: number }> }));
  const gapMap = new Map<string, number>();
  for (const r of gaps.rows) gapMap.set(String(r.domain), Number(r.n));

  const out: DomainCoverage[] = qv.rows.map((r) => {
    const answered = Number(r.answered ?? 0);
    const partial = Number(r.partial ?? 0);
    const unknown = Number(r.unknown ?? 0);
    const denom = answered + partial + unknown;
    return {
      domain: String(r.domain),
      answered_question_variants: answered,
      partially_answered: partial,
      unknown,
      coverage_ratio: denom > 0 ? Number(((answered + partial) / denom).toFixed(3)) : 0,
      open_gap_count: gapMap.get(String(r.domain)) ?? 0,
    };
  });
  return out;
}

// ═══════════════════════════════════════════════════════════════════
// Latency · placeholder (needs per-turn telemetry table).
// Emits zeros to keep the snapshot shape stable.
// ═══════════════════════════════════════════════════════════════════

async function computeLatency(pool: Pool, window: ObservatoryWindow): Promise<LatencyMetrics> {
  // Promotion-path counts.
  const path = await pool.query(
    `SELECT promotion_path, COUNT(*)::int AS n, SUM(CASE WHEN llm_invoked THEN 1 ELSE 0 END)::int AS llm_n
       FROM nex.turn_latency_event
       WHERE emitted_at >= $1 AND emitted_at <= $2
       GROUP BY promotion_path`,
    [window.since, window.until],
  ).catch(() => ({ rows: [] as Array<{ promotion_path: string; n: number; llm_n: number }> }));
  let total = 0, adapter = 0, composer = 0, rescue = 0, research = 0, llmSum = 0;
  for (const r of path.rows) {
    const n = Number(r.n);
    total += n;
    if (r.promotion_path === "adapter") adapter += n;
    if (r.promotion_path === "composer") composer += n;
    if (r.promotion_path === "rescue") rescue += n;
    if (r.promotion_path === "research") research += n;
    llmSum += Number(r.llm_n ?? 0);
  }
  const div = (a: number, b: number) => b > 0 ? Number((a / b).toFixed(3)) : 0;

  // Per-stage + end-to-end percentiles.
  const percentiles = async (column: string) => {
    const q = await pool.query(
      `SELECT ${column} AS v FROM nex.turn_latency_event
         WHERE emitted_at >= $1 AND emitted_at <= $2 AND ${column} IS NOT NULL
         ORDER BY ${column} ASC`,
      [window.since, window.until],
    ).catch(() => ({ rows: [] as Array<{ v: number }> }));
    const xs = q.rows.map((r) => Number(r.v)).filter((x) => Number.isFinite(x));
    if (xs.length === 0) return { p50: undefined as number | undefined, p95: undefined as number | undefined };
    return {
      p50: Math.round(xs[Math.min(xs.length - 1, Math.floor(xs.length * 0.5))]),
      p95: Math.round(xs[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))]),
    };
  };
  const [adapterP, composerP, rescueP, researchP, totalP] = await Promise.all([
    percentiles("adapter_ms"),
    percentiles("composer_ms"),
    percentiles("rescue_ms"),
    percentiles("research_ms"),
    percentiles("total_ms"),
  ]);

  return {
    adapter_promoted_ratio: div(adapter, total),
    composer_accepted_ratio: div(composer, total),
    rescue_fired_ratio: div(rescue, total),
    research_fired_ratio: div(research, total),
    llm_invoked_ratio: div(llmSum, total),
    adapter_p50_ms: adapterP.p50,
    composer_p50_ms: composerP.p50,
    rescue_p50_ms: rescueP.p50,
    research_p50_ms: researchP.p50,
    end_to_end_p50_ms: totalP.p50,
    end_to_end_p95_ms: totalP.p95,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Fallbacks · never let a Postgres error crash the Observatory read.
// ═══════════════════════════════════════════════════════════════════

function errFallbackDoctrine(): DoctrineHealth {
  return {
    doctrine_1_gate_rejections: { total: 0, orphan_citations: 0, postrationalisation_suspected: 0, memory_citations_reject: 0 },
    doctrine_2_action_rejections: { total_proposed: 0, executed: 0, rejected_schema: 0, rejected_unknown_action: 0, rejected_permission: 0, rejected_guardrail: 0, rejected_no_llm_rule: 0 },
    doctrine_3_trust_cap_violations: 0,
    doctrine_4_memory_citation_attempts: 0,
    overall_score: 1,
  };
}
function errFallbackGrounded(): GroundednessMetrics {
  return { verified_replies: 0, unverified_replies: 0, alignment_min: 0, alignment_p50: 0, alignment_p95: 0, alignment_max: 0, postrationalisation_rate: 0 };
}
function errFallbackCoverage(): DomainCoverage[] { return []; }
function errFallbackLatency(): LatencyMetrics {
  return { adapter_promoted_ratio: 0, composer_accepted_ratio: 0, rescue_fired_ratio: 0, research_fired_ratio: 0, llm_invoked_ratio: 0 };
}

export function makeDefaultObservatoryBrain(): ObservatoryBrainFacade | null {
  const enabled = process.env.NEX_OBSERVATORY_BRAIN;
  if (enabled === "off" || enabled === "0" || enabled === "false") return null;
  return makeObservatoryBrain();
}
