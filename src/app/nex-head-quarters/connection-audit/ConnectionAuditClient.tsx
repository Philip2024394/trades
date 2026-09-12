"use client";

import { useEffect, useState } from "react";

interface Row {
  capabilityId: string;
  capabilityTitle: string;
  slots: Record<string, "connected" | "not_connected" | "not_applicable">;
  connected_count: number;
  not_connected_count: number;
  not_applicable_count: number;
}

interface AuditResponse {
  ok: boolean;
  summary: { total: number; fully_connected: number; has_gaps: number };
  rows: Row[];
}

const SLOT_LABELS: Record<string, string> = {
  nex_brain: "Brain",
  truth_engine: "TE",
  guardian: "Guard",
  master_ai: "M-AI",
  nex1: "NEX1",
  security_agent: "Sec",
  lab: "Lab",
  storage: "Store",
  apis: "API",
  auth: "Auth",
  events: "Evt",
  registries: "Reg",
  audit_logging: "Log",
  assets: "Ast",
  ui_dna: "DNA",
  tests: "Test",
  preview: "Prv",
  github: "GH",
  versioning: "Ver",
  rollback: "RB",
  intervention: "Int",
  build_snapshots: "Snap",
};

export function ConnectionAuditClient() {
  const [data, setData] = useState<AuditResponse | null>(null);

  useEffect(() => {
    const load = async () => {
      const r = await fetch("/api/nex/connection-audit", { cache: "no-store" });
      const j = await r.json();
      setData(j);
    };
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  if (!data) return <div className="nws-card" style={{ color: "var(--nws-slate)" }}>Loading audit…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <SummaryTile label="Capabilities audited" value={data.summary.total} tone="cyan" />
        <SummaryTile label="Fully connected" value={data.summary.fully_connected} tone="green" />
        <SummaryTile label="Has gaps" value={data.summary.has_gaps} tone={data.summary.has_gaps > 0 ? "amber" : "slate"} />
      </div>

      <div className="nws-card" style={{ overflowX: "auto" }}>
        <h3 style={{ fontSize: 14, margin: "0 0 12px" }}>CAP × slot matrix</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ padding: "6px 8px", textAlign: "left", color: "var(--nws-slate)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--nws-card-border)" }}>CAP</th>
              <th style={{ padding: "6px 8px", textAlign: "left", color: "var(--nws-slate)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--nws-card-border)" }}>Title</th>
              {Object.keys(SLOT_LABELS).map((s) => (
                <th key={s} style={{ padding: "6px 4px", textAlign: "center", color: "var(--nws-slate)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--nws-card-border)" }}>{SLOT_LABELS[s]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.capabilityId} style={{ borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
                <td style={{ padding: "6px 8px" }}><code>{r.capabilityId}</code></td>
                <td style={{ padding: "6px 8px", color: "var(--nws-soft-white)" }}>{r.capabilityTitle}</td>
                {Object.keys(SLOT_LABELS).map((s) => (
                  <td key={s} style={{ padding: "6px 4px", textAlign: "center", fontSize: 12 }}>
                    <SlotDot status={r.slots[s] ?? "not_applicable"} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 12, display: "flex", gap: 12, fontSize: 11, color: "var(--nws-slate)" }}>
          <span><SlotDot status="connected" /> connected</span>
          <span><SlotDot status="not_connected" /> not connected</span>
          <span><SlotDot status="not_applicable" /> not applicable</span>
        </div>
      </div>
    </div>
  );
}

function SlotDot({ status }: { status: string }) {
  const color =
    status === "connected"     ? "var(--nws-success)" :
    status === "not_connected" ? "var(--nws-danger)"  : "var(--nws-slate)";
  const glyph =
    status === "connected"     ? "●" :
    status === "not_connected" ? "○" : "–";
  return <span style={{ color, fontSize: 14 }}>{glyph}</span>;
}

function SummaryTile({ label, value, tone }: { label: string; value: number | string; tone: "cyan" | "green" | "amber" | "slate" }) {
  const color =
    tone === "cyan"  ? "var(--nws-cyan)"    :
    tone === "green" ? "var(--nws-success)" :
    tone === "amber" ? "var(--nws-warning)" : "var(--nws-slate)";
  return (
    <div className="nws-card" style={{ textAlign: "center" }}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--nws-slate)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 4 }}>{label}</div>
    </div>
  );
}
