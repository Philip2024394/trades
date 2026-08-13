// Sketch Intelligence Platform (SIP) · types.
//
// A sketch is FIRST-CLASS design knowledge · not an unfinished image. Hand
// sketches · CAD drawings · scanned notebooks · PDFs · concept art all enter
// as Design Documents that already carry intent.
//
// Doctrine: docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md

// ─── Sketch inputs ──────────────────────────────────────────────────────

export type SketchSource = "hand_paper" | "cad_line" | "scanned_notebook" | "pdf" | "concept_art" | "photo_of_sketch";

export type SketchInput = {
  sketch_id: string;
  source: SketchSource;
  url?: string;
  file_bytes_length?: number;
  // Caller-supplied hints (MVP: without vision model, hints inform the pipeline)
  detected_primitives?: readonly SketchPrimitive[];
  user_intent?: string;                  // free-text · e.g. "table lamp with round base"
  requested_material?: string;
  requested_style?: string;
};

// ─── Stage 1-2 · Line + primitive detection ─────────────────────────────

export type SketchPrimitiveKind = "line" | "curve" | "circle" | "arc" | "spline" | "hidden_line" | "centre_line" | "construction_line" | "dimension" | "note" | "arrow" | "section_mark";

export type SketchPrimitive = {
  kind: SketchPrimitiveKind;
  points?: readonly [number, number][];  // fractional coords 0..1
  radius_pct?: number;                    // for circle/arc
  label?: string;                         // e.g. dimension text "300mm"
};

// ─── Stage 3-4 · Geometry + Shape matching ──────────────────────────────

export type GeometryShape = "circle" | "rectangle" | "cylinder" | "cone" | "sphere" | "tapered_cylinder" | "prism";

export type ShapeMatch = {
  shape: GeometryShape;
  role: string;                          // e.g. "lamp_base" · "stem" · "shade" · "handrail" · "worktop"
  confidence: number;                    // 0..1
};

// ─── Stage 5 · Object library match ─────────────────────────────────────

export type ObjectLibraryMatch = {
  object_kind: string;                   // e.g. "table_lamp" · "staircase" · "kitchen_island"
  similarity: number;                    // 0..1 vs. Nex's known object shapes
  candidate_object_id?: string;          // if a specific existing object matched closely
  reason: string;
};

// ─── Stage 6 · Material search ──────────────────────────────────────────

export type MaterialCandidate = {
  material_id: string;                   // references material-platform id
  reason: string;                        // e.g. "user requested oak · matches Scandinavian style"
};

// ─── Stage 7 · Component matching ───────────────────────────────────────

export type SketchComponent = {
  component_id: string;
  role: string;                          // e.g. "base" · "stem" · "shade" · "cable" · "switch" · "bulb"
  shape?: GeometryShape;
  material?: string;
  confidence: number;
  note?: string;                         // e.g. "estimated from similar lamps"
};

// ─── Stage 8 · Style match ──────────────────────────────────────────────

export type StyleMatch = {
  style: string;                         // e.g. "scandinavian" · "industrial" · "traditional"
  applies_to: readonly string[];         // roles this style affects (materials/finish/hardware)
};

// ─── Stage 9 · Construction validation + confidence ─────────────────────

export type ConstructionCheck = {
  concern: string;
  severity: "info" | "warn" | "error";
  suggested_action?: string;
};

export type ConfidenceReport = {
  overall_confidence: number;            // 0..1
  per_component: Record<string, number>; // component_id → confidence
  notes: readonly string[];              // e.g. "Switch location estimated from similar lamps."
};

// ─── Full Sketch Interpretation ────────────────────────────────────────

export type SketchInterpretation = {
  sketch_id: string;
  primitives: readonly SketchPrimitive[];
  shape_matches: readonly ShapeMatch[];
  object_match: ObjectLibraryMatch;
  materials: readonly MaterialCandidate[];
  components: readonly SketchComponent[];
  style: StyleMatch;
  construction_checks: readonly ConstructionCheck[];
  confidence: ConfidenceReport;
  interpreter_version: string;
  generated_at: string;
};
