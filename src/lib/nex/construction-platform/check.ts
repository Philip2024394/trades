// Construction Intelligence Platform · compliance checker.
//
// Doctrine: docs/brains/nex-phase-e3-e8-roadmap-and-design-history-philip-2026-08-04.md

import type { ComplianceQuery, ComplianceReport, ComplianceCheck } from "./types";
import { rulesForDomain } from "./rules";

/** Naive rule → measurement mapping (rule id suffix determines which measurement key to compare against).
 *  This intentionally stays simple · richer bindings come with domain packs. */
const RULE_TO_METRIC: Record<string, string> = {
  "stair.rise_max_mm.domestic_primary": "riser_height_mm",
  "stair.going_min_mm.domestic_primary": "going_mm",
  "stair.pitch_max_deg.domestic_primary": "pitch_deg",
  "stair.headroom_min_mm": "headroom_mm",
  "stair.handrail_height_min_mm": "handrail_height_mm",
  "stair.baluster_gap_max_mm": "baluster_gap_mm",
  "kitchen.island_clearance_min_mm": "island_clearance_mm",
  "kitchen.worktop_depth_standard_mm": "worktop_depth_mm",
  "kitchen.oven_ventilation_gap_min_mm": "oven_ventilation_gap_mm",
  "kitchen.induction_extraction_gap_min_mm": "extractor_clearance_mm",
  "structural.floor_load_domestic_min_kg_per_m2": "floor_load_kg_per_m2",
  "manufacture.max_panel_length_mm": "panel_length_mm",
};

export function check(query: ComplianceQuery): ComplianceReport {
  const rules = rulesForDomain(query.domain);
  const checks: ComplianceCheck[] = [];
  for (const rule of rules) {
    const metricKey = RULE_TO_METRIC[rule.id];
    const measurement = metricKey ? query.measurements[metricKey] : undefined;
    if (!measurement) continue;
    const value = measurement.value;
    const belowMin = rule.min !== undefined && value < rule.min;
    const aboveMax = rule.max !== undefined && value > rule.max;
    const passed = !belowMin && !aboveMax;
    checks.push({
      rule_id: rule.id,
      domain: rule.domain,
      severity: rule.severity,
      passed,
      measured: value,
      citation: rule.citation,
      message: passed
        ? `PASS · ${rule.title} · measured ${value}${rule.unit ?? ""}`
        : `FAIL · ${rule.title} · measured ${value}${rule.unit ?? ""} · rule ${rule.min !== undefined ? `min ${rule.min}` : ""}${rule.max !== undefined ? ` max ${rule.max}` : ""}${rule.unit ? ` ${rule.unit}` : ""}. ${rule.advice}`,
    });
  }
  const passes = checks.filter((c) => c.passed).length;
  const advisories = checks.filter((c) => !c.passed && c.severity === "advisory").length;
  const failures = checks.filter((c) => !c.passed && c.severity === "required").length;
  return {
    domain: query.domain,
    checks,
    total_rules_checked: checks.length,
    passes,
    advisories,
    failures,
    generated_at: new Date().toISOString(),
  };
}
