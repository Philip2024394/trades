// src/lib/nex/jobs/supervisor-stuck-detector.ts
//
// Wave 2 · Phase 6 · isolated stuck-KJ query.
// Governed by: docs/headquarters-production-readiness/W-C-COMPANION-PHASE-6-DESIGN.md §11
//
// A KJ is "stuck" when ALL of:
//   · status = 'claimed'
//   · progress = 0                             (matches every one of the 10 preserved fixtures)
//   · updated_at < now() - STUCK_AFTER_MIN     (default 30)
//
// Kept in its own file so contract tests can exercise the detector
// without spinning up the full supervisor module.

import type { KnowledgeJob } from "./fs-store";

export type StuckDetectorConfig = {
  stuck_after_minutes: number;
  max_per_tick: number;
};

export function readStuckDetectorConfig(env: NodeJS.ProcessEnv = process.env): StuckDetectorConfig {
  const stuck_after_minutes = Number(env.NEX_KJOB_SUPERVISOR_STUCK_AFTER_MIN ?? 30);
  const max_per_tick        = Number(env.NEX_KJOB_SUPERVISOR_MAX_PER_TICK ?? 25);
  return {
    stuck_after_minutes: Number.isFinite(stuck_after_minutes) && stuck_after_minutes > 0 ? stuck_after_minutes : 30,
    max_per_tick:        Number.isFinite(max_per_tick)        && max_per_tick        > 0 ? max_per_tick        : 25,
  };
}

/** Pure function · deterministic given `now`. */
export function detectStuck(
  jobs: KnowledgeJob[],
  cfg: StuckDetectorConfig,
  now: Date = new Date(),
): KnowledgeJob[] {
  const cutoff = now.getTime() - cfg.stuck_after_minutes * 60 * 1000;
  const stuck = jobs.filter((j) =>
    j.status === "claimed"
    && j.progress === 0
    && new Date(j.updated_at).getTime() < cutoff,
  );
  return stuck.slice(0, cfg.max_per_tick);
}
