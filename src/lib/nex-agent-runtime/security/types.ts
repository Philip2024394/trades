// WO-NEX-RUNTIME-06 · Security agent types.
//
// Founder-locked 2026-09-13. Security is a CONTROL BOUNDARY, not a
// fourth vote. It vetoes even when NEX1 + NEX2 + NEX3 all approve.
// It reads records; it never modifies files.

export type SecurityVerdict =
  | "CLEARED"                       // no threats detected
  | "REJECTED_MALWARE"              // suspected malicious content
  | "REJECTED_DEPENDENCY_RISK"      // suspicious dependency introduction
  | "REJECTED_FS_ESCAPE"            // path escapes repo · absolute path · symlink
  | "REJECTED_PROTECTED_ROOT"       // targets protected security substrate
  | "REJECTED_NETWORK_POLICY"       // network access outside policy
  | "REJECTED_CREDENTIAL_LEAK"      // secret/token/key found in payload
  | "REJECTED_UNKNOWN"              // fits no allow-list · fail-closed
  | "ESCALATE_TO_FOUNDER"           // founder must review
  | "INSUFFICIENT_INPUT";           // review target missing

export type SecurityFindingCategory =
  | "malware"
  | "dependency"
  | "fs_escape"
  | "protected_root"
  | "network"
  | "credential"
  | "unknown_kind"
  | "input_missing";

export interface SecurityFinding {
  readonly category: SecurityFindingCategory;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly detail: string;
  readonly offending_target: string;             // path · dependency · pattern · etc.
  readonly evidence_ref: string | null;
}

/** Persisted, signed veto record. Consumers (Orchestrator later) MUST
 *  gate on this record and cannot proceed if verdict != CLEARED. */
export interface SecurityVetoRecord {
  readonly record_type: "NEX_SECURITY_VETO";
  readonly veto_id: string;
  readonly proposal_id: string;
  readonly cap_id: string | null;
  readonly mission_id: string | null;
  readonly reviewed_by_agent_id: string;
  readonly reviewed_by_instance_id: string;
  readonly reviewed_by_public_key_der_hex: string;
  readonly reviewed_at: string;
  readonly verdict: SecurityVerdict;
  readonly findings: readonly SecurityFinding[];
  readonly reason_summary: string;
  readonly no_files_modified: true;              // MUST always be true · Security is read-only
  readonly signature_hex: string;
}

export const SECURITY_VETO_COLLECTION = "nex_security_vetoes" as const;

// ── Protected roots (superset of NEX2's list) ──────────────────────────

export const SECURITY_PROTECTED_ROOTS: readonly string[] = Object.freeze([
  // Authority / crypto substrate
  "src/lib/nex-authority-broker/",
  "src/lib/nex-controlled-hands/",
  "src/lib/nex1-orchestrator/wo2-authorization.ts",
  "src/lib/nex1-orchestrator/wo2-authorization-store.ts",
  "src/lib/nex1-orchestrator/wo2-founder-keys.ts",
  "src/lib/nex1-orchestrator/wo13-",
  "src/lib/nex-cap/nex1-engineer.ts",
  // Agent runtime substrate
  "src/lib/nex-agent-runtime/process/identity.ts",
  "src/lib/nex-agent-runtime/process/daemon.ts",
  "src/lib/nex-agent-runtime/nex2/",
  "src/lib/nex-agent-runtime/nex3/",
  "src/lib/nex-agent-runtime/security/",
  // Storage of identities / audit / evidence
  "data/nex-agent-runtime/identities/",
  "data/nex-storage/nex_founder_",
  // Secrets · env
  ".env",
  ".env.production",
  ".env.local",
  "node_modules/",
  "package-lock.json",
]);

// ── Executable extensions ──────────────────────────────────────────────

export const SECURITY_EXECUTABLE_EXTENSIONS: ReadonlySet<string> = new Set([
  ".exe", ".dll", ".so", ".dylib", ".bat", ".cmd", ".ps1", ".sh", ".msi",
  ".vbs", ".jar", ".apk", ".dmg", ".pkg", ".deb", ".rpm",
]);

// ── Suspicious dependency names ────────────────────────────────────────

export const SECURITY_SUSPICIOUS_DEPENDENCY_PATTERNS: readonly RegExp[] = Object.freeze([
  /^event-?stream$/i,
  /^flatmap-?stream$/i,
  /^colors-?js$/i,
  /^ua-?parser-?js$/i,
  /^rc$/i,                                                    // known typosquat target
  /^discord[-.]/,                                             // known token-stealer family
  /credential/i, /secret/i, /steal/i, /rat[-_.]/i, /miner/i,
]);

// ── Credential-leak regex set ──────────────────────────────────────────

export const SECURITY_CREDENTIAL_PATTERNS: readonly RegExp[] = Object.freeze([
  /AKIA[0-9A-Z]{16}/,                                         // AWS access key
  /aws_secret_access_key\s*=\s*['"]?[A-Za-z0-9/+=]{40}/i,     // AWS secret
  /-----BEGIN\s+(RSA|EC|OPENSSH|PRIVATE)\s*(?:PRIVATE)?\s*KEY-----/,
  /ghp_[A-Za-z0-9]{36,40}/,                                    // GitHub PAT
  /github_pat_[A-Za-z0-9_]{40,}/,
  /sk-[A-Za-z0-9]{30,}/,                                       // OpenAI-style key
  /xox[baprs]-[A-Za-z0-9-]+/,                                  // Slack token
  /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,   // JWT
]);
