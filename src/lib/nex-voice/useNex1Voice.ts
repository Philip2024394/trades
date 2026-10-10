// NEX1 · Voice hook · unified with text · zero LLM.
// Founder-authorised 2026-09-17.
//
// Reuses the existing browser Web Speech provider from
// `src/lib/nex-voice/providers/browser.ts`. Does NOT rebuild any working
// component. Explicit destination: /api/nex1/chat/turn (the native runtime).
//
// §6 of the Unified Chat mission: voice and text share the same intelligence
// pipeline. This hook takes a transcript from Web Speech Recognition, POSTs
// it to /api/nex1/chat/turn (identical contract to the text UI), and speaks
// the returned text via Web SpeechSynthesis.
//
// EXPLICIT ROUTING:
//   · This hook POSTs ONLY to `/api/nex1/chat/turn`.
//   · It NEVER falls back to /api/nex-conv/chat (the LLM-backed consumer
//     brain used by `useNexVoice.ts`).
//   · It never imports from openai / anthropic / @google/generative /
//     groq-sdk / any inference client.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getVoiceProvider } from "./factory";
import type { NexVoiceProvider, VoiceListenHandle } from "./types";

export type Nex1VoiceState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

export interface UseNex1VoiceOptions {
  readonly conversationId: string;
  readonly onTranscript?: (t: string) => void;
  readonly onNex1Reply?: (reply: {
    readonly text: string;
    readonly state: string;
    readonly source: string;
    readonly zero_llm: boolean;
  }) => void;
  readonly onError?: (msg: string) => void;
}

export interface UseNex1VoiceApi {
  readonly state: Nex1VoiceState;
  readonly listen: () => void;
  readonly stopListening: () => void;
  readonly cancelSpeech: () => void;
  readonly available: boolean;
}

/** NEX1-scoped voice hook. Wires browser STT/TTS to /api/nex1/chat/turn. */
export function useNex1Voice(opts: UseNex1VoiceOptions): UseNex1VoiceApi {
  const [state, setState] = useState<Nex1VoiceState>("idle");
  const [available, setAvailable] = useState(false);
  const providerRef = useRef<NexVoiceProvider | null>(null);
  const listenHandleRef = useRef<VoiceListenHandle | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getVoiceProvider();
        if (cancelled) return;
        providerRef.current = p;
        setAvailable(true);
      } catch {
        setAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
      listenHandleRef.current?.stop?.();
    };
  }, []);

  const sendToNex1 = useCallback(
    async (transcript: string) => {
      if (!transcript || transcript.trim().length === 0) return;
      opts.onTranscript?.(transcript);
      setState("thinking");
      try {
        const resp = await fetch("/api/nex1/chat/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation_id: opts.conversationId, message: transcript }),
        });
        const data = (await resp.json()) as { ok?: boolean; text?: string; state?: string; source?: string; zero_llm?: boolean; error?: string };
        if (!data.ok) {
          setState("error");
          opts.onError?.(data.error ?? "chat turn failed");
          return;
        }
        opts.onNex1Reply?.({
          text: data.text ?? "",
          state: data.state ?? "unknown",
          source: data.source ?? "unknown",
          zero_llm: data.zero_llm === true,
        });
        // Speak the response
        const p = providerRef.current;
        if (p && data.text) {
          setState("speaking");
          try {
            await p.speak({ text: data.text });
          } catch (e) {
            opts.onError?.(e instanceof Error ? e.message : String(e));
          }
        }
        setState("idle");
      } catch (e) {
        setState("error");
        opts.onError?.(e instanceof Error ? e.message : String(e));
      }
    },
    [opts],
  );

  const listen = useCallback(() => {
    const p = providerRef.current;
    if (!p) return;
    setState("listening");
    const handle = p.listen(
      { language: "en-GB" },
      (evt) => {
        if (evt.isFinal && evt.text) {
          void sendToNex1(evt.text);
        }
      },
    );
    listenHandleRef.current = handle;
  }, [sendToNex1]);

  const stopListening = useCallback(() => {
    listenHandleRef.current?.stop?.();
    listenHandleRef.current = null;
    if (state === "listening") setState("idle");
  }, [state]);

  const cancelSpeech = useCallback(() => {
    providerRef.current?.cancelSpeech?.();
    if (state === "speaking") setState("idle");
  }, [state]);

  return { state, listen, stopListening, cancelSpeech, available };
}
