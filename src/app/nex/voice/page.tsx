// src/app/nex/voice/page.tsx
//
// Founder Phase 21 · P21-2 · Voice + live conversation UI.
//
// Two modes:
//   · Push-to-talk · click, speak, release · single turn
//   · Live conversation · VAD auto-stops after silence, plays reply, loops
//
// Uses MediaRecorder + Web Audio API for recording + VAD.
// Uses /api/nex/voice/live-round-trip for the one-shot STT→chat→TTS RPC.
//
// Doctrines active:
//   voice input never establishes truth
//   voice output never establishes truth
//   Doctrine #5 sanitiser preserved end-to-end

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createRecorder, type RecorderHandle } from "@/lib/nex/voice-ui/recorder";

type Turn = {
  role: "user" | "assistant";
  content: string;
  audio_url?: string | null;
  provenance?: Array<{ kind: string; ref_id: string; provider: string; doctrine_note: string }>;
};

export default function VoicePage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Idle · click the mic to speak");
  const [level, setLevel] = useState(0);
  const [liveMode, setLiveMode] = useState(false);
  const [conversationId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<RecorderHandle | null>(null);
  const liveModeRef = useRef(liveMode);
  useEffect(() => { liveModeRef.current = liveMode; }, [liveMode]);

  const sendAudio = useCallback(async (base64: string, mime: string) => {
    setBusy(true);
    setStatus("Sending to NEX…");
    try {
      const r = await fetch("/api/nex/voice/live-round-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio_base64: base64,
          mime_type: mime,
          conversation_id: conversationId,
        }),
      });
      const j = await r.json();
      if (!j?.transcript) {
        setStatus("No speech detected · try again");
        setBusy(false);
        return;
      }
      setTurns((t) => [
        ...t,
        { role: "user", content: j.transcript },
        { role: "assistant", content: j.reply_text ?? "(no reply)", audio_url: j.reply_audio_data_url, provenance: j.provenance },
      ]);
      setStatus("NEX replied · playing…");
      // Play the synthesised reply audio.
      if (j.reply_audio_data_url) {
        const audio = new Audio(j.reply_audio_data_url);
        audio.onended = () => {
          setStatus(liveModeRef.current ? "Listening…" : "Idle · click the mic to speak");
          if (liveModeRef.current) void startRecording();
        };
        try { await audio.play(); } catch {
          setStatus(liveModeRef.current ? "Listening…" : "Idle · click the mic to speak");
          if (liveModeRef.current) void startRecording();
        }
      } else {
        setStatus(liveModeRef.current ? "Listening…" : "Idle · click the mic to speak");
        if (liveModeRef.current) void startRecording();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "send_failed");
      setStatus("Error · see below");
    } finally {
      setBusy(false);
    }
  }, [conversationId]);

  const stopAndSend = useCallback(async () => {
    const rec = recorderRef.current;
    if (!rec) return;
    setStatus("Stopping…");
    const out = await rec.stop();
    recorderRef.current = null;
    setLevel(0);
    if (!out) {
      setStatus(liveModeRef.current ? "Listening…" : "Idle · click the mic to speak");
      return;
    }
    await sendAudio(out.base64, out.mime_type);
  }, [sendAudio]);

  const startRecording = useCallback(async () => {
    if (busy) return;
    setError(null);
    setStatus(liveMode ? "Listening…" : "Recording · click again to stop");
    try {
      const rec = createRecorder({
        onLevel: (rms) => setLevel(rms),
        onSilence: () => { if (liveModeRef.current) void stopAndSend(); },
        silenceMs: 900,
        minMs: 800,
      });
      await rec.start();
      recorderRef.current = rec;
    } catch (e) {
      setError(e instanceof Error ? e.message : "mic_denied");
      setStatus("Microphone unavailable · check browser permissions");
      setLiveMode(false);
    }
  }, [busy, liveMode, stopAndSend]);

  const toggleMic = useCallback(async () => {
    if (recorderRef.current?.isRecording()) {
      await stopAndSend();
    } else {
      await startRecording();
    }
  }, [startRecording, stopAndSend]);

  const toggleLive = useCallback(() => {
    setLiveMode((prev) => {
      const next = !prev;
      if (next) {
        setStatus("Live mode on · listening…");
        void startRecording();
      } else {
        setStatus("Live mode off · click mic when ready");
        recorderRef.current?.cancel();
        recorderRef.current = null;
      }
      return next;
    });
  }, [startRecording]);

  const s = {
    main: { maxWidth: 780, margin: "2rem auto", padding: "1rem", fontFamily: "system-ui" } as const,
    label: { fontSize: "0.7rem", color: "#71717a", textTransform: "uppercase" as const, letterSpacing: "0.05em" },
    micBtn: (recording: boolean) => ({
      padding: "1rem 1.5rem",
      background: recording ? "#dc2626" : "#166534",
      color: "#fff", border: 0, borderRadius: 999, cursor: "pointer",
      fontSize: "1rem", fontWeight: 600,
    }) as const,
    liveBtn: (on: boolean) => ({
      padding: "0.5rem 0.9rem",
      background: on ? "#0f172a" : "#f4f4f5",
      color: on ? "#fff" : "#18181b",
      border: "1px solid #d4d4d8", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem",
    }) as const,
    turn: (role: "user" | "assistant") => ({
      padding: "0.75rem 1rem", margin: "0.5rem 0",
      background: role === "user" ? "#f4f4f5" : "#ffffff",
      border: "1px solid #e4e4e7", borderRadius: 8,
    }),
    meter: { display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: "0.8rem", color: "#52525b" } as const,
    doctrine: { marginTop: "1.5rem", padding: "0.75rem 1rem", background: "#fafafa", border: "1px solid #e4e4e7", borderRadius: 8, fontSize: "0.8rem", color: "#52525b" } as const,
  };

  const meterWidth = Math.min(100, Math.round(level * 500));
  const isRecording = recorderRef.current?.isRecording() ?? false;

  return (
    <main style={s.main} data-nex-voice-page="true">
      <header>
        <div style={{ fontSize: "0.75rem", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          NEX · Voice + Live Conversation
        </div>
        <h1 style={{ margin: "0.25rem 0", fontSize: "1.5rem" }}>Speak with NEX</h1>
        <p style={{ color: "#71717a", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
          Push-to-talk for single turns, or turn on Live to have NEX auto-stop when you pause and play its reply back.
        </p>
      </header>

      <section aria-label="controls">
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            style={s.micBtn(isRecording)}
            onClick={() => void toggleMic()}
            disabled={busy && !isRecording}
            data-mic-button="true"
          >
            {isRecording ? "■ Stop" : "🎤 Speak"}
          </button>
          <button style={s.liveBtn(liveMode)} onClick={toggleLive} data-live-toggle="true">
            {liveMode ? "Live mode: ON" : "Live mode: off"}
          </button>
        </div>
        <div style={s.meter} data-mic-meter="true">
          <span>Mic level:</span>
          <div style={{ flex: 1, height: 8, background: "#f4f4f5", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${meterWidth}%`, height: "100%", background: isRecording ? "#dc2626" : "#a1a1aa", transition: "width 40ms linear" }} />
          </div>
          <code style={{ minWidth: 44, textAlign: "right" }}>{level.toFixed(3)}</code>
        </div>
        <p style={{ marginTop: 6, fontSize: "0.85rem", color: "#52525b" }}>{status}</p>
        {error && <p style={{ color: "#dc2626", fontSize: "0.85rem" }}>Error: {error}</p>}
      </section>

      <section aria-label="turns" style={{ marginTop: "1rem" }}>
        {turns.map((t, i) => (
          <article key={i} style={s.turn(t.role)}>
            <div style={{ ...s.label, marginBottom: "0.3rem" }}>{t.role}</div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: "0.95rem", lineHeight: 1.5 }}>{t.content}</div>
            {t.audio_url && (
              <audio controls src={t.audio_url} style={{ marginTop: 8, width: "100%" }} />
            )}
            {t.provenance && t.provenance.length > 0 && (
              <div style={{ marginTop: 6, padding: "0.4rem 0.6rem", background: "#fafafa", border: "1px dashed #e4e4e7", borderRadius: 6, fontSize: "0.72rem", color: "#52525b" }}>
                {t.provenance.map((p, j) => (
                  <div key={j}>· {p.kind} · <code>{p.ref_id}</code> · {p.provider} · {p.doctrine_note}</div>
                ))}
              </div>
            )}
          </article>
        ))}
      </section>

      <div style={s.doctrine}>
        <strong>Doctrines active on this page:</strong>
        <ul style={{ margin: "0.3rem 0 0 1rem", padding: 0 }}>
          <li>Voice input → transcript → never establishes truth</li>
          <li>Voice output → synthesis → never establishes truth</li>
          <li>Doctrine #5 sanitiser guards every splice</li>
          <li>Fabrication Gate v2 remains authoritative on every reply claim</li>
          <li>Every turn auto-persisted to nex.conversation · searchable, branchable, shareable</li>
        </ul>
      </div>
    </main>
  );
}
