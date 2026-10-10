// src/components/nex-native/directory/ListingChatPanel.tsx
//
// NEX Directory · Card-refresh wave · Listing Chat Panel (visitor side).
//
// What this component is
//   · The chat surface that lives INSIDE the Directory slide-up panel.
//   · Visitor <-> business-owner two-party envelope on top of the sealed
//     `nex.listing_thread` + `nex.listing_message` library at
//     src/lib/nex/listing-chat/index.ts.
//
// What this component is NOT
//   · Not a NEX peer chat (Vault / peer_message system is separate).
//   · Not a public conversation surface. Doctrine #7 posture: the only
//     two readers are the visitor who authored the message and the
//     eventual owner who claims the listing.
//
// Integration contract (Agent C delivers · we degrade gracefully if not):
//   · openListingThreadAction({ canonicalId, body })
//       → { ok: true, thread_id, system_bubble } | { ok: false, reason }
//   · listMessagesAction({ canonicalId })
//       → { ok: true, messages } | { ok: false, reason }
//   · sendMessageAction({ canonicalId, body })
//       → { ok: true, message_id } | { ok: false, reason }
//
// Fabrication discipline
//   · If an action is missing, we show "Message sending…" / "Pending"
//     instead of fabricating a delivery.
//   · First-send against an UNCLAIMED listing shows a system_bubble
//     preview (NOT yet persisted) at the top of the thread. It never
//     appears alongside real sender messages — only before the visitor's
//     first message exists in the DB.

"use client";

import type * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any -- Agent C's
   server-action module is loaded dynamically so that the Directory UI
   compiles even when the action file hasn't been authored yet. The
   dynamic shape is validated at runtime via the `ok` discriminator. */

const PALETTE = {
  surface: "#0E1526",
  surfaceHi: "#182540",
  surfaceLow: "#060B1A",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  textSoft: "#4B6683",
  orange: "#FF7200",
  orangeFaint: "rgba(255,114,0,0.14)",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0,175,255,0.10)",
  borderSoft: "rgba(255,255,255,0.08)",
  danger: "#F0556F",
} as const;

export interface ChatMessageVM {
  readonly message_id: string;
  readonly from_role: "sender" | "owner" | "system";
  readonly body: string;
  readonly sent_at: string;
}

export interface ListingChatPanelProps {
  readonly canonicalId: string;
  readonly listingName: string;
  readonly claimed: boolean;
}

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; messages: readonly ChatMessageVM[]; systemPreview: string | null }
  | { kind: "error"; reason: string };

type SendState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "error"; reason: string };

// ─────────────────────────────────────────────────────────────────────
// Dynamic action loader · degrades gracefully when Agent C hasn't landed.
// ─────────────────────────────────────────────────────────────────────

interface ListingChatActions {
  openListingThreadAction?: (args: {
    canonicalId: string;
    body: string;
  }) => Promise<any>;
  listMessagesAction?: (args: {
    canonicalId: string;
  }) => Promise<any>;
  sendMessageAction?: (args: {
    canonicalId: string;
    body: string;
  }) => Promise<any>;
}

async function loadActions(): Promise<ListingChatActions | null> {
  try {
    // Dynamic import so the module graph tolerates Agent C's file not
    // existing yet in the current working tree.
    const mod = (await import(
      "@/lib/nex-native/directory/listing-chat-actions"
    )) as ListingChatActions;
    return mod;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────

export function ListingChatPanel(props: ListingChatPanelProps): React.ReactElement {
  const { canonicalId, listingName, claimed } = props;

  const [load, setLoad] = useState<LoadState>({ kind: "idle" });
  const [send, setSend] = useState<SendState>({ kind: "idle" });
  const [draft, setDraft] = useState<string>("");

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const actionsRef = useRef<ListingChatActions | null>(null);

  // ───────── initial load ─────────
  useEffect(() => {
    let cancelled = false;
    setLoad({ kind: "loading" });
    void (async () => {
      const actions = await loadActions();
      if (cancelled) return;
      actionsRef.current = actions;
      if (!actions?.listMessagesAction) {
        // Degrade gracefully · Agent C action pending
        setLoad({
          kind: "ready",
          messages: [],
          systemPreview: claimed
            ? null
            : buildPendingSystemPreview(listingName),
        });
        return;
      }
      try {
        const res = await actions.listMessagesAction({ canonicalId });
        if (cancelled) return;
        if (res && res.ok === true) {
          const msgs = Array.isArray(res.messages)
            ? (res.messages as ChatMessageVM[])
            : [];
          const hasSenderMessage = msgs.some((m) => m.from_role === "sender");
          setLoad({
            kind: "ready",
            messages: msgs,
            systemPreview:
              !claimed && !hasSenderMessage
                ? buildPendingSystemPreview(listingName)
                : null,
          });
        } else {
          setLoad({
            kind: "error",
            reason:
              typeof res?.reason === "string"
                ? res.reason
                : "could_not_load_thread",
          });
        }
      } catch {
        if (cancelled) return;
        setLoad({ kind: "error", reason: "could_not_load_thread" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canonicalId, claimed, listingName]);

  // ───────── auto-scroll to bottom on new messages ─────────
  useEffect(() => {
    if (load.kind === "ready" && scrollRef.current !== null) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [load]);

  // ───────── send ─────────
  const onSend = useCallback(async () => {
    const body = draft.trim();
    if (body.length === 0) return;
    if (send.kind === "sending") return;
    setSend({ kind: "sending" });

    const actions = actionsRef.current;
    const existingMessages: readonly ChatMessageVM[] =
      load.kind === "ready" ? load.messages : [];
    const hasSenderMessage = existingMessages.some(
      (m) => m.from_role === "sender",
    );
    const isFirstSend = !hasSenderMessage;

    // Optimistic draft bubble so the visitor always sees the message
    // land, even while the server action is in flight. If the action
    // module is absent, the optimistic bubble carries a "Pending"
    // marker (never pretend a delivery that never happened).
    const optimisticId = `optimistic:${Date.now()}`;
    const optimistic: ChatMessageVM = {
      message_id: optimisticId,
      from_role: "sender",
      body,
      sent_at: new Date().toISOString(),
    };
    setLoad((prev) =>
      prev.kind === "ready"
        ? {
            kind: "ready",
            messages: [...prev.messages, optimistic],
            // Once the sender has at least one message, the pending
            // system preview is retired (per spec).
            systemPreview: null,
          }
        : prev,
    );
    setDraft("");

    if (!actions) {
      // No action module. Keep the optimistic bubble but flag as pending.
      setSend({ kind: "error", reason: "actions_pending" });
      return;
    }

    try {
      let res: any;
      if (isFirstSend && actions.openListingThreadAction) {
        res = await actions.openListingThreadAction({ canonicalId, body });
      } else if (actions.sendMessageAction) {
        res = await actions.sendMessageAction({ canonicalId, body });
      } else if (actions.openListingThreadAction) {
        // Fallback: openThread handles writing a message on first call
        res = await actions.openListingThreadAction({ canonicalId, body });
      } else {
        setSend({ kind: "error", reason: "actions_pending" });
        return;
      }

      if (res && res.ok === true) {
        setSend({ kind: "idle" });
      } else {
        setSend({
          kind: "error",
          reason:
            typeof res?.reason === "string" ? res.reason : "send_failed",
        });
      }
    } catch {
      setSend({ kind: "error", reason: "send_failed" });
    }
  }, [canonicalId, draft, load, send.kind]);

  const onComposerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter sends; Shift+Enter inserts newline. Mobile-friendly.
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void onSend();
      }
    },
    [onSend],
  );

  // ───────── render ─────────
  return (
    <div
      data-nex-directory-chat-panel
      data-nex-directory-chat-claimed={claimed ? "true" : "false"}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 0,
        flex: 1,
      }}
    >
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label={`Conversation with ${listingName}`}
        style={{
          flex: 1,
          minHeight: 160,
          maxHeight: "48vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "6px 2px",
        }}
      >
        {load.kind === "loading" ? (
          <ChatMuted text="Loading conversation…" />
        ) : null}
        {load.kind === "error" ? (
          <ChatMuted
            text={`Could not load conversation (${load.reason}).`}
            tone="danger"
          />
        ) : null}
        {load.kind === "ready" ? (
          <>
            {load.systemPreview !== null ? (
              <SystemBubble
                body={load.systemPreview}
                pending
              />
            ) : null}
            {load.messages.length === 0 && load.systemPreview === null ? (
              <ChatMuted text="No messages yet." />
            ) : null}
            {load.messages.map((m) => (
              <MessageBubble key={m.message_id} message={m} />
            ))}
          </>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          borderTop: `1px solid ${PALETTE.borderSoft}`,
          paddingTop: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
          }}
        >
          <textarea
            ref={composerRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onComposerKeyDown}
            placeholder={`Message ${listingName}`}
            rows={1}
            data-nex-directory-chat-composer
            aria-label="Message composer"
            style={{
              flex: 1,
              resize: "none",
              background: PALETTE.surfaceLow,
              color: PALETTE.text,
              border: `1px solid ${PALETTE.borderSoft}`,
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 14,
              lineHeight: 1.35,
              minHeight: 40,
              maxHeight: 120,
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <button
            type="button"
            onClick={() => void onSend()}
            disabled={draft.trim().length === 0 || send.kind === "sending"}
            data-nex-directory-chat-send
            data-nex-directory-chat-send-state={send.kind}
            style={{
              background:
                draft.trim().length === 0
                  ? PALETTE.surfaceHi
                  : PALETTE.orange,
              color:
                draft.trim().length === 0 ? PALETTE.textSoft : "#1A0F00",
              border: "none",
              borderRadius: 10,
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor:
                draft.trim().length === 0 || send.kind === "sending"
                  ? "not-allowed"
                  : "pointer",
              minHeight: 40,
              letterSpacing: "0.02em",
            }}
          >
            {send.kind === "sending" ? "Sending…" : "Send"}
          </button>
        </div>
        {send.kind === "error" ? (
          <div
            data-nex-directory-chat-send-error
            style={{
              fontSize: 11,
              color:
                send.reason === "actions_pending"
                  ? PALETTE.textMuted
                  : PALETTE.danger,
            }}
          >
            {send.reason === "actions_pending"
              ? "Message sending… (pending backend)"
              : `Could not send (${send.reason}).`}
          </div>
        ) : null}
        <div
          data-nex-directory-chat-doctrine-footer
          style={{
            fontSize: 11,
            color: PALETTE.textSoft,
            lineHeight: 1.4,
          }}
        >
          Only you and the business owner see this conversation.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Bubbles
// ─────────────────────────────────────────────────────────────────────

function MessageBubble(props: { readonly message: ChatMessageVM }): React.ReactElement {
  const { message } = props;
  if (message.from_role === "system") {
    return <SystemBubble body={message.body} pending={false} />;
  }
  const isSender = message.from_role === "sender";
  return (
    <div
      data-nex-directory-chat-message
      data-nex-directory-chat-message-role={message.from_role}
      style={{
        display: "flex",
        justifyContent: isSender ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          maxWidth: "82%",
          background: isSender ? PALETTE.orangeFaint : PALETTE.cyanFaint,
          border: `1px solid ${isSender ? PALETTE.orange : PALETTE.cyan}`,
          color: PALETTE.text,
          borderRadius: 12,
          padding: "8px 12px",
          fontSize: 13.5,
          lineHeight: 1.4,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {message.body}
      </div>
    </div>
  );
}

function SystemBubble(props: {
  readonly body: string;
  readonly pending: boolean;
}): React.ReactElement {
  return (
    <div
      data-nex-directory-chat-message
      data-nex-directory-chat-message-role="system"
      data-nex-directory-chat-message-pending={props.pending ? "true" : "false"}
      style={{
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          maxWidth: "92%",
          background: "transparent",
          color: PALETTE.textMuted,
          borderRadius: 8,
          padding: "6px 10px",
          fontSize: 12.5,
          lineHeight: 1.4,
          fontStyle: "italic",
          textAlign: "center",
        }}
      >
        <span style={{ marginRight: 6 }} aria-hidden="true">💬</span>
        {props.body}
      </div>
    </div>
  );
}

function ChatMuted(props: {
  readonly text: string;
  readonly tone?: "neutral" | "danger";
}): React.ReactElement {
  return (
    <div
      style={{
        color: props.tone === "danger" ? PALETTE.danger : PALETTE.textMuted,
        fontSize: 12.5,
        textAlign: "center",
        padding: "16px 8px",
      }}
    >
      {props.text}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Pending-system-bubble builder · honest, non-fabricated.
// ─────────────────────────────────────────────────────────────────────

/**
 * Pre-filled, visitor-visible system bubble shown ABOVE the empty
 * thread for unclaimed listings. This is a UI preview only — the real
 * system bubble that gets persisted is produced server-side by Agent
 * C's `openListingThreadAction` and is returned as `system_bubble` on
 * the first open. We display a shape-compatible preview inline until
 * then; the preview carries the `pending` flag so a future test or
 * instrument can tell it apart from a persisted system message.
 */
function buildPendingSystemPreview(listingName: string): string {
  return (
    `This listing isn't claimed on NEX yet. Your message will be ` +
    `delivered to ${listingName} when the owner claims it. Only you ` +
    `and the owner will ever see this conversation.`
  );
}
