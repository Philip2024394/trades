// Composition Platform · contract.
//
// Owns: alignment · spacing · grids · balance · visual hierarchy · responsive
// layout · overlap rules · collision detection. Sits between Planning and
// Rendering. Renderer must never solve any of these.
//
// Doctrine: docs/brains/nex-phase-e1-universal-design-studio-philip-2026-08-04.md

// ─── Grid + Layout primitives ────────────────────────────────────────────

export type GridDefinition = {
  columns: number;
  rows?: number;
  gutter_px: number;
  margin_px: number;
  baseline_px?: number;                  // vertical rhythm
};

export type AlignmentAxis = "start" | "center" | "end" | "space_between" | "space_around" | "space_evenly";

export type Alignment = {
  horizontal: AlignmentAxis;
  vertical: AlignmentAxis;
};

// ─── Composition rules ───────────────────────────────────────────────────

export type CompositionRule = {
  id: string;
  applies_to: "page" | "section" | "container" | "component" | "layer";
  rule_kind: "grid" | "alignment" | "spacing" | "hierarchy" | "balance" | "collision" | "responsive";
  parameters: Record<string, unknown>;
  severity: "info" | "warn" | "error";   // violations map to render_log entries
};

// ─── Composition problem + result ────────────────────────────────────────

export type CompositionProblem = {
  layers: readonly { id: string; box: { x: number; y: number; width: number; height: number }; z_index: number }[];
  canvas: { width_px: number; height_px: number; safe_margin_px: number };
  grid?: GridDefinition;
  rules?: readonly CompositionRule[];
};

export type CompositionViolation = {
  rule_id: string;
  severity: "info" | "warn" | "error";
  layer_ids: readonly string[];
  message: string;
};

export type CompositionResult = {
  resolved_layers: readonly { id: string; box: { x: number; y: number; width: number; height: number }; z_index: number }[];
  violations: readonly CompositionViolation[];
  applied_rules: readonly string[];
  metrics: {
    overlap_count: number;
    safe_margin_violations: number;
    off_grid_count: number;
  };
};

// ─── Composition Platform contract (MVP · full solver phased) ────────────

export type CompositionPlatform = {
  detectOverlaps(problem: CompositionProblem): readonly CompositionViolation[];
  detectSafeMarginViolations(problem: CompositionProblem): readonly CompositionViolation[];
  detectOffGrid(problem: CompositionProblem): readonly CompositionViolation[];
  compose(problem: CompositionProblem): CompositionResult;
};
