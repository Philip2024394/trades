"use client";

import { useEffect, useState } from "react";

interface Intervention {
  interventionId: string;
  capabilityId: string;
  targetRevisionId: string;
  kind: "DISABLE" | "ROLLBACK" | "REMOVE_FROM_LIVE";
  rollbackTargetRevisionId: string | null;
  reason: string;
  issuedBy: string;
  issuedAt: string;
  autoRebuildLocked: boolean;
}

interface AttemptRow {
  capabilityId: string;
  attemptedBy: string;
  attemptedAt: string;
  rejectionCode: string;
  blockingInterventionId: string;
}

interface ListResponse {
  ok: boolean;
  interventions: Intervention[];
  auto_rebuild_attempts: AttemptRow[];
}

export function SectionInterventionClient() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [form, setForm] = useState({
    capabilityId: "",
    targetRevisionId: "",
    kind: "DISABLE" as Intervention["kind"],
    rollbackTargetRevisionId: "",
    reason: "",
    issuedBy: "",
  });
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const r = await fetch("/api/nex/section-intervention/list", { cache: "no-store" });
    const j = await r.json();
    setData(j);
  };
  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  const issue = async () => {
    setMsg(null);
    const body: any = { ...form };
    if (form.kind !== "ROLLBACK") body.rollbackTargetRevisionId = null;
    const r = await fetch("/api/nex/section-intervention/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (j.ok) {
      setMsg("Intervention recorded");
      setForm({ ...form, reason: "", issuedBy: "" });
      load();
    } else {
      setMsg(`Rejected: ${j.reason} (${j.code})`);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", gap: 16, alignItems: "start" }}>
      {/* Left: issue form */}
      <section className="nws-card">
        <h3 style={{ fontSize: 14, margin: "0 0 8px" }}>Issue intervention</h3>
        <label style={{ fontSize: 11, color: "var(--nws-slate)" }}>Capability</label>
        <input className="nws-input" placeholder="CAP-091" value={form.capabilityId} onChange={(e) => setForm({ ...form, capabilityId: e.target.value })} style={{ marginBottom: 8 }} />
        <label style={{ fontSize: 11, color: "var(--nws-slate)" }}>Target revision id</label>
        <input className="nws-input" placeholder="rev-uuid" value={form.targetRevisionId} onChange={(e) => setForm({ ...form, targetRevisionId: e.target.value })} style={{ marginBottom: 8 }} />
        <label style={{ fontSize: 11, color: "var(--nws-slate)" }}>Kind</label>
        <select className="nws-input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Intervention["kind"] })} style={{ marginBottom: 8 }}>
          <option value="DISABLE">DISABLE · hide from live · intact · reversible</option>
          <option value="ROLLBACK">ROLLBACK · activate previous known-good revision</option>
          <option value="REMOVE_FROM_LIVE">REMOVE FROM LIVE · locks against auto-rebuild</option>
        </select>
        {form.kind === "ROLLBACK" && (
          <>
            <label style={{ fontSize: 11, color: "var(--nws-slate)" }}>Rollback target revision id</label>
            <input className="nws-input" placeholder="rev-uuid (previous)" value={form.rollbackTargetRevisionId} onChange={(e) => setForm({ ...form, rollbackTargetRevisionId: e.target.value })} style={{ marginBottom: 8 }} />
          </>
        )}
        <label style={{ fontSize: 11, color: "var(--nws-slate)" }}>Reason (audit trail · required)</label>
        <textarea className="nws-input" rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} style={{ marginBottom: 8, resize: "vertical", fontFamily: "inherit" }} />
        <label style={{ fontSize: 11, color: "var(--nws-slate)" }}>Founder signature</label>
        <input type="password" className="nws-input" value={form.issuedBy} onChange={(e) => setForm({ ...form, issuedBy: e.target.value })} style={{ marginBottom: 12 }} />
        <button
          type="button"
          className={form.kind === "REMOVE_FROM_LIVE" ? "nws-btn-danger" : "nws-btn-primary"}
          onClick={issue}
          disabled={!form.capabilityId || !form.targetRevisionId || !form.reason || !form.issuedBy}
          style={{ width: "100%", opacity: (!form.capabilityId || !form.targetRevisionId || !form.reason || !form.issuedBy) ? 0.5 : 1 }}
        >
          Issue {form.kind}
        </button>
        {msg && <div style={{ marginTop: 8, fontSize: 11, color: msg === "Intervention recorded" ? "var(--nws-success)" : "var(--nws-danger)" }}>{msg}</div>}
      </section>

      {/* Right: history */}
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="nws-card">
          <h3 style={{ fontSize: 14, margin: "0 0 12px" }}>Interventions · {data?.interventions.length ?? 0}</h3>
          {!data || data.interventions.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: "var(--nws-slate)" }}>No interventions recorded.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.interventions.slice().reverse().map((i) => (
                <div key={i.interventionId} style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--nws-card-border)", borderRadius: 8, padding: 10, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span className={`nws-badge ${i.kind === "DISABLE" ? "nws-badge-amber" : i.kind === "ROLLBACK" ? "nws-badge-orange" : "nws-badge-red"}`}>{i.kind}</span>
                    <span style={{ color: "var(--nws-slate)", fontSize: 11 }}>{new Date(i.issuedAt).toLocaleString()}</span>
                  </div>
                  <div><code>{i.capabilityId}</code> · rev <code>{i.targetRevisionId.slice(0, 12)}…</code></div>
                  <div style={{ color: "var(--nws-slate)", marginTop: 4 }}>{i.reason}</div>
                  {i.autoRebuildLocked && (
                    <div style={{ marginTop: 6 }}><span className="nws-badge nws-badge-red">🔒 AUTO-REBUILD LOCKED</span></div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="nws-card">
          <h3 style={{ fontSize: 14, margin: "0 0 12px" }}>Auto-rebuild attempts blocked · {data?.auto_rebuild_attempts.length ?? 0}</h3>
          {!data || data.auto_rebuild_attempts.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: "var(--nws-slate)" }}>No blocked auto-rebuild attempts recorded.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
              {data.auto_rebuild_attempts.map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ color: "var(--nws-slate)" }}>{new Date(a.attemptedAt).toLocaleString()}</span>
                  <code>{a.capabilityId}</code>
                  <span>· by <code>{a.attemptedBy}</code></span>
                  <span className="nws-badge nws-badge-red">{a.rejectionCode}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
