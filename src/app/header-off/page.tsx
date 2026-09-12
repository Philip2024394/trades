// src/app/header-off/page.tsx
//
// NEX Header-Off / Headquarters Agent Observatory (public view)
// Founder BEGIN 2026-09-08 · §17-22
//
// One container per approved agent. Real metrics. Real heartbeat. Real growth.
// Never fake activity. Never simulated growth. Never fabricated coverage.
//
// Discipline:
// - Green pulse ONLY when status === ACTIVE (heartbeat < 15s + real work)
// - Every metric labelled MEASURED / MODELED / ESTIMATED / UNKNOWN
// - Percentage bar shows REAL verified_knowledge_growth_pct
// - Denominator formula visible for auditability

import type { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "NEX Headquarters · Agent Observatory",
  description: "Real-time agent state · verified metrics · never simulated",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AgentSnapshot = {
  domain_agent_id: string;
  display_name: string;
  status: "ACTIVE" | "DEGRADED" | "FAILED" | "STOPPED" | "RESEARCHING";
  status_reason: string;
  last_heartbeat_at_iso: string | null;
  pid: number | null;
  growth: {
    entities_total: number;
    entities_verified: number;
    entities_added_today: number;
    entities_updated_today: number;
    countries_covered: number;
    cities_covered: number;
    knowledge_gaps_open: number;
    verified_knowledge_growth_pct: number;
    verified_knowledge_growth_denominator_note: string;
    evidence_label: string;
  };
  storage: {
    bytes_total: number;
    object_count: number;
    average_object_size_bytes: number;
    evidence_label: string;
  };
  category_breakdown: Record<string, number>;
  research_metrics: {
    active_tasks: number;
    unresolved_gaps: number;
  };
  quality: { verified_percentage: number };
  evidence_label: string;
};

function statusColor(status: AgentSnapshot["status"]): string {
  return ({
    ACTIVE: "#10B981",
    RESEARCHING: "#3B82F6",
    DEGRADED: "#F59E0B",
    FAILED: "#EF4444",
    STOPPED: "#9CA3AF",
  })[status];
}
function statusEmoji(status: AgentSnapshot["status"]): string {
  return ({
    ACTIVE: "🟢",
    RESEARCHING: "🔵",
    DEGRADED: "🟡",
    FAILED: "🔴",
    STOPPED: "⚪",
  })[status];
}

async function loadState(): Promise<AgentSnapshot[]> {
  // Server-side fetch to our own API
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const url = `${proto}://${host}/api/nex/observatory/state`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`observatory API ${res.status}`);
    const j = await res.json();
    return j.agents as AgentSnapshot[];
  } catch {
    return [];
  }
}

export default async function HeaderOffPage(): Promise<React.ReactElement> {
  const agents = await loadState();

  return (
    <main style={{
      minHeight: "100vh",
      background: "#0A0A0B",
      color: "#E5E7EB",
      padding: "32px 24px",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    }}>
      <header style={{ maxWidth: 1400, margin: "0 auto 32px" }}>
        <h1 style={{ fontSize: 32, margin: 0, letterSpacing: -0.5, fontWeight: 700 }}>
          NEX Headquarters
        </h1>
        <p style={{ color: "#9CA3AF", marginTop: 8, marginBottom: 4, fontSize: 14 }}>
          Agent Observatory · every metric MEASURED / DOCUMENTED / MODELED / ESTIMATED / UNKNOWN · Op-Truth §OP.5
        </p>
        <p style={{ color: "#6B7280", fontSize: 12 }}>
          {agents.length} approved agents · collected at {new Date().toISOString()}
        </p>
      </header>

      <style>{`
        @keyframes nex-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          50% { opacity: 0.85; box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
        }
        .nex-active-pulse { animation: nex-pulse 2s ease-in-out infinite; }
      `}</style>

      <div style={{
        maxWidth: 1400,
        margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
        gap: 16,
      }}>
        {agents.length === 0 && (
          <div style={{ padding: 16, background: "#111827", borderRadius: 8, color: "#9CA3AF" }}>
            No agents reported. Ensure API endpoint /api/nex/observatory/state is reachable.
          </div>
        )}
        {agents.map((a) => {
          const color = statusColor(a.status);
          const emoji = statusEmoji(a.status);
          const growthPct = Math.min(100, Math.max(0, a.growth.verified_knowledge_growth_pct));

          return (
            <article key={a.domain_agent_id} style={{
              background: "#111827",
              border: `1px solid ${a.status === "ACTIVE" ? "#065F46" : "#1F2937"}`,
              borderRadius: 12,
              padding: 20,
              position: "relative",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span
                  className={a.status === "ACTIVE" ? "nex-active-pulse" : ""}
                  style={{
                    width: 12, height: 12, borderRadius: "50%",
                    background: color,
                    display: "inline-block",
                  }}
                  aria-label={a.status}
                />
                <strong style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: color }}>
                  {emoji} {a.status}
                </strong>
              </div>
              <h2 style={{ fontSize: 15, margin: "4px 0 8px", fontWeight: 600 }}>
                {a.display_name}
              </h2>
              <p style={{ fontSize: 11, color: "#6B7280", margin: "0 0 12px", minHeight: 26 }}>
                {a.status_reason}
              </p>

              {/* Growth bar · REAL number */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                  <span>Verified Knowledge Growth</span>
                  <span title={a.growth.verified_knowledge_growth_denominator_note}>
                    {growthPct.toFixed(1)}% · {a.growth.evidence_label}
                  </span>
                </div>
                <div style={{ height: 8, background: "#1F2937", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    width: `${growthPct}%`,
                    height: "100%",
                    background: growthPct >= 60 ? "#10B981" : growthPct >= 30 ? "#F59E0B" : "#EF4444",
                    transition: "width 0.4s ease",
                  }} />
                </div>
              </div>

              {/* Metrics grid · REAL numbers */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                <MetricRow label="Entities total" value={a.growth.entities_total.toLocaleString()} />
                <MetricRow label="Verified" value={a.growth.entities_verified.toLocaleString()} />
                <MetricRow label="Countries" value={String(a.growth.countries_covered)} />
                <MetricRow label="Cities" value={String(a.growth.cities_covered)} />
                <MetricRow label="Added today" value={a.growth.entities_added_today.toLocaleString()} />
                <MetricRow label="Updated today" value={a.growth.entities_updated_today.toLocaleString()} />
                <MetricRow label="Gaps open" value={a.growth.knowledge_gaps_open.toLocaleString()} muted={a.growth.evidence_label !== "MEASURED"} />
                <MetricRow label="Storage MB" value={(a.storage.bytes_total / 1024 / 1024).toFixed(1)} />
              </div>

              {/* Category breakdown · top 4 */}
              {Object.keys(a.category_breakdown).length > 0 && (
                <div style={{ marginTop: 12, fontSize: 11, color: "#9CA3AF" }}>
                  {Object.entries(a.category_breakdown).slice(0, 4).map(([cat, n]) => (
                    <span key={cat} style={{
                      background: "#1F2937",
                      padding: "2px 8px",
                      marginRight: 4,
                      borderRadius: 8,
                      display: "inline-block",
                      marginTop: 4,
                    }}>{cat}: {n}</span>
                  ))}
                </div>
              )}

              {/* Footer · heartbeat + pid */}
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #1F2937", fontSize: 10, color: "#6B7280" }}>
                heartbeat: {a.last_heartbeat_at_iso ? new Date(a.last_heartbeat_at_iso).toISOString() : "—"}
                {a.pid !== null && ` · pid ${a.pid}`}
              </div>
            </article>
          );
        })}
      </div>

      <footer style={{ maxWidth: 1400, margin: "32px auto 0", fontSize: 11, color: "#4B5563" }}>
        <p style={{ marginBottom: 4 }}>
          NEX Master AI Engineer · Intelligence Storage Grid · Header-Off Observatory · Founder BEGIN AUTHORIZED
        </p>
        <p>
          Discipline: real heartbeat · real metrics · never fabricated · never simulated · Op-Truth §OP.5
        </p>
      </footer>
    </main>
  );
}

function MetricRow(props: { label: string; value: string; muted?: boolean }): React.ReactElement {
  return (
    <div style={{
      background: "#0F172A",
      padding: "6px 10px",
      borderRadius: 6,
      opacity: props.muted ? 0.5 : 1,
    }}>
      <div style={{ color: "#6B7280", fontSize: 10 }}>{props.label}</div>
      <div style={{ color: "#F3F4F6", fontWeight: 600 }}>{props.value}</div>
    </div>
  );
}
