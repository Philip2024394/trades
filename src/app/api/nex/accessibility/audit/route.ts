// src/app/api/nex/accessibility/audit/route.ts
//
// Founder Phase 23 · P23-2 · WCAG audit endpoint.
//
// POST body: { paths: string[] } | { html: string }
//
// Two modes:
//   1. paths mode · fetches each path from this host and audits its HTML
//   2. inline mode · audits raw HTML supplied in the body (test path)
//
// Doctrine anchor:
//   accessibility-doctrine · every violation traces to a hard rule ·
//   the honest scope disclosure lists what CANNOT be checked from HTML.

import { NextResponse } from "next/server";
import { auditHtml, scoreFromViolations, type AuditReport } from "@/lib/nex/accessibility/rules";

export const runtime = "nodejs";

const DEFAULT_PATHS = [
  "/nex/settings",
  "/nex/tools",
  "/nex/voice",
  "/nex/vs-frontier",
  "/header-off",
];

async function auditPath(host: string, proto: string, path: string): Promise<AuditReport> {
  const t0 = performance.now();
  const res = await fetch(`${proto}://${host}${path}`, {
    headers: { "user-agent": "NEX-A11y-Audit/1.0" },
  });
  const html = await res.text();
  const { violations, checked_rules, cannot_check_from_html } = auditHtml(html);
  return {
    path,
    status: res.status,
    bytes: html.length,
    score: scoreFromViolations(violations),
    violations,
    cannot_check_from_html,
    checked_rules,
    ms: Math.round(performance.now() - t0),
  };
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }

  const host = req.headers.get("host") ?? "localhost:3008";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";

  // Inline mode.
  if (typeof body.html === "string" && body.html.length > 0) {
    const t0 = performance.now();
    const { violations, checked_rules, cannot_check_from_html } = auditHtml(body.html);
    const report: AuditReport = {
      path: "(inline)",
      status: 200,
      bytes: body.html.length,
      score: scoreFromViolations(violations),
      violations,
      cannot_check_from_html,
      checked_rules,
      ms: Math.round(performance.now() - t0),
    };
    return NextResponse.json({ reports: [report], summary: summarise([report]) });
  }

  // Paths mode.
  const raw = Array.isArray(body.paths) ? body.paths : DEFAULT_PATHS;
  const paths = raw.filter((p): p is string => typeof p === "string" && p.startsWith("/")).slice(0, 30);
  if (paths.length === 0) {
    return NextResponse.json({ error: "no_paths" }, { status: 400 });
  }

  const reports: AuditReport[] = [];
  for (const p of paths) {
    try {
      reports.push(await auditPath(host, proto, p));
    } catch (e) {
      reports.push({
        path: p, status: 0, bytes: 0, score: 0,
        violations: [], cannot_check_from_html: [], checked_rules: [],
        ms: 0,
      });
    }
  }
  return NextResponse.json({ reports, summary: summarise(reports) });
}

// GET convenience · audits the default path list
export async function GET(req: Request) {
  const host = req.headers.get("host") ?? "localhost:3008";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const reports: AuditReport[] = [];
  for (const p of DEFAULT_PATHS) {
    try { reports.push(await auditPath(host, proto, p)); } catch { /* skip */ }
  }
  return NextResponse.json({
    reports,
    summary: summarise(reports),
    doctrine_note: "Every violation traces to a hard HTML rule. Runtime-dependent checks (contrast, focus-visible, keyboard traps, motion) are honestly listed as cannot_check_from_html.",
  });
}

function summarise(reports: AuditReport[]) {
  const totalViolations = reports.reduce((n, r) => n + r.violations.length, 0);
  const avgScore = reports.length > 0
    ? Math.round(reports.reduce((n, r) => n + r.score, 0) / reports.length)
    : 0;
  const perSeverity: Record<string, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const r of reports) for (const v of r.violations) perSeverity[v.severity] = (perSeverity[v.severity] ?? 0) + 1;
  return {
    audited: reports.length,
    total_violations: totalViolations,
    average_score: avgScore,
    per_severity: perSeverity,
  };
}
