// Fleet planner · turns walker specs (from taxonomy) into concrete
// worker + job instances the supervisor can spawn.
//
// Two spawning modes:
//   1. One-per-spec: each active walker becomes one worker + one job.
//   2. Region-sharded: high-priority walkers (Tier A) are split
//      across the country by geographic region, so `walker.culture.
//      traditions` becomes `walker.culture.traditions.bali`, `...java`,
//      `...sumatra`, etc. Failures in one region don't stall the
//      others (Philip 2026-08-30 · "if the Bali culture worker
//      crashes, the Indonesia culture workforce doesn't stop").
//
// The planner does NOT run the workers · it produces a plan (a list
// of Job specs) that the supervisor enqueues.

import type { KnowledgeWalker } from "../walkers/types";
import type { WalkerSpec } from "../walkers/taxonomy";
import type { Job } from "./types";

/** Regions used for fleet sharding. Covers the archipelago's main
 *  cultural + geographic zones. Not every walker fires in every
 *  region — the planner honours declared scope when the walker spec
 *  carries a geographic_scope hint (extension point). */
export const FLEET_REGIONS = [
  "Bali",
  "Java",
  "Sumatra",
  "Sulawesi",
  "Kalimantan",
  "Papua",
  "Nusa Tenggara",
  "Maluku",
] as const;

export type FleetPlanEntry = {
  workerId: string;
  walkerId: string;
  region?: string;
  job: Omit<Job, "attempts" | "totalAttempts">;
};

export type FleetPlanOptions = {
  /** Only Tier <= this level is sharded per-region. Default 1 (Tier A). */
  shardBelowPriority?: number;
  /** Now-provider for deterministic tests. */
  now?: () => Date;
};

/** Given the set of ACTIVE walker specs + concrete walker instances,
 *  produce a fleet plan (list of {workerId, jobId, region} entries)
 *  the supervisor can enqueue. */
export function planFleet(
  activeSpecs: WalkerSpec[],
  concreteWalkers: KnowledgeWalker[],
  opts: FleetPlanOptions = {},
): FleetPlanEntry[] {
  const now = (opts.now ?? (() => new Date()))().toISOString();
  const shardThreshold = opts.shardBelowPriority ?? 1;
  const specById = new Map(activeSpecs.map((s) => [s.id, s]));
  const plan: FleetPlanEntry[] = [];

  for (const walker of concreteWalkers) {
    const spec = specById.get(walker.id);
    if (!spec) continue; // walker not in active taxonomy → skip

    // scope="national" opts out of region-sharding regardless of
    // priority · used for live feeds where all shards would fetch the
    // same payload (BMKG earthquake, MAGMA volcano, weather).
    const isNational = spec.scope === "national";
    if (spec.priority <= shardThreshold && !isNational) {
      // Region-sharded: one worker per region.
      for (const region of FLEET_REGIONS) {
        plan.push({
          workerId: `worker:${walker.id}:${slug(region)}`,
          walkerId: walker.id,
          region,
          job: {
            id: `job:${walker.id}:${slug(region)}`,
            walkerId: walker.id,
            region,
            priority: spec.priority,
            scheduledFor: now,
            sourceKey: walker.id,
          },
        });
      }
    } else {
      // One-per-spec: single worker for the whole spec.
      plan.push({
        workerId: `worker:${walker.id}`,
        walkerId: walker.id,
        job: {
          id: `job:${walker.id}`,
          walkerId: walker.id,
          priority: spec.priority,
          scheduledFor: now,
          sourceKey: walker.id,
        },
      });
    }
  }

  return plan;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
