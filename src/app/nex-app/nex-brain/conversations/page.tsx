// NEX Brain · Conversations
// Read-only admin view of every conversation the NEX pipeline has processed.
// Reads /api/nex-conv/conversations (which reads Postgres nex.conv_turns).
// Click a conversation row to expand to per-turn detail.
//
// This is a minimal Step-3 admin surface — no promote/reject actions yet
// (those come with a follow-up ingest-from-turns --auto-promote flow).

"use client";

import { useEffect, useState } from "react";

type Aggregate = {
  total_turns: number;
  total_conversations: number;
  total_items: number;
  live_items: number;
  draft_items: number;
  from_live: number;
  total_edges: number;
};

type ConvSummary = {
  conversation_id: string;
  customer_turns: number;
  nex_turns: number;
  started_at: string;
  last_turn_at: string;
  first_customer_message: string | null;
  current_topic: string | null;
  material: string | null;
  style: string | null;
  emotion: string | null;
  handoff_recommended: boolean | null;
};

type TurnRow = {
  id: string;
  turn_index: number;
  speaker: "customer" | "nex" | "owner";
  text: string;
  detected_intent: string | null;
  detected_entities: string[] | null;
  latency_ms: number | null;
  created_at: string;
};

type StateSnapshot = {
  turn_count: number;
  current_topic: string | null;
  established_facts: Record<string, { value: string; turn_established: number; confidence: number } | undefined>;
  entities_in_focus: string[];
  constraints: string[];
  current_emotion: string;
  handoff_recommended: boolean;
  corrections_logged: number;
  stage: string;
};

export default function NexConversationsPage() {
  const [agg, setAgg] = useState<Aggregate | null>(null);
  const [convs, setConvs] = useState<ConvSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ turns: TurnRow[]; state_snapshot: StateSnapshot | null } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/nex-conv/conversations?limit=100");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        setAgg(j.aggregate);
        setConvs(j.conversations ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openConv = async (id: string) => {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id);
    setDetailLoading(true);
    setDetail(null);
    try {
      const r = await fetch(`/api/nex-conv/conversations?conversation_id=${encodeURIComponent(id)}`);
      const j = await r.json();
      setDetail({ turns: j.turns ?? [], state_snapshot: j.state_snapshot ?? null });
    } catch (e) {
      setDetail({ turns: [], state_snapshot: null });
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div style={{ padding: "32px 48px", fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif", background: "#0f0d0a", color: "#e6dfd1", minHeight: "100vh" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.5, margin: 0 }}>NEX Brain · Conversations</h1>
        <p style={{ fontSize: 14, color: "#a79c8e", marginTop: 6 }}>
          Live conversations the NEX pipeline has processed. Read-only. Click a row for per-turn detail.
        </p>
      </header>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "#e07070" }}>Error: {error}</p>}

      {agg && (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 24 }}>
          <Stat label="conversations" value={agg.total_conversations} />
          <Stat label="turns total" value={agg.total_turns} />
          <Stat label="knowledge items" value={agg.total_items} />
          <Stat label="live" value={agg.live_items} tone="live" />
          <Stat label="draft (review)" value={agg.draft_items} tone="draft" />
          <Stat label="from live convos" value={agg.from_live} tone="live" />
          <Stat label="graph edges" value={agg.total_edges} />
        </section>
      )}

      <section>
        <h2 style={{ fontSize: 16, fontWeight: 500, color: "#a79c8e", margin: "24px 0 12px" }}>Recent conversations</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#a79c8e", borderBottom: "1px solid #2a2620" }}>
              <th style={th}>id</th>
              <th style={th}>started</th>
              <th style={{ ...th, textAlign: "right" }}>turns (cust / nex)</th>
              <th style={th}>first customer message</th>
              <th style={th}>state</th>
              <th style={{ ...th, textAlign: "right" }}>emotion</th>
            </tr>
          </thead>
          <tbody>
            {convs.map(c => (
              <>
                <tr
                  key={c.conversation_id}
                  onClick={() => openConv(c.conversation_id)}
                  style={{ cursor: "pointer", borderBottom: "1px solid #1e1a15", background: openId === c.conversation_id ? "#1c1712" : "transparent" }}
                >
                  <td style={td}><code style={{ fontSize: 11, color: "#8e8577" }}>{c.conversation_id.slice(0, 8)}…</code></td>
                  <td style={td}>{new Date(c.started_at).toLocaleString()}</td>
                  <td style={{ ...td, textAlign: "right" }}>{c.customer_turns} / {c.nex_turns}</td>
                  <td style={{ ...td, maxWidth: 320, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.first_customer_message ?? <em style={{ color: "#666" }}>(none)</em>}
                  </td>
                  <td style={td}>
                    {c.material && <span style={pill}>{c.material}</span>}
                    {c.style && <span style={pill}>{c.style}</span>}
                    {c.current_topic && <span style={pill}>{c.current_topic}</span>}
                    {c.handoff_recommended && <span style={{ ...pill, background: "#4a2a1f" }}>handoff</span>}
                  </td>
                  <td style={{ ...td, textAlign: "right", color: c.emotion === "frustrated" ? "#e07070" : c.emotion === "apologetic" ? "#dbb17a" : "#a79c8e" }}>
                    {c.emotion ?? "—"}
                  </td>
                </tr>
                {openId === c.conversation_id && (
                  <tr key={c.conversation_id + "-detail"}>
                    <td colSpan={6} style={{ padding: "16px 12px", background: "#161310" }}>
                      {detailLoading && <p style={{ fontSize: 12, color: "#a79c8e" }}>Loading detail…</p>}
                      {detail && <ConvDetail turns={detail.turns} state={detail.state_snapshot} />}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </section>

      <footer style={{ marginTop: 40, fontSize: 12, color: "#666" }}>
        Data from nex.conv_turns + nex.conv_states via /api/nex-conv/conversations. Local Postgres only.
      </footer>
    </div>
  );
}

const th: React.CSSProperties = { padding: "8px 12px", fontWeight: 500 };
const td: React.CSSProperties = { padding: "10px 12px", verticalAlign: "top" };
const pill: React.CSSProperties = {
  display: "inline-block", background: "#2a2620", padding: "2px 8px", borderRadius: 999, marginRight: 4, fontSize: 11, color: "#e6dfd1",
};

function Stat({ label, value, tone }: { label: string; value: number; tone?: "live" | "draft" }) {
  const bg = tone === "live" ? "#1a3a2a" : tone === "draft" ? "#3a2f1a" : "#1e1a15";
  const fg = tone === "live" ? "#7fd4a8" : tone === "draft" ? "#dbb17a" : "#e6dfd1";
  return (
    <div style={{ background: bg, borderRadius: 8, padding: "12px 16px" }}>
      <div style={{ fontSize: 11, color: "#a79c8e", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: fg, marginTop: 2 }}>{value.toLocaleString()}</div>
    </div>
  );
}

function ConvDetail({ turns, state }: { turns: TurnRow[]; state: StateSnapshot | null }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
      <div>
        <h3 style={{ fontSize: 13, color: "#a79c8e", marginTop: 0, marginBottom: 8 }}>Turns</h3>
        {turns.length === 0 && <p style={{ color: "#666" }}>No turns.</p>}
        {turns.map(t => (
          <div key={t.id} style={{ marginBottom: 12, padding: 10, background: "#1e1a15", borderRadius: 6, borderLeft: `3px solid ${t.speaker === "customer" ? "#b58f5e" : "#5e8fb5"}` }}>
            <div style={{ fontSize: 11, color: "#a79c8e", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
              <span>T{t.turn_index} · <b>{t.speaker}</b> {t.detected_intent && <>· intent=<code>{t.detected_intent}</code></>} {t.detected_entities && t.detected_entities.length > 0 && <>· ents=[{t.detected_entities.slice(0, 5).join(",")}]</>}</span>
              <span>{t.latency_ms ? `${t.latency_ms}ms` : ""}</span>
            </div>
            <div style={{ fontSize: 13, color: "#e6dfd1", whiteSpace: "pre-wrap" }}>{t.text}</div>
          </div>
        ))}
      </div>
      <div>
        <h3 style={{ fontSize: 13, color: "#a79c8e", marginTop: 0, marginBottom: 8 }}>State snapshot</h3>
        {!state && <p style={{ color: "#666", fontSize: 12 }}>No state row.</p>}
        {state && (
          <div style={{ fontSize: 12, background: "#1e1a15", padding: 12, borderRadius: 6, lineHeight: 1.6 }}>
            <div><b>turn_count:</b> {state.turn_count}</div>
            <div><b>stage:</b> {state.stage}</div>
            <div><b>emotion:</b> {state.current_emotion}</div>
            <div><b>topic:</b> {state.current_topic ?? "—"}</div>
            <div><b>material:</b> {state.established_facts?.material_primary?.value ?? "—"}</div>
            <div><b>style:</b> {state.established_facts?.style_intent?.value ?? "—"}</div>
            <div><b>constraints:</b> {(state.constraints ?? []).join(", ") || "—"}</div>
            <div><b>focus:</b> {(state.entities_in_focus ?? []).slice(0, 6).join(", ") || "—"}</div>
            <div><b>corrections:</b> {state.corrections_logged}</div>
            <div><b>handoff:</b> {state.handoff_recommended ? <span style={{ color: "#dbb17a" }}>true</span> : "false"}</div>
          </div>
        )}
      </div>
    </div>
  );
}
