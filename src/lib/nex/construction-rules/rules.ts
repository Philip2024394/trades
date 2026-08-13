// Construction Rules Library · authored seed rules (Philip 2026-08-04).
//
// Every rule is Rule-c attributable to Philip O'Farrell. Every rule has a
// `reason` field so consumers (Voice · Reality Advisor · Manufacturing) can
// EXPLAIN violations rather than just report them.
//
// Doctrine: docs/brains/nex-construction-rules-library-eighth-genome-philip-2026-08-04.md

import type { ConstructionRule } from "./types";

const PHILIP = "Philip O'Farrell";
const AUTHORED = "2026-08-04";

export const SEED_RULES: readonly ConstructionRule[] = [
  // ─── Staircase · component combination rules ────────────────────────
  {
    rule_id: "volute_handrail_requires_volute_newel",
    domain: "staircase",
    severity: "required",
    reason: "A scroll volute handrail termination needs a matching turned volute newel to anchor the spiral · without it the handrail cannot terminate cleanly.",
    if_present: [{ slot: "handrail_termination", value: "scroll_volute" }],
    then_requires: [{ slot: "newel_family", value: "volute_turned" }],
    suggested_fix: "Swap the newel family to volute_turned (or volute_turned_twin for a symmetric entrance).",
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    rule_id: "glass_balusters_incompatible_with_grooved_handrail",
    domain: "staircase",
    severity: "required",
    reason: "Glass balustrades cannot be fitted into the ploughed groove of a traditional timber handrail · glass requires stainless standoffs or a square contemporary rail.",
    if_present: [{ slot: "balustrade_system", value: "glass" }],
    forbids: [{ slot: "handrail_profile", value: "traditional_moulded_ploughed" }],
    suggested_fix: "Use HANDRAIL_TRADITIONAL_SOLID_V1 with stainless standoff clamps OR switch to a square contemporary handrail.",
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    rule_id: "pyramid_cap_requires_box_newel",
    domain: "staircase",
    severity: "required",
    reason: "A pyramid newel cap is designed for a square-topped box newel · not a turned newel · because the moulding steps rest on a flat square face.",
    if_present: [{ slot: "newel_cap", value: "pyramid" }],
    then_requires: [{ slot: "newel_family", value: "raised_panel_box" }],
    suggested_fix: "Use a turned finial (acorn · ball · urn) on turned newels instead of a pyramid cap.",
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    rule_id: "acorn_finial_incompatible_with_modern_square_newel",
    domain: "staircase",
    severity: "warn",
    reason: "Turned acorn finials read as traditional/heritage · placing them on a modern square newel is a stylistic clash rather than a manufacturing failure.",
    if_present: [{ slot: "newel_finial", value: "acorn" }],
    forbids: [{ slot: "newel_family", value: "modern_square" }],
    suggested_fix: "Use a contemporary_cube or metal_finial on modern_square newels · save the acorn for turned_victorian newels.",
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    rule_id: "bullnose_requires_entrance_system",
    domain: "staircase",
    severity: "required",
    reason: "A bullnose starting step is an entrance feature · declaring one without an entrance_system leaves the staircase without a structural start.",
    if_present: [{ slot: "starting_step_shape", value: "bullnose_curved_front" }],
    then_requires: [{ slot: "entrance_system", value: "single_bullnose" }],
    suggested_fix: "Add entrance_system=single_bullnose OR double_bullnose OR full_bullnose_platform.",
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    rule_id: "closed_string_incompatible_with_no_riser",
    domain: "staircase",
    severity: "required",
    reason: "A closed-string housed staircase relies on riser boards for structural rigidity · removing them undermines the joinery system.",
    if_present: [{ slot: "structural_system", value: "closed_string" }],
    forbids: [{ slot: "riser_type", value: "open" }],
    suggested_fix: "Switch structural_system to double_housed_string with braced treads OR add closed riser boards.",
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    rule_id: "mono_string_requires_open_riser",
    domain: "staircase",
    severity: "warn",
    reason: "A mono-string steel spine is designed to expose the treads · closed risers destroy the floating aesthetic and require additional bracket work.",
    if_present: [{ slot: "structural_system", value: "mono_string" }],
    then_requires: [{ slot: "riser_type", value: "open" }],
    suggested_fix: "Remove riser boards · use open_riser to preserve the floating appearance.",
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    rule_id: "external_steel_switchback_requires_galvanized_finish",
    domain: "staircase",
    severity: "required",
    citation: "BS EN ISO 1461 · hot-dip galvanizing",
    reason: "An exterior steel staircase must be corrosion-protected · unfinished mild steel will fail within a few years in UK weather.",
    if_present: [{ slot: "structural_system", value: "steel_switchback" }, { slot: "environment", value: "exterior" }],
    then_requires: [{ slot: "finish", value: "hot_dip_galvanized" }],
    suggested_fix: "Specify hot_dip_galvanized OR powder_coated_over_galvanized for external steel stairs.",
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },

  // ─── Handrail fitting rules ──────────────────────────────────────────
  {
    rule_id: "gooseneck_fitting_requires_landing",
    domain: "staircase",
    severity: "required",
    reason: "A gooseneck fitting transitions the handrail vertically at a landing · without a landing there is no vertical rise to accommodate.",
    if_present: [{ slot: "handrail_fitting", value: "gooseneck" }],
    then_requires: [{ slot: "flight_type", value: "half_landing" }],
    suggested_fix: "Use over_easing or under_easing for a flight without a landing.",
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    rule_id: "volute_start_requires_curtail_step",
    domain: "staircase",
    severity: "required",
    reason: "The spiral of a volute needs a wider entrance step (curtail or bullnose) so the handrail can curl into the volute · a square start leaves no room.",
    if_present: [{ slot: "handrail_start", value: "volute" }],
    then_requires: [{ slot: "entrance_system", value: "single_bullnose" }],
    suggested_fix: "Add a single_bullnose or double_bullnose entrance · or use a straight rail if a square start is preferred.",
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    rule_id: "ploughed_handrail_requires_fillets",
    domain: "staircase",
    severity: "required",
    reason: "The ploughed groove on a traditional handrail is designed to receive balusters + timber fillets · without fillets the balusters cannot lock into the rail.",
    if_present: [{ slot: "handrail_profile", value: "traditional_moulded_ploughed" }],
    then_requires: [{ slot: "balustrade_component", value: "fillets" }],
    suggested_fix: "Add matching timber fillets · or switch to solid_ungrooved handrail with concealed dowel fixings.",
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    rule_id: "solid_handrail_blank_wall_mount_only",
    domain: "staircase",
    severity: "warn",
    reason: "A solid handrail blank has no ploughed groove · it cannot accept balusters unless machined · so shipping it as a stair handrail without further machining will leave the staircase without a balustrade fitting method.",
    if_present: [{ slot: "handrail_type", value: "solid_blank" }, { slot: "manufacturing_state", value: "blank" }],
    forbids: [{ slot: "installation", value: "staircase_balustrade_direct" }],
    suggested_fix: "Use HANDRAIL_TRADITIONAL_PLOUGHED_V1 for staircase balustrades · or plan additional CNC machining before installation.",
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },

  // ─── Regulatory cross-check rules (compose with construction-platform) ─
  {
    rule_id: "domestic_handrail_height_regs",
    domain: "staircase",
    severity: "required",
    citation: "Building Regs Approved Doc K · Section 3.2",
    reason: "Domestic primary handrails must sit 900-1000mm above the pitch line for safe grip and Part K compliance.",
    if_present: [{ slot: "use", value: "primary_domestic" }],
    then_requires: [{ slot: "handrail_height_mm", value: "900_to_1000" }],
    suggested_fix: "Adjust handrail height to fall within 900-1000mm above the pitch line.",
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    rule_id: "baluster_sphere_rule",
    domain: "staircase",
    severity: "required",
    citation: "Building Regs Approved Doc K · Section 3.3",
    reason: "A 100mm sphere must not pass through any balustrade opening · this protects children and pets from falls.",
    if_present: [{ slot: "balustrade_system", value: "present" }],
    forbids: [{ slot: "baluster_gap_mm", value: "over_100" }],
    suggested_fix: "Reduce baluster spacing until no 100mm sphere can pass through any opening.",
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    rule_id: "commercial_guardrail_height",
    domain: "staircase",
    severity: "required",
    citation: "Building Regs Approved Doc K · commercial · Section 3.2",
    reason: "Commercial guardrails must be at least 1100mm to protect against workplace fall risks.",
    if_present: [{ slot: "location", value: "commercial" }, { slot: "has_guardrail", value: "true" }],
    then_requires: [{ slot: "guardrail_height_mm", value: "at_least_1100" }],
    suggested_fix: "Raise the guardrail to at least 1100mm above the finished walking surface.",
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
];

export const RULES_INDEX = new Map<string, ConstructionRule>(SEED_RULES.map((r) => [r.rule_id, r]));

export function listRules(): readonly ConstructionRule[] { return SEED_RULES; }
export function getRule(rule_id: string): ConstructionRule | undefined { return RULES_INDEX.get(rule_id); }
export function rulesForDomain(domain: ConstructionRule["domain"]): readonly ConstructionRule[] {
  return SEED_RULES.filter((r) => r.domain === domain);
}
export function count(): number { return SEED_RULES.length; }
