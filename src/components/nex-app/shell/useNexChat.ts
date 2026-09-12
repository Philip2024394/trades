// src/components/nex-app/shell/useNexChat.ts
//
// Stage 3.41.a · NEX Chat state hook (Philip 2026-08-31).
//
// All chat-surface logic lives here so it's testable without a DOM:
//   · conversation_id persistence (localStorage)
//   · message list state (user + NEX bubbles)
//   · sendUserMessage · used identically by the typed composer AND
//     the confirm/decline button clicks in ActionProposalPrompt
//   · fetch to /api/nex-conv/chat with the exact shape the route expects
//   · artifact extraction via chat-artifacts.mapChatResponseToArtifacts
//   · in-flight guard so a double-tap on send / button doesn't double-fire
//
// CONSTITUTIONAL: the button-click path and the typed-input path MUST
// route through the exact same code (sendUserMessage(text)) so the
// 3.37 authorization gate handles them identically. No parallel
// authorization path is possible from this surface.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mapChatResponseToArtifacts, extractVoiceReplyID, type ChatArtifacts } from "./chat-artifacts";

const STORAGE_KEY = "nex.talk.conversation_id";

export type ChatRole = "user" | "nex";

export type NexChatMessage = {
  id:         string;
  role:       ChatRole;
  text:       string;             // for user turns: raw input · for nex turns: voice_reply.text (or reply fallback)
  timestamp:  number;
  artifacts?: ChatArtifacts;      // only present on NEX turns · undefined for user turns
  errored?:   boolean;
};

export type UseNexChatOptions = {
  /** ID used to persist conversation across reloads. */
  storageKey?: string;
  /** Market · usually "ID". */
  market?:    "ID" | "UK" | "US";
  /** Language for the NEX turn text. Defaults to EN. */
  language?:  "en" | "id";
  /** Optional user id · triggers cross-session personalization when consent granted. */
  userId?:    string;
  /** Optional injectable fetch for tests. */
  fetchImpl?: typeof fetch;
  /** Optional storage · for tests. Falls back to globalThis.localStorage. */
  storage?:   { getItem(k: string): string | null; setItem(k: string, v: string): void };
  /** Enable live World (real DB). Defaults true · turn off for offline dev. */
  useLiveWorld?: boolean;
};

export type UseNexChatResult = {
  conversationId: string | null;
  messages:       readonly NexChatMessage[];
  sending:        boolean;
  sendUserMessage: (text: string) => Promise<void>;
  /** Reset the conversation · new id · empty history. */
  reset:          () => void;
};

function newId(): string {
  // Cheap unique id · avoid Node crypto to stay isomorphic.
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function newConvId(): string {
  return `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Pure helpers · testable without React DOM ─────────────────────

export type RequestPayload = {
  message:         string;
  conversation_id: string;
  market:          "ID" | "UK" | "US";
  useLiveWorld:    boolean;
  user_id?:        string;
};

/** Build the exact JSON body /api/nex-conv/chat expects. */
export function buildRequestPayload(input: {
  message: string;
  conversationId: string;
  market?: "ID" | "UK" | "US";
  useLiveWorld?: boolean;
  userId?: string;
}): RequestPayload {
  return {
    message:         input.message.trim(),
    conversation_id: input.conversationId,
    market:          input.market ?? "ID",
    useLiveWorld:    input.useLiveWorld ?? true,
    user_id:         input.userId,
  };
}

/**
 * Turn the raw JSON response from /api/nex-conv/chat into the
 * NexChatMessage the surface renders. Pure · testable.
 */
export function parseResponseToMessage(json: unknown, opts: { language: "en" | "id" }): NexChatMessage {
  const j = (json ?? {}) as Record<string, unknown>;
  const artifacts = mapChatResponseToArtifacts(j);
  const voice = opts.language === "id" ? extractVoiceReplyID(j.voice_reply) : artifacts.voiceReply;
  const fallbackReply = typeof j.reply === "string" ? j.reply : "";
  const text = voice?.text ?? fallbackReply;
  return {
    id:        newId(),
    role:      "nex",
    text,
    timestamp: Date.now(),
    artifacts: { ...artifacts, voiceReply: voice ?? artifacts.voiceReply },
  };
}

/**
 * The heart of the NEX Chat front door. Manages state + fetch and
 * exposes the exact SAME sendUserMessage function to both the input
 * composer and the ActionProposalPrompt buttons.
 */
export function useNexChat(opts: UseNexChatOptions = {}): UseNexChatResult {
  const {
    storageKey = STORAGE_KEY,
    market = "ID",
    language = "en",
    userId,
    fetchImpl,
    storage,
    useLiveWorld = true,
  } = opts;

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages]             = useState<NexChatMessage[]>([]);
  const [sending, setSending]               = useState(false);
  const inFlightRef = useRef(false);

  // Load persisted conversation id (or mint a new one) after mount ·
  // deferred so SSR doesn't touch localStorage.
  useEffect(() => {
    const store = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
    if (!store) {
      setConversationId(newConvId());
      return;
    }
    const existing = store.getItem(storageKey);
    if (existing && typeof existing === "string" && existing.length > 0) {
      setConversationId(existing);
    } else {
      const fresh = newConvId();
      store.setItem(storageKey, fresh);
      setConversationId(fresh);
    }
  }, [storageKey, storage]);

  const persistCid = useCallback((cid: string) => {
    const store = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
    if (store) store.setItem(storageKey, cid);
  }, [storage, storageKey]);

  const reset = useCallback(() => {
    const fresh = newConvId();
    persistCid(fresh);
    setConversationId(fresh);
    setMessages([]);
  }, [persistCid]);

  const doFetch = useCallback(async (text: string, cid: string): Promise<Response> => {
    const f = fetchImpl ?? fetch;
    return f("/api/nex-conv/chat", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(buildRequestPayload({
        message: text, conversationId: cid, market, useLiveWorld, userId,
      })),
    });
  }, [fetchImpl, market, useLiveWorld, userId]);

  const sendUserMessage = useCallback(async (text: string): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (inFlightRef.current) return;   // in-flight guard · one turn at a time
    if (!conversationId) return;       // wait for cid mount (test can inject upfront)

    inFlightRef.current = true;
    setSending(true);

    // Push the user's turn immediately for UI responsiveness.
    const userMsg: NexChatMessage = { id: newId(), role: "user", text: trimmed, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await doFetch(trimmed, conversationId);
      const json = await res.json().catch(() => null) as Record<string, unknown> | null;
      if (!res.ok || !json) {
        setMessages((prev) => [...prev, {
          id: newId(), role: "nex", text: "Hmm — something went sideways. Try that again in a sec.",
          timestamp: Date.now(), errored: true,
        }]);
        return;
      }

      const nexMsg = parseResponseToMessage(json, { language });
      setMessages((prev) => [...prev, nexMsg]);
    } catch {
      setMessages((prev) => [...prev, {
        id: newId(), role: "nex", text: "Hmm — network issue on my side. Try again?",
        timestamp: Date.now(), errored: true,
      }]);
    } finally {
      setSending(false);
      inFlightRef.current = false;
    }
  }, [conversationId, doFetch, language]);

  return useMemo(() => ({ conversationId, messages, sending, sendUserMessage, reset }), [
    conversationId, messages, sending, sendUserMessage, reset,
  ]);
}
