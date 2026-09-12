// src/app/nex/accessibility/page.tsx
//
// Founder Phase 23 · P23-2 · Public WCAG audit page.
// Server-renders an audit of the default NEX page list.
// No client JS needed · uses the same rules engine as the endpoint.

import { auditHtml, scoreFromViolations, type AuditReport } from "@/lib/nex/accessibility/rules";

export const dynamic = "force-dynamic";

const DEFAULT_PATHS = [
  "/nex/settings",
  "/nex/tools",
  "/nex/voice",
  "/nex/vs-frontier",
  "/header-off",
];

async function auditOne(base: string, path: string): Promise<AuditReport> {
  const t0 = performance.now();
  try {
    const res = await fetch(`${base}${path}`, { headers: { "user-agent": "NEX-A11y-Audit/1.0" } });
    const html = await res.text();
    const out = auditHtml(html);
    return {
      path, status: res.status, bytes: html.length,
      score: scoreFromViolations(out.violations),
      violations: out.violations,
      cannot_check_from_html: out.cannot_check_from_html,
      checked_rules: out.checked_rules,
      ms: Math.round(performance.now() - t0),
    };
  } catch {
    return { path, status: 0, bytes: 0, score: 0, violations: [], cannot_check_from_html: [], checked_rules: [], ms: 0 };
  }
}

export default async function AccessibilityPage() {
  const base = process.env.NEX_SELF_URL ?? "http://localhost:3008";
  const reports: AuditReport[] = [];
  for (const p of DEFAULT_PATHS) reports.push(await auditOne(base, p));
  const total = reports.reduce((n, r) => n + r.violations.length, 0);
  const avg = reports.length > 0 ? Math.round(reports.reduce((n, r) => n + r.score, 0) / reports.length) : 0;

  const styles = {
    main: { maxWidth: 960, margin: "2rem auto", padding: "1rem", fontFamily: "system-ui" } as const,
    label: { fontSize: "0.7rem", color: "#71717a", textTransform: "uppercase" as const, letterSpacing: "0.05em" },
    card: { border: "1px solid #e4e4e7", borderRadius: 8, padding: "1rem", marginBottom: "1rem" } as const,
    sev: (s: string) => ({
      display: "inline-block",
      padding: "0.1rem 0.5rem",
      fontSize: "0.72rem",
      borderRadius: 4,
      background: s === "critical" ? "#fef2f2" : s === "serious" ? "#fff7ed" : s === "moderate" ? "#fefce8" : "#f4f4f5",
      color: s === "critical" ? "#991b1b" : s === "serious" ? "#9a3412" : s === "moderate" ? "#854d0e" : "#3f3f46",
      marginRight: 8,
    }),
    scoreBadge: (n: number) => ({
      display: "inline-block",
      padding: "0.15rem 0.6rem",
      fontSize: "0.85rem",
      fontWeight: 600,
      borderRadius: 999,
      background: n >= 90 ? "#dcfce7" : n >= 70 ? "#fefce8" : "#fee2e2",
      color: n >= 90 ? "#166534" : n >= 70 ? "#854d0e" : "#991b1b",
    }),
    footer: { marginTop: "1.5rem", padding: "0.75rem 1rem", background: "#fafafa", border: "1px solid #e4e4e7", borderRadius: 8, fontSize: "0.8rem", color: "#52525b" } as const,
  };

  return (
    <main lang="en" style={styles.main} data-a11y-audit-page="true">
      <header>
        <div style={styles.label}>NEX · Accessibility Audit</div>
        <h1 style={{ margin: "0.25rem 0" }}>WCAG 2.1 audit · {reports.length} pages</h1>
        <p style={{ color: "#71717a", fontSize: "0.9rem" }}>
          <span style={styles.scoreBadge(avg)}>avg score {avg}/100</span>
          {" · "}
          <strong>{total}</strong> total violations across {reports.length} pages
        </p>
      </header>

      {reports.map((r) => (
        <section key={r.path} style={styles.card} aria-labelledby={`audit-${r.path}`}>
          <h2 id={`audit-${r.path}`} style={{ margin: 0, fontSize: "1rem" }}>
            <code>{r.path}</code>
            {" "}
            <span style={styles.scoreBadge(r.score)}>score {r.score}</span>
            <span style={{ fontSize: "0.75rem", color: "#71717a", marginLeft: 8 }}>
              status {r.status} · {r.bytes.toLocaleString()} bytes · {r.ms}ms
            </span>
          </h2>
          {r.violations.length === 0 ? (
            <p style={{ margin: "0.5rem 0 0", color: "#166534", fontSize: "0.9rem" }}>
              No hard-rule violations detected.
            </p>
          ) : (
            <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
              {r.violations.map((v, i) => (
                <li key={i} style={{ marginBottom: "0.4rem" }}>
                  <span style={styles.sev(v.severity)}>{v.severity}</span>
                  <code style={{ fontSize: "0.75rem" }}>{v.rule_id} · WCAG {v.criterion}</code>
                  <div style={{ marginTop: "0.15rem" }}>{v.message}</div>
                  <div style={{ marginTop: "0.15rem", fontFamily: "monospace", fontSize: "0.72rem", background: "#fafafa", padding: "0.2rem 0.4rem", borderRadius: 4, overflow: "auto" }}>
                    {v.snippet}
                  </div>
                  <div style={{ marginTop: "0.15rem", color: "#52525b", fontSize: "0.8rem" }}>
                    Fix: {v.suggestion}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <div style={styles.footer}>
        <strong>Honest scope:</strong> hard HTML rules can be checked from source. The following depend on runtime and are NOT checked here:
        <ul style={{ margin: "0.3rem 0 0 1rem", padding: 0 }}>
          {reports[0]?.cannot_check_from_html.map((s) => <li key={s} style={{ fontSize: "0.78rem" }}>{s}</li>)}
        </ul>
      </div>
    </main>
  );
}
