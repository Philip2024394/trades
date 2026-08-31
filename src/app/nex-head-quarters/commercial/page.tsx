// NEX HQ · Commercial Funnel · Philip 2026-08-27.
//
// /nex-head-quarters/commercial
//
// Read-only page. Shows funnel counts per commercial_status across all
// service_business rows. The Marketing Workforce is NOT BUILT — this page
// exists to inspect what the qualification engine has produced so we can
// decide when/how to design the workforce.
//
// No outreach action buttons. No contact triggers. No editing.

import Link from "next/link";
import {
  loadCommercialSnapshot,
  COMMERCIAL_STATE_ORDER,
  QUALIFICATION_STATES,
  MARKETING_STATES,
  type CommercialState,
} from "@/lib/nex-hq/commercial-funnel";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "NEX HQ · Commercial", robots: { index: false } };

const STATE_LABEL: Record<CommercialState, string> = {
  discovered:       "Discovered",
  qualified:        "Qualified",
  contactable:      "Contactable",
  marketing_ready:  "Marketing-ready",
  attempted:        "Attempted",
  engaged:          "Engaged",
  invited:          "Invited",
  trial:            "Trial",
  paid:             "Paid",
  declined:         "Declined",
};

// Colour band per state family · qualification=blue-scale, marketing=amber-scale, paid=green, declined=grey.
const STATE_COLOR: Record<CommercialState, string> = {
  discovered:       "#94a3b8",   // slate-400
  qualified:        "#60a5fa",   // blue-400
  contactable:      "#3b82f6",   // blue-500
  marketing_ready:  "#1d4ed8",   // blue-700
  attempted:        "#f59e0b",   // amber-500
  engaged:          "#ea580c",   // orange-600
  invited:          "#d97706",   // amber-600
  trial:            "#c2410c",   // orange-700
  paid:             "#15803d",   // emerald-700
  declined:         "#78716c",   // stone-500
};

function fmt(n: number): string { return n.toLocaleString("en-GB"); }

export default async function CommercialPage() {
  const s = await loadCommercialSnapshot();

  const qualificationTotal = QUALIFICATION_STATES.reduce(
    (a, st) => a + (s.overall.find((b) => b.state === st)?.count ?? 0),
    0,
  );
  const marketingTotal = MARKETING_STATES.reduce(
    (a, st) => a + (s.overall.find((b) => b.state === st)?.count ?? 0),
    0,
  );

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", background: "var(--nex-cream-50, #faf8f3)", minHeight: "100vh" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: 1.2, color: "var(--nex-stone-500, #78716c)", textTransform: "uppercase" }}>
          NEX HQ · Commercial Funnel
        </div>
        <h1 style={{ fontSize: 28, margin: "4px 0 4px 0", color: "var(--nex-ink-900, #1c1917)" }}>
          Commercial Funnel · nex.service_business
        </h1>
        <div style={{ fontSize: 13, color: "var(--nex-stone-600, #57534e)", maxWidth: 820 }}>
          Every discovered business becomes a commercial prospect. The qualification engine promotes
          rows through <b>discovered → qualified → contactable → marketing_ready</b> based on public
          data quality (name · website · phone · WhatsApp · hero image). Marketing states beyond
          marketing_ready are reserved for the Marketing Workforce (not yet built · no outreach is
          happening).
        </div>
      </div>

      {/* Loud gate banner · this page never contacts anyone */}
      <div style={{
        background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6,
        padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#78350f",
      }}>
        <b>MARKETING WORKFORCE NOT ACTIVE.</b>{" "}
        Funnel counts show ELIGIBILITY only. NEX is not contacting any business.
        Design of the marketing workforce is a separate approval gate.
      </div>

      {/* Headline · qualification vs marketing splits */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        <BigStat label="Total businesses"    value={s.totalRows} color="var(--nex-ink-900, #1c1917)" />
        <BigStat label="In qualification"    value={qualificationTotal} color="#1d4ed8" />
        <BigStat label="In marketing"        value={marketingTotal} color="#d97706" />
        <BigStat label="Last qualification run" value={s.lastQualificationRunAt ? relTime(s.lastQualificationRunAt) : "never"} color="var(--nex-stone-600, #57534e)" isText />
      </div>

      {/* Overall funnel · big bars */}
      <section style={{ background: "#fff", border: "1px solid var(--nex-stone-200, #e7e5e4)", borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--nex-stone-600, #57534e)", marginBottom: 12 }}>
          Overall funnel · all service categories
        </div>
        <FunnelRow buckets={s.overall} maxCount={s.totalRows} />
      </section>

      {/* Per-category funnels */}
      <section style={{ background: "#fff", border: "1px solid var(--nex-stone-200, #e7e5e4)", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--nex-stone-200, #e7e5e4)", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--nex-stone-600, #57534e)" }}>
          Per-category funnel · nex.service_business grouped by category_slug
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--nex-stone-100, #f5f5f4)" }}>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Total</th>
              {COMMERCIAL_STATE_ORDER.map((s) => (
                <th key={s} style={thStyle}>{STATE_LABEL[s]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.byCategory.map((c) => (
              <tr key={c.category_slug} style={{ borderTop: "1px solid var(--nex-stone-200, #e7e5e4)" }}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>
                  <Link href={{ pathname: "/nex-head-quarters/directory", query: { cat: `services-${c.category_slug}` } }}
                        style={{ color: "var(--nex-ink-800, #292524)", textDecoration: "underline dotted" }}>
                    {c.category_slug}
                  </Link>
                </td>
                <td style={{ ...tdStyle, fontFamily: "monospace" }}>{fmt(c.total)}</td>
                {c.buckets.map((b) => (
                  <td key={b.state} style={{
                    ...tdStyle,
                    fontFamily: "monospace",
                    color: b.count > 0 ? STATE_COLOR[b.state] : "var(--nex-stone-400, #a8a29e)",
                    fontWeight: b.count > 0 ? 600 : 400,
                  }}>
                    {b.count > 0 ? fmt(b.count) : "·"}
                  </td>
                ))}
              </tr>
            ))}
            {s.byCategory.length === 0 && (
              <tr>
                <td colSpan={2 + COMMERCIAL_STATE_ORDER.length} style={{ ...tdStyle, textAlign: "center", color: "var(--nex-stone-500, #78716c)" }}>
                  No service_business rows yet · run qualification after the walker persists rows.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <div style={{ marginTop: 16, fontSize: 12, color: "var(--nex-stone-500, #78716c)" }}>
        Data source: <code>nex.service_business</code>. Qualification job:{" "}
        <code>node scripts/nex-commercial/run-qualification.mjs</code>.
        No scheduler entry yet · run manually until you approve a cron cadence.
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function relTime(d: Date): string {
  const ms = Date.now() - new Date(d).getTime();
  if (ms < 60_000)     return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3_600_000)  return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return `${Math.round(ms / 86_400_000)}d ago`;
}

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 10,
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "var(--nex-stone-600, #57534e)",
  fontWeight: 600,
  whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  verticalAlign: "top",
  color: "var(--nex-ink-800, #292524)",
};

function BigStat({ label, value, color, isText = false }: { label: string; value: number | string; color: string; isText?: boolean }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid var(--nex-stone-200, #e7e5e4)",
      borderRadius: 6,
      padding: "10px 14px",
    }}>
      <div style={{ fontSize: 10, color: "var(--nex-stone-500, #78716c)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: isText ? 16 : 26, fontWeight: 700, color, fontFamily: isText ? undefined : "monospace" }}>
        {typeof value === "number" ? fmt(value) : value}
      </div>
    </div>
  );
}

function FunnelRow({ buckets, maxCount }: { buckets: { state: CommercialState; count: number }[]; maxCount: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 6 }}>
      {buckets.map((b) => {
        const pct = maxCount > 0 ? (b.count / maxCount) * 100 : 0;
        return (
          <div key={b.state} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{
              height: 60,
              background: "var(--nex-stone-100, #f5f5f4)",
              borderRadius: 4,
              position: "relative",
              overflow: "hidden",
            }}>
              <div style={{
                position: "absolute",
                bottom: 0, left: 0, right: 0,
                height: `${Math.max(3, pct)}%`,
                background: b.count > 0 ? STATE_COLOR[b.state] : "transparent",
                opacity: b.count > 0 ? 0.85 : 0.2,
              }} />
              <div style={{
                position: "absolute", top: 4, left: 0, right: 0, textAlign: "center",
                fontSize: 14, fontWeight: 700, color: b.count > 0 ? "#0a0a0a" : "var(--nex-stone-400, #a8a29e)",
                fontFamily: "monospace",
              }}>
                {fmt(b.count)}
              </div>
            </div>
            <div style={{ fontSize: 10, color: STATE_COLOR[b.state], fontWeight: 600, textAlign: "center", letterSpacing: 0.2 }}>
              {STATE_LABEL[b.state]}
            </div>
          </div>
        );
      })}
    </div>
  );
}
