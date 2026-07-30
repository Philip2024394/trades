// NEX Geometry Module — Measurement Solver tests.
//
// Covers:
//   - Canonical UK domestic case (2800mm floor → 14 risers @ 200mm)
//   - Ireland yields identical result at this level (regs match today)
//   - Impossible cases return ok:false with useful notes, no fabrication
//   - Preferred-going affects which candidate wins ranking
//   - Compliance verdicts flip correctly at boundary values

import { describe, expect, it } from "vitest";
import { solveStaircaseGeometry } from "./solver";
import type { ShellFamily } from "../staircase-components/types";

const straightClosedFamily: ShellFamily = {
  family_id:    "SHELL_STRAIGHT_CLOSED",
  family_name:  "Straight, Closed-String Both Sides",
  component_type: "shell",
  layout:       "straight_flight",
  hand:         "none",
  construction: "housed_closed",
  string_configuration: "closed_both_sides",
  open_risers:  false,
  top_landing_connection: {
    enabled: true,
    reduced_tread: true,
    sits_on_trimmer: true,
    final_riser_against_trimmer: true,
    flooring_allowance: "configurable",
    carpet_allowance:   "configurable",
  },
  bottom_detail_default: { type: "standard_start" },
  landing_default:       { included: false },
  balustrade_supported:  true,
  handrail_supported:    true,
  materials_supported:   ["oak", "walnut", "ash", "painted"],
  handrail_positions_supported: ["left", "right", "both"],
  balustrade_types_supported:   ["timber", "glass", "stainless", "mixed"],
  design_envelope: {
    rise_mm:  { recommended: { min: 170, max: 190 }, absolute: { min: 150, max: 220 } },
    going_mm: { recommended: { min: 240, max: 280 }, absolute: { min: 220, max: 300 } },
    width_mm: { min: 600, max: 1200 },
  },
  created_at:    "2026-07-29T15:50:00Z",
  created_by:    "philip",
  revision:      5,
  review_status: "locked",
};

describe("solveStaircaseGeometry — canonical UK domestic", () => {
  // The family's recommended rise range is 170-190mm (midpoint 180).
  // The solver picks the riser count that lands rise closest to that
  // midpoint. For 2600mm floor: 14 risers @ 185.7mm (distance 5.7)
  // beats 15 risers @ 173.3 (distance 6.7). SHELL_STRAIGHT_CLOSED_13
  // wins because treads = 14 - 1 = 13.
  it("2600mm floor · England · dwelling → picks 14 risers, SHELL_STRAIGHT_CLOSED_13", () => {
    const result = solveStaircaseGeometry({
      floor_to_floor_height_mm: 2600,
      jurisdiction:  "england",
      building_type: "dwelling",
      family:        straightClosedFamily,
    });
    expect(result.ok).toBe(true);
    expect(result.primary_geometry).toBeDefined();
    expect(result.primary_geometry!.risers_count).toBe(14);
    expect(result.primary_geometry!.treads_count).toBe(13);
    expect(result.primary_geometry!.rise_mm).toBe(185.7);
    expect(result.primary_geometry!.id).toBe("SHELL_STRAIGHT_CLOSED_13");
    expect(result.primary_geometry!.compliance.verdict).toBe("compliant");
  });

  it("2600mm floor · Ireland · dwelling → identical primary result (regs match today)", () => {
    const uk = solveStaircaseGeometry({
      floor_to_floor_height_mm: 2600,
      jurisdiction:  "england",
      building_type: "dwelling",
      family:        straightClosedFamily,
    });
    const ie = solveStaircaseGeometry({
      floor_to_floor_height_mm: 2600,
      jurisdiction:  "republic_of_ireland",
      building_type: "dwelling",
      family:        straightClosedFamily,
    });
    expect(uk.primary_geometry!.risers_count).toBe(ie.primary_geometry!.risers_count);
    expect(uk.primary_geometry!.rise_mm).toBe(ie.primary_geometry!.rise_mm);
    expect(uk.primary_geometry!.id).toBe(ie.primary_geometry!.id);
    // Citations differ (Approved Doc K vs TGD K) but verdict identical.
    expect(uk.primary_geometry!.compliance.verdict).toBe(ie.primary_geometry!.compliance.verdict);
  });
});

describe("solveStaircaseGeometry — impossible cases return ok:false, never fabricated geometry", () => {
  it("100mm floor is too short for any valid rise → ok:false with useful note", () => {
    // 100/2 = 50mm rise (below effective min 150). MIN_RISER_COUNT=2 so
    // solver can't try 1 riser. No valid combos.
    const result = solveStaircaseGeometry({
      floor_to_floor_height_mm: 100,
      jurisdiction:  "england",
      building_type: "dwelling",
      family:        straightClosedFamily,
    });
    expect(result.ok).toBe(false);
    expect(result.primary_geometry).toBeUndefined();
    expect(result.solver_notes.join(" ")).toMatch(/no valid riser count/i);
  });

  it("Missing jurisdiction rules for scotland → ok:false with helpful pointer", () => {
    const result = solveStaircaseGeometry({
      floor_to_floor_height_mm: 2800,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jurisdiction:  "scotland" as any,
      building_type: "dwelling",
      family:        straightClosedFamily,
    });
    expect(result.ok).toBe(false);
    expect(result.solver_notes.join(" ")).toMatch(/no jurisdiction rules/i);
  });

  it("Family without design_envelope → ok:false with clear note", () => {
    const familyWithoutEnvelope: ShellFamily = { ...straightClosedFamily, design_envelope: undefined };
    const result = solveStaircaseGeometry({
      floor_to_floor_height_mm: 2800,
      jurisdiction:  "england",
      building_type: "dwelling",
      family:        familyWithoutEnvelope,
    });
    expect(result.ok).toBe(false);
    expect(result.solver_notes.join(" ")).toMatch(/design_envelope/);
  });
});

describe("solveStaircaseGeometry — preferred_going affects ranking", () => {
  it("preferred_going 250mm is inside recommended range → applied to primary", () => {
    const result = solveStaircaseGeometry({
      floor_to_floor_height_mm: 2800,
      jurisdiction:  "england",
      building_type: "dwelling",
      family:        straightClosedFamily,
      preferred_going_mm: 250,
    });
    expect(result.ok).toBe(true);
    expect(result.primary_geometry!.going_mm).toBe(250);
  });

  it("preferred_going 500mm exceeds regulation max_going → clamped to family max", () => {
    const result = solveStaircaseGeometry({
      floor_to_floor_height_mm: 2800,
      jurisdiction:  "england",
      building_type: "dwelling",
      family:        straightClosedFamily,
      preferred_going_mm: 500,
    });
    expect(result.ok).toBe(true);
    // Clamped to min(regulation.max=300, family.absolute.max=300) = 300.
    expect(result.primary_geometry!.going_mm).toBe(300);
  });
});

describe("solveStaircaseGeometry — compliance boundary behaviour", () => {
  it("Boundary case: 220mm rise (regulation max) → compliant, not warning", () => {
    // Choose floor height that lands exactly on 220mm rise: 220 × N. Pick N=12 → floor=2640.
    const result = solveStaircaseGeometry({
      floor_to_floor_height_mm: 2640,
      jurisdiction:  "england",
      building_type: "dwelling",
      family:        straightClosedFamily,
    });
    expect(result.ok).toBe(true);
    // At least one candidate should have rise=220 exactly.
    const at220 = [result.primary_geometry, ...result.alternatives].find(
      (g) => g && g.rise_mm === 220
    );
    expect(at220).toBeDefined();
    expect(at220!.compliance.verdict).toBe("compliant");
  });
});

describe("solveStaircaseGeometry — flight length: legal vs best-practice (Patch 3)", () => {
  // A 20-riser flight ≈ 3600mm floor at 180mm rise. Legal in England
  // (36-riser max), illegal in Ireland (16-riser max). Same input
  // yields different verdicts — the value of the jurisdiction split.
  it("England · 20 risers · legal but exceeds recommended 16 → compliant with warning", () => {
    const result = solveStaircaseGeometry({
      floor_to_floor_height_mm: 3600,
      jurisdiction:  "england",
      building_type: "dwelling",
      family:        straightClosedFamily,
    });
    expect(result.ok).toBe(true);
    expect(result.primary_geometry!.risers_count).toBe(20);
    expect(result.primary_geometry!.compliance.verdict).toBe("compliant");
    // Advisory should reference the legal citation + recommendation.
    const joined = result.warnings.join(" ");
    expect(joined).toMatch(/legally permissible/i);
    expect(joined).toMatch(/recommended.*16/i);
    expect(joined).toMatch(/quarter-landing|half-turn/i);
  });

  it("Ireland · 20 risers · exceeds 16-riser legal max → non_compliant with citation", () => {
    const result = solveStaircaseGeometry({
      floor_to_floor_height_mm: 3600,
      jurisdiction:  "republic_of_ireland",
      building_type: "dwelling",
      family:        straightClosedFamily,
    });
    expect(result.ok).toBe(true); // solver still returns a geometry
    expect(result.primary_geometry!.risers_count).toBe(20);
    expect(result.primary_geometry!.compliance.verdict).toBe("non_compliant");
    // The failing check should be FLIGHT_MAX_LEGAL with Irish citation.
    const failing = result.primary_geometry!.compliance.checks.find(
      (c) => c.rule_id === "FLIGHT_MAX_LEGAL" && !c.passed
    );
    expect(failing).toBeDefined();
    expect(failing!.citation).toMatch(/Technical Guidance Document K \(Ireland\)/);
  });

  it("England · 16 risers · at recommended boundary → compliant, NO warning", () => {
    // 16 × 180 = 2880mm floor. Exact recommended max.
    const result = solveStaircaseGeometry({
      floor_to_floor_height_mm: 2880,
      jurisdiction:  "england",
      building_type: "dwelling",
      family:        straightClosedFamily,
    });
    expect(result.ok).toBe(true);
    expect(result.primary_geometry!.risers_count).toBe(16);
    expect(result.primary_geometry!.compliance.verdict).toBe("compliant");
    // At the boundary — no advisory warning (rule is > not >=).
    const advisory = result.warnings.find((w) => /legally permissible/.test(w));
    expect(advisory).toBeUndefined();
  });
});

describe("solveStaircaseGeometry — every reply carries citations", () => {
  it("Compliance checks include their regulation citation", () => {
    const result = solveStaircaseGeometry({
      floor_to_floor_height_mm: 2800,
      jurisdiction:  "england",
      building_type: "dwelling",
      family:        straightClosedFamily,
    });
    const checks = result.primary_geometry!.compliance.checks;
    expect(checks.length).toBeGreaterThan(0);
    for (const c of checks) {
      expect(c.citation).toBeTruthy();
      expect(c.rule_id).toBeTruthy();
      expect(c.source).toBeTruthy();
    }
  });
});
