"use client";

import { useEffect, useState } from "react";

interface HistoryRow {
  runId: string;
  at: string;
  agentId: string;
  capabilityId: string | null;
  action: string;
  verdict: "ACCEPT" | "REJECT";
  rejectionCodes: string[];
  reason: string | null;
}

interface HistoryResponse {
  ok: boolean;
  recent: HistoryRow[];
  counts_by_verdict: { accept: number; reject: number };
  counts_by_code: Record<string, number>;
}

export function SecurityHqClient() {
  const [data, setData] = useState<HistoryResponse | null>(null);

  useEffect(() => {
    const load = async () => {
      const r = await fetch("/api/nex/hq-security/history", { cache: "no-store" });
      const j = await r.json();
      setData(j);
    };
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  if (!data) return <div className="nws-card" style={{ color: "var(--nws-slate)" }}>Loading security history…</div>;

  const total = data.counts_by_verdict.accept + data.counts_by_verdict.reject;
  const rejectRate = total > 0 ? Math.round((data.counts_by_verdict.reject / total) * 100) : 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
      {/* Summary tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <SummaryTile label="Total inspections" value={total} tone="cyan" />
        <SummaryTile label="Accepted" value={data.counts_by_verdict.accept} tone="green" />
        <SummaryTile label="Rejected" value={data.counts_by_verdict.reject} tone={data.counts_by_verdict.reject > 0 ? "red" : "slate"} />
        <SummaryTile label="Reject rate" value={`${rejectRate}%`} tone={rejectRate > 20 ? "amber" : "slate"} />
      </div>

      {/* Rejection code frequency */}
      <div className="nws-card">
        <h3 style={{ fontSize: 14, margin: "0 0 12px" }}>Rejection code frequency</h3>
        {Object.keys(data.counts_by_code).length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: "var(--nws-slate)" }}>No rejections recorded · every inspection accepted so far.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.entries(data.counts_by_code).sort((a, b) => b[1] - a[1]).map(([code, count]) => (
              <div key={code} style={{ display: "grid", gridTemplateColumns: "1fr 60px", gap: 12, alignItems: "center" }}>
                <code style={{ fontSize: 12, color: "var(--nws-danger)" }}>{code}</code>
                <div style={{ textAlign: "right", fontSize: 12, color: "var(--nws-soft-white)", fontWeight: 600 }}>{count}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent inspection stream */}
      <div className="nws-card">
        <h3 style={{ fontSize: 14, margin: "0 0 12px" }}>Recent inspections · {data.recent.length}</h3>
        {data.recent.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: "var(--nws-slate)" }}>
            No inspections yet. Every NEX1 code change routes through <code>/api/nex/hq-security/inspect</code> · this feed populates as inspections run.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.recent.map((r) => (
              <div key={r.runId} style={{ display: "grid", gridTemplateColumns: "auto 120px auto 1fr", gap: 10, alignItems: "center", fontSize: 12, padding: "6px 0", borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
                <span className={`nws-badge ${r.verdict === "ACCEPT" ? "nws-badge-green" : "nws-badge-red"}`}>{r.verdict}</span>
                <span style={{ color: "var(--nws-slate)" }}>{new Date(r.at).toLocaleTimeString()}</span>
                <span><code style={{ color: "var(--nws-cyan)" }}>{r.agentId}</code></span>
                <span style={{ color: "var(--nws-soft-white)" }}>
                  {r.action}
                  {r.capabilityId && <> · <code>{r.capabilityId}</code></>}
                  {r.rejectionCodes.length > 0 && <> · <span style={{ color: "var(--nws-danger)" }}>{r.rejectionCodes.join(", ")}</span></>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string | number; tone: "green" | "red" | "cyan" | "amber" | "slate" }) {
  const color =
    tone === "green" ? "var(--nws-success)" :
    tone === "red"   ? "var(--nws-danger)"  :
    tone === "cyan"  ? "var(--nws-cyan)"    :
    tone === "amber" ? "var(--nws-warning)" : "var(--nws-slate)";
  return (
    <div className="nws-card" style={{ textAlign: "center" }}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--nws-slate)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 4 }}>{label}</div>
    </div>
  );
}
