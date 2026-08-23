"use client";

// Task #87 (2026-08-22) · /food page dev inspector.
//
// Small collapsible panel gated behind ?admin=1 query param on the public
// /food directory. Shows:
//   · Businesses visible on this page (filtered by claim_status IN
//     listed/invited/claimed/paying · matches /food's own filter)
//   · Primary category breakdown of visible listings
//   · Universe totals splitting discovered-vs-listed-etc. (mirrors Task #86
//     Metric A vs Metric B split · never conflates Walker success with
//     public visibility)
//   · Top secondary tokens (Task #85 NEX-approved ontology)
//   · Last Walker cycle · zone + new_count + timestamp
//
// Doctrine anchors:
//   · project_nex_dashboard_singularity_constitutional_rule_2026_08_22
//     — This is NOT a dashboard. It's an inline dev inspector on the
//       public /food page · admin-gated · doesn't duplicate HQ Walker monitor.
//   · project_nex_walker_stays_pure_acquisition_2026_08_22
//     — Panel READS data · doesn't touch Walker · doesn't promote anything.
//   · project_nex_rag_reads_approved_knowledge_only_2026_08_22
//     — Panel honestly shows the promotion gap · doesn't hide it.
//
// Auto-refresh: only while panel expanded (30s cadence via router.refresh()).
// Doesn't hammer the DB when the panel is collapsed or admin isn't looking.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type DevInspectorData = {
  visibleTotal: number;
  visibleByCategory: Array<{ category: string; count: number }>;
  universeByStatus: Array<{ status: string; count: number }>;
  universeTotal: number;
  discoveredAwaitingPromotion: number;
  topSecondaryTokens: Array<{ token: string; count: number }>;
  lastCycle: {
    startedAt: string;
    zone: string;
    recordsNew: number;
  } | null;
};

const REFRESH_INTERVAL_MS = 30_000;

export default function DevInspector({ data }: { data: DevInspectorData }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [open, router]);

  return (
    <div style={wrapperStyle}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          ...pillStyle,
          background: open ? "#c2410c" : "#ea580c",
        }}
        aria-expanded={open}
      >
        🔧 DEV INSPECTOR · {data.visibleTotal.toLocaleString("en-GB")} businesses on page · {open ? "▲ collapse" : "▼ expand"}
      </button>

      {open && (
        <div style={panelStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* ── Left column · what's on THIS page ── */}
            <div>
              <div style={sectionLabelStyle}>Visible on this page · by category</div>
              <table style={tableStyle}>
                <tbody>
                  {data.visibleByCategory.map((r) => (
                    <tr key={r.category}>
                      <td style={tdKeyStyle}>{r.category}</td>
                      <td style={tdNumStyle}>{r.count.toLocaleString("en-GB")}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: "2px solid rgba(255,255,255,0.3)" }}>
                    <td style={{ ...tdKeyStyle, fontWeight: 800 }}>TOTAL VISIBLE</td>
                    <td style={{ ...tdNumStyle, fontWeight: 800 }}>{data.visibleTotal.toLocaleString("en-GB")}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ ...sectionLabelStyle, marginTop: 16 }}>Top secondary tokens (Task #85)</div>
              {data.topSecondaryTokens.length === 0 ? (
                <div style={emptyHintStyle}>No secondary tokens on visible rows yet · Walker discoveries populate categories[] as they land (currently in `discovered` status · not visible on this page).</div>
              ) : (
                <table style={tableStyle}>
                  <tbody>
                    {data.topSecondaryTokens.map((r) => (
                      <tr key={r.token}>
                        <td style={{ ...tdKeyStyle, fontFamily: "monospace", fontSize: 11 }}>{r.token}</td>
                        <td style={tdNumStyle}>{r.count.toLocaleString("en-GB")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Right column · UNIVERSE (Metric B honesty) ── */}
            <div>
              <div style={sectionLabelStyle}>Universe · all food_business rows · by claim_status</div>
              <table style={tableStyle}>
                <tbody>
                  {data.universeByStatus.map((r) => (
                    <tr key={r.status}>
                      <td style={tdKeyStyle}>
                        {r.status}
                        {r.status === "discovered" && (
                          <span style={badgeAmberStyle}>Walker · awaiting promotion</span>
                        )}
                        {["listed", "invited", "claimed", "paying"].includes(r.status) && (
                          <span style={badgeGreenStyle}>visible on /food</span>
                        )}
                      </td>
                      <td style={tdNumStyle}>{r.count.toLocaleString("en-GB")}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: "2px solid rgba(255,255,255,0.3)" }}>
                    <td style={{ ...tdKeyStyle, fontWeight: 800 }}>UNIVERSE TOTAL</td>
                    <td style={{ ...tdNumStyle, fontWeight: 800 }}>{data.universeTotal.toLocaleString("en-GB")}</td>
                  </tr>
                </tbody>
              </table>

              <div style={metricNoteStyle}>
                <strong>Metric A vs Metric B (Task #86 doctrine):</strong>
                <br />🟢 Walker did its job → row lands at <code>discovered</code>.
                <br />🟡 Public visibility → separate promotion pipeline (discovered → listed).
                <br /><strong>{data.discoveredAwaitingPromotion.toLocaleString("en-GB")}</strong> businesses currently awaiting promotion · Walker keeps discovering · promotion is a separate future pipeline.
              </div>

              {data.lastCycle && (
                <div style={{ ...sectionLabelStyle, marginTop: 16 }}>Last Walker cycle</div>
              )}
              {data.lastCycle && (
                <table style={tableStyle}>
                  <tbody>
                    <tr>
                      <td style={tdKeyStyle}>Zone</td>
                      <td style={tdNumStyle}>{data.lastCycle.zone}</td>
                    </tr>
                    <tr>
                      <td style={tdKeyStyle}>Records new</td>
                      <td style={{ ...tdNumStyle, color: data.lastCycle.recordsNew > 0 ? "#86efac" : "rgba(255,255,255,0.7)" }}>
                        {data.lastCycle.recordsNew.toLocaleString("en-GB")}
                      </td>
                    </tr>
                    <tr>
                      <td style={tdKeyStyle}>Started at</td>
                      <td style={{ ...tdNumStyle, fontFamily: "monospace", fontSize: 11 }}>
                        {new Date(data.lastCycle.startedAt).toLocaleString("en-GB", { hour12: false })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div style={footerHintStyle}>
            Auto-refreshes every 30s while open · reads live <code>nex.food_business</code> counts · no cache · matches HQ Walker Monitor at{" "}
            <a href="/nex-head-quarters/walker" style={{ color: "#fed7aa", textDecoration: "underline" }}>
              /nex-head-quarters/walker
            </a>
            . This inspector is admin-only (query param <code>?admin=1</code>) and does not affect the customer-facing directory.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles · dark orange "dev tape" theme (deliberately distinct from
//    cream customer UI so admin knows this is inspector, not product) ──

const wrapperStyle: React.CSSProperties = {
  margin: "12px auto",
  maxWidth: 1200,
  padding: "0 16px",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 16px",
  borderRadius: 999,
  border: "none",
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.5,
  cursor: "pointer",
  boxShadow: "0 2px 6px rgba(194, 65, 12, 0.35)",
};

const panelStyle: React.CSSProperties = {
  marginTop: 8,
  padding: "18px 20px",
  borderRadius: 12,
  background: "linear-gradient(180deg, #1c1917 0%, #292524 100%)",
  color: "#fed7aa",
  border: "1px solid #c2410c",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: "#fdba74",
  fontWeight: 700,
  marginBottom: 8,
  paddingBottom: 4,
  borderBottom: "1px solid rgba(253, 186, 116, 0.25)",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const tdKeyStyle: React.CSSProperties = {
  padding: "6px 8px 6px 0",
  color: "#fed7aa",
  borderTop: "1px solid rgba(253, 186, 116, 0.12)",
};

const tdNumStyle: React.CSSProperties = {
  padding: "6px 0 6px 8px",
  textAlign: "right",
  color: "#fff",
  fontVariantNumeric: "tabular-nums",
  fontWeight: 600,
  borderTop: "1px solid rgba(253, 186, 116, 0.12)",
};

const badgeAmberStyle: React.CSSProperties = {
  display: "inline-block",
  marginLeft: 8,
  padding: "1px 6px",
  fontSize: 9,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  fontWeight: 700,
  color: "#fbbf24",
  background: "rgba(251, 191, 36, 0.12)",
  border: "1px solid rgba(251, 191, 36, 0.35)",
  borderRadius: 4,
};

const badgeGreenStyle: React.CSSProperties = {
  display: "inline-block",
  marginLeft: 8,
  padding: "1px 6px",
  fontSize: 9,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  fontWeight: 700,
  color: "#86efac",
  background: "rgba(134, 239, 172, 0.10)",
  border: "1px solid rgba(134, 239, 172, 0.35)",
  borderRadius: 4,
};

const emptyHintStyle: React.CSSProperties = {
  fontSize: 11,
  color: "rgba(254, 215, 170, 0.65)",
  padding: "8px 4px",
  lineHeight: 1.5,
};

const metricNoteStyle: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 12px",
  fontSize: 11,
  lineHeight: 1.55,
  color: "rgba(254, 215, 170, 0.85)",
  background: "rgba(194, 65, 12, 0.15)",
  border: "1px dashed rgba(253, 186, 116, 0.35)",
  borderRadius: 6,
};

const footerHintStyle: React.CSSProperties = {
  marginTop: 14,
  paddingTop: 10,
  borderTop: "1px solid rgba(253, 186, 116, 0.15)",
  fontSize: 10,
  color: "rgba(254, 215, 170, 0.55)",
  lineHeight: 1.5,
};
