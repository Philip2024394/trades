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
import {
  classifyIntent,
  greetingReply,
  goodbyeReply,
  thanksReply,
  availabilityReply,
  identityReply,
  frustrationReply,
  SOCIAL_INTENTS,
} from "../shell/classifyIntent";
// Stage 3.41.b · consume the artifacts /api/nex-conv/chat returns
// (voice_reply · world_cards · pending_proposal_snapshot · action_audit).
import { mapChatResponseToArtifacts, extractVoiceReplyID, type ChatArtifacts } from "../shell/chat-artifacts";

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
  // Stage 3.41.b · Chat surface integration ·
  // NEX-turn artifacts extracted from /api/nex-conv/chat response.
  // Present on assistant turns whose response carries any of:
  //   · voice_reply (friend-voice text)
  //   · world_cards (inline card carousel)
  //   · pending_proposal_snapshot (confirm/decline UI)
  //   · action_audit (terminal state pill)
  // Absent on user turns · absent on legacy staircase turns.
  nex_artifacts?: ChatArtifacts;
  // Error flag · muted rendering + suppression from LLM history.
  errored?:   boolean;
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

// ─── Pure helpers · Stage 3.41.b · testable without React DOM ─────

export type ChatApiHistoryTurn = { role: "assistant" | "user"; content: string };

export type ChatApiRequestBody = {
  message:         string;
  conversation_id: string;
  history:         ChatApiHistoryTurn[];
  intent?:         string;
  market:          "ID" | "UK" | "US";
  useLiveWorld:    boolean;
};

/**
 * Build the exact JSON body /api/nex-conv/chat expects. Extracted so
 * tests can assert the payload shape without mounting React. The
 * button-flow guarantee is enforced here: whether the user typed
 * "yes send it" or clicked the Yes button (which calls the same
 * sendUserMessage), the payload is identical.
 */
export function buildChatRequestBody(input: {
  message:        string;
  conversationId: string;
  history:        ChatApiHistoryTurn[];
  intent?:        string;
  market?:        "ID" | "UK" | "US";
  useLiveWorld?:  boolean;
}): ChatApiRequestBody {
  return {
    message:         input.message,
    conversation_id: input.conversationId,
    history:         input.history,
    intent:          input.intent,
    market:          input.market ?? "ID",
    useLiveWorld:    input.useLiveWorld ?? true,
  };
}

/**
 * Turn the raw /api/nex-conv/chat JSON response into the pair of
 * (renderedText, artifacts) that pushNexMessage needs. Prefers
 * voice_reply text · falls back to base reply · falls back to legacy
 * `answer` field for staircase-flow responses. Pure · testable.
 */
export function parseChatResponseForRender(json: unknown, opts: { language?: "en" | "id" } = {}): {
  text: string;
  artifacts: ChatArtifacts;
} {
  const j = (json ?? {}) as Record<string, unknown>;
  const artifacts = mapChatResponseToArtifacts(j);
  const voice = opts.language === "id" ? extractVoiceReplyID(j.voice_reply) : artifacts.voiceReply;
  const base  = typeof j.reply === "string" ? j.reply
              : typeof j.answer === "string" ? j.answer
              : "";
  return {
    text: voice?.text ?? base,
    artifacts: { ...artifacts, voiceReply: voice ?? artifacts.voiceReply },
  };
}

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

  // Golden Reply retrieval plumbing (Patch A · 2026-07-29).
  // conversationIdRef is stable for the lifetime of the provider, so
  // every telemetry row can be joined into a single conversation on
  // the server. recentGoldenIdsRef tracks the last few retrieved IDs
  // so the server can exclude them on the next turn — prevents the
  // same 3 examples reappearing across 10 turns of price discussion.
  //
  // Init runs inside an effect (not during render body) so SSR and
  // strict-mode double-invocation don't try to mutate refs while
  // rendering. Empty string until the first client tick — the server
  // will mint one and echo it back if we send empty, so no lost
  // telemetry.
  const conversationIdRef = useRef<string>("");
  const recentGoldenIdsRef = useRef<string[]>([]);
  useEffect(() => {
    if (conversationIdRef.current) return;
    try {
      conversationIdRef.current =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    } catch {
      conversationIdRef.current = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
  }, []);
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
    opts?: {
      transitioned_to?: ConversationState;
      wood_cards?:     WoodCardSummary[];
      nex_artifacts?:  ChatArtifacts;
      errored?:        boolean;
    }
  ) => {
    setHistory((h) => [...h, {
      id:              `m${nextIdRef.current++}`,
      role:            "nex",
      content,
      timestamp:       Date.now(),
      transitioned_to: opts?.transitioned_to,
      wood_cards:      opts?.wood_cards,
      nex_artifacts:   opts?.nex_artifacts,
      errored:         opts?.errored ?? false
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

    // Short-circuit pure social intents — greeting · goodbye · thanks ·
    // availability_check must NEVER hit the Reference Brain retrieval
    // API (Philip 2026-07-29 · Conversation Intelligence Library
    // priority 1-4). Mixed messages ("good morning, I need an oak
    // staircase") flow through to the composer because the classifier
    // has already routed them to a technical intent.
    const { intent: userIntent } = classifyIntent(content);
    if (SOCIAL_INTENTS.has(userIntent)) {
      // Small deliberate delay so the ThinkingIndicator's beat is
      // visible — feels like a reply, not an autoresponder.
      await new Promise((r) => window.setTimeout(r, 450));
      const reply =
        userIntent === "greeting"           ? greetingReply(content) :
        userIntent === "goodbye"            ? goodbyeReply(content) :
        userIntent === "thanks"             ? thanksReply(content) :
        userIntent === "identity"           ? identityReply(content) :
        userIntent === "frustration"        ? frustrationReply(content) :
        /* availability_check */              availabilityReply();
      pushNexMessage(reply);
      setThinking(false);
      inFlightRef.current = false;
      return;
    }

    // Stage 3.41.b · Chat surface integration (Philip 2026-08-31).
    //
    // Every non-social turn now flows through /api/nex-conv/chat · the
    // canonical NEX Brain endpoint. That endpoint returns:
    //   · voice_reply               friend-voice text
    //   · world_cards               inline card carousel
    //   · pending_proposal_snapshot confirm/decline UI hook
    //   · action_audit              terminal state pill
    // We store the artifacts on the NEX ChatMessage so the ChatBubble
    // can render them inline. Base reply stays available as `content`
    // fallback for consumers that don't understand artifacts.
    //
    // UK staircase remains handled inside /api/nex-conv/chat via its
    // built-in fallthrough (route.ts line ~250 · Qwen pipeline preserved)
    // so we don't need trade-slug branching client-side.
    try {
      const res = await fetch("/api/nex-conv/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(buildChatRequestBody({
          message:        content,
          conversationId: conversationIdRef.current,
          history:        historyForApi,
          intent:         userIntent,
          market:         "ID",
          useLiveWorld:   true,
        })),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j) {
        pushNexMessage("Something's not quite right my end — give me a second and try that again.", { errored: true });
      } else {
        const artifacts = mapChatResponseToArtifacts(j);
        // Prefer voice_reply text · fall back to base reply · fall back
        // to legacy `answer` field so staircase specialist responses
        // (if they still come through) still render.
        const voice = artifacts.voiceReply?.text;
        const base  = typeof j.reply === "string" ? j.reply
                    : typeof j.answer === "string" ? j.answer
                    : "";
        const text  = voice ?? base;
        pushNexMessage(text || "…", { nex_artifacts: artifacts });
      }
    } catch {
      pushNexMessage("I'm having a slow moment — try that again in a second.", { errored: true });
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
