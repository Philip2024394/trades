// src/app/nexapp/NexPolishedChat.tsx
//
// Founder 2026-09-10 · unified NEX chat surface — mounted at /nexapp.
//
// This is the canonical, fully-wired chat page. It was previously at
// /nex/chat (Founder Phase 7 · P7-1) but that URL is now redirected to
// /nexapp by middleware.ts and the polished component lives here.
//
// Feature list (every item is real, no mocks):
//   · SSE streaming from /api/nex-conv/chat  (token-by-token)
//   · Trust badges per reply (canonical_verified / evidence_verified /
//     evidence_provisional / honest_unknown / researched · cited /
//     provisional LLM · gated / availability_unknown)
//   · Cited sources rendered as clickable cards linking evidence
//   · Cross-domain intelligence card when the CDM meta fires
//   · Regenerate / Copy / Clear conversation controls
//   · Double-click-to-edit user messages · truncate downstream · resend
//     (preserves conversation_id so brain state carries over)
//   · Live Observatory ticker (doctrine health / LLM ratio / p50 / alerts)
//   · Fabrication Gate v2 alignment on every reply

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

// ═══════════════════════════════════════════════════════════════════
// Minimal SSE parser · reads text/event-stream from a Response body
// and dispatches (event, data) pairs to the handler. Never throws.
// ═══════════════════════════════════════════════════════════════════
async function readSse(res: Response, onEvent: (event: string, data: unknown) => void, signal?: AbortSignal): Promise<void> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\n\n/);
      buffer = frames.pop() ?? "";
      for (const f of frames) {
        let evt = "message";
        let data = "";
        for (const line of f.split(/\n/)) {
          if (line.startsWith("event:")) evt = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (!data) continue;
        try { onEvent(evt, JSON.parse(data)); }
        catch { onEvent(evt, data); }
      }
    }
  } catch { /* aborted or network · silent */ }
}

type TrustBand = "canonical_verified" | "canonical_unverified" | "evidence_verified" | "evidence_provisional" | "unknown" | "clarify" | "mixed";

interface CitedSource {
  title?: string;
  url?: string;
  source_type: string;
  trust_band: TrustBand;
  alignment_score?: number;
  verified_at?: string;
  snippet?: string;
}

interface CrossDomainMeta {
  fired: boolean;
  is_multi_domain?: boolean;
  domains?: string[];
  answered?: boolean;
  headline?: string;
  per_domain_hits?: Record<string, number>;
  temporal_hint?: string;
  temporal_parsed?: boolean;
}

interface CardHit {
  id?: string;
  name?: string;
  category?: string;
  region?: string;
  city?: string;
  image_url?: string;
  rating?: number;
  price_hint?: string;
  distance_km?: number;
}

interface CardPayload {
  slots?: Record<string, string | undefined>;
  insight?: { reason?: string; priority?: string };
  hits?: CardHit[];
}

interface EnvelopeCard {
  kind?: string;
  payload?: CardPayload;
}

interface Suggestion {
  label: string;
  href?: string;
}

interface TruthScore {
  overall: number;
  band: "verified" | "high" | "moderate" | "low" | "unknown";
  components?: Record<string, number>;
  policy?: string;
}

interface ChatEnvelope {
  conversation_id?: string;
  reply?: string;
  cited_sources?: CitedSource[];
  generated_images?: Array<{ url: string; alt?: string }>;
  card?: EnvelopeCard;
  suggestions?: Suggestion[];
  understood_intent?: string;
  intent?: string;
  intent_reason?: string;
  truth_score?: TruthScore;
  _debug_timings?: {
    lcc_adapter_reply?: { trust?: TrustBand; reply_kind?: string };
    cross_domain_meta?: CrossDomainMeta;
    llm_rescue_verdict?: { verified?: boolean; trust?: TrustBand };
    research_activated?: boolean;
    research_meta?: { fired?: boolean; answered?: boolean };
    deterministic_reply_promotion?: { accepted?: boolean };
  };
}

interface Turn {
  id: string;
  role: "user" | "nex";
  text: string;
  envelope?: ChatEnvelope;
  ts: string;
}

export default function NexPolishedChat() {
  const [conversationId, setConversationId] = useState<string>(() => crypto.randomUUID());
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticker, setTicker] = useState<{ overall_score?: number; llm_invoked_ratio?: number; p50?: number; alerts?: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length]);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/api/nex/observatory/snapshot?window=1h", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        setTicker({
          overall_score: j?.doctrine_health?.overall_score,
          llm_invoked_ratio: j?.latency?.llm_invoked_ratio,
          p50: j?.latency?.end_to_end_p50_ms,
          alerts: j?.alerts?.length ?? 0,
        });
      } catch { /* silent */ }
    };
    void load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, []);

  const abortRef = useRef<AbortController | null>(null);
  const [streaming, setStreaming] = useState<{ turn_id: string; text: string; envelope?: ChatEnvelope } | null>(null);

  const send = useCallback(async (message: string) => {
    if (!message.trim() || busy) return;
    setError(null);
    setBusy(true);
    const userTurn: Turn = { id: crypto.randomUUID(), role: "user", text: message, ts: new Date().toISOString() };
    setTurns((prev) => [...prev, userTurn]);
    const nexTurnId = crypto.randomUUID();
    const abort = new AbortController();
    abortRef.current = abort;
    let stopped = false;
    try {
      const res = await fetch("/api/nex-conv/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        body: JSON.stringify({ message, conversation_id: conversationId, market: "ID", useLiveWorld: true }),
        signal: abort.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("text/event-stream")) {
        let accumulated = "";
        let doneEnvelope: ChatEnvelope | undefined;
        setStreaming({ turn_id: nexTurnId, text: "" });
        await readSse(res, (event, data) => {
          if (event === "token" && data && typeof data === "object") {
            const chunk = (data as { chunk?: string }).chunk ?? "";
            if (chunk) {
              accumulated += chunk;
              setStreaming((prev) => prev ? { ...prev, text: accumulated } : { turn_id: nexTurnId, text: accumulated });
            }
          } else if (event === "done") {
            doneEnvelope = data as ChatEnvelope;
          }
        }, abort.signal);
        const finalText = doneEnvelope?.reply ?? accumulated;
        const nexTurn: Turn = {
          id: nexTurnId, role: "nex", text: String(finalText),
          envelope: doneEnvelope,
          ts: new Date().toISOString(),
        };
        setTurns((prev) => [...prev, nexTurn]);
        setStreaming(null);
      } else {
        const envelope: ChatEnvelope = await res.json();
        setTurns((prev) => [...prev, { id: nexTurnId, role: "nex", text: String(envelope.reply ?? ""), envelope, ts: new Date().toISOString() }]);
      }
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") {
        stopped = true;
        setStreaming((prev) => {
          if (prev) {
            setTurns((tPrev) => [...tPrev, { id: nexTurnId, role: "nex", text: prev.text + " (stopped)", ts: new Date().toISOString() }]);
          }
          return null;
        });
      } else {
        setError(e instanceof Error ? e.message : "send_failed");
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
      if (stopped) setStreaming(null);
    }
  }, [busy, conversationId]);

  const stopGeneration = () => { abortRef.current?.abort(); };
  const submit = (e: React.FormEvent) => { e.preventDefault(); void send(input); setInput(""); };

  const regenerateLast = () => {
    for (let i = turns.length - 1; i >= 0; i--) {
      if (turns[i].role === "user") {
        setTurns((prev) => prev.slice(0, i + 1).filter((_, idx) => idx <= i));
        void send(turns[i].text);
        return;
      }
    }
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const startEdit = (turnId: string, currentText: string) => {
    setEditingId(turnId);
    setEditText(currentText);
  };
  const commitEdit = () => {
    if (!editingId || !editText.trim()) { setEditingId(null); return; }
    const idx = turns.findIndex((t) => t.id === editingId);
    if (idx < 0) { setEditingId(null); return; }
    setTurns((prev) => prev.slice(0, idx));
    const text = editText;
    setEditingId(null);
    setEditText("");
    void send(text);
  };

  const clear = () => {
    setTurns([]);
    setConversationId(crypto.randomUUID());
    setError(null);
  };

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, letterSpacing: "-0.01em" }}>NEX Chat</h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.6 }}>
            Every reply carries sources. Every source is verifiable. Zero fabrication.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={regenerateLast} disabled={busy || turns.length === 0} style={buttonStyle}>
            Regenerate
          </button>
          <button onClick={clear} disabled={busy} style={buttonStyle}>
            Clear
          </button>
        </div>
      </header>

      <div style={transcriptStyle}>
        {turns.length === 0 && !error && (
          <div style={emptyStyle}>
            <WarmGreeting />
            <p style={{ margin: "12px 0 0", fontSize: 13, opacity: 0.65 }}>
              Try: <em>&ldquo;Find me a hotel with parking near a market and restaurant open tonight in Yogyakarta&rdquo;</em>
            </p>
            <p style={{ margin: "16px 0 0", fontSize: 12, opacity: 0.55, lineHeight: 1.6 }}>
              I answer with sources · never invent · always tell you when I don&rsquo;t know.
              Accommodation, food, transport, markets, travel, business.
            </p>
          </div>
        )}

        {turns.map((t) => (
          <div key={t.id} style={t.role === "user" ? userBubbleStyle : nexBubbleStyle}>
            {t.role === "nex" && <TrustBadge envelope={t.envelope} />}
            {t.role === "nex" && t.envelope?.truth_score && (
              <TruthScoreChip score={t.envelope.truth_score} />
            )}
            {t.role === "nex" && (t.envelope?.understood_intent || t.envelope?.intent) && (
              <IntentPill envelope={t.envelope} />
            )}
            {editingId === t.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  autoFocus
                  style={{ width: "100%", minHeight: 60, background: "#334155", color: "#fff", border: "1px solid #475569", borderRadius: 6, padding: 6, fontSize: 13, fontFamily: "inherit" }}
                />
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button onClick={() => setEditingId(null)} style={{ ...miniButtonStyle, background: "#334155", color: "#fff", borderColor: "#475569" }}>Cancel</button>
                  <button onClick={commitEdit} style={{ ...miniButtonStyle, background: "#0f172a", color: "#fff", borderColor: "#0f172a" }}>Save + resend</button>
                </div>
              </div>
            ) : (
              <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5, cursor: t.role === "user" && !busy ? "text" : "default" }}
                   onDoubleClick={() => t.role === "user" && !busy && startEdit(t.id, t.text)}
                   title={t.role === "user" && !busy ? "Double-click to edit" : undefined}
              >
                {t.text}
              </div>
            )}
            {t.envelope?._debug_timings?.cross_domain_meta?.fired && (
              <CrossDomainCard cdm={t.envelope._debug_timings.cross_domain_meta} />
            )}
            {t.role === "nex" && t.envelope?.card && Array.isArray(t.envelope.card.payload?.hits) && t.envelope.card.payload.hits.length > 0 && (
              <HitsCard card={t.envelope.card} />
            )}
            {t.role === "nex" && Array.isArray(t.envelope?.generated_images) && t.envelope.generated_images.length > 0 && (
              <ImagesRow images={t.envelope.generated_images} />
            )}
            {t.role === "nex" && Array.isArray(t.envelope?.suggestions) && t.envelope.suggestions.length > 0 && (
              <SuggestionsRow suggestions={t.envelope.suggestions} />
            )}
            {t.role === "nex" && Array.isArray(t.envelope?.cited_sources) && t.envelope.cited_sources.length > 0 && (
              <SourcesPanel sources={t.envelope.cited_sources} />
            )}
            {t.role === "nex" && (
              <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                <button
                  onClick={() => void navigator.clipboard.writeText(t.text)}
                  style={miniButtonStyle}
                  title="Copy reply text"
                >
                  Copy
                </button>
                {t.envelope?.conversation_id && (
                  <span style={{ fontSize: 11, opacity: 0.5, alignSelf: "center", marginLeft: 8, fontFamily: "monospace" }}>
                    {t.envelope.conversation_id.slice(0, 8)}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {streaming && (
          <div style={{ ...nexBubbleStyle, position: "relative" }}>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5 }}>
              {streaming.text}
              <span style={{ display: "inline-block", width: 6, height: 14, background: "#0f172a", marginLeft: 2, animation: "blink 1s infinite" }} />
            </div>
            <button onClick={stopGeneration} style={{ ...miniButtonStyle, marginTop: 6 }}>Stop</button>
          </div>
        )}
        {busy && !streaming && <div style={{ ...nexBubbleStyle, opacity: 0.6, fontStyle: "italic" }}>NEX is thinking&hellip;</div>}
        {error && (
          <div style={{ ...cardStyle, borderColor: "#b91c1c", background: "#fef2f2", fontSize: 13 }}>
            <strong>Error:</strong> {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} style={formStyle}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask NEX&hellip;"
          style={inputStyle}
          disabled={busy}
          autoFocus
        />
        <button type="submit" disabled={busy || !input.trim()} style={sendButtonStyle}>
          Send
        </button>
      </form>

      <style>{`
        @keyframes blink { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }
      `}</style>
      {ticker && (
        <footer style={tickerStyle}>
          <span style={{ ...tickerPillStyle, background: ticker.overall_score === 1 ? "#10b981" : "#f59e0b" }}>
            doctrine {ticker.overall_score?.toFixed(3)}
          </span>
          <span style={{ opacity: 0.7 }}>llm-invoked {(ticker.llm_invoked_ratio ?? 0).toFixed(3)}</span>
          <span style={{ opacity: 0.7 }}>p50 {ticker.p50 ?? "—"} ms</span>
          <span style={{ opacity: 0.7 }}>alerts {ticker.alerts ?? 0}</span>
          <span style={{ marginLeft: "auto", opacity: 0.55 }}>
            <Link href="/nex/observatory" style={{ color: "inherit", textDecoration: "none" }}>observatory &rarr;</Link>
          </span>
        </footer>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════

function TrustBadge({ envelope }: { envelope?: ChatEnvelope }) {
  const dbg = envelope?._debug_timings;
  const promoted = dbg?.deterministic_reply_promotion?.accepted;
  const rescued = dbg?.llm_rescue_verdict?.verified;
  const research = dbg?.research_activated;
  const adapterTrust = dbg?.lcc_adapter_reply?.trust;
  const rescueTrust = dbg?.llm_rescue_verdict?.trust;

  let label = "unknown";
  let bg = "#94a3b8";
  if (promoted && adapterTrust === "canonical_verified") { label = "verified · from records"; bg = "#10b981"; }
  else if (promoted && adapterTrust === "evidence_verified") { label = "evidence-verified"; bg = "#10b981"; }
  else if (promoted && adapterTrust === "evidence_provisional") { label = "evidence-provisional"; bg = "#f59e0b"; }
  else if (promoted && dbg?.lcc_adapter_reply?.reply_kind === "availability_unknown") { label = "availability unknown (honest)"; bg = "#0ea5e9"; }
  else if (rescued && rescueTrust === "evidence_provisional") { label = "provisional (LLM · gated)"; bg = "#f59e0b"; }
  else if (research) { label = "researched · cited"; bg = "#0ea5e9"; }
  else if (dbg?.lcc_adapter_reply?.reply_kind === "unknown") { label = "honest unknown"; bg = "#64748b"; }

  return (
    <span style={{
      display: "inline-block",
      padding: "1px 8px",
      borderRadius: 4,
      color: "#fff",
      fontSize: 10.5,
      letterSpacing: "0.03em",
      textTransform: "uppercase",
      background: bg,
      marginBottom: 6,
      fontWeight: 600,
    }}>{label}</span>
  );
}

// Client-side tone profile · reads NEXT_PUBLIC_NEX_TONE_PROFILE.
// Default = "balanced". Values: "warm_friend" · "balanced" · "formal_pro".
function clientToneProfile(): "warm_friend" | "balanced" | "formal_pro" {
  const raw = (process.env.NEXT_PUBLIC_NEX_TONE_PROFILE ?? "balanced").toLowerCase();
  if (raw === "warm_friend" || raw === "warm" || raw === "friend") return "warm_friend";
  if (raw === "formal_pro" || raw === "formal" || raw === "pro") return "formal_pro";
  return "balanced";
}

function WarmGreeting() {
  const profile = clientToneProfile();
  const now = new Date();
  const hour = now.getHours();
  const seg = hour >= 5 && hour < 12 ? "morning"
            : hour >= 12 && hour < 17 ? "afternoon"
            : hour >= 17 && hour < 22 ? "evening"
            : "night";

  const messages: Record<typeof profile, Record<typeof seg, string>> = {
    warm_friend: {
      morning:   "Morning — coffee's on. What are we looking at?",
      afternoon: "Hey — what's the play?",
      evening:   "Evening. What's up?",
      night:     "Late one? What can I help with?",
    },
    balanced: {
      morning:   "Good morning. What can I help you find?",
      afternoon: "Good afternoon. What can I help you find?",
      evening:   "Good evening. What are you looking for?",
      night:     "Hi. What can I help with?",
    },
    formal_pro: {
      morning:   "Good morning. How may I assist you today?",
      afternoon: "Good afternoon. How may I assist?",
      evening:   "Good evening. How may I help?",
      night:     "Good evening. How may I assist?",
    },
  };
  return (
    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "#0f172a", fontWeight: 500 }}>
      {messages[profile][seg]}
    </p>
  );
}

function TruthScoreChip({ score }: { score: TruthScore }) {
  const bandColors: Record<TruthScore["band"], { bg: string; fg: string; label: string }> = {
    verified:  { bg: "#dcfce7", fg: "#166534", label: "verified" },
    high:      { bg: "#dbeafe", fg: "#1e40af", label: "high trust" },
    moderate:  { bg: "#fef3c7", fg: "#92400e", label: "moderate trust" },
    low:       { bg: "#fee2e2", fg: "#991b1b", label: "low trust" },
    unknown:   { bg: "#f1f5f9", fg: "#334155", label: "unknown trust" },
  };
  const c = bandColors[score.band] ?? bandColors.unknown;
  const pct = Math.round((score.overall ?? 0) * 100);
  return (
    <span
      style={{
        display: "inline-block", marginLeft: 6, marginBottom: 6,
        padding: "1px 8px", borderRadius: 4,
        background: c.bg, color: c.fg,
        fontSize: 10, letterSpacing: "0.03em", textTransform: "uppercase",
        fontWeight: 700,
      }}
      title={`Truth score ${pct}% · ${score.policy ?? ""}`}
    >
      {c.label} {pct}%
    </span>
  );
}

function IntentPill({ envelope }: { envelope: ChatEnvelope }) {
  const intent = envelope.understood_intent ?? envelope.intent;
  if (!intent) return null;
  return (
    <span style={{
      display: "inline-block", marginLeft: 6, marginBottom: 6,
      padding: "1px 8px", borderRadius: 4,
      background: "#e2e8f0", color: "#334155",
      fontSize: 10, letterSpacing: "0.03em", textTransform: "uppercase", fontWeight: 500,
    }} title={envelope.intent_reason ?? ""}>
      understood as {intent}
      {envelope.intent_reason && <span style={{ opacity: 0.6, marginLeft: 4 }}>&middot; {envelope.intent_reason}</span>}
    </span>
  );
}

function CrossDomainCard({ cdm }: { cdm: CrossDomainMeta }) {
  return (
    <div style={{
      marginTop: 8, padding: "8px 10px",
      border: "1px solid #dbeafe", borderRadius: 6,
      background: "#eff6ff", fontSize: 12,
    }}>
      <div style={{ fontWeight: 600, color: "#1d4ed8", marginBottom: 2 }}>Cross-domain intelligence</div>
      <div style={{ opacity: 0.85 }}>{cdm.headline}</div>
    </div>
  );
}

// Founder 2026-09-10 · card renderer — surfaces the real hits the
// brain orchestrator returned in `card.payload.hits`, even when the
// LLM rescue reply text is weak. This is the single biggest UX gap
// closed in the current pass: the envelope had hotels, the UI ignored
// them.
function HitsCard({ card }: { card: EnvelopeCard }) {
  const hits = card.payload?.hits ?? [];
  const kindLabel = (card.kind ?? "results").replace(/_/g, " ");
  const insight = card.payload?.insight?.reason;
  return (
    <div style={{
      marginTop: 10, padding: "10px 12px",
      border: "1px solid #bae6fd", borderRadius: 8,
      background: "#f0f9ff",
    }}>
      <div style={{
        fontSize: 11, opacity: 0.7, textTransform: "uppercase",
        letterSpacing: "0.06em", marginBottom: 6, color: "#0369a1", fontWeight: 600,
      }}>
        {kindLabel} · {hits.length} result{hits.length === 1 ? "" : "s"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {hits.slice(0, 8).map((h, i) => (
          <div key={h.id ?? i} style={{
            display: "flex", gap: 10, alignItems: "center",
            padding: "6px 8px", background: "#fff",
            border: "1px solid #e0f2fe", borderRadius: 6,
          }}>
            {h.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={h.image_url} alt={h.name ?? ""}
                   style={{ width: 40, height: 40, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{
                width: 40, height: 40, borderRadius: 4, flexShrink: 0,
                background: "#e0f2fe", display: "grid", placeItems: "center",
                fontSize: 14, color: "#0369a1", fontWeight: 700,
              }}>{(h.name ?? "?").charAt(0).toUpperCase()}</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {h.name ?? "(unnamed)"}
              </div>
              <div style={{ fontSize: 11, opacity: 0.7, color: "#334155" }}>
                {[h.region ?? h.city, h.category?.replace(/^accommodation\./, "")]
                  .filter(Boolean).join(" · ")}
                {typeof h.rating === "number" && ` · ★ ${h.rating.toFixed(1)}`}
                {h.price_hint && ` · ${h.price_hint}`}
              </div>
            </div>
          </div>
        ))}
      </div>
      {insight && (
        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7, color: "#0369a1", fontStyle: "italic" }}>
          {insight.replace(/_/g, " ")}
        </div>
      )}
    </div>
  );
}

function SuggestionsRow({ suggestions }: { suggestions: Suggestion[] }) {
  return (
    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
      {suggestions.map((s, i) => {
        const chipStyle: React.CSSProperties = {
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "4px 10px", borderRadius: 999,
          border: "1px solid #cbd5e1", background: "#fff",
          fontSize: 12, color: "#0f172a", cursor: "pointer",
          textDecoration: "none",
        };
        if (s.href) {
          return <Link key={i} href={s.href} style={chipStyle}>{s.label} &rarr;</Link>;
        }
        return <span key={i} style={chipStyle}>{s.label}</span>;
      })}
    </div>
  );
}

function ImagesRow({ images }: { images: Array<{ url: string; alt?: string }> }) {
  return (
    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
      {images.slice(0, 4).map((img, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={img.url} alt={img.alt ?? ""}
             style={{
               width: 120, height: 120, borderRadius: 6, objectFit: "cover",
               border: "1px solid #e5e7eb",
             }} />
      ))}
    </div>
  );
}

function SourcesPanel({ sources }: { sources: CitedSource[] }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        Sources ({sources.length})
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {sources.slice(0, 8).map((s, i) => {
          const isVerifiable = s.url || s.source_type === "question_variant";
          const inner = (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 8px", border: "1px solid #e5e7eb", borderRadius: 6,
              background: "#f8fafc", fontSize: 12,
              color: "#1e293b", cursor: isVerifiable ? "pointer" : "default",
            }}>
              <span style={{ opacity: 0.55 }}>{i + 1}.</span>
              <span>{s.title ?? s.source_type}</span>
              {typeof s.alignment_score === "number" && (
                <span style={{ opacity: 0.65 }}>&middot; align {s.alignment_score.toFixed(2)}</span>
              )}
              <span style={{ opacity: 0.65 }}>&middot; {s.trust_band}</span>
            </span>
          );
          if (s.url) {
            return <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>{inner}</a>;
          }
          return <span key={i}>{inner}</span>;
        })}
      </div>
      <div style={{ marginTop: 6, fontSize: 11, opacity: 0.55 }}>
        Every reply is validated by Fabrication Gate v2 alignment.
        Browse the full evidence catalog at{" "}
        <Link href="/nex/evidence" style={{ color: "#1d4ed8", textDecoration: "none" }}>/nex/evidence</Link>.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════

const pageStyle: React.CSSProperties = {
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  maxWidth: 860,
  margin: "0 auto",
  minHeight: "100vh",
  padding: "20px 24px 100px",
  color: "#0f172a",
  display: "flex",
  flexDirection: "column",
};
const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  paddingBottom: 12,
  borderBottom: "1px solid #e5e7eb",
};
const transcriptStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "16px 0",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};
const userBubbleStyle: React.CSSProperties = {
  alignSelf: "flex-end",
  maxWidth: "78%",
  padding: "10px 14px",
  borderRadius: 12,
  borderBottomRightRadius: 4,
  background: "#0f172a",
  color: "#fff",
  fontSize: 14,
  lineHeight: 1.4,
};
const nexBubbleStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  maxWidth: "88%",
  padding: "12px 14px",
  borderRadius: 12,
  borderBottomLeftRadius: 4,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontSize: 14,
  lineHeight: 1.5,
};
const emptyStyle: React.CSSProperties = { padding: "40px 20px", opacity: 0.7 };
const cardStyle: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, background: "#fff", marginTop: 10 };
const formStyle: React.CSSProperties = {
  position: "sticky",
  bottom: 0,
  display: "flex",
  gap: 8,
  padding: "12px 0",
  background: "linear-gradient(180deg, transparent 0%, #fff 25%)",
};
const inputStyle: React.CSSProperties = {
  flex: 1, padding: "10px 14px", borderRadius: 10,
  border: "1px solid #cbd5e1", background: "#fff", fontSize: 14, outline: "none",
};
const sendButtonStyle: React.CSSProperties = {
  padding: "10px 16px", borderRadius: 10, border: "1px solid #0f172a",
  background: "#0f172a", color: "#fff", fontSize: 14, cursor: "pointer", fontWeight: 600,
};
const buttonStyle: React.CSSProperties = {
  padding: "6px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#f8fafc",
  fontSize: 12, cursor: "pointer",
};
const miniButtonStyle: React.CSSProperties = {
  padding: "3px 8px", borderRadius: 4, border: "1px solid #e5e7eb", background: "#fff",
  fontSize: 11, cursor: "pointer", color: "#334155",
};
const tickerStyle: React.CSSProperties = {
  position: "fixed", bottom: 0, left: 0, right: 0,
  padding: "6px 24px", background: "#f8fafc",
  borderTop: "1px solid #e5e7eb", fontSize: 11,
  display: "flex", gap: 10, alignItems: "center",
};
const tickerPillStyle: React.CSSProperties = {
  display: "inline-block", padding: "1px 8px", borderRadius: 4,
  color: "#fff", fontSize: 10, letterSpacing: "0.03em", textTransform: "uppercase", fontWeight: 600,
};
