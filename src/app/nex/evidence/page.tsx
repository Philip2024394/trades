// src/app/nex/evidence/page.tsx
//
// Founder Phase 6 · P6-3 · Public evidence catalog page.
//
// Anyone can visit /nex/evidence and see what NEX cites, how often,
// and with what alignment quality. Every ref_id links to its own
// "Why did NEX say this?" detail page.
//
// This is one of NEX's biggest visible moats vs ChatGPT. Zero
// fabrication · numbers are direct reads from nex.gate_kept_event.

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface SourceRow {
  ref_id: string;
  source_type: string;
  provider_model?: string | null;
  times_cited: number;
  mean_alignment?: number | null;
  min_alignment?: number | null;
  max_alignment?: number | null;
  first_cited?: string | null;
  last_cited?: string | null;
}

export default function EvidenceCatalogPage() {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/nex/evidence/list?limit=200`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setSources(j?.sources ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = filter
    ? sources.filter((s) => s.ref_id.includes(filter) || s.source_type.includes(filter))
    : sources;

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, letterSpacing: "-0.01em" }}>NEX Evidence Catalog</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.65 }}>
            Every source NEX has successfully cited. Click any ref_id to see the full provenance chain.
            Zero fabrication · numbers are direct reads from nex.gate_kept_event.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="Filter…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={inputStyle}
          />
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

      <section style={cardStyle}>
        <div style={{ fontSize: 13, opacity: 0.7 }}>Total sources</div>
        <div style={bigNumberStyle}>{sources.length.toLocaleString()}</div>
        <div style={{ fontSize: 12, opacity: 0.6 }}>
          Sources that have survived Fabrication Gate v2 at least once. Higher `times_cited` = more customer demand.
        </div>
      </section>

      <section style={cardStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", opacity: 0.65 }}>
              <th>Type</th>
              <th>ref_id</th>
              <th>Cites</th>
              <th>Mean align</th>
              <th>First cited</th>
              <th>Last cited</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((s, i) => (
              <tr key={s.ref_id + i} style={{ borderTop: "1px solid #f1f5f9" }}>
                <td style={{ padding: "6px 8px 6px 0", opacity: 0.75 }}>{s.source_type}</td>
                <td>
                  <Link href={`/nex/evidence/${encodeURIComponent(s.ref_id)}`} style={linkStyle}>
                    {s.ref_id.slice(0, 60)}{s.ref_id.length > 60 ? "…" : ""}
                  </Link>
                </td>
                <td style={{ fontWeight: 600 }}>{s.times_cited}</td>
                <td>{s.mean_alignment != null ? s.mean_alignment.toFixed(3) : "—"}</td>
                <td style={{ opacity: 0.7 }}>{s.first_cited?.slice(0, 16).replace("T", " ") ?? "—"}</td>
                <td style={{ opacity: 0.7 }}>{s.last_cited?.slice(0, 16).replace("T", " ") ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer style={{ marginTop: 24, fontSize: 11, opacity: 0.5 }}>
        data-evidence-catalog = "true" · read-only surface · Doctrine #1 (Fabrication Gate v2)
      </footer>
    </div>
  );
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
  gap: 12,
};
const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 14,
  background: "#fff",
  marginTop: 12,
};
const bigNumberStyle: React.CSSProperties = { fontSize: 34, fontWeight: 700, marginTop: 6, marginBottom: 2 };
const buttonStyle: React.CSSProperties = {
  padding: "6px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#f8fafc",
  fontSize: 13, cursor: "pointer",
};
const inputStyle: React.CSSProperties = {
  padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", fontSize: 13,
  minWidth: 220,
};
const linkStyle: React.CSSProperties = { color: "#1d4ed8", textDecoration: "none", fontFamily: "monospace", fontSize: 12 };
