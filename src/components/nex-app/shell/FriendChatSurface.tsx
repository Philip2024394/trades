// src/components/nex-app/shell/FriendChatSurface.tsx
//
// Stage 3.41.a · NEX Chat front-door surface (Philip 2026-08-31).
//
// Self-contained · mobile-first · zero page-eject:
//   · Header with NEX identity
//   · Scrolling message list · NEX bubbles show friend-voice text +
//     inline world cards + proposal buttons + terminal audit pill
//   · Sticky bottom composer
//   · Button clicks route through the SAME sendUserMessage as typed
//     input (constitutional · no parallel authorization path)
//
// Deliberately does NOT touch the existing 10K-line /nex-app/chat/page.
// This is a clean surface that showcases the artifacts. The existing
// page can be migrated later once this pattern is validated in use.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNexChat, type NexChatMessage } from "./useNexChat";
import { WorldCardsInline }        from "./WorldCardsInline";
import { ActionProposalPrompt }    from "./ActionProposalPrompt";
import { ActionAuditPill }         from "./ActionAuditPill";
import { Send } from "lucide-react";

// Stage 3.41.c · Intent-aware status hint (Philip 2026-08-31).
// Deterministic peek at the most recent user turn so the header can
// say what NEX is *doing*, not just that it's thinking. Never invents
// a status · falls back to "thinking…" when uncertain.
function pickThinkingStatus(lastUserMessage: string, lang: "en" | "id"): string {
  const m = lastUserMessage.toLowerCase();
  if (/\b(find|show|search|cari|tampilkan)\b/.test(m)) {
    return lang === "id" ? "melihat World…" : "reading the World…";
  }
  if (/\b(compare|vs|versus|bandingkan)\b/.test(m)) {
    return lang === "id" ? "membandingkan…" : "comparing…";
  }
  if (/\b(recommend|best|which|paling bagus|rekomendasi)\b/.test(m)) {
    return lang === "id" ? "berpikir…" : "weighing them up…";
  }
  if (/\b(message|hubungi|kirim|contact)\b/.test(m)) {
    return lang === "id" ? "menyiapkan pesan…" : "getting the message ready…";
  }
  if (/^\s*(yes|iya|ya|kirim|no|jangan|batal)/i.test(m)) {
    return lang === "id" ? "menjalankan…" : "on it…";
  }
  return lang === "id" ? "sedang mikir…" : "thinking…";
}

export type FriendChatSurfaceProps = {
  market?:   "ID" | "UK" | "US";
  language?: "en" | "id";
  userId?:   string;
  /** Greeting shown as the first NEX bubble before any user turn. */
  greeting?: string;
};

export function FriendChatSurface({
  market = "ID",
  language = "en",
  userId,
  greeting,
}: FriendChatSurfaceProps) {
  const { conversationId, messages, sending, sendUserMessage } = useNexChat({ market, language, userId });
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Peek at the most recent user turn (not including the current NEX turn
  // in flight) so the header can show what NEX is *doing*, not just that
  // it's thinking. Cached against messages length so we don't re-scan
  // history every render.
  const lastUserText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i].text;
    }
    return "";
  }, [messages]);
  const status = sending
    ? pickThinkingStatus(lastUserText, language)
    : (language === "id" ? "siap" : "here");

  // Auto-scroll to bottom on any new message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, sending]);

  const submit = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    await sendUserMessage(text);
  }, [draft, sending, sendUserMessage]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }, [submit]);

  // Button-click helpers · route through the same send path so the
  // 3.37 authorization gate handles them identically to typed "yes"/"no".
  const onConfirm = useCallback(() => {
    void sendUserMessage(language === "id" ? "iya kirim" : "yes send it");
  }, [sendUserMessage, language]);
  const onDecline = useCallback(() => {
    void sendUserMessage(language === "id" ? "jangan" : "no");
  }, [sendUserMessage, language]);

  // Placeholder + greeting text (localised).
  const placeholder = language === "id"
    ? "Ketik pesan… (Enter kirim)"
    : "Type a message… (Enter to send)";
  const greetingText = greeting ?? (language === "id"
    ? "Halo — mau ngapain nih?"
    : "Hey — what are we doing?");

  return (
    <div
      className="flex h-dvh w-full flex-col"
      style={{
        background:      "var(--nex-cream, #FDFCF9)",
        // Respect the iOS notch + Android status bar at the top and the
        // home indicator at the bottom. env() is a no-op on desktop.
        paddingTop:      "env(safe-area-inset-top)",
        paddingBottom:   "env(safe-area-inset-bottom)",
      }}
      data-testid="friend-chat-surface"
      data-conversation-id={conversationId ?? ""}
      data-status={sending ? "thinking" : "here"}
    >
      {/* Header · thin, friendly, not a dashboard.
          Sticky so users always see the status even while scrolling. */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 backdrop-blur-sm"
        style={{
          background:   "rgba(253, 252, 249, 0.85)",  // cream w/ translucency
          borderBottom: "1px solid var(--nex-neutral-200, #eee)",
        }}
      >
        <div
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-bold text-white"
          style={{ background: "var(--nex-accent-500, #F97316)" }}
        >
          N
          {/* Subtle pulse ring when NEX is thinking · never a spinner,
              which reads too dashboardy for a friend chat. */}
          {sending && (
            <span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                boxShadow: "0 0 0 2px rgba(249, 115, 22, 0.35)",
                animation: "nex-talk-pulse 1400ms ease-in-out infinite",
              }}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold leading-tight" style={{ color: "var(--nex-neutral-900, #111)" }}>NEX</div>
          <div
            className="text-[11px] leading-tight transition-opacity duration-200"
            style={{ color: sending ? "var(--nex-accent-500, #F97316)" : "var(--nex-neutral-500, #666)" }}
            data-testid="header-status"
          >
            {status}
          </div>
        </div>
        {/* Local keyframes so we don't require a global CSS edit. */}
        <style jsx>{`
          @keyframes nex-talk-pulse {
            0%,100% { opacity: 0.35; transform: scale(1);   }
            50%     { opacity: 0.75; transform: scale(1.15); }
          }
        `}</style>
      </div>

      {/* Message stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4" data-testid="chat-messages">
        {messages.length === 0 && (
          <NexBubble text={greetingText} timestamp={Date.now()} />
        )}
        {messages.map((m) => (
          <MessageRow key={m.id} m={m} onConfirm={onConfirm} onDecline={onDecline} disabled={sending} />
        ))}
      </div>

      {/* Composer · sticky bottom · 44px+ touch targets · avoids the
          home indicator via the outer safe-area padding. */}
      <div
        className="flex items-end gap-2 px-3 py-2"
        style={{
          background:  "var(--nex-cream, #FDFCF9)",
          borderTop:   "1px solid var(--nex-neutral-200, #eee)",
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={sending || !conversationId}
          className="min-h-[44px] max-h-[120px] flex-1 resize-none rounded-2xl border px-3 py-2 text-[14px] leading-[1.45] outline-none"
          style={{
            borderColor: "var(--nex-neutral-300, #d4d4d4)",
            background:  "#fff",
            color:       "var(--nex-neutral-900, #111)",
          }}
          data-testid="chat-composer"
        />
        <button
          type="button"
          onClick={submit}
          disabled={sending || !draft.trim() || !conversationId}
          aria-label={language === "id" ? "Kirim pesan" : "Send message"}
          className="flex h-11 min-w-[44px] items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-white transition-opacity disabled:opacity-40"
          style={{ background: "var(--nex-accent-500, #F97316)" }}
          data-testid="chat-send"
        >
          <Send size={16} strokeWidth={2.4} />
          <span className="hidden sm:inline">{language === "id" ? "Kirim" : "Send"}</span>
        </button>
      </div>
    </div>
  );
}

// ─── Message row ────────────────────────────────────────────────────

function MessageRow({
  m, onConfirm, onDecline, disabled,
}: {
  m: NexChatMessage;
  onConfirm: () => void;
  onDecline: () => void;
  disabled: boolean;
}) {
  if (m.role === "user") return <UserBubble text={m.text} timestamp={m.timestamp} />;
  return (
    <div data-testid="nex-message" data-message-id={m.id}>
      <NexBubble text={m.text} timestamp={m.timestamp} errored={m.errored}>
        {m.artifacts?.worldCards && m.artifacts.worldCards.length > 0 && (
          <WorldCardsInline cards={m.artifacts.worldCards} />
        )}
        {m.artifacts?.pendingProposal && (
          <ActionProposalPrompt
            proposal={m.artifacts.pendingProposal}
            disabled={disabled}
            onConfirm={onConfirm}
            onDecline={onDecline}
          />
        )}
        {m.artifacts?.audit && <ActionAuditPill audit={m.artifacts.audit} />}
      </NexBubble>
    </div>
  );
}

function UserBubble({ text, timestamp }: { text: string; timestamp: number }) {
  const time = new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="mb-3 flex flex-col items-end" data-testid="user-bubble">
      <span className="mb-1 pr-1 text-[10px]" style={{ color: "var(--nex-neutral-500, #666)" }}>{time}</span>
      <div
        className="max-w-[85%] rounded-2xl px-3.5 py-2 text-[14px] leading-[1.45]"
        style={{
          background:            "var(--nex-accent-50, #ffedd5)",
          color:                 "var(--nex-neutral-900, #111)",
          borderBottomRightRadius: 6,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function NexBubble({
  text, timestamp, errored, children,
}: {
  text: string;
  timestamp: number;
  errored?: boolean;
  children?: React.ReactNode;
}) {
  const time = new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="mb-3 flex items-start gap-2">
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
        style={{ background: "var(--nex-accent-500, #F97316)" }}
      >
        N
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[12px] font-bold" style={{ color: "var(--nex-neutral-900, #111)" }}>NEX</span>
          <span className="text-[10px]" style={{ color: "var(--nex-neutral-500, #666)" }}>{time}</span>
        </div>
        <div
          className="whitespace-pre-wrap text-[14px] leading-[1.5]"
          style={{ color: errored ? "var(--nex-neutral-700, #444)" : "var(--nex-neutral-900, #111)" }}
        >
          {text}
        </div>
        {children}
      </div>
    </div>
  );
}
