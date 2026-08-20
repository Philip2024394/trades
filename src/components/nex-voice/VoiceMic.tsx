// NEX Voice · Push-to-talk microphone component (prototype).
//
// Contract:
//   · Uses the browser voice provider (via getVoiceProvider()).
//   · Sends every final transcript to the SAME /api/nex-conv/chat endpoint
//     the text UI uses. No parallel pipeline. No parallel state.
//   · Persists NOTHING client-side · audio never touches disk.
//   · Fails gracefully: no-speech → "didn't catch that" spoken back.
//
// Prototype only. Not for customer-facing surfaces until a privacy-
// controlled STT provider (Groq Whisper Turbo / local whisper.cpp) is
// wired behind the same NexVoiceProvider interface.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getVoiceProvider, type NexVoiceProvider, type VoiceListenHandle } from "@/lib/nex-voice";

type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "error";

type Turn = {
  speaker: "customer" | "nex";
  text: string;
  intent?: string | null;
  entities?: string[];
  factsSnapshot?: Record<string, { value: string; provenance?: string }>;
};

type ChatResponse = {
  conversation_id: string;
  reply: string | null;
  understood_intent?: string | null;
  understood_entities?: string[];
  state_summary?: {
    established_facts?: Record<string, { value: string; provenance?: string }>;
    turn_count?: number;
  };
  error?: string;
};

const FALLBACK_MISHEARD = "I didn't quite catch that. Could you say it again?";
const FALLBACK_API_DOWN = "I'm having trouble hearing you right now. Give me a moment.";

export function VoiceMic() {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean>(true);

  const providerRef = useRef<NexVoiceProvider | null>(null);
  const handleRef = useRef<VoiceListenHandle | null>(null);

  useEffect(() => {
    try {
      const p = getVoiceProvider("browser");
      providerRef.current = p;
      setSupported(p.isSupported());
    } catch (e) {
      setSupported(false);
      setErrorMsg(String((e as Error)?.message ?? e));
    }
    return () => {
      handleRef.current?.stop();
      providerRef.current?.cancelSpeech();
    };
  }, []);

  const sendToNex = useCallback(async (text: string) => {
    setState("thinking");
    let res: ChatResponse | null = null;
    try {
      const r = await fetch("/api/nex-conv/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId ?? undefined,
          message: text,
        }),
      });
      res = (await r.json()) as ChatResponse;
    } catch (e) {
      setErrorMsg(String((e as Error)?.message ?? e));
    }

    if (!res || !res.reply) {
      setState("speaking");
      await providerRef.current?.speak(FALLBACK_API_DOWN);
      setState("idle");
      return;
    }

    if (res.conversation_id && !conversationId) setConversationId(res.conversation_id);

    setTurns(prev => [
      ...prev,
      { speaker: "customer", text },
      {
        speaker: "nex",
        text: res!.reply ?? "",
        intent: res!.understood_intent ?? null,
        entities: res!.understood_entities ?? [],
        factsSnapshot: res!.state_summary?.established_facts,
      },
    ]);

    setState("speaking");
    await providerRef.current?.speak(res.reply);
    setState("idle");
  }, [conversationId]);

  const handleFinal = useCallback(async (t: { text: string; confidence: number }) => {
    handleRef.current = null;
    const cleaned = (t.text ?? "").trim();
    if (!cleaned || t.confidence < 0.4) {
      setTranscript(cleaned);
      setState("speaking");
      await providerRef.current?.speak(FALLBACK_MISHEARD);
      setState("idle");
      return;
    }
    setTranscript(cleaned);
    await sendToNex(cleaned);
  }, [sendToNex]);

  const startListening = useCallback(() => {
    const p = providerRef.current;
    if (!p || !p.isSupported()) return;
    p.cancelSpeech();
    setTranscript("");
    setErrorMsg("");
    setState("listening");
    handleRef.current = p.listen({
      lang: "en-GB",
      onPartial: (t) => setTranscript(t.text),
      onFinal: (t) => void handleFinal(t),
      onError: (m) => {
        setErrorMsg(m);
        setState("error");
      },
    });
  }, [handleFinal]);

  const stopListening = useCallback(() => {
    handleRef.current?.stop();
    handleRef.current = null;
  }, []);

  const resetConversation = useCallback(() => {
    handleRef.current?.stop();
    providerRef.current?.cancelSpeech();
    setTurns([]);
    setTranscript("");
    setErrorMsg("");
    setConversationId(null);
    setState("idle");
  }, []);

  const buttonLabel = {
    idle:      "🎙  Hold to speak",
    listening: "● Listening… release to send",
    thinking:  "… NEX is thinking",
    speaking:  "🔊 NEX is speaking",
    error:     "⚠ Retry",
  }[state];

  const isDisabled = !supported || state === "thinking" || state === "speaking";

  // Push-to-talk (2026-08-20 fix): the button was previously click-to-toggle
  // but its label promises "Hold to speak". Now mousedown/touchstart begins
  // capture and mouseup/touchend/mouseleave ends it — matches label + more
  // natural voice UX (Discord / walkie-talkie style). onClick fallback kept
  // for keyboard / accessibility (Space or Enter triggers a short single
  // capture window).
  const beginCapture = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
    if (isDisabled) return;
    if (state !== "listening") startListening();
  }, [isDisabled, state, startListening]);
  const endCapture = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
    if (state === "listening") stopListening();
  }, [state, stopListening]);

  return (
    <div style={containerStyle}>
      {!supported && (
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
            // Keyboard / accessibility fallback: if the button was activated
            // by keyboard (Space/Enter), the mouseDown/mouseUp handlers won't
            // have fired. Toggle in that case.
            if ((e as any).detail === 0) {
              if (state === "listening") stopListening(); else startListening();
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
