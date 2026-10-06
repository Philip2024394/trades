// src/lib/nex/theme-brain/authority.ts
//
// Theme Brain authority / governance helper. Enforces the sealed
// permission model for Theme Brain actions.
//
// Phase 1 sealed permission semantics (per founder authorisation
// 2026-10-05):
//
//   request.theme_proposal   → allowed · any Cortex-authorised
//                              caller can request a proposal / refine
//                              / validate
//   execute.theme_publish    → denied · founder-gated for a later
//                              phase · workers and agents MUST NOT
//                              be able to publish a world
//   write.theme_vocabulary   → denied · founder-gated · vocabulary
//                              expansion is a doctrine amendment
//
// The actual governance registry is in src/lib/nex/brain/governance.ts
// · this helper is a Theme-Brain-local check that mirrors those
// permissions and keeps the Brain decoupled from the full brain
// governance subsystem for Phase 1.

import type { ThemeBrainAction, ThemeBrainCaller } from "./intent";

export type ThemeBrainPermission =
  | "request.theme_proposal"
  | "execute.theme_publish"
  | "write.theme_vocabulary";

export type GovernanceDecision = "allow" | "deny";

/** Default policy · aligned with the sealed Phase 1 rules. */
const DEFAULT_RULES: Record<ThemeBrainPermission, GovernanceDecision> = {
  "request.theme_proposal": "allow",
  "execute.theme_publish": "deny",
  "write.theme_vocabulary": "deny",
};

/** Map a ThemeBrainAction to the permission it requires. */
export function permissionFor(action: ThemeBrainAction): ThemeBrainPermission {
  switch (action) {
    case "propose":
    case "refine":
    case "validate":
      return "request.theme_proposal";
    case "publish":
      return "execute.theme_publish";
    case "modify_vocabulary":
      return "write.theme_vocabulary";
  }
}

/** Return the decision for a caller trying to perform an action.
 *  Phase 1 does not grant any caller the ability to publish or alter
 *  vocabulary · founder authority is required and lives outside this
 *  module. */
export function decide(
  action: ThemeBrainAction,
  _caller: ThemeBrainCaller,
): GovernanceDecision {
  const perm = permissionFor(action);
  return DEFAULT_RULES[perm];
}
