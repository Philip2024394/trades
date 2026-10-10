// src/lib/nex-agent/code-engine/capability-repo-report.ts
//
// NEX1 · Repo Report capability (Ledger B, 2026-09-18)
//
// PURPOSE
//   Deterministic report writer. Given a structured input describing:
//     · what NEX capabilities were run,
//     · what each capability emitted,
//     · what supervisor observations were made,
//   emit both a Markdown report and a machine-readable JSON receipt in
//   the founder's Section 26/29 format.
//
//   Zero-LLM. Pure formatting.  Never invents findings — only formats what
//   the caller supplied.
//
// The caller composes the inputs from real NEX capability outputs
// (package_audit, boundary_interface_specialist, discoverRepositoryCandidates,
// inspectFileSource, etc.). This module never runs those capabilities itself.

import fs from "node:fs";
import path from "node:path";
import { registerAgent, recordHeartbeat } from "./capability-agent-registry";

registerAgent({
  id: "repo_reporter",
  name: "Repo Reporter · deterministic report writer",
  cognitive_layer: "brain_recovery_specialist",
  description: "Serialises structured NEX capability outputs + supervisor observations into a Section 29-format Markdown report + JSON receipt. Formats only; never invents findings.",
});

// ── Input types ────────────────────────────────────────────────────────

export interface FindingRecord {
  readonly id: string;
  readonly file?: string | null;
  readonly line?: number | null;
  readonly category: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly note: string;
  readonly source: "NEX_NATIVE" | "CLAUDE_MANUAL" | "PACKAGE_AUDIT" | "BRB_NETWORK";
  readonly evidence?: Readonly<Record<string, unknown>>;
}

export interface CapabilityInvocation {
  readonly capability_id: string;
  readonly summary: string;
  readonly output_size_bytes?: number;
  readonly emitted_records?: number;
  readonly notable_output?: Readonly<Record<string, unknown>>;
}

export interface SupervisorObservation {
  readonly dimension: string;
  readonly before: string | number | boolean | null;
  readonly after: string | number | boolean | null;
  readonly delta: string;
}

export interface RepoReportInput {
  readonly report_title: string;
  readonly repo_url?: string;
  readonly repo_root: string;
  readonly commit?: string;
  readonly generated_at?: string;                 // ISO
  readonly executive_summary: readonly (readonly [string, string])[]; // (key, value)
  readonly nex_capabilities_invoked: readonly CapabilityInvocation[];
  readonly findings: readonly FindingRecord[];
  readonly repo_side_suggestions: readonly string[];
  readonly nex_side_suggestions: readonly string[];
  readonly supervisor_observations: readonly SupervisorObservation[];
  readonly what_was_not_done: readonly string[];
  readonly next_step_options: readonly (readonly [string, string])[]; // (label, description)
  readonly ledger: {
    readonly ledger_a_note: string;
    readonly ledger_b_artefacts: readonly string[];
  };
}

export interface RepoReportOutput {
  readonly markdown: string;
  readonly json: Readonly<Record<string, unknown>>;
  readonly markdown_path: string | null;
  readonly json_path: string | null;
  readonly evidence_kind: "OBSERVED";
}

// ── Public entry ──────────────────────────────────────────────────────

export function renderRepoReport(input: RepoReportInput, opts?: {
  readonly output_dir?: string;
  readonly filename_stem?: string;
}): RepoReportOutput {
  const md = renderMarkdown(input);
  const json = renderJson(input);

  let markdownPath: string | null = null;
  let jsonPath: string | null = null;
  if (opts?.output_dir) {
    fs.mkdirSync(opts.output_dir, { recursive: true });
    const stem = opts.filename_stem ?? "repo-report-" + new Date().toISOString().slice(0, 10);
    markdownPath = path.join(opts.output_dir, stem + ".md");
    jsonPath = path.join(opts.output_dir, stem + ".json");
    fs.writeFileSync(markdownPath, md, "utf8");
    fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2), "utf8");
  }

  recordHeartbeat({
    agent_id: "repo_reporter",
    event_type: "render_report",
    event_data: { title: input.report_title, findings: input.findings.length, capabilities: input.nex_capabilities_invoked.length },
  });

  return { markdown: md, json, markdown_path: markdownPath, json_path: jsonPath, evidence_kind: "OBSERVED" };
}

// ── Renderers ─────────────────────────────────────────────────────────

function renderMarkdown(r: RepoReportInput): string {
  const at = r.generated_at ?? new Date().toISOString();
  const lines: string[] = [];
  lines.push(`# ${r.report_title}`);
  lines.push("");
  lines.push(`**Generated:** ${at}`);
  if (r.repo_url) lines.push(`**Repository:** ${r.repo_url}`);
  lines.push(`**Root:** \`${r.repo_root}\``);
  if (r.commit) lines.push(`**Commit:** \`${r.commit}\``);
  lines.push("");

  // Executive summary
  lines.push("## Executive summary");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|---|---|");
  for (const [k, v] of r.executive_summary) lines.push(`| ${escapeCell(k)} | ${escapeCell(v)} |`);
  lines.push("");

  // NEX capabilities
  lines.push("## Section 1 · NEX capabilities invoked");
  lines.push("");
  if (r.nex_capabilities_invoked.length === 0) {
    lines.push("_None._");
  } else {
    lines.push("| Capability | Summary | Records emitted |");
    lines.push("|---|---|---|");
    for (const c of r.nex_capabilities_invoked) {
      lines.push(`| \`${c.capability_id}\` | ${escapeCell(c.summary)} | ${c.emitted_records ?? "—"} |`);
    }
  }
  lines.push("");

  // Findings grouped by source
  lines.push("## Section 2 · Findings");
  lines.push("");
  const bySource = groupBy(r.findings, (f) => f.source);
  for (const src of ["NEX_NATIVE", "PACKAGE_AUDIT", "BRB_NETWORK", "CLAUDE_MANUAL"] as const) {
    const group = bySource.get(src) ?? [];
    if (group.length === 0) continue;
    lines.push(`### ${src} (${group.length} findings)`);
    lines.push("");
    lines.push("| id | severity | file | category | note |");
    lines.push("|---|---|---|---|---|");
    for (const f of group.sort((a, b) => severityRank(a.severity) - severityRank(b.severity))) {
      lines.push(`| ${escapeCell(f.id)} | ${severityMarker(f.severity)} | ${escapeCell(f.file ?? "—")}${f.line ? `:${f.line}` : ""} | ${escapeCell(f.category)} | ${escapeCell(f.note)} |`);
    }
    lines.push("");
  }

  // Suggestions
  lines.push("## Section 3 · Repository-side suggestions");
  lines.push("");
  for (const s of r.repo_side_suggestions) lines.push(`- ${s}`);
  lines.push("");
  lines.push("## Section 4 · NEX-side capability suggestions");
  lines.push("");
  for (const s of r.nex_side_suggestions) lines.push(`- ${s}`);
  lines.push("");

  // Supervisor observations
  lines.push("## Section 5 · Supervisor observations (NEX brain state)");
  lines.push("");
  lines.push("| Dimension | Before | After | Delta |");
  lines.push("|---|---|---|---|");
  for (const o of r.supervisor_observations) {
    lines.push(`| ${escapeCell(o.dimension)} | ${escapeCell(String(o.before))} | ${escapeCell(String(o.after))} | ${escapeCell(o.delta)} |`);
  }
  lines.push("");

  // What was not done
  lines.push("## Section 6 · Not done (honest disclosure)");
  lines.push("");
  for (const n of r.what_was_not_done) lines.push(`- ${n}`);
  lines.push("");

  // Ledger
  lines.push("## Section 7 · Ledger");
  lines.push("");
  lines.push("**Ledger A:** " + r.ledger.ledger_a_note);
  lines.push("");
  lines.push("**Ledger B:**");
  for (const a of r.ledger.ledger_b_artefacts) lines.push(`- ${a}`);
  lines.push("");

  // Next steps
  lines.push("## Section 8 · Next-step options");
  lines.push("");
  for (const [label, desc] of r.next_step_options) lines.push(`- **${label}** — ${desc}`);
  lines.push("");

  lines.push(`*End of report · ${at}.*`);
  return lines.join("\n");
}

function renderJson(r: RepoReportInput): Readonly<Record<string, unknown>> {
  return {
    report_title: r.report_title,
    repo_url: r.repo_url ?? null,
    repo_root: r.repo_root,
    commit: r.commit ?? null,
    generated_at: r.generated_at ?? new Date().toISOString(),
    executive_summary: Object.fromEntries(r.executive_summary),
    nex_capabilities_invoked: r.nex_capabilities_invoked,
    findings_by_source: Object.fromEntries(groupBy(r.findings, (f) => f.source)),
    findings_by_severity: Object.fromEntries(groupBy(r.findings, (f) => f.severity)),
    total_findings: r.findings.length,
    repo_side_suggestions: r.repo_side_suggestions,
    nex_side_suggestions: r.nex_side_suggestions,
    supervisor_observations: r.supervisor_observations,
    what_was_not_done: r.what_was_not_done,
    ledger: r.ledger,
    next_step_options: r.next_step_options.map(([label, desc]) => ({ label, desc })),
    r11b_marker: "REPO_REPORT_STRUCTURAL_FACT",
  };
}

// ── Utility ───────────────────────────────────────────────────────────

function severityRank(s: FindingRecord["severity"]): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[s];
}
function severityMarker(s: FindingRecord["severity"]): string {
  return { critical: "🔴 critical", high: "🟠 high", medium: "🟡 medium", low: "⚪ low" }[s];
}
function escapeCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
function groupBy<T, K extends string>(arr: readonly T[], keyOf: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const t of arr) {
    const k = keyOf(t);
    const g = m.get(k) ?? [];
    g.push(t);
    m.set(k, g);
  }
  return m;
}

export const REPO_REPORT_VERSION = "repo-report.v1";
