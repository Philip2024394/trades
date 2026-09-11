// src/lib/nex/truth-engine/verifier/rule-registry.ts
//
// Truth Engine Verifier · Stage 1a · Rule module registry.
//
// Founder-authorised sub-step 1a.3 · 2026-09-11.
// Doctrine: R-DOMAIN-01 (anti-substitution) + R-18 (rule_set_version
// composition) + R-10 gate-model doctrine (2026-09-11 consolidation ·
// gate semantics locked · implementation ordering delegated).
//
// The registry enforces:
//   - Rule modules are registered with unique ruleId
//   - Ordering is preserved but does not doctrinally constrain execution
//     order (per R-10 gate-model 2026-09-11)
//   - Duplicate ruleId registration is a runtime error (Guardian violation)

import type { RuleModule } from "./types";

/**
 * Immutable frozen registry of rule modules. Rules are plug-in at
 * `createVerifier({ rules })` time. Registry does not mutate at runtime.
 */
export class RuleRegistry {
  private readonly modules: readonly RuleModule[];
  private readonly byId: ReadonlyMap<string, RuleModule>;

  constructor(rules: readonly RuleModule[]) {
    // Detect duplicate ruleId · Guardian rejects at construction.
    const seen = new Map<string, RuleModule>();
    for (const r of rules) {
      if (seen.has(r.ruleId)) {
        throw new Error(
          `Rule registry duplicate ruleId: ${r.ruleId}. Each rule module must have a unique identifier.`,
        );
      }
      seen.set(r.ruleId, r);
    }
    this.modules = Object.freeze([...rules]);
    this.byId = seen;
  }

  /** All registered rules in insertion order. */
  all(): readonly RuleModule[] {
    return this.modules;
  }

  /** Lookup a rule by identifier. Returns null if not registered. */
  get(ruleId: string): RuleModule | null {
    return this.byId.get(ruleId) ?? null;
  }

  /** Count of registered rules. */
  size(): number {
    return this.modules.length;
  }

  /** Whether a specific ruleId is registered. */
  has(ruleId: string): boolean {
    return this.byId.has(ruleId);
  }
}
