"use client";

import { useEffect, useState } from "react";

interface DimScore {
  dimension: string;
  score: number;
  reasoning: string;
  evidence: string[];
}

interface IdeaRow {
  ideaId: string;
  title: string;
  summary: string;
  compositeScore: number;
  band: string;
  enhancedConcept: string | null;
  evaluatedAt: string;
  dimensionScores: DimScore[];
  decision: null | { kind: string; signedBy: string; at: string; targetCapabilityId?: string; note?: string | null; reason?: string };
}

export function IdeaLabClient() {
  const [rows, setRows] = useState<IdeaRow[]>([]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const r = await fetch("/api/nex/idea-lab/list", { cache: "no-store" });
    const j = await r.json();
    setRows(j.rows ?? []);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  const submit = async () => {
    setSubmitting(true);
    setMsg(null);
    try {
      const r = await fetch("/api/nex/idea-lab/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, summary }),
      });
      const j = await r.json();
      if (j.ok) {
        setMsg(`Evaluated · composite ${j.compositeScore}`);
        setTitle("");
        setSummary("");
        load();
      } else {
        setMsg(`Rejected: ${j.reason}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 400px) 1fr", gap: 16, alignItems: "start" }}>
      {/* LEFT · founder input */}
      <section className="nws-card">
        <h3 style={{ fontSize: 14, margin: "0 0 8px" }}>New idea</h3>
        <input
          className="nws-input"
          placeholder="Idea title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ marginBottom: 8 }}
        />
        <textarea
          className="nws-input"
          placeholder="One-paragraph summary of the idea · what · why · how it fits NEX"
          rows={5}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          style={{ resize: "vertical", fontFamily: "inherit", marginBottom: 8 }}
        />
        <button
          type="button"
          className="nws-btn-primary"
          onClick={submit}
          disabled={submitting || !title.trim() || !summary.trim()}
          style={{ opacity: (!title.trim() || !summary.trim()) ? 0.5 : 1, width: "100%" }}
        >
          {submitting ? "Evaluating…" : "Evaluate idea"}
        </button>
        {msg && <div style={{ marginTop: 8, fontSize: 11, color: "var(--nws-cyan)" }}>{msg}</div>}
      </section>

      {/* RIGHT · evaluations */}
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.length === 0 ? (
          <div className="nws-card" style={{ color: "var(--nws-slate)", fontSize: 13 }}>No evaluations yet · type an idea on the left to score it.</div>
        ) : (
          rows.slice().reverse().map((r) => <IdeaEvaluationCard key={r.ideaId} row={r} onReload={load} />)
        )}
      </section>
    </div>
  );
}

function IdeaEvaluationCard({ row, onReload }: { row: IdeaRow; onReload: () => void }) {
  const [showDims, setShowDims] = useState(false);
  const [signature, setSignature] = useState("");
  const [targetCap, setTargetCap] = useState("");
  const [decideBusy, setDecideBusy] = useState(false);
  const [decideMsg, setDecideMsg] = useState<string | null>(null);

  const decide = async (kind: string, extra: Record<string, unknown> = {}) => {
    setDecideBusy(true);
    setDecideMsg(null);
    try {
      const r = await fetch("/api/nex/idea-lab/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId: row.ideaId, kind, signedBy: signature, ...extra }),
      });
      const j = await r.json();
      if (j.ok) {
        setDecideMsg("Decision recorded");
        onReload();
      } else {
        setDecideMsg(`Rejected: ${j.reason}`);
      }
    } finally {
      setDecideBusy(false);
    }
  };

  const bandClass =
    row.band === "🟢 STRONG"           ? "nws-badge-green"  :
    row.band === "🟡 CONSIDER"         ? "nws-badge-amber"  :
    row.band === "🟠 WEAK"             ? "nws-badge-orange" : "nws-badge-red";

  return (
    <article className="nws-card">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 15, margin: "0 0 4px" }}>{row.title}</h3>
          <p style={{ margin: 0, fontSize: 12, color: "var(--nws-slate)" }}>{row.summary}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--nws-cyan)" }}>{row.compositeScore}</div>
          <span className={`nws-badge ${bandClass}`}>{row.band}</span>
        </div>
      </header>

      <button
        type="button"
        onClick={() => setShowDims((v) => !v)}
        style={{ marginTop: 12, background: "transparent", border: "none", color: "var(--nws-cyan)", fontSize: 12, cursor: "pointer", padding: 0 }}
      >
        {showDims ? "▼" : "▶"} 11 dimensions with reasoning
      </button>
      {showDims && (
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          {row.dimensionScores.map((d) => (
            <div key={d.dimension} style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--nws-card-border)", borderRadius: 6, padding: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                <span style={{ color: "var(--nws-soft-white)", fontWeight: 600 }}>{d.dimension.replace(/_/g, " ")}</span>
                <span style={{ color: d.score >= 70 ? "var(--nws-success)" : d.score >= 40 ? "var(--nws-warning)" : "var(--nws-danger)", fontWeight: 700 }}>{d.score}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--nws-slate)" }}>{d.reasoning}</div>
              {d.evidence.length > 0 && (
                <div style={{ fontSize: 10, color: "var(--nws-slate)", marginTop: 4 }}>
                  Evidence: {d.evidence.join(" · ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {row.decision ? (
        <div style={{ marginTop: 12, padding: 10, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, fontSize: 12 }}>
          <strong style={{ color: "var(--nws-success)" }}>Decision:</strong> {row.decision.kind}
          {row.decision.targetCapabilityId && <> · target <code>{row.decision.targetCapabilityId}</code></>}
          {row.decision.reason && <> · reason: {row.decision.reason}</>}
          {row.decision.note && <> · note: {row.decision.note}</>}
        </div>
      ) : (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--nws-card-border)" }}>
          <div style={{ fontSize: 11, color: "var(--nws-slate)", marginBottom: 6 }}>Founder decision:</div>
          <input type="password" className="nws-input" placeholder="Founder signature" value={signature} onChange={(e) => setSignature(e.target.value)} style={{ marginBottom: 6, fontSize: 12 }} />
          <input className="nws-input" placeholder="Target CAP (for SEND · e.g. CAP-091)" value={targetCap} onChange={(e) => setTargetCap(e.target.value)} style={{ marginBottom: 6, fontSize: 12 }} />
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="nws-btn-primary" onClick={() => decide("SEND_TO_CODING", { targetCapabilityId: targetCap })} disabled={decideBusy || !signature || !targetCap} style={{ flex: 1, fontSize: 12 }}>🟢 SEND</button>
            <button type="button" className="nws-btn-secondary" onClick={() => decide("SAVE_FOR_LATER")} disabled={decideBusy || !signature} style={{ flex: 1, fontSize: 12 }}>🟡 SAVE</button>
            <button type="button" className="nws-btn-danger" onClick={() => {
              const reason = prompt("Rejection reason?");
              if (reason) decide("REJECT", { reason });
            }} disabled={decideBusy || !signature} style={{ flex: 1, fontSize: 12 }}>🔴 REJECT</button>
          </div>
          {decideMsg && <div style={{ marginTop: 6, fontSize: 11, color: decideMsg === "Decision recorded" ? "var(--nws-success)" : "var(--nws-danger)" }}>{decideMsg}</div>}
        </div>
      )}
    </article>
  );
}
