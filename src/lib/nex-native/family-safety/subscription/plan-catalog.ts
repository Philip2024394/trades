// src/lib/nex-native/family-safety/subscription/plan-catalog.ts
//
// NEX Family Safety · plan catalog · Phase 1 · PLACEHOLDER pricing.
//
// Load-bearing doctrine:
//   · No real currency figures are invented · displayPrice is a
//     PLACEHOLDER string.
//   · `isFreePilot` must be TRUE for exactly ONE plan
//     (`family_safety_pilot_free`) so the full subscription journey
//     can be exercised with no pricing commitment.
//   · A real plan is added via a MIGRATION to extend the CHECK
//     constraint on plan_id + an entry here. Never invent an
//     unmigrated plan id.

import type { PlanId } from "./types";
import { PLAN_IDS } from "./types";

export interface PlanDefinition {
  readonly id: PlanId;
  readonly title: string;
  readonly summary: string;
  /** Human-readable PLACEHOLDER (no real currency figure). */
  readonly displayPrice: string;
  /** TRUE only for the free pilot plan. */
  readonly isFreePilot: boolean;
  /** Bulleted feature list · pure UI copy · no truth-layer dependency. */
  readonly features: ReadonlyArray<string>;
}

export const PLAN_CATALOG: ReadonlyArray<PlanDefinition> = [
  {
    id: "family_safety_pilot_free",
    title: "Family Safety Pilot",
    summary:
      "A free pilot so you can set up a family + child link + guardian dashboard without any payment.",
    displayPrice: "FREE · pilot",
    isFreePilot: true,
    features: [
      "One primary guardian · one child link",
      "Guardian dashboard · child status (online / offline)",
      "SafeChat classification badge · logging only in Phase 1",
      "Emergency Help entry still available independently",
      "No real payment · all transactions are SIMULATED",
    ],
  },
  {
    id: "family_safety_tbd_1",
    title: "Family Safety · TBD plan 1",
    summary:
      "Reserved slot for a future paid plan. Scope + price have NOT been approved.",
    displayPrice: "Pricing TBD · founder has not approved commercial model",
    isFreePilot: false,
    features: [
      "Reserved slot · founder has not approved features",
      "No real currency figure invented",
      "Pricing TBD",
    ],
  },
  {
    id: "family_safety_tbd_2",
    title: "Family Safety · TBD plan 2",
    summary:
      "Reserved slot for a future paid plan. Scope + price have NOT been approved.",
    displayPrice: "Pricing TBD · founder has not approved commercial model",
    isFreePilot: false,
    features: [
      "Reserved slot · founder has not approved features",
      "No real currency figure invented",
      "Pricing TBD",
    ],
  },
];

export function getPlanById(id: string): PlanDefinition | null {
  return PLAN_CATALOG.find((p) => p.id === id) ?? null;
}

export function listAllPlans(): ReadonlyArray<PlanDefinition> {
  return PLAN_CATALOG;
}

export function freePilotPlan(): PlanDefinition {
  const p = PLAN_CATALOG.find((x) => x.isFreePilot);
  if (!p) {
    // Impossible by construction · catalog test enforces N=1 free pilot.
    throw new Error(
      "plan-catalog: invariant violated · no free pilot plan defined",
    );
  }
  return p;
}

/** Returns the plan ids that are considered activatable in Phase 1. */
export function activatableInPhase1(): ReadonlyArray<PlanId> {
  return PLAN_CATALOG.filter((p) => p.isFreePilot).map((p) => p.id);
}

/** All catalog ids match the migration-level PLAN_IDS whitelist. */
export function allCatalogIdsMatchMigrationIds(): boolean {
  const catalogIds = new Set(PLAN_CATALOG.map((p) => p.id));
  const migrationIds = new Set<string>(PLAN_IDS);
  if (catalogIds.size !== migrationIds.size) return false;
  for (const id of catalogIds) {
    if (!migrationIds.has(id)) return false;
  }
  return true;
}
