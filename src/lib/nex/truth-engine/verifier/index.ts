// src/lib/nex/truth-engine/verifier/index.ts
//
// Truth Engine Verifier · Stage 1a · Public API surface.
//
// Founder-authorised sub-step 1a.3 · 2026-09-11.
// Doctrine: ADR-0314e (Truth Engine Verifier Implementation).
//
// This module re-exports the public API. Rule modules (R-01 · R-03 · R-05
// · R-07 · R-11 · R-12 · R-13 · R-17 · R-18 · R-20) plug in as separate
// modules under `./rules/*` (authored in sub-step 1a.4 · not this
// skeleton).
//
// Do NOT import anything database-related here. The verifier is a pure
// function. Persistence lives in a separate module authored later.

export type {
  AggregationPolicy,
  RuleModule,
  RuleVerdict,
  VerdictEnvelope,
  VerdictKind,
  VerifierConfig,
  VerifierInput,
} from "./types";

export { Verifier, createVerifier } from "./verifier";
export { RuleRegistry } from "./rule-registry";
export {
  buildEnvelope,
  computeTruthEngineOk,
} from "./envelope";
export {
  composeRuleSetVersion,
  ruleSetManifest,
} from "./version-manifest";
export {
  CANONICAL_FAIL_CLOSED_REASONS,
  failVerdict,
  passVerdict,
  unknownVerdict,
} from "./fail-closed";
export type { CanonicalFailClosedReason } from "./fail-closed";
