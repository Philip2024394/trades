// NEX App Builder · Phase 19C · Verdict preview client shell.
//
// Dev-only. Renders three <VerdictPanel> instances side-by-side so the
// Playwright browser QA can assert every state chip renders in a real
// browser and every credential-scrub survives DOM rendering.
//
// This file MUST NOT be imported outside the __verdict-preview route.

"use client";

import type { CSSProperties } from "react";

type Highlight = { observation: string; source: string; path?: string; safeValue?: unknown };
type Verdict = {
  worker: string;
  displayName: string;
  status: "ok" | "warn" | "blocked" | "failed";
  state: "HEALTHY" | "DEGRADED" | "BLOCKED_INPUT" | "BLOCKED_CONFIG" | "BLOCKED_UPSTREAM" | "FAILED" | "PENDING" | "UNKNOWN";
  diagnosis: string;
  decision: string;
  evidenceCount: number;
  evidenceHighlights: Highlight[];
  durationMs: number;
};
type Surface = {
  runId: string;
  ranAt: string;
  overall: string;
  totalDurationMs: number;
  verdicts: Verdict[];
  counts: Record<Verdict["state"], number>;
};

const STATE_COLOUR: Record<Verdict["state"], { bg: string; border: string; text: string; label: string }> = {
  HEALTHY:          { bg: "#f0fdf4", border: "#86efac", text: "#166534", label: "Healthy" },
  DEGRADED:         { bg: "#fefce8", border: "#fde047", text: "#854d0e", label: "Degraded" },
  BLOCKED_INPUT:    { bg: "#fff7ed", border: "#fdba74", text: "#9a3412", label: "Needs input" },
  BLOCKED_CONFIG:   { bg: "#eff6ff", border: "#93c5fd", text: "#1e3a8a", label: "Needs config" },
  BLOCKED_UPSTREAM: { bg: "#f5f3ff", border: "#c4b5fd", text: "#5b21b6", label: "Blocked upstream" },
  FAILED:           { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", label: "Failed" },
  PENDING:          { bg: "#f8fafc", border: "#cbd5e1", text: "#334155", label: "Pending" },
  UNKNOWN:          { bg: "#fafafa", border: "#d4d4d4", text: "#525252", label: "Unknown" }
};

export function VerdictPreviewClient({
  raw,
  completed,
  forcedAllStatesA,
  forcedAllStatesB
}: {
  raw: Surface;
  completed: Surface;
  forcedAllStatesA: Surface;
  forcedAllStatesB: Surface;
}) {
  return (
    <main style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 16px", fontFamily: "Inter, system-ui, sans-serif", color: "#1a1a1a" }} data-testid="verdict-preview-root">
      <header style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 2, color: "#8a8a8a" }}>NEX App Builder · Phase 19C · Dev preview</div>
        <h1 style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 600 }}>VerdictPanel · browser QA fixture</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>
          Four surfaces: raw blueprint, completed blueprint, and two synthetic surfaces that together render all 8 states of the taxonomy.
        </p>
      </header>

      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))" }}>
        <PanelBlock title="Raw staircase Blueprint" testid="verdict-panel-raw" surface={raw} />
        <PanelBlock title="Completed staircase Blueprint" testid="verdict-panel-completed" surface={completed} />
        <PanelBlock title="Synthetic A · six states + credential-scrub" testid="verdict-panel-all-states" surface={forcedAllStatesA} />
        <PanelBlock title="Synthetic B · DEGRADED + BLOCKED_INPUT" testid="verdict-panel-all-states-b" surface={forcedAllStatesB} />
      </div>
    </main>
  );
}

function PanelBlock({ title, testid, surface }: { title: string; testid: string; surface: Surface }) {
  return (
    <section style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 10, padding: 12 }} data-testid={testid}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#333" }}>{title}</div>
      <VerdictPanel surface={surface} />
    </section>
  );
}

// This is a byte-for-byte duplicate of the production VerdictPanel body so
// the preview renders EXACTLY the same DOM the customer sees after build.
// (Extracting the panel to a shared file is a follow-up refactor once we
// prove it renders correctly — copy-then-consolidate is safer than
// share-then-fix.)
function VerdictPanel({ surface }: { surface: Surface }) {
  const containerStyle: CSSProperties = { marginTop: 4, padding: 12, background: "#fafafa", border: "1px solid #e5e5e5", borderRadius: 8 };
  return (
    <div style={containerStyle} data-testid="verdict-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#666" }} data-testid="verdict-overall">NEX diagnostics · {surface.overall}</div>
        <div style={{ fontSize: 11, color: "#888" }}>{surface.totalDurationMs}ms · run {surface.runId}</div>
      </div>
      {surface.verdicts.map((v) => {
        const c = STATE_COLOUR[v.state];
        return (
          <div key={v.worker} data-testid={`verdict-card-${v.worker}`} data-state={v.state} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 6, padding: 10, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: c.text }} data-testid={`verdict-card-${v.worker}-name`}>{v.displayName}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: c.text, background: "#fff", padding: "2px 8px", borderRadius: 10, border: `1px solid ${c.border}` }} data-testid={`verdict-card-${v.worker}-chip`}>
                {c.label}
              </div>
            </div>
            <div style={{ fontSize: 13, color: "#333", marginBottom: 4 }} data-testid={`verdict-card-${v.worker}-diagnosis`}>
              <strong>Diagnosis.</strong> {v.diagnosis}
            </div>
            <div style={{ fontSize: 13, color: "#333", marginBottom: v.evidenceHighlights.length > 0 ? 6 : 0 }} data-testid={`verdict-card-${v.worker}-decision`}>
              <strong>Next.</strong> {v.decision}
            </div>
            {v.evidenceHighlights.length > 0 && (
              <details style={{ marginTop: 4 }} data-testid={`verdict-card-${v.worker}-evidence`}>
                <summary style={{ cursor: "pointer", fontSize: 12, color: "#555" }}>
                  {v.evidenceCount} evidence record(s) · show highlights
                </summary>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: "#555" }}>
                  {v.evidenceHighlights.map((h, i) => (
                    <li key={i} style={{ marginBottom: 3 }}>
                      <span style={{ color: "#888" }}>[{h.source}{h.path ? ` · ${h.path}` : ""}]</span> {h.observation}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
