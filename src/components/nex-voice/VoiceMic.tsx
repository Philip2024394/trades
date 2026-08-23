// NEX Voice · Push-to-talk microphone component (prototype UI).
//
// This is the developer prototype at /nex-voice-demo. It renders the
// classic hold-to-speak button + transcript pane. All orchestration
// (provider, state machine, STT, POST → /api/nex-conv/chat, TTS,
// conversation continuity) lives in the SHARED useNexVoice hook —
// same pipeline consumed by /nexapp. See feedback_nex_voice_pipeline_
// architecture 2026-08-21: one voice pipeline, brain-vs-voice split.
//
// This component is intentionally UI-only. If you find yourself adding
// listen/POST/TTS logic here, add it to useNexVoice instead.

"use client";

import { useCallback, useState } from "react";
import { useNexVoice, type NexReplyMeta } from "@/lib/nex-voice";

type Turn = {
  speaker: "customer" | "nex";
  text: string;
  intent?: string | null;
  entities?: string[];
  factsSnapshot?: Record<string, { value: string; provenance?: string }> | null;
};

export function VoiceMic() {
  const [transcript, setTranscript] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [turns, setTurns] = useState<Turn[]>([]);

  const voice = useNexVoice({
    // Priority 2 V2: prototype defaults to English but auto-adopts the
    // brain-detected language after the first turn (see useNexVoice
    // onLanguageChange). Explicit user toggle lives in NexAppHome, not
    // in this dev prototype.
    language: "en",
    onPartial: (t) => setTranscript(t),
    onUserFinal: (text) => {
      setTranscript(text);
      setTurns((prev) => [...prev, { speaker: "customer", text }]);
    },
    onNexReply: (reply, meta: NexReplyMeta) => {
      setTurns((prev) => [
        ...prev,
        {
          speaker: "nex",
          text: reply,
          intent: meta.intent,
          entities: meta.entities,
          factsSnapshot: meta.establishedFacts,
        },
      ]);
    },
    onError: (m) => setErrorMsg(m),
  });

  const { state, isSupported, conversationId, beginListen, endListen, reset } = voice;

  const resetConversation = useCallback(() => {
    reset();
    setTurns([]);
    setTranscript("");
    setErrorMsg("");
  }, [reset]);

  // Push-to-talk semantics (walkie-talkie style): mousedown/touchstart
  // begins capture, mouseup/touchend/mouseleave ends it. Keyboard
  // activation (Space / Enter, detail===0) toggles instead.
  const beginCapture = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
    if (state === "thinking" || state === "speaking") return;
    if (state !== "listening") beginListen();
  }, [state, beginListen]);

  const endCapture = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
    if (state === "listening") endListen();
  }, [state, endListen]);

  const buttonLabel = {
    idle:      "🎙  Hold to speak",
    listening: "● Listening… release to send",
    thinking:  "… NEX is thinking",
    speaking:  "🔊 NEX is speaking",
    error:     "⚠ Retry",
  }[state];

  const isDisabled = !isSupported || state === "thinking" || state === "speaking";

  return (
    <div style={containerStyle}>
      {!isSupported && (
        <div style={warnStyle}>
          Your browser doesn't support the Web Speech API. Try Chrome or Edge.
          {errorMsg && <div style={{ marginTop: 4, opacity: 0.8 }}>{errorMsg}</div>}
        </div>
      )}

      <div style={controlsStyle}>
        <button
          onMouseDown={beginCapture}
          onMouseUp={endCapture}
          onMouseLeave={state === "listening" ? endCapture : undefined}
          onTouchStart={beginCapture}
          onTouchEnd={endCapture}
          onClick={(e) => {
            if ((e as any).detail === 0) {
              if (state === "listening") endListen(); else beginListen();
            }
          }}
          disabled={isDisabled}
          style={{
            ...buttonStyle,
            background: state === "listening" ? "#c93030" : "#166534",
            opacity: isDisabled ? 0.6 : 1,
            userSelect: "none",
            touchAction: "manipulation",
          }}
        >
          {buttonLabel}
        </button>
        <button onClick={resetConversation} style={resetButtonStyle}>Reset conversation</button>
      </div>

      {transcript && (
        <div style={interimStyle}>
          <strong>Heard:</strong> {transcript}
        </div>
      )}

      {errorMsg && state === "error" && (
        <div style={warnStyle}>{errorMsg}</div>
      )}

      <div style={transcriptPaneStyle}>
        {turns.length === 0 && (
          <div style={{ opacity: 0.6, fontStyle: "italic" }}>
            No conversation yet. Click the mic and say something like &ldquo;I want an oak staircase.&rdquo;
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} style={t.speaker === "customer" ? customerBubbleStyle : nexBubbleStyle}>
            <div style={speakerLabelStyle}>{t.speaker === "customer" ? "You" : "NEX"}</div>
            <div>{t.text}</div>
            {t.speaker === "nex" && (t.intent || (t.entities && t.entities.length)) && (
              <div style={metaStyle}>
                intent: <code>{t.intent ?? "—"}</code>
                {t.entities && t.entities.length > 0 && (
                  <> · entities: <code>{t.entities.join(", ")}</code></>
                )}
              </div>
            )}
            {t.speaker === "nex" && t.factsSnapshot && Object.keys(t.factsSnapshot).length > 0 && (
              <div style={metaStyle}>
                state:
                {" "}
                {Object.entries(t.factsSnapshot).map(([k, v]) => (
                  <code key={k} style={{ marginRight: 6 }}>
                    {k}={v.value}{v.provenance ? ` [${v.provenance}]` : ""}
                  </code>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {conversationId && (
        <div style={metaFooterStyle}>conversation_id: <code>{conversationId}</code></div>
      )}
    </div>
  );
}

// ─── styles (inline · prototype only · no shared token dependency) ────

const containerStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "24px 20px",
  fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
  color: "#111",
};

const controlsStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  marginBottom: 16,
  flexWrap: "wrap",
};

const buttonStyle: React.CSSProperties = {
  color: "white",
  border: "none",
  borderRadius: 999,
  padding: "12px 22px",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  transition: "background 120ms, opacity 120ms",
};

const resetButtonStyle: React.CSSProperties = {
  background: "transparent",
  color: "#666",
  border: "1px solid #ccc",
  borderRadius: 999,
  padding: "10px 16px",
  fontSize: 13,
  cursor: "pointer",
};

const interimStyle: React.CSSProperties = {
  padding: "10px 14px",
  background: "#f4f4ef",
  borderRadius: 8,
  marginBottom: 12,
  fontSize: 14,
};

const warnStyle: React.CSSProperties = {
  padding: "10px 14px",
  background: "#fef3c7",
  border: "1px solid #f59e0b",
  borderRadius: 8,
  marginBottom: 12,
  fontSize: 13,
  color: "#78350f",
};

const transcriptPaneStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 8,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  maxHeight: 480,
  overflowY: "auto",
};

const bubbleBase: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  maxWidth: "85%",
  lineHeight: 1.45,
  fontSize: 14,
};

const customerBubbleStyle: React.CSSProperties = {
  ...bubbleBase,
  alignSelf: "flex-end",
  background: "#d4a574",
  color: "#1a1a1a",
};

const nexBubbleStyle: React.CSSProperties = {
  ...bubbleBase,
  alignSelf: "flex-start",
  background: "#f0f2ea",
  color: "#111",
};

const speakerLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  opacity: 0.6,
  marginBottom: 4,
};

const metaStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.7,
  marginTop: 6,
  fontFamily: "ui-monospace, Menlo, Consolas, monospace",
};

const metaFooterStyle: React.CSSProperties = {
  marginTop: 16,
  fontSize: 11,
  opacity: 0.5,
  fontFamily: "ui-monospace, Menlo, Consolas, monospace",
  textAlign: "center",
};
