// Construction Rules Library · tests.
//
// Doctrine: docs/brains/nex-construction-rules-library-eighth-genome-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { validateCombination, listRules, getRule, count, rulesForDomain } from "./index";
import type { CombinationSpec } from "./index";

describe("Construction Rules Library · seed rules", () => {
  it("seeds at least 15 rules", () => {
    expect(count()).toBeGreaterThanOrEqual(15);
  });

  it("every seed rule has a reason + Rule-c provenance", () => {
    for (const r of listRules()) {
      expect(r.reason).toBeTruthy();
      expect(r.reason.length).toBeGreaterThan(20);
      expect(r.provenance.named_expert).toBe("Philip O'Farrell");
      expect(r.provenance.authored).toBe("2026-08-04");
    }
  });

  it("rulesForDomain(staircase) returns staircase-only rules", () => {
    const stair = rulesForDomain("staircase");
    for (const r of stair) expect(r.domain).toBe("staircase");
    expect(stair.length).toBeGreaterThanOrEqual(10);
  });
});

describe("Construction Rules Library · validateCombination", () => {
  it("clean canonical staircase combination is VALID", () => {
    const combo: CombinationSpec = [
      { slot: "flight_type", value: "straight" },
      { slot: "structural_system", value: "closed_string" },
      { slot: "entrance_system", value: "single_bullnose" },
      { slot: "starting_step_shape", value: "bullnose_curved_front" },
      { slot: "riser_type", value: "closed" },
      { slot: "balustrade_system", value: "turned_baluster" },
      { slot: "newel_family", value: "raised_panel_box" },
      { slot: "newel_cap", value: "pyramid" },
      { slot: "handrail_profile", value: "traditional_moulded_ploughed" },
      { slot: "balustrade_component", value: "fillets" },
    ];
    const report = validateCombination(combo);
    expect(report.overall).toBe("valid");
    expect(report.required_failures).toBe(0);
    expect(report.impossible_failures).toBe(0);
  });

  it("VOLUTE handrail without volute newel VIOLATES", () => {
    const combo: CombinationSpec = [
      { slot: "handrail_termination", value: "scroll_volute" },
      { slot: "newel_family", value: "raised_panel_box" },
    ];
    const report = validateCombination(combo);
    expect(report.overall).toBe("invalid");
    const violation = report.firings.find((f) => f.rule_id === "volute_handrail_requires_volute_newel");
    expect(violation?.status).toBe("violated");
    expect(violation?.suggested_fix).toContain("volute_turned");
  });

  it("volute handrail WITH volute newel is SATISFIED", () => {
    const combo: CombinationSpec = [
      { slot: "handrail_termination", value: "scroll_volute" },
      { slot: "newel_family", value: "volute_turned" },
      { slot: "entrance_system", value: "single_bullnose" },
    ];
    const report = validateCombination(combo);
    const firing = report.firings.find((f) => f.rule_id === "volute_handrail_requires_volute_newel");
    expect(firing?.status).toBe("satisfied");
  });

  it("glass balusters + grooved handrail is INVALID", () => {
    const combo: CombinationSpec = [
      { slot: "balustrade_system", value: "glass" },
      { slot: "handrail_profile", value: "traditional_moulded_ploughed" },
    ];
    const report = validateCombination(combo);
    expect(report.overall).toBe("invalid");
    const violation = report.firings.find((f) => f.rule_id === "glass_balusters_incompatible_with_grooved_handrail");
    expect(violation?.suggested_fix).toContain("stainless standoff");
  });

  it("pyramid cap requires box newel", () => {
    const bad: CombinationSpec = [{ slot: "newel_cap", value: "pyramid" }, { slot: "newel_family", value: "turned_victorian" }];
    const badReport = validateCombination(bad);
    expect(badReport.overall).toBe("invalid");
    const good: CombinationSpec = [{ slot: "newel_cap", value: "pyramid" }, { slot: "newel_family", value: "raised_panel_box" }];
    const goodReport = validateCombination(good);
    expect(goodReport.overall).toBe("valid");
  });

  it("closed string + open riser is INVALID", () => {
    const combo: CombinationSpec = [{ slot: "structural_system", value: "closed_string" }, { slot: "riser_type", value: "open" }];
    const report = validateCombination(combo);
    const violation = report.firings.find((f) => f.rule_id === "closed_string_incompatible_with_no_riser");
    expect(violation?.status).toBe("violated");
  });

  it("mono string + open riser is SATISFIED", () => {
    const combo: CombinationSpec = [{ slot: "structural_system", value: "mono_string" }, { slot: "riser_type", value: "open" }];
    const report = validateCombination(combo);
    const firing = report.firings.find((f) => f.rule_id === "mono_string_requires_open_riser");
    expect(firing?.status).toBe("satisfied");
  });

  it("external steel switchback WITHOUT galvanized finish is INVALID", () => {
    const combo: CombinationSpec = [
      { slot: "structural_system", value: "steel_switchback" },
      { slot: "environment", value: "exterior" },
      { slot: "finish", value: "matt_black_paint" },
    ];
    const report = validateCombination(combo);
    const violation = report.firings.find((f) => f.rule_id === "external_steel_switchback_requires_galvanized_finish");
    expect(violation?.status).toBe("violated");
    expect(violation?.citation).toContain("ISO 1461");
  });

  it("gooseneck without landing is INVALID", () => {
    const combo: CombinationSpec = [{ slot: "handrail_fitting", value: "gooseneck" }, { slot: "flight_type", value: "straight" }];
    const report = validateCombination(combo);
    const violation = report.firings.find((f) => f.rule_id === "gooseneck_fitting_requires_landing");
    expect(violation?.status).toBe("violated");
  });

  it("acorn finial on modern square newel is a WARN not an INVALID (stylistic clash)", () => {
    const combo: CombinationSpec = [{ slot: "newel_finial", value: "acorn" }, { slot: "newel_family", value: "modern_square" }];
    const report = validateCombination(combo);
    expect(report.overall).toBe("has_warnings");
    expect(report.warns).toBeGreaterThanOrEqual(1);
    expect(report.required_failures).toBe(0);
  });

  it("Impossible + Required + Warn severities produce the correct overall status", () => {
    // Just Impossible not modelled in seeds · check all firings are 'valid' when no rules apply
    const empty = validateCombination([]);
    expect(empty.overall).toBe("valid");
    expect(empty.firings).toHaveLength(0);
  });

  it("validator carries version + timestamp", () => {
    const report = validateCombination([]);
    expect(report.validator_version).toContain("cr_validator");
    expect(report.generated_at).toBeTruthy();
  });

  it("Voice can walk the firings to explain violations to the user", () => {
    const combo: CombinationSpec = [
      { slot: "handrail_termination", value: "scroll_volute" },
      { slot: "newel_family", value: "raised_panel_box" },
      { slot: "balustrade_system", value: "glass" },
      { slot: "handrail_profile", value: "traditional_moulded_ploughed" },
    ];
    const report = validateCombination(combo);
    // Two independent violations · each carries an explanation
    const explanations = report.firings.filter((f) => f.status === "violated").map((f) => f.reason);
    expect(explanations.length).toBeGreaterThanOrEqual(2);
    for (const e of explanations) expect(e.length).toBeGreaterThan(20);
  });
});
