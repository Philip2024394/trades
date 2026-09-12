// src/app/nex/vs-frontier/page.tsx
//
// Founder Phase 9 · P9-2 · Public "NEX vs Frontier" comparison page.
//
// Direct public answer to the "NEX ≠ its underlying model" challenge.
// Renders the live measured comparison from /api/nex/vs-frontier.
// Zero fabrication · every number pulled live from Observatory.

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Comparison {
  property: string;
  nex_status: "advantage" | "honest_gap" | "parity";
  nex_measured: { value: string | number | null; source: string; observability_url?: string };
  frontier_baseline: { claim: string; citation_url?: string };
  why_it_matters: string;
}

interface VsFrontier {
  thesis?: string;
  window?: { preset: string; since: string; until: string };
  summary?: { total_properties: number; advantages: number; honest_gaps: number; parities: number };
  comparisons?: Comparison[];
  chat_challenge?: { received: string; response: string };
}

export default function VsFrontierPage() {
  const [data, setData] = useState<VsFrontier | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/nex/vs-frontier", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, letterSpacing: "-0.02em" }}>NEX vs Frontier</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.7 }}>
            NEX is a grounded intelligence system — not a raw language model. Here are the 9 measurable
            system properties where NEX is quantitatively different. Every NEX number is a live read from
            Observatory. Every frontier claim carries a cited URL.
          </p>
        </div>
        <button onClick={() => void load()} style={buttonStyle} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </header>

      {error && (
        <div style={{ ...cardStyle, borderColor: "#b91c1c", background: "#fef2f2" }}>
          <strong>Load error:</strong> {error}
        </div>
      )}

      {data && (
        <>
          <section style={{ ...cardStyle, background: "#f8fafc" }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.55 }}>
              The challenge
            </div>
            <blockquote style={{ margin: "6px 0", padding: "4px 12px", borderLeft: "3px solid #cbd5e1", fontSize: 14, opacity: 0.85 }}>
              {data.chat_challenge?.received}
            </blockquote>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.55, marginTop: 12 }}>
              NEX response
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 500 }}>{data.chat_challenge?.response}</p>
          </section>

          <section style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Advantages</div>
                <div style={{ ...bigNumberStyle, color: "#10b981" }}>{data.summary?.advantages ?? 0}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Honest gaps</div>
                <div style={{ ...bigNumberStyle, color: "#64748b" }}>{data.summary?.honest_gaps ?? 0}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Parities</div>
                <div style={{ ...bigNumberStyle, color: "#94a3b8" }}>{data.summary?.parities ?? 0}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Window</div>
                <div style={{ ...bigNumberStyle, fontSize: 22 }}>{data.window?.preset ?? "24h"}</div>
              </div>
            </div>
          </section>

          <div>
            {(data.comparisons ?? []).map((c, i) => (
              <section key={i} style={{ ...cardStyle, borderColor: c.nex_status === "advantage" ? "#10b981" : c.nex_status === "honest_gap" ? "#64748b" : "#e5e7eb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <h2 style={sectionTitleStyle}>{c.property}</h2>
                  <StatusBadge status={c.nex_status} />
                </div>

                <div style={rowStyle}>
                  <div style={colHeaderStyle}>NEX (measured)</div>
                  <div style={{ ...colHeaderStyle, opacity: 0.85 }}>Frontier baseline</div>
                </div>
                <div style={rowStyle}>
                  <div style={colStyle}>
                    <div style={{ fontFamily: "monospace", fontSize: 12, marginBottom: 4 }}>
                      value: <strong>{String(c.nex_measured.value ?? "—")}</strong>
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.65 }}>source: {c.nex_measured.source}</div>
                    {c.nex_measured.observability_url && (
                      <div style={{ marginTop: 4 }}>
                        <Link href={c.nex_measured.observability_url} style={smallLinkStyle}>
                          → live number
                        </Link>
                      </div>
                    )}
                  </div>
                  <div style={colStyle}>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>{c.frontier_baseline.claim}</div>
                    {c.frontier_baseline.citation_url && (
                      <a href={c.frontier_baseline.citation_url} target="_blank" rel="noopener noreferrer" style={smallLinkStyle}>
                        → source
                      </a>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75, fontStyle: "italic" }}>
                  Why it matters: {c.why_it_matters}
                </div>
              </section>
            ))}
          </div>

          <footer style={{ marginTop: 24, fontSize: 11, opacity: 0.5 }}>
            data-vs-frontier = "true" · zero fabrication ·
            <Link href="/api/nex/vs-frontier" style={{ color: "inherit", marginLeft: 4 }}>raw JSON</Link>
          </footer>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "advantage" | "honest_gap" | "parity" }) {
  const label = status === "advantage" ? "advantage" : status === "honest_gap" ? "honest gap" : "parity";
  const bg = status === "advantage" ? "#10b981" : status === "honest_gap" ? "#64748b" : "#94a3b8";
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 4,
      background: bg, color: "#fff", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600,
    }}>{label}</span>
  );
}

const pageStyle: React.CSSProperties = {
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  padding: "24px 28px 60px",
  maxWidth: 1000,
  margin: "0 auto",
  color: "#0f172a",
};
const headerStyle: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "flex-start",
  gap: 16, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #e5e7eb",
};
const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, background: "#fff", marginTop: 12,
};
const sectionTitleStyle: React.CSSProperties = { margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: "-0.005em" };
const bigNumberStyle: React.CSSProperties = { fontSize: 32, fontWeight: 700, marginTop: 4 };
const rowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 };
const colHeaderStyle: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.55, fontWeight: 600 };
const colStyle: React.CSSProperties = { padding: 10, background: "#f8fafc", borderRadius: 6, border: "1px solid #f1f5f9" };
const buttonStyle: React.CSSProperties = {
  padding: "6px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#f8fafc",
  fontSize: 13, cursor: "pointer",
};
const smallLinkStyle: React.CSSProperties = { color: "#1d4ed8", textDecoration: "none", fontSize: 12 };
