// NEX Brain · Draft Review
// The human-review gate for knowledge items ingested from live conversations.
// Rule 1 (Philip 2026-08-15): every draft item passes through here before it
// enters live retrieval. Never auto-promote.

"use client";

import { useCallback, useEffect, useState } from "react";

type Draft = {
  id: string;
  brain: string;
  source_batch: string;
  source_ref: string;
  kind: string;
  question_text: string | null;
  answer_text: string | null;
  canonical_intent: string;
  entities: string[];
  topics: string[];
  confidence: number;
  created_at: string;
};

type Aggregate = {
  total_drafts: number;
  from_live: number;
  conversations_represented: number;
};

export default function DraftReviewPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [agg, setAgg] = useState<Aggregate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [filter, setFilter] = useState<"live" | "all">("live");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const url = filter === "live"
        ? "/api/nex-conv/drafts?source_batch=live-conversations-2026-08-15&limit=200"
        : "/api/nex-conv/drafts?limit=200";
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setDrafts(j.drafts ?? []);
      setAgg(j.aggregate ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: "promote" | "reject") => {
    setBusyId(id); setStatus(null);
    try {
      const r = await fetch(`/api/nex-conv/knowledge-items/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: notes[id] || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
      setDrafts(prev => prev.filter(d => d.id !== id));
      setStatus(`${action === "promote" ? "✓ Promoted" : "✕ Rejected"} · ${id.slice(0, 8)}…`);
    } catch (e) {
      setStatus(`Error on ${id.slice(0, 8)}…: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={pageStyle}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={h1Style}>NEX Brain · Draft Review</h1>
        <p style={{ fontSize: 14, color: "#a79c8e", marginTop: 6, marginBottom: 0 }}>
          Human review gate for knowledge items ingested from live conversations. Nothing here has entered live retrieval yet.
        </p>
      </header>

      {agg && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 24 }}>
          <Stat label="total drafts" value={agg.total_drafts} />
          <Stat label="from live conversations" value={agg.from_live} tone="live" />
          <Stat label="conversations represented" value={agg.conversations_represented} />
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#a79c8e" }}>Filter:</span>
        <FilterButton active={filter === "live"} onClick={() => setFilter("live")}>From live conversations</FilterButton>
        <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>All drafts</FilterButton>
        <button onClick={load} style={reloadBtn}>↻ Reload</button>
        {status && <span style={{ marginLeft: 12, fontSize: 12, color: "#7fd4a8" }}>{status}</span>}
      </div>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "#e07070" }}>Error: {error}</p>}
      {!loading && !error && drafts.length === 0 && (
        <div style={{ padding: 32, background: "#1e1a15", borderRadius: 8, color: "#a79c8e", textAlign: "center" }}>
          Nothing to review. All drafts have been actioned.
        </div>
      )}

      {drafts.map(d => (
        <article key={d.id} style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: "#a79c8e" }}>
              <code style={{ color: "#8e8577" }}>{d.id.slice(0, 8)}…</code>
              {" · "}<b>{d.canonical_intent}</b>
              {" · "}confidence <span style={{ color: d.confidence >= 0.70 ? "#7fd4a8" : "#dbb17a" }}>{d.confidence.toFixed(2)}</span>
              {" · "}kind <code>{d.kind}</code>
            </div>
            <div style={{ fontSize: 11, color: "#666" }}>{new Date(d.created_at).toLocaleString()}</div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "#a79c8e", textTransform: "uppercase", letterSpacing: 0.5 }}>Customer said</div>
            <div style={{ fontSize: 14, color: "#e6dfd1", padding: "6px 10px", background: "#1a1712", borderRadius: 4, borderLeft: "3px solid #b58f5e", marginTop: 4 }}>
              {d.question_text ?? <em style={{ color: "#666" }}>(none)</em>}
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "#a79c8e", textTransform: "uppercase", letterSpacing: 0.5 }}>NEX replied</div>
            <div style={{ fontSize: 14, color: "#e6dfd1", padding: "6px 10px", background: "#1a1712", borderRadius: 4, borderLeft: "3px solid #5e8fb5", marginTop: 4 }}>
              {d.answer_text ?? <em style={{ color: "#666" }}>(none)</em>}
            </div>
          </div>

          <div style={{ fontSize: 11, color: "#a79c8e", marginBottom: 6 }}>
            entities: {d.entities.length ? d.entities.map(e => <span key={e} style={pill}>{e}</span>) : <em>(none)</em>}
            {" · "}source: <code style={{ color: "#8e8577" }}>{d.source_ref}</code>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
            <input
              placeholder="Optional note (why this decision?)"
              value={notes[d.id] || ""}
              onChange={e => setNotes({ ...notes, [d.id]: e.target.value })}
              style={noteInput}
            />
            <button onClick={() => act(d.id, "promote")} disabled={busyId === d.id} style={{ ...actionBtn, background: "#1a3a2a", color: "#7fd4a8", borderColor: "#2a5a3a" }}>
              {busyId === d.id ? "…" : "✓ Promote"}
            </button>
            <button onClick={() => act(d.id, "reject")} disabled={busyId === d.id} style={{ ...actionBtn, background: "#3a1a1a", color: "#e07070", borderColor: "#5a2a2a" }}>
              {busyId === d.id ? "…" : "✕ Reject"}
            </button>
          </div>
        </article>
      ))}

      <footer style={{ marginTop: 40, fontSize: 12, color: "#666" }}>
        Data: nex.conv_knowledge_items where draft_only=true · promote bumps confidence to ≥0.70 + draft_only=false · reject writes conv_feedback then DELETEs the row (edges cascade).
      </footer>
    </div>
  );
}

const pageStyle: React.CSSProperties = { padding: "32px 48px", fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif", background: "#0f0d0a", color: "#e6dfd1", minHeight: "100vh" };
const h1Style: React.CSSProperties = { fontSize: 28, fontWeight: 600, letterSpacing: -0.5, margin: 0 };
const cardStyle: React.CSSProperties = { padding: 16, background: "#161310", borderRadius: 8, marginBottom: 16, border: "1px solid #2a2620" };
const pill: React.CSSProperties = { display: "inline-block", background: "#2a2620", padding: "2px 8px", borderRadius: 999, marginRight: 4, fontSize: 11, color: "#e6dfd1" };
const noteInput: React.CSSProperties = { flex: 1, padding: "6px 10px", background: "#0a0806", border: "1px solid #2a2620", color: "#e6dfd1", borderRadius: 4, fontSize: 12, fontFamily: "inherit" };
const actionBtn: React.CSSProperties = { padding: "6px 14px", border: "1px solid", borderRadius: 4, cursor: "pointer", fontSize: 12, fontFamily: "inherit" };
const reloadBtn: React.CSSProperties = { padding: "4px 10px", background: "transparent", border: "1px solid #2a2620", color: "#a79c8e", borderRadius: 4, cursor: "pointer", fontSize: 12, marginLeft: 8 };

function Stat({ label, value, tone }: { label: string; value: number; tone?: "live" }) {
  const bg = tone === "live" ? "#1a3a2a" : "#1e1a15";
  const fg = tone === "live" ? "#7fd4a8" : "#e6dfd1";
  return (
    <div style={{ background: bg, borderRadius: 8, padding: "12px 16px" }}>
      <div style={{ fontSize: 11, color: "#a79c8e", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: fg, marginTop: 2 }}>{value.toLocaleString()}</div>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 12px",
        background: active ? "#b58f5e" : "transparent",
        border: `1px solid ${active ? "#b58f5e" : "#2a2620"}`,
        color: active ? "#0f0d0a" : "#a79c8e",
        borderRadius: 4,
        cursor: "pointer",
        fontSize: 12,
        fontWeight: active ? 500 : 400,
        fontFamily: "inherit",
      }}
    >{children}</button>
  );
}
