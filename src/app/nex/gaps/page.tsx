// src/app/nex/gaps/page.tsx
//
// Founder GAP-1 · Founder-facing gap-priority page.
//
// Reads /api/nex/observatory/snapshot?window=7d and ranks per-domain
// open knowledge gaps by customer demand (times_seen). Founder sees at
// a glance which entity × intent combinations are starving for facts.
//
// Doctrine-safe · read-only surface · no fabrication (numbers are
// direct reads from nex.knowledge_gap via the Observatory Brain).

"use client";

import { useCallback, useEffect, useState } from "react";

type WindowPreset = "1h" | "24h" | "7d" | "30d";

interface DomainGap {
  domain: string;
  open_gap_count: number;
  oldest_open_age_days?: number;
  top_gaps: Array<{
    entity_ref: string;
    intent_slug: string;
    times_seen: number;
    first_seen_at: string;
    last_seen_at: string;
    source: string;
  }>;
}

export default function GapsPage() {
  const [gaps, setGaps] = useState<DomainGap[]>([]);
  const [totalOpen, setTotalOpen] = useState(0);
  const [window, setWindow] = useState<WindowPreset>("7d");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/nex/observatory/snapshot?window=${window}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const dg: DomainGap[] = j?.domain_gaps ?? [];
      setGaps(dg.sort((a, b) => b.open_gap_count - a.open_gap_count));
      setTotalOpen(dg.reduce((s, d) => s + d.open_gap_count, 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, [window]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, letterSpacing: "-0.01em" }}>NEX Knowledge Gaps</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.65 }}>
            Where the Knowledge Factory should focus next · ranked by real customer demand.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12, opacity: 0.7 }}>Window</label>
          <select value={window} onChange={(e) => setWindow(e.target.value as WindowPreset)} style={selectStyle}>
            <option value="1h">1 h</option>
            <option value="24h">24 h</option>
            <option value="7d">7 d</option>
            <option value="30d">30 d</option>
          </select>
          <button onClick={() => void load()} style={buttonStyle} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </header>

      {error && (
        <div style={{ ...cardStyle, borderColor: "#b91c1c", background: "#fef2f2" }}>
          <strong>Load error:</strong> {error}
        </div>
      )}

      <section style={{ ...cardStyle, borderColor: totalOpen === 0 ? "#10b981" : "#f59e0b" }}>
        <div style={{ fontSize: 13, opacity: 0.7 }}>Total open gaps</div>
        <div style={bigNumberStyle}>{totalOpen.toLocaleString()}</div>
        <div style={{ fontSize: 12, opacity: 0.6 }}>
          Across {gaps.length} domain{gaps.length === 1 ? "" : "s"}. Higher `times_seen` = more customer demand
          for a fact NEX doesn't yet have.
        </div>
      </section>

      {gaps.length === 0 && !loading && !error && (
        <section style={{ ...cardStyle, borderColor: "#10b981", background: "#ecfdf5" }}>
          <strong>All clear</strong> · no open gaps in this window.
        </section>
      )}

      {gaps.map((d) => (
        <section key={d.domain} style={cardStyle}>
          <h2 style={sectionTitleStyle}>
            {d.domain}
            <span style={{ marginLeft: 10, opacity: 0.7, fontWeight: 400, fontSize: 13 }}>
              · {d.open_gap_count.toLocaleString()} open
              {typeof d.oldest_open_age_days === "number" ? ` · oldest ${d.oldest_open_age_days.toFixed(1)} d` : ""}
            </span>
          </h2>
          {d.top_gaps.length === 0 ? (
            <div style={{ opacity: 0.6, fontSize: 13, marginTop: 8 }}>No specific gap rows returned.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 8 }}>
              <thead>
                <tr style={{ textAlign: "left", opacity: 0.65 }}>
                  <th>Rank</th>
                  <th>Entity</th>
                  <th>Intent</th>
                  <th>Times seen</th>
                  <th>First seen</th>
                  <th>Last seen</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {d.top_gaps.map((g, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "6px 8px 6px 0" }}>{i + 1}</td>
                    <td>{g.entity_ref}</td>
                    <td>{g.intent_slug}</td>
                    <td style={{ fontWeight: 600 }}>{g.times_seen}</td>
                    <td style={{ opacity: 0.7 }}>{shortIso(g.first_seen_at)}</td>
                    <td style={{ opacity: 0.7 }}>{shortIso(g.last_seen_at)}</td>
                    <td style={{ opacity: 0.7 }}>{g.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}

      <footer style={{ marginTop: 24, fontSize: 11, opacity: 0.5 }}>
        data-gaps-page = "true" · read-only surface · numbers are direct reads from nex.knowledge_gap
      </footer>
    </div>
  );
}

function shortIso(iso: string): string {
  try { return new Date(iso).toISOString().slice(0, 16).replace("T", " "); }
  catch { return iso; }
}

const pageStyle: React.CSSProperties = {
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  padding: "20px 28px",
  maxWidth: 1200,
  margin: "0 auto",
  color: "#0f172a",
};
const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 16,
  paddingBottom: 12,
  borderBottom: "1px solid #e5e7eb",
};
const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 14,
  background: "#fff",
  marginTop: 12,
};
const sectionTitleStyle: React.CSSProperties = { margin: 0, fontSize: 14, fontWeight: 600, letterSpacing: "-0.005em" };
const bigNumberStyle: React.CSSProperties = { fontSize: 34, fontWeight: 700, marginTop: 6, marginBottom: 2 };
const buttonStyle: React.CSSProperties = {
  padding: "6px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#f8fafc",
  fontSize: 13, cursor: "pointer",
};
const selectStyle: React.CSSProperties = {
  padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", fontSize: 13,
};
