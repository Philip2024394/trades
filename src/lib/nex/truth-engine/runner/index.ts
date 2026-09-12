// src/lib/nex/truth-engine/runner/index.ts
//
// Truth Engine Fixture Runner · Stage 1a sub-step 1a.7 · public API.
//
// Founder-authorised sub-step 1a.7 · 2026-09-11.

export type {
  DeterminismComparison,
  FixtureClassification,
  FixtureExpected,
  FixtureResult,
  FixtureRow,
  RunnerReport,
} from "./types";

export {
  buildVerifierInput,
  classifyResult,
  compareRunsForDeterminism,
  formatRunnerReport,
  indexExpected,
  projectRunForDeterminismCompare,
  runFixture,
  runSuite,
} from "./fixture-runner";
