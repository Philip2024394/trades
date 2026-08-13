// Composition Platform · public exports.
//
// Doctrine: docs/brains/nex-phase-e1-universal-design-studio-philip-2026-08-04.md

export { detectOverlaps, detectSafeMarginViolations, detectOffGrid, compose } from "./detectors";
export type {
  CompositionProblem, CompositionResult, CompositionViolation, CompositionRule,
  CompositionPlatform, GridDefinition, Alignment, AlignmentAxis,
} from "./types";
