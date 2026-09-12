// src/app/nex/evidence/[ref_id]/page.tsx
//
// Founder Phase 6 · P6-4 · "Why did NEX say this?" detail page.
//
// Renders the full provenance chain for a single evidence ref_id.
// Anyone can visit and inspect any piece of evidence NEX has ever
// cited. This is one of NEX's biggest visible moats vs ChatGPT.

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, use } from "react";

interface Detail {
  ref_id: string;
  source_type: string;
  citation_summary: {
    times_cited: number;
    times_rejected: number;
    mean_alignment?: number | null;
    min_alignment?: number | null;
    max_alignment?: number | null;
    first_cited?: string | null;
    last_cited?: string | null;
    last_provider_model?: string | null;
  };
  rejection_breakdown: Array<{ reason: string; n: number }>;
  source: { text?: string | null; reference?: string | null };
}

export default function EvidenceDetailPage({ params }: { params: Promise<{ ref_id: string }> }) {
  const { ref_id } = use(params);
  const decoded = decodeURIComponent(ref_id);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/nex/evidence/${encodeURIComponent(decoded)}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setDetail(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, [decoded]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <Link href="/nex/evidence" style={{ color: "#1d4ed8", fontSize: 13, textDecoration: "none" }}>
            ← All evidence
          </Link>
          <h1 style={{ margin: "6px 0 0", fontSize: 22, letterSpacing: "-0.01em" }}>Why did NEX say this?</h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.65, fontFamily: "monospace" }}>{decoded}</p>
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

      {detail && (
        <>
          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Citation summary</h2>
            <dl style={dlStyle}>
              <dt>Source type</dt><dd>{detail.source_type}</dd>
              <dt>Times cited</dt><dd style={{ fontWeight: 600 }}>{detail.citation_summary.times_cited}</dd>
              <dt>Times rejected</dt><dd>{detail.citation_summary.times_rejected}</dd>
              <dt>Alignment min / p50 / p95 / max</dt>
              <dd>
                {(detail.citation_summary.min_alignment ?? 0).toFixed(3)} · —
                · —
                · {(detail.citation_summary.max_alignment ?? 0).toFixed(3)}
              </dd>
              <dt>Mean alignment</dt><dd>{detail.citation_summary.mean_alignment?.toFixed(3) ?? "—"}</dd>
              <dt>First cited</dt><dd>{detail.citation_summary.first_cited?.slice(0, 19).replace("T", " ") ?? "—"}</dd>
              <dt>Last cited</dt><dd>{detail.citation_summary.last_cited?.slice(0, 19).replace("T", " ") ?? "—"}</dd>
              <dt>Last provider model</dt><dd>{detail.citation_summary.last_provider_model ?? "—"}</dd>
            </dl>
          </section>

          {detail.source.text && (
            <section style={cardStyle}>
              <h2 style={sectionTitleStyle}>Underlying source</h2>
              <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>
                Reference: {detail.source.reference}
              </div>
              <div style={{
                border: "1px solid #f1f5f9",
                borderRadius: 6,
                padding: 10,
                background: "#f8fafc",
                fontSize: 13,
                whiteSpace: "pre-wrap",
              }}>
                {detail.source.text}
              </div>
            </section>
          )}

          {detail.rejection_breakdown.length > 0 && (
            <section style={cardStyle}>
              <h2 style={sectionTitleStyle}>Rejections</h2>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ textAlign: "left", opacity: 0.65 }}><th>Reason</th><th>Count</th></tr></thead>
                <tbody>
                  {detail.rejection_breakdown.map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "6px 8px 6px 0", fontFamily: "monospace", fontSize: 12 }}>{r.reason}</td>
                      <td>{r.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <footer style={{ marginTop: 24, fontSize: 11, opacity: 0.5 }}>
            data-evidence-detail = "true" · read-only surface · Doctrine #1 (Fabrication Gate v2)
          </footer>
        </>
      )}
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  padding: "20px 28px",
  maxWidth: 1000,
  margin: "0 auto",
  color: "#0f172a",
};
const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
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
const dlStyle: React.CSSProperties = { margin: "8px 0 0", fontSize: 13, display: "grid", gridTemplateColumns: "260px 1fr", rowGap: 6, columnGap: 8 };
const buttonStyle: React.CSSProperties = {
  padding: "6px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#f8fafc",
  fontSize: 13, cursor: "pointer",
};
