// Sketch Intelligence Platform (SIP) · 9-stage interpreter (MVP).
//
// Given a SketchInput with primitives + user intent + requested material +
// requested style, produces a full SketchInterpretation. Vision-model
// upgrades slot in without changing the contract.
//
// Doctrine: docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md

import type {
  SketchInput, SketchInterpretation, SketchPrimitive, ShapeMatch,
  ObjectLibraryMatch, MaterialCandidate, SketchComponent, StyleMatch,
  ConstructionCheck, ConfidenceReport, GeometryShape,
} from "./types";

const INTERPRETER_VERSION = "e10_sketch_mvp_1.0";

// ─── Stage 3-4 · Recognise shapes from primitives ───────────────────────

function recogniseShapes(primitives: readonly SketchPrimitive[], intent: string | undefined): readonly ShapeMatch[] {
  const matches: ShapeMatch[] = [];
  const intentLc = (intent ?? "").toLowerCase();
  const circleCount = primitives.filter((p) => p.kind === "circle").length;
  const rectCount = primitives.filter((p) => p.kind === "line" || (p.kind === "spline" && (p.points?.length ?? 0) >= 4)).length;
  const arcCount = primitives.filter((p) => p.kind === "arc" || p.kind === "curve").length;

  if (intentLc.includes("lamp")) {
    if (circleCount >= 1) matches.push({ shape: "circle", role: "lamp_base", confidence: 0.95 });
    matches.push({ shape: "tapered_cylinder", role: "stem", confidence: 0.85 });
    if (arcCount >= 1) matches.push({ shape: "cone", role: "shade", confidence: 0.8 });
  } else if (intentLc.includes("staircase")) {
    matches.push({ shape: "rectangle", role: "tread", confidence: 0.92 });
    matches.push({ shape: "rectangle", role: "riser", confidence: 0.9 });
    if (circleCount >= 1) matches.push({ shape: "cylinder", role: "newel", confidence: 0.75 });
  } else if (intentLc.includes("island") || intentLc.includes("worktop")) {
    matches.push({ shape: "rectangle", role: "worktop", confidence: 0.9 });
  } else {
    if (circleCount > 0) matches.push({ shape: "circle", role: "unknown_circular_component", confidence: 0.6 });
    if (rectCount > 0) matches.push({ shape: "rectangle", role: "unknown_rectangular_component", confidence: 0.6 });
  }
  return matches;
}

// ─── Stage 5 · Object library match ─────────────────────────────────────

function matchObjectLibrary(intent: string | undefined, shapes: readonly ShapeMatch[]): ObjectLibraryMatch {
  const intentLc = (intent ?? "").toLowerCase();
  const roles = shapes.map((s) => s.role);
  if (intentLc.includes("lamp") && roles.includes("lamp_base")) {
    return { object_kind: "table_lamp", similarity: 0.97, reason: "circle base + stem + shade cone matches lamp geometry family" };
  }
  if (intentLc.includes("staircase")) {
    return { object_kind: "staircase", similarity: 0.9, reason: "stacked treads + risers detected · matches staircase geometry family" };
  }
  if (intentLc.includes("island") || intentLc.includes("worktop")) {
    return { object_kind: "kitchen_island", similarity: 0.85, reason: "single elongated rectangle matches island worktop" };
  }
  return { object_kind: "unknown", similarity: 0.5, reason: "no confident library match · flagged for review" };
}

// ─── Stage 6 · Material search ──────────────────────────────────────────

function searchMaterials(requested: string | undefined): readonly MaterialCandidate[] {
  if (!requested) return [];
  const req = requested.toLowerCase();
  const map: Record<string, string[]> = {
    oak: ["oak_american_white_satin_lacquer", "ash_white"],
    walnut: ["european_walnut_matt_lacquer"],
    pine: ["scandinavian_pine"],
    mahogany: ["mahogany_polished"],
    steel: ["steel_black_powder_coated"],
    brass: ["brass_polished"],
    glass: ["glass_toughened_10mm"],
    quartz: ["quartz_worktop"],
  };
  const candidates = map[req] ?? [];
  return candidates.map((id) => ({ material_id: id, reason: `Matched user request '${requested}' to catalog id '${id}'` }));
}

// ─── Stage 7 · Component matching (per object kind) ────────────────────

function matchComponents(objectKind: string, material: string | undefined): readonly SketchComponent[] {
  if (objectKind === "table_lamp") {
    return [
      { component_id: "cmp_base", role: "base", shape: "circle", material, confidence: 0.95 },
      { component_id: "cmp_stem", role: "stem", shape: "tapered_cylinder", material, confidence: 0.85 },
      { component_id: "cmp_shade", role: "shade", shape: "cone", confidence: 0.74, note: "shade material estimated from style" },
      { component_id: "cmp_cable", role: "cable", confidence: 0.48, note: "cable routing estimated from similar lamps" },
      { component_id: "cmp_switch", role: "switch", confidence: 0.62, note: "switch location estimated from similar lamps" },
      { component_id: "cmp_bulb", role: "bulb", confidence: 0.7 },
    ];
  }
  if (objectKind === "staircase") {
    return [
      { component_id: "cmp_tread", role: "tread", shape: "rectangle", material, confidence: 0.92 },
      { component_id: "cmp_riser", role: "riser", shape: "rectangle", material, confidence: 0.9 },
      { component_id: "cmp_stringer", role: "stringer", shape: "rectangle", material, confidence: 0.85 },
      { component_id: "cmp_handrail", role: "handrail", shape: "cylinder", material, confidence: 0.8 },
      { component_id: "cmp_baluster", role: "baluster", shape: "cylinder", material, confidence: 0.75 },
    ];
  }
  return [];
}

// ─── Stage 8 · Style match ─────────────────────────────────────────────

function matchStyle(requested: string | undefined): StyleMatch {
  const style = (requested ?? "unspecified").toLowerCase();
  return {
    style,
    applies_to: style === "scandinavian" ? ["material", "finish", "hardware", "lighting"]
      : style === "industrial" ? ["material", "finish", "hardware", "colour"]
      : style === "traditional" ? ["material", "finish", "moulding"]
      : ["material"],
  };
}

// ─── Stage 9 · Construction validation ──────────────────────────────────

function validateConstruction(objectKind: string, components: readonly SketchComponent[]): readonly ConstructionCheck[] {
  const checks: ConstructionCheck[] = [];
  if (objectKind === "table_lamp") {
    const stem = components.find((c) => c.role === "stem");
    if (stem && stem.confidence < 0.7) checks.push({ concern: "Stem proportions unclear · verify stem thickness for stability.", severity: "warn", suggested_action: "Increase stem base or add weighted base." });
    const base = components.find((c) => c.role === "base");
    if (!base) checks.push({ concern: "No base detected · lamp will tip over.", severity: "error", suggested_action: "Add a stable base." });
    checks.push({ concern: "Verify cable routing and bulb accessibility during manufacture.", severity: "info" });
  }
  if (objectKind === "staircase") {
    checks.push({ concern: "Verify riser + going against Building Regs Part K (max 220mm rise · min 220mm going · max 42° pitch).", severity: "warn", suggested_action: "Run Construction Intelligence check() against staircase rules." });
  }
  return checks;
}

// ─── Overall confidence composition ────────────────────────────────────

function composeConfidence(components: readonly SketchComponent[], object: ObjectLibraryMatch): ConfidenceReport {
  const per_component: Record<string, number> = {};
  for (const c of components) per_component[c.component_id] = c.confidence;
  const meanComponent = components.length
    ? components.reduce((s, c) => s + c.confidence, 0) / components.length
    : 0.5;
  const overall = Math.round(((object.similarity * 0.5) + (meanComponent * 0.5)) * 100) / 100;
  const notes = components.filter((c) => c.note).map((c) => `${c.role}: ${c.note}`);
  return { overall_confidence: overall, per_component, notes };
}

// ─── Main pipeline ──────────────────────────────────────────────────────

export function interpret(input: SketchInput): SketchInterpretation {
  const primitives = input.detected_primitives ?? [];
  const shapes = recogniseShapes(primitives, input.user_intent);
  const object = matchObjectLibrary(input.user_intent, shapes);
  const materials = searchMaterials(input.requested_material);
  const primaryMaterial = materials[0]?.material_id;
  const components = matchComponents(object.object_kind, primaryMaterial);
  const style = matchStyle(input.requested_style);
  const construction = validateConstruction(object.object_kind, components);
  const confidence = composeConfidence(components, object);

  return {
    sketch_id: input.sketch_id,
    primitives,
    shape_matches: shapes,
    object_match: object,
    materials,
    components,
    style,
    construction_checks: construction,
    confidence,
    interpreter_version: INTERPRETER_VERSION,
    generated_at: new Date().toISOString(),
  };
}
