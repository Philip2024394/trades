// src/components/nex1/Nex1WorkstationChat.tsx
//
// NEX1 · Workstation Chat UI · Fix 24 · 2026-09-17.
// Founder-authorised.
//
// EXPLICIT ROUTING · This component talks ONLY to /api/nex1/chat/turn
// (non-streaming) OR /api/nex1/chat/turn/stream (SSE · K11 · 2026-09-21).
// It NEVER imports from src/lib/nex/brain/*.
// It NEVER imports any inference client.
// It NEVER falls back to a consumer LLM provider.
//
// The purpose of this component is to give the workstation a chat surface
// whose destination is unmistakable from a code review: NEX1 native runtime,
// nothing else.
//
// Every reply message is tagged with `source: "NEX1_NATIVE"` returned by
// the API, so telemetry can prove where the response came from.
//
// K11 · 2026-09-21 · Streaming UX. When streaming is enabled, the SSE route
// emits REAL native stage events as they happen (classifier, recall_dispatch,
// investigation_start/done, composer, etc.). The UI shows a live list of
// stages as they arrive — NEVER simulated typing, NEVER fake progress bars.
// A terminal `done` frame replaces the streaming display with the final
// answer + evidence badge · identical to the non-streaming payload.

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

// ── Types (mirror the /api/nex1/chat/turn response · tolerant of extensions) ──

// Wave C · 2026-09-20 · Evidence-Status UI types.
// Mirrors the runtime shape from `capability-evidence-status.ts`. UI must
// NEVER upgrade `unconfirmed` to `confirmed`, NEVER fabricate a badge when
// runtime returns null, NEVER silently hide `disagreements[]`. UI is a
// faithful presentation of what the runtime already knows.
interface EvidenceSource {
  readonly kind: string;
  readonly identifier: string;
  readonly reliability: "authoritative" | "established" | "unknown";
  readonly retrieved_at_iso?: string;
  readonly duration_ms?: number;
}
interface EvidenceStatus {
  readonly level: "confirmed" | "unconfirmed" | "own_record";
  readonly label: string;
  readonly basis: readonly string[];
  readonly sources: readonly EvidenceSource[];
  readonly disagreements: readonly string[];
}

interface ChatTurnResponse {
  readonly ok: boolean;
  readonly source?: "NEX1_NATIVE" | string;
  readonly text?: string;
  readonly state?: string;
  readonly turn_id?: number;
  readonly zero_llm?: boolean;
  readonly error?: string;
  readonly evidence_status?: EvidenceStatus | null;
  readonly sources?: readonly EvidenceSource[];
}

interface ChatMessage {
  readonly id: string;
  readonly sender: "user" | "nex1" | "system";
  readonly text: string;
  readonly time: string;
  readonly state?: string;
  readonly source?: string;
  readonly zero_llm?: boolean;
  readonly evidence_status?: EvidenceStatus | null;
  // K11 · streaming state · live stage events as they arrive from the SSE
  // route. Empty for non-streaming responses. Final `done` clears this.
  readonly stages?: readonly string[];
  readonly streaming?: boolean;
}

interface Nex1WorkstationChatProps {
  readonly conversationId?: string;
  readonly showTrace?: boolean;
  // K11 · 2026-09-21 · When true (default), consume the SSE route so live
  // stage events surface in the UI as they happen. When false, use the
  // one-shot JSON route (previous behaviour).
  readonly streaming?: boolean;
}

function nowClock(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Wave C · Evidence-Status UI ────────────────────────────────────────
//
// Founder principle: UI never stronger than the underlying evidence state.
//   · runtime null  → no badge (NOT a green default)
//   · runtime unconfirmed → 🟠 FACT 0 (NOT upgraded)
//   · runtime confirmed → 🟢 FACT ✓
//   · runtime own_record → 🔵 NEX KNOWS
//   · runtime disagreements[] → visible inline (NOT hidden in tooltip)
//   · runtime sources[] → identifiers listed (NOT collapsed to anonymous)
//
// The badge is a pure presentation of `evidence_status`. It does not derive,
// infer, or fabricate. Data-attributes are exposed so external probes can
// verify the rendered level matches the runtime level byte-for-byte.

export function EvidenceBadge(props: { status: EvidenceStatus | null | undefined }): React.ReactElement | null {
  const status = props.status;
  if (!status || !status.level) return null;
  const configByLevel: Record<EvidenceStatus["level"], { color: string; bg: string; emoji: string; label: string }> = {
    confirmed:   { color: "#10b981", bg: "#052e1a", emoji: "🟢", label: "FACT ✓" },
    unconfirmed: { color: "#f59e0b", bg: "#2e1d05", emoji: "🟠", label: "FACT 0" },
    own_record:  { color: "#3b82f6", bg: "#0a1e42", emoji: "🔵", label: "NEX KNOWS" },
  };
  const c = configByLevel[status.level];
  if (!c) return null;
  const sourceCount = status.sources?.length ?? 0;
  const disagreementCount = status.disagreements?.length ?? 0;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "1px 8px",
        borderRadius: 12,
        background: c.bg,
        border: `1px solid ${c.color}`,
        color: c.color,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 0.2,
      }}
      data-nex-evidence-level={status.level}
      data-nex-evidence-label={c.label}
      data-nex-source-count={sourceCount}
      data-nex-disagreement-count={disagreementCount}
      title={(status.basis ?? []).join(" · ")}
    >
      <span>{c.emoji}</span>
      <span>{c.label}</span>
      {sourceCount > 0 ? <span style={{ opacity: 0.7 }}>· {sourceCount} src</span> : null}
      {disagreementCount > 0 ? <span style={{ color: "#fecaca" }}>· ⚠ {disagreementCount}</span> : null}
    </div>
  );
}

export function EvidenceDetails(props: { status: EvidenceStatus | null | undefined }): React.ReactElement | null {
  const status = props.status;
  if (!status || !status.level) return null;
  const disagreements = status.disagreements ?? [];
  const sources = status.sources ?? [];
  if (disagreements.length === 0 && sources.length === 0) return null;
  return (
    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
      {disagreements.length > 0 ? (
        <div
          style={{
            padding: "4px 8px",
            background: "#2e1d05",
            borderLeft: "2px solid #f59e0b",
            fontSize: 11,
            color: "#fef3c7",
            borderRadius: 4,
          }}
          data-nex-evidence-disagreements={disagreements.length}
        >
          {disagreements.map((d, i) => (
            <div key={i}>⚠ {d}</div>
          ))}
        </div>
      ) : null}
      {sources.length > 0 ? (
        <div
          style={{ fontSize: 10, opacity: 0.65 }}
          data-nex-evidence-sources={sources.map((s) => s.identifier).join(",")}
        >
          Sources: {sources.map((s) => `${s.identifier} (${s.reliability})`).join(" · ")}
        </div>
      ) : null}
    </div>
  );
}

// ── K11 · SSE frame parser ────────────────────────────────────────────
//
// Minimal SSE parser that splits a growing text buffer into complete
// `event: <name>\ndata: <json>\n\n` frames and returns any residual bytes.
// Handles the case where a frame arrives split across chunks.
function parseSseFrames(buffer: string): { frames: { event: string; data: unknown }[]; rest: string } {
  const frames: { event: string; data: unknown }[] = [];
  let rest = buffer;
  while (true) {
    const end = rest.indexOf("\n\n");
    if (end === -1) break;
    const frame = rest.slice(0, end);
    rest = rest.slice(end + 2);
    const lines = frame.split("\n");
    let event = "message";
    let dataStr = "";
    for (const line of lines) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
    }
    let data: unknown = null;
    try { data = JSON.parse(dataStr); } catch { data = { raw: dataStr }; }
    frames.push({ event, data });
  }
  return { frames, rest };
}

// K11 · humanise the raw stage event name into a compact live label.
// The kinds emitted by capability-chat-turn.ts are documented in the SSE
// route header comments. Anything we haven't mapped falls back to the raw
// name — honesty over prettiness.
function stageLabel(event: string, data: unknown): string | null {
  const d = (data ?? {}) as Record<string, unknown>;
  switch (event) {
    case "hello": return null; // internal readiness handshake
    case "done":  return null; // handled separately
    case "error": return null;
    case "classifier": {
      const kind = typeof d.kind === "string" ? d.kind : "?";
      const family = typeof d.verb_family === "string" ? ` · ${d.verb_family}` : "";
      return `classifier · ${kind}${family}`;
    }
    case "recall_dispatch": {
      const kind = typeof d.recall_kind === "string" ? d.recall_kind : "?";
      return `recall · ${kind}`;
    }
    case "coding_loop_start": return "coding loop · start";
    case "coding_loop_stage": {
      const stage = typeof d.stage === "string" ? d.stage : "?";
      return `coding · ${stage}`;
    }
    case "coding_loop_done": return "coding loop · done";
    case "investigation_start": return "investigating…";
    case "investigation_done": return "investigation · done";
    case "composer": {
      const state = typeof d.state === "string" ? d.state : "?";
      return `composer · ${state}`;
    }
    default: return event;
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export function Nex1WorkstationChat(props: Nex1WorkstationChatProps = {}): React.ReactElement {
  const streamingEnabled = props.streaming !== false;
  const conversationIdRef = useRef<string>(props.conversationId ?? `conv-${Date.now().toString(36)}`);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "nex1-greeting",
      sender: "nex1",
      text: "NEX1 native workstation channel is active. Zero-LLM native runtime. Ask about a file, an investigation, or a coding task.",
      time: nowClock(),
      state: "understood",
      source: "NEX1_NATIVE",
      zero_llm: true,
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages]);

  const sendStreaming = useCallback(async (trimmed: string): Promise<void> => {
    const streamingMsgId = newId("n");
    // Seed the streaming message so the UI shows a growing stage list
    // rather than a static "thinking…" placeholder.
    setMessages((prev) => [
      ...prev,
      {
        id: streamingMsgId,
        sender: "nex1",
        text: "",
        time: nowClock(),
        source: "NEX1_NATIVE",
        zero_llm: true,
        stages: [],
        streaming: true,
      },
    ]);
    const resp = await fetch("/api/nex1/chat/turn/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: conversationIdRef.current,
        message: trimmed,
      }),
    });
    if (!resp.ok || !resp.body) {
      throw new Error(`stream HTTP ${resp.status}`);
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let terminal: ChatTurnResponse | null = null;
    let streamError: string | null = null;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseFrames(buffer);
      buffer = parsed.rest;
      for (const f of parsed.frames) {
        if (f.event === "done") {
          terminal = f.data as ChatTurnResponse;
        } else if (f.event === "error") {
          const d = (f.data ?? {}) as { message?: string };
          streamError = d.message ?? "stream error";
        } else {
          const label = stageLabel(f.event, f.data);
          if (label) {
            setMessages((prev) => prev.map((m) => (m.id === streamingMsgId
              ? { ...m, stages: [...(m.stages ?? []), label] }
              : m)));
          }
        }
      }
    }
    if (streamError) throw new Error(streamError);
    if (!terminal) throw new Error("stream ended without a done frame");
    setMessages((prev) => prev.map((m) => (m.id === streamingMsgId
      ? {
          ...m,
          text: terminal!.text ?? "(no text returned)",
          state: terminal!.state,
          source: terminal!.source,
          zero_llm: terminal!.zero_llm,
          evidence_status: terminal!.evidence_status ?? null,
          streaming: false,
        }
      : m)));
  }, []);

  const sendOneShot = useCallback(async (trimmed: string): Promise<void> => {
    const resp = await fetch("/api/nex1/chat/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: conversationIdRef.current,
        message: trimmed,
      }),
    });
    const data = (await resp.json()) as ChatTurnResponse;
    if (!data.ok) {
      setError(data.error ?? "unknown error");
    }
    setMessages((prev) => [
      ...prev,
      {
        id: newId("n"),
        sender: "nex1",
        text: data.text ?? "(no text returned)",
        time: nowClock(),
        state: data.state,
        source: data.source,
        zero_llm: data.zero_llm,
        evidence_status: data.evidence_status ?? null,
      },
    ]);
  }, []);

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { id: newId("u"), sender: "user", text: trimmed, time: nowClock() }]);
    setSending(true);
    try {
      if (streamingEnabled) {
        await sendStreaming(trimmed);
      } else {
        await sendOneShot(trimmed);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMessages((prev) => [
        ...prev,
        {
          id: newId("sys"),
          sender: "system",
          text: `Chat channel error: ${e instanceof Error ? e.message : String(e)}`,
          time: nowClock(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, streamingEnabled, sendStreaming, sendOneShot]);

  const onKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void send();
      }
    },
    [send],
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: 640,
        background: "#0a0a0a",
        color: "#e8e8e8",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        border: "1px solid #262626",
        borderRadius: 12,
        overflow: "hidden",
      }}
      data-nex1-chat-channel="native"
      data-nex1-chat-route={streamingEnabled ? "/api/nex1/chat/turn/stream" : "/api/nex1/chat/turn"}
      data-nex1-chat-streaming={streamingEnabled ? "true" : "false"}
    >
      <header
        style={{
          padding: "10px 14px",
          background: "#111",
          borderBottom: "1px solid #262626",
          fontSize: 13,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>NEX1 · workstation · <span style={{ opacity: 0.6 }}>native runtime · zero LLM{streamingEnabled ? " · streaming" : ""}</span></div>
        <div style={{ opacity: 0.55, fontSize: 11 }}>route: {streamingEnabled ? "/api/nex1/chat/turn/stream" : "/api/nex1/chat/turn"}</div>
      </header>
      <div
        ref={scrollerRef}
        style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.sender === "user" ? "flex-end" : m.sender === "system" ? "center" : "flex-start",
              maxWidth: "82%",
              padding: "8px 12px",
              borderRadius: 10,
              background:
                m.sender === "user" ? "#1e293b" : m.sender === "system" ? "#3b0e0e" : "#1a1a1a",
              border: "1px solid #262626",
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            {m.sender === "nex1" && m.evidence_status ? (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                <EvidenceBadge status={m.evidence_status} />
              </div>
            ) : null}
            {m.sender === "nex1" && m.streaming && (m.stages ?? []).length > 0 ? (
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.75,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  color: "#93c5fd",
                  paddingBottom: 4,
                }}
                data-nex-live-stages={(m.stages ?? []).length}
              >
                {(m.stages ?? []).map((s, i) => (
                  <div key={i}>· {s}</div>
                ))}
              </div>
            ) : null}
            <div style={{ whiteSpace: "pre-wrap" }}>{m.text}{m.streaming && !m.text ? <span style={{ opacity: 0.5 }}>·</span> : null}</div>
            {m.sender === "nex1" ? <EvidenceDetails status={m.evidence_status} /> : null}
            <div style={{ marginTop: 4, fontSize: 10, opacity: 0.55 }}>
              {m.sender === "nex1"
                ? `NEX1 · ${m.time}${m.state ? " · " + m.state : ""}${m.source ? " · " + m.source : ""}${m.zero_llm ? " · zero-LLM" : ""}`
                : m.sender === "user"
                  ? `You · ${m.time}`
                  : `system · ${m.time}`}
            </div>
          </div>
        ))}
        {sending ? (
          <div style={{ alignSelf: "flex-start", fontSize: 12, opacity: 0.55, padding: "4px 8px" }}>NEX1 thinking…</div>
        ) : null}
      </div>
      {error ? (
        <div style={{ background: "#3b0e0e", color: "#fecaca", padding: "6px 12px", fontSize: 12 }}>
          {error}
        </div>
      ) : null}
      <footer style={{ borderTop: "1px solid #262626", padding: "10px 12px", background: "#111" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask NEX1…"
            rows={2}
            style={{
              flex: 1,
              background: "#0a0a0a",
              color: "#e8e8e8",
              border: "1px solid #262626",
              borderRadius: 8,
              padding: "8px 10px",
              fontFamily: "inherit",
              fontSize: 14,
              resize: "vertical",
              outline: "none",
            }}
          />
          <button
            onClick={send}
            disabled={sending || input.trim().length === 0}
            style={{
              padding: "10px 16px",
              background: sending ? "#1a1a1a" : "#166534",
              color: "#e8e8e8",
              border: "1px solid #262626",
              borderRadius: 8,
              cursor: sending ? "wait" : "pointer",
              fontSize: 14,
            }}
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      </footer>
    </div>
  );
}

export default Nex1WorkstationChat;
