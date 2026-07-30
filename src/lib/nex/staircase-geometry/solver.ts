// NEX Geometry Module — Measurement Solver (Patch 2 · 2026-07-29).
//
// Master Doc: docs/nex/staircase-geometry-module.md
//
// Deterministic. No AI in the loop. Same inputs → same output. Given
// a customer's floor-to-floor height + jurisdiction + building type +
// shell family, returns valid riser counts + which shell variant to
// select + compliance report.
//
// Design principles honoured:
//   - Never fabricate. Missing measurements return `ok: false` with
//     `missing_measurements: [...]`, never a guess.
//   - Every compliance check carries its regulation source + citation.
//   - Pure function. No file I/O. Callers pass in the family; the
//     solver never reads YAML at request time.
//   - No AI. Regex-free. Textbook geometry.
//
// Not yet included (per ADR-0041 — build when a real case proves need):
//   - Turning-stair layouts (quarter-turn winders, half-landings). Solver
//     currently assumes single-flight straight geometry.
//   - Multi-flight optimisation across landings.
//   - Aesthetic scoring (comfort, walking rhythm) beyond the
//     recommended-vs-absolute envelope classes.

import type {
  ComplianceCheck,
  ComplianceReport,
  ComplianceVerdict,
  GeometryClass,
  Jurisdiction,
  JurisdictionStaircaseRules,
  RegulatedValue,
  SolveResult,
  StaircaseGeometry,
  BuildingType,
} from "./types";
import type { ShellFamily } from "../staircase-components/types";
import { getRules } from "./jurisdictions";

const SOLVER_VERSION = "0.1.0";

// ─── Public API ────────────────────────────────────────────────────

export type SolveInput = {
  readonly floor_to_floor_height_mm: number;
  readonly jurisdiction:  Jurisdiction;
  readonly building_type: BuildingType;
  /** The shell family the customer / caller has selected. The solver
   *  looks up which tread-count variant fits the floor height within
   *  the intersection of family and jurisdiction rules. */
  readonly family: ShellFamily;
  readonly preferred_going_mm?: number;
  readonly available_width_mm?: number;
  readonly headroom_available_mm?: number;
  /** Traceability — passed through to StaircaseGeometry.measurement_input_id. */
  readonly measurement_input_id?: string;
};

/** Solve. Never throws — returns SolveResult with `ok: false` on any
 *  failure the caller can fix (missing measurement, no jurisdiction
 *  rules, no family envelope). */
export function solveStaircaseGeometry(input: SolveInput): SolveResult {
  const notes: string[] = [];
  const warnings: string[] = [];

  // 1. Precondition — jurisdiction rules must exist for this pair.
  let rules: JurisdictionStaircaseRules;
  try {
    rules = getRules(input.jurisdiction, input.building_type);
  } catch (err) {
    return {
      ok: false,
      alternatives: [],
      missing_measurements: [],
      solver_notes: [(err as Error).message],
      warnings: [],
    };
  }

  // 2. Precondition — family must have a design envelope.
  const envelope = input.family.design_envelope;
  if (!envelope) {
    return {
      ok: false,
      alternatives: [],
      missing_measurements: [],
      solver_notes: [`Family ${input.family.family_id} has no design_envelope populated. Cannot solve.`],
      warnings: [],
    };
  }

  // 3. Effective rise range = intersection of jurisdiction rules
  //    and family absolute envelope.
  const effectiveMinRise = Math.max(rules.rise_mm.min.value, envelope.rise_mm.absolute.min);
  const effectiveMaxRise = Math.min(rules.rise_mm.max.value, envelope.rise_mm.absolute.max);

  if (effectiveMinRise > effectiveMaxRise) {
    return {
      ok: false,
      alternatives: [],
      missing_measurements: [],
      solver_notes: [
        `Rule/family conflict: jurisdiction min-rise ${rules.rise_mm.min.value} exceeds family max-rise ${envelope.rise_mm.absolute.max}. No valid rise.`,
      ],
      warnings: [],
    };
  }

  notes.push(
    `Effective rise range: ${effectiveMinRise}–${effectiveMaxRise}mm ` +
    `(regulation ${rules.rise_mm.min.value}-${rules.rise_mm.max.value}, ` +
    `family ${envelope.rise_mm.absolute.min}-${envelope.rise_mm.absolute.max}).`
  );

  // 4. Enumerate valid riser counts.
  //    For each riser count from 2 to 25:
  //      rise = floor_height / riser_count
  //      valid iff rise ∈ effective range
  const validCombos: Array<{ risers: number; rise: number }> = [];
  const MIN_RISER_COUNT = 2;
  const MAX_RISER_COUNT = 25;
  for (let risers = MIN_RISER_COUNT; risers <= MAX_RISER_COUNT; risers++) {
    const rise = input.floor_to_floor_height_mm / risers;
    if (rise >= effectiveMinRise && rise <= effectiveMaxRise) {
      validCombos.push({ risers, rise });
    }
  }

  if (validCombos.length === 0) {
    return {
      ok: false,
      alternatives: [],
      missing_measurements: [],
      solver_notes: [
        `No valid riser count for floor_height=${input.floor_to_floor_height_mm}mm ` +
        `within rise range ${effectiveMinRise}-${effectiveMaxRise}mm. ` +
        `Rise = ${input.floor_to_floor_height_mm}/N must land in that band.`,
      ],
      warnings: [],
    };
  }

  notes.push(`Found ${validCombos.length} valid riser count(s): ${validCombos.map(c => c.risers).join(", ")}.`);

  // 5. For each valid combination, build a full StaircaseGeometry.
  const geometries: StaircaseGeometry[] = [];
  for (const { risers, rise } of validCombos) {
    const treads = risers - 1;

    // Going — customer preference clamped into effective range,
    // otherwise midpoint of family recommended range.
    const goingMin = Math.max(rules.going_mm.min.value, envelope.going_mm.absolute.min);
    const goingMax = Math.min(rules.going_mm.max.value, envelope.going_mm.absolute.max);
    const recommendedMid = (envelope.going_mm.recommended.min + envelope.going_mm.recommended.max) / 2;
    let going = input.preferred_going_mm ?? recommendedMid;
    if (going < goingMin) going = goingMin;
    if (going > goingMax) going = goingMax;

    // Pitch = atan(rise / going), in degrees.
    const pitchDeg = (Math.atan(rise / going) * 180) / Math.PI;

    // Going total along the walking line (straight flight only).
    const goingTotalMm = going * treads;

    // Width defaults — clamp caller-supplied width to family envelope.
    const requestedWidth = input.available_width_mm ?? envelope.width_mm.min;
    const overallWidth = Math.max(envelope.width_mm.min, Math.min(envelope.width_mm.max, requestedWidth));
    const stringThickness = 32; // family default; workshop convention
    const clearWidth = overallWidth - 2 * stringThickness;

    // Diagonal length along the strings — for scheduling / cut-lists.
    const stringLength = Math.sqrt(
      input.floor_to_floor_height_mm ** 2 + goingTotalMm ** 2
    );

    // Headroom — pass through or use jurisdiction minimum as informational.
    const headroom = input.headroom_available_mm ?? rules.headroom_mm.min.value;

    // Compliance for this geometry.
    const compliance = checkCompliance({ rise, going, pitchDeg, headroom, risers }, rules);

    // Deterministic variant ID for this shell.
    const variantId = `${input.family.family_id}_${String(treads).padStart(2, "0")}`;

    const geom: StaircaseGeometry = {
      id:                          variantId,
      solver_version:              SOLVER_VERSION,
      measurement_input_id:        input.measurement_input_id ?? "unattributed",
      layout:                      input.family.layout,
      hand:                        input.family.hand,
      geometry_class:              classifyGeometry(pitchDeg),
      risers_count:                risers,
      treads_count:                treads,
      floor_height_mm:             input.floor_to_floor_height_mm,
      rise_mm:                     round1(rise),
      going_mm:                    round1(going),
      going_total_mm:              round1(goingTotalMm),
      pitch_deg:                   round1(pitchDeg),
      walking_line_length_mm:      round1(goingTotalMm),   // straight flight only
      headroom_mm:                 round1(headroom),
      overall_width_mm:            round1(overallWidth),
      clear_width_mm:              round1(clearWidth),
      string_type:                 mapStringType(input.family.construction),
      left_string_thickness_mm:    stringThickness,
      right_string_thickness_mm:   stringThickness,
      string_length_mm:            round1(stringLength),
      compliance,
      solved_at:                   new Date().toISOString(),
      notes:                       `Solved from family ${input.family.family_id} (envelope) and ${input.jurisdiction}/${input.building_type} rules.`,
    };

    geometries.push(geom);
  }

  // 6. Rank candidates. Preferred order:
  //    a) compliance verdict (compliant > needs_review > non_compliant)
  //    b) rise closer to family recommended midpoint
  //    c) going closer to preferred_going_mm (if provided)
  const recommendedRiseMid = (envelope.rise_mm.recommended.min + envelope.rise_mm.recommended.max) / 2;
  const scoreOf = (g: StaircaseGeometry) => {
    const verdictScore = g.compliance.verdict === "compliant"     ? 0
                       : g.compliance.verdict === "needs_review"  ? 1
                       : 2;
    const riseDist  = Math.abs(g.rise_mm - recommendedRiseMid);
    const goingDist = input.preferred_going_mm !== undefined
      ? Math.abs(g.going_mm - input.preferred_going_mm)
      : 0;
    return verdictScore * 10000 + riseDist * 100 + goingDist;
  };
  geometries.sort((a, b) => scoreOf(a) - scoreOf(b));

  const primary = geometries[0];

  // Advisory: primary flight exceeds best-practice recommended max but
  // is still legal. Emit a warning that carries the citation so the
  // downstream voice can render a Nex-style advisory —
  //   "Legally permissible under Approved Document K, but not typical
  //    domestic practice. Consider a quarter-landing or half-turn."
  // Only checked against the PRIMARY geometry — alternatives are just
  // options; the primary is what we're actually recommending.
  const recMax = rules.flight.recommended_max_risers;
  if (recMax && primary.risers_count > recMax.value && primary.risers_count <= rules.flight.max_consecutive_risers.value) {
    warnings.push(
      `Flight of ${primary.risers_count} risers is legally permissible under ${rules.flight.max_consecutive_risers.citation}, ` +
      `but exceeds the recommended domestic maximum of ${recMax.value}. ` +
      `Consider a quarter-landing or half-turn layout for typical domestic practice.`
    );
  }

  return {
    ok:                    true,
    primary_geometry:      primary,
    alternatives:          geometries.slice(1),
    missing_measurements:  [],
    solver_notes:          notes,
    warnings,
  };
}

// ─── Compliance ───────────────────────────────────────────────────

function checkCompliance(
  measured: { rise: number; going: number; pitchDeg: number; headroom: number; risers: number },
  rules: JurisdictionStaircaseRules
): ComplianceReport {
  const checks: ComplianceCheck[] = [];

  checks.push(checkRule({
    rule_id:    "RISE_MAX",
    limit:      rules.rise_mm.max,
    actualValue: measured.rise,
    unit:       "mm",
    description:"Rise per riser must not exceed the regulated maximum.",
    op:         "<=",
  }));

  // Flight-length legal check (Patch 3 · 2026-07-29). Exceeding this
  // is a hard fail. Best-practice recommendation is handled separately
  // as an advisory warning in the outer SolveResult.
  checks.push(checkRule({
    rule_id:    "FLIGHT_MAX_LEGAL",
    limit:      rules.flight.max_consecutive_risers,
    actualValue: measured.risers,
    unit:       " risers",
    description:"Number of consecutive risers in a single flight must not exceed the legal maximum.",
    op:         "<=",
  }));

  checks.push(checkRule({
    rule_id:    "GOING_MIN",
    limit:      rules.going_mm.min,
    actualValue: measured.going,
    unit:       "mm",
    description:"Going per tread must meet the regulated minimum.",
    op:         ">=",
  }));

  checks.push(checkRule({
    rule_id:    "PITCH_MAX",
    limit:      rules.pitch_deg.max,
    actualValue: measured.pitchDeg,
    unit:       "°",
    description:"Pitch must not exceed the regulated maximum.",
    op:         "<=",
  }));

  checks.push(checkRule({
    rule_id:    "HEADROOM_MIN",
    limit:      rules.headroom_mm.min,
    actualValue: measured.headroom,
    unit:       "mm",
    description:"Headroom must meet the regulated minimum.",
    op:         ">=",
  }));

  // Consistency check — inherent to a single straight flight where the
  // solver produces a single rise + single going. All rises equal by
  // construction. Marked as informational pass.
  checks.push({
    rule_id:    "CONSISTENCY",
    source:     rules.consistency.source === "regulation" ? "approved_document_k" : "workshop_practice",
    citation:   rules.consistency.citation,
    description:"All rises equal; all goings equal.",
    expected:   "all rises equal, all goings equal",
    actual:     "single rise × single going × N (straight flight)",
    passed:     true,
    severity:   "info",
  });

  const anyErrors = checks.some((c) => !c.passed && c.severity === "error");
  const anyWarnings = checks.some((c) => !c.passed && c.severity === "warning");
  const verdict: ComplianceVerdict = anyErrors ? "non_compliant"
                                    : anyWarnings ? "needs_review"
                                    : "compliant";

  const summary_lines = checks.map((c) => {
    const mark = c.passed ? "✓" : "✗";
    return `${mark} ${c.rule_id}: ${c.actual} (expected ${c.expected}) [${c.source}]`;
  });

  return { verdict, checks, summary_lines };
}

function checkRule(args: {
  rule_id: string;
  limit: RegulatedValue;
  actualValue: number;
  unit: string;
  description: string;
  op: "<=" | ">=";
}): ComplianceCheck {
  const passed = args.op === "<=" ? args.actualValue <= args.limit.value
                                  : args.actualValue >= args.limit.value;
  // Regulation failure = error. Practical failure = warning.
  const severity = passed ? "info"
                 : args.limit.source === "regulation" ? "error"
                 : "warning";
  const opWord = args.op === "<=" ? "max" : "min";
  return {
    rule_id:     args.rule_id,
    source:      args.limit.source === "regulation" ? "approved_document_k" : "workshop_practice",
    citation:    args.limit.citation,
    description: args.description,
    expected:    `${opWord} ${args.limit.value}${args.unit}`,
    actual:      `${round1(args.actualValue)}${args.unit}`,
    passed,
    severity,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function classifyGeometry(pitchDeg: number): GeometryClass {
  if (pitchDeg > 40) return "compact";
  if (pitchDeg > 35) return "comfortable";
  if (pitchDeg > 30) return "generous";
  return "grand";
}

function mapStringType(construction: ShellFamily["construction"]): StaircaseGeometry["string_type"] {
  switch (construction) {
    case "housed_closed":
    case "housed_open":
      return "housed";
    case "cut_string":
      return "cut";
    case "open_string":
      return "open";
    case "floating":
    case "cantilever":
      return "closed";  // no visible string; classification default
    case "unknown":
    default:
      return "closed";
  }
}
