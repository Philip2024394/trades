// NEX HQ · Image Intake
//
// /nex-head-quarters/image-intake · dump up to 200 image URLs per batch ·
// worker processes each independently · results land in nex.knowledge_inbox
// at status='review' awaiting admin promotion.
//
// Doctrine anchors:
//   · project_nex_owns_intelligence_capabilities_2026_08_22 (NEX-owned interface)
//   · project_nex_visual_intelligence_architecture_2026_08_22 (14-layer target)
//   · Image ingestion ≠ blind Brain teaching (Observe ≠ Teach)
//
// Vision is stubbed today (Task #69 blocked behind Business #1). Description +
// content-hash carry the extraction. Uploading images with no description will
// classify as LOW/UNREADABLE — honest until real vision plugs in.

import { getFoodDbPool } from "@/lib/nex-food/db";
import { ImageIntakeFormCream } from "./ImageIntakeFormCream";
import "../../nex-app/nex-app.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RecentRow {
  id: string;
  title: string;
  status: string;
  hash: string;
  url: string | null;
  created_at_iso: Date;
  description: string | null;
  extraction_result: {
    concept?: string;
    category?: string | null;
    classification_band?: string;
    confidence?: number;
    ai_generated?: boolean;
  } | null;
}

async function loadRecent() {
  const pool = getFoodDbPool();
  const r = await pool.query<RecentRow>(`
    SELECT id, title, status, hash, url, created_at_iso, description, extraction_result
    FROM nex.knowledge_inbox
    WHERE kind = 'image'
    ORDER BY created_at_iso DESC
    LIMIT 50
  `);
  const bandCounts: Record<string, number> = {};
  for (const row of r.rows) {
    const b = row.extraction_result?.classification_band ?? "UNKNOWN";
    bandCounts[b] = (bandCounts[b] ?? 0) + 1;
  }
  return { rows: r.rows, bandCounts, total: r.rowCount };
}

export default async function ImageIntakePage() {
  const d = await loadRecent();
  return (
    <div style={pageStyle}>
      <div style={titleBlockStyle}>
        <div style={eyebrowStyle}>NEX HQ · IMAGE INTAKE · PLUGGABLE VISION</div>
        <h1 style={h1Style}>Image Intake</h1>
        <div style={subtitleStyle}>
          Dump up to 200 image URLs at a time · optional description per URL ·
          NEX processes each independently · one failed image never stops the batch.
          Results land at <code>knowledge_inbox.status=&apos;review&apos;</code> awaiting
          admin promotion · never auto-teaches Brain.
        </div>
      </div>

      <div style={honestNoticeStyle}>
        <strong style={{ color: "var(--nex-accent-700)" }}>HONEST STATUS:</strong>{" "}
        vision adapter is stubbed today (Task #69 blocked behind Business #1). Descriptions
        carry the extraction. Images uploaded WITHOUT description will classify as
        LOW/UNREADABLE — that&apos;s correct behaviour until real NEX-owned visual
        perception plugs in behind the existing <code>NexVisionService</code> interface.
      </div>

      {/* The form · client component */}
      <div style={sectionLabelStyle}>Submit batch</div>
      <ImageIntakeFormCream />

      {/* Recent intake · read from knowledge_inbox */}
      <div style={sectionLabelStyle}>Recent intake · last 50</div>
      {d.rows.length === 0 ? (
        <div style={mutedStyle}>No image intake yet. Paste URLs above and press Process.</div>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            {Object.entries(d.bandCounts).map(([band, n]) => (
              <div key={band} style={bandPillStyle(band)}>{band}: <strong>{n}</strong></div>
            ))}
          </div>
          <div style={panelStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>When</th>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Concept</th>
                  <th style={thStyle}>Band</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>URL</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ ...tdStyle, fontSize: 11, whiteSpace: "nowrap" }}>{new Date(row.created_at_iso).toLocaleString("en-GB")}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{row.title}</td>
                    <td style={tdStyle}>
                      {row.extraction_result?.concept ?? "—"}
                      {row.extraction_result?.category && <span style={{ fontSize: 10, color: "var(--nex-neutral-500)" }}> · {row.extraction_result.category}</span>}
                    </td>
                    <td><span style={bandPillStyle(row.extraction_result?.classification_band ?? "UNKNOWN")}>{row.extraction_result?.classification_band ?? "—"}</span></td>
                    <td style={{ ...tdStyle, fontSize: 11 }}>{row.status}</td>
                    <td style={{ ...tdStyle, fontSize: 10 }}>
                      {row.url ? (
                        <a href={row.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--nex-accent-600)" }}>
                          {row.url.replace(/^https?:\/\//, "").slice(0, 40)}
                        </a>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const pageStyle: React.CSSProperties = { padding: "24px 32px 60px" };
const titleBlockStyle: React.CSSProperties = { marginBottom: 20 };
const eyebrowStyle: React.CSSProperties = { fontSize: 10, letterSpacing: 3, color: "var(--nex-accent-600)", fontWeight: 700, marginBottom: 8 };
const h1Style: React.CSSProperties = { fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: -0.4, color: "var(--nex-neutral-900)" };
const subtitleStyle: React.CSSProperties = { fontSize: 13, color: "var(--nex-neutral-700)", marginTop: 6, maxWidth: 780 };
const honestNoticeStyle: React.CSSProperties = { padding: "12px 14px", borderRadius: 10, background: "rgba(249, 115, 22, 0.06)", border: "1px solid rgba(249, 115, 22, 0.25)", fontSize: 12, color: "var(--nex-neutral-800)", lineHeight: 1.55, marginBottom: 16 };
const sectionLabelStyle: React.CSSProperties = { fontSize: 11, letterSpacing: 2, color: "var(--nex-accent-600)", fontWeight: 700, textTransform: "uppercase", marginTop: 24, marginBottom: 12 };
const panelStyle: React.CSSProperties = { background: "var(--nex-neutral-0)", border: "1px solid var(--nex-neutral-200)", borderRadius: 12, padding: "12px 16px", overflowX: "auto" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const thStyle: React.CSSProperties = { color: "var(--nex-neutral-500)", padding: "8px 8px 8px 0", textAlign: "left", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, borderBottom: "1px solid var(--nex-neutral-200)" };
const tdStyle: React.CSSProperties = { color: "var(--nex-neutral-900)", padding: "10px 8px 10px 0", verticalAlign: "top", borderTop: "1px solid var(--nex-neutral-100)" };
const mutedStyle: React.CSSProperties = { color: "var(--nex-neutral-500)", fontSize: 13, padding: "16px", textAlign: "center", background: "var(--nex-neutral-0)", border: "1px dashed var(--nex-neutral-200)", borderRadius: 12 };

function bandPillStyle(band: string): React.CSSProperties {
  const map: Record<string, { bg: string; text: string }> = {
    HIGH:       { bg: "rgba(16, 185, 129, 0.12)", text: "#047857" },
    MEDIUM:     { bg: "rgba(250, 204, 21, 0.15)", text: "#a16207" },
    LOW:        { bg: "var(--nex-neutral-100)",   text: "var(--nex-neutral-500)" },
    DUPLICATE:  { bg: "rgba(59, 130, 246, 0.12)", text: "#1d4ed8" },
    UNREADABLE: { bg: "rgba(239, 68, 68, 0.10)",  text: "#b91c1c" },
    REVIEW:     { bg: "rgba(249, 115, 22, 0.12)", text: "#c2410c" },
    UNKNOWN:    { bg: "var(--nex-neutral-100)",   text: "var(--nex-neutral-500)" },
  };
  const s = map[band] ?? map.UNKNOWN;
  return { display: "inline-block", padding: "3px 10px", borderRadius: 999, background: s.bg, color: s.text, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3 };
}
