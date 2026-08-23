// NEX HQ · Reception Reality Strip · Task #72 Step 4 (2026-08-22)
//
// One-glance operational summary at the top of /nex-head-quarters.
// Renders System × Status × Reality × Last checked · every row is a link
// to the canonical Workers evidence view (per-worker six-criteria).
//
// Data source: evaluateAllSystems from src/lib/nex/hq/system-aggregator.ts ·
// which itself uses the shipped evaluateWorker from Step 3. No duplicate
// verdict logic anywhere in this file · the strip is a rendering-only
// window into the existing truth.

import Link from "next/link";
import { getFoodDbPool } from "@/lib/nex-food/db";
import { evaluateAllSystems } from "@/lib/nex/hq/system-aggregator";
import type { SixCriteriaVerdict } from "@/lib/nex/hq/worker-criteria";

const VERDICT_STYLE: Record<SixCriteriaVerdict, { glyph: string; bg: string; text: string; border: string; label: string }> = {
  GREEN:       { glyph: "🟢", bg: "rgba(16, 185, 129, 0.10)", text: "#047857", border: "rgba(16, 185, 129, 0.45)", label: "GREEN" },
  PARTIAL:     { glyph: "🟡", bg: "rgba(250, 204, 21, 0.12)", text: "#a16207", border: "rgba(250, 204, 21, 0.45)", label: "PARTIAL" },
  FAILED:      { glyph: "🔴", bg: "rgba(239, 68, 68, 0.10)",  text: "#b91c1c", border: "rgba(239, 68, 68, 0.45)", label: "FAILED" },
  STUCK:       { glyph: "🔵", bg: "rgba(59, 130, 246, 0.10)", text: "#1e40af", border: "rgba(59, 130, 246, 0.45)", label: "STUCK" },
  STANDBY:     { glyph: "💤", bg: "var(--nex-neutral-100)",   text: "var(--nex-neutral-600)", border: "var(--nex-neutral-300)", label: "STANDBY" },
  NOT_RUNNING: { glyph: "⚪", bg: "var(--nex-neutral-100)",   text: "var(--nex-neutral-600)", border: "var(--nex-neutral-300)", label: "NOT RUNNING" },
  BLOCKED:     { glyph: "⛔", bg: "rgba(107, 114, 128, 0.08)", text: "var(--nex-neutral-700)", border: "var(--nex-neutral-400)", label: "BLOCKED" },
  UNKNOWN:     { glyph: "❓", bg: "var(--nex-neutral-100)", text: "var(--nex-neutral-500)", border: "var(--nex-neutral-200)", label: "UNKNOWN" },
};

function fmtAge(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

export default async function RealityStrip() {
  const pool = getFoodDbPool();
  const systems = await evaluateAllSystems(pool);

  return (
    <section aria-label="Reception Reality Strip" style={wrapperStyle}>
      <header style={headerStyle}>
        <div style={eyebrowStyle}>NEX HQ · RECEPTION · REALITY</div>
        <div style={subEyebrowStyle}>
          How is NEX doing? System-level operational overview · every status derived from live
          database evidence · click any system to drill into per-worker evidence.
        </div>
      </header>

      <div style={tableWrapperStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>System</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Reality</th>
              <th style={thStyle}>Last checked</th>
            </tr>
          </thead>
          <tbody>
            {systems.map((s) => {
              const style = VERDICT_STYLE[s.verdict];
              return (
                <tr key={s.system.key}>
                  <td style={tdStyle}>
                    <Link href="/nex-head-quarters/workers" style={linkStyle}>
                      <div style={{ fontWeight: 700, color: "var(--nex-neutral-900)" }}>{s.system.displayName}</div>
                      <div style={{ fontSize: 11, color: "var(--nex-neutral-500)", marginTop: 2 }}>{s.system.description}</div>
                    </Link>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "3px 10px", borderRadius: 999,
                      background: style.bg, color: style.text,
                      border: `1px solid ${style.border}`,
                      fontSize: 11, fontWeight: 700,
                    }}>
                      {style.glyph} {style.label}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: "var(--nex-neutral-700)" }}>
                    {s.reality}
                    {s.worker_ids.length > 0 && (
                      <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--nex-neutral-500)", marginTop: 2 }}>
                        {s.worker_ids.join(" · ")}
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11, color: "var(--nex-neutral-500)", whiteSpace: "nowrap" }}>
                    {fmtAge(s.evaluated_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={hintStyle}>
        GREEN requires all six criteria proven per system worker · precedence rule: any FAILED → FAILED · any STUCK → STUCK ·
        any PARTIAL → PARTIAL · mixed terminals → PARTIAL · all GREEN → GREEN. Nothing here is derived from page existence,
        code existence, or heartbeat freshness alone.
      </div>
    </section>
  );
}

// ── Styles · cream theme ──────────────────────────────────────────────

const wrapperStyle: React.CSSProperties = {
  padding: "20px 24px",
  background: "var(--nex-cream-elev, var(--nex-neutral-0))",
  borderBottom: "1px solid var(--nex-neutral-200)",
  marginBottom: 24,
};
const headerStyle: React.CSSProperties = { marginBottom: 14 };
const eyebrowStyle: React.CSSProperties = { fontSize: 10, letterSpacing: 3, color: "var(--nex-accent-600)", fontWeight: 700, marginBottom: 4 };
const subEyebrowStyle: React.CSSProperties = { fontSize: 12, color: "var(--nex-neutral-700)", lineHeight: 1.4, maxWidth: 820 };
const tableWrapperStyle: React.CSSProperties = { background: "var(--nex-neutral-0)", border: "1px solid var(--nex-neutral-200)", borderRadius: 12, padding: "10px 14px", overflowX: "auto" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const thStyle: React.CSSProperties = { color: "var(--nex-neutral-500)", padding: "8px 8px 8px 0", textAlign: "left", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, borderBottom: "1px solid var(--nex-neutral-200)" };
const tdStyle: React.CSSProperties = { color: "var(--nex-neutral-900)", padding: "10px 8px 10px 0", verticalAlign: "top", borderTop: "1px solid var(--nex-neutral-100)" };
const linkStyle: React.CSSProperties = { textDecoration: "none", display: "block" };
const hintStyle: React.CSSProperties = { marginTop: 10, fontSize: 11, color: "var(--nex-neutral-500)", fontStyle: "italic", lineHeight: 1.5 };
