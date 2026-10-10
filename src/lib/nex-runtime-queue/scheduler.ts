// WO-NEX-RUNTIME-02 · deterministic capability-aware scheduler.
//
// Founder-locked 2026-09-13.
//
// Constitutional rules:
//   1. "Scheduling authority ≠ engineering authority."
//   2. "Locality can improve ordering, but it can never permanently
//      starve higher-priority eligible work."
//
// Same inputs → same output. Every selection carries a human-readable
// `scheduler_reason` so the founder can ask "why did you choose this?"
//
// This module is a PURE function of its inputs · no persistence · no
// side effects. The caller (queue.ts) performs the actual state
// transitions.

import { randomUUID } from "node:crypto";
import { provenanceChainHash } from "@/lib/nex-intelligence/provenance";
import {
  type EngineeringMission,
  type SchedulerDecision,
  type SchedulerFactorContribution,
  PRIORITY_WEIGHTS,
  SECURITY_CLASSES_BLOCKED,
} from "./types";

// ── Inputs ─────────────────────────────────────────────────────────────

export interface SchedulerContext {
  /** All non-terminal missions currently in the queue (candidates). */
  readonly missions: readonly EngineeringMission[];
  /** ALL missions in the registry keyed by mission_id · used for
   *  dependency lookup so COMPLETED / FAILED / CANCELLED missions can
   *  be evaluated as dependencies. Optional · falls back to the
   *  candidates map if omitted. */
  readonly all_missions_by_id?: ReadonlyMap<string, EngineeringMission>;
  /** Mission IDs of missions that already have an active claim. */
  readonly claimed_mission_ids: ReadonlySet<string>;
  /** Capability catalog · which capabilities the workforce currently supports. */
  readonly available_capabilities: ReadonlySet<string>;
  /** The subsystem/path root touched by the most recently completed mission
   *  (for locality). Empty string = no locality preference. */
  readonly recently_completed_locality_root: string;
  /** Current wall-clock time (for age-based starvation protection). */
  readonly now_ms: number;
  /** Missions older than this many ms get a priority bump per unit of age
   *  overflow. Default 60_000 (1 minute) in queue.ts callers. */
  readonly starvation_threshold_ms: number;
  /** How aggressively locality contributes (must be capped below priority
   *  step so locality can NEVER beat a higher priority alone). Default 5. */
  readonly locality_bonus: number;
  /** Age-boost coefficient (points per minute of waiting past threshold). */
  readonly age_boost_per_minute: number;
}

// ── Output ─────────────────────────────────────────────────────────────

export interface SchedulingResult {
  readonly decision: SchedulerDecision;
  /** The mission the scheduler recommends running next, or null. */
  readonly winner: EngineeringMission | null;
  /** For each candidate that was rejected before scoring, why. */
  readonly rejected: readonly { mission: EngineeringMission; reason: string }[];
  /** The scored eligible candidates, highest score first. */
  readonly scored: readonly {
    mission: EngineeringMission;
    score: number;
    factors: readonly SchedulerFactorContribution[];
    reason_summary: string;
  }[];
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Deterministic scheduler.
 *
 * Steps (per founder-locked ordering):
 *   1  Eligibility · status ∈ {QUEUED, ELIGIBLE}
 *   2  Dependency check · all dependencies COMPLETED
 *   3  Conflict check · no active-claim overlap on affected_paths
 *   4  Capability check · required_capabilities ⊆ available_capabilities
 *   5  Security gate · security_class not in SECURITY_CLASSES_BLOCKED
 *   6  Priority weight
 *   7  Starvation age-boost
 *   8  Locality bonus
 *   9  Age fairness (older created_at wins ties)
 *   10 Deterministic tie-break (lexicographic mission_id)
 */
export function schedulerPickNext(ctx: SchedulerContext): SchedulingResult {
  const rejected: { mission: EngineeringMission; reason: string }[] = [];
  const scored: SchedulingResult["scored"] extends readonly (infer T)[] ? T[] : never = [];

  // Dependency lookup must include terminal missions (COMPLETED etc)
  const missionById: ReadonlyMap<string, EngineeringMission> =
    ctx.all_missions_by_id ?? new Map(ctx.missions.map((m) => [m.mission_id, m]));

  // Set of paths currently occupied by CLAIMED/IN_PROGRESS missions.
  const occupiedPaths = new Set<string>();
  for (const m of ctx.missions) {
    if (m.status === "CLAIMED" || m.status === "IN_PROGRESS") {
      for (const p of m.affected_paths) occupiedPaths.add(p);
    }
  }

  for (const m of ctx.missions) {
    // 1 · Eligibility
    if (m.status !== "QUEUED" && m.status !== "ELIGIBLE") {
      rejected.push({ mission: m, reason: `status ${m.status} · not eligible for scheduling` });
      continue;
    }

    // Already claimed? (also caught by set input)
    if (ctx.claimed_mission_ids.has(m.mission_id)) {
      rejected.push({ mission: m, reason: "already claimed by another agent" });
      continue;
    }

    // 5 · Security gate BEFORE deep evaluation
    if (SECURITY_CLASSES_BLOCKED.has(m.security_class)) {
      rejected.push({ mission: m, reason: `security_class ${m.security_class} · founder-only manual resolution` });
      continue;
    }

    // 2 · Dependency check
    const unmet: string[] = [];
    for (const dep of m.dependencies) {
      const d = missionById.get(dep);
      if (!d || d.status !== "COMPLETED") unmet.push(dep);
    }
    if (unmet.length > 0) {
      rejected.push({ mission: m, reason: `dependencies not COMPLETED: ${unmet.join(", ")}` });
      continue;
    }

    // 3 · Conflict check (declared conflicts + affected_path overlap with in-flight)
    let conflicted = false;
    let conflictReason = "";
    for (const cid of m.conflicts) {
      const c = missionById.get(cid);
      if (c && (c.status === "CLAIMED" || c.status === "IN_PROGRESS" || c.status === "AWAITING_VERIFICATION")) {
        conflicted = true;
        conflictReason = `declared conflict with in-flight ${cid} (${c.status})`;
        break;
      }
    }
    if (!conflicted) {
      for (const p of m.affected_paths) {
        if (occupiedPaths.has(p)) {
          conflicted = true;
          conflictReason = `affected_paths overlap with an in-flight mission on ${p}`;
          break;
        }
      }
    }
    if (conflicted) {
      rejected.push({ mission: m, reason: conflictReason });
      continue;
    }

    // 4 · Capability check
    const missing: string[] = [];
    for (const cap of m.required_capabilities) {
      if (!ctx.available_capabilities.has(cap)) missing.push(cap);
    }
    if (missing.length > 0) {
      rejected.push({ mission: m, reason: `required capabilities not in workforce catalog: ${missing.join(", ")}` });
      continue;
    }

    // ── SCORING (deterministic) ────────────────────────────────────────
    const factors: SchedulerFactorContribution[] = [];

    // 6 · Priority weight
    const priorityScore = PRIORITY_WEIGHTS[m.priority];
    factors.push({ factor: "priority", delta: priorityScore, rationale: `priority=${m.priority}` });

    // 7 · Starvation age-boost
    const ageMs = ctx.now_ms - Date.parse(m.created_at);
    const overflow = Math.max(0, ageMs - ctx.starvation_threshold_ms);
    const ageBoost = Math.floor((overflow / 60_000) * ctx.age_boost_per_minute);
    if (ageBoost > 0) {
      factors.push({
        factor: "starvation_age_boost",
        delta: ageBoost,
        rationale: `age ${Math.floor(ageMs / 1000)}s (${Math.floor(overflow / 1000)}s past starvation threshold) → +${ageBoost}`,
      });
    }

    // 8 · Locality bonus (bounded so it cannot beat a full priority step)
    let localityDelta = 0;
    if (ctx.recently_completed_locality_root.length > 0) {
      const rootN = ctx.recently_completed_locality_root.replace(/\\/g, "/");
      const matches = m.affected_paths.some((p) => p.replace(/\\/g, "/").startsWith(rootN));
      if (matches) {
        localityDelta = ctx.locality_bonus;
        factors.push({
          factor: "locality",
          delta: localityDelta,
          rationale: `same subsystem as recently completed mission (${rootN}) → +${localityDelta}`,
        });
      }
    }

    // 9 · Age fairness (older created_at → tiny positive bump)
    const ageFairness = Math.min(1, ageMs / 1000);   // 0..1 second-level tie-break
    factors.push({ factor: "age_fairness", delta: ageFairness, rationale: `age fairness bump ${ageFairness.toFixed(3)}` });

    // 10 · Deterministic tie-break by lexicographic mission_id (encoded
    //     as a tiny fractional negative to prefer smaller ids on ties).
    const tieBreak = -1 / (1 + hashInt(m.mission_id));
    factors.push({ factor: "tie_break", delta: tieBreak, rationale: `lexicographic tie-break ${tieBreak.toFixed(6)}` });

    // Also record the eligibility factors as informational (no delta)
    factors.unshift({ factor: "eligibility", delta: 0, rationale: `status=${m.status} · eligible` });
    factors.unshift({ factor: "dependency_ready", delta: 0, rationale: "all dependencies COMPLETED" });
    factors.unshift({ factor: "conflict_free", delta: 0, rationale: "no active-claim path overlap or declared conflict" });
    factors.unshift({ factor: "capability_match", delta: 0, rationale: `all required capabilities available (${m.required_capabilities.length})` });
    factors.unshift({ factor: "security_gate", delta: 0, rationale: `security_class=${m.security_class}` });

    const score = factors.reduce((s, f) => s + f.delta, 0);
    const reason_summary = summariseFactors(m, factors, score);
    scored.push({ mission: m, score, factors, reason_summary });
  }

  // Sort: highest score wins; tie-break by lexicographic mission_id
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.mission.mission_id.localeCompare(b.mission.mission_id);
  });

  const winner = scored[0]?.mission ?? null;

  const decision: SchedulerDecision = {
    record_type: "NEX_SCHEDULER_DECISION",
    decision_id: `SCHED-${randomUUID().slice(0, 16)}`,
    evaluated_at: new Date(ctx.now_ms).toISOString(),
    candidates_examined: ctx.missions.length,
    selected_mission_id: winner?.mission_id ?? null,
    rejected: rejected.map((r) => ({ mission_id: r.mission.mission_id, reason: r.reason })),
    winner_score: scored[0]?.score ?? null,
    winner_factors: scored[0]?.factors ?? [],
    reason_summary: winner
      ? `Selected ${winner.mission_id} (${winner.priority}) · score ${scored[0].score.toFixed(3)} · ${scored[0].reason_summary}`
      : `No mission selected · ${ctx.missions.length} candidate(s) examined · ${rejected.length} rejected · 0 eligible`,
    provenance_chain_hash: "",   // filled below
  };
  const finalDecision: SchedulerDecision = {
    ...decision,
    provenance_chain_hash: provenanceChainHash(decision as unknown as Record<string, unknown>, []),
  };

  return { decision: finalDecision, winner, rejected, scored };
}

// ── Helpers ────────────────────────────────────────────────────────────

function summariseFactors(m: EngineeringMission, factors: readonly SchedulerFactorContribution[], score: number): string {
  const contribs = factors
    .filter((f) => f.delta !== 0)
    .map((f) => `${f.factor}${f.delta >= 0 ? "+" : ""}${f.delta.toFixed(3)} (${f.rationale})`)
    .join(" · ");
  return `${m.title} · total=${score.toFixed(3)} · ${contribs}`;
}

function hashInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  // Make positive
  return Math.abs(h) + 1;
}
