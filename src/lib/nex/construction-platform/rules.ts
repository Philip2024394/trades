// Construction Intelligence Platform · seed ruleset.
//
// Starter rules for staircase + kitchen · Rule-c attributable to Philip
// O'Farrell with regulation citations. Domain packs will extend this ·
// never inlined outside this module.
//
// Doctrine: docs/brains/nex-phase-e3-e8-roadmap-and-design-history-philip-2026-08-04.md

import type { ConstructionRule } from "./types";

const PHILIP = "Philip O'Farrell";
const AUTHORED = "2026-08-04";

export const CONSTRUCTION_RULES: readonly ConstructionRule[] = [
  // ─── Staircase · UK Building Regs Part K (primary domestic) ─────────
  { id: "stair.rise_max_mm.domestic_primary", domain: "staircase", category: "building_regulation", severity: "required", title: "Maximum riser height (primary staircase · domestic)", citation: "Building Regs Approved Doc K · England · Table 1.1", max: 220, unit: "mm", applies_when: "location=domestic · use=primary", advice: "Riser height must not exceed 220mm in a private domestic staircase.", provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { id: "stair.going_min_mm.domestic_primary", domain: "staircase", category: "building_regulation", severity: "required", title: "Minimum going (tread depth) · primary domestic", citation: "Building Regs Approved Doc K · Table 1.1", min: 220, unit: "mm", applies_when: "location=domestic · use=primary", advice: "Going must be at least 220mm on a private domestic primary staircase.", provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { id: "stair.pitch_max_deg.domestic_primary", domain: "staircase", category: "building_regulation", severity: "required", title: "Maximum pitch angle · primary domestic", citation: "Building Regs Approved Doc K", max: 42, unit: "deg", applies_when: "location=domestic · use=primary", advice: "Pitch must not exceed 42° in a private domestic primary staircase.", provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { id: "stair.headroom_min_mm", domain: "staircase", category: "clearance", severity: "required", title: "Minimum headroom above pitch line", citation: "Building Regs Approved Doc K", min: 2000, unit: "mm", advice: "Clear headroom of at least 2m must be maintained above the pitch line.", provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { id: "stair.handrail_height_min_mm", domain: "staircase", category: "safety", severity: "required", title: "Handrail height (top of handrail above pitch line)", citation: "Building Regs Approved Doc K", min: 900, max: 1000, unit: "mm", advice: "Handrail top must be 900–1000mm above the pitch line.", provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { id: "stair.baluster_gap_max_mm", domain: "staircase", category: "safety", severity: "required", title: "Baluster gap max (100mm sphere rule)", citation: "Building Regs Approved Doc K · Section 3.3", max: 100, unit: "mm", advice: "A 100mm diameter sphere must not pass through any opening in the balustrade.", provenance: { named_expert: PHILIP, authored: AUTHORED } },

  // ─── Kitchen · industry-standard clearances ─────────────────────────
  { id: "kitchen.island_clearance_min_mm", domain: "kitchen", category: "clearance", severity: "advisory", title: "Minimum clearance around a kitchen island", min: 1000, unit: "mm", advice: "Allow at least 1000mm clearance around an island for comfortable working. 1200mm is preferred with appliances.", provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { id: "kitchen.worktop_depth_standard_mm", domain: "kitchen", category: "manufacturability", severity: "info", title: "Standard worktop depth", min: 600, max: 650, unit: "mm", advice: "Standard UK worktop depth is 600–650mm. Bespoke depths outside this incur cost + lead-time.", provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { id: "kitchen.oven_ventilation_gap_min_mm", domain: "kitchen", category: "clearance", severity: "required", title: "Oven ventilation gap (behind carcass)", min: 25, unit: "mm", advice: "Built-in ovens require a minimum 25mm ventilation gap at the rear · check specific manufacturer spec.", provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { id: "kitchen.induction_extraction_gap_min_mm", domain: "kitchen", category: "safety", severity: "required", title: "Induction hob to extractor clearance", min: 650, unit: "mm", advice: "Maintain at least 650mm between induction hob surface and extractor. Gas hobs require 750mm.", provenance: { named_expert: PHILIP, authored: AUTHORED } },

  // ─── Structural / manufacturability ─────────────────────────────────
  { id: "structural.floor_load_domestic_min_kg_per_m2", domain: "structural", category: "load_bearing", severity: "advisory", title: "Domestic floor loading (imposed load)", min: 150, unit: "kg/m²", advice: "Domestic floors are designed for at least 1.5 kN/m² (~150 kg/m²) imposed load. Heavy islands or stone benches may require assessment.", provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { id: "manufacture.max_panel_length_mm", domain: "structural", category: "manufacturability", severity: "info", title: "Standard sheet panel maximum length", max: 3050, unit: "mm", advice: "Standard sheet materials cap at ~3050mm. Longer runs require jointing or bespoke sheets.", provenance: { named_expert: PHILIP, authored: AUTHORED } },
];

export const RULES_INDEX = new Map<string, ConstructionRule>(CONSTRUCTION_RULES.map((r) => [r.id, r]));

export function listRules(): readonly ConstructionRule[] { return CONSTRUCTION_RULES; }
export function getRule(id: string): ConstructionRule | undefined { return RULES_INDEX.get(id); }
export function rulesForDomain(domain: ConstructionRule["domain"]): readonly ConstructionRule[] {
  return CONSTRUCTION_RULES.filter((r) => r.domain === domain);
}
