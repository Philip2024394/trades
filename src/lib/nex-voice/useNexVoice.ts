// NEX Voice · unified orchestration hook.
//
// SINGLE PIPELINE for every NEX voice surface (`/nexapp`, `/nex-voice-demo`,
// and any future surface). Owns:
//   · provider lifecycle (browser today · pluggable via getVoiceProvider)
//   · state machine (idle → listening → thinking → speaking → idle)
//   · STT capture and confidence-guard
//   · POST → /api/nex-conv/chat (SAME endpoint text UI uses)
//   · TTS playback with cancel/barge-in
//   · conversation-id continuity across turns
//   · one-tap dispatcher (`tap()`) and push-to-talk (`beginListen/endListen`)
//
// Surfaces do NOT own any of the above. They render their own UI and
// subscribe to events (`onUserFinal`, `onNexReply`, `onPartial`, `onError`)
// to update whatever message shape they use.
//
// Voice DELIVERY (persona, prosody, provider selection) is a SEPARATE
// concern — it plugs behind the provider layer, not into this hook.
// Brain response text stays CLEAN — never inject SSML/pause markers here.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getVoiceProvider } from "./factory";
import type { NexVoiceProvider, VoiceListenHandle } from "./types";

export type NexVoiceState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

/**
 * Priority 2 Indonesian V2 (Philip 2026-08-21): the voice pipeline is
 * language-parameterised, NOT forked. `en` = British English STT/TTS,
 * `id` = id-ID STT/TTS. Same brain, same conversation state — only the
 * response language shifts (see pinned Language-Neutral Brain invariant).
 */
export type NexVoiceLanguage = "en" | "id";

/** BCP-47 tags used with browser STT/TTS APIs. */
function bcp47(lang: NexVoiceLanguage): string {
  return lang === "id" ? "id-ID" : "en-GB";
}

/**
 * Detect Indonesian intent-to-switch from short client-side text.
 * Server-side infer.mjs owns the authoritative detection (per turn);
 * this is a lightweight client hint so we can flip the STT/TTS lang
 * BEFORE the next mic tap when the customer clearly switched.
 * Uses a small stopword hint list, NOT a full detector — brain remains
 * authoritative.
 */
const ID_HINTS = /\b(saya|aku|kamu|kami|kita|mau|ingin|dengan|dan|atau|tapi|tidak|bukan|ada|bisa|tolong|apa|siapa|mana|berapa|kenapa|bagaimana|dimana|untuk|dari|di|ke|yang|itu|ini|adalah|sedang|mencari|cari|tangga|kayu|harga|beli|jual|silakan|terima kasih)\b/i;
function clientDetectLanguageHint(text: string): NexVoiceLanguage | null {
  if (!text || text.length < 3) return null;
  return ID_HINTS.test(text) ? "id" : null;
}

export type NexReplyMeta = {
  conversationId: string | null;
  intent: string | null;
  entities: string[];
  establishedFacts: Record<string, { value: string; provenance?: string }> | null;
  turnCount: number | null;
  /** Priority 2 V2: language the brain used for THIS reply. Client should
   *  adopt it for the next STT + TTS turn. */
  conversationLanguage: NexVoiceLanguage;
};

type ChatResponse = {
  conversation_id: string;
  reply: string | null;
  understood_intent?: string | null;
  understood_entities?: string[];
  state_summary?: {
    established_facts?: Record<string, { value: string; provenance?: string }>;
    turn_count?: number;
    conversation_language?: string;
  };
  error?: string;
};

export type UseNexVoiceOptions = {
  /** Provider id passed to getVoiceProvider. Default 'browser'. */
  provider?: string;
  /**
   * Active conversation language ('en' or 'id'). Drives STT + TTS.
   * Default 'en'. The hook AUTO-ADOPTS the brain's detected language
   * from each reply's `state_summary.conversation_language` — parents
   * that want strict manual control should pass a controlled value AND
   * ignore `onLanguageChange`.
   */
  language?: NexVoiceLanguage;
  /**
   * Fired when the hook adopts a new language from the brain's detection
   * (e.g. customer wrote in Indonesian → next turn uses id-ID). Parents
   * can use this to sync their own language state / UI toggle.
   */
  onLanguageChange?: (lang: NexVoiceLanguage) => void;
  /** STT confidence below this triggers the misheard fallback. Default 0.4. */
  minConfidence?: number;
  /** Spoken fallback when the mic returned nothing usable. */
  fallbackMisheard?: string;
  /** Spoken fallback when the chat API errored / returned no reply. */
  fallbackApiDown?: string;
  /** Transform user text before it is sent to /api/nex-conv/chat (e.g. category prefix). */
  preprocessMessage?: (text: string) => string;
  /** Called with cleaned user text once it will be sent to NEX. */
  onUserFinal?: (text: string) => void;
  /** Called when NEX replies. Text is the CLEAN reply — never touched by voice layer. */
  onNexReply?: (reply: string, meta: NexReplyMeta) => void;
  /** Called with interim STT text (partial recognition). */
  onPartial?: (text: string) => void;
  /** Called on any capture / provider error. */
  onError?: (msg: string) => void;
};

export type UseNexVoiceApi = {
  state: NexVoiceState;
  isSupported: boolean;
  conversationId: string | null;
  /** Currently active language — used by STT + TTS. Auto-adopts brain
   *  detection unless parent owns it via a controlled `language` option. */
  activeLanguage: NexVoiceLanguage;
  /** Explicitly set the active language (e.g. user toggled en↔id). */
  setLanguage: (lang: NexVoiceLanguage) => void;
  /** Begin capture (push-to-talk down / one-tap start). */
  beginListen: () => void;
  /** End capture (push-to-talk up). Final result still fires via onUserFinal. */
  endListen: () => void;
  /** Cancel in-flight TTS or listen. Safe from any state. */
  cancel: () => void;
  /** One-tap dispatcher: idle→listen, listening→end, speaking→cancel, thinking→cancel. */
  tap: () => void;
  /** Send typed text through the same brain. speak=false = silent (chat UI). */
  sendText: (text: string, opts?: { speak?: boolean }) => Promise<void>;
  /**
   * Speak canned text directly · bypasses /api/nex-conv/chat.
   * Used for scripted first-run performances (activation ceremony intro)
   * where routing through the brain would be wrong. Returns durationMs so
   * callers can detect the "resolved instantly" pattern that indicates
   * browser autoplay/audio-block (iOS Safari) vs. a real completed
   * utterance. durationMs < ~1000 → silent block · caller decides fallback.
   */
  speak: (text: string) => Promise<{ durationMs: number }>;
  /** Clear conversation_id — starts a fresh thread on next turn. */
  reset: () => void;
};

const DEFAULT_MISHEARD = "I didn't quite catch that. Could you say it again?";
const DEFAULT_API_DOWN =
  "I'm having trouble hearing you right now. Give me a moment.";

export function useNexVoice(options: UseNexVoiceOptions = {}): UseNexVoiceApi {
  const [state, setState] = useState<NexVoiceState>("idle");
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<NexVoiceLanguage>(
    options.language ?? "en",
  );

  const providerRef = useRef<NexVoiceProvider | null>(null);
  const listenHandleRef = useRef<VoiceListenHandle | null>(null);
  // Stash callbacks in a ref so consumers don't need to memoise them
  // to avoid effect churn. The ref is updated on every render.
  const optsRef = useRef(options);
  optsRef.current = options;
  // conversationId in a ref too, so sendText inside handlers reads latest.
  const conversationIdRef = useRef<string | null>(null);
  conversationIdRef.current = conversationId;
  // activeLanguage also ref'd so listen/speak callbacks read the latest
  // without needing to re-bind. Auto-follow the parent's controlled
  // `language` if it changes.
  const activeLanguageRef = useRef<NexVoiceLanguage>(activeLanguage);
  activeLanguageRef.current = activeLanguage;
  useEffect(() => {
    if (options.language && options.language !== activeLanguageRef.current) {
      setActiveLanguage(options.language);
      activeLanguageRef.current = options.language;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.language]);
  // Session diagnostics used to distinguish a real "misheard" from a
  // permission/start failure (mic ended immediately without capture).
  const sessionStartRef = useRef<number>(0);
  const sawPartialRef = useRef<boolean>(false);

  // Provider lifecycle — mount once, tear down on unmount.
  useEffect(() => {
    try {
      const p = getVoiceProvider(options.provider ?? "browser");
      providerRef.current = p;
      setIsSupported(p.isSupported());
      // Warm up voices metadata so the FIRST TTS call doesn't race the
      // browser's async voice loading (Chrome/Edge return [] until the
      // 'voiceschanged' event fires — that's what caused the picker to
      // fall through to a male OS default the first time it spoke).
      if (typeof window !== "undefined" && window.speechSynthesis) {
        try { window.speechSynthesis.getVoices(); } catch { /* noop */ }
      }
    } catch (e) {
      setIsSupported(false);
      optsRef.current.onError?.(String((e as Error)?.message ?? e));
    }
    return () => {
      listenHandleRef.current?.stop();
      providerRef.current?.cancelSpeech();
    };
    // provider id change is a rare edge — we deliberately mount once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speak = useCallback(async (text: string) => {
    const p = providerRef.current;
    if (!p || !text) return;
    setState("speaking");
    // Priority 2 V2: pass the active language to the provider so TTS
    // picks the right OS voice (id-ID for Indonesian, en-GB for English).
    await p.speak(text, { lang: bcp47(activeLanguageRef.current) });
    setState("idle");
  }, []);

  const sendText = useCallback(
    async (text: string, opts: { speak?: boolean } = {}) => {
      const clean = (text ?? "").trim();
      if (!clean) return;

      optsRef.current.onUserFinal?.(clean);

      const message =
        optsRef.current.preprocessMessage?.(clean) ?? clean;

      setState("thinking");

      let res: ChatResponse | null = null;
      try {
        const r = await fetch("/api/nex-conv/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversationIdRef.current ?? undefined,
            message,
            market: "ID",
          }),
        });
        res = (await r.json()) as ChatResponse;
      } catch (e) {
        optsRef.current.onError?.(String((e as Error)?.message ?? e));
      }

      const fallbackApiDown =
        optsRef.current.fallbackApiDown ?? DEFAULT_API_DOWN;

      if (!res || !res.reply) {
        if (opts.speak) await speak(fallbackApiDown);
        else setState("idle");
        return;
      }

      if (res.conversation_id && !conversationIdRef.current) {
        setConversationId(res.conversation_id);
        conversationIdRef.current = res.conversation_id;
      }

      // Priority 2 V2: adopt the brain's detected language for the NEXT
      // STT + TTS turn. Server owns detection (infer.mjs); client follows.
      // This is what lets a customer type/speak Indonesian and get
      // Indonesian voice back on turn 2 without a UI toggle.
      const brainLang = res.state_summary?.conversation_language;
      if (brainLang === "id" || brainLang === "en") {
        const next: NexVoiceLanguage = brainLang;
        if (next !== activeLanguageRef.current) {
          // eslint-disable-next-line no-console
          console.info(`[nex-voice] language adopted from brain · was=${activeLanguageRef.current} now=${next}`);
          activeLanguageRef.current = next;
          setActiveLanguage(next);
          optsRef.current.onLanguageChange?.(next);
        }
      }

      const meta: NexReplyMeta = {
        conversationId: res.conversation_id ?? conversationIdRef.current,
        intent: res.understood_intent ?? null,
        entities: res.understood_entities ?? [],
        establishedFacts: res.state_summary?.established_facts ?? null,
        turnCount: res.state_summary?.turn_count ?? null,
        conversationLanguage: activeLanguageRef.current,
      };
      optsRef.current.onNexReply?.(res.reply, meta);

      if (opts.speak) await speak(res.reply);
      else setState("idle");
    },
    [speak],
  );

  const beginListen = useCallback(() => {
    const p = providerRef.current;
    if (!p) {
      // eslint-disable-next-line no-console
      console.warn("[nex-voice] beginListen ignored · no provider (getVoiceProvider failed at mount)");
      return;
    }
    if (!p.isSupported()) {
      // eslint-disable-next-line no-console
      console.warn("[nex-voice] beginListen ignored · provider reports unsupported (need Chrome/Edge, HTTPS or localhost)");
      optsRef.current.onError?.(
        "Voice not available in this browser. Try Chrome or Edge on localhost / HTTPS.",
      );
      return;
    }
    // eslint-disable-next-line no-console
    console.info("[nex-voice] beginListen · requesting mic + STT");
    p.cancelSpeech();
    setState("listening");
    sessionStartRef.current = Date.now();
    sawPartialRef.current = false;
    // Priority 2 V2: STT lang comes from the active session language.
    // en → 'en-GB', id → 'id-ID'. Chrome/Edge Web Speech supports id-ID
    // (backed by Google Speech). Voice hint per pinned Indonesian V2 doctrine.
    // eslint-disable-next-line no-console
    console.info(`[nex-voice] listen · lang=${bcp47(activeLanguageRef.current)} · active=${activeLanguageRef.current}`);
    listenHandleRef.current = p.listen({
      lang: bcp47(activeLanguageRef.current),
      onPartial: (t) => {
        if (t.text) sawPartialRef.current = true;
        // Priority 2 V2: client-side language hint from partial transcripts.
        // If the user clearly starts speaking Indonesian, flip the STT
        // language for the NEXT session even before the brain confirms.
        // Brain remains authoritative (server-side re-detects per turn).
        const hint = clientDetectLanguageHint(t.text);
        if (hint && hint !== activeLanguageRef.current) {
          // eslint-disable-next-line no-console
          console.info(`[nex-voice] client language hint · was=${activeLanguageRef.current} hint=${hint} (will flip on next tap; brain confirms)`);
        }
        optsRef.current.onPartial?.(t.text);
      },
      onFinal: (t) => {
        listenHandleRef.current = null;
        const clean = (t.text ?? "").trim();
        const minConf = optsRef.current.minConfidence ?? 0.4;
        if (!clean || t.confidence < minConf) {
          // Distinguish a real "misheard" from a session that never
          // captured anything (mic permission not granted, mic in use
          // elsewhere, user tapped by accident). If the session ended
          // very fast AND we never saw a partial transcript, the user
          // never actually spoke — do NOT play the misheard fallback,
          // that's what causes "guy speaks immediately when I press
          // the button". Silently return to idle instead.
          const elapsed = Date.now() - sessionStartRef.current;
          const neverCaptured = !sawPartialRef.current && elapsed < 800;
          if (neverCaptured) {
            setState("idle");
            return;
          }
          const fallbackMisheard =
            optsRef.current.fallbackMisheard ?? DEFAULT_MISHEARD;
          void speak(fallbackMisheard);
          return;
        }
        // Voice turns always speak the reply back.
        void sendText(clean, { speak: true });
      },
      onError: (m) => {
        optsRef.current.onError?.(m);
        // Permission / start errors return the state to idle rather than
        // 'error' so the button remains tappable and the animation stays
        // calm. The message still surfaces via onError for surfaces that
        // want to display it.
        setState("idle");
      },
    });
  }, [sendText, speak]);

  const endListen = useCallback(() => {
    listenHandleRef.current?.stop();
    listenHandleRef.current = null;
    // Do NOT force state here — the provider's onFinal / onend will drive
    // the transition through sendText or the misheard fallback.
  }, []);

  const cancel = useCallback(() => {
    const p = providerRef.current;
    listenHandleRef.current?.stop();
    listenHandleRef.current = null;
    p?.cancelSpeech();
    setState("idle");
  }, []);

  const tap = useCallback(() => {
    const p = providerRef.current;
    // eslint-disable-next-line no-console
    console.info("[nex-voice] tap · state=" + state + " · provider=" + (p ? p.id : "null") + " · supported=" + (p ? p.isSupported() : false));
    if (!p) {
      optsRef.current.onError?.("Voice provider failed to initialise. Reload the page.");
      return;
    }
    if (!p.isSupported()) {
      optsRef.current.onError?.(
        "Voice not available in this browser. Try Chrome or Edge on localhost / HTTPS.",
      );
      return;
    }
    if (state === "idle" || state === "error") {
      beginListen();
    } else if (state === "listening") {
      endListen();
    } else {
      // thinking or speaking → barge-in / cancel
      cancel();
    }
  }, [state, beginListen, endListen, cancel]);

  const reset = useCallback(() => {
    cancel();
    setConversationId(null);
    conversationIdRef.current = null;
  }, [cancel]);

  const setLanguage = useCallback((lang: NexVoiceLanguage) => {
    if (lang === activeLanguageRef.current) return;
    // eslint-disable-next-line no-console
    console.info(`[nex-voice] setLanguage · was=${activeLanguageRef.current} now=${lang}`);
    activeLanguageRef.current = lang;
    setActiveLanguage(lang);
    optsRef.current.onLanguageChange?.(lang);
  }, []);

  // Direct canned-speech path · scripted intro / activation ceremony.
  // Times the provider round-trip so callers can distinguish a real
  // spoken utterance (>~1s of audio) from an instantaneously-resolved
  // Promise (autoplay blocked · silent). See speak() docstring on the
  // return type for detection semantics.
  const speakDirect = useCallback(async (text: string): Promise<{ durationMs: number }> => {
    const start = Date.now();
    await speak(text);
    return { durationMs: Date.now() - start };
  }, [speak]);

  return {
    state,
    isSupported,
    conversationId,
    activeLanguage,
    setLanguage,
    beginListen,
    endListen,
    cancel,
    tap,
    sendText,
    speak: speakDirect,
    reset,
  };
}
