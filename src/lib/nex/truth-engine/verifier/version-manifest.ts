// src/lib/nex/truth-engine/verifier/version-manifest.ts
//
// Truth Engine Verifier · Stage 1a · Rule-set version composition.
//
// Founder-authorised sub-step 1a.3 · 2026-09-11.
// Doctrine: R-18.v1.0.0 (verifier envelope · rule_set_version composed from
// individual rule_version values per ADR-0314a rule-parity certification).

import type { RuleModule } from "./types";

/**
 * Compose the `rule_set_version` manifest label from the registered rule
 * modules. The result is deterministic: same set of {ruleId, ruleVersion}
 * pairs always produces the same manifest label.
 *
 * Format: `rule_set.<hash>` where `<hash>` is a stable hash of the
 * sorted `[ruleId, ruleVersion]` pairs.
 *
 * NOTE: This is a MANIFEST LABEL. The individual rule versions remain
 * authoritative (per R-18). The manifest label lets a verdict record
 * carry a compact identifier that resolves to the exact rule set that
 * produced it.
 *
 * Master AI does NOT invent rule versions. The rule modules provided at
 * construction time supply their own ruleVersion strings · founder-authored
 * per companion ADR (D-11 · D-17 · ADR-0314a.2.n D-01-values etc.).
 */
export function composeRuleSetVersion(rules: readonly RuleModule[]): string {
  if (rules.length === 0) return "rule_set.v0.empty";
  const sorted = [...rules]
    .map((r) => ({ id: r.ruleId, ver: r.ruleVersion }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : a.ver < b.ver ? -1 : a.ver > b.ver ? 1 : 0));
  const joined = sorted.map((p) => `${p.id}:${p.ver}`).join("|");
  const hash = stableHash(joined);
  return `rule_set.${hash}`;
}

/**
 * Verbose manifest for audit / logging. Returns the ordered list of
 * (ruleId, ruleVersion) pairs sorted deterministically.
 */
export function ruleSetManifest(
  rules: readonly RuleModule[],
): readonly { readonly ruleId: string; readonly ruleVersion: string }[] {
  return [...rules]
    .map((r) => ({ ruleId: r.ruleId, ruleVersion: r.ruleVersion }))
    .sort((a, b) =>
      a.ruleId < b.ruleId
        ? -1
        : a.ruleId > b.ruleId
          ? 1
          : a.ruleVersion < b.ruleVersion
            ? -1
            : a.ruleVersion > b.ruleVersion
              ? 1
              : 0,
    );
}

/**
 * Stable non-cryptographic hash of the manifest string. Deterministic ·
 * platform-independent · sufficient for identifying rule-set combinations
 * within an audit trail. Not intended for security.
 */
function stableHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
