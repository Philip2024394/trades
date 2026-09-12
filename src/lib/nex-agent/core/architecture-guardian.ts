// src/lib/nex-agent/core/architecture-guardian.ts
//
// NEX Agent v1.4 · Architecture Guardian.
//
// Extends nex2/nex3 with deeper checks that go beyond typecheck+lint:
//   1. ADR IMPACT report      (nex2 · WHY is this allowed · not just whether it compiles)
//   2. Deep security scanner  (nex3 · secrets · PII · credential leakage patterns)
//   3. Truth-engine guard     (nex3 · refuses changes touching src/lib/nex/truth-engine/*)
//   4. Merge gate             (final decision · can_merge boolean · founder still approves)
//
// This is the LAST automated gate before the founder types the approval phrase.
// If Architecture Guardian says "no" · nex1 does not proceed to worktree or apply.

import type { Plan, ProposedFile } from "./orchestrator-types";
import { analyseADRImpact, type ADRImpactReport } from "./adr-impact";

// ─── Deep security scanner · looks for high-risk patterns ───────
export interface SecurityFinding { severity: "critical" | "high" | "medium" | "low"; rule: string; detail: string; path?: string; line_hint?: string; }

const SECRET_PATTERNS: Array<{ rule: string; re: RegExp; severity: SecurityFinding["severity"]; detail: string }> = [
  // Broadened · matches `sk-<anything>-` (proj/live/etc.) followed by 20+ alnum/_/- chars · handles the modern OpenAI `sk-proj-...` format
  { rule: "hardcoded_openai_key", re: /\bsk-(?:proj-|test-|live-)?[A-Za-z0-9_-]{20,}/, severity: "critical", detail: "OpenAI-style API key hardcoded in source" },
  { rule: "hardcoded_anthropic_key", re: /sk-ant-[A-Za-z0-9\-_]{20,}/, severity: "critical", detail: "Anthropic API key hardcoded in source" },
  { rule: "hardcoded_stripe_key", re: /sk_(live|test)_[A-Za-z0-9]{16,}/, severity: "critical", detail: "Stripe secret key hardcoded in source" },
  { rule: "hardcoded_aws_key", re: /AKIA[0-9A-Z]{16}/, severity: "critical", detail: "AWS Access Key ID hardcoded in source" },
  { rule: "hardcoded_pg_password", re: /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]{6,}@[^\s'"]+/i, severity: "high", detail: "Postgres connection URL with inline password" },
  { rule: "hardcoded_jwt", re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, severity: "high", detail: "JWT literal in source · looks like a signed token" },
  { rule: "hardcoded_private_key", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PRIVATE )?PRIVATE KEY-----/, severity: "critical", detail: "Private key PEM header in source" },
  { rule: "env_leak_url", re: /https:\/\/[^\s'"<>]*\.supabase\.co/, severity: "medium", detail: "Supabase URL literal · phase-out via ADR-0300" },
  { rule: "hardcoded_generic_secret_hint", re: /\b(hardcoded|hard-coded|hardcode)\s+(?:key|token|secret|password)/i, severity: "high", detail: "Word 'hardcoded key/secret/token' in text · caller likely wants to embed a credential" },
];
const PII_PATTERNS: Array<{ rule: string; re: RegExp; severity: SecurityFinding["severity"]; detail: string }> = [
  { rule: "email_in_source", re: /['"]([\w.+-]+@[\w-]+\.[\w.-]+)['"]/, severity: "low", detail: "Email literal in source · may be PII" },
  { rule: "phone_uk_pii", re: /\+44\s*\d[\d\s]{8,}/, severity: "low", detail: "UK phone number literal · verify not PII" },
  { rule: "phone_id_pii", re: /\+62\s*\d[\d\s]{7,}/, severity: "low", detail: "Indonesia phone number literal · verify not PII" },
  { rule: "credit_card_like", re: /\b(?:\d[ -]?){13,16}\b/, severity: "high", detail: "Sequence resembling a credit card number" },
];

export function scanSecurity(files: ProposedFile[], extraText?: string): SecurityFinding[] {
  const out: SecurityFinding[] = [];
  const inputs: Array<{ text: string; path?: string }> = files.map(pf => ({ text: pf.preview_content, path: pf.path }));
  if (extraText) inputs.push({ text: extraText, path: "(intent.subject)" });
  for (const { text, path } of inputs) {
    if (!text) continue;
    for (const p of SECRET_PATTERNS) {
      const m = p.re.exec(text);
      if (m) out.push({ severity: p.severity, rule: p.rule, detail: p.detail, path, line_hint: m[0].slice(0, 40) + (m[0].length > 40 ? "…" : "") });
    }
    for (const p of PII_PATTERNS) {
      const m = p.re.exec(text);
      if (m) out.push({ severity: p.severity, rule: p.rule, detail: p.detail, path, line_hint: m[0].slice(0, 40) });
    }
  }
  return out;
}

// ─── Truth-engine guard · refuses writes to src/lib/nex/truth-engine ─
export function scanTruthEngineGuard(touched_paths: string[]): SecurityFinding[] {
  const out: SecurityFinding[] = [];
  for (const p of touched_paths) {
    if (p.startsWith("src/lib/nex/truth-engine/")) {
      out.push({ severity: "critical", rule: "truth_engine_touched", detail: "Change touches Truth Engine internals · protected doctrine · requires founder approval + ADR update", path: p });
    }
  }
  return out;
}

// ─── Merge gate · the final decision ────────────────────────────
export interface MergeGateResult {
  can_merge: boolean;
  reason: string;
  adr_impact: ADRImpactReport;
  security_findings: SecurityFinding[];
  truth_engine_findings: SecurityFinding[];
  blocked_by: string[];
  founder_approval_required: boolean;   // always true through V1.4 · V1.5 may relax for pre-cleared categories
}

export function runMergeGate(plan: Plan): MergeGateResult {
  const feature = plan.intent?.subject ?? "";
  const adrReport = analyseADRImpact(feature);
  const security = scanSecurity(plan.proposed_files ?? []);
  const truthEngine = scanTruthEngineGuard([...(plan.files_to_touch ?? []), ...(plan.files_to_create ?? [])]);

  const blocked_by: string[] = [];
  if (adrReport.overall_verdict === "blocked") blocked_by.push(...adrReport.blockers);
  const criticalSec = security.filter(f => f.severity === "critical");
  const highSec = security.filter(f => f.severity === "high");
  for (const f of criticalSec) blocked_by.push(`SECURITY · ${f.rule} · ${f.path ?? "?"}`);
  for (const f of highSec)     blocked_by.push(`SECURITY · ${f.rule} · ${f.path ?? "?"}`);
  for (const f of truthEngine) blocked_by.push(`TRUTH-ENGINE · ${f.detail}`);

  const canMerge = blocked_by.length === 0;
  const reason = canMerge
    ? `Architecture Guardian PASS · ADR: ${adrReport.overall_verdict} · security findings: ${security.length} (none blocking) · truth-engine touches: 0 · FOUNDER APPROVAL still required.`
    : `Architecture Guardian BLOCK · ${blocked_by.length} blocker(s): ${blocked_by.slice(0, 3).join(" | ")}`;

  return {
    can_merge: canMerge,
    reason,
    adr_impact: adrReport,
    security_findings: security,
    truth_engine_findings: truthEngine,
    blocked_by,
    founder_approval_required: true,
  };
}
