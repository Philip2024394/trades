// Composition Platform · MVP detectors.
//
// These are the FIRST layer of the composition solver: pure functions that
// detect problems without moving anything. A future phase adds an auto-solver
// (spring layout · constraint propagation · etc.). For now the renderer +
// planner get honest diagnostics on any DesignDocument.
//
// Doctrine: docs/brains/nex-phase-e1-universal-design-studio-philip-2026-08-04.md

import type { CompositionProblem, CompositionResult, CompositionViolation } from "./types";

type Box = { x: number; y: number; width: number; height: number };

function intersects(a: Box, b: Box): boolean {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
}

export function detectOverlaps(problem: CompositionProblem): readonly CompositionViolation[] {
  const out: CompositionViolation[] = [];
  const layers = problem.layers;
  for (let i = 0; i < layers.length; i++) {
    for (let j = i + 1; j < layers.length; j++) {
      // Overlap on the SAME z-layer is a real conflict · overlap across z-layers is expected (compositing).
      if (layers[i].z_index !== layers[j].z_index) continue;
      if (intersects(layers[i].box, layers[j].box)) {
        out.push({
          rule_id: "composition.overlap",
          severity: "warn",
          layer_ids: [layers[i].id, layers[j].id],
          message: `Layers "${layers[i].id}" and "${layers[j].id}" overlap on z-index ${layers[i].z_index}.`,
        });
      }
    }
  }
  return out;
}

export function detectSafeMarginViolations(problem: CompositionProblem): readonly CompositionViolation[] {
  const out: CompositionViolation[] = [];
  const { canvas } = problem;
  const m = canvas.safe_margin_px;
  for (const l of problem.layers) {
    const outsideLeft = l.box.x < m;
    const outsideTop = l.box.y < m;
    const outsideRight = l.box.x + l.box.width > canvas.width_px - m;
    const outsideBottom = l.box.y + l.box.height > canvas.height_px - m;
    if (outsideLeft || outsideTop || outsideRight || outsideBottom) {
      out.push({
        rule_id: "composition.safe_margin",
        severity: "warn",
        layer_ids: [l.id],
        message: `Layer "${l.id}" crosses the ${m}px safe margin.`,
      });
    }
  }
  return out;
}

export function detectOffGrid(problem: CompositionProblem): readonly CompositionViolation[] {
  const out: CompositionViolation[] = [];
  if (!problem.grid) return out;
  const g = problem.grid;
  const col_width = (problem.canvas.width_px - 2 * g.margin_px - (g.columns - 1) * g.gutter_px) / g.columns;
  const step = col_width + g.gutter_px;
  const baseline = g.baseline_px ?? 8;
  for (const l of problem.layers) {
    const x_off_grid = Math.abs(((l.box.x - g.margin_px) % step)) > 1;
    const y_off_grid = baseline > 0 && Math.abs(l.box.y % baseline) > 1;
    if (x_off_grid || y_off_grid) {
      out.push({
        rule_id: "composition.off_grid",
        severity: "info",
        layer_ids: [l.id],
        message: `Layer "${l.id}" is off-grid (x=${l.box.x}, y=${l.box.y}, col_step=${step.toFixed(1)}, baseline=${baseline}).`,
      });
    }
  }
  return out;
}

/** MVP compose · runs all detectors · returns the layers unchanged plus a
 *  metrics summary. A future phase promotes this into a real solver that
 *  moves layers into legal positions. */
export function compose(problem: CompositionProblem): CompositionResult {
  const overlaps = detectOverlaps(problem);
  const margins = detectSafeMarginViolations(problem);
  const grid = detectOffGrid(problem);
  const violations = [...overlaps, ...margins, ...grid];
  return {
    resolved_layers: problem.layers,
    violations,
    applied_rules: ["overlap", "safe_margin", ...(problem.grid ? ["off_grid"] : [])],
    metrics: {
      overlap_count: overlaps.length,
      safe_margin_violations: margins.length,
      off_grid_count: grid.length,
    },
  };
}
