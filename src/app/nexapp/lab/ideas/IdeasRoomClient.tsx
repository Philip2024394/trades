"use client";

// src/app/nexapp/lab/ideas/IdeasRoomClient.tsx
//
// Founder 2026-09-10 · Innovation Room UI · landscape idea cards.
// - Filter by status (proposed / approved / shipped / rejected / all)
// - Click card → expands to show engineering brief
// - Approve button → POST /api/nex/lab/ideas/[id]/approve → shows copy-ready brief in a modal

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

interface Idea {
  idea_id: string;
  created_at: string;
  generated_by_agent: string;
  category: string;
  title: string;
  user_need: string;
  description: string;
  why_missing: string;
  evidence_refs: unknown;
  engineering_brief: string;
  difficulty: string;
  user_value: string;
  status: string;
  decided_at: string | null;
  decided_by: string | null;
  copied_at: string | null;
}
interface Payload { ideas: Idea[]; counts_by_status: Record<string, number>; filter_status: string; error?: string; }

const CATEGORY_COLORS: Record<string, string> = {
  chat_answer:    "#38bdf8",
  discovery_ui:   "#a78bfa",
  trust_signal:   "#4ade80",
  community_layer:"#f59e0b",
  offline_mode:   "#22d3ee",
  founder_tool:   "#fb7185",
  monetization:   "#facc15",
  accessibility:  "#f472b6",
};

const DIFFICULTY_LABEL: Record<string, string> = { S: "≤ 1 day", M: "≤ 3 days", L: "≤ 2 weeks", XL: "> 2 weeks" };

export function IdeasRoomClient() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("proposed");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modalBrief, setModalBrief] = useState<{ title: string; brief: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const r = await fetch(`/api/nex/lab/ideas?status=${filter}`, { cache: "no-store", signal });
      const j = await r.json();
      if (!signal?.aborted) { setPayload(j); setErr(j.error ?? null); }
    } catch (e) {
      // Swallow expected AbortError · surface real errors only
      if (signal?.aborted) return;
      if (e instanceof DOMException && e.name === "AbortError") return;
      setErr(e instanceof Error ? e.message.slice(0, 80) : "err");
    }
  }, [filter]);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    const iv = setInterval(() => { void load(ac.signal); }, 15000);
    return () => { ac.abort(); clearInterval(iv); };
  }, [load]);

  async function approve(idea: Idea) {
    setBusy(idea.idea_id);
    try {
      const r = await fetch(`/api/nex/lab/ideas/${idea.idea_id}/approve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decided_by: "founder" }) });
      const j = await r.json();
      if (j.ok && j.brief) {
        setModalBrief({ title: idea.title, brief: j.brief });
        setCopied(false);
        void load();
      } else {
        alert("approve failed: " + (j.error ?? "unknown"));
      }
    } finally { setBusy(null); }
  }
  async function copyBrief() {
    if (!modalBrief) return;
    try { await navigator.clipboard.writeText(modalBrief.brief); setCopied(true); setTimeout(() => setCopied(false), 3000); }
    catch { alert("clipboard unavailable · select all and copy manually"); }
  }

  const counts = payload?.counts_by_status ?? {};

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <header style={{ padding: "16px 24px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, maxWidth: 780 }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: "#a78bfa", boxShadow: "0 0 8px #a78bfa88", marginTop: 6, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>NEX · Innovation Room · Ideas for NEX</div>
            <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.55, marginTop: 4 }}>
              Robot helpers looked at NEX and thought of new things it could do for people. Every card below is one idea. Click a card to read the full story of what the idea is and why it&apos;s not built yet. If you like an idea, press <b style={{ color: "#c4b5fd" }}>Approve &amp; Copy Engineer Brief</b>. NEX gives you a page of instructions you can send to a builder — the builder uses those instructions to make the idea real.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["proposed", "approved", "shipped", "rejected", "all"].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{
                background: filter === s ? "#4c1d95" : "#1e293b",
                color: filter === s ? "#fff" : "#cbd5e1",
                padding: "5px 10px", fontSize: 12, borderRadius: 4,
                border: "1px solid " + (filter === s ? "#7c3aed" : "#334155"), cursor: "pointer",
              }}>
              {s} <span style={{ opacity: 0.7 }}>· {counts[s] ?? 0}</span>
            </button>
          ))}
          <Link href="/nexapp/lab" style={{ color: "#94a3b8", padding: "5px 10px", fontSize: 12, textDecoration: "none", border: "1px solid #334155", borderRadius: 4 }}>← lab</Link>
        </div>
      </header>

      <div style={{ padding: "20px 24px" }}>
        {err && <div style={{ color: "#f87171", marginBottom: 12 }}>error · {err}</div>}
        {!payload && <div style={{ color: "#64748b" }}>loading…</div>}
        {payload && payload.ideas.length === 0 && (
          <div style={{ color: "#64748b", padding: 40, textAlign: "center", background: "#111827", borderRadius: 8, border: "1px dashed #334155" }}>
            No ideas with status <b style={{ color: "#94a3b8" }}>{filter}</b> yet.<br />
            Creative agents are still researching · check back in a minute.
          </div>
        )}

        {/* Landscape cards · 2 columns on wide screens, 1 on narrow */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(480px, 1fr))", gap: 14 }}>
          {(payload?.ideas ?? []).map((idea) => {
            const isOpen = expanded === idea.idea_id;
            const colour = CATEGORY_COLORS[idea.category] ?? "#94a3b8";
            return (
              <div key={idea.idea_id} style={{
                background: "#111827", border: "1px solid #1e293b", borderLeft: `4px solid ${colour}`,
                borderRadius: 8, padding: 16, cursor: "pointer",
              }} onClick={() => setExpanded(isOpen ? null : idea.idea_id)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.3 }}>{idea.title}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: colour, fontFamily: "monospace", padding: "2px 6px", background: colour + "22", borderRadius: 3 }}>{idea.category}</span>
                    <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", padding: "2px 6px", background: "#1e293b", borderRadius: 3 }}>{idea.difficulty}·{idea.user_value}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6, fontStyle: "italic" }}>{idea.user_need}</div>
                <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5, marginBottom: isOpen ? 12 : 0 }}>{idea.description}</div>
                {isOpen && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #1e293b" }}>
                    <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Why missing today</div>
                    <div style={{ fontSize: 12, color: "#e2e8f0", marginBottom: 10 }}>{idea.why_missing}</div>
                    <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Engineering brief</div>
                    <div style={{ fontSize: 12, color: "#e2e8f0", marginBottom: 12, whiteSpace: "pre-wrap" }}>{idea.engineering_brief}</div>
                    <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Metadata</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", marginBottom: 12 }}>
                      generated by {idea.generated_by_agent} · difficulty {idea.difficulty} ({DIFFICULTY_LABEL[idea.difficulty] ?? "?"}) · user_value {idea.user_value} · status {idea.status}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {idea.status === "proposed" ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); void approve(idea); }}
                          disabled={busy === idea.idea_id}
                          style={{
                            background: busy === idea.idea_id ? "#312e81" : "#4c1d95", color: "#fff",
                            padding: "8px 14px", fontSize: 13, borderRadius: 4,
                            border: "1px solid #7c3aed", cursor: busy === idea.idea_id ? "wait" : "pointer",
                            fontWeight: 600,
                          }}
                        >{busy === idea.idea_id ? "Approving…" : "Approve & Copy Engineer Brief →"}</button>
                      ) : idea.status === "approved" ? (
                        <span style={{ fontSize: 12, color: "#4ade80" }}>approved · brief copied at {idea.copied_at?.slice(0,16)}</span>
                      ) : idea.status === "shipped" ? (
                        <span style={{ fontSize: 12, color: "#22d3ee" }}>shipped</span>
                      ) : (
                        <span style={{ fontSize: 12, color: "#64748b" }}>{idea.status}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal · shows engineering brief for copy */}
      {modalBrief && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex",
          alignItems: "center", justifyContent: "center", padding: 20, zIndex: 100,
        }} onClick={() => setModalBrief(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "#0f172a", border: "1px solid #4c1d95", borderRadius: 10,
            maxWidth: 900, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column",
          }}>
            <div style={{ padding: 16, borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, color: "#a78bfa", marginBottom: 2 }}>ENGINEERING BRIEF</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{modalBrief.title}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => void copyBrief()} style={{
                  background: copied ? "#166534" : "#4c1d95", color: "#fff", padding: "8px 14px",
                  fontSize: 13, borderRadius: 4, border: "1px solid " + (copied ? "#22c55e" : "#7c3aed"),
                  cursor: "pointer", fontWeight: 600,
                }}>{copied ? "✓ Copied!" : "Copy to clipboard"}</button>
                <button onClick={() => setModalBrief(null)} style={{
                  background: "#1e293b", color: "#cbd5e1", padding: "8px 14px", fontSize: 13,
                  borderRadius: 4, border: "1px solid #334155", cursor: "pointer",
                }}>Close</button>
              </div>
            </div>
            <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
              <pre style={{
                whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0,
                fontFamily: "'SF Mono', Monaco, Consolas, monospace", fontSize: 12,
                color: "#e2e8f0", lineHeight: 1.55,
              }}>{modalBrief.brief}</pre>
            </div>
            <div style={{ padding: 12, borderTop: "1px solid #1e293b", fontSize: 11, color: "#64748b", textAlign: "center" }}>
              Paste this brief to your engineer. When shipped, run: <code style={{ color: "#94a3b8" }}>UPDATE nex_lab.innovation_ideas SET status='shipped' WHERE idea_id=...</code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
