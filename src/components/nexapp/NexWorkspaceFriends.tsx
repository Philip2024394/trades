// NEX Workspace · FRIENDS artifact.
//
// Renders inside the CENTRE workspace zone when the user opens Friends.
// Migrated from the old NexAppHome's NexPendingChats + NexFriendChatView
// per the "move functionality NOT the old UI" rule. Reuses the mock data
// (NEX_MOCK_FRIENDS / NEX_MOCK_FRIEND_THREADS) but paints in the new
// template's visual language.
//
// Doctrine anchor: project_nex_workspace_identity_doctrine_2026_08_25.
//
// FIRST-PASS SCOPE: list view + read-only thread view. Sending, real
// message pipeline, and thread mutations are deferred to a later pass
// (they need the composer + voice hookup that also remain deferred).

"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Smile, MoreHorizontal, BellOff, Pin, Phone, Video, Ban, Share2, Users as UsersIcon,
  Image as ImageIcon, Video as VideoIcon, FileText, Sparkles, Check,
} from "lucide-react";
import {
  NEX_MOCK_FRIENDS,
  NEX_MOCK_FRIEND_THREADS,
  type FriendMessage,
  type MockFriend,
} from "./NexPendingChats";
import { NexFriendChatView } from "./NexFriendChatView";
import { listAllWithArtwork } from "@/lib/nex-mascots/registry";
import { TouchButton } from "./primitives/TouchButton";

// Status colours · used for the avatar presence ring + status dot.
const STATUS_COLOR: Record<MockFriend["status"], string> = {
  online:  "#22c55e",
  typing:  "#22c55e",
  away:    "#f59e0b",
  offline: "rgba(245,245,245,0.28)",
};

// ISO 3166-1 alpha-2 country code → flag emoji (regional-indicator pair).
// Empty / invalid → empty string · caller decides fallback.
function flagFor(code: string | undefined): string {
  if (!code || code.length !== 2) return "";
  const cc = code.toUpperCase();
  const a = cc.charCodeAt(0), b = cc.charCodeAt(1);
  if (a < 65 || a > 90 || b < 65 || b > 90) return "";
  return String.fromCodePoint(0x1F1E6 + (a - 65), 0x1F1E6 + (b - 65));
}

// Message-kind icon + fallback text preview for non-text lastMessage.
function MessageKindIcon({ kind }: { kind: MockFriend["lastMessage"] extends { kind: infer K } ? K : never }) {
  const props = { size: 12, strokeWidth: 2 } as const;
  if (kind === "photo") return <ImageIcon {...props} />;
  if (kind === "video") return <VideoIcon {...props} />;
  if (kind === "file")  return <FileText  {...props} />;
  if (kind === "mascot")return <Sparkles  {...props} />;
  return null;
}

interface NexWorkspaceFriendsProps {
  /** When provided, the workspace opens directly on that friend's chat
   *  thread instead of the list. Used by the kebab quick-panel so a
   *  friend-card tap lands straight in the conversation. */
  initialFriendId?: string | null;
  /** Controlled active friend id (from the shell). If provided, the
   *  workspace defers to the parent for open/close and reports changes
   *  via `onActiveFriendChange` — so the shell knows when a friend chat
   *  is open and can route composer submits into that thread. */
  activeFriendId?: string | null;
  onActiveFriendChange?: (id: string | null) => void;
  /** Live per-friend thread map (from the shell) so submitted messages
   *  appear in the chat. Falls back to the static mock threads when the
   *  shell doesn't own the state. */
  threads?: Record<string, FriendMessage[]>;
  /** Reply target · when set, the corresponding message is highlighted
   *  and a compact reply preview shows above the composer. Shell owns
   *  the state so the composer submit can attach the replyTo id. */
  replyTarget?: FriendMessage | null;
  onReplyTargetChange?: (target: FriendMessage | null) => void;
  /** Read-tracking handlers · shell mutates the threads state.
   *  onMarkThreadRead fires when the friend chat opens (auto-clear).
   *  onToggleMessageRead fires from the ⋮ menu (manual flip). */
  onMarkThreadRead?: (friendId: string) => void;
  onToggleMessageRead?: (friendId: string, messageId: string) => void;
  /** Delete a message from a friend's thread · Philip 2026-09-02. */
  onDeleteMessage?: (friendId: string, messageId: string) => void;
  /** Add an emoji reaction from the user to a specific message. */
  onAddReaction?: (friendId: string, messageId: string, emoji: string) => void;
  /** Toggle save state on a message. */
  onToggleSaved?: (friendId: string, messageId: string) => void;
  /** Toggle pin state on a message. */
  onTogglePinned?: (friendId: string, messageId: string) => void;
  /** Edit a message's text (user's own messages only). */
  onEditMessage?: (friendId: string, messageId: string, newText: string) => void;
  /** Toggle mute for this friend's notifications. */
  onToggleFriendMute?: (friendId: string) => void;
  /** Which friend ids are currently muted. */
  mutedFriendIds?: Set<string>;
  /** Clear all messages in a friend's thread. */
  onClearChat?: (friendId: string) => void;
  /** True when the user is actively typing in the composer · shows the
   *  typing dots overlay on the user's avatar in the chat header. */
  isUserTyping?: boolean;
  /** Live composer text · shown in the hero as an in-progress reply
   *  preview so the user sees their reply forming (Philip 2026-09-02). */
  userTypingText?: string;
}

export function NexWorkspaceFriends({
  initialFriendId = null,
  activeFriendId: controlledId,
  onActiveFriendChange,
  threads,
  replyTarget,
  onReplyTargetChange,
  onMarkThreadRead,
  onToggleMessageRead,
  onDeleteMessage,
  onAddReaction,
  onToggleSaved,
  onTogglePinned,
  onEditMessage,
  onToggleFriendMute,
  mutedFriendIds,
  onClearChat,
  isUserTyping,
  userTypingText,
}: NexWorkspaceFriendsProps = {}) {
  const [internalId, setInternalId] = useState<string | null>(initialFriendId);
  const activeId = controlledId !== undefined ? controlledId : internalId;
  const setActiveId = (id: string | null) => {
    onActiveFriendChange?.(id);
    if (controlledId === undefined) setInternalId(id);
  };
  const activeThreads = threads ?? NEX_MOCK_FRIEND_THREADS;
  // Per-friend "share my theme" overrides · lives here so the chat
  // view's Share-my-theme toggle flips visibly across renders without
  // needing a real backend. Real theme sync wires when the theme
  // library ships.
  const [themeOverrides, setThemeOverrides] = useState<Record<string, boolean>>({});
  // Per-friend unfriend + block overrides · same pattern as themeOverrides.
  const [unfriendOverrides, setUnfriendOverrides] = useState<Record<string, boolean>>({});
  const [blockOverrides,    setBlockOverrides]    = useState<Record<string, boolean>>({});

  if (activeId) {
    const rawFriend = NEX_MOCK_FRIENDS.find((f) => f.id === activeId);
    const friend = rawFriend
      ? {
          ...rawFriend,
          themeEnabled: themeOverrides[rawFriend.id]   ?? rawFriend.themeEnabled,
          unfriended:   unfriendOverrides[rawFriend.id] ?? rawFriend.unfriended,
          blocked:      blockOverrides[rawFriend.id]    ?? rawFriend.blocked,
        }
      : undefined;
    const thread: FriendMessage[] = activeThreads[activeId] ?? [];
    if (!friend) {
      // Stale/invalid id · fall back to list rather than crash.
      return <FriendsLandscapeList onSelect={setActiveId} />;
    }
    // Philip 2026-09-02 · text-on-transparent chat surface per the
    // reference mock. Header + thread + context menu all live inside
    // NexFriendChatView; the parent shell owns the composer.
    // Left padding = 0 · Philip 2026-09-02 "move all to left side 10px"
    // (removes the 10px inset so the rail column sits flush left).
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "6px 8% 10px 0" }}>
        <NexFriendChatView
          friend={friend}
          messages={thread}
          onClose={() => setActiveId(null)}
          onReply={(msg) => onReplyTargetChange?.(msg)}
          selectedMessageId={replyTarget?.id ?? null}
          onCancelReply={() => onReplyTargetChange?.(null)}
          onMarkThreadRead={() => onMarkThreadRead?.(friend.id)}
          onToggleMessageRead={(mid) => onToggleMessageRead?.(friend.id, mid)}
          onDeleteMessage={(mid) => onDeleteMessage?.(friend.id, mid)}
          onAddReaction={(mid, emoji) => onAddReaction?.(friend.id, mid, emoji)}
          onToggleSaved={(mid) => onToggleSaved?.(friend.id, mid)}
          onTogglePinned={(mid) => onTogglePinned?.(friend.id, mid)}
          onEditMessage={(mid, newText) => onEditMessage?.(friend.id, mid, newText)}
          onToggleMute={() => onToggleFriendMute?.(friend.id)}
          onToggleTheme={() => setThemeOverrides((p) => ({
            ...p,
            [friend.id]: !(p[friend.id] ?? rawFriend?.themeEnabled ?? false),
          }))}
          onToggleUnfriend={() => setUnfriendOverrides((p) => ({
            ...p,
            [friend.id]: !(p[friend.id] ?? rawFriend?.unfriended ?? false),
          }))}
          onToggleBlock={() => setBlockOverrides((p) => ({
            ...p,
            [friend.id]: !(p[friend.id] ?? rawFriend?.blocked ?? false),
          }))}
          isUnfriended={friend.unfriended ?? false}
          isBlocked={friend.blocked ?? false}
          isMuted={mutedFriendIds?.has(friend.id) ?? false}
          onClearChat={() => onClearChat?.(friend.id)}
          onOpenProfile={() => { /* Stub · profile viewer wires later. */ }}
          onSelectFriend={(id) => setActiveId(id)}
          onAddContactByNexId={(handle) => {
            // Stub · Philip 2026-09-03. Real add-contact flow wires
            // into the identity/registry backend later; for now the
            // handler logs the requested handle so the drawer's
            // affordance is fully clickable end-to-end.
            // eslint-disable-next-line no-console
            console.log("[nex-drawer] add-contact-by-nex-id requested:", handle);
          }}
          isUserTyping={isUserTyping}
          userTypingText={userTypingText}
        />
      </div>
    );
  }

  return <FriendsLandscapeList onSelect={setActiveId} />;
}

// ─────────────────────────────────────────────────────────────────────
// Friend header identity · Philip 2026-09-01.
//   When a friend thread is open, the friend's profile image is shown at
//   the CENTRE of the frame header with their name (or NEX id) below.
//   Portals into .nex-console-viewport so the identity paints in the top
//   bezel strip (not inside the workspace zone). Also injects a scoped
//   CSS override that HIDES the orange header light bar (.nex-header
//   -lights) while this identity is visible — Philip explicitly asked to
//   remove the light from the header centre in this state.
// ─────────────────────────────────────────────────────────────────────
function FriendHeaderIdentity({ friend }: { friend?: { name: string; initial: string; color: string; nexId?: string } }) {
  const [mountEl, setMountEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof document === "undefined") return;
    setMountEl(document.querySelector<HTMLElement>(".nex-console-viewport"));
  }, []);
  if (!mountEl || !friend) return null;
  return createPortal(
    <>
      {/* Orange header-light bar removed from NexHudFrame globally
          (Philip 2026-09-01 · "remove the light in header center orange")
          · no scoped hide needed anymore. */}
      <div
        aria-hidden={false}
        aria-label={`Chat with ${friend.name}`}
        style={{
          position: "absolute",
          top:    "0.6%",
          left:   "50%",
          transform: "translateX(-50%)",
          zIndex: 23, // above the header-light z:22 (redundant safety — light is hidden)
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          pointerEvents: "none",
        }}
      >
        {/* Square profile image · matches the friend-card avatar family */}
        <span
          aria-hidden
          style={{
            width: 30, height: 30,
            borderRadius: 6,
            background: friend.color,
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 6px rgba(0,0,0,0.45)",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        >
          {friend.initial}
        </span>
        <div
          style={{
            fontSize: 9.5,
            lineHeight: 1.1,
            fontWeight: 600,
            color: "rgba(245,245,245,0.9)",
            textShadow: "0 1px 2px rgba(0,0,0,0.6)",
            letterSpacing: 0.2,
          }}
        >
          {friend.nexId ?? friend.name}
        </div>
      </div>
    </>,
    mountEl,
  );
}

// ─────────────────────────────────────────────────────────────────────
// Friend thread bubbles · Philip 2026-09-01.
//   Each bubble:
//     · TOP LEFT: profile image (avatar) + name to the right
//     · Body: message text
//     · Attached mascot (if user picked one via the bottom-right +
//       button) rendered below the text
//     · BOTTOM RIGHT: Smile icon · tap opens the mascot picker · pick a
//       mascot / emoji to attach to that specific bubble
//   Mascot attachments live in local state (per-message id → mascotId /
//   emoji). Later this can persist to a real message store.
// ─────────────────────────────────────────────────────────────────────
function FriendThreadBubbles({ thread, friend }: { thread: FriendMessage[]; friend?: { name: string; initial: string; color: string } }) {
  const [attachments, setAttachments] = useState<Record<string, { kind: "mascot"; url: string; label: string } | { kind: "emoji"; char: string }>>({});
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }} className="nex-no-scrollbar">
      {thread.map((m) => {
        const isUser = m.sender === "user";
        const senderName = isUser ? "You" : (friend?.name ?? "Friend");
        const senderInitial = isUser ? "P" : (friend?.initial ?? "?");
        const senderColor = isUser ? "#f97316" : (friend?.color ?? "#666");
        const attachment = attachments[m.id];
        return (
          <div
            key={m.id}
            style={{
              alignSelf: isUser ? "flex-end" : "flex-start",
              maxWidth: "82%",
              padding: 10,
              borderRadius: 14,
              background: isUser ? "rgba(249,115,22,0.14)" : "rgba(21,21,21,0.85)",
              border: `1px solid ${isUser ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.08)"}`,
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              position: "relative",
            }}
          >
            {/* Top: profile image (LEFT) + name (RIGHT) */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                aria-hidden
                style={{
                  width: 26, height: 26, minWidth: 26,
                  borderRadius: 6,
                  background: senderColor,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {senderInitial}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "rgba(245,245,245,0.92)" }}>
                {senderName}
              </span>
              <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.5 }}>{m.time}</span>
            </div>

            {/* Body */}
            <div style={{ fontSize: 13, lineHeight: 1.35, color: "rgba(245,245,245,0.94)", paddingRight: 24 }}>
              {m.text}
            </div>

            {/* Attached mascot / emoji · Philip 2026-09-01 */}
            {attachment?.kind === "mascot" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attachment.url}
                  alt={attachment.label}
                  width={64}
                  height={64}
                  style={{ borderRadius: 8, objectFit: "cover", background: "rgba(255,255,255,0.03)" }}
                />
                <span style={{ fontSize: 11, color: "rgba(245,245,245,0.65)" }}>{attachment.label}</span>
              </div>
            )}
            {attachment?.kind === "emoji" && (
              <div style={{ fontSize: 32, lineHeight: 1 }}>{attachment.char}</div>
            )}

            {/* Bottom-right icon · opens mascot picker */}
            <TouchButton
              aria-label="Add mascot or emoji"
              onTap={() => setPickerFor(m.id)}
              enforceMinTouchTarget
              style={{
                position: "absolute",
                right: 8,
                bottom: 8,
                width: 22,
                height: 22,
                borderRadius: "50%",
                border: "1px solid rgba(74,201,255,0.35)",
                background: "rgba(74,201,255,0.15)",
                color: "#4AC9FF",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >
              <Smile size={12} strokeWidth={2} />
            </TouchButton>
          </div>
        );
      })}
      <MascotPicker
        open={pickerFor !== null}
        onPick={(sel) => {
          if (pickerFor) setAttachments((prev) => ({ ...prev, [pickerFor]: sel }));
          setPickerFor(null);
        }}
        onClose={() => setPickerFor(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Mascot picker overlay · Philip 2026-09-01.
//   Opens from the bottom-right icon on any friend chat bubble. Shows a
//   scrollable grid of NEX mascots (real artwork only) plus a row of
//   emoji quick-picks. Selecting either attaches to the bubble.
// ─────────────────────────────────────────────────────────────────────
type PickerSelection =
  | { kind: "mascot"; url: string; label: string }
  | { kind: "emoji"; char: string };

const EMOJI_QUICK_ROW = ["❤️", "😂", "👍", "🔥", "🎉", "😢", "😮", "🙏", "👀"];

function MascotPicker({ open, onPick, onClose }: { open: boolean; onPick: (sel: PickerSelection) => void; onClose: () => void }) {
  const [mountEl, setMountEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    if (typeof document === "undefined") return;
    setMountEl(document.querySelector<HTMLElement>(".nex-console-viewport"));
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || !mountEl) return null;

  const mascots = listAllWithArtwork().slice(0, 30);

  return createPortal(
    <>
      {/* Scrim · closes on outside tap */}
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 40,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(2px)",
          animation: "nex-mp-scrim 180ms ease forwards",
        }}
      />
      <div
        role="dialog"
        aria-label="Pick a mascot or emoji"
        style={{
          position: "absolute",
          top:    "14%",
          left:   "10.82%",
          right:  "10.82%",
          bottom: "13.40%",
          zIndex: 41,
          borderRadius: 14,
          background: "rgba(21, 21, 21, 0.92)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.55)",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          overflow: "hidden",
          animation: "nex-mp-panel 220ms cubic-bezier(0.2, 0.7, 0.2, 1) forwards",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: "rgba(245,245,245,0.6)", fontWeight: 600 }}>
            Add to post
          </div>
          <TouchButton
            aria-label="Close"
            onTap={onClose}
            enforceMinTouchTarget
            style={{ appearance: "none", border: "none", background: "transparent", color: "rgba(245,245,245,0.6)", cursor: "pointer", fontSize: 18, padding: 4 }}
          >
            ×
          </TouchButton>
        </div>

        {/* Emoji quick row */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }} className="nex-no-scrollbar">
          {EMOJI_QUICK_ROW.map((ch) => (
            <TouchButton
              key={ch}
              aria-label={`Emoji ${ch}`}
              onTap={() => onPick({ kind: "emoji", char: ch })}
              enforceMinTouchTarget
              style={{
                appearance: "none",
                flexShrink: 0,
                width: 40, height: 40,
                borderRadius: 10,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                fontSize: 22,
                lineHeight: 1,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >
              {ch}
            </TouchButton>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

        {/* Mascot grid · scrollable */}
        <div
          className="nex-no-scrollbar"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 10,
            overflowY: "auto",
            flex: 1,
            minHeight: 0,
            padding: 2,
          }}
        >
          {mascots.map((mascot) => (
            <TouchButton
              key={mascot.id}
              aria-label={mascot.name}
              onTap={() => onPick({ kind: "mascot", url: mascot.asset, label: mascot.name })}
              style={{
                appearance: "none",
                border: "1px solid rgba(74,201,255,0.2)",
                background: "rgba(255,255,255,0.03)",
                borderRadius: 10,
                padding: 4,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mascot.asset}
                alt={mascot.name}
                width={56}
                height={56}
                style={{ borderRadius: 6, objectFit: "cover", background: "rgba(0,0,0,0.3)" }}
              />
              <span
                style={{
                  fontSize: 9,
                  lineHeight: 1.1,
                  color: "rgba(245,245,245,0.75)",
                  textAlign: "center",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "100%",
                }}
              >
                {mascot.name}
              </span>
            </TouchButton>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes nex-mp-scrim { from { opacity: 0 } to { opacity: 1 } }
        @keyframes nex-mp-panel {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
    </>,
    mountEl,
  );
}

// ─────────────────────────────────────────────────────────────────────
// World-class friend card · Philip 2026-09-01 (Phase 1 + 2 + 3).
//
// Layout:
//   ┌────────────────────────────────────────────────────────┐
//   │  [avatar+ring]  Name · @nexId              ⋯            │
//   │                 ● online · typing…                      │
//   │                 last message preview           14:23    │
//   │  chips: 📍 city · 🎬 shared · 👥 mutuals                │
//   │                                          [ THEME  ● ]   │
//   └────────────────────────────────────────────────────────┘
//
// Behaviour:
//   · Border warms to cyan + subtle glow when unread
//   · Presence ring around avatar pulses green when online
//   · Typing indicator (three cyan dots) replaces static status
//   · Card hover / press scales gently
//   · Long-press (500ms) opens the action menu (mute · pin · call · video · block)
//   · ⋯ button opens the same menu instantly (fallback for non-touch)
//   · Theme toggle stays bottom-right (existing per-contact control)
//   · Cards are ordered pinned-first, then unread, then rest
// ─────────────────────────────────────────────────────────────────────
function FriendsLandscapeList({ onSelect }: { onSelect: (id: string) => void }) {
  // Per-friend mutable state · lives here so toggles persist within a session.
  const [themeState, setThemeState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NEX_MOCK_FRIENDS.map((f) => [f.id, f.themeEnabled])),
  );
  const [mutedState, setMutedState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NEX_MOCK_FRIENDS.map((f) => [f.id, !!f.muted])),
  );
  const [pinnedState, setPinnedState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NEX_MOCK_FRIENDS.map((f) => [f.id, !!f.pinned])),
  );
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const toggleTheme  = (id: string) => setThemeState((p) => ({ ...p, [id]: !p[id] }));
  const toggleMuted  = (id: string) => setMutedState((p) => ({ ...p, [id]: !p[id] }));
  const togglePinned = (id: string) => setPinnedState((p) => ({ ...p, [id]: !p[id] }));

  // Ordering · pinned → unread → rest.
  const ordered = [...NEX_MOCK_FRIENDS].sort((a, b) => {
    const ap = pinnedState[a.id] ? 1 : 0;
    const bp = pinnedState[b.id] ? 1 : 0;
    if (ap !== bp) return bp - ap;
    const au = a.unread > 0 ? 1 : 0;
    const bu = b.unread > 0 ? 1 : 0;
    if (au !== bu) return bu - au;
    return 0;
  });

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "12px 14px 8px",
          fontSize: 11,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: "rgba(245,245,245,0.55)",
          fontWeight: 600,
        }}
      >
        Friends
      </div>
      <div
        style={{ flex: 1, overflow: "auto", padding: "0 14px 16px", display: "flex", flexDirection: "column" }}
        className="nex-no-scrollbar"
      >
        {ordered.map((f, idx) => (
          <React.Fragment key={f.id}>
            {idx > 0 && (
              <div
                aria-hidden
                style={{
                  height: 1,
                  borderTop: "1px dashed rgba(255,255,255,0.14)",
                  margin: "10px 0",
                }}
              />
            )}
            <FriendCard
              friend={f}
              index={idx}
              themeOn={themeState[f.id] ?? f.themeEnabled}
              muted={mutedState[f.id] ?? !!f.muted}
              pinned={pinnedState[f.id] ?? !!f.pinned}
              onOpen={() => onSelect(f.id)}
              onToggleTheme={() => toggleTheme(f.id)}
              onOpenMenu={() => setMenuFor(f.id)}
            />
          </React.Fragment>
        ))}
      </div>
      <FriendActionMenu
        friendId={menuFor}
        muted={menuFor ? (mutedState[menuFor] ?? false) : false}
        pinned={menuFor ? (pinnedState[menuFor] ?? false) : false}
        themeOn={menuFor ? (themeState[menuFor] ?? false) : false}
        onClose={() => setMenuFor(null)}
        onMute={(id) => { toggleMuted(id); setMenuFor(null); }}
        onPin={(id) => { togglePinned(id); setMenuFor(null); }}
        onToggleTheme={(id) => { toggleTheme(id); /* stay open so user sees the flip */ }}
      />
      <style>{`
        @keyframes nex-friend-card-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes nex-friend-presence-pulse {
          0%, 100% { opacity: 0.65; transform: scale(1);    }
          50%      { opacity: 1;    transform: scale(1.06); }
        }
        @keyframes nex-friend-typing-dot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30%           { opacity: 1;   transform: translateY(-1px); }
        }
        @keyframes nex-friend-unread-flash {
          0%   { box-shadow: 0 6px 18px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.02) inset, 0 0 0 rgba(74,201,255,0); }
          50%  { box-shadow: 0 6px 18px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.02) inset, 0 0 16px rgba(74,201,255,0.35); }
          100% { box-shadow: 0 6px 18px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.02) inset, 0 0 8px rgba(74,201,255,0.18); }
        }
      `}</style>
    </div>
  );
}

// ─── Individual friend card · gesture + presentation ────────────────
function FriendCard({
  friend, index, themeOn, muted, pinned, onOpen, onToggleTheme, onOpenMenu,
}: {
  friend: MockFriend;
  index: number;
  themeOn: boolean;
  muted: boolean;
  pinned: boolean;
  onOpen: () => void;
  onToggleTheme: () => void;
  onOpenMenu: () => void;
}) {
  const unread = (friend.lastMessage?.unread ?? false) || friend.unread > 0;
  const presenceColor = STATUS_COLOR[friend.status];
  const presenceLabel =
    friend.status === "typing"  ? "typing" :
    friend.status === "online"  ? "online" :
    friend.status === "away"    ? "away" :
    `last seen ${friend.lastOnline}`;

  // Friend card long-press · TouchButton owns useLongPress internally
  // (Philip 2026-09-02). Tap → onOpen · 500ms hold → onOpenMenu.

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 5,
        padding: "4px 2px",
        animation: `nex-friend-card-in 260ms ease ${index * 40}ms both`,
      }}
    >
      {/* Row 1 · avatar column (avatar + city caption) + identity + overflow menu */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {/* Avatar column · avatar on top, flag+city caption underneath.
            Philip 2026-09-01 · city moved out of the chips row into a
            caption below the profile image · shown with country flag.
            gap: 12 gives ~9px of visible breathing room between the
            presence ring (which extends 3px outside the 60px avatar)
            and the flag+city caption. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, minWidth: 60 }}>
        {/* Avatar with presence ring */}
        <TouchButton
          aria-label={`Chat with ${friend.name}`}
          onTap={onOpen}
          onLongPress={onOpenMenu}
          holdMs={500}
          style={{
            position: "relative",
            appearance: "none",
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            width: 60, height: 60, minWidth: 60,
            display: "block",
          }}
        >
          {/* Presence ring · pulses when online, static when away/offline */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: -3,
              borderRadius: "50%",
              border: `2px solid ${presenceColor}`,
              opacity: friend.status === "offline" ? 0.35 : 0.9,
              animation: friend.status === "online" || friend.status === "typing"
                ? "nex-friend-presence-pulse 3200ms ease-in-out infinite"
                : "none",
              pointerEvents: "none",
            }}
          />
          {friend.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={friend.photoUrl}
              alt=""
              width={60}
              height={60}
              style={{
                width: 60, height: 60,
                borderRadius: "50%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <span
              aria-hidden
              style={{
                display: "flex",
                width: 60, height: 60,
                borderRadius: "50%",
                background: friend.color,
                color: "#fff",
                fontSize: 22,
                fontWeight: 700,
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "inset 0 -8px 16px rgba(0,0,0,0.25)",
              }}
            >
              {friend.initial}
            </span>
          )}
          {/* Unread count moves to timestamp position — badge on avatar
              stays for at-a-glance count but only when the number is >0. */}
          {friend.unread > 0 && (
            <span
              aria-label={`${friend.unread} unread`}
              style={{
                position: "absolute",
                top: -4, right: -4,
                minWidth: 18, height: 18,
                padding: "0 5px",
                borderRadius: 9,
                background: "#4AC9FF",
                color: "#001622",
                fontSize: 10,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
                boxShadow: "0 0 8px rgba(74,201,255,0.55)",
              }}
            >
              {friend.unread}
            </span>
          )}
        </TouchButton>
        {/* Flag + city caption UNDER the avatar (Philip 2026-09-01).
            Renders only when the friend has shared their city. The value
            is live — updates whenever the underlying friend record's
            `location` field changes (no snapshotting here). */}
        {friend.location && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              fontSize: 10,
              color: "rgba(245,245,245,0.8)",
              textShadow: "0 1px 2px rgba(0,0,0,0.55)",
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              maxWidth: 78,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {friend.countryCode && (
              <span aria-hidden style={{ fontSize: 11, lineHeight: 1 }}>{flagFor(friend.countryCode)}</span>
            )}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{friend.location}</span>
          </div>
        )}
        </div>

        {/* Identity + preview column */}
        <TouchButton
          aria-label={`Chat with ${friend.name}`}
          onTap={onOpen}
          onLongPress={onOpenMenu}
          holdMs={500}
          pressScale={0.98}
          style={{
            appearance: "none",
            border: "none",
            background: "transparent",
            padding: 0,
            cursor: "pointer",
            color: "inherit",
            textAlign: "left",
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          {/* Name · nexId · verified · pinned · muted */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "rgba(245,245,245,0.98)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textShadow: "0 1px 3px rgba(0,0,0,0.55)" }}>
              {friend.name}
            </span>
            {friend.verified && (
              <span
                aria-label="Verified"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 12, height: 12,
                  borderRadius: "50%",
                  background: "#4AC9FF",
                  color: "#001622",
                }}
              >
                <Check size={8} strokeWidth={3} />
              </span>
            )}
            <span style={{ fontSize: 11, color: "rgba(245,245,245,0.35)" }}>·</span>
            <span style={{ fontSize: 12, color: "#4AC9FF", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textShadow: "0 1px 3px rgba(0,0,0,0.45)" }}>
              {friend.nexId}
            </span>
            {/* Pin indicator removed from card (Philip 2026-09-01) · pin
                is a menu action only · pinned friends bubble to the top of
                the list which is the visual signal. */}
            {muted && <BellOff size={11} strokeWidth={2} style={{ color: "rgba(245,245,245,0.35)", flexShrink: 0 }} />}
          </div>

          {/* Status row · dot + label · typing gets animated dots */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(245,245,245,0.7)", textShadow: "0 1px 2px rgba(0,0,0,0.55)" }}>
            <span
              aria-hidden
              style={{
                width: 7, height: 7,
                borderRadius: "50%",
                background: presenceColor,
                boxShadow: friend.status === "online" || friend.status === "typing"
                  ? `0 0 6px ${presenceColor}`
                  : "none",
                flexShrink: 0,
              }}
            />
            <span style={{ fontWeight: 500, color: friend.status === "online" || friend.status === "typing" ? "rgba(245,245,245,0.85)" : "rgba(245,245,245,0.55)" }}>
              {presenceLabel}
            </span>
            {friend.status === "typing" && (
              <span aria-hidden style={{ display: "inline-flex", gap: 2, marginLeft: 4 }}>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      width: 3, height: 3, borderRadius: "50%",
                      background: "#4AC9FF",
                      animation: `nex-friend-typing-dot 900ms ease-in-out ${i * 150}ms infinite`,
                    }}
                  />
                ))}
              </span>
            )}
          </div>

          {/* Last-message preview + timestamp */}
          {friend.lastMessage && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              {friend.lastMessage.kind !== "text" && (
                <span style={{ color: unread ? "#4AC9FF" : "rgba(245,245,245,0.55)", flexShrink: 0, display: "inline-flex" }}>
                  <MessageKindIcon kind={friend.lastMessage.kind} />
                </span>
              )}
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12.5,
                  color: unread ? "rgba(245,245,245,0.98)" : "rgba(245,245,245,0.6)",
                  fontWeight: unread ? 500 : 400,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textShadow: "0 1px 2px rgba(0,0,0,0.55)",
                }}
              >
                {friend.lastMessage.text}
              </span>
              <span style={{ fontSize: 10, color: "rgba(245,245,245,0.5)", flexShrink: 0, textShadow: "0 1px 2px rgba(0,0,0,0.55)" }}>
                {friend.lastMessage.time}
              </span>
            </div>
          )}
        </TouchButton>

        {/* Overflow menu button · top-right */}
        <TouchButton
          aria-label={`Actions for ${friend.name}`}
          onTap={onOpenMenu}
          enforceMinTouchTarget
          style={{
            appearance: "none",
            border: "none",
            background: "transparent",
            color: "rgba(245,245,245,0.5)",
            cursor: "pointer",
            padding: 4,
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MoreHorizontal size={16} strokeWidth={2} />
        </TouchButton>
      </div>

      {/* Context chips · only when there's meaningful content · indented
          under the avatar column. City moved OUT of chips into the caption
          under the profile image (Philip 2026-09-01) · other chips remain. */}
      {(friend.sharedContext || friend.mutualCount || friend.lastMascot) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingLeft: 82, paddingRight: 8 }}>
          {friend.sharedContext && (
            <span style={chipStyle}>
              <span aria-hidden style={{ fontSize: 10, lineHeight: 1 }}>{friend.sharedContext.icon}</span>
              {friend.sharedContext.label}
            </span>
          )}
          {friend.mutualCount && friend.mutualCount > 0 && (
            <span style={chipStyle}>
              <UsersIcon size={9} strokeWidth={2.2} /> {friend.mutualCount} mutual
            </span>
          )}
          {friend.lastMascot && (
            <span style={{ ...chipStyle, paddingLeft: 4 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={friend.lastMascot.url}
                alt=""
                width={14}
                height={14}
                style={{ borderRadius: 3, objectFit: "cover" }}
              />
              {friend.lastMascot.label}
            </span>
          )}
        </div>
      )}

      {/* Theme toggle moved into the ⋯ dropdown menu · Philip 2026-09-01.
          See FriendActionMenu (Theme item) for the per-contact control. */}
    </div>
  );
}

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  fontSize: 10,
  color: "rgba(245,245,245,0.8)",
  background: "rgba(0,0,0,0.35)",
  border: "1px solid rgba(74,201,255,0.22)",
  borderRadius: 6,
  padding: "2px 6px",
  lineHeight: 1.2,
  whiteSpace: "nowrap",
  backdropFilter: "blur(4px)",
  WebkitBackdropFilter: "blur(4px)",
};

// ─── Long-press action menu · Mute · Pin · Call · Video · Block ─────
function FriendActionMenu({
  friendId, muted, pinned, themeOn, onClose, onMute, onPin, onToggleTheme,
}: {
  friendId: string | null;
  muted: boolean;
  pinned: boolean;
  themeOn: boolean;
  onClose: () => void;
  onMute: (id: string) => void;
  onPin:  (id: string) => void;
  onToggleTheme: (id: string) => void;
}) {
  const [mountEl, setMountEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!friendId) return;
    if (typeof document === "undefined") return;
    setMountEl(document.querySelector<HTMLElement>(".nex-console-viewport"));
  }, [friendId]);
  useEffect(() => {
    if (!friendId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [friendId, onClose]);
  if (!friendId || !mountEl) return null;

  // Theme item is a live toggle · shows current state · doesn't close the
  // menu on tap so users can flip and see the state change immediately.
  const items: Array<{
    key: string; label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
    onClick: () => void; danger?: boolean; trailing?: React.ReactNode;
  }> = [
    { key: "mute",  label: muted ? "Unmute" : "Mute",   Icon: BellOff, onClick: () => onMute(friendId) },
    { key: "pin",   label: pinned ? "Unpin" : "Pin",    Icon: Pin,     onClick: () => onPin(friendId) },
    {
      key: "theme",
      label: themeOn ? "Theme visible to friend" : "Theme hidden from friend",
      Icon: Sparkles,
      onClick: () => onToggleTheme(friendId),
      trailing: (
        <span
          aria-hidden
          style={{
            position: "relative",
            display: "inline-block",
            width: 30, height: 16,
            borderRadius: 8,
            background: themeOn ? "rgba(74,201,255,0.55)" : "rgba(255,255,255,0.15)",
            border: `1px solid ${themeOn ? "rgba(74,201,255,0.75)" : "rgba(255,255,255,0.2)"}`,
            transition: "background 160ms ease, border-color 160ms ease",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 1,
              left: themeOn ? 15 : 1,
              width: 12, height: 12,
              borderRadius: "50%",
              background: themeOn ? "#fff" : "rgba(245,245,245,0.7)",
              transition: "left 160ms ease, background 160ms ease",
              boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
            }}
          />
        </span>
      ),
    },
    { key: "call",  label: "Call",                       Icon: Phone,   onClick: onClose },
    { key: "video", label: "Video",                      Icon: Video,   onClick: onClose },
    { key: "share", label: "Share contact",              Icon: Share2,  onClick: onClose },
    { key: "block", label: "Block",                      Icon: Ban,     onClick: onClose, danger: true },
  ];

  return createPortal(
    <>
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 40,
          background: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(3px)",
        }}
      />
      <div
        role="menu"
        style={{
          position: "absolute",
          left:   "10.82%",
          right:  "10.82%",
          bottom: "13.40%",
          zIndex: 41,
          borderRadius: 14,
          background: "rgba(21,21,21,0.92)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.55)",
          padding: 6,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {items.map(({ key, label, Icon, onClick, danger, trailing }) => (
          <TouchButton
            key={key}
            role="menuitem"
            onTap={onClick}
            pressScale={0.98}
            style={{
              appearance: "none",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 10,
              border: "none",
              background: "transparent",
              color: danger ? "#ef4444" : "rgba(245,245,245,0.9)",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 13,
              textAlign: "left",
            }}
          >
            <Icon size={16} strokeWidth={2} />
            <span style={{ flex: 1 }}>{label}</span>
            {trailing}
          </TouchButton>
        ))}
      </div>
    </>,
    mountEl,
  );
}
