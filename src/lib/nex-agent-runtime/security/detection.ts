// WO-NEX-RUNTIME-06 · deterministic security detection.
//
// Founder-locked 2026-09-13. Pure P-S functions. No LLM. No Internet.
// Read-only inspection of a proposal + optional payloads. Every rule
// produces zero or more SecurityFinding records with severity.

import path from "node:path";
import type { CapEngineeringProposal } from "@/lib/nex-cap/nex1-engineer";
import {
  type SecurityFinding,
  SECURITY_PROTECTED_ROOTS,
  SECURITY_EXECUTABLE_EXTENSIONS,
  SECURITY_SUSPICIOUS_DEPENDENCY_PATTERNS,
  SECURITY_CREDENTIAL_PATTERNS,
} from "./types";

// ── Detection surface (all optional inputs) ────────────────────────────

export interface SecurityInspectionInput {
  readonly proposal: CapEngineeringProposal;
  /** Optional file-write intents that Security should evaluate. In
   *  RUNTIME-06 these are records supplied by earlier agents; Security
   *  never reads them from disk. */
  readonly file_write_intents?: readonly { path: string; content_preview: string }[];
  /** Optional dependency-addition intents. */
  readonly dependency_intents?: readonly { name: string; version: string }[];
  /** Optional network-access intents. */
  readonly network_intents?: readonly { url: string; method: string }[];
  /** Optional child-process-spawn intents. */
  readonly process_intents?: readonly { command: string; args: readonly string[] }[];
}

// ── Rule: protected root ───────────────────────────────────────────────

export function detectProtectedRoot(input: SecurityInspectionInput): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const paths = new Set<string>();
  const scope = input.proposal.authorised_workstation_scope;
  if (scope) for (const p of scope.files_may_touch) paths.add(p);
  for (const w of input.file_write_intents ?? []) paths.add(w.path);
  for (const p of paths) {
    const norm = p.replace(/\\/g, "/");
    const hit = SECURITY_PROTECTED_ROOTS.find((r) => norm === r || norm.startsWith(r));
    if (hit) {
      findings.push({
        category: "protected_root", severity: "critical",
        detail: `path ${p} touches protected security root ${hit}`,
        offending_target: p, evidence_ref: input.proposal.proposal_id,
      });
    }
  }
  return findings;
}

// ── Rule: filesystem escape ────────────────────────────────────────────

export function detectFilesystemEscape(input: SecurityInspectionInput): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const paths = new Set<string>();
  const scope = input.proposal.authorised_workstation_scope;
  if (scope) for (const p of scope.files_may_touch) paths.add(p);
  for (const w of input.file_write_intents ?? []) paths.add(w.path);
  for (const p of paths) {
    if (path.isAbsolute(p)) {
      findings.push({ category: "fs_escape", severity: "critical",
        detail: `absolute path not allowed: ${p}`,
        offending_target: p, evidence_ref: input.proposal.proposal_id });
      continue;
    }
    const parts = p.split(/[\\/]/);
    if (parts.includes("..")) {
      findings.push({ category: "fs_escape", severity: "critical",
        detail: `path escape via .. not allowed: ${p}`,
        offending_target: p, evidence_ref: input.proposal.proposal_id });
    }
  }
  return findings;
}

// ── Rule: executable file extension ────────────────────────────────────

export function detectMaliciousExtensions(input: SecurityInspectionInput): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const paths = new Set<string>();
  const scope = input.proposal.authorised_workstation_scope;
  if (scope) for (const p of scope.files_may_touch) paths.add(p);
  for (const w of input.file_write_intents ?? []) paths.add(w.path);
  for (const p of paths) {
    const ext = path.extname(p).toLowerCase();
    if (SECURITY_EXECUTABLE_EXTENSIONS.has(ext)) {
      findings.push({ category: "malware", severity: "critical",
        detail: `executable extension ${ext} not permitted in engineering scope: ${p}`,
        offending_target: p, evidence_ref: input.proposal.proposal_id });
    }
  }
  return findings;
}

// ── Rule: dependency risk ──────────────────────────────────────────────

export function detectDependencyRisk(input: SecurityInspectionInput): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  for (const dep of input.dependency_intents ?? []) {
    for (const pat of SECURITY_SUSPICIOUS_DEPENDENCY_PATTERNS) {
      if (pat.test(dep.name)) {
        findings.push({ category: "dependency", severity: "high",
          detail: `dependency ${dep.name}@${dep.version} matches suspicious pattern ${pat.source}`,
          offending_target: dep.name, evidence_ref: input.proposal.proposal_id });
        break;
      }
    }
  }
  return findings;
}

// ── Rule: network policy (RUNTIME-06 allow-list is empty · fail-closed) ─

export function detectNetworkPolicyBreach(input: SecurityInspectionInput): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  // RUNTIME-06 does NOT permit any network access from within a mission.
  // Later WO-NEX-RUNTIME-09 will introduce a signed source registry.
  for (const n of input.network_intents ?? []) {
    findings.push({ category: "network", severity: "critical",
      detail: `network access to ${n.method} ${n.url} rejected · RUNTIME-06 network policy is empty allow-list (fail-closed)`,
      offending_target: n.url, evidence_ref: input.proposal.proposal_id });
  }
  return findings;
}

// ── Rule: credential leak ──────────────────────────────────────────────

export function detectCredentialLeak(input: SecurityInspectionInput): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const surface: string[] = [];
  surface.push(input.proposal.diagnosis, input.proposal.proposed_fix_summary);
  for (const w of input.file_write_intents ?? []) surface.push(w.content_preview);
  for (const p of input.process_intents ?? []) surface.push(p.command, ...p.args);
  for (const s of surface) {
    for (const pat of SECURITY_CREDENTIAL_PATTERNS) {
      const m = s.match(pat);
      if (m) {
        findings.push({ category: "credential", severity: "critical",
          detail: `credential-shaped pattern detected: ${pat.source.slice(0, 40)} · sample=${m[0].slice(0, 12)}…`,
          offending_target: pat.source, evidence_ref: input.proposal.proposal_id });
      }
    }
  }
  return findings;
}

// ── Rule: unknown-kind (fail-closed for anomalous proposals) ───────────

export function detectUnknownShape(input: SecurityInspectionInput): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  // If the proposal has none of the expected known fields populated, flag
  // as INSUFFICIENT_INPUT (handled at verdict time). Not a finding here.
  void input;
  return findings;
}

// ── Rule: child-process risk ───────────────────────────────────────────

const DANGEROUS_COMMANDS = new Set(["rm", "del", "curl", "wget", "powershell", "bash", "sh", "cmd", "iex", "invoke-expression", "chmod", "chown", "sudo", "runas"]);

export function detectDangerousProcess(input: SecurityInspectionInput): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  for (const p of input.process_intents ?? []) {
    const base = path.basename(p.command).toLowerCase();
    if (DANGEROUS_COMMANDS.has(base)) {
      findings.push({ category: "malware", severity: "high",
        detail: `dangerous command in process intent: ${p.command} ${p.args.join(" ").slice(0, 100)}`,
        offending_target: p.command, evidence_ref: input.proposal.proposal_id });
    }
  }
  return findings;
}

// ── Compose all rules ──────────────────────────────────────────────────

export function runAllDetectionRules(input: SecurityInspectionInput): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  findings.push(...detectProtectedRoot(input));
  findings.push(...detectFilesystemEscape(input));
  findings.push(...detectMaliciousExtensions(input));
  findings.push(...detectDependencyRisk(input));
  findings.push(...detectNetworkPolicyBreach(input));
  findings.push(...detectCredentialLeak(input));
  findings.push(...detectDangerousProcess(input));
  return findings;
}
