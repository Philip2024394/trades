// src/lib/nex/brain/governance.ts
//
// Stage 3.20 · Phase 13 · Governance (Philip 2026-08-31).
//
// Explicit permissions layer that gates capabilities. Every capability
// declares which permissions it uses; every turn's usage is checked
// against the active policy. Blocks unsafe actions before Action lands,
// consent-gates Long-Term Memory + Perception image bytes, provides
// the audit trail that constitutes real "self-awareness of boundaries."
//
// v1 discipline:
//   · Deterministic policy check · no LLM
//   · Default policy is generous for safe reads/writes, strict for
//     execute + long-term memory + image bytes
//   · Session-level policy override (future · consent gating)
//   · Observational v1: currently no capability requires blocked
//     permissions, so the report is all-allow. When Action lands
//     (user_action), the report will start denying without consent.
//   · Reports every turn so drift is visible
//
// Anti-pattern this replaces: implicit "we can call anything" pattern.
// Now every capability path is auditable against declared permissions.

export type Permission =
  | "read.world_knowledge"      // retrieveKnowledge · Indonesia corpus
  | "read.commerce"             // findSellers/findProducts/findOffers
  | "read.session"              // getSession
  | "write.session"             // upsertSession (slots, goal, entities, reference)
  | "write.workforce_gap"       // GapRegistry via recordInsightGap
  | "write.learning_ledger"     // recordLearning
  | "write.long_term_memory"    // future · cross-session preference store
  | "execute.user_action"       // future · book/buy/message/etc against a reference
  | "call.live_source"          // BMKG / OSM live fetches
  | "call.external_llm"         // Qwen (UK staircase) / future LLMs
  | "read.image_bytes";         // future · image content processing

export type GovernanceDecision = "allow" | "deny" | "require_consent";

export type GovernancePolicy = {
  name: string;
  rules: Partial<Record<Permission, GovernanceDecision>>;
};

/** Default policy · generous for safe reads/writes · strict for
 *  execute + long-term memory + image bytes. Never a silent allow-all. */
export const DEFAULT_POLICY: GovernancePolicy = {
  name: "default",
  rules: {
    "read.world_knowledge": "allow",
    "read.commerce": "allow",
    "read.session": "allow",
    "write.session": "allow",
    "write.workforce_gap": "allow",
    "write.learning_ledger": "allow",
    "call.live_source": "allow",
    "call.external_llm": "allow",       // UK staircase Qwen path is opt-in via market=UK
    "write.long_term_memory": "require_consent",
    "execute.user_action": "require_consent",
    "read.image_bytes": "require_consent",
  },
};

/** Strict policy · used for testing + high-safety flows. Everything
 *  that isn't a pure knowledge read requires consent. */
export const STRICT_POLICY: GovernancePolicy = {
  name: "strict",
  rules: {
    "read.world_knowledge": "allow",
    "read.commerce": "allow",
    "read.session": "allow",
    "write.session": "require_consent",
    "write.workforce_gap": "require_consent",
    "write.learning_ledger": "require_consent",
    "call.live_source": "require_consent",
    "call.external_llm": "deny",
    "write.long_term_memory": "deny",
    "execute.user_action": "deny",
    "read.image_bytes": "deny",
  },
};

export type PermissionUse = { permission: Permission; context: string };

export type GovernanceFinding = {
  permission: Permission;
  decision: GovernanceDecision;
  context: string;
  policyName: string;
};

export type GovernanceReport = {
  policy: string;
  findings: GovernanceFinding[];
  /** True when any finding was `deny` — one or more permissions blocked. */
  hasDenies: boolean;
  /** True when any finding was `require_consent` — one or more needs opt-in. */
  hasRequiresConsent: boolean;
  /** Count of `allow` decisions. */
  allowedCount: number;
};

/** Optional consent grants · maps permission → true when user has
 *  explicitly consented. When present + permission's default decision
 *  is `require_consent`, the audit decision becomes `allow`. */
export type ConsentGrants = Partial<Record<Permission, boolean>>;

/** Check a set of permission uses against a policy. Returns an audit
 *  report · never mutates anything · never fabricates permissions the
 *  caller didn't declare. Optionally accepts a consent grants map
 *  that flips `require_consent` decisions to `allow` when the user
 *  has explicitly consented. */
export function checkPermissions(
  uses: ReadonlyArray<PermissionUse>,
  policy: GovernancePolicy = DEFAULT_POLICY,
  consent?: ConsentGrants,
): GovernanceReport {
  const findings: GovernanceFinding[] = uses.map((u) => {
    let decision = policy.rules[u.permission] ?? "deny"; // unknown permissions default to deny
    // Consent promotion: require_consent → allow when user has consented.
    // Never promotes deny → allow (deny is a policy hard-block).
    if (decision === "require_consent" && consent?.[u.permission] === true) {
      decision = "allow";
    }
    return { permission: u.permission, decision, context: u.context, policyName: policy.name };
  });
  return {
    policy: policy.name,
    findings,
    hasDenies: findings.some((f) => f.decision === "deny"),
    hasRequiresConsent: findings.some((f) => f.decision === "require_consent"),
    allowedCount: findings.filter((f) => f.decision === "allow").length,
  };
}

/** Convenience: assess whether it's safe to proceed with a proposed
 *  action given the report. `allow` = go · `require_consent` and
 *  `deny` = block. */
export function isAllowed(report: GovernanceReport): boolean {
  return !report.hasDenies && !report.hasRequiresConsent;
}
