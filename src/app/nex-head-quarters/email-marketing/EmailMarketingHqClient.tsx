"use client";

// Reads the existing backend endpoints · never rebuilds them. Graceful degradation
// when endpoints unavailable in the current environment.

import { useEffect, useState } from "react";

interface Stats {
  pipeline?: Record<string, number>;
  by_source?: Record<string, number>;
  by_country?: Record<string, number>;
  env?: { send_enabled?: boolean; esp?: string; rate_limit?: number };
}

interface Matrix {
  cells?: Array<{ category: string; country: string; count: number; sample?: string[] }>;
}

export function EmailMarketingHqClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, mRes] = await Promise.all([
          fetch("/api/nex/marketing/stats", { cache: "no-store" }).catch(() => null),
          fetch("/api/nex/marketing/matrix", { cache: "no-store" }).catch(() => null),
        ]);
        if (sRes?.ok) setStats(await sRes.json());
        if (mRes?.ok) setMatrix(await mRes.json());
        setError(null);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load email marketing data");
      }
    };
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && (
        <div className="nws-card" style={{ color: "var(--nws-danger)" }}>
          Backend endpoint unavailable · {error}
        </div>
      )}

      {/* Environment status */}
      <div className="nws-card">
        <h3 style={{ fontSize: 14, margin: "0 0 12px" }}>Environment</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, fontSize: 12 }}>
          <EnvTile label="Send enabled" value={stats?.env?.send_enabled ? "YES" : "NO"} tone={stats?.env?.send_enabled ? "green" : "amber"} />
          <EnvTile label="ESP" value={stats?.env?.esp ?? "…"} tone="cyan" />
          <EnvTile label="Rate limit" value={stats?.env?.rate_limit ? `${stats.env.rate_limit}/hr` : "…"} tone="slate" />
        </div>
      </div>

      {/* Pipeline */}
      <div className="nws-card">
        <h3 style={{ fontSize: 14, margin: "0 0 12px" }}>7-stage pipeline</h3>
        {!stats?.pipeline ? (
          <p style={{ margin: 0, fontSize: 12, color: "var(--nws-slate)" }}>Backend not reachable · pipeline stats unavailable.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
            {Object.entries(stats.pipeline).map(([stage, count]) => (
              <div key={stage} style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--nws-card-border)", borderRadius: 8, padding: 10, textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--nws-cyan)" }}>{count}</div>
                <div style={{ fontSize: 10, color: "var(--nws-slate)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>{stage.replace(/_/g, " ")}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category × country matrix */}
      <div className="nws-card">
        <h3 style={{ fontSize: 14, margin: "0 0 12px" }}>Category × country matrix</h3>
        {!matrix?.cells || matrix.cells.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: "var(--nws-slate)" }}>Backend not reachable · matrix unavailable.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["Category", "Country", "Contacts", "Sample subcategories"].map((h) => (
                    <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: "var(--nws-slate)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--nws-card-border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.cells.slice(0, 100).map((c, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
                    <td style={{ padding: "6px 10px" }}><code>{c.category}</code></td>
                    <td style={{ padding: "6px 10px" }}>{c.country}</td>
                    <td style={{ padding: "6px 10px", color: "var(--nws-cyan)", fontWeight: 700 }}>{c.count}</td>
                    <td style={{ padding: "6px 10px", color: "var(--nws-slate)" }}>{c.sample?.slice(0, 3).join(" · ") ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sources + countries */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="nws-card">
          <h3 style={{ fontSize: 14, margin: "0 0 12px" }}>By source</h3>
          {!stats?.by_source ? <p style={{ margin: 0, fontSize: 12, color: "var(--nws-slate)" }}>—</p> :
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {Object.entries(stats.by_source).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "var(--nws-slate)" }}>{k}</span>
                  <strong style={{ color: "var(--nws-cyan)" }}>{v}</strong>
                </div>
              ))}
            </div>
          }
        </div>
        <div className="nws-card">
          <h3 style={{ fontSize: 14, margin: "0 0 12px" }}>By country</h3>
          {!stats?.by_country ? <p style={{ margin: 0, fontSize: 12, color: "var(--nws-slate)" }}>—</p> :
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {Object.entries(stats.by_country).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "var(--nws-slate)" }}>{k}</span>
                  <strong style={{ color: "var(--nws-cyan)" }}>{v}</strong>
                </div>
              ))}
            </div>
          }
        </div>
      </div>

      <div className="nws-card" style={{ background: "rgba(34,211,238,0.06)", borderColor: "rgba(34,211,238,0.3)" }}>
        <div style={{ fontSize: 12, color: "var(--nws-slate)" }}>
          <strong style={{ color: "var(--nws-cyan)" }}>Backend preserved</strong> · this HQ page is read-only monitoring · founder authoring (templates · campaigns · policies) remains at <a href="/nexapp/lab/marketing" style={{ color: "var(--nws-cyan)" }}>/nexapp/lab/marketing</a> · nothing rebuilt · nothing broken.
        </div>
      </div>
    </div>
  );
}

function EnvTile({ label, value, tone }: { label: string; value: string; tone: "green" | "cyan" | "amber" | "slate" }) {
  const color = tone === "green" ? "var(--nws-success)" : tone === "cyan" ? "var(--nws-cyan)" : tone === "amber" ? "var(--nws-warning)" : "var(--nws-slate)";
  return (
    <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--nws-card-border)", borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--nws-slate)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>{label}</div>
    </div>
  );
}
