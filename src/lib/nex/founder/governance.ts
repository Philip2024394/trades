// src/lib/nex/founder/governance.ts
//
// SLICE #7 · Founder Command Governance v0 (Philip 2026-09-05)
//
// PURPOSE
// -------
// Between the founder-mode session and the command executor there
// must be a governance layer that answers ONE question per command:
//
//   "Is this command permitted, given the constitutional restrictions
//    that not even the founder can bypass?"
//
// This module is that layer. It answers deterministically. It does
// not consult the model. It does not read the DB. It is pure
// allow-or-deny based on the command kind + arguments.
//
// TWO GATES
// ---------
// A command must pass BOTH gates to be executed:
//
//   Gate 1 · Allowlist: the command kind must be in FOUNDER_COMMANDS.
//                       Unknown commands are refused.
//
//   Gate 2 · Denylist: the command must not match any pattern in
//                       FORBIDDEN_COMMAND_PATTERNS. These are the
//                       constitutional restrictions that even the
//                       founder cannot bypass. If a future allowed
//                       command matches a denylist pattern, the
//                       denylist WINS.
//
// v0 ALLOWED COMMANDS (READ-ONLY ONLY)
// ------------------------------------
//   nex.founder.ping
//     Health check. Confirms founder identity + mode + timestamp.
//     No side effects. No DB access.
//
//   nex.founder.identity_status
//     Returns { supabase_user_id, email, in_founder_mode, expires_at }.
//     Lets the founder verify their current authority state.
//     No side effects. No DB writes.
//
//   nex.founder.audit_query
//     Returns the last N founder-command audit records. Read-only.
//     Read scope: only founder-command events (source=executive_layer,
//     event_type starts with "founder."). Never returns arbitrary
//     table contents.
//
// NO STATE-CHANGING COMMANDS are allowed in v0. Any state-changing
// command kind requires a future slice with separate authorization.
// This is intentional. v0 establishes the foundation, not the
// executive surface.

import "server-only";

/** Command payload shape · caller-supplied. */
export type FounderCommand = {
  /** Unique per-command id (client-provided or server-minted). */
  command_id: string;
  /** Dotted command kind · e.g., "nex.founder.ping". */
  kind: string;
  /** Command arguments · schema depends on kind. */
  args?: Record<string, unknown>;
  /** ISO timestamp of client-side request. */
  requested_at_iso: string;
  /** Optional correlation id for tying commands into workflows. */
  correlation_id?: string;
};

export type GovernanceDecision =
  | { allowed: true; kind: string }
  | {
      allowed: false;
      reason: string;
      /** "allowlist" · command kind not in the allowlist. */
      /** "denylist"  · command matches a constitutional denylist. */
      /** "malformed" · command payload failed validation. */
      gate: "allowlist" | "denylist" | "malformed";
    };

// ─── Allowlist (v0 · read-only) ──────────────────────────────────

/**
 * The COMPLETE list of founder commands the executor recognizes in v0.
 * Anything not in this Set is refused at the allowlist gate.
 *
 * State-changing commands (e.g., "nex.founder.override.*",
 * "nex.founder.grant.*") are DELIBERATELY absent. Their addition is
 * a future slice under separate authorization.
 */
export const FOUNDER_COMMANDS: ReadonlySet<string> = new Set([
  "nex.founder.ping",
  "nex.founder.identity_status",
  "nex.founder.audit_query",
]);

// ─── Constitutional denylist ─────────────────────────────────────

/**
 * Patterns that CAN NEVER be a permitted founder command, regardless
 * of what appears in the allowlist. If a future contributor
 * accidentally adds a command that matches, this denylist wins.
 *
 * These are the constitutional restrictions that even the founder
 * cannot bypass at runtime. Changing them requires a code change +
 * doctrine amendment + audit review.
 *
 * Matched by lowercase substring OR regex. A single match denies.
 */
type ForbiddenPattern = {
  kind: string;
  match: RegExp | ((s: string) => boolean);
  reason: string;
};

export const FORBIDDEN_COMMAND_PATTERNS: readonly ForbiddenPattern[] = [
  {
    kind: "disable_audit",
    match: /disable[._-]?audit|audit[._-]?off|stop[._-]?audit|nolog/i,
    reason:
      "constitutional_restriction · founder cannot disable auditability · every founder command must be observable",
  },
  {
    kind: "delete_provenance",
    match: /(delete|drop|purge|wipe|clear)[._-]?(provenance|evidence|audit|history|log)/i,
    reason:
      "constitutional_restriction · founder cannot delete institutional provenance · knowledge integrity is non-negotiable",
  },
  {
    kind: "grant_founder_authority",
    match: /grant[._-]?founder|transfer[._-]?founder|assign[._-]?founder|delegate[._-]?founder/i,
    reason:
      "constitutional_restriction · founder authority cannot be granted at runtime · founder identity is env-anchored · succession belongs to future Founder Continuity Protocol",
  },
  {
    kind: "disable_verification",
    match: /(disable|bypass|skip|off)[._-]?(verification|verify|claim[._-]?check|guard)/i,
    reason: "constitutional_restriction · claim verification cannot be disabled",
  },
  {
    kind: "disable_governance",
    match: /(disable|bypass|skip|off)[._-]?governance/i,
    reason: "constitutional_restriction · governance layer cannot be disabled",
  },
  {
    kind: "raw_sql",
    match: /(raw|exec|run|arbitrary)[._-]?sql|sql[._-]?(exec|raw|arbitrary)/i,
    reason: "constitutional_restriction · no arbitrary SQL through founder command surface",
  },
  {
    kind: "shell_exec",
    match: /(shell|spawn|process|system)[._-]?(exec|run|arbitrary|command)|shell[._-]?exec|process[._-]?exec/i,
    reason: "constitutional_restriction · no arbitrary shell / process execution",
  },
  {
    kind: "env_write",
    match: /(env|environment)[._-]?(write|set|modify|mutate)/i,
    reason: "constitutional_restriction · env changes require deployment, not runtime commands",
  },
  {
    kind: "secret_extract",
    match: /(secret|token|password|apikey|api[._-]?key|credential)[._-]?(extract|dump|export|read|reveal|show)/i,
    reason: "constitutional_restriction · secrets cannot be extracted through founder command surface",
  },
  {
    kind: "deploy",
    match: /(deploy|release|publish|rollout|rollback[._-]?deploy)(?![a-z])/i,
    reason: "constitutional_restriction · deployment is not a founder runtime command",
  },
  {
    kind: "modify_founder_config",
    match: /(change|modify|set|update|rotate)[._-]?founder[._-]?(anchor|identity|secret|password|config)/i,
    reason:
      "constitutional_restriction · founder configuration cannot be modified at runtime · env-only",
  },
  {
    kind: "self_modify",
    match: /self[._-]?(modify|patch|update|rewrite|reprogram|redefine|alter)/i,
    reason:
      "constitutional_restriction · no autonomous self-modification · slice #17 Learning Engine write path is not authorized",
  },
];

// ─── Evaluation ──────────────────────────────────────────────────

/**
 * Evaluate a proposed founder command. Returns a discriminated
 * union so callers can log the specific gate + reason on denial.
 *
 * The denylist is checked FIRST. Even if a command is in the
 * allowlist, a denylist match denies it. This defends against future
 * contributor error.
 */
export function evaluateCommand(cmd: FounderCommand | null): GovernanceDecision {
  if (!cmd || typeof cmd !== "object") {
    return { allowed: false, reason: "command_missing", gate: "malformed" };
  }
  if (typeof cmd.kind !== "string" || cmd.kind.length === 0) {
    return { allowed: false, reason: "kind_missing_or_invalid", gate: "malformed" };
  }
  if (typeof cmd.command_id !== "string" || cmd.command_id.length === 0) {
    return { allowed: false, reason: "command_id_missing", gate: "malformed" };
  }
  if (typeof cmd.requested_at_iso !== "string" || Number.isNaN(Date.parse(cmd.requested_at_iso))) {
    return { allowed: false, reason: "requested_at_iso_missing_or_invalid", gate: "malformed" };
  }

  // Denylist first (constitutional restriction wins)
  const kindLower = cmd.kind.toLowerCase();
  for (const forbidden of FORBIDDEN_COMMAND_PATTERNS) {
    const matches =
      typeof forbidden.match === "function"
        ? forbidden.match(kindLower)
        : forbidden.match.test(cmd.kind);
    if (matches) {
      return { allowed: false, reason: forbidden.reason, gate: "denylist" };
    }
  }

  // Allowlist
  if (!FOUNDER_COMMANDS.has(cmd.kind)) {
    return {
      allowed: false,
      reason: `command_kind_not_in_v0_allowlist · known kinds: ${[...FOUNDER_COMMANDS].join(", ")}`,
      gate: "allowlist",
    };
  }

  return { allowed: true, kind: cmd.kind };
}

/**
 * Convenience: is this kind currently allowed? Doesn't check payload
 * shape — use `evaluateCommand()` for the full check.
 */
export function isKindAllowed(kind: string): boolean {
  const lower = kind.toLowerCase();
  for (const forbidden of FORBIDDEN_COMMAND_PATTERNS) {
    const matches =
      typeof forbidden.match === "function"
        ? forbidden.match(lower)
        : forbidden.match.test(kind);
    if (matches) return false;
  }
  return FOUNDER_COMMANDS.has(kind);
}
