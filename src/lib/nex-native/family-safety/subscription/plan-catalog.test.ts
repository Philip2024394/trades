// src/lib/nex-native/family-safety/subscription/plan-catalog.test.ts
//
// Phase 1 doctrine · the catalog must not invent real currency figures,
// must stay in sync with migration 202's CHECK, must expose exactly one
// free pilot plan.

import { describe, expect, test } from "vitest";
import {
  PLAN_CATALOG,
  allCatalogIdsMatchMigrationIds,
  activatableInPhase1,
  freePilotPlan,
  getPlanById,
  listAllPlans,
} from "./plan-catalog";
import { PLAN_IDS } from "./types";

describe("plan-catalog · migration-sync invariant", () => {
  test("every catalog id matches a migration 202 CHECK id", () => {
    expect(allCatalogIdsMatchMigrationIds()).toBe(true);
  });

  test("catalog size equals migration PLAN_IDS size", () => {
    expect(PLAN_CATALOG.length).toBe(PLAN_IDS.length);
  });

  test("no duplicate ids", () => {
    const ids = PLAN_CATALOG.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("plan-catalog · PLACEHOLDER pricing doctrine", () => {
  test("every non-free plan's displayPrice is a PLACEHOLDER string", () => {
    for (const plan of PLAN_CATALOG) {
      if (plan.isFreePilot) continue;
      expect(plan.displayPrice).toMatch(/pricing tbd/i);
      expect(plan.displayPrice).toMatch(
        /founder has not approved commercial model/i,
      );
    }
  });

  test("no catalog entry contains an invented currency figure (no $ £ € IDR Rp numeric)", () => {
    for (const plan of PLAN_CATALOG) {
      // Guard against someone sneaking in a figure.
      expect(plan.displayPrice).not.toMatch(/[$£€]\s*\d/);
      expect(plan.displayPrice).not.toMatch(/\bIDR\b/i);
      expect(plan.displayPrice).not.toMatch(/\bRp\s*\d/i);
      expect(plan.displayPrice).not.toMatch(/\busd\s*\d/i);
    }
  });

  test("free pilot plan displayPrice is literal 'FREE · pilot'", () => {
    const p = freePilotPlan();
    expect(p.displayPrice).toBe("FREE · pilot");
  });
});

describe("plan-catalog · exactly one free pilot plan", () => {
  test("exactly one entry has isFreePilot=true", () => {
    const n = PLAN_CATALOG.filter((p) => p.isFreePilot).length;
    expect(n).toBe(1);
  });

  test("freePilotPlan() returns 'family_safety_pilot_free'", () => {
    expect(freePilotPlan().id).toBe("family_safety_pilot_free");
  });

  test("activatableInPhase1() includes only the free pilot id", () => {
    expect(activatableInPhase1()).toEqual(["family_safety_pilot_free"]);
  });
});

describe("plan-catalog · lookups", () => {
  test("getPlanById returns the correct entry", () => {
    expect(getPlanById("family_safety_pilot_free")?.id).toBe(
      "family_safety_pilot_free",
    );
    expect(getPlanById("family_safety_tbd_1")?.id).toBe("family_safety_tbd_1");
  });

  test("getPlanById returns null for an unknown id", () => {
    expect(getPlanById("made_up_plan")).toBe(null);
    expect(getPlanById("")).toBe(null);
  });

  test("listAllPlans returns the full catalog", () => {
    expect(listAllPlans().length).toBe(PLAN_CATALOG.length);
  });
});

describe("plan-catalog · features copy", () => {
  test("every plan has at least one feature bullet", () => {
    for (const plan of PLAN_CATALOG) {
      expect(plan.features.length).toBeGreaterThan(0);
    }
  });

  test("free pilot plan mentions SIMULATED transactions", () => {
    const p = freePilotPlan();
    const combined = p.features.join(" ").toLowerCase();
    expect(combined).toMatch(/simulated/);
  });
});
