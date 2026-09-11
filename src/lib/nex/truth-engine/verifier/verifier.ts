// src/lib/nex/truth-engine/verifier/verifier.ts
//
// Truth Engine Verifier · Stage 1a · Core verifier.
//
// Founder-authorised sub-step 1a.3 · 2026-09-11.
// Doctrine: ADR-0314e (Truth Engine Verifier Implementation · Gate 3
// CANDIDATE · doctrine locked). D-Impl (Stage 1a smallest-certified-path).
// R-18 (envelope composition). §7.7 H1 (`unknown` ≠ `false`).
//
// The verifier is a PURE FUNCTION. It takes VerifierInput + VerifierConfig
// and returns VerdictEnvelope. It has NO side effects:
//   - No database writes
//   - No file writes
//   - No network calls
//   - No Guardian rule installation
//   - No AUTHORITATIVE promotion
//   - No autonomous threshold adjustment
//   - No production substrate mutation
//
// Rule execution ordering is implementation-defined per R-10 gate-model
// (2026-09-11 · gate semantics locked · implementation ordering delegated).
// Current implementation: sequential in registered order · deterministic.

import type {
  AggregationPolicy,
  RuleVerdict,
  VerdictEnvelope,
  VerifierConfig,
  VerifierInput,
} from "./types";
import { RuleRegistry } from "./rule-registry";
import { buildEnvelope } from "./envelope";

/**
 * Verifier · encapsulates the rule pipeline and produces VerdictEnvelope
 * per input.
 *
 * Construction is one-time per verifier deploy. `verifierInstanceId` is
 * fixed at construction (typically read from environment or a startup
 * generator that produces a deterministic UUID per deploy).
 *
 * A verifier instance is IMMUTABLE post-construction. No rule can be
 * added or removed at runtime. Amendment requires re-deploy with a new
 * instance + a founder-authored amendment ADR.
 */
export class Verifier {
  private readonly config: VerifierConfig;
  private readonly registry: RuleRegistry;
  private readonly aggregationPolicy: AggregationPolicy;
  private readonly clock: () => string;

  constructor(
    config: VerifierConfig,
    aggregationPolicy: AggregationPolicy = "all_must_pass",
    clock: () => string = () => new Date().toISOString(),
  ) {
    if (!config.verifierInstanceId || config.verifierInstanceId.length === 0) {
      throw new Error(
        "Verifier construction requires a non-empty verifierInstanceId per R-18 doctrine.",
      );
    }
    if (!config.guardianVersion || config.guardianVersion.length === 0) {
      throw new Error(
        "Verifier construction requires a non-empty guardianVersion per R-18 doctrine.",
      );
    }
    this.config = config;
    this.registry = new RuleRegistry(config.rules);
    this.aggregationPolicy = aggregationPolicy;
    this.clock = clock;
  }

  /**
   * Verify an input. Returns a complete VerdictEnvelope with per-rule
   * verdicts and aggregate truth_engine_ok. Deterministic: same input +
   * same rule set → same envelope (modulo the injected clock).
   *
   * IMPORTANT: this method PRODUCES a verdict envelope in memory. It does
   * NOT persist the envelope. It does NOT write to any database. Callers
   * that want to persist a verdict must do so themselves via a separate
   * (Stage 1a code time) persistence layer that writes to `nex_test.*`
   * during Stage 1a and to production `nex.*` at Stage 1b post-fixture-proof.
   */
  verify(input: VerifierInput): VerdictEnvelope {
    const perRuleVerdicts: RuleVerdict[] = [];
    for (const rule of this.registry.all()) {
      const verdict = rule.evaluate(input);
      // Constitutional guard: rule module must return its own ruleId + ruleVersion.
      // This prevents Guardian confusion about which rule produced the verdict.
      if (verdict.ruleId !== rule.ruleId) {
        throw new Error(
          `Rule ${rule.ruleId} returned a verdict with mismatched ruleId ${verdict.ruleId} · Guardian violation.`,
        );
      }
      if (verdict.ruleVersion !== rule.ruleVersion) {
        throw new Error(
          `Rule ${rule.ruleId} returned a verdict with mismatched ruleVersion ${verdict.ruleVersion} (registered as ${rule.ruleVersion}) · Guardian violation.`,
        );
      }
      // §7.7 H1: UNKNOWN and FAIL verdicts MUST carry a named reason.
      if (
        (verdict.verdict === "UNKNOWN" || verdict.verdict === "FAIL") &&
        (verdict.reason === null || verdict.reason.length === 0)
      ) {
        throw new Error(
          `Rule ${rule.ruleId} produced a ${verdict.verdict} verdict without a named reason · §7.7 H1 violation.`,
        );
      }
      perRuleVerdicts.push(verdict);
    }
    return buildEnvelope(
      input,
      this.config,
      perRuleVerdicts,
      this.aggregationPolicy,
      this.clock,
    );
  }

  /** Registered rule count · read-only. */
  ruleCount(): number {
    return this.registry.size();
  }

  /** Registered rule identifiers · read-only. */
  ruleIds(): readonly string[] {
    return this.registry.all().map((r) => r.ruleId);
  }
}

/**
 * Factory helper. Creates a Verifier instance from config with default
 * aggregation policy.
 */
export function createVerifier(config: VerifierConfig): Verifier {
  return new Verifier(config);
}
