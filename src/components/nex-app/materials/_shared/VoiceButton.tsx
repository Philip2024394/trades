"use client";
// VoiceButton — Web Speech API mic button. Silent no-op if unsupported.
//
// Records once, transcribes, hands the text back via onTranscript.
// Shows a pulsing ring while listening; stops on second click or when
// the browser detects end-of-speech.

import { useEffect, useRef, useState } from "react";
import { Mic, Loader2 } from "lucide-react";
import { MT } from "../_tokens";

type Recogniser = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: unknown) => void) | null;
  onend:    ((e: unknown) => void) | null;
  onerror:  ((e: unknown) => void) | null;
};

export function VoiceButton({
  onTranscript, size = 40, iconSize = 16,
}: {
  onTranscript: (text: string) => void;
  size?: number;
  iconSize?: number;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recogniser | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = (window as unknown as {
      SpeechRecognition?: new () => Recogniser;
      webkitSpeechRecognition?: new () => Recogniser;
    }).SpeechRecognition ?? (window as unknown as {
      webkitSpeechRecognition?: new () => Recogniser;
    }).webkitSpeechRecognition;
    if (!Ctor) return;
    setSupported(true);
    const r = new Ctor();
    r.lang = navigator.language?.startsWith("en") ? navigator.language : "en-GB";
    r.interimResults = false;
    r.continuous = false;
    rec.current = r;
    return () => {
      try { r.stop(); } catch { /* ignore */ }
    };
  }, []);

  useEffect(() => {
    const r = rec.current;
    if (!r) return;
    r.onresult = (e: unknown) => {
      // SpeechRecognition event shape: results[i][j].transcript where
      // i = result index and j = alternative index. We only take the
      // first result's first alternative.
      const ev = e as { results: ArrayLike<ArrayLike<{ transcript: string }>> };
      const t = ev.results?.[0]?.[0]?.transcript ?? "";
      if (t) onTranscript(t.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
  }, [onTranscript]);

  if (!supported) return null;

  const toggle = () => {
    const r = rec.current;
    if (!r) return;
    if (listening) {
      try { r.stop(); } catch { /* ignore */ }
      setListening(false);
    } else {
      try {
        r.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? "Stop recording" : "Speak to NEX"}
      className="relative grid place-items-center rounded-full transition-transform active:scale-95"
      style={{
        width: size, height: size,
        background: listening ? MT.primary : "transparent",
        color:      listening ? "#FFFFFF" : MT.secondaryGrey,
      }}
    >
      {listening
        ? <Loader2 size={iconSize} strokeWidth={2.25} style={{ animation: "vb-spin 1.2s linear infinite" }} />
        : <Mic     size={iconSize} strokeWidth={2}    />}
      {listening && (
        <>
          <span aria-hidden style={ringStyle(size,   0)} />
          <span aria-hidden style={ringStyle(size, 320)} />
        </>
      )}
      <style jsx>{`
        @keyframes vb-spin {
          from { transform: rotate(0deg);   }
          to   { transform: rotate(360deg); }
        }
        @keyframes vb-pulse {
          0%   { transform: scale(1);   opacity: 0.55; }
          80%  { transform: scale(1.9); opacity: 0;    }
          100% { transform: scale(1.9); opacity: 0;    }
        }
      `}</style>
    </button>
  );
}

function ringStyle(size: number, delayMs: number): React.CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    width: size, height: size,
    borderRadius: 9999,
    border: `2px solid ${MT.primary}`,
    animation: "vb-pulse 1400ms ease-out infinite",
    animationDelay: `${delayMs}ms`,
    pointerEvents: "none",
  };
}
