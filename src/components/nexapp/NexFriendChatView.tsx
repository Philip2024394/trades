// NEX friend chat view · Philip 2026-09-02 redesign to match reference.
//
// ═══════════════════════════════════════════════════════════════════════════
// CONSTITUTIONAL GATE · ADULT-ONLY SURFACE
// ═══════════════════════════════════════════════════════════════════════════
// This surface is currently ADULT-ONLY per NEX Child Safety Architecture V1
// (LOCKED 2026-09-03 · doctrine file in memory · Rules 1–23).
//
// When a viewer-identity type is added to NEX (e.g. `accountType: "adult" |
// "child"`), this file MUST route child accounts to a placeholder/not-yet-
// available surface. NO child-facing implementation is permitted here until
// a SEPARATE implementation gate is approved by Philip.
//
// The chat, friends, requests, block/unfriend flow, image sending, and every
// other interaction in this file is designed for the ADULT freedom-by-default
// model. The child protected-by-default model requires:
//   · The central NEX Safety Engine (Rule 13)
//   · Parent-aware friend requests · strict/balanced/trusted (Rule 2)
//   · Adult→child restrictions (Rule 7)
//   · Image quarantine before display · bi-directional (Rules 15, 18)
//   · Conversation-level pattern detection (Rule 16)
//   · Proactive intervention (Rule 17)
//   · Trusted Circle escalation (Rule 19)
//   · Family Console + transparent supervision indicator (Rules 3, 8)
//
// grep for `NEX_CHAT_SURFACE_ADULT_ONLY` before shipping any change that
// could reach a child account.
// ═══════════════════════════════════════════════════════════════════════════
//
// Design language (matches the reference mock exactly):
//   · Fully transparent surface · the metallic HUD frame shows through
//   · Header row · back arrow · orange-ringed avatar + green online dot
//     + name + presence · phone + video circular action buttons
//   · "Today" pill divider
//   · Text-on-transparent message thread (NOT bubbles) with a thin
//     dashed orange vertical thread-line running down the left
//   · Each friend message: small orange-ringed avatar · orange name +
//     grey timestamp · text · quick reply arrow + 3-dot menu on right
//   · Each user message: "You" label in orange · timestamp · text ·
//     double-check ✓✓ read receipt in orange
//   · 3-dot menu opens a context popover · Reply · Copy · Save Message
//     · Pin Message · Forward · Edit · Delete · Report (last three red)
//   · Reply-to-post threading · a reply renders nested under its parent
//     as one indented post connected by the orange thread-line
//   · Mascot picker opens via `onOpenMascotPicker` callback (parent
//     shell owns the composer + drawer per the "no footer here" rule)
//
// Composer bar is NOT rendered inside this component per the design
// direction (parent shell owns it).

"use client";

import React, { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  MoreVertical, MoreHorizontal,
  Reply, Copy, Bookmark, Pin, Forward, Pencil, Trash2, Flag, CheckCheck,
  Clock, X as XIcon, CornerUpLeft, Check, Circle, Smile, BadgeCheck, Search,
  User, UserPlus, BellOff, Bell, Eraser, Ban,
  MessageSquare, CalendarDays,
  Phone, Video,
} from "lucide-react";

// Social platform logos · inline SVGs (lucide-react in this project's
// version doesn't ship brand icons · avoids the trademark issues brands
// have raised against generic icon sets). Each glyph uses currentColor
// so it inherits the text color of its container like a lucide icon.
function FacebookIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9 8H6v4h3v12h5V12h3.642L18 8h-4V6.333C14 5.378 14.192 5 15.115 5H18V0h-3.808C10.596 0 9 1.583 9 4.615V8z" />
    </svg>
  );
}
function InstagramIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function TwitterIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
function YoutubeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}
function LinkedinIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}
// Confetti burst · Philip 2026-09-03 · plays when a NEX chat opens
// for the first time between two people. 26 pieces with randomised
// horizontal starting position, drift, color, size, delay, and duration
// (memoised once per mount so re-renders don't jitter). Uses CSS custom
// properties (--nex-cx / --nex-cx-end) to feed the keyframe's start +
// end x-offsets so every piece takes a slightly different trajectory.
function ConfettiBurst() {
  const pieces = React.useMemo(() => {
    const palette = [NEX.orange, "#F59E0B", "#10B981", "#3B82F6", "#EC4899", "#8B5CF6", "#FFFFFF"];
    return Array.from({ length: 26 }, (_, i) => {
      const left      = Math.random() * 100;              // % horizontal start
      const drift     = (Math.random() - 0.5) * 120;      // px total x-drift
      const size      = 5 + Math.random() * 6;            // 5-11 px
      const rot       = Math.random() * 360;              // starting rotation
      const delay     = Math.random() * 350;              // 0-350ms staggered start
      const duration  = 1800 + Math.random() * 1500;      // 1.8-3.3s fall
      const color     = palette[i % palette.length];
      const shape     = i % 3 === 0 ? "50%" : "2px";      // circle or tiny square
      return { left, drift, size, rot, delay, duration, color, shape };
    });
  }, []);
  return (
    <div aria-hidden style={{
      position: "absolute",
      top: 0, left: 0, right: 0,
      height: "60vh",
      pointerEvents: "none",
      overflow: "hidden",
      zIndex: 22,
    }}>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            borderRadius: p.shape,
            background: p.color,
            transform: `rotate(${p.rot}deg)`,
            animation: `nex-confetti-fall ${p.duration}ms cubic-bezier(0.4, 0.05, 0.6, 1) ${p.delay}ms both`,
            ["--nex-cx" as string]: "0px",
            ["--nex-cx-end" as string]: `${p.drift}px`,
            boxShadow: `0 0 6px ${p.color}55`,
          }}
        />
      ))}
    </div>
  );
}

function TiktokIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}
import { NEX } from "@/lib/nexapp/tokens";
import { NEX_MOCK_FRIENDS, type MockFriend, type FriendMessage } from "./NexPendingChats";

type ContextMenuState = { messageId: string; anchorRect: DOMRect | null } | null;

// Mock user avatar · Philip 2026-09-02. Replace with the authenticated
// user's real photoUrl once auth is wired in.
const USER_AVATAR_URL = "https://randomuser.me/api/portraits/men/85.jpg";

// User identity color · Philip 2026-09-02 · "change you to dark green
// color not blue". Coherent with the green delivered timestamp so all
// user-side elements read as one identity family.
const USER_IDENTITY_COLOR = "#059669";
const USER_IDENTITY_GLOW  = "rgba(5,150,105,0.45)";

// Smart timestamp · Philip 2026-09-02 world-class. Given a message's
// ISO date, return a human-relative label for the last ~24h and fall
// back to the raw `time` string for anything older. Ticks each minute
// via a re-render bump (below) so "5m ago" stays truthful.
function formatSmartTime(dateISO: string | undefined, fallback: string, now: number): string {
  if (!dateISO) return fallback;
  const t = Date.parse(dateISO);
  if (Number.isNaN(t)) return fallback;
  const diffSec = Math.max(0, Math.round((now - t) / 1000));
  if (diffSec < 45) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return fallback;
}

// Long-press threshold in ms · 500ms feels natural (mirrors iOS/Android
// default long-press durations without frustrating quick tappers).
const LONG_PRESS_MS = 500;

// ISO 3166-1 alpha-2 country code → regional-indicator flag emoji.
// Each letter maps to codepoint 0x1F1E6 + (letter - 'A'). Returns empty
// string when the input isn't exactly 2 letters.
function flagEmoji(cc: string | undefined): string {
  if (!cc || cc.length !== 2) return "";
  const upper = cc.toUpperCase();
  const A = 65;
  return String.fromCodePoint(
    0x1f1e6 + upper.charCodeAt(0) - A,
    0x1f1e6 + upper.charCodeAt(1) - A,
  );
}

export function NexFriendChatView({
  friend,
  messages,
  onClose,
  onOpenMascotPicker,
  onReply,
  selectedMessageId,
  onCancelReply,
  onMarkThreadRead,
  onToggleMessageRead,
  onDeleteMessage,
  onAddReaction,
  onToggleSaved,
  onTogglePinned,
  onEditMessage,
  onToggleMute,
  onToggleTheme,
  onToggleBlock,
  onToggleUnfriend,
  isMuted,
  isBlocked,
  isUnfriended,
  onClearChat,
  onOpenProfile,
  onSelectFriend,
  onAddContactByNexId,
  isUserTyping,
  userTypingText,
}: {
  friend: MockFriend;
  messages: FriendMessage[];
  onClose: () => void;
  /** Parent-owned composer opens the mascot picker on request. */
  onOpenMascotPicker?: () => void;
  /** Emitted when the user selects "Reply" from a message's context menu. */
  onReply?: (message: FriendMessage) => void;
  /** Which message is currently the target of an in-flight reply · painted
   *  with a subtle orange left accent + inline reply preview underneath
   *  (Philip 2026-09-02 · "must appear under the reply text post"). */
  selectedMessageId?: string | null;
  onCancelReply?: () => void;
  /** Called ~1.5s after chat mounts (or friend switch) · marks all unread
   *  friend messages as read in the shell's threads state so the pulse
   *  animation stops. Philip 2026-09-02. */
  onMarkThreadRead?: () => void;
  /** Called from the ⋮ menu · flips a specific message's read state. */
  onToggleMessageRead?: (messageId: string) => void;
  /** Called from the ⋮ menu → Delete · removes message from thread. */
  onDeleteMessage?: (messageId: string) => void;
  /** True when the current user is actively typing in the composer
   *  (composer input has text) · Philip 2026-09-02 · shows typing dots
   *  overlay on the user's header avatar, mirroring the friend treatment. */
  isUserTyping?: boolean;
  /** Live text the user is typing in the composer · Philip 2026-09-02.
   *  Rendered in the hero as an in-progress reply preview so the user
   *  sees their reply forming above the composer. */
  userTypingText?: string;
  /** Called from the reaction picker · adds an emoji reaction from the
   *  user to the message (Philip 2026-09-02 world-class). */
  onAddReaction?: (messageId: string, emoji: string) => void;
  /** Toggles the message's saved flag (⋮ → Save / Unsave). */
  onToggleSaved?: (messageId: string) => void;
  /** Toggles the message's pinned flag (⋮ → Pin / Unpin). */
  onTogglePinned?: (messageId: string) => void;
  /** Persist an edited message body · fires when user hits Enter after
   *  choosing Edit from the ⋮ menu. */
  onEditMessage?: (messageId: string, newText: string) => void;
  /** Toggle friend-level mute (⋯ header menu). Stub-driven for now. */
  onToggleMute?: () => void;
  /** Toggle "share my theme with this contact" · uses friend.themeEnabled.
   *  When ON, this friend sees the user's current NEX theme; when OFF
   *  they see the default NEX look. Future theme updates from the user's
   *  theme library propagate automatically to every contact whose
   *  themeEnabled is true. */
  onToggleTheme?: () => void;
  /** Toggle block for this contact · when ON, they cannot message the
   *  user and their messages won't reach this thread. */
  onToggleBlock?: () => void;
  /** True when this contact is currently blocked by the user. */
  isBlocked?: boolean;
  /** Toggle unfriend for this contact · softer than block · chat +
   *  messages still work, but friend-perks (theme sharing, presence
   *  sync, since-connected insights, socials row) are stripped. */
  onToggleUnfriend?: () => void;
  /** True when this contact has been unfriended by the user. */
  isUnfriended?: boolean;
  /** True when friend notifications are muted. */
  isMuted?: boolean;
  /** Clear all messages in this friend's thread (⋯ header menu). */
  onClearChat?: () => void;
  /** Open the friend's profile page (⋯ header menu → View Profile). */
  onOpenProfile?: () => void;
  /** Switch the active chat to a different friend (drawer contact list). */
  onSelectFriend?: (friendId: string) => void;
  /** Add a NEW contact by @nex_id (bottom of contacts drawer). Parent shell
   *  handles the actual add flow · this component just captures the handle. */
  onAddContactByNexId?: (nexId: string) => void;
}) {
  const [menu, setMenu] = useState<ContextMenuState>(null);
  // Which message currently has its Post Record card expanded · toggled
  // from the 3-dot menu · Philip 2026-09-02.
  const [recordFor, setRecordFor] = useState<string | null>(null);
  // Which message has its reaction picker open · one at a time (Philip
  // 2026-09-02). Selecting an emoji closes the picker automatically.
  const [reactFor, setReactFor] = useState<string | null>(null);
  // Which USER message is currently being edited inline · null when none.
  const [editingId, setEditingId] = useState<string | null>(null);
  // Message search · Philip 2026-09-02 world-class. When set, thread
  // filters to messages containing the query (case-insensitive) and the
  // header transforms into a search input. Empty string exits search.
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  // Per-conversation dropdown menu · anchored to the ⋯ header button.
  const [convoMenuAnchor, setConvoMenuAnchor] = useState<DOMRect | null>(null);
  // Drawer contact-list filter · plain substring match on name + nexId.
  const [contactSearch, setContactSearch] = useState("");
  // Bottom-of-drawer "add contact by @nex_id" input (Philip 2026-09-03).
  const [addNexIdDraft, setAddNexIdDraft] = useState("");
  // Inline result banner shown under the input for ~3.5s after submit.
  const [addResult, setAddResult] = useState<{ ok: boolean; message: string } | null>(null);
  useEffect(() => {
    if (!addResult) return;
    const t = setTimeout(() => setAddResult(null), 3500);
    return () => clearTimeout(t);
  }, [addResult]);
  // Debounced live-lookup preview · shows the matched contact card as
  // the user types a NEX id, so add-contact is never a mystery submit.
  const [lookupPreview, setLookupPreview] = useState<MockFriend | null>(null);
  useEffect(() => {
    const trimmed = addNexIdDraft.trim();
    if (trimmed.length < 2) { setLookupPreview(null); return; }
    const t = setTimeout(() => {
      // Direct match · NEX handles have no `@` prefix.
      setLookupPreview(NEX_MOCK_FRIENDS.find((f) => f.nexId?.toLowerCase() === trimmed.toLowerCase()) ?? null);
    }, 260);
    return () => clearTimeout(t);
  }, [addNexIdDraft]);
  // Contact-list keyboard navigation · ArrowUp / ArrowDown between rows.
  const rowRefsMap = useRef<Map<string, HTMLButtonElement>>(new Map());
  // Chat-actions panel · opened by the app-header 3-dots (Philip 2026-09-03).
  // Same drawer geometry as the contacts panel but content is only the
  // "This chat · <friend>" actions block (Profile / Mute / Clear).
  const [actionsPanelOpen, setActionsPanelOpen] = useState(false);
  // First-connection celebration · confetti + banner · plays for a few
  // seconds on mount when friend.isFirstConnection is true.
  const [firstConnectionActive, setFirstConnectionActive] = useState(false);
  const [firstConnectionFading, setFirstConnectionFading] = useState(false);
  useEffect(() => {
    if (!friend.isFirstConnection) { setFirstConnectionActive(false); return; }
    setFirstConnectionActive(true);
    setFirstConnectionFading(false);
    const fadeStart = window.setTimeout(() => setFirstConnectionFading(true), 3200);
    const clear     = window.setTimeout(() => setFirstConnectionActive(false),  4000);
    return () => { clearTimeout(fadeStart); clearTimeout(clear); };
  }, [friend.id, friend.isFirstConnection]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOpen = () => setActionsPanelOpen(true);
    window.addEventListener("nex:open-chat-actions", onOpen);
    return () => window.removeEventListener("nex:open-chat-actions", onOpen);
  }, []);
  // Chats-drawer event · Philip 2026-09-03 "THE CHATS BUTTON OPENS THE
  // CONTACTS PANEL THAT WAS CONNECTED TO THE 3 DOTS IN HEADER CENTER".
  // The Chats tile in the keypad's 8-tile insert grid fires this event
  // (dispatched from NexAppShell via onInsertTileTap). We open the same
  // convoMenuAnchor drawer that the removed 3-dots header button used
  // to open. Using a zero-size DOMRect since the drawer positions
  // against frame coords (workspace-zone insets) rather than the
  // anchor rect.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOpenChats = () => {
      setConvoMenuAnchor(new DOMRect(0, 0, 0, 0));
    };
    window.addEventListener("nex:open-chats-drawer", onOpenChats);
    return () => window.removeEventListener("nex:open-chats-drawer", onOpenChats);
  }, []);
  // Frame viewport mount target · Philip 2026-09-02 · used to portal
  // Alex's hero avatar ABOVE the metallic frame chassis (z:25 · beats the
  // frame overlay at z:20). Renders as a floating overlay on the phone.
  const [frameMountEl, setFrameMountEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof document === "undefined") return;
    setFrameMountEl(document.querySelector<HTMLElement>(".nex-console-viewport"));
  }, []);
  // Smart-timestamp ticker · re-render every 30s so "5m ago" stays fresh
  // as time passes (Philip 2026-09-02 world-class).
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Smart auto-scroll · Philip 2026-09-02 spec §6.
  //   Scroll to the newest message on mount + whenever a new message arrives
  //   AND the user was already within 80px of the bottom (i.e. reading the
  //   live tail). If the user has scrolled up to browse older history, we
  //   preserve their position so they aren't yanked to the bottom.
  const threadRef = useRef<HTMLDivElement | null>(null);
  const wasNearBottomRef = useRef(true);
  // Jump-to-bottom pill · Philip 2026-09-02 world-class. Appears when the
  // user has scrolled up AND new messages have arrived below · tap to
  // smooth-scroll back to the newest message.
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const lastSeenCountRef = useRef(messages.length);
  // Reset the near-bottom flag when the user switches to a different friend
  // so the new thread always opens at its newest message.
  useEffect(() => {
    wasNearBottomRef.current = true;
    setShowJumpToBottom(false);
    lastSeenCountRef.current = messages.length;
  }, [friend.id]);
  // Show jump-to-bottom when a NEW message arrives while the user is
  // scrolled up (not near the bottom).
  useEffect(() => {
    if (messages.length > lastSeenCountRef.current && !wasNearBottomRef.current) {
      setShowJumpToBottom(true);
    }
    lastSeenCountRef.current = messages.length;
  }, [messages.length]);

  // Auto-mark all unread as read after a short delay · Philip 2026-09-02
  // "wire real read-tracking". 1.5s delay so the pulse is still visible
  // for a beat before it settles into the flat orange read state.
  useEffect(() => {
    if (!onMarkThreadRead) return;
    const hasUnread = messages.some((m) => m.sender === "friend" && m.read === false);
    if (!hasUnread) return;
    const t = setTimeout(() => onMarkThreadRead(), 1500);
    return () => clearTimeout(t);
  }, [friend.id, messages, onMarkThreadRead]);

  // Hero-focused message auto-reads · Philip 2026-09-02 world-class ·
  // "friend messages should mark as read when hero focuses them".
  // Whenever the hero focuses a friend message with read===false, flip
  // it to read after 700ms so the user has a moment to notice.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    if (!onToggleMessageRead) return;
    // heroMessage is computed below; use selectedMessageId + lastFriend
    // logic directly here.
    const targetId = selectedMessageId ?? [...messages].reverse().find((m) => m.sender === "friend")?.id;
    if (!targetId) return;
    const target = messages.find((m) => m.id === targetId);
    if (!target || target.sender !== "friend" || target.read !== false) return;
    const t = setTimeout(() => onToggleMessageRead(targetId), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMessageId, messages.length, friend.id]);

  // "N new messages" separator · Philip 2026-09-02 world-class.
  //   On chat open, if there are unread friend messages, remember which
  //   message was the FIRST unread when we entered. Render a divider
  //   above it: "3 new messages". Marker persists visually even after
  //   auto-mark-read fires so the user can see where they left off.
  const [newSinceOpen, setNewSinceOpen] = useState<{ firstUnreadId: string | null; count: number }>({ firstUnreadId: null, count: 0 });
  useEffect(() => {
    const unread = messages.filter((m) => m.sender === "friend" && m.read === false);
    if (unread.length > 0) {
      setNewSinceOpen({ firstUnreadId: unread[0].id, count: unread.length });
    } else {
      setNewSinceOpen({ firstUnreadId: null, count: 0 });
    }
    // Only recompute on friend switch · this snapshot is "what was unread
    // when the chat opened" and shouldn't re-evaluate on every read-flip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friend.id]);
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    if (wasNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, friend.id]);
  const onThreadScroll = () => {
    const el = threadRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    wasNearBottomRef.current = distanceFromBottom <= 80;
    // Hide the jump-to-bottom pill once the user reaches the bottom
    // themselves; keep it visible while they browse older messages.
    if (distanceFromBottom <= 20) setShowJumpToBottom(false);
  };
  const jumpToBottom = () => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setShowJumpToBottom(false);
  };

  // Fast lookup of message by id · used to resolve a message's replyTo target
  // for the "↳ quoted line" rendered above the reply body (Philip 2026-09-02).
  const messagesById = new Map<string, FriendMessage>();
  for (const m of messages) messagesById.set(m.id, m);

  // Pinned messages · Philip 2026-09-02 world-class. When any message is
  // pinned, a compact sticky bar renders under the header showing the
  // pinned message preview. Tap it to scroll to the pinned message.
  const pinnedMessages = messages.filter((m) => m.pinned === true);
  const messageRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const scrollToMessage = (id: string) => {
    const el = messageRefs.current.get(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Subtle flash to draw attention to the target message.
    el.style.transition = "background 400ms ease";
    el.style.background = "rgba(249,115,22,0.12)";
    setTimeout(() => { el.style.background = "transparent"; }, 1200);
  };

  // Selected-bubble auto-scroll · Philip 2026-09-03 "the most important
  // is that which ever chat bubble is selected must move up higher then
  // the text imput field so user can see the chat bubble as they type".
  // When selectedMessageId changes to a real id, scroll that message into
  // view centered in the thread scroll area · this places it well above
  // the composer + keypad wrapper (which overlays only the bottom ~17%
  // of the workspace zone), keeping it visible while the user types.
  useEffect(() => {
    if (!selectedMessageId) return;
    // Small delay so the message DOM has committed if the selection
    // came from a message that was just rendered.
    const t = setTimeout(() => {
      const el = messageRefs.current.get(selectedMessageId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    return () => clearTimeout(t);
  }, [selectedMessageId]);

  // Group replies under their parent so top-level thread renders sequentially
  // and each reply appears nested UNDER its parent post as ONE indented post.
  const repliesByParent = new Map<string, FriendMessage[]>();
  const topLevel: FriendMessage[] = [];
  for (const m of messages) {
    if (m.replyTo) {
      const arr = repliesByParent.get(m.replyTo) ?? [];
      arr.push(m);
      repliesByParent.set(m.replyTo, arr);
    } else {
      topLevel.push(m);
    }
  }

  // Search filter · Philip 2026-09-02 world-class. When searchQuery is
  // set, filter top-level messages to those whose text contains the
  // query (case-insensitive). Empty query = show all (search bar open
  // but nothing filtered yet).
  const activeQuery = searchQuery?.trim().toLowerCase() ?? null;
  const filteredTopLevel = activeQuery
    ? topLevel.filter((m) => m.text.toLowerCase().includes(activeQuery))
    : topLevel;

  // Hero message · Philip 2026-09-02 world-class flow.
  //   The hero container acts as the CURRENT FOCUS of the conversation.
  //   - If the user has selected a message to reply to → hero shows THAT.
  //   - Otherwise → hero auto-loads Alex's LAST incoming message.
  //   Tapping any friend bubble makes it the reply target (loads into hero).
  const lastFriendMessage = [...topLevel].reverse().find((m) => m.sender === "friend") ?? null;
  const heroMessage = (selectedMessageId
    ? messages.find((m) => m.id === selectedMessageId) ?? null
    : null
  ) ?? lastFriendMessage;
  const heroReplyMode = !!selectedMessageId;
  const typedText = (userTypingText ?? "").trim();
  // Show the reply preview whenever the user types · Philip 2026-09-02
  // "the last message should always allow me if i dont select a bubble
  // to type and send". Even with no explicit target, hero focuses the
  // last friend message and typing composes a reply to it.
  const showReplyPreview = !!heroMessage && typedText.length > 0;

  const closeMenu = () => setMenu(null);
  const openMenuAt = (messageId: string, anchor: HTMLElement) =>
    setMenu({ messageId, anchorRect: anchor.getBoundingClientRect() });

  const activeMenuMessage = menu ? messages.find((m) => m.id === menu.messageId) ?? null : null;

  return (
    <div style={{ ...containerStyle, position: "relative" }} onClick={closeMenu}>
      {/* First-connection celebration · confetti burst from the top
          + "Connected!" banner in the header. Renders for ~4s then
          fades out cleanly. Philip 2026-09-03. */}
      {/* Profile cluster REMOVED · Philip 2026-09-03 "remove alex
          profile from hero and add name in bubble center and move the
          bubble up max to under frame". The friend's identity is now
          carried by the hero card (centered name + message) + the
          bubble avatars on burst-start messages in the feed. Profile
          drawer still accessible via the Chats tile in the keypad. */}

      {/* Call + Video top-right buttons REMOVED · Philip 2026-09-03
          "REMOVE THE BUTTONS VIDEO AND CALL FROM HEADER AREA". Those
          actions are now surfaced as tiles in the keypad's 8-tile
          insert grid (Call · Video tiles) — no need for them to also
          live in the chat header. */}

      {firstConnectionActive && <ConfettiBurst />}
      {firstConnectionActive && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            top: 6,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 23,
            padding: "6px 12px",
            background: "linear-gradient(180deg, rgba(249,115,22,0.95), rgba(217,88,15,0.95))",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: 999,
            boxShadow: "0 6px 18px rgba(249,115,22,0.5), inset 0 1px 0 rgba(255,255,255,0.35)",
            color: "#0a0a0a",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
            animation: firstConnectionFading
              ? "nex-connected-out 700ms ease-in both"
              : "nex-connected-in 350ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
            pointerEvents: "none",
          }}
        >
          🎉 Connected with {friend.name}
        </div>
      )}

      {/* Local keyframes · caret blink for the reply-in-progress stub,
          heartbeat pulse for the reply dot on UNREAD friend messages
          (Philip 2026-09-02 · "pulsing orange with a small heartbeat"). */}
      <style>{`
        @keyframes nex-caret-blink { 50% { opacity: 0; } }
        @keyframes nex-reply-heartbeat {
          0%, 60%, 100% { transform: scale(1); box-shadow: 0 0 4px rgba(249,115,22,0.55), 0 0 0 2px #050505; }
          15% { transform: scale(1.22); box-shadow: 0 0 10px rgba(249,115,22,0.85), 0 0 0 2px #050505; }
          30% { transform: scale(1); }
          45% { transform: scale(1.14); box-shadow: 0 0 8px rgba(249,115,22,0.7), 0 0 0 2px #050505; }
        }
        @keyframes nex-typing-bounce {
          0%, 60%, 100% { opacity: 0.25; transform: translateY(0); }
          30%           { opacity: 1;    transform: translateY(-2px); }
        }
        @keyframes nex-time-deliver {
          0%, 30% { color: rgba(255,255,255,0.4); }
          100%     { color: #10B981; }
        }
        /* Throw-from-avatar · Philip 2026-09-02 pivot. Friend bubbles
           spawn from the top-LEFT avatar and drop down. User bubbles
           spawn from the top-RIGHT avatar and drop down. */
        @keyframes nex-throw-from-left {
          0%   { opacity: 0; transform: translate(-40px, -80px) scale(0.4); }
          60%  { opacity: 1; }
          100% { opacity: 1; transform: translate(0, 0) scale(1); }
        }
        @keyframes nex-throw-from-right {
          0%   { opacity: 0; transform: translate(40px, -80px) scale(0.4); }
          60%  { opacity: 1; }
          100% { opacity: 1; transform: translate(0, 0) scale(1); }
        }
        /* Fresh-send rim highlight · Philip 2026-09-02 world-class ·
           "when alex sees the bubble the highlight will fade". Bubble
           lands with an orange glowing border + shadow, then fades to
           the normal quiet state over ~2s (mock "delivered → read"). */
        @keyframes nex-fresh-rim {
          0%   { box-shadow: 0 0 0 1px #F97316, 0 0 18px rgba(249,115,22,0.5); }
          70%  { box-shadow: 0 0 0 1px rgba(249,115,22,0.4), 0 0 8px rgba(249,115,22,0.2); }
          100% { box-shadow: 0 0 0 0 rgba(249,115,22,0), 0 0 0 rgba(249,115,22,0); }
        }
        /* Right-side conversation drawer · Philip 2026-09-03. Slide from
           the right edge; backdrop fades in beside it. */
        @keyframes nex-drawer-slide-right {
          0%   { transform: translateX(100%); }
          100% { transform: translateX(0);    }
        }
        @keyframes nex-drawer-fade-in {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        /* 3-dots idle pulse · attracts attention while the drawer is
           closed. Turned off (animation:none) when the drawer opens
           and back on when it closes. Philip 2026-09-03. */
        @keyframes nex-dots-pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.35; }
        }
        /* First-connection confetti · Philip 2026-09-03. Each piece
           falls with a random horizontal drift + rotation. Auto-fades
           out at the end of the animation. */
        @keyframes nex-confetti-fall {
          0%   { transform: translate3d(var(--nex-cx, 0), -20px, 0) rotate(0deg); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translate3d(var(--nex-cx-end, 20px), 60vh, 0) rotate(720deg); opacity: 0; }
        }
        /* Connected banner · slides down + fades from the header */
        @keyframes nex-connected-in {
          0%   { opacity: 0; transform: translateY(-14px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes nex-connected-out {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-8px) scale(0.98); }
        }
      `}</style>
      {/* ── Header ────────────────────────────────────────────────── */}
      {searchQuery !== null ? (
        <header style={{ ...headerStyle, gap: 8 }}>
          <CircleButton ariaLabel="Close search" onClick={() => setSearchQuery(null)}>
            <XIcon size={16} strokeWidth={2} color={NEX.text} />
          </CircleButton>
          <div style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${NEX.borderMuted}`,
            borderRadius: 999,
          }}>
            <Search size={14} strokeWidth={2} color={NEX.textMuted} />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${friend.name}'s chat…`}
              onKeyDown={(e) => { if (e.key === "Escape") setSearchQuery(null); }}
              style={{
                flex: 1,
                appearance: "none",
                border: "none",
                background: "transparent",
                color: NEX.text,
                fontSize: 13,
                outline: "none",
                padding: 0,
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                style={{ appearance: "none", border: "none", background: "transparent", color: NEX.textMuted, cursor: "pointer", padding: 2 }}
              >
                <XIcon size={12} strokeWidth={2} />
              </button>
            )}
          </div>
        </header>
      ) : (
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "0 8px 8px",
        borderBottom: `1px solid ${NEX.borderMuted}`,
        marginBottom: 10,
        position: "relative",
        minHeight: 32,
      }}>
        {/* Centered 3-dots button REMOVED · Philip 2026-09-03 "REMOVE
            THE 3 DOTS FROM HEADER CENTER". The conversation-menu
            entry is now surfaced via the "Chats" tile in the keypad's
            8-tile insert grid (Chats tile replaced the former Brain
            tile). No pulsing 3-dots in the header center anymore. */}
      </header>
      )}

      {/* Alex header profile + online/typing label removed 2026-09-03
          per Philip · identity of the current speaker is still visible
          on the individual message bubbles (avatar chip + name row),
          so the persistent top-right cluster is no longer needed. */}

      {/* HERO container · Philip 2026-09-02 world-class flow.
          The current focus of the conversation:
          - Idle: Alex's last incoming message
          - Reply mode: whichever bubble the user selected
          - Typing: live preview of the user's reply appears below the
            quoted message with the User identity chip.
          Tap any friend bubble to swap the hero focus.

          REVERTED · Philip 2026-09-03 "REVERT THE TEXT FIELD BACK TO
          HERO AREA". The earlier Composer-wins behaviour (hero fades
          to opacity 0 when a message is selected) is UNDONE — the hero
          now stays fully visible during compose/reply so the typed
          text can appear inside the hero's showReplyPreview block
          (the hero is once again the visual "canvas" for the reply). */}
      {/* Hero REMOVED entirely · Philip 2026-09-03 "why we need hero
          chat bubble why not select the chat bubble and type reply on
          the screen". The selected bubble now stays in-place in the
          feed (with orange left-accent), auto-scrolled above the
          keypad so the user can see it while typing. JSX kept but
          short-circuited so nothing renders. */}
      {false && heroMessage && (selectedMessageId != null || showReplyPreview) && (
        <div style={{
          opacity: 1,
          pointerEvents: "auto",
        }}>
        <div style={{
          // Hero BUBBLE · Philip 2026-09-03 "move the bubble up max
          // to under frame". Top margin pulled aggressively negative
          // so the bubble sits as close to the frame's inner top as
          // possible now that the profile cluster + header area above
          // is gone. Friend name is CENTERED inside the bubble (above
          // the message text).
          position: "relative",
          margin: "-24px 8px 12px 0",
          padding: "10px 16px 12px",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(156,163,175,0.4)",
          borderRadius: 16,
          color: NEX.text,
          transition: "background 140ms ease, border-color 140ms ease, transform 100ms ease",
          minHeight: 66,
        }}>
            {/* Centered friend name · Philip 2026-09-03 "add name in
                bubble center". Sits above the message text as the
                identity label for the hero. Tap opens profile drawer. */}
            <button
              type="button"
              aria-label={`${friend.name} profile`}
              onClick={(e) => { e.stopPropagation(); onOpenProfile?.(); }}
              style={{
                appearance: "none",
                border: "none",
                background: "transparent",
                color: NEX.orange,
                cursor: "pointer",
                padding: 0,
                margin: "0 auto 6px",
                display: "block",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 0.3,
                textAlign: "center",
                width: "100%",
              }}
            >
              {friend.name.split(" ")[0]}
            </button>

            {/* Source message body · fills the full bubble width. */}
            <div style={{
              color: NEX.text,
              fontSize: 14,
              lineHeight: 1.5,
              letterSpacing: -0.05,
              textAlign: "center",
            }}>
              {heroMessage.text}
            </div>

          {/* Idle prompt · Philip 2026-09-02 · "Add a tiny prompt to
              the hero when idle so first-time users know the hero is
              an input trigger". Only shows when nothing is being typed. */}
          {!showReplyPreview && (
            <div style={{
              marginTop: 8,
              paddingLeft: 56,
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: USER_IDENTITY_COLOR,
              fontSize: 11,
              fontStyle: "italic",
              opacity: 0.7,
            }}>
              <span aria-hidden style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: USER_IDENTITY_COLOR }} />
              Reply to {friend.name.split(" ")[0]}…
            </div>
          )}

          {/* Live-reply preview · shows when user is composing a reply.
              Divided from the source with a subtle orange line. */}
          {showReplyPreview && (
            <div style={{
              marginTop: 10,
              // Typing bubble · Philip 2026-09-03 option A. Subtle
              // green-tinted background matches the user-message bubbles
              // in the feed (rgba(5,150,105,0.16)), signals identity
              // through the CONTAINER while keeping typed text white +
              // fully readable. Rounded container replaces the earlier
              // dashed-orange top separator (tint + rim is enough).
              padding: "8px 10px",
              borderRadius: 10,
              background: "rgba(5,150,105,0.10)",
              border: "1px solid rgba(5,150,105,0.25)",
              position: "relative",
              // Typing row · [You badge] [typed text · caret] on ONE
              // line · Philip 2026-09-03. Text flexes to fill and wraps
              // naturally if it overflows; the badge stays put.
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              flexWrap: "wrap",
              // Prevent the whole preview from bleeding past the parent
              // bubble edge on tight widths.
              minWidth: 0,
              overflow: "hidden",
            }}>
              {/* Typing identity · small black "You" bubble · Philip
                  2026-09-03. Text-only identity signal · user's own
                  avatar is not shown in the user's own chat. */}
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 8px",
                borderRadius: 999,
                background: "#0a0a0a",
                border: "1px solid rgba(255,255,255,0.10)",
                color: USER_IDENTITY_COLOR,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.1,
                flexShrink: 0,
              }}>
                You
              </div>
              <div style={{
                flex: 1,
                minWidth: 0,
                color: NEX.text,
                fontSize: 14,
                lineHeight: 1.5,
                letterSpacing: -0.05,
                // Fix · Philip 2026-09-03 "text running outside hero
                // bubble edge on the right". Force long words / URLs to
                // wrap inside the flex parent instead of pushing the
                // whole row past its right edge.
                overflowWrap: "anywhere",
                wordBreak: "break-word",
              }}>
                {typedText}
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 2, height: 14,
                    background: USER_IDENTITY_COLOR,
                    marginLeft: 2,
                    verticalAlign: "middle",
                    animation: "nex-caret-blink 1s steps(2) infinite",
                    borderRadius: 1,
                  }}
                />
              </div>
            </div>
          )}
        </div>
        </div>
      )}

      {/* Pinned bar stripped · Philip 2026-09-02 "strip all · clean
          screen under the profiles". */}

      {/* ── Message thread ────────────────────────────────────────── */}
      <div
        ref={threadRef}
        onScroll={onThreadScroll}
        className="nex-no-scrollbar"
        style={threadStyle}
      >
        {/* Thin dashed orange vertical thread-line down the left of the thread */}
        {/* Rail line removed · Philip 2026-09-02 bubble pivot. Bubble
            alignment now carries sender identity, no rail needed. */}

        {filteredTopLevel.length === 0 && activeQuery && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 20px",
            gap: 8,
          }}>
            <Search size={24} strokeWidth={1.5} color={NEX.textFaint} />
            <span style={{ fontSize: 13, color: NEX.textMuted }}>
              No messages matching &ldquo;{searchQuery}&rdquo;
            </span>
          </div>
        )}
        {filteredTopLevel.map((m, idx) => {
          // Turn-boundary + burst detection · Philip 2026-09-02.
          //   A turn ENDS when the next top-level message is from a
          //   different sender. A burst STARTS when the previous message
          //   is from a different sender (or this is the first). Burst
          //   starts show the avatar + name; continuations show text only.
          const prevMsg = filteredTopLevel[idx - 1];
          const nextMsg = filteredTopLevel[idx + 1];
          const isBurstStart = !prevMsg || prevMsg.sender !== m.sender;
          const isTurnEnd = !nextMsg || nextMsg.sender !== m.sender;
          // Day-divider detection · Philip 2026-09-02 · insert a pill
          // divider before this message when its dayLabel differs from
          // the previous message's (or on the very first message).
          const currentDay = m.dayLabel ?? "Today";
          const prevDay   = prevMsg ? (prevMsg.dayLabel ?? "Today") : null;
          const showDayDivider = !prevMsg || prevDay !== currentDay;
          const showNewDivider = m.id === newSinceOpen.firstUnreadId;
          // NEX ASSIST · PRIVATE render · Philip 2026-09-03. When the
          // user asks NEX privately (via the ✨ button on the composer),
          // NEX's reply lands here as a "nex-private" message. Renders
          // as a distinct orange-bordered container with a "✨ NEX" badge
          // · full width · not aligned like normal friend/user bubbles ·
          // visible only to the current user (never sent to the friend).
          if (m.sender === "nex-private") {
            return (
              <div
                key={m.id}
                style={{
                  margin: "8px 4px 12px 4px",
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "rgba(249,115,22,0.06)",
                  border: "1px solid rgba(249,115,22,0.45)",
                  boxShadow: "0 4px 12px rgba(249,115,22,0.10)",
                  color: NEX.text,
                  animation: `nex-throw-from-left 500ms cubic-bezier(0.34, 1.36, 0.64, 1) both`,
                  transformOrigin: "top left",
                }}
              >
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 6,
                  marginBottom: 4,
                }}>
                  <div style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    color: NEX.orange,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                  }}>
                    <Smile size={10} strokeWidth={2.4} />
                    NEX · private
                  </div>
                  <span style={{
                    fontSize: 9,
                    color: "rgba(245,245,245,0.45)",
                    letterSpacing: 0.2,
                  }}>
                    only you can see this
                  </span>
                </div>
                <div style={{
                  fontSize: 13.5,
                  lineHeight: 1.45,
                  color: NEX.text,
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                }}>
                  {m.text}
                </div>
                <div style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 8,
                  flexWrap: "wrap",
                }}>
                  <button
                    type="button"
                    aria-label="Copy NEX reply"
                    onClick={() => { navigator.clipboard?.writeText(m.text); }}
                    style={{
                      appearance: "none",
                      border: "1px solid rgba(249,115,22,0.35)",
                      background: "transparent",
                      color: NEX.orange,
                      cursor: "pointer",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 0.3,
                      padding: "4px 10px",
                      borderRadius: 999,
                    }}
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    aria-label="Dismiss NEX reply"
                    onClick={() => onDeleteMessage?.(m.id)}
                    style={{
                      appearance: "none",
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "transparent",
                      color: "rgba(245,245,245,0.55)",
                      cursor: "pointer",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 0.3,
                      padding: "4px 10px",
                      borderRadius: 999,
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          }
          return (
            <React.Fragment key={m.id}>
              {/* Day pills + "N new" divider stripped for clean-screen mode. */}
              <MessageBlock
                message={m}
                friend={friend}
                replies={repliesByParent.get(m.id) ?? []}
                onOpenMenu={(id, el) => { openMenuAt(id, el); }}
                onQuickReply={(msg) => onReply?.(msg)}
                selectedMessageId={selectedMessageId}
                messagesById={messagesById}
                onCancelReply={onCancelReply}
                isTurnEnd={isTurnEnd}
                isBurstStart={isBurstStart}
                recordFor={recordFor}
                onCloseRecord={() => setRecordFor(null)}
                reactFor={reactFor}
                onCloseReact={() => setReactFor(null)}
                onAddReaction={onAddReaction}
                onOpenReactPicker={() => setReactFor(m.id)}
                nowTick={nowTick}
                registerRef={(el) => {
                  if (el) messageRefs.current.set(m.id, el);
                  else messageRefs.current.delete(m.id);
                }}
                editingId={editingId}
                onEditSave={(newText) => {
                  onEditMessage?.(m.id, newText);
                  setEditingId(null);
                }}
                onEditCancel={() => setEditingId(null)}
                userTypingText={userTypingText}
              />
              {/* Outside-the-bubble draft REMOVED · Philip 2026-09-03
                  "green bubble inside alex container like it was in
                  hero". Draft now renders NESTED inside the selected
                  Alex bubble (via MessageRow), matching the old
                  hero-inside-bubble pattern. Old outside-draft JSX
                  short-circuited below. */}
              {false && m.id === selectedMessageId && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    paddingLeft: 4,
                    paddingRight: 4,
                    marginTop: 4,
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      flex: "0 1 auto",
                      maxWidth: "80%",
                      minWidth: 120,
                      position: "relative",
                      padding: "10px 14px 8px",
                      borderRadius: 16,
                      // Draft bubble · Philip 2026-09-03. Same light
                      // hero-style container as the sent user bubbles ·
                      // green identity carried by the rim. Dashed edge
                      // kept (signals "unsent draft" · switches to
                      // solid rim once committed via the feed style).
                      background: "rgba(255,255,255,0.06)",
                      border: `1px dashed rgba(5,150,105,0.75)`,
                      color: NEX.text,
                      boxShadow: "0 4px 12px rgba(5,150,105,0.10)",
                      animation: "nex-throw-from-right 400ms cubic-bezier(0.34, 1.36, 0.64, 1) both",
                      transformOrigin: "top right",
                    }}
                  >
                    {/* "You" identity label at top, right-aligned. */}
                    <div style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: USER_IDENTITY_COLOR,
                      letterSpacing: -0.05,
                      marginBottom: 3,
                      textAlign: "right",
                      lineHeight: 1.1,
                    }}>
                      You
                    </div>
                    {/* Typed text + blinking caret · text flows into
                        the bubble as the user types on the keypad. */}
                    <div style={{
                      color: NEX.text,
                      fontSize: 14,
                      lineHeight: 1.45,
                      letterSpacing: -0.05,
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                      minHeight: 20,
                    }}>
                      {userTypingText ?? ""}
                      <span
                        aria-hidden
                        style={{
                          display: "inline-block",
                          width: 2,
                          height: 15,
                          background: USER_IDENTITY_COLOR,
                          marginLeft: 2,
                          verticalAlign: "middle",
                          animation: "nex-caret-blink 1s steps(2) infinite",
                          borderRadius: 1,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Per-conversation drawer · Philip 2026-09-03 · slides in from
          the right edge at 30% viewport width. Replaces the earlier
          dropdown popover; the ConversationMenu component below is
          kept in place but no longer rendered · could be removed in
          a future cleanup pass. Actions delegate to onOpenProfile /
          onToggleMute / onClearChat props. */}
      {convoMenuAnchor && frameMountEl && createPortal(
        <>
          {/* Invisible click-catcher · covers the FRAME viewport only
              (portalled into .nex-console-viewport). Closes on outside
              tap. No visual dim · matches the transparent drawer. */}
          <div
            onClick={() => setConvoMenuAnchor(null)}
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background: "transparent",
              zIndex: 14,
            }}
          />
          {/* Drawer · 30% of the FRAME width (not the browser viewport),
              right-anchored to the frame's inner right edge, full frame
              height, transparent surface. z:15 keeps it below the frame
              chassis overlay (z:20) so it visually slides UNDER the
              frame. Philip 2026-09-03 · "on the phone screen, 30% width
              of the transparent screen". */}
          <div
            role="menu"
            aria-label="Chats and conversation actions"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Escape") setConvoMenuAnchor(null); }}
            style={{
              position: "absolute",
              // Insets locked to DEFAULT_ZONES.workspace from
              // src/components/nexapp/hud/geometry.ts (Philip's
              // constitutional master-v3 measurements + 2.5% safe pad).
              // Transparent interior: top 7.27% · bottom 10.90% ·
              // left 8.32% · right 8.09%. Safe-padded workspace:
              // top 9.77% · left 10.82% · width 78.59% · height 76.83%.
              // → drawer bottom inset = 100 − 9.77 − 76.83 = 13.40%
              // → drawer right inset  = 100 − 10.82 − 78.59 = 10.59%
              top:    "9.77%",
              left:   "10.82%",
              right:  "10.59%",
              bottom: "13.40%",
              // NEX frosted glass · deep near-black with cool undertone,
              // high blur + slight saturation boost for true iOS-style
              // frost. Inner top rim (subtle white highlight) gives a
              // metallic edge. NOT WhatsApp flat green.
              background: "linear-gradient(180deg, rgba(18,18,24,0.55), rgba(8,8,12,0.68))",
              backdropFilter: "blur(22px) saturate(160%)",
              WebkitBackdropFilter: "blur(22px) saturate(160%)",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 20px 44px rgba(0,0,0,0.55)",
              zIndex: 15,
              display: "flex",
              flexDirection: "column",
              padding: "10px 10px",
              animation: "nex-drawer-slide-right 260ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
              pointerEvents: "auto",
              overflow: "hidden",
              boxSizing: "border-box",
            }}
          >
            {/* Header row · title + close button */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 4px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 8, flexShrink: 0 }}>
              <span style={{ color: NEX.text, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700 }}>
                Chats
              </span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setConvoMenuAnchor(null)}
                style={{ appearance: "none", border: "none", background: "transparent", color: NEX.textMuted, cursor: "pointer", padding: 4, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              >
                <XIcon size={16} strokeWidth={2} />
              </button>
            </div>

            {/* ── REQUESTS section · Philip 2026-09-03 ─────────────
                Pending message requests · people you're not yet
                connected with. Renders above search when there's at
                least one. Each request has Accept ✓ / Decline ✕
                inline. Silent degradation pattern from the earlier
                design discussion — unfriended/blocked exit is silent
                on the sender side; requests are the polite inbound. */}
            {(() => {
              const requests = NEX_MOCK_FRIENDS.filter((f) => f.isRequest);
              if (requests.length === 0) return null;
              return (
                <div style={{ flexShrink: 0, marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 4px" }}>
                    <span style={{ color: NEX.orange, fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 800 }}>
                      Requests
                    </span>
                    <span aria-label={`${requests.length} pending request${requests.length > 1 ? "s" : ""}`} style={{
                      background: "#EF4444",
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 800,
                      padding: "1px 6px",
                      borderRadius: 999,
                      lineHeight: 1.4,
                      boxShadow: "0 0 6px rgba(239,68,68,0.5)",
                    }}>
                      {requests.length}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {requests.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 8px",
                          background: "linear-gradient(180deg, rgba(249,115,22,0.08), rgba(249,115,22,0.02))",
                          border: "1px solid rgba(249,115,22,0.2)",
                          borderRadius: 8,
                          boxShadow: "inset 0 1px 0 rgba(249,115,22,0.1)",
                        }}
                      >
                        {/* Avatar */}
                        <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", background: r.color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>
                          {r.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.photoUrl} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (r.initial ?? r.name.charAt(0))}
                        </div>
                        {/* Name + message preview */}
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                          <span style={{ color: NEX.text, fontSize: 11, fontWeight: 700, letterSpacing: -0.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {r.name}
                          </span>
                          <span style={{ color: NEX.textMuted, fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {r.lastMessage?.text ?? "wants to connect"}
                          </span>
                        </div>
                        {/* Accept · orange filled · closes drawer,
                            switches active chat to the new contact
                            (which triggers the first-connection
                            confetti celebration in NexFriendChatView
                            because requests are marked isFirstConnection).
                            Philip 2026-09-03. */}
                        <button
                          type="button"
                          aria-label={`Accept request from ${r.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConvoMenuAnchor(null);
                            onSelectFriend?.(r.id);
                          }}
                          style={{
                            appearance: "none", border: "none", background: NEX.orange, color: "#0a0a0a",
                            width: 24, height: 24, borderRadius: 6,
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", flexShrink: 0,
                            boxShadow: "0 0 6px rgba(249,115,22,0.35)",
                            WebkitTapHighlightColor: "transparent",
                          }}
                        >
                          <Check size={13} strokeWidth={2.6} />
                        </button>
                        {/* Decline · red · silent (no notification to
                            the requester per the design principle).
                            In production this would flag the request
                            as declined server-side; here it's a stub. */}
                        <button
                          type="button"
                          aria-label={`Decline request from ${r.name}`}
                          onClick={(e) => { e.stopPropagation(); /* stub · silent decline */ }}
                          style={{
                            appearance: "none",
                            border: "1px solid rgba(239,68,68,0.4)",
                            background: "rgba(239,68,68,0.12)",
                            color: "#EF4444",
                            width: 24, height: 24, borderRadius: 6,
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", flexShrink: 0,
                            WebkitTapHighlightColor: "transparent",
                          }}
                        >
                          <XIcon size={12} strokeWidth={2.4} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Search input · substring match on name or nex handle */}
            <div style={{ position: "relative", flexShrink: 0, marginBottom: 8 }}>
              <Search size={12} strokeWidth={2} color={NEX.textMuted} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input
                type="text"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Search chats"
                aria-label="Search chats"
                style={{
                  width: "100%",
                  appearance: "none",
                  border: `1px solid ${NEX.borderMuted}`,
                  background: "#181818",
                  color: NEX.text,
                  fontSize: 12,
                  padding: "6px 10px 6px 26px",
                  borderRadius: 8,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* ── Contact list · inbox rows · Philip 2026-09-03 ────────
                Left-aligned horizontal rows: avatar (+ presence dot) →
                name (+ muted icon) + timestamp on line 1 → last-message
                preview + unread badge on line 2. Filters out the
                current friend (their chat is already open). Sorts
                unread-first, then by unread count, then alphabetical.
                Whole list scrolls inside the drawer. Tapping a row
                closes the drawer and swaps the active chat. */}
            <div
              className="nex-no-scrollbar"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                overflowY: "auto",
                overflowX: "hidden",
                minHeight: 0,
                flex: 1,
              }}
            >
              {(() => {
                // Status priority · typing/online = actively engaged
                // ("busy"), away = partially present, offline = last.
                // Philip 2026-09-03 · offline was incorrectly ranking
                // above busy contacts when sorted only by unread + name.
                const statusRank = (s: MockFriend["status"]) =>
                  s === "typing" ? 0 : s === "online" ? 1 : s === "away" ? 2 : 3;

                const q = contactSearch.trim().toLowerCase();
                const rows = NEX_MOCK_FRIENDS
                  .filter((f) => f.id !== friend.id)
                  .filter((f) => !f.isRequest) // requests render in their own section above
                  .filter((f) => {
                    if (!q) return true;
                    return f.name.toLowerCase().includes(q) || (f.nexId ?? "").toLowerCase().includes(q);
                  })
                  .slice()
                  .sort((a, b) => {
                    // 1 · Blocked contacts sink to the very bottom
                    //     (Philip 2026-09-03 · "blocked contacts are last")
                    const aBlocked = a.blocked ? 1 : 0;
                    const bBlocked = b.blocked ? 1 : 0;
                    if (aBlocked !== bBlocked) return aBlocked - bBlocked;
                    // 2 · Unfriended contacts sit just above blocked
                    //     (below active friends · above hostile boundary)
                    const aUnfr = a.unfriended ? 1 : 0;
                    const bUnfr = b.unfriended ? 1 : 0;
                    if (aUnfr !== bUnfr) return aUnfr - bUnfr;
                    // 3 · Unread first (attention wins)
                    const aHas = (a.unread ?? 0) > 0 ? 0 : 1;
                    const bHas = (b.unread ?? 0) > 0 ? 0 : 1;
                    if (aHas !== bHas) return aHas - bHas;
                    // 4 · Within unread, higher count first
                    const aU = a.unread ?? 0;
                    const bU = b.unread ?? 0;
                    if (aU !== bU) return bU - aU;
                    // 5 · Then busy (typing/online) → away → offline
                    const aRank = statusRank(a.status);
                    const bRank = statusRank(b.status);
                    if (aRank !== bRank) return aRank - bRank;
                    // 6 · Alphabetical tiebreaker
                    return a.name.localeCompare(b.name);
                  });

                if (rows.length === 0) {
                  return (
                    <div style={{ padding: "24px 8px", textAlign: "center", color: NEX.textFaint, fontSize: 11 }}>
                      {q ? `No chats matching "${contactSearch}"` : "No other chats yet"}
                    </div>
                  );
                }

                return rows.map((c) => {
                  const unreadN = c.unread ?? 0;
                  const presenceColor =
                    c.status === "online" || c.status === "typing" ? "#10B981" :
                    c.status === "away"    ? "#F59E0B" :
                    "#6B7280";
                  const kindIcon =
                    c.lastMessage?.kind === "photo"  ? "📷 " :
                    c.lastMessage?.kind === "video"  ? "🎥 " :
                    c.lastMessage?.kind === "file"   ? "📎 " :
                    c.lastMessage?.kind === "mascot" ? "🎭 " :
                    "";
                  // When c.theyBlockedYou, freeze signals silently: no
                  // live preview text, no fresh timestamp. Show a muted
                  // "—" so the layout doesn't collapse. Philip 2026-09-03.
                  const previewText = c.theyBlockedYou
                    ? "—"
                    : c.status === "typing" ? "typing…" :
                      c.lastMessage?.text ?? "";
                  const timeText = c.theyBlockedYou
                    ? ""
                    : (c.lastMessage?.time ?? c.lastOnline);

                  const ariaLabelParts = [
                    c.name,
                    c.status,
                    unreadN > 0 ? `${unreadN} unread` : "no unread",
                    c.muted ? "muted" : null,
                    "tap to open chat",
                  ].filter(Boolean).join(", ");
                  return (
                    <button
                      key={c.id}
                      ref={(el) => {
                        if (el) rowRefsMap.current.set(c.id, el);
                        else    rowRefsMap.current.delete(c.id);
                      }}
                      type="button"
                      onClick={() => { setConvoMenuAnchor(null); onSelectFriend?.(c.id); }}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                          e.preventDefault();
                          const ids = Array.from(rowRefsMap.current.keys());
                          const idx = ids.indexOf(c.id);
                          const nextIdx = e.key === "ArrowDown" ? Math.min(ids.length - 1, idx + 1) : Math.max(0, idx - 1);
                          rowRefsMap.current.get(ids[nextIdx])?.focus();
                        }
                      }}
                      aria-label={ariaLabelParts}
                      style={(() => {
                        // Card theme priority (Philip 2026-09-03):
                        //   1. Unread → orange (attention wins)
                        //   2. Busy = online/typing/AWAY → yellow theme
                        //   3. Offline → red theme
                        // Blocked is INTENTIONALLY not a card theme —
                        // it renders as neutral + an inline BLOCKED tag
                        // (per Philip's ask). Unread override still
                        // applies even to busy/offline/blocked contacts.
                        // "Away" counts as busy so Priya + Marcus get
                        // the yellow theme (Philip 2026-09-03 correction).
                        const busy    = c.status === "online" || c.status === "typing" || c.status === "away";
                        const offline = c.status === "offline";
                        const theme =
                          unreadN > 0 ? "orange" :
                          busy         ? "yellow" :
                          offline      ? "red"    :
                          "neutral";

                        const t = {
                          orange:  { bg: "linear-gradient(180deg, rgba(28,22,16,0.9), rgba(14,12,10,0.92))", border: "rgba(249,115,22,0.28)", borderHover: "rgba(249,115,22,0.5)", accent: NEX.orange, rim: "rgba(249,115,22,0.18)" },
                          yellow:  { bg: "linear-gradient(180deg, rgba(28,25,15,0.9), rgba(14,13,9,0.92))",  border: "rgba(245,158,11,0.28)", borderHover: "rgba(245,158,11,0.5)", accent: "#F59E0B", rim: "rgba(245,158,11,0.18)" },
                          red:     { bg: "linear-gradient(180deg, rgba(28,16,16,0.9), rgba(14,10,10,0.92))", border: "rgba(239,68,68,0.24)",  borderHover: "rgba(239,68,68,0.45)", accent: "#EF4444", rim: "rgba(239,68,68,0.15)" },
                          neutral: { bg: "linear-gradient(180deg, rgba(22,22,26,0.85), rgba(12,12,16,0.9))", border: "rgba(255,255,255,0.05)", borderHover: "rgba(255,255,255,0.12)", accent: "rgba(255,255,255,0.05)", rim: "rgba(255,255,255,0.06)" },
                        }[theme];

                        return {
                          appearance: "none" as const,
                          background: t.bg,
                          border: `1px solid ${t.border}`,
                          borderLeft: theme === "neutral"
                            ? `1px solid ${t.border}`
                            : `3px solid ${t.accent}`,
                          borderRadius: 10,
                          boxShadow: `inset 0 1px 0 ${t.rim}, 0 2px 4px rgba(0,0,0,0.4)`,
                          padding: "8px 10px 8px 10px",
                          cursor: "pointer" as const,
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          color: "inherit",
                          textAlign: "left" as const,
                          // Blocked contacts are visually demoted but
                          // not tinted (per Philip) · they show a red
                          // BLOCKED tag inline instead.
                          opacity: c.blocked ? 0.6 : 1,
                          WebkitTapHighlightColor: "transparent",
                          transition: "background 140ms ease, border-color 140ms ease, transform 100ms ease, opacity 140ms ease",
                        };
                      })()}
                      onMouseEnter={(e) => {
                        const busy    = c.status === "online" || c.status === "typing" || c.status === "away";
                        const offline = c.status === "offline";
                        const hoverColor =
                          unreadN > 0 ? "rgba(249,115,22,0.5)" :
                          busy         ? "rgba(245,158,11,0.5)" :
                          offline      ? "rgba(239,68,68,0.45)" :
                          "rgba(255,255,255,0.12)";
                        // Only update the three non-left borders · left
                        // side stays the vivid accent bar. Using the
                        // shorthand would wash the accent out on hover
                        // (Philip 2026-09-03 · "edge color disappears
                        // on hover").
                        e.currentTarget.style.borderTopColor = hoverColor;
                        e.currentTarget.style.borderRightColor = hoverColor;
                        e.currentTarget.style.borderBottomColor = hoverColor;
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={(e) => {
                        const busy    = c.status === "online" || c.status === "typing" || c.status === "away";
                        const offline = c.status === "offline";
                        const restColor =
                          unreadN > 0 ? "rgba(249,115,22,0.28)" :
                          busy         ? "rgba(245,158,11,0.28)" :
                          offline      ? "rgba(239,68,68,0.24)" :
                          "rgba(255,255,255,0.05)";
                        e.currentTarget.style.borderTopColor = restColor;
                        e.currentTarget.style.borderRightColor = restColor;
                        e.currentTarget.style.borderBottomColor = restColor;
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      {/* Avatar with presence dot · when this contact
                          has blocked YOU (c.theyBlockedYou), photo is
                          replaced with a grey silhouette and the
                          presence dot is hidden · industry-standard
                          "degraded view" from Option 3 of the block-UX
                          design. Philip 2026-09-03. */}
                      <div style={{ position: "relative", width: 40, height: 40, flexShrink: 0 }}>
                        <div style={{
                          width: "100%", height: "100%",
                          padding: 2,
                          borderRadius: "50%",
                          background: c.theyBlockedYou
                            ? "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))"
                            : `conic-gradient(from 0deg, ${NEX.orange}, ${NEX.orangeSoft}, ${NEX.orange})`,
                          boxShadow: c.theyBlockedYou ? "none" : "0 2px 5px rgba(0,0,0,0.5)",
                          boxSizing: "border-box",
                        }}>
                          <div style={{
                            width: "100%", height: "100%", borderRadius: "50%",
                            background: c.theyBlockedYou ? "#333" : (c.color ?? "#333"),
                            overflow: "hidden",
                            color: c.theyBlockedYou ? "rgba(255,255,255,0.35)" : "#fff",
                            fontSize: 13, fontWeight: 700,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {c.theyBlockedYou ? (
                              <User size={22} strokeWidth={2} />
                            ) : c.photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={c.photoUrl}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", display: "block" }}
                              />
                            ) : (
                              c.initial ?? c.name.charAt(0)
                            )}
                          </div>
                        </div>
                        {/* Presence dot · hidden entirely when blocked-you */}
                        {!c.theyBlockedYou && (
                          <span aria-hidden style={{
                            position: "absolute",
                            bottom: -1, right: -1,
                            width: 11, height: 11,
                            borderRadius: "50%",
                            background: presenceColor,
                            border: "2px solid #050505",
                            boxShadow: c.status === "typing" ? "0 0 5px rgba(16,185,129,0.6)" : "none",
                            animation: c.status === "typing" ? "nex-typing-bounce 1.2s ease-in-out infinite" : "none",
                          }} />
                        )}
                      </div>

                      {/* Text column · name/timestamp + preview/badge */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                          <span style={{
                            color: NEX.text,
                            fontSize: 13,
                            fontWeight: unreadN > 0 ? 700 : 600,
                            letterSpacing: -0.1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                            minWidth: 0,
                          }}>
                            {c.name}
                          </span>
                          {c.blocked && (
                            <span aria-label="blocked" style={{
                              flexShrink: 0,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              padding: "1px 5px",
                              borderRadius: 4,
                              background: "rgba(239,68,68,0.15)",
                              color: "#EF4444",
                              fontSize: 8,
                              fontWeight: 800,
                              letterSpacing: 0.6,
                              border: "1px solid rgba(239,68,68,0.35)",
                            }}>
                              <Ban size={9} strokeWidth={2.5} />
                              BLOCKED
                            </span>
                          )}
                          {c.unfriended && !c.blocked && (
                            <span aria-label="unfriended" style={{
                              flexShrink: 0,
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "1px 5px",
                              borderRadius: 4,
                              background: "rgba(255,255,255,0.06)",
                              color: NEX.textMuted,
                              fontSize: 8,
                              fontWeight: 800,
                              letterSpacing: 0.6,
                              border: "1px solid rgba(255,255,255,0.14)",
                            }}>
                              UNFRIEND
                            </span>
                          )}
                          {c.muted && !c.blocked && !c.unfriended && (
                            <BellOff size={11} strokeWidth={2} color={NEX.textMuted} style={{ flexShrink: 0 }} />
                          )}
                          <span style={{
                            // Timestamp color matches the card theme
                            // so time + accent + card body all read as
                            // one language. Philip 2026-09-03.
                            //   unread  → orange (attention wins)
                            //   busy    → amber  (matches yellow card)
                            //   offline → red    (matches red card)
                            //   else    → muted grey
                            color: (() => {
                              if (unreadN > 0) return NEX.orange;
                              if (c.status === "online" || c.status === "typing" || c.status === "away") return "#F59E0B";
                              if (c.status === "offline") return "#EF4444";
                              return NEX.textMuted;
                            })(),
                            fontSize: 10,
                            fontWeight: unreadN > 0 ? 700 : 500,
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}>
                            {timeText}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                          <span style={{
                            color: unreadN > 0 ? "rgba(245,245,245,0.9)" : NEX.textMuted,
                            fontSize: 11,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                            minWidth: 0,
                            fontStyle: c.status === "typing" ? "italic" : "normal",
                          }}>
                            {kindIcon}{previewText}
                          </span>
                          {unreadN > 0 && (
                            <span
                              aria-label={`${unreadN} unread`}
                              style={{
                                flexShrink: 0,
                                minWidth: 18,
                                height: 18,
                                padding: "0 5px",
                                borderRadius: 999,
                                background: "#991B1B",
                                color: "#fff",
                                fontSize: 10,
                                fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                lineHeight: 1,
                                boxShadow: "0 0 5px rgba(153,27,27,0.5)",
                              }}
                            >
                              {unreadN > 9 ? "9+" : unreadN}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                });
              })()}
            </div>

            {/* ── Add contact by @nex_id · Philip 2026-09-03 ──────────
                Bottom-of-drawer input · type a NEX handle and tap the
                + button (or press Enter) to invite that user into your
                chats. Trimmed to non-empty · duplicate/self checks live
                in the parent-supplied handler. */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const raw = addNexIdDraft.trim();
                if (!raw) return;
                const handle = raw; // NEX handles have no `@` prefix.

                // Client-side format validation · reject inline.
                // Allows letters, digits, `_`, `.`, `-` (needed for the
                // free-tier "Nex-XXXXX" format). No `@` in NEX handles.
                if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(handle)) {
                  setAddResult({ ok: false, message: "Invalid handle · use letters, digits, _, . or -" });
                  return;
                }

                // Mock registry lookup (real backend hook is
                // onAddContactByNexId · called below for wiring).
                const match = NEX_MOCK_FRIENDS.find((f) => f.nexId?.toLowerCase() === handle.toLowerCase());
                if (match) {
                  if (match.id === friend.id) {
                    setAddResult({ ok: false, message: "That's your current chat" });
                  } else {
                    setAddResult({ ok: true, message: `${match.name} is already in your NEX network` });
                    setAddNexIdDraft("");
                  }
                } else {
                  setAddResult({ ok: false, message: `${handle} isn't on NEX yet` });
                }

                // Notify parent for real backend / analytics / etc.
                onAddContactByNexId?.(handle);
              }}
              style={{
                flexShrink: 0,
                marginTop: 8,
                paddingTop: 8,
                borderTop: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                flexDirection: "column",
                gap: 5,
              }}
            >
              <span style={{ color: NEX.textMuted, fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700, padding: "0 4px" }}>
                Add contact
              </span>

              {/* Debounced lookup preview · shows the matching contact
                  as the user types so submit is never a mystery. */}
              {lookupPreview && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 8px",
                  background: "rgba(16,185,129,0.09)",
                  border: "1px solid rgba(16,185,129,0.28)",
                  borderRadius: 8,
                  fontSize: 10,
                  color: "#10B981",
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: lookupPreview.color ?? "#333",
                    overflow: "hidden",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 10, fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {lookupPreview.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={lookupPreview.photoUrl} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (lookupPreview.initial ?? lookupPreview.name.charAt(0))}
                  </div>
                  <span style={{ fontWeight: 600, letterSpacing: -0.1 }}>{lookupPreview.name}</span>
                  <span style={{ color: NEX.textMuted, fontSize: 9 }}>found · press Enter</span>
                </div>
              )}
              <div style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                background: "#181818",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                padding: "4px 4px 4px 10px",
              }}>
                <input
                  type="text"
                  value={addNexIdDraft}
                  onChange={(e) => setAddNexIdDraft(e.target.value)}
                  placeholder="name or Nex-XXXXX"
                  aria-label="Add contact by NEX id"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    appearance: "none",
                    border: "none",
                    background: "transparent",
                    color: NEX.text,
                    fontSize: 12,
                    padding: "6px 0",
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  aria-label="Add contact"
                  disabled={addNexIdDraft.trim().length === 0}
                  style={{
                    appearance: "none",
                    border: "none",
                    // Always orange · visually anchors the add action
                    // even when the field is empty. Slight opacity dim
                    // when disabled communicates "type first" without
                    // losing the identity color.
                    background: NEX.orange,
                    color: "#0a0a0a",
                    opacity: addNexIdDraft.trim().length === 0 ? 0.5 : 1,
                    cursor: addNexIdDraft.trim().length === 0 ? "not-allowed" : "pointer",
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    boxShadow: addNexIdDraft.trim().length === 0
                      ? "none"
                      : "0 0 8px rgba(249,115,22,0.4)",
                    transition: "opacity 140ms ease, box-shadow 140ms ease",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <UserPlus size={14} strokeWidth={2.2} />
                </button>
              </div>

              {/* Result banner · auto-clears after ~3.5s */}
              {addResult && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 6px",
                    fontSize: 10,
                    fontWeight: 500,
                    color: addResult.ok ? "#10B981" : "#EF4444",
                  }}
                >
                  <span aria-hidden style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 12, height: 12,
                    borderRadius: "50%",
                    background: addResult.ok ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                    fontSize: 9,
                    fontWeight: 700,
                  }}>
                    {addResult.ok ? "✓" : "!"}
                  </span>
                  <span>{addResult.message}</span>
                </div>
              )}
            </form>
          </div>
        </>,
        frameMountEl,
      )}

      {/* ── Chat-actions panel · Philip 2026-09-03 ─────────────────────
          Triggered by the app-header 3-dots (custom event
          "nex:open-chat-actions"). Same drawer geometry as the contacts
          drawer but content is only the "This chat" actions block. */}
      {actionsPanelOpen && frameMountEl && createPortal(
        <>
          {/* Click-catcher · workspace-zone bounds so clicks on the
              frame chassis don't accidentally close it. */}
          <div
            onClick={() => setActionsPanelOpen(false)}
            aria-hidden
            style={{ position: "absolute", inset: 0, background: "transparent", zIndex: 14 }}
          />
          <div
            role="menu"
            aria-label={`Actions for chat with ${friend.name}`}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Escape") setActionsPanelOpen(false); }}
            style={{
              position: "absolute",
              // Same constitutional workspace-zone insets as the
              // contacts drawer (DEFAULT_ZONES.workspace).
              top:    "9.77%",
              left:   "10.82%",
              right:  "10.59%",
              bottom: "13.40%",
              background: "rgba(0,0,0,0.72)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.06)",
              zIndex: 15,
              display: "flex",
              flexDirection: "column",
              padding: "10px 8px",
              animation: "nex-drawer-slide-right 260ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
              pointerEvents: "auto",
              overflow: "hidden",
              boxSizing: "border-box",
            }}
          >
            {/* Header · business-card layout · Philip 2026-09-03.
                Horizontal avatar + identity block on top row, then a
                stats strip (Contacts / Daily / Since), then optional
                shared-context line. NEX id displays the tier · free =
                "Nex-XXXXX", paid = user's chosen name — a subtle pill
                labels the tier. Close X floats top-right. */}
            {(() => {
              const isBusy      = friend.status === "online" || friend.status === "typing";
              const isAway      = friend.status === "away";
              const presenceBg  = isBusy ? "#10B981" : isAway ? "#F59E0B" : "#6B7280";
              // Online = no label text (just the green dot conveys it);
              // other statuses keep a short label. Philip 2026-09-03.
              const presenceLabel =
                friend.status === "typing" ? "typing…" :
                friend.status === "online" ? "" :
                friend.status === "away"   ? "away" :
                friend.lastOnline ? `last seen ${friend.lastOnline}` : "offline";
              const presenceTextColor =
                isBusy ? "#10B981" : isAway ? "#F59E0B" : NEX.textMuted;
              const flag = flagEmoji(friend.countryCode);
              const nexTier = friend.nexTier ?? "free";
              // NEX handles never use the `@` prefix (Philip 2026-09-03).
              // Paid handles are the user's chosen name (e.g. "alex");
              // free handles are the auto-assigned "Nex-XXXXX". Both
              // display exactly as stored — no punctuation added.
              const displayNexId = friend.nexId ?? "";
              // If this contact has blocked you (Option 3 of the block-UX
              // design), strip live signals: no photo, no presence, no
              // stats, no since-connected strip, no socials. Silent.
              // Philip 2026-09-03.
              const stripped = friend.theyBlockedYou ?? false;
              const dailyLabel = (() => {
                const m = friend.dailyActiveMinutes ?? 0;
                if (m === 0) return "—";
                if (m < 60) return `${m}m`;
                const h = Math.floor(m / 60);
                const rem = m % 60;
                return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
              })();
              const contactsLabel = (() => {
                const n = friend.contactCount ?? 0;
                if (n === 0) return "—";
                if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
                return String(n);
              })();
              const memberSinceLabel = friend.memberSince ?? "—";
              return (
                <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 10, padding: "2px 2px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 10, flexShrink: 0 }}>
                  {/* Close X · absolute top-right */}
                  <button
                    type="button"
                    aria-label="Close menu"
                    onClick={() => setActionsPanelOpen(false)}
                    style={{
                      position: "absolute", top: 0, right: 0,
                      appearance: "none", border: "none", background: "transparent",
                      color: NEX.textMuted, cursor: "pointer",
                      padding: 4,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      WebkitTapHighlightColor: "transparent",
                      zIndex: 2,
                    }}
                  >
                    <XIcon size={16} strokeWidth={2} />
                  </button>

                  {/* Top row · avatar + identity block · horizontal */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 24 }}>
                    {/* Avatar · orange rim + presence dot · stripped
                        to silhouette (no rim, grey circle, no dot)
                        when this contact has blocked you. */}
                    <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
                      <div style={{
                        width: "100%", height: "100%",
                        padding: 2,
                        borderRadius: "50%",
                        background: stripped
                          ? "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))"
                          : `conic-gradient(from 0deg, ${NEX.orange}, ${NEX.orangeSoft}, ${NEX.orange})`,
                        boxShadow: stripped ? "none" : "0 3px 10px rgba(0,0,0,0.55), 0 0 8px rgba(249,115,22,0.3)",
                        boxSizing: "border-box",
                      }}>
                        <div style={{
                          width: "100%", height: "100%", borderRadius: "50%",
                          background: stripped ? "#333" : (friend.color ?? "#333"),
                          overflow: "hidden",
                          color: stripped ? "rgba(255,255,255,0.35)" : "#fff",
                          fontSize: 18, fontWeight: 700,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {stripped ? (
                            <User size={30} strokeWidth={1.8} />
                          ) : friend.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={friend.photoUrl} alt="" loading="lazy" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", display: "block" }} />
                          ) : (friend.initial ?? friend.name.charAt(0))}
                        </div>
                      </div>
                      {!stripped && (
                        <span aria-hidden style={{
                          position: "absolute",
                          bottom: 0, right: 2,
                          width: 12, height: 12,
                          borderRadius: "50%",
                          background: presenceBg,
                          border: "2.5px solid #0a0a0a",
                          boxShadow: friend.status === "typing" ? "0 0 6px rgba(16,185,129,0.7)" : "none",
                          animation: friend.status === "typing" ? "nex-typing-bounce 1.2s ease-in-out infinite" : "none",
                        }} />
                      )}
                    </div>

                    {/* Identity column · name + tier + presence */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
                      {/* Name + verified checkmark */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                        <span style={{
                          color: NEX.text,
                          fontSize: 14,
                          fontWeight: 700,
                          letterSpacing: -0.15,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {friend.name}
                        </span>
                        {friend.verified && !stripped && (
                          <BadgeCheck size={13} strokeWidth={2.4} color={NEX.orange} style={{ flexShrink: 0 }} />
                        )}
                      </div>

                      {/* NEX id + tier pill */}
                      <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                        <span style={{
                          fontSize: 10,
                          color: NEX.textMuted,
                          letterSpacing: -0.05,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontFamily: nexTier === "free" ? "monospace, ui-monospace" : "inherit",
                        }}>
                          {displayNexId}
                        </span>
                        {(() => {
                          const isPro = nexTier === "pro_personal" || nexTier === "pro_business";
                          const isBiz = nexTier === "pro_business";
                          const verified = friend.businessVerificationStatus === "verified";
                          const label = nexTier === "free" ? "FREE" : (isBiz ? "BIZ" : "PRO");
                          const bg = nexTier === "free" ? "rgba(255,255,255,0.08)" : NEX.orange;
                          const color = nexTier === "free" ? NEX.textMuted : "#0a0a0a";
                          return (
                            <>
                              <span aria-label={`${nexTier} tier`} style={{
                                flexShrink: 0,
                                fontSize: 8,
                                fontWeight: 800,
                                letterSpacing: 0.8,
                                padding: "1px 5px",
                                borderRadius: 4,
                                background: bg,
                                color: color,
                                border: nexTier === "free" ? "1px solid rgba(255,255,255,0.1)" : "none",
                              }}>
                                {label}
                              </span>
                              {isBiz && verified && (
                                <BadgeCheck aria-label="verified business" size={11} strokeWidth={2.4} color={NEX.orange} style={{ flexShrink: 0 }} />
                              )}
                              {isPro && !isBiz}
                            </>
                          );
                        })()}
                      </div>

                      {/* Location line · flag + city · optional status
                          label when not plain "online" · dot removed
                          from this line (avatar dot is the presence
                          signal). When stripped (they blocked you),
                          hide location / flag / status entirely — no
                          fresh signals leak through. Philip 2026-09-03. */}
                      {!stripped && (
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 10,
                          fontWeight: 500,
                          color: presenceTextColor,
                          fontStyle: friend.status === "typing" ? "italic" : "normal",
                          minWidth: 0,
                        }}>
                          {flag && (
                            <span aria-label={friend.countryCode} style={{ fontSize: 12, lineHeight: 1, flexShrink: 0 }}>{flag}</span>
                          )}
                          {friend.location && (
                            <span style={{ color: NEX.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{friend.location}</span>
                          )}
                          {presenceLabel && (
                            <span style={{ color: NEX.textFaint, flexShrink: 0 }}>· {presenceLabel}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats strip · hidden entirely when this contact
                      has blocked you (no fresh signals should leak). */}
                  {!stripped && (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 1,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}>
                    {[
                      { value: contactsLabel,    label: "Contacts" },
                      { value: dailyLabel,       label: "Daily" },
                      { value: memberSinceLabel, label: "Since" },
                    ].map((cell) => (
                      <div key={cell.label} style={{
                        background: "rgba(15,15,20,0.6)",
                        padding: "6px 6px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 1,
                      }}>
                        <span style={{ color: NEX.text, fontSize: 13, fontWeight: 700, letterSpacing: -0.15, fontVariantNumeric: "tabular-nums" }}>
                          {cell.value}
                        </span>
                        <span style={{ color: NEX.textFaint, fontSize: 8, letterSpacing: 0.9, textTransform: "uppercase", fontWeight: 600 }}>
                          {cell.label}
                        </span>
                      </div>
                    ))}
                  </div>
                  )}

                  {/* NEX brain nudge · shown ONLY when this contact has
                      blocked you. Instead of a "you're blocked" banner
                      (which would violate the silent design), NEX
                      privately hints that the chat has gone quiet, in
                      the wellbeing framing from the design consult. */}
                  {stripped && (
                    <div style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      padding: "10px 10px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8,
                      color: NEX.textMuted,
                      fontSize: 10,
                      lineHeight: 1.4,
                    }}>
                      <span aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>💭</span>
                      <span>
                        <span style={{ color: NEX.text, fontWeight: 600, letterSpacing: -0.05 }}>It&apos;s been quiet here.</span>
                        <br />
                        <span>Some conversations naturally cool — try someone else in your circle.</span>
                      </span>
                    </div>
                  )}

                  {/* ── IN THIS CHAT strip · Philip 2026-09-03 ─────────
                      Category-defining relationship data · shows messages
                      exchanged / avg reply time / date the two of you
                      first chatted. Data NO OTHER chat app has because
                      they don't compute both-sides analytics. Renders
                      only when the mock provides values. Subtle orange
                      tint marks it as a NEX-native signal. */}
                  {!stripped && (friend.chatMessagesExchanged || friend.chatAvgReplyMinutes || friend.chatSince) && (() => {
                    const msgs   = friend.chatMessagesExchanged ?? 0;
                    const msgsLabel = msgs >= 1000 ? `${(msgs / 1000).toFixed(1)}k` : String(msgs);
                    const mins   = friend.chatAvgReplyMinutes ?? 0;
                    const replyLabel = (() => {
                      if (mins === 0) return "—";
                      if (mins < 60)   return `${mins}m`;
                      const h = Math.floor(mins / 60);
                      const rem = mins % 60;
                      if (h < 24) return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
                      const d = Math.floor(h / 24);
                      return `${d}d`;
                    })();
                    return (
                      <div style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        padding: "8px 10px",
                        background: "linear-gradient(180deg, rgba(249,115,22,0.06), rgba(249,115,22,0.02))",
                        border: "1px solid rgba(249,115,22,0.14)",
                        borderRadius: 8,
                        boxShadow: "inset 0 1px 0 rgba(249,115,22,0.08)",
                      }}>
                        <span style={{
                          color: NEX.orange,
                          fontSize: 8,
                          letterSpacing: 1.4,
                          textTransform: "uppercase",
                          fontWeight: 800,
                        }}>
                          Since Connected
                        </span>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          flexWrap: "wrap",
                        }}>
                          {friend.chatMessagesExchanged !== undefined && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: NEX.text, fontVariantNumeric: "tabular-nums" }}>
                              <MessageSquare size={11} strokeWidth={2} color={NEX.orange} />
                              <span style={{ fontWeight: 700 }}>{msgsLabel}</span>
                              <span style={{ color: NEX.textMuted, fontSize: 10 }}>msgs</span>
                            </span>
                          )}
                          {friend.chatAvgReplyMinutes !== undefined && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: NEX.text, fontVariantNumeric: "tabular-nums" }}>
                              <Clock size={11} strokeWidth={2} color={NEX.orange} />
                              <span style={{ fontWeight: 700 }}>~{replyLabel}</span>
                              <span style={{ color: NEX.textMuted, fontSize: 10 }}>reply</span>
                            </span>
                          )}
                          {friend.chatSince && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: NEX.text }}>
                              <CalendarDays size={11} strokeWidth={2} color={NEX.orange} />
                              <span style={{ color: NEX.textMuted, fontSize: 10 }}>since</span>
                              <span style={{ fontWeight: 700 }}>{friend.chatSince}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── BUSINESS INFO · Philip 2026-09-03 doctrine ────
                      Structured contact fields · pro_personal +
                      pro_business only · per-field visibility enforced:
                      hidden never renders; contacts renders when viewer
                      is a connection (assumed here); public always
                      renders. Free accounts never see this section (no
                      businessInfo stored). Icons are tap-to-act
                      (tel: / mailto: / https: / whatsapp:). */}
                  {!stripped && friend.businessInfo && (nexTier === "pro_personal" || nexTier === "pro_business") && (() => {
                    const cv = friend.contactVisibility ?? {};
                    const canShow = (v: "hidden" | "contacts" | "public" | undefined) => v === "contacts" || v === "public";
                    const items: { key: string; href: string; icon: string; label: string; badge?: "public" | "contacts" }[] = [];
                    if (friend.businessInfo.phone && canShow(cv.phone)) {
                      items.push({ key: "phone", href: `tel:${friend.businessInfo.phone.replace(/\s/g, "")}`, icon: "📞", label: friend.businessInfo.phone, badge: cv.phone === "public" ? "public" : "contacts" });
                    }
                    if (friend.businessInfo.whatsapp && canShow(cv.whatsapp)) {
                      const wa = friend.businessInfo.whatsapp.replace(/\D/g, "");
                      items.push({ key: "whatsapp", href: `https://wa.me/${wa}`, icon: "💬", label: friend.businessInfo.whatsapp, badge: cv.whatsapp === "public" ? "public" : "contacts" });
                    }
                    if (friend.businessInfo.email && canShow(cv.email)) {
                      items.push({ key: "email", href: `mailto:${friend.businessInfo.email}`, icon: "✉️", label: friend.businessInfo.email, badge: cv.email === "public" ? "public" : "contacts" });
                    }
                    // Non-contact fields · always shown when present (they're not phone/whatsapp/email).
                    if (friend.businessInfo.website) items.push({ key: "web",     href: friend.businessInfo.website, icon: "🌐", label: friend.businessInfo.website.replace(/^https?:\/\//, "") });
                    if (friend.businessInfo.booking) items.push({ key: "booking", href: friend.businessInfo.booking, icon: "📅", label: "Book appointment" });
                    if (friend.businessInfo.hours)   items.push({ key: "hours",   href: "",                          icon: "🕘", label: friend.businessInfo.hours });
                    if (friend.businessInfo.address) items.push({ key: "addr",    href: "",                          icon: "📍", label: friend.businessInfo.address });
                    if (items.length === 0) return null;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 2px" }}>
                        <span style={{ color: NEX.textMuted, fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700 }}>
                          Business info
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {items.map((it) => {
                            const inner = (
                              <>
                                <span aria-hidden style={{ width: 14, textAlign: "center", flexShrink: 0 }}>{it.icon}</span>
                                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
                                {it.badge && (
                                  <span aria-label={`visibility: ${it.badge}`} style={{
                                    flexShrink: 0,
                                    fontSize: 7, fontWeight: 800, letterSpacing: 0.6,
                                    padding: "1px 4px", borderRadius: 3,
                                    background: it.badge === "public" ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)",
                                    color: it.badge === "public" ? "#10B981" : NEX.textMuted,
                                    border: `1px solid ${it.badge === "public" ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)"}`,
                                    textTransform: "uppercase",
                                  }}>{it.badge}</span>
                                )}
                              </>
                            );
                            const style: CSSProperties = {
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "5px 8px",
                              background: "rgba(255,255,255,0.03)",
                              border: "1px solid rgba(255,255,255,0.06)",
                              borderRadius: 6,
                              color: NEX.text,
                              fontSize: 11,
                              textDecoration: "none",
                              minWidth: 0,
                            };
                            return it.href ? (
                              <a key={it.key} href={it.href} target={it.href.startsWith("http") ? "_blank" : undefined} rel={it.href.startsWith("http") ? "noopener noreferrer" : undefined} style={style}>{inner}</a>
                            ) : (
                              <div key={it.key} style={style}>{inner}</div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Mutual-contacts removed 2026-09-03 · privacy risk
                      (leaks third-party graph data · stalking/inference
                      concerns). Relationship depth now conveyed via
                      the "Since Connected" strip above. */}

                  {/* Socials row · PRO-tier only · Philip 2026-09-03.
                      Small clickable icon links to the user's external
                      profiles. Free-tier contacts don't get this
                      surface (deliberate paid-upgrade differentiator).
                      Renders only when the contact is paid AND has at
                      least one social set. */}
                  {!stripped && (nexTier === "pro_personal" || nexTier === "pro_business") && friend.socials && Object.values(friend.socials).some(Boolean) && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, padding: "0 2px" }}>
                      <span style={{
                        color: NEX.textMuted,
                        fontSize: 9,
                        letterSpacing: 1.4,
                        textTransform: "uppercase",
                        fontWeight: 700,
                      }}>
                        Also on
                      </span>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {(() => {
                          const items: { key: string; url: string; icon: ReactNode; label: string; brand: string }[] = [];
                          if (friend.socials.facebook)  items.push({ key: "fb", url: friend.socials.facebook,  label: "Facebook",    brand: "#1877F2", icon: <FacebookIcon  size={13} /> });
                          if (friend.socials.instagram) items.push({ key: "ig", url: friend.socials.instagram, label: "Instagram",   brand: "#E4405F", icon: <InstagramIcon size={13} /> });
                          if (friend.socials.tiktok)    items.push({ key: "tt", url: friend.socials.tiktok,    label: "TikTok",      brand: "#FE2C55", icon: <TiktokIcon    size={13} /> });
                          if (friend.socials.twitter)   items.push({ key: "tw", url: friend.socials.twitter,   label: "X / Twitter", brand: "#FFFFFF", icon: <TwitterIcon   size={13} /> });
                          if (friend.socials.youtube)   items.push({ key: "yt", url: friend.socials.youtube,   label: "YouTube",     brand: "#FF0000", icon: <YoutubeIcon   size={13} /> });
                          if (friend.socials.linkedin)  items.push({ key: "li", url: friend.socials.linkedin,  label: "LinkedIn",    brand: "#0A66C2", icon: <LinkedinIcon  size={13} /> });
                          return items.map((s) => (
                            <a
                              key={s.key}
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`${friend.name} on ${s.label}`}
                              title={s.label}
                              style={{
                                width: 30,
                                height: 30,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 8,
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                color: NEX.textMuted,
                                textDecoration: "none",
                                transition: "color 140ms ease, background 140ms ease, border-color 140ms ease",
                                WebkitTapHighlightColor: "transparent",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = s.brand;
                                e.currentTarget.style.background = "rgba(255,255,255,0.09)";
                                e.currentTarget.style.borderColor = `${s.brand}55`;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = NEX.textMuted;
                                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                              }}
                            >
                              {s.icon}
                            </a>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Actions · toggles for stateful settings + menu items for
                one-shot / destructive actions. Divider splits stateful
                from destructive. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {/* Menu item · opens the friend's profile page */}
              <MenuItem
                icon={<User size={14} />}
                label="Profile"
                onClick={() => { setActionsPanelOpen(false); onOpenProfile?.(); }}
              />

              {/* Toggle · mute notifications for this chat */}
              <ToggleItem
                icon={isMuted ? <BellOff size={14} /> : <Bell size={14} />}
                label="Mute notifications"
                sublabel={isMuted ? "You won't hear pings from this chat" : "You'll get pings for every message"}
                checked={isMuted ?? false}
                onChange={() => onToggleMute?.()}
              />

              {/* Toggle · share the user's current NEX theme with this
                  contact. When ON, this friend sees the user's chosen
                  theme; future theme-library updates propagate
                  automatically to every contact with the toggle on.
                  Auto-disabled visually when unfriended · that's the
                  whole point of unfriending (no more perk-sharing). */}
              <ToggleItem
                icon={<Smile size={14} />}
                label="Share my theme"
                sublabel={isUnfriended
                  ? "Not shared · unfriended"
                  : friend.themeEnabled
                    ? `${friend.name} sees your NEX theme · auto-updates`
                    : `${friend.name} sees the default NEX look`}
                checked={!isUnfriended && (friend.themeEnabled ?? false)}
                onChange={() => { if (!isUnfriended) onToggleTheme?.(); }}
              />

              {/* Toggle · unfriend · softer than block · Philip 2026-09-03.
                  Removes friendship perks (theme sharing, presence sync,
                  since-connected insights, socials row) but keeps chat
                  + messaging functional. Grey/neutral treatment · this
                  is a closure action, not a hostile one. */}
              <ToggleItem
                icon={<User size={14} />}
                label="Unfriend"
                sublabel={isUnfriended
                  ? `No longer friends · chat still works`
                  : `Keep the chat but end the friendship`}
                checked={isUnfriended ?? false}
                onChange={() => onToggleUnfriend?.()}
              />

              {/* Toggle · block this contact · hostile boundary · red
                  visual in the contacts list. Philip 2026-09-03 */}
              <ToggleItem
                icon={<Ban size={14} />}
                label="Block"
                sublabel={isBlocked
                  ? `${friend.name} can't reach you`
                  : `${friend.name} can message you normally`}
                checked={isBlocked ?? false}
                onChange={() => onToggleBlock?.()}
              />

              {/* Divider · separates persistent-state toggles from
                  the destructive Clear action */}
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "6px 8px" }} />

              {/* Menu item · destructive · clear this chat's messages */}
              <MenuItem
                icon={<Eraser size={14} />}
                label="Clear chat"
                onClick={() => { setActionsPanelOpen(false); onClearChat?.(); }}
                danger
              />
            </div>
          </div>
        </>,
        frameMountEl,
      )}
      {/* ContextMenu (per-message) still stripped for clean-screen mode. */}
      {false && activeMenuMessage && menu?.anchorRect && (
        <ContextMenu
          anchorRect={menu.anchorRect}
          messageRead={activeMenuMessage.read !== false}
          messageSaved={activeMenuMessage.saved === true}
          messagePinned={activeMenuMessage.pinned === true}
          isUserMessage={activeMenuMessage.sender === "user"}
          onSelect={(action) => {
            closeMenu();
            if (action === "reply") onReply?.(activeMenuMessage);
            if (action === "mascot") onOpenMascotPicker?.();
            if (action === "record") {
              // Toggle · tapping Post Record on the same message closes it.
              setRecordFor((prev) => prev === activeMenuMessage.id ? null : activeMenuMessage.id);
            }
            if (action === "toggleread") onToggleMessageRead?.(activeMenuMessage.id);
            if (action === "copy") {
              // Copy message text to clipboard · silently succeeds/fails.
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                void navigator.clipboard.writeText(activeMenuMessage.text);
              }
            }
            if (action === "delete") onDeleteMessage?.(activeMenuMessage.id);
            if (action === "react") setReactFor(activeMenuMessage.id);
            if (action === "save") onToggleSaved?.(activeMenuMessage.id);
            if (action === "pin") onTogglePinned?.(activeMenuMessage.id);
            if (action === "edit") setEditingId(activeMenuMessage.id);
          }}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════════════

function MessageBlock({
  message,
  friend,
  replies,
  onOpenMenu,
  onQuickReply,
  nested = false,
  selectedMessageId,
  messagesById,
  onCancelReply,
  isTurnEnd = true,
  isBurstStart = true,
  recordFor,
  onCloseRecord,
  reactFor,
  onCloseReact,
  onAddReaction,
  onOpenReactPicker,
  nowTick,
  registerRef,
  editingId,
  onEditSave,
  onEditCancel,
  userTypingText,
}: {
  message: FriendMessage;
  friend: MockFriend;
  replies: FriendMessage[];
  onOpenMenu: (id: string, el: HTMLElement) => void;
  onQuickReply: (msg: FriendMessage) => void;
  nested?: boolean;
  selectedMessageId?: string | null;
  /** Passed through to MessageRow · when this message IS the selected
   *  reply target AND is a friend message, MessageRow renders a nested
   *  green draft bubble INSIDE the friend's container showing the
   *  user's typing preview (matches the old hero-style pattern). */
  userTypingText?: string;
  messagesById: Map<string, FriendMessage>;
  onCancelReply?: () => void;
  /** True when the next top-level message is from a DIFFERENT sender (or
   *  this is the last message). Turn-end blocks show the gray separator
   *  and add a wider bottom margin so the conversation reads as turns. */
  isTurnEnd?: boolean;
  /** True when the previous message is from a DIFFERENT sender (or this
   *  is the first). Burst starts show avatar + name; continuations show
   *  text only (rail dot still shown on every message per Philip). */
  isBurstStart?: boolean;
  /** Which message currently has its Post Record card open. */
  recordFor?: string | null;
  onCloseRecord?: () => void;
  /** Which message currently has its reaction picker open. */
  reactFor?: string | null;
  onCloseReact?: () => void;
  onAddReaction?: (messageId: string, emoji: string) => void;
  /** Called on message long-press · opens the reaction picker for THIS
   *  message without going through the ⋮ menu (Philip 2026-09-02). */
  onOpenReactPicker?: () => void;
  /** Ticking timestamp so smart labels ("5m ago") re-render. */
  nowTick?: number;
  /** Register the block's DOM node so scrollToMessage (pinned bar tap)
   *  can locate + scroll to this specific message. */
  registerRef?: (el: HTMLDivElement | null) => void;
  editingId?: string | null;
  onEditSave?: (newText: string) => void;
  onEditCancel?: () => void;
}) {
  const isUser = message.sender === "user";
  const isSelected = selectedMessageId === message.id;
  const isRecordOpen = recordFor === message.id;
  const senderLabel = isUser ? "yourself" : friend.name;
  return (
    <div
      ref={registerRef}
      style={{
        position: "relative",
        marginLeft: nested ? 28 : 0,
        // Bubble spacing · Philip 2026-09-03 "get perfect the space
        // between each seperate bubble post". Same-sender burst
        // continuation = 6px (tight, reads as one thought). Turn end
        // (different sender next) = 16px (airy, reads as a new turn).
        // Nested reply (rare) stays 0.
        marginBottom: nested ? 0 : (isTurnEnd ? 16 : 6),
        // Throw-from-avatar · Philip 2026-09-02 pivot. Friend bubbles
        // drop in from the top-LEFT (their avatar), user bubbles from
        // the top-RIGHT (yours). Cinematic origin-of-message feel.
        animation: `${isUser ? "nex-throw-from-right" : "nex-throw-from-left"} 500ms cubic-bezier(0.34, 1.36, 0.64, 1) both`,
        transformOrigin: isUser ? "top right" : "top left",
      }}
    >
      <MessageRow
        message={message}
        friend={friend}
        isUser={isUser}
        onOpenMenu={onOpenMenu}
        onQuickReply={onQuickReply}
        nested={nested}
        replyingTo={message.replyTo ? messagesById.get(message.replyTo) ?? null : null}
        isBurstStart={isBurstStart}
        isBurstEnd={isTurnEnd}
        onLongPress={onOpenReactPicker}
        nowTick={nowTick}
        isEditing={editingId === message.id}
        onEditSave={onEditSave}
        onEditCancel={onEditCancel}
        isSelected={isSelected}
        userTypingText={userTypingText}
      />

      {/* Nested replies render UNDER the parent as one connected post */}
      {replies.map((r) => (
        <MessageBlock
          key={r.id}
          message={r}
          friend={friend}
          replies={[]}
          onOpenMenu={onOpenMenu}
          onQuickReply={onQuickReply}
          nested
          selectedMessageId={selectedMessageId}
          messagesById={messagesById}
          onCancelReply={onCancelReply}
          recordFor={recordFor}
          onCloseRecord={onCloseRecord}
          reactFor={reactFor}
          onCloseReact={onCloseReact}
          onAddReaction={onAddReaction}
          onOpenReactPicker={onOpenReactPicker}
          nowTick={nowTick}
          editingId={editingId}
          onEditSave={onEditSave}
          onEditCancel={onEditCancel}
        />
      ))}

      {/* Post Record card · Reaction chips · Ambient card · Reaction
          picker — all stripped for clean-screen mode (Philip 2026-09-02). */}

      {/* Inline reply preview · Philip 2026-09-02.
          When THIS message is the reply target, show a compact preview
          ("↩ Replying to X · quoted text · ×") directly UNDER the message
          so the reply context stays anchored to what's being replied to.
          Sits inside the message block so it scrolls naturally with the
          conversation. */}
      {/* Reply-in-progress stub stripped for clean-screen mode. */}

      {/* Per-turn separator removed · Philip 2026-09-02 · "lines are
          only for closed threads". Day pills are the sole thread break.
          Within a day, all messages flow as one continuous conversation. */}
    </div>
  );
}

function MessageRow({
  message, friend, isUser, onOpenMenu, onQuickReply, nested, replyingTo, isBurstStart, isBurstEnd,
  onLongPress, nowTick, isEditing, onEditSave, onEditCancel, isSelected, userTypingText,
}: {
  message: FriendMessage;
  friend: MockFriend;
  isUser: boolean;
  onOpenMenu: (id: string, el: HTMLElement) => void;
  onQuickReply: (msg: FriendMessage) => void;
  nested: boolean;
  /** Target message that THIS message is a reply to (if any). Rendered as
   *  a subtle "↳ quoted line" above the body (Philip 2026-09-02). */
  replyingTo: FriendMessage | null;
  /** True on the FIRST message in a same-sender burst · draws avatar/badge
   *  + name label. False on continuations · text-only, rail dot only. */
  isBurstStart: boolean;
  /** True on the LAST message in a same-sender burst · used to place the
   *  NEX signature badge on user bursts (Philip 2026-09-02 ref image). */
  isBurstEnd: boolean;
  /** Fires when the message body is long-pressed · opens react picker. */
  onLongPress?: () => void;
  /** Ticking timestamp for smart-relative labels. */
  nowTick?: number;
  /** True when this specific message is being inline-edited. */
  isEditing?: boolean;
  onEditSave?: (newText: string) => void;
  onEditCancel?: () => void;
  /** True when this message is the current reply target · bubble lifts. */
  isSelected?: boolean;
  /** Passed from parent · when this friend message is the current
   *  reply target, the nested draft bubble uses this to display
   *  live typing (matches the old hero-inside-bubble pattern). */
  userTypingText?: string;
}) {
  // Long-press + press-feedback + swipe-to-reply state · Philip 2026-09-02.
  const [isPressing, setIsPressing] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFiredRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const swipeEngagedRef = useRef(false);
  const startPress = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsPressing(true);
    longFiredRef.current = false;
    swipeEngagedRef.current = false;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    // Long-press to react ONLY on friend messages · you can't react to
    // yourself (Philip 2026-09-02 · "should i be able to reply to you").
    if (!isUser) {
      pressTimerRef.current = setTimeout(() => {
        longFiredRef.current = true;
        onLongPress?.();
      }, LONG_PRESS_MS);
    }
  };
  const movePress = (e: React.PointerEvent<HTMLDivElement>) => {
    // Swipe-to-reply ONLY on friend rows · Philip 2026-09-02. You can't
    // reply to your own message (use Edit for context).
    if (isUser) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;
    // Engage swipe only if the user has moved horizontally more than
    // vertically (avoids intercepting vertical scroll gestures).
    if (!swipeEngagedRef.current && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      swipeEngagedRef.current = true;
      // Cancel long-press + press-feedback once we're swiping.
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
        pressTimerRef.current = null;
      }
      setIsPressing(false);
    }
    if (swipeEngagedRef.current) {
      // Swipe RIGHT reveals the reply gesture · cap at 72px so it feels
      // resistant near the end. Ignore left swipes for now.
      const clamped = Math.max(0, Math.min(72, dx));
      setSwipeOffset(clamped);
    }
  };
  const endPress = () => {
    setIsPressing(false);
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (swipeEngagedRef.current && swipeOffset >= 48) {
      // Swipe past threshold · trigger reply on this message.
      onQuickReply(message);
    } else if (!swipeEngagedRef.current && !longFiredRef.current && !isUser) {
      // Clean tap on a FRIEND bubble · load it into the hero as the
      // reply target (Philip 2026-09-02 world-class flow · "if i select
      // any bubble from under from alex it will auto load in the hero
      // bubble"). User bubbles are non-interactive on tap.
      onQuickReply(message);
    }
    // Animate back to 0 regardless of trigger.
    setSwipeOffset(0);
    swipeEngagedRef.current = false;
  };
  const cancelPress = () => {
    setIsPressing(false);
    setSwipeOffset(0);
    swipeEngagedRef.current = false;
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };
  // Bubble-based layout · Philip 2026-09-02 pivot. Messages are chat
  // bubbles that align LEFT for friend, RIGHT for user. Each message
  // "throws" from its author's header avatar via the block-level keyframe.
  // When this message is the reply target, the bubble LIFTS out (elevated
  // shadow + slight translate) so the composer preview reads as "this is
  // the message being answered".
  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      paddingLeft: 4,
      paddingRight: 4,
    }}>
      <div style={{
        flex: "0 1 auto",
        maxWidth: "80%",
        minWidth: 0,
      }}>
        {/* BUBBLE · Philip 2026-09-02 pivot. Rounded rect · dark for
            friend, dark-green-tinted for user. Lift + shadow when this
            is the reply target · fresh-send orange rim animation on
            newly-sent user messages (fades over 2s = mock "read"). */}
        {/* ═══════════════════════════════════════════════════════════
            🔒 LOCKED v2 · REPLY BUBBLE DESIGN · Philip 2026-09-03
            "lock the design for replied post color and edges"
            + "change the container with you replied inside alex
               container to same you color as on own" + "yes lock
               the design now"
            ─────────────────────────────────────────────────────────
            Three render paths (do NOT collapse or reorder):
              (1) Alex outer         → 2px orange left, plain text
              (2) User REPLY outer   → 3px orange left + nested inner
                                        "You container" (double bubble)
              (3) User NON-REPLY solo → 2px green left, inline "You"
                                         label + text (single container)
            Inner "You container" (draft OR live) MATCHES the solo
            "You container" colorway exactly: light hero-tint bg +
            gray top/right/bottom rim + 2px green LEFT edge. Only
            variable = dashed rim (draft) vs solid rim (live).
            Do NOT tweak background / border / borderLeft / boxShadow
            on outer chrome OR inner "You container" (draft/live) OR
            restore any colored vertical line in the quoted-reference
            block without an explicit new instruction from Philip.
            Full spec + rationale: memory/doctrine_nex_reply_bubble_
            design_locked_2026_09_03.md
            ═══════════════════════════════════════════════════════════ */}
        {(() => {
          const now = nowTick ?? Date.now();
          const isFresh = isUser && message.dateISO && (now - Date.parse(message.dateISO)) < 2200;
          return (
        <div
          onPointerDown={startPress}
          onPointerMove={movePress}
          onPointerUp={endPress}
          onPointerLeave={cancelPress}
          onPointerCancel={cancelPress}
          onContextMenu={(e) => { if (longFiredRef.current) e.preventDefault(); }}
          style={{
            // Feed bubble styling · Philip 2026-09-03 "use the same
            // style hero bubble for the feed". Friend bubbles now match
            // the hero card exactly (subtle white-alpha tint + gray rim).
            // User bubbles keep their green identity color/rim but with
            // the same padding + radius so they read as a variant of the
            // same hero shape (not a different bubble type).
            position: "relative",
            padding: "10px 14px 8px",
            borderRadius: 16,
            // Feed bubble styling · Philip 2026-09-03 "reply in the same
            // light coloured container with green bubble like the hero
            // before and the edge of the green container is solid color
            // like the alex edge orange but green". Both bubbles use the
            // SAME light hero-style background (white-alpha tint) —
            // identity is carried by the RIM color: gray for Alex,
            // green for You. Green rim bumped from 0.42 → 0.75 to match
            // Alex's solid-rim visibility.
            background: "rgba(255,255,255,0.06)",
            // Double-bubble parity · Philip 2026-09-03 "when the you
            // will post live that the green bubble is same inside · do
            // not change the double bubble design when post live" +
            // "add back the orange to alex edge" + "left edge". Alex's
            // identity is a single orange accent on the LEFT edge (not
            // a full orange rim) · other three edges stay gray. User
            // outer wrapper stays fully gray (identity comes from the
            // nested green inner bubble).
            border: `1px solid rgba(156,163,175,0.4)`,
            // Left-edge accent · Philip 2026-09-03 "add back the orange
            // to alex edge" + "replied post add the orange back to the
            // left side edge" + "when you will post on her own, their
            // is no alex container just you container with green little
            // edge left". Three cases:
            //   Alex message           → 2px orange left (sender identity)
            //   User reply post        → 3px orange left (reply thread anchor)
            //   User non-reply (solo)  → 2px green left (small user accent · no double bubble)
            borderLeft: isUser
              ? (replyingTo
                  ? `3px solid ${NEX.orange}`
                  : `2px solid rgba(5,150,105,0.9)`)
              : `2px solid ${NEX.orange}`,
            // SELECT visual · Philip 2026-09-03 approval #5. Restrained
            // 2px orange left accent, 180ms fade. NO bubble enlargement,
            // NO bounce, NO glow, NO opacity change. The message should
            // feel selected, not decorated. Uses inset box-shadow so the
            // accent respects the bubble's border-radius corners cleanly.
            boxShadow: isSelected
              ? `inset 2px 0 0 ${NEX.orange}`
              : "none",
            transform: swipeOffset > 0
              ? `translateX(${swipeOffset}px)`
              : (isPressing ? "scale(0.985)" : "scale(1)"),
            opacity: 1,
            transition: swipeOffset > 0
              ? "none"
              : "box-shadow 180ms ease, transform 220ms cubic-bezier(0.34, 1.36, 0.64, 1), background 120ms ease",
            userSelect: "none",
            cursor: isUser ? "default" : "pointer",
            WebkitTapHighlightColor: "transparent",
            touchAction: "pan-y",
            // Fresh-send rim glow (2s decay to normal · "delivered → read").
            ...(isFresh ? { animation: "nex-fresh-rim 2200ms ease-out both" } : {}),
          }}
        >
          {/* Sender name label · Philip 2026-09-03 · burst-start only.
              "Alex" for friend messages (orange · NEX identity), "You"
              for user messages (dark green · user identity). Only shown
              on the FIRST message in a same-sender burst so consecutive
              messages from the same sender don't repeat the label. This
              is the primary sender-identity signal inside the bubble;
              the profile image at the top-left of the transparent area
              is the identity signal for the hero. */}
          {isBurstStart && !isUser && (
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: NEX.orange,
              letterSpacing: -0.05,
              marginBottom: 3,
              textAlign: "left",
              lineHeight: 1.1,
            }}>
              {friend.name.split(" ")[0]}
            </div>
          )}

          {/* Quoted reference · Philip 2026-09-02 "when it will throw
              the bubble, alex message must also be in the bubble". Shows
              the referenced message (sender + text) INSIDE the bubble
              above the reply text, so the sent bubble carries its own
              conversation context. Orange left accent for friend origin,
              dark-green for user origin. */}
          {replyingTo && (
            <div style={{
              marginBottom: 6,
              paddingLeft: 8,
              // Orange line removed · Philip 2026-09-03 "the replied
              // post remove the orange line · not the edge orange".
              // The inner quoted-reference no longer draws a colored
              // vertical bar (was doubling up with Alex's outer left
              // edge). The tiny sender name above the quote is enough
              // origin signal.
              opacity: 0.85,
            }}>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                color: replyingTo.sender === "user" ? USER_IDENTITY_COLOR : NEX.orange,
                letterSpacing: -0.05,
              }}>
                {replyingTo.sender === "user" ? "You" : friend.name}
              </div>
              <div style={{
                fontSize: 12,
                color: "rgba(245,245,245,0.72)",
                lineHeight: 1.35,
                marginTop: 1,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}>
                {replyingTo.text}
              </div>
            </div>
          )}

          {/* Bubble body · Philip 2026-09-03. Three render paths:
                Alex message              → plain text (outer chrome only)
                User reply post           → nested green inner bubble (double-bubble)
                User non-reply (solo)     → "You" label + plain text (single "you container" · outer already carries the small green left edge)
              Reference: "when you will post on her own, their is no
              alex container just you container with green little edge
              left". Non-reply user posts collapse the double bubble
              into a single container — no nested inner. */}
          {isUser && replyingTo ? (
            <div style={{
              padding: "8px 12px 6px",
              borderRadius: 12,
              // Live inner container color · Philip 2026-09-03 "change
              // the container with you replied inside alex container
              // to same you color as on own". Matches the solo "You
              // container": light hero-tint bg + gray top/right/bottom
              // + small green left edge. SOLID rim distinguishes live
              // from the DASHED draft.
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(156,163,175,0.4)",
              borderLeft: "2px solid rgba(5,150,105,0.9)",
              boxShadow: "inset 0 1px 0 rgba(5,150,105,0.08)",
            }}>
              {isBurstStart && (
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: USER_IDENTITY_COLOR,
                  letterSpacing: -0.05,
                  marginBottom: 2,
                  textAlign: "right",
                  lineHeight: 1.1,
                }}>
                  You
                </div>
              )}
              <div style={{
                color: NEX.text,
                fontSize: 13.5,
                lineHeight: 1.4,
                letterSpacing: -0.05,
                overflowWrap: "anywhere",
                wordBreak: "break-word",
              }}>
                {message.text}
              </div>
            </div>
          ) : isUser ? (
            <>
              {isBurstStart && (
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: USER_IDENTITY_COLOR,
                  letterSpacing: -0.05,
                  marginBottom: 3,
                  textAlign: "right",
                  lineHeight: 1.1,
                }}>
                  You
                </div>
              )}
              <div style={{
                color: NEX.text,
                fontSize: 14,
                lineHeight: 1.45,
                letterSpacing: -0.05,
                overflowWrap: "anywhere",
                wordBreak: "break-word",
              }}>
                {message.text}
              </div>
            </>
          ) : (
            <div style={{
              color: NEX.text,
              fontSize: 14,
              lineHeight: 1.45,
              letterSpacing: -0.05,
              overflowWrap: "anywhere",
              wordBreak: "break-word",
            }}>
              {message.text}
            </div>
          )}
          {/* NESTED DRAFT · Philip 2026-09-03 "green bubble inside alex
              container like it was in hero". When THIS friend message
              is the reply target, render a green (user-identity) draft
              bubble INSIDE the Alex bubble (below the message body).
              Same visual pattern as the old hero card: outer light
              container with a green bubble nested inside. Dashed edge
              signals "unsent draft"; on send, the message throws to
              the end of the feed as a solid-rim user bubble. */}
          {isSelected && !isUser && (userTypingText?.length ?? 0) > 0 && (
            <div style={{
              marginTop: 8,
              padding: "8px 12px 6px",
              borderRadius: 12,
              // Draft container color · Philip 2026-09-03 "change the
              // container with you replied inside alex container to
              // same you color as on own". Same light hero-tint bg +
              // gray top/right/bottom + small green left edge as the
              // solo "You container". Draft still signalled by DASHED
              // top/right/bottom (unsent), live version uses solid.
              // Render gate · Philip 2026-09-03 "the cursor should
              // have disapeared as new post apeared". Draft renders
              // ONLY when there is typed content — after post,
              // inputText clears to "", the draft (and its caret)
              // disappear immediately, leaving the selected Alex
              // bubble in a clean "ready to type" state. First
              // keystroke re-materialises the draft.
              background: "rgba(255,255,255,0.06)",
              border: "1px dashed rgba(156,163,175,0.4)",
              borderLeft: "2px solid rgba(5,150,105,0.9)",
              boxShadow: "inset 0 1px 0 rgba(5,150,105,0.08)",
            }}>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                color: USER_IDENTITY_COLOR,
                letterSpacing: -0.05,
                marginBottom: 2,
                textAlign: "right",
                lineHeight: 1.1,
              }}>
                You
              </div>
              <div style={{
                color: NEX.text,
                fontSize: 13.5,
                lineHeight: 1.4,
                letterSpacing: -0.05,
                overflowWrap: "anywhere",
                wordBreak: "break-word",
                minHeight: 18,
              }}>
                {userTypingText ?? ""}
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 2,
                    height: 14,
                    background: USER_IDENTITY_COLOR,
                    marginLeft: 2,
                    verticalAlign: "middle",
                    animation: "nex-caret-blink 1s steps(2) infinite",
                    borderRadius: 1,
                  }}
                />
              </div>
            </div>
          )}
        </div>
          );
        })()}
      </div>
    </div>
  );
}

// Post Record card · Philip 2026-09-02.
// Small dark card that lists every event tied to a message (sent,
// delivered, read, edited, replied, reacted). When postEvents is absent
// on the message, falls back to a single "Sent · time" row from
// message.time so the record still says something meaningful.
function PostRecordCard({
  message, fallbackActor, onClose,
}: {
  message: FriendMessage;
  fallbackActor: string;
  onClose: () => void;
}) {
  const events = message.postEvents && message.postEvents.length > 0
    ? message.postEvents
    : [{ type: "sent" as const, time: message.time, actor: fallbackActor }];

  return (
    <div
      role="dialog"
      aria-label="Post record"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        marginTop: 8,
        marginLeft: 24,
        marginRight: 10,
        padding: "8px 10px 8px 12px",
        background: "rgba(20,20,20,0.85)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Clock size={12} strokeWidth={2} color={NEX.orange} />
        <span style={{ fontSize: 11, color: NEX.orange, fontWeight: 600, letterSpacing: 0.2 }}>
          Post Record
        </span>
        <button
          type="button"
          aria-label="Close record"
          onClick={onClose}
          style={{
            marginLeft: "auto",
            appearance: "none",
            border: "none",
            background: "transparent",
            color: "rgba(245,245,245,0.6)",
            cursor: "pointer",
            padding: 2,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <XIcon size={12} strokeWidth={2.2} />
        </button>
      </div>
      {events.map((e, i) => (
        <div
          key={`${e.type}-${i}`}
          style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12, color: "rgba(245,245,245,0.78)" }}
        >
          <span style={{ minWidth: 68, color: NEX.textMuted, textTransform: "capitalize" }}>
            {e.type}
          </span>
          <span style={{ flex: 1 }}>{e.time}</span>
          {e.actor && (
            <span style={{ color: NEX.textFaint, fontSize: 11 }}>· {e.actor}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function ContextMenu({
  anchorRect,
  messageRead,
  messageSaved,
  messagePinned,
  isUserMessage,
  onSelect,
}: {
  anchorRect: DOMRect;
  messageRead: boolean;
  messageSaved: boolean;
  messagePinned: boolean;
  isUserMessage: boolean;
  onSelect: (action:
    | "react" | "reply" | "copy" | "record" | "toggleread" | "save" | "pin" | "forward" | "edit" | "delete" | "report" | "mascot"
  ) => void;
}) {
  // Position the popover just below-left of the anchor 3-dot button.
  const style: CSSProperties = {
    position: "fixed",
    top: Math.min(anchorRect.bottom + 6, window.innerHeight - 360),
    left: Math.max(8, anchorRect.right - 160),
    width: 180,
    background: "#181818",
    border: `1px solid ${NEX.borderMuted}`,
    borderRadius: 12,
    boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
    padding: 6,
    zIndex: 40,
  };
  return (
    <div style={style} onClick={(e) => e.stopPropagation()} role="menu">
      {/* React + Reply only on FRIEND messages (can't react to yourself,
          can't reply to yourself · Philip 2026-09-02). */}
      {!isUserMessage && <MenuItem icon={<Smile size={14} />} label="React" onClick={() => onSelect("react")} />}
      {!isUserMessage && <MenuItem icon={<Reply size={14} />} label="Reply" onClick={() => onSelect("reply")} />}
      <MenuItem icon={<Copy size={14} />} label="Copy" onClick={() => onSelect("copy")} />
      <MenuItem icon={<Clock size={14} />} label="Post Record" onClick={() => onSelect("record")} />
      {/* Read/Unread only meaningful for friend messages. */}
      {!isUserMessage && (
        <MenuItem
          icon={messageRead ? <Circle size={14} /> : <Check size={14} />}
          label={messageRead ? "Mark as Unread" : "Mark as Read"}
          onClick={() => onSelect("toggleread")}
        />
      )}
      <MenuItem
        icon={<Bookmark size={14} />}
        label={messageSaved ? "Unsave" : "Save Message"}
        onClick={() => onSelect("save")}
      />
      <MenuItem
        icon={<Pin size={14} />}
        label={messagePinned ? "Unpin" : "Pin Message"}
        onClick={() => onSelect("pin")}
      />
      <MenuItem icon={<Forward size={14} />} label="Forward" onClick={() => onSelect("forward")} />
      <div style={{ height: 1, background: NEX.borderMuted, margin: "4px 6px" }} />
      {/* Edit only on USER's OWN messages (can't edit someone else's). */}
      {isUserMessage && <MenuItem icon={<Pencil size={14} />} label="Edit" onClick={() => onSelect("edit")} danger />}
      <MenuItem icon={<Trash2 size={14} />} label="Delete" onClick={() => onSelect("delete")} danger />
      {/* Report only on FRIEND messages (report someone else's content). */}
      {!isUserMessage && <MenuItem icon={<Flag size={14} />} label="Report" onClick={() => onSelect("report")} danger />}
    </div>
  );
}

// iOS-style toggle row · Philip 2026-09-03. Used for on/off actions
// (Mute · Share Theme · future Pin) instead of a MenuItem so users
// immediately see the current state without having to remember it.
// Orange track when ON · muted when OFF · smooth 200ms knob slide.
function ToggleItem({ icon, label, sublabel, checked, onChange }: {
  icon: ReactNode;
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${label} · ${checked ? "on" : "off"}`}
      onClick={onChange}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "8px 10px",
        background: "transparent",
        border: "none",
        borderRadius: 8,
        color: NEX.text,
        fontSize: 13,
        textAlign: "left",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span style={{ display: "flex", width: 16, justifyContent: "center", color: NEX.textMuted, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
        <span style={{ letterSpacing: -0.1 }}>{label}</span>
        {sublabel && (
          <span style={{ fontSize: 10, color: NEX.textMuted, lineHeight: 1.2 }}>{sublabel}</span>
        )}
      </span>
      {/* iOS-style pill track · orange when ON · grey when OFF */}
      <span aria-hidden style={{
        position: "relative",
        width: 34, height: 20,
        borderRadius: 999,
        background: checked ? NEX.orange : "rgba(255,255,255,0.15)",
        border: `1px solid ${checked ? "rgba(249,115,22,0.6)" : "rgba(255,255,255,0.08)"}`,
        boxShadow: checked
          ? "inset 0 1px 0 rgba(255,255,255,0.3), 0 0 8px rgba(249,115,22,0.35)"
          : "inset 0 1px 0 rgba(255,255,255,0.05)",
        transition: "background 200ms ease, box-shadow 200ms ease, border-color 200ms ease",
        flexShrink: 0,
      }}>
        <span style={{
          position: "absolute",
          top: 1,
          left: checked ? 15 : 1,
          width: 16, height: 16,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
          transition: "left 200ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }} />
      </span>
    </button>
  );
}

function MenuItem({ icon, label, onClick, danger }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        width: "100%", padding: "8px 10px",
        background: "transparent",
        border: "none",
        borderRadius: 8,
        color: danger ? "#EF4444" : NEX.text,
        fontSize: 13, textAlign: "left", cursor: "pointer",
      }}
    >
      <span style={{ display: "flex", width: 16, justifyContent: "center", color: danger ? "#EF4444" : NEX.textMuted }}>{icon}</span>
      {label}
    </button>
  );
}

// Per-conversation dropdown menu · Philip 2026-09-02 world-class. Anchors
// under the header ⋯ button. View Profile / Mute / Clear Chat History.
function ConversationMenu({
  anchorRect, isMuted, onSelect, onClose,
}: {
  anchorRect: DOMRect;
  isMuted: boolean;
  onSelect: (action: "profile" | "mute" | "clear") => void;
  onClose: () => void;
}) {
  // Position under the anchor, right-aligned so it doesn't overflow.
  const style: CSSProperties = {
    position: "fixed",
    top: anchorRect.bottom + 6,
    right: Math.max(8, (typeof window !== "undefined" ? window.innerWidth : 0) - anchorRect.right),
    width: 180,
    background: "#181818",
    border: `1px solid ${NEX.borderMuted}`,
    borderRadius: 12,
    boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
    padding: 6,
    zIndex: 40,
  };
  return (
    <>
      {/* Backdrop · click anywhere to close the menu. */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 39 }}
        aria-hidden
      />
      <div style={style} role="menu" onClick={(e) => e.stopPropagation()}>
        <MenuItem icon={<User size={14} />} label="View Profile" onClick={() => onSelect("profile")} />
        <MenuItem
          icon={isMuted ? <Bell size={14} /> : <BellOff size={14} />}
          label={isMuted ? "Unmute" : "Mute Notifications"}
          onClick={() => onSelect("mute")}
        />
        <div style={{ height: 1, background: NEX.borderMuted, margin: "4px 6px" }} />
        <MenuItem icon={<Eraser size={14} />} label="Clear Chat" onClick={() => onSelect("clear")} danger />
      </div>
    </>
  );
}

// Inline editor for a user's own message · Philip 2026-09-02 world-class.
// Renders an auto-focused text input in place of the message body ·
// Enter saves the new text · Escape or blur cancels without saving.
function InlineEditor({
  initial, onSave, onCancel,
}: {
  initial: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    inputRef.current?.focus();
    // Move caret to end so user can continue typing naturally.
    const el = inputRef.current;
    if (el) { el.selectionStart = el.selectionEnd = el.value.length; }
  }, []);
  const commit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== initial) onSave(trimmed);
    else onCancel();
  };
  return (
    <div style={{ marginTop: 4, marginLeft: -8, padding: "3px 8px" }}>
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); }
        }}
        rows={Math.max(1, Math.min(6, value.split("\n").length))}
        style={{
          width: "100%",
          resize: "none",
          appearance: "none",
          background: "rgba(255,255,255,0.05)",
          border: `1px solid ${USER_IDENTITY_COLOR}`,
          borderRadius: 8,
          color: NEX.text,
          padding: "6px 8px",
          fontSize: 15,
          lineHeight: 1.5,
          fontFamily: "inherit",
          outline: "none",
          boxShadow: `0 0 8px ${USER_IDENTITY_GLOW}`,
        }}
      />
      <div style={{ fontSize: 10, color: NEX.textFaint, marginTop: 4, letterSpacing: 0.2 }}>
        Enter to save · Esc to cancel
      </div>
    </div>
  );
}

// Ambient knowledge card · Philip 2026-09-02 world-class. Frosted-glass
// chip that NEX injects under a friend message when it detects context
// worth surfacing. Icon on left · title + subtitle stack · optional CTA
// on the right · small "NEX detected" meta below.
function AmbientCardChip({ card }: { card: import("./NexPendingChats").AmbientCard }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        marginTop: 8,
        marginLeft: 32,
        marginRight: 10,
        padding: "10px 12px",
        background: "rgba(20,20,20,0.75)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        border: `1px solid rgba(74,201,255,0.28)`,
        borderRadius: 10,
        boxShadow: "0 4px 12px rgba(0,0,0,0.35), 0 0 12px rgba(74,201,255,0.08)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "rgba(74,201,255,0.12)",
          border: "1px solid rgba(74,201,255,0.24)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {card.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: NEX.text, fontWeight: 600, letterSpacing: -0.05 }}>
          {card.title}
        </div>
        {card.subtitle && (
          <div style={{ fontSize: 11, color: NEX.textMuted, marginTop: 2 }}>
            {card.subtitle}
          </div>
        )}
        {card.meta && (
          <div style={{ fontSize: 10, color: NEX.cyan, marginTop: 4, letterSpacing: 0.3, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ display: "inline-block", width: 4, height: 4, borderRadius: "50%", background: NEX.cyan }} />
            {card.meta}
          </div>
        )}
      </div>
      {card.ctaLabel && (
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          style={{
            appearance: "none",
            border: "1px solid rgba(74,201,255,0.4)",
            background: "rgba(74,201,255,0.1)",
            color: NEX.cyan,
            fontSize: 11,
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: 999,
            cursor: "pointer",
            flexShrink: 0,
            alignSelf: "center",
          }}
        >
          {card.ctaLabel}
        </button>
      )}
    </div>
  );
}

// Pinned messages sticky bar · Philip 2026-09-02 world-class. Sits under
// the chat header when at least one message in the thread is pinned.
// Shows the pinned message preview + count · tap to scroll to it.
function PinnedBar({
  count, preview, previewSenderLabel, onTap,
}: {
  count: number;
  preview: FriendMessage;
  previewSenderLabel: string;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={count === 1 ? "Jump to pinned message" : `Jump to pinned messages (${count})`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        margin: "0 8px 8px 8px",
        background: "rgba(20,20,20,0.85)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderLeft: `3px solid ${NEX.orange}`,
        borderRadius: 8,
        cursor: "pointer",
        textAlign: "left",
        appearance: "none",
        color: NEX.text,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <Pin size={13} strokeWidth={2.2} color={NEX.orange} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: NEX.orange, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }}>
          {count === 1 ? "Pinned" : `${count} pinned · latest`}
        </div>
        <div style={{
          fontSize: 12,
          color: "rgba(245,245,245,0.75)",
          marginTop: 2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          <span style={{ color: NEX.textMuted, marginRight: 6 }}>{previewSenderLabel}:</span>
          {preview.text}
        </div>
      </div>
    </button>
  );
}

// Reaction cluster · Philip 2026-09-02 world-class. Renders emoji chips
// attached under a message body. Same emoji from multiple sources shows
// with a small "x2" count. Indented to align with the message body.
function ReactionCluster({ reactions }: { reactions: import("./NexPendingChats").MessageReaction[] }) {
  // Group reactions by emoji so identical picks collapse into one chip.
  const grouped = new Map<string, number>();
  for (const r of reactions) grouped.set(r.emoji, (grouped.get(r.emoji) ?? 0) + 1);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6, marginLeft: 32 }}>
      {Array.from(grouped.entries()).map(([emoji, count]) => (
        <span
          key={emoji}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            padding: "2px 8px",
            borderRadius: 999,
            background: "rgba(20,20,20,0.85)",
            border: "1px solid rgba(255,255,255,0.1)",
            fontSize: 13,
            lineHeight: 1,
          }}
        >
          <span>{emoji}</span>
          {count > 1 && (
            <span style={{ fontSize: 10, color: NEX.textMuted, fontWeight: 500 }}>{count}</span>
          )}
        </span>
      ))}
    </div>
  );
}

// Reaction picker · Philip 2026-09-02 world-class. Six quick-pick emoji
// in a horizontal row, tap to add. Same look/indent as the reply preview
// so it feels like a sibling contextual surface.
const REACTION_QUICK_PICKS = ["❤️", "👍", "😂", "😮", "😢", "✨"];
function ReactionPicker({
  onPick, onCancel,
}: {
  onPick: (emoji: string) => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        marginTop: 8,
        marginLeft: 24,
        marginRight: 10,
        padding: "6px 8px",
        background: "rgba(20,20,20,0.9)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 999,
        width: "fit-content",
        boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
      }}
      onClick={(e) => e.stopPropagation()}
      role="menu"
      aria-label="Pick a reaction"
    >
      {REACTION_QUICK_PICKS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onPick(emoji)}
          aria-label={`React with ${emoji}`}
          style={{
            appearance: "none",
            border: "none",
            background: "transparent",
            padding: "4px 6px",
            borderRadius: "50%",
            fontSize: 20,
            lineHeight: 1,
            cursor: "pointer",
            transition: "transform 120ms ease, background 120ms ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.25)";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          {emoji}
        </button>
      ))}
      <button
        type="button"
        onClick={onCancel}
        aria-label="Close reaction picker"
        style={{
          appearance: "none",
          border: "none",
          background: "transparent",
          color: NEX.textMuted,
          cursor: "pointer",
          padding: "4px 6px",
          marginLeft: 2,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <XIcon size={14} strokeWidth={2.2} />
      </button>
    </div>
  );
}

// "N new messages" divider · Philip 2026-09-02 world-class. Appears
// above the first unread friend message when the chat opens with unread
// content, so users see clearly where they left off.
function NewMessagesDivider({ count }: { count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 8px 8px 32px" }}>
      <span style={{ flex: 1, height: 1, background: `${NEX.orange}55` }} />
      <span style={{ fontSize: 10, color: NEX.orange, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" }}>
        {count === 1 ? "1 new message" : `${count} new messages`}
      </span>
      <span style={{ flex: 1, height: 1, background: `${NEX.orange}55` }} />
    </div>
  );
}

function DayPill({ label }: { label: string }) {
  // Line-flanked centered label · matches the "N new messages" divider
  // pattern (Philip 2026-09-02). Gray + muted so day dividers read as
  // structural markers, not attention-grabbers.
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 8px 12px 8px" }}>
      <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
      <span style={{
        fontSize: 11,
        color: NEX.textMuted,
        fontWeight: 500,
        letterSpacing: 0.3,
        whiteSpace: "nowrap",
      }}>
        {label}
      </span>
      <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
    </div>
  );
}

function CircleButton({
  children, onClick, ariaLabel,
}: {
  children: ReactNode; onClick: () => void; ariaLabel: string;
}) {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => { setPressed(false); setHovered(false); }}
      onPointerEnter={() => setHovered(true)}
      style={{
        width: 36, height: 36, borderRadius: "50%",
        // Hover/press states · Philip 2026-09-02 world-class ·
        // buttons feel tactile even when their action is stubbed.
        background: pressed
          ? "rgba(249,115,22,0.22)"
          : hovered ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.4)",
        border: `1px solid ${pressed ? NEX.orange : NEX.borderMuted}`,
        color: NEX.text,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 0, cursor: "pointer",
        flexShrink: 0,
        transform: pressed ? "scale(0.94)" : "scale(1)",
        transition: "transform 120ms ease, background 140ms ease, border-color 140ms ease",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </button>
  );
}

function Dot({ color }: { color: string }) {
  return <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} aria-hidden />;
}

// Three staggered dots that fade in/out — the classic "someone is typing"
// indicator. Size prop scales the whole cluster (default 3px for inline
// labels · 6px for the avatar-overlay use).
function TypingDots({ size = 3 }: { size?: number } = {}) {
  const dot: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    background: NEX.orange,
    display: "inline-block",
    animation: "nex-typing-bounce 1.2s ease-in-out infinite",
  };
  return (
    <span aria-hidden style={{ display: "inline-flex", alignItems: "center", gap: Math.max(2, Math.round(size * 0.6)), marginLeft: size <= 3 ? 2 : 0 }}>
      <span style={{ ...dot, animationDelay: "0ms" }} />
      <span style={{ ...dot, animationDelay: "150ms" }} />
      <span style={{ ...dot, animationDelay: "300ms" }} />
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Styles
// ══════════════════════════════════════════════════════════════════════

const containerStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  background: "transparent",     // ← see-through to the metallic HUD frame
  position: "relative",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  // Zero left padding · content sits flush with wrapper left (Philip
  // 2026-09-02 · avoids overflow-clip artifact on workspace edge).
  padding: "6px 4px 12px 0",
  borderBottom: `1px solid ${NEX.borderMuted}`,
  marginBottom: 10,
};

const headerAvatarWrapStyle: CSSProperties = {
  position: "relative",
  width: 40,
  height: 40,
  padding: 2,
  borderRadius: "50%",
  background: `conic-gradient(from 0deg, ${NEX.orange}, ${NEX.orangeSoft}, ${NEX.orange})`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const headerAvatarInnerStyle = (friend: MockFriend): CSSProperties => ({
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  background: friend.color ?? "#333",
  color: "#fff",
  fontSize: 15,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

const onlineDotStyle: CSSProperties = {
  position: "absolute",
  bottom: 0,
  right: 2,
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: "#10B981",
  border: "2px solid #050505",
};

const threadStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  padding: "0 4px 20px 0",
  display: "flex",
  flexDirection: "column",
  // gap: 0 · rhythm is owned by MessageBlock's marginBottom (tight for
  // same-sender bursts, wider at turn boundaries) · Philip 2026-09-02.
  gap: 0,
  position: "relative",
  scrollBehavior: "smooth",
  // Fade mask · Philip 2026-09-03 "remove the shade in hero and
  // allow the bubbles disapear under the header frame" · TOP fade
  // removed → bubbles now clip cleanly behind the opaque header
  // frame (iOS Messages / WhatsApp convention). BOTTOM fade kept
  // (44px into the composer/keypad zone) so nothing overlaps the
  // input console.
  maskImage:       "linear-gradient(to bottom, black 0px, black calc(100% - 44px), transparent 100%)",
  WebkitMaskImage: "linear-gradient(to bottom, black 0px, black calc(100% - 44px), transparent 100%)",
} as CSSProperties;

const threadRailStyle: CSSProperties = {
  position: "absolute",
  // Rail sits at thread x=14 · CENTRE of the 28px avatar (avatar spans
  // x=0-28 · centre at 14). Philip 2026-09-02 · "move alex profile and
  // vertical line and reply buttons to the left more". Shifted from
  // x=18 → x=14 · avatar shrunk 36→28 to move whole column left.
  left: 14,
  top: 32,
  bottom: 12,
  width: 0,
  borderLeft: "1px dashed rgba(255,255,255,0.32)",
  pointerEvents: "none",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 0,
  position: "relative",
  minHeight: 36,
};

const railDotStyle: CSSProperties = {
  position: "absolute",
  // Dot 8px centred on rail (row x=18 · covered by avatar on friend rows,
  // fully visible on user rows). Philip 2026-09-02 · dot ORANGE.
  left: 14,
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: NEX.orange,
  boxShadow: `0 0 6px ${NEX.orangeGlow}, 0 0 0 2px #050505`,
  zIndex: 1,
};

// Absolute avatar · centred on the rail (rail passes through avatar centre).
// 28px · Philip 2026-09-02 · shifted friend column left by shrinking the
// avatar from 36 → 28. Rail at thread x=14 (avatar centre). top: 0 keeps
// the avatar CONTAINED within the row · no overhang into the previous
// message ("why is you profile image on sarah text" 2026-09-02 fix).
const smallAvatarAbsStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  width: 28,
  height: 28,
  padding: 1.5,
  borderRadius: "50%",
  background: `conic-gradient(from 0deg, #F97316, #FB923C, #F97316)`,
  zIndex: 2,
};

// User rail badge · Philip 2026-09-02 · small DARK GREEN filled circle
// marking where the user's reply will land (used inside the reply-in-
// progress stub only). Dark green = user identity per the updated colour.
const userRailBadgeStyle: CSSProperties = {
  position: "absolute",
  left: 9,
  top: 0,
  width: 18,
  height: 18,
  borderRadius: "50%",
  background: USER_IDENTITY_COLOR,
  boxShadow: `0 0 0 2px #050505, 0 0 6px ${USER_IDENTITY_GLOW}`,
  zIndex: 2,
};

// Rail reply-dot visual · Philip 2026-09-02. Orange 14px filled circle
// carrying a small black reply arrow · sits inside the button hit-target.
// Reply icon inside makes the affordance unambiguous.
const railReplyDotVisualStyle: CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: "50%",
  background: "#F97316",
  boxShadow: "0 0 4px rgba(249,115,22,0.55), 0 0 0 2px #050505",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

// User cluster styles removed · Philip 2026-09-02 · user identity is
// now on the LEFT rail matching the friend, not clustered on the right.

const smallAvatarInnerStyle = (friend: MockFriend): CSSProperties => ({
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  background: friend.color ?? "#333",
  color: "#fff",
  fontSize: 14,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

const rowHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const iconButtonStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: "50%",
  background: "rgba(0,0,0,0.35)",
  border: `1px solid ${NEX.borderMuted}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  cursor: "pointer",
};
