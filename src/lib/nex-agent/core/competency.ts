// src/lib/nex-agent/core/competency.ts
//
// NEX Agent · Competency Ledger + Autonomy Tier.
//
// The ledger records what nex1 has DEMONSTRATED (not what it has been told).
// Every passing lesson attempt bumps the linked competency's achieved_score.
// The autonomy tier (LOW / MEDIUM / HIGH) is DERIVED from the ledger snapshot ·
// stored nowhere · always computed fresh · never spoofable.
//
// Tier rules:
//   LOW    · human guidance required · nex1 can propose only · founder does everything
//   MEDIUM · supervised execution · nex1 writes to worktree, founder still approves
//   HIGH   · limited autonomy · nex1 can self-apply small changes in categories the founder has pre-cleared
//
// Tier gate:
//   LOW    · achieved when every LOW-tier domain is at target
//   MEDIUM · achieved when LOW cleared + every MEDIUM-tier domain ≥ 80% of target
//   HIGH   · achieved when MEDIUM cleared + every HIGH-tier domain at target

import { Client } from "pg";

function pgUrl(): string {
  return process.env.NEX_TAXONOMY_POSTGRES_URL ?? process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
}
async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: pgUrl(), connectionTimeoutMillis: 5000 });
  await c.connect();
  try { return await fn(c); } finally { try { await c.end(); } catch { /* ignore */ } }
}

// ─── Types ──────────────────────────────────────────────────────
export type AutonomyTier = "LOW" | "MEDIUM" | "HIGH";
export interface CompetencyRow {
  competency_id: string;
  domain_key: string;
  domain_label: string;
  description: string | null;
  target_score: number;
  achieved_score: number;
  required_for_tier: AutonomyTier;
  last_updated_at: string;
}
export interface CompetencyEvent {
  event_id: string; competency_id: string; recorded_at: string;
  delta: number; reason: string; source_lesson_id: string | null; source_attempt_id: string | null; recorded_by: string;
}
export interface AutonomySnapshot {
  tier: AutonomyTier;
  next_tier: AutonomyTier | null;
  next_tier_gap: Array<{ domain_key: string; domain_label: string; achieved: number; target: number; deficit: number }>;
  totals: { total_domains: number; at_target: number; low_ready: boolean; medium_ready: boolean; high_ready: boolean };
  by_tier: Record<AutonomyTier, { total: number; at_target: number; percent: number }>;
}

// ─── Reads ──────────────────────────────────────────────────────
export async function listCompetencies(): Promise<CompetencyRow[]> {
  return withClient(async c => {
    const r = await c.query<CompetencyRow>(`SELECT competency_id, domain_key, domain_label, description, target_score, achieved_score, required_for_tier, last_updated_at FROM nex_agent.competencies ORDER BY required_for_tier, domain_key`);
    return r.rows;
  });
}
export async function listRecentCompetencyEvents(limit = 30): Promise<CompetencyEvent[]> {
  return withClient(async c => {
    const r = await c.query<CompetencyEvent>(`SELECT event_id, competency_id, recorded_at, delta, reason, source_lesson_id, source_attempt_id, recorded_by FROM nex_agent.competency_events ORDER BY recorded_at DESC LIMIT $1`, [limit]);
    return r.rows;
  });
}

// ─── Auto-increment · called by training route on a lesson pass ─
export async function bumpCompetencyForAttempt(input: { domain_key: string; lesson_id: string; attempt_id: string; auto_verdict: "pass" | "partial" | "fail" | "error"; auto_score: number; }): Promise<{ ok: boolean; new_achieved: number; delta: number; reason: string }> {
  if (input.auto_verdict === "fail" || input.auto_verdict === "error") return { ok: false, new_achieved: 0, delta: 0, reason: "no_bump_on_fail" };
  const delta = input.auto_verdict === "pass" ? 1 : 0.5;
  return withClient(async c => {
    const comp = (await c.query(`SELECT competency_id, achieved_score, target_score FROM nex_agent.competencies WHERE domain_key=$1`, [input.domain_key])).rows[0] as { competency_id: string; achieved_score: number; target_score: number } | undefined;
    if (!comp) return { ok: false, new_achieved: 0, delta: 0, reason: `unknown_domain:${input.domain_key}` };
    // Only bump if a prior event for the SAME (lesson_id, verdict) doesn't already exist ·
    // avoids double-counting on repeated attempts.
    const prev = await c.query(`SELECT event_id, delta FROM nex_agent.competency_events WHERE competency_id=$1 AND source_lesson_id=$2 AND recorded_by='training_auto' ORDER BY recorded_at DESC LIMIT 1`, [comp.competency_id, input.lesson_id]);
    const priorDelta = prev.rows[0]?.delta ?? 0;
    const netDelta = Math.max(0, delta - Number(priorDelta));
    if (netDelta === 0) return { ok: false, new_achieved: Number(comp.achieved_score), delta: 0, reason: "no_net_progress" };
    // Cap at target · never over-count
    const nextAchieved = Math.min(comp.target_score, Number(comp.achieved_score) + netDelta);
    const actualDelta = nextAchieved - Number(comp.achieved_score);
    if (actualDelta <= 0) return { ok: false, new_achieved: Number(comp.achieved_score), delta: 0, reason: "already_at_target" };
    await c.query(`UPDATE nex_agent.competencies SET achieved_score=$1, last_updated_at=now() WHERE competency_id=$2`, [nextAchieved, comp.competency_id]);
    await c.query(`INSERT INTO nex_agent.competency_events (competency_id, delta, reason, source_lesson_id, source_attempt_id, recorded_by) VALUES ($1,$2,$3,$4,$5,'training_auto')`,
      [comp.competency_id, actualDelta, `${input.auto_verdict} on lesson`, input.lesson_id, input.attempt_id]);
    return { ok: true, new_achieved: nextAchieved, delta: actualDelta, reason: "auto_bump" };
  });
}

// Mentor-granted competency bump (used when Claude/founder promotes a doctrine or directly credits an attempt)
// V1.4 · evidence_kind labels the source so the ledger can distinguish training vs real-world evidence.
export type EvidenceKind = "training_lesson" | "training_project" | "training_project_unseen" | "real_dry_run" | "real_verified_apply" | "real_complex_migration" | "manual_grant" | "mentor_promotion";
export async function grantCompetency(input: { domain_key: string; delta: number; reason: string; evidence_kind?: EvidenceKind; source_lesson_id?: string; source_attempt_id?: string; recorded_by: string; }): Promise<{ ok: boolean; new_achieved: number }> {
  return withClient(async c => {
    const comp = (await c.query(`SELECT competency_id, achieved_score, target_score FROM nex_agent.competencies WHERE domain_key=$1`, [input.domain_key])).rows[0] as { competency_id: string; achieved_score: number; target_score: number } | undefined;
    if (!comp) return { ok: false, new_achieved: 0 };
    const nextAchieved = Math.min(comp.target_score, Number(comp.achieved_score) + input.delta);
    await c.query(`UPDATE nex_agent.competencies SET achieved_score=$1, last_updated_at=now() WHERE competency_id=$2`, [nextAchieved, comp.competency_id]);
    await c.query(`INSERT INTO nex_agent.competency_events (competency_id, delta, reason, source_lesson_id, source_attempt_id, recorded_by, evidence_kind) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [comp.competency_id, input.delta, input.reason, input.source_lesson_id ?? null, input.source_attempt_id ?? null, input.recorded_by, input.evidence_kind ?? "manual_grant"]);
    return { ok: true, new_achieved: nextAchieved };
  });
}

// ─── Weighted evidence · real-world work ────────────────────────
// Founder's design: different evidence carries different weight.
//   training lesson       = 1
//   real dry-run          = 1
//   real verified apply   = 2
//   real complex migration= 3   (multi-statement · FK/index · destructive-flagged)
// bumpCompetencyFromRealWork is the entry point for the V1.3 database-engineer path.
export async function bumpCompetencyFromRealWork(input: {
  domain_key: string;
  evidence_kind: "real_dry_run" | "real_verified_apply" | "real_complex_migration";
  task_id?: string;
  reason: string;
  recorded_by: string;
}): Promise<{ ok: boolean; delta: number; new_achieved: number }> {
  const weightMap = { real_dry_run: 1, real_verified_apply: 2, real_complex_migration: 3 } as const;
  const delta = weightMap[input.evidence_kind];
  const r = await grantCompetency({
    domain_key: input.domain_key,
    delta,
    reason: input.reason,
    evidence_kind: input.evidence_kind,
    recorded_by: input.recorded_by,
  });
  return { ok: r.ok, delta, new_achieved: r.new_achieved };
}

// ─── Autonomy tier deriver ──────────────────────────────────────
export function deriveAutonomy(competencies: CompetencyRow[]): AutonomySnapshot {
  const byTier: Record<AutonomyTier, CompetencyRow[]> = { LOW: [], MEDIUM: [], HIGH: [] };
  for (const c of competencies) byTier[c.required_for_tier].push(c);

  function tierStat(rows: CompetencyRow[]) {
    const total = rows.length;
    let atTarget = 0;
    let sumPct = 0;
    for (const r of rows) {
      if (Number(r.achieved_score) >= r.target_score) atTarget++;
      sumPct += Math.min(1, Number(r.achieved_score) / (r.target_score || 1));
    }
    return { total, at_target: atTarget, percent: total === 0 ? 100 : Math.round((sumPct / total) * 100) };
  }

  const stats = { LOW: tierStat(byTier.LOW), MEDIUM: tierStat(byTier.MEDIUM), HIGH: tierStat(byTier.HIGH) };
  const lowReady = stats.LOW.at_target === stats.LOW.total && stats.LOW.total > 0;
  // MEDIUM tier is achieved when LOW cleared AND every MEDIUM row is ≥ 80% of target
  const mediumReady = lowReady && byTier.MEDIUM.every(r => Number(r.achieved_score) / (r.target_score || 1) >= 0.8) && byTier.MEDIUM.length > 0;
  // HIGH tier is achieved when MEDIUM cleared AND every HIGH row is at target
  const highReady = mediumReady && byTier.HIGH.every(r => Number(r.achieved_score) >= r.target_score) && byTier.HIGH.length > 0;

  const tier: AutonomyTier = highReady ? "HIGH" : mediumReady ? "MEDIUM" : "LOW";
  const nextTier: AutonomyTier | null = highReady ? null : mediumReady ? "HIGH" : lowReady ? "MEDIUM" : null;

  // Show the specific deficits blocking the next tier
  let gapRows: CompetencyRow[] = [];
  if (nextTier === "MEDIUM") gapRows = byTier.MEDIUM.filter(r => Number(r.achieved_score) / (r.target_score || 1) < 0.8);
  else if (nextTier === "HIGH") gapRows = byTier.HIGH.filter(r => Number(r.achieved_score) < r.target_score);
  else if (nextTier === null && !lowReady) gapRows = byTier.LOW.filter(r => Number(r.achieved_score) < r.target_score);

  return {
    tier,
    next_tier: nextTier,
    next_tier_gap: gapRows.map(r => ({ domain_key: r.domain_key, domain_label: r.domain_label, achieved: Number(r.achieved_score), target: r.target_score, deficit: r.target_score - Number(r.achieved_score) })),
    totals: {
      total_domains: competencies.length,
      at_target: competencies.filter(r => Number(r.achieved_score) >= r.target_score).length,
      low_ready: lowReady, medium_ready: mediumReady, high_ready: highReady,
    },
    by_tier: stats,
  };
}
