"use client";

// ConversationStateProvider — the React context that owns the current
// conversation state, chat history, and state-transition machinery for
// a NEX Trade App instance.
//
// Per Master Trade Template §11:
// - Every button/chip declares intent → state transition
// - Chat panel persists across state changes (message history preserved)
// - Nex speaks the transition in chat (except for obvious hero-CTA taps)
// - Canvas fades out then in with --ease-nex-signature at 400ms
// - URL updates via replaceState (state is app memory, not browser memory)
//
// This is intentionally NOT a global store — each Trade App instance has
// its own provider. That's how the platform stays inheritable per trade.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ConversationState, TradeConfig, QuickAction } from "@/lib/nex-apps/_types";

// ─── Chat message shape ───────────────────────────────────────────
export type WoodCardSummary = {
  id:         string;
  name:       string;
  country:    string;
  flag:       string;
  imageUrl:   string;
  strength:   string;
  popularity: string;
  notes:      string;
  jankaLbf:   number;
  jankaBand:  "soft" | "medium" | "hard" | "very-hard";
};

export type ChatMessage = {
  id:         string;
  role:       "user" | "nex";
  content:    string;
  timestamp:  number;
  // Optional attachments that render below the message text
  wood_cards?: WoodCardSummary[];
  // If the AI response summoned a state transition, we record it so
  // the message can be replayed as "I showed you the compare view".
  transitioned_to?: ConversationState;
};

// ─── Canvas variant + payload — what the state should render ──────
export type CanvasPayload = {
  variant?:  string;                       // e.g. "gallery", "timbers"
  filter?:   Record<string, unknown>;      // pre-applied filter for Compare
  items?:    string[];                     // e.g. shortlisted IDs
  [key: string]: unknown;
};

// ─── Context value ────────────────────────────────────────────────
type StateCtx = {
  config:            TradeConfig;

  state:             ConversationState;
  canvasPayload:     CanvasPayload;
  transitionPending: boolean;              // true during canvas fade

  history:           ChatMessage[];
  chatOpen:          boolean;
  thinking:          boolean;              // true while Nex is generating a reply

  // Actions
  transitionTo:      (state: ConversationState, opts?: { payload?: CanvasPayload; nexNarration?: string }) => void;
  activateQuickAction: (action: QuickAction) => void;
  sendUserMessage:   (content: string) => Promise<void>;
  openChat:          () => void;
  closeChat:         () => void;
  toggleChat:        () => void;
};

const ConversationStateContext = createContext<StateCtx | null>(null);

// ─── Provider ─────────────────────────────────────────────────────
export function ConversationStateProvider({
  config,
  children,
  initialState = "discover"
}: {
  config:        TradeConfig;
  children:      ReactNode;
  initialState?: ConversationState;
}) {
  const [state, setState]                     = useState<ConversationState>(initialState);
  const [canvasPayload, setCanvasPayload]     = useState<CanvasPayload>({});
  const [transitionPending, setTransitionPending] = useState(false);
  const [history, setHistory]                 = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen]               = useState(false);
  const [thinking, setThinking]               = useState(false);
  const nextIdRef                             = useRef(1);
  const inFlightRef                           = useRef(false);
  // Mirror of history so async callbacks see fresh values without
  // stale-closure issues — critical for conversation-memory API calls.
  const historyRef = useRef<ChatMessage[]>([]);
  useEffect(() => { historyRef.current = history; }, [history]);

  // ─── Seed the conversation ─────────────────────────────────────
  useEffect(() => {
    if (history.length > 0) return;
    setHistory([{
      id:        `m${nextIdRef.current++}`,
      role:      "nex",
      content:   `${config.ai_panel.headline} ${config.ai_panel.subhead}`,
      timestamp: Date.now()
    }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── URL sync (replaceState — state is app memory) ─────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("state", state);
    if (canvasPayload.variant) url.searchParams.set("v", canvasPayload.variant);
    else url.searchParams.delete("v");
    window.history.replaceState({ state }, "", url.toString());
  }, [state, canvasPayload.variant]);

  // ─── Nex speaks a message (helper) ─────────────────────────────
  const pushNexMessage = useCallback((
    content: string,
    opts?: { transitioned_to?: ConversationState; wood_cards?: WoodCardSummary[] }
  ) => {
    setHistory((h) => [...h, {
      id:              `m${nextIdRef.current++}`,
      role:            "nex",
      content,
      timestamp:       Date.now(),
      transitioned_to: opts?.transitioned_to,
      wood_cards:      opts?.wood_cards
    }]);
  }, []);

  const pushUserMessage = useCallback((content: string) => {
    setHistory((h) => [...h, {
      id:        `m${nextIdRef.current++}`,
      role:      "user",
      content,
      timestamp: Date.now()
    }]);
  }, []);

  // ─── Core: state transition ────────────────────────────────────
  const transitionTo = useCallback((
    newState: ConversationState,
    opts?:    { payload?: CanvasPayload; nexNarration?: string }
  ) => {
    if (newState === state && !opts?.payload) return;

    setTransitionPending(true);
    if (opts?.nexNarration) pushNexMessage(opts.nexNarration, { transitioned_to: newState });

    // Two-stage: fade out canvas (motion-medium), then swap + fade in
    // (motion-slow with ease-nex-signature). Total 400ms.
    window.setTimeout(() => {
      setState(newState);
      setCanvasPayload(opts?.payload ?? {});
      window.setTimeout(() => setTransitionPending(false), 50);
    }, 150);
  }, [state, pushNexMessage]);

  // ─── Quick action → transition + open chat ─────────────────────
  const activateQuickAction = useCallback((action: QuickAction) => {
    // Chip taps always open the chat panel so the user sees the response
    setChatOpen(true);
    transitionTo(action.target_state, {
      payload:      action.canvas_variant ? { variant: action.canvas_variant, filter: action.filter } : action.filter ? { filter: action.filter } : undefined,
      nexNarration: action.chat_intro
    });
  }, [transitionTo]);

  // ─── User types a message → send + AI response ─────────────────
  const sendUserMessage = useCallback(async (content: string) => {
    if (inFlightRef.current) return;
    if (!content.trim()) return;
    inFlightRef.current = true;

    // Snapshot history BEFORE pushing the new user message so we can
    // send it as prior-turns context to the LLM. This is the memory fix.
    const priorHistory = historyRef.current;
    pushUserMessage(content);
    setChatOpen(true);
    setThinking(true);

    // Map internal ChatMessage roles ("nex" / "user") to the OpenAI-
    // style roles the API expects ("assistant" / "user"). Skip any
    // fallback / error messages that shouldn't inform the LLM.
    const historyForApi = priorHistory
      .filter((m) => m.role === "user" || m.role === "nex")
      .map((m) => ({
        role:    m.role === "nex" ? ("assistant" as const) : ("user" as const),
        content: m.content
      }));

    if (config.trade_slug === "staircase") {
      try {
        const res = await fetch("/api/nex/staircase-chat", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            message: content,
            history: historyForApi
          })
        });
        const j = await res.json();
        if (j.ok && j.answer) {
          const woodCards: WoodCardSummary[] | undefined =
            Array.isArray(j.wood_cards) && j.wood_cards.length > 0 && j.visual_intent !== "procedural"
              ? j.wood_cards as WoodCardSummary[]
              : undefined;
          pushNexMessage(String(j.answer), { wood_cards: woodCards });
        } else {
          pushNexMessage("Something's not quite right my end — give me a second and try that again.");
        }
      } catch {
        pushNexMessage("I'm having a slow moment — try that again in a second.");
      }
    } else {
      pushNexMessage(`I'm still learning about ${config.trade_slug} and I don't want to guess. Take my details and pass this to the team, or ask me about a related area I can help with confidently.`);
    }
    setThinking(false);
    inFlightRef.current = false;
  }, [config.trade_slug, pushUserMessage, pushNexMessage]);

  // ─── Chat panel visibility ─────────────────────────────────────
  const openChat  = useCallback(() => setChatOpen(true), []);
  const closeChat = useCallback(() => setChatOpen(false), []);
  const toggleChat = useCallback(() => setChatOpen((o) => !o), []);

  const value = useMemo<StateCtx>(() => ({
    config,
    state, canvasPayload, transitionPending,
    history, chatOpen, thinking,
    transitionTo, activateQuickAction, sendUserMessage,
    openChat, closeChat, toggleChat
  }), [config, state, canvasPayload, transitionPending, history, chatOpen, thinking,
       transitionTo, activateQuickAction, sendUserMessage,
       openChat, closeChat, toggleChat]);

  return (
    <ConversationStateContext.Provider value={value}>
      {children}
    </ConversationStateContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────
export function useConversationState(): StateCtx {
  const ctx = useContext(ConversationStateContext);
  if (!ctx) throw new Error("useConversationState must be used inside a ConversationStateProvider");
  return ctx;
}
