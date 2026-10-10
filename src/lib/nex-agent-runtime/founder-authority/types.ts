// WO-NEX-RUNTIME-08 · founder-authority custody · delegation envelope model.
//
// Founder-locked 2026-09-14. NEX NEVER holds the founder's private key.
// The founder signs a scope-bounded delegation envelope offline. NEX
// delegate agents sign per-authorization envelopes with their OWN
// identity, provably within the delegation's scope.
//
// Verification requires BOTH signatures + scope compliance + expiry
// + no revocation.
//
// Locked doctrines:
//   1. Founder authority is never transferred · only delegated
//   2. Authorization is not the same thing as verification
//   3. Every delegation declares BOTH allowed AND forbidden
//   4. On expiry: STOP · no fallback · no implicit renewal

// ── Allowed scope · what the delegation permits ────────────────────────

export interface DelegationAllowedScope {
  readonly proposal_kinds: readonly string[];             // e.g. ["rate_limiter.persistent_backoff"] · never wildcard
  readonly file_path_prefixes: readonly string[];         // e.g. ["src/app/shop/"] · glob-lite (prefix match)
  readonly stages_allowed: readonly ("WO-01" | "WO-04" | "WO-05" | "WO-06" | "WO-07" | "WO-08" | "WO-09")[];
  readonly max_risk_level: "LOW" | "MEDIUM" | "HIGH" | "SEVERE";
  readonly mission_ids_allowed: readonly string[];        // empty = any mission within other constraints
  readonly cap_ids_allowed: readonly string[];            // empty = any cap within other constraints
  /** RUNTIME-09 · to grant Internet access, delegation must carry this.
   *  Absence / null = internet access DENIED (default). Every delegation
   *  signed before RUNTIME-09 has this null · therefore has NO Internet
   *  access · which matches the founder-locked default. */
  readonly internet_scope?: import("@/lib/nex-agent-runtime/internet-doorway/types").DelegationInternetScope | null;
}

// ── Forbidden scope · explicit prohibitions (defence in depth) ─────────

export interface DelegationForbiddenScope {
  readonly forbidden_categories: readonly ForbiddenCategory[];
  readonly forbidden_path_prefixes: readonly string[];    // e.g. ["src/lib/nex-authority-broker/", "src/lib/nex-controlled-hands/"]
  readonly forbidden_cap_kinds: readonly string[];        // e.g. security-escalate-only kinds
}

export type ForbiddenCategory =
  | "authority_system"
  | "security_system"
  | "founder_keys"
  | "protected_roots"
  | "credentials"
  | "production_secrets"
  | "network_policy_changes"
  | "agent_identity_files"
  | "workstation_substrate"
  | "internet_access";

/** The default forbidden categories every delegation MUST carry.
 *  Callers may extend but cannot remove these. */
export const REQUIRED_FORBIDDEN_CATEGORIES: readonly ForbiddenCategory[] = Object.freeze([
  "authority_system",
  "security_system",
  "founder_keys",
  "protected_roots",
  "credentials",
  "production_secrets",
  "network_policy_changes",
  "agent_identity_files",
]);

/** Path prefixes every delegation MUST forbid regardless of allowed
 *  scope. Redundant with SECURITY_PROTECTED_ROOTS · listed here so a
 *  delegation carries its OWN prohibitions rather than relying on
 *  downstream to enforce them. */
export const REQUIRED_FORBIDDEN_PATH_PREFIXES: readonly string[] = Object.freeze([
  "src/lib/nex-authority-broker/",
  "src/lib/nex-controlled-hands/",
  "src/lib/nex1-orchestrator/wo2-",
  "src/lib/nex1-orchestrator/wo13-",
  "src/lib/nex-agent-runtime/process/identity.ts",
  "src/lib/nex-agent-runtime/nex2/",
  "src/lib/nex-agent-runtime/nex3/",
  "src/lib/nex-agent-runtime/security/",
  "src/lib/nex-agent-runtime/orchestrator/",
  "src/lib/nex-agent-runtime/founder-authority/",
  "data/nex-agent-runtime/identities/",
  ".env", ".env.production", ".env.local",
]);

// ── Delegation envelope (signed by founder offline) ────────────────────

export interface FounderDelegationEnvelope {
  readonly record_type: "NEX_FOUNDER_DELEGATION";
  readonly delegation_id: string;
  readonly founder_public_key_der_hex: string;             // which founder key delegated
  readonly delegate_agent_id: string;                       // which NEX agent may present it
  readonly delegate_public_key_der_hex: string;             // that agent's Ed25519 public key
  readonly allowed: DelegationAllowedScope;
  readonly forbidden: DelegationForbiddenScope;
  readonly issued_at: string;
  readonly expires_at: string;                              // MANDATORY · never unbounded
  readonly nonce: string;
  readonly founder_signature_hex: string;                   // founder Ed25519 signature over canonical envelope minus this field
}

// ── NEX authorization envelope (signed by delegate agent) ──────────────

export interface DelegatedAuthorizationEnvelope {
  readonly record_type: "NEX_DELEGATED_AUTHORIZATION";
  readonly authorization_id: string;
  readonly delegation_id: string;                           // references the delegation
  readonly proposal_id: string;
  readonly cap_id: string | null;
  readonly mission_id: string | null;
  readonly scope_hash: string;                              // hash of the SPECIFIC proposal's authorised_workstation_scope
  readonly authorized_by_agent_id: string;                  // must match delegation.delegate_agent_id
  readonly authorized_by_public_key_der_hex: string;
  readonly authorized_at: string;
  readonly authorization_expires_at: string;                // must be ≤ delegation.expires_at
  readonly nex_signature_hex: string;                       // NEX identity signature (not founder)
}

// ── Revocation record (signed by founder offline) ──────────────────────

export interface FounderDelegationRevocation {
  readonly record_type: "NEX_DELEGATION_REVOCATION";
  readonly revocation_id: string;
  readonly delegation_id: string;
  readonly founder_public_key_der_hex: string;
  readonly revoked_at: string;
  readonly reason: string;
  readonly founder_signature_hex: string;
}

// ── Verification result ────────────────────────────────────────────────

export type AuthorizationVerdict =
  | "AUTHORISED"                       // all checks passed
  | "NOT_AUTHORIZED_DELEGATION_INVALID"
  | "NOT_AUTHORIZED_DELEGATION_EXPIRED"
  | "NOT_AUTHORIZED_DELEGATION_REVOKED"
  | "NOT_AUTHORIZED_AUTHORIZATION_INVALID"
  | "NOT_AUTHORIZED_AUTHORIZATION_EXPIRED"
  | "NOT_AUTHORIZED_SCOPE_VIOLATION"
  | "NOT_AUTHORIZED_FORBIDDEN_CATEGORY"
  | "NOT_AUTHORIZED_DELEGATE_MISMATCH"  // authorization signed by wrong agent
  | "NOT_AUTHORIZED_MISSION_NOT_ALLOWED"
  | "NOT_AUTHORIZED_CAP_KIND_NOT_ALLOWED"
  | "NOT_AUTHORIZED_STAGE_NOT_ALLOWED"
  | "NOT_AUTHORIZED_RISK_TOO_HIGH"
  | "INSUFFICIENT_INPUT";               // missing envelope/proposal

export interface AuthorizationCheckDetail {
  readonly check: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface AuthorizationVerificationResult {
  readonly verdict: AuthorizationVerdict;
  readonly checks: readonly AuthorizationCheckDetail[];
  readonly reason_summary: string;
}

// ── Collections ────────────────────────────────────────────────────────

export const FOUNDER_DELEGATION_COLLECTION = "nex_founder_delegations" as const;
export const DELEGATED_AUTHORIZATION_COLLECTION = "nex_delegated_authorizations" as const;
export const FOUNDER_REVOCATION_COLLECTION = "nex_delegation_revocations" as const;
