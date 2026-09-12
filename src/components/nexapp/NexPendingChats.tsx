// NEX pending chats · Philip refinement 2026-08-24.
//
// Single collapsed affordance: one round orange button at bottom-left.
// The button shows the total unread count as a small badge. Tapping the
// button expands a horizontal row of friend avatars to the RIGHT of the
// button — max 4 visible at a time, horizontally scrollable so more
// unread friends never spill off the surface.
//
// Design language:
//   · Round button matches the NEX identity vocabulary (orange border,
//     subtle glow, dark surface).
//   · Only friends with unread > 0 appear in the expanded row · users
//     with zero unread are hidden from the presence layer.
//   · Selecting an avatar opens that friend's thread AND collapses the
//     row (the friend chat surface becomes the primary UI, so keeping
//     the row expanded would visually compete).
//   · Scrollbar is hidden (uses .nex-no-scrollbar utility from NexAppHome).

"use client";

import { useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import { NEX } from "@/lib/nexapp/tokens";

export type MockFriend = {
  id: string;
  name: string;
  initial: string;
  color: string;
  unread: number;
  /** Public NEX handle · rendered on the landscape friend cards. */
  nexId: string;
  /** Human-readable "last online" · display-only fallback for offline. */
  lastOnline: string;
  /** Per-contact theme toggle · when true this friend sees the user's
   *  custom interface theme; when false they see the default NEX look. */
  themeEnabled: boolean;
  // ─── Phase-2 world-class card fields · Philip 2026-09-01 ─────────
  /** Live presence signal driving the avatar ring + status text. */
  status: "online" | "typing" | "away" | "offline";
  /** Latest message preview shown on the card (may be truncated). */
  lastMessage?: {
    text: string;
    time: string;
    kind: "text" | "photo" | "video" | "file" | "mascot";
    unread: boolean;
  };
  /** Real avatar image (optional · falls back to colour + initial). */
  photoUrl?: string;
  /** City / neighbourhood — rendered UNDER the profile image (Philip
   *  2026-09-01). This is a LIVE value: when the friend moves the city
   *  updates automatically at whatever data layer feeds the friend record. */
  location?: string;
  /** ISO 3166-1 alpha-2 country code (e.g. "ID", "SG") — used to render
   *  the flag emoji before the city name. Paired with `location`. */
  countryCode?: string;
  /** Shared moment or activity · rendered as a context chip. */
  sharedContext?: { icon: string; label: string };
  /** Mutual friend count · rendered as a small chip when > 0. */
  mutualCount?: number;
  /** Verified / creator badge next to the name. */
  verified?: boolean;
  /** Notifications muted · surfaces a bell-slash indicator. */
  muted?: boolean;
  /** Pinned to the top of the list. */
  pinned?: boolean;
  /** Blocked · contact cannot reach the user. Rendered with a red
   *  left-accent and dimmed body in the contacts drawer so the boundary
   *  is visually explicit. Philip 2026-09-03. */
  blocked?: boolean;
  /** Unfriended · softer boundary than blocked. Chat + messages still
   *  work in both directions, but "friend perks" are stripped (no
   *  theme sharing, no presence sync, no since-connected insights, no
   *  socials row). Rendered with a subtle grey "UNFRIEND" tag in the
   *  contacts drawer. Philip 2026-09-03. */
  unfriended?: boolean;
  /** They blocked YOU · the mirror of `blocked`. Renders this contact
   *  in the "degraded silhouette" view from Option 3 of the block-UX
   *  design (Philip 2026-09-03): default silhouette avatar, no
   *  presence, no last-seen, no fresh signals — no explicit "you were
   *  blocked" banner. Silent, industry-standard, respectful of both
   *  parties' data. Used ONLY on the blocked-party's client. */
  theyBlockedYou?: boolean;
  // ─── Business-card fields · Philip 2026-09-03 ───────────────────
  /** Three-tier account model · constitutional (see NEX Identity +
   *  Contact Doctrine). Free = auto Nex-XXXXX handle · pro_personal =
   *  chosen name + private contact fields · pro_business = chosen name
   *  + can publish contact fields when businessVerificationStatus is
   *  "verified" (never conflate tier with verification). */
  nexTier?: "free" | "pro_personal" | "pro_business";
  /** Business verification lifecycle · SEPARATE from tier. A user can
   *  be pro_business + pending (docs submitted, awaiting review).
   *  Only "verified" unlocks public-contact publishing at the render
   *  layer. Philip 2026-09-03 · never treat pro_business as
   *  automatically verified. */
  businessVerificationStatus?: "none" | "pending" | "verified" | "rejected";
  /** Account visibility · gates the photo access model.
   *  private = photo visible to NEX connections/approved interactions.
   *  public  = photo visible on public NEX profile. */
  accountVisibility?: "private" | "public";
  /** Server-side moderation lifecycle for the profile image. Client
   *  pre-checks are UX only · server is authoritative (see doctrine). */
  photoModerationStatus?: "pending" | "approved" | "rejected";
  photoModerationReason?: string;
  /** Per-field contact visibility · tier-gated maximums enforced at
   *  render + storage layer. Free = all hidden always. pro_personal =
   *  hidden|contacts. pro_business+verified = hidden|contacts|public. */
  contactVisibility?: {
    phone?:    "hidden" | "contacts" | "public";
    whatsapp?: "hidden" | "contacts" | "public";
    email?:    "hidden" | "contacts" | "public";
  };
  /** Structured business info · pro_personal + pro_business only.
   *  Never bake this info into the profile IMAGE (see Rule 1). */
  businessInfo?: {
    phone?:    string;
    whatsapp?: string;
    email?:    string;
    website?:  string;
    address?:  string;
    hours?:    string;
    booking?:  string;
  };
  /** Total contacts in this user's address book. Rendered as a stat. */
  contactCount?: number;
  /** Average online duration per day, in minutes (e.g. 210 → "3h 30m"). */
  dailyActiveMinutes?: number;
  /** Human-readable "member since" (e.g. "Mar 2024"). */
  memberSince?: string;
  // ─── Between-you-and-them (chat relationship) · Philip 2026-09-03 ──
  // Data NO OTHER chat app has because they don't compute it. Powers
  // the "In this chat" strip in the actions panel header.
  /** Total messages exchanged between the current user and this friend. */
  chatMessagesExchanged?: number;
  /** Average reply time between the two, in minutes (e.g. 8, 60, 180). */
  chatAvgReplyMinutes?: number;
  /** When the two of you first chatted (human-readable, e.g. "Aug 2025"). */
  chatSince?: string;
  /** Message request · not yet accepted/declined. Renders in a
   *  dedicated "REQUESTS" section at the top of the contacts drawer
   *  instead of the main list. Philip 2026-09-03. */
  isRequest?: boolean;
  /** First-time connection · when true, opening this chat plays a
   *  celebratory confetti burst + "connected" banner. One-shot demo
   *  signal for the mock; real backend would clear it after the first
   *  successful chat session. Philip 2026-09-03. */
  isFirstConnection?: boolean;
  /** External social handles · Philip 2026-09-03 · PRO-tier only.
   *  Each value is a full URL. Rendered as small icon links in the
   *  business-card header. Free-tier accounts don't get this surface
   *  (differentiator for the paid upgrade). */
  socials?: {
    facebook?:  string;
    instagram?: string;
    tiktok?:    string;
    twitter?:   string;
    linkedin?:  string;
    youtube?:   string;
  };
  /** Last mascot they sent · surfaces as a small chip with the artwork. */
  lastMascot?: { url: string; label: string };
};

export type PostEvent = {
  type: "sent" | "delivered" | "read" | "edited" | "pinned" | "replied" | "reacted";
  time: string;
  /** Optional actor label · e.g. "You", "Alex", "Sarah". Falls back to the
   *  message's own sender when omitted. */
  actor?: string;
};

export type FriendMessage = {
  id: string;
  /** Message author.
   *  - "user"        → the current user's message (right-aligned)
   *  - "friend"      → the other party's message (left-aligned)
   *  - "nex-private" → NEX's private assist reply · Philip 2026-09-03.
   *                     Shown only to the current user (never to the friend)
   *                     as a distinct orange-bordered container inside the
   *                     chat thread. Rendered by NexFriendChatView with
   *                     a "✨ NEX" badge + action buttons (Copy / Insert). */
  sender: "user" | "friend" | "nex-private";
  text: string;
  time: string;
  /** Optional threading · when set, this message is a reply to the referenced
   *  message id and renders nested under its parent (Philip 2026-09-02). */
  replyTo?: string;
  /** Per-message audit trail · shown when the user picks "Post Record"
   *  from the 3-dot menu. When omitted, the record view only shows the
   *  send time. Philip 2026-09-02. */
  postEvents?: PostEvent[];
  /** Read state · when false, a friend's message is unread by the user
   *  and its reply dot pulses with a heartbeat animation to draw the eye
   *  (Philip 2026-09-02). Defaults to true (assume read). */
  read?: boolean;
  /** Day divider label · when the label differs from the previous
   *  message's label, a pill divider is inserted before this message
   *  ("Today", "Yesterday", "Monday", "Sep 1", etc.). Defaults to
   *  "Today" when omitted. Philip 2026-09-02. */
  dayLabel?: string;
  /** Reactions attached to this message · rendered as small emoji chips
   *  under the body. Multiple reactions can accumulate (Philip 2026-09-02). */
  reactions?: MessageReaction[];
  /** Machine-parseable timestamp · when present, the header renders a
   *  smart relative label ("just now" / "5m ago" / "2h ago") for recent
   *  messages, falling back to `time` for older ones (Philip 2026-09-02). */
  dateISO?: string;
  /** User has saved this message to their saved-items list. */
  saved?: boolean;
  /** User has pinned this message to the top of the chat. */
  pinned?: boolean;
  /** Ambient knowledge card · NEX auto-injects this under a friend
   *  message when it detects context worth surfacing (a place, event,
   *  business, etc.). Bridges friend chat with NEX AI capabilities
   *  (Philip 2026-09-02 world-class). */
  ambientCard?: AmbientCard;
};

export type AmbientCard = {
  /** Icon (emoji or short glyph) displayed on the left. */
  icon: string;
  /** Primary title of the surfaced knowledge. */
  title: string;
  /** Optional secondary line (address, rating, etc.). */
  subtitle?: string;
  /** Optional meta line explaining WHY NEX surfaced this (source label). */
  meta?: string;
  /** Optional CTA label · tapping fires a shell handler later. */
  ctaLabel?: string;
};

export type MessageReaction = {
  emoji: string;
  by: "user" | "friend";
};

export const NEX_MOCK_FRIENDS: MockFriend[] = [
  {
    id: "f1", name: "Alex Kim", initial: "A", color: "#e74c3c",
    unread: 2, nexId: "alex", lastOnline: "2m ago", themeEnabled: true,
    status: "online",
    lastMessage: { text: "Hey where are you?", time: "14:23", kind: "text", unread: true },
    location: "Yogyakarta", countryCode: "ID",
    sharedContext: { icon: "🎬", label: "Watched NEX Live together" },
    mutualCount: 4, verified: true, pinned: true,
    photoUrl: "https://randomuser.me/api/portraits/men/32.jpg",
    nexTier: "pro_personal",
    businessVerificationStatus: "none",
    accountVisibility: "private",
    photoModerationStatus: "approved",
    contactVisibility: { phone: "contacts", whatsapp: "contacts", email: "hidden" },
    businessInfo: {
      phone:    "+62 811 2222 3333",
      whatsapp: "+62 811 2222 3333",
      email:    "alex@alexkim.dev",
      website:  "https://alexkim.dev",
    },
    contactCount: 87, dailyActiveMinutes: 210, memberSince: "Mar 2024",
    chatMessagesExchanged: 1247, chatAvgReplyMinutes: 8, chatSince: "Aug 2025",
    socials: {
      facebook:  "https://facebook.com/alexkim.nex",
      instagram: "https://instagram.com/alex_nex",
      tiktok:    "https://tiktok.com/@alex_kim",
    },
  },
  {
    id: "f2", name: "Sarah Chen", initial: "S", color: "#9b59b6",
    unread: 1, nexId: "sarah_ok", lastOnline: "18m ago", themeEnabled: true,
    status: "online",
    lastMessage: { text: "Can you send me the file?", time: "14:05", kind: "text", unread: true },
    location: "Jakarta", countryCode: "ID",
    mutualCount: 2,
    photoUrl: "https://randomuser.me/api/portraits/women/44.jpg",
    nexTier: "pro_personal", contactCount: 156, dailyActiveMinutes: 145, memberSince: "Nov 2023",
    chatMessagesExchanged: 342, chatAvgReplyMinutes: 22, chatSince: "Jun 2025",
  },
  {
    id: "f3", name: "Mike Brown", initial: "M", color: "#3498db",
    unread: 3, nexId: "Nex-38472", lastOnline: "just now", themeEnabled: false,
    status: "online",
    lastMessage: { text: "Photo", time: "13:42", kind: "photo", unread: true },
    sharedContext: { icon: "🍜", label: "You both saved Warung Bu Ageng" },
    mutualCount: 7,
    photoUrl: "https://randomuser.me/api/portraits/men/54.jpg",
    nexTier: "free", contactCount: 42, dailyActiveMinutes: 65, memberSince: "Aug 2024",
  },
  {
    id: "f4", name: "Priya Kaur", initial: "P", color: "#f39c12",
    unread: 0, nexId: "priya", lastOnline: "1h ago", themeEnabled: true,
    status: "away",
    lastMessage: { text: "Thanks!", time: "12:30", kind: "text", unread: false },
    location: "Bali", countryCode: "ID",
    lastMascot: {
      url: "https://ik.imagekit.io/ctlxgvqcm/nex-mascot-heart-01.png",
      label: "sent Heart",
    },
    photoUrl: "https://randomuser.me/api/portraits/women/68.jpg",
    nexTier: "pro_personal", contactCount: 203, dailyActiveMinutes: 320, memberSince: "Jan 2024",
    chatMessagesExchanged: 89, chatAvgReplyMinutes: 180, chatSince: "Sep 2025",
  },
  {
    id: "f5", name: "Jordan Lee", initial: "J", color: "#1abc9c",
    unread: 0, nexId: "Nex-19283", lastOnline: "yesterday", themeEnabled: false,
    status: "offline",
    lastMessage: { text: "See you tomorrow", time: "Yesterday", kind: "text", unread: false },
    muted: true, unfriended: true,
    photoUrl: "https://randomuser.me/api/portraits/men/76.jpg",
    nexTier: "free", contactCount: 8, dailyActiveMinutes: 15, memberSince: "Feb 2025",
  },
  // Extra mock contacts · Philip 2026-09-03 · exercise drawer scrolling
  // + variety across status / unread / message kind / muted.
  {
    id: "f6", name: "Rina Patel", initial: "R", color: "#e67e22",
    unread: 5, nexId: "rina", lastOnline: "just now", themeEnabled: true,
    status: "online",
    lastMessage: { text: "New photos from Bali!", time: "14:41", kind: "photo", unread: true },
    location: "Denpasar", countryCode: "ID", verified: true, mutualCount: 3,
    photoUrl: "https://randomuser.me/api/portraits/women/22.jpg",
    nexTier: "pro_business",
    businessVerificationStatus: "verified",
    accountVisibility: "public",
    photoModerationStatus: "approved",
    contactVisibility: { phone: "public", whatsapp: "public", email: "public" },
    businessInfo: {
      phone:    "+62 812 3456 7890",
      whatsapp: "+62 812 3456 7890",
      email:    "hello@rina.studio",
      website:  "https://rina.studio",
      address:  "Jl. Sunset Road, Denpasar, Bali",
      hours:    "Mon–Sat · 09:00 – 18:00",
      booking:  "https://cal.com/rina",
    },
    contactCount: 340, dailyActiveMinutes: 400, memberSince: "Sep 2023",
    socials: {
      instagram: "https://instagram.com/rina.p",
      tiktok:    "https://tiktok.com/@rina.p",
      youtube:   "https://youtube.com/@rinap",
    },
  },
  {
    id: "f7", name: "Diego Ruiz", initial: "D", color: "#2ecc71",
    unread: 0, nexId: "diego", lastOnline: "3d ago", themeEnabled: false,
    status: "offline",
    lastMessage: { text: "Thanks for the intro", time: "Mon", kind: "text", unread: false },
    muted: true, blocked: true,
    photoUrl: "https://randomuser.me/api/portraits/men/12.jpg",
    nexTier: "pro_personal", contactCount: 51, dailyActiveMinutes: 30, memberSince: "Apr 2024",
  },
  {
    id: "f8", name: "Aiko Sato", initial: "A", color: "#8e44ad",
    unread: 2, nexId: "aiko", lastOnline: "just now", themeEnabled: true,
    status: "typing",
    lastMessage: { text: "Give me one sec…", time: "14:47", kind: "text", unread: true },
    location: "Tokyo", countryCode: "JP", mutualCount: 8,
    photoUrl: "https://randomuser.me/api/portraits/women/33.jpg",
    nexTier: "pro_personal", contactCount: 89, dailyActiveMinutes: 180, memberSince: "Jun 2024",
    chatMessagesExchanged: 1893, chatAvgReplyMinutes: 4, chatSince: "Jul 2024",
    isFirstConnection: true,
  },
  {
    id: "f9", name: "Marcus West", initial: "M", color: "#34495e",
    unread: 0, nexId: "Nex-91836", lastOnline: "5m ago", themeEnabled: false,
    status: "away",
    lastMessage: { text: "Watched the walkthrough", time: "14:12", kind: "video", unread: false },
    photoUrl: "https://randomuser.me/api/portraits/men/45.jpg",
    nexTier: "free", contactCount: 12, dailyActiveMinutes: 25, memberSince: "Jan 2025",
  },
  {
    id: "f10", name: "Yuki Nakamura", initial: "Y", color: "#e91e63",
    unread: 12, nexId: "yuki", lastOnline: "just now", themeEnabled: true,
    status: "online",
    lastMessage: { text: "See attachment", time: "14:52", kind: "file", unread: true },
    location: "Osaka", countryCode: "JP", pinned: true, verified: true, mutualCount: 12,
    photoUrl: "https://randomuser.me/api/portraits/women/50.jpg",
    nexTier: "pro_personal", contactCount: 512, dailyActiveMinutes: 240, memberSince: "Jul 2023",
  },
  {
    id: "f11", name: "Sam Nakamoto", initial: "S", color: "#16a085",
    unread: 1, nexId: "Nex-58273", lastOnline: "1h ago", themeEnabled: false,
    status: "offline",
    lastMessage: { text: "Sent a mascot", time: "13:20", kind: "mascot", unread: true },
    lastMascot: {
      url: "https://ik.imagekit.io/ctlxgvqcm/nex-mascot-heart-01.png",
      label: "sent Heart",
    },
    photoUrl: "https://randomuser.me/api/portraits/men/23.jpg",
    nexTier: "free", contactCount: 6, dailyActiveMinutes: 8, memberSince: "Feb 2026",
    // Demo: Sam has blocked the current user. His card + business
    // header render in the degraded silhouette view (Philip 2026-09-03).
    theyBlockedYou: true,
  },
  // Message requests · Philip 2026-09-03. Rendered in the REQUESTS
  // section at the top of the contacts drawer. Not part of the main
  // contact list until accepted.
  {
    id: "r1", name: "Kai Nakashima", initial: "K", color: "#f43f5e",
    unread: 1, nexId: "kai", lastOnline: "just now", themeEnabled: false,
    status: "online",
    lastMessage: { text: "Hi, saw you at the meetup!", time: "14:58", kind: "text", unread: true },
    location: "Kyoto", countryCode: "JP",
    photoUrl: "https://randomuser.me/api/portraits/men/60.jpg",
    nexTier: "pro_personal",
    isRequest: true, isFirstConnection: true,
  },
  {
    id: "r2", name: "Nia Osei", initial: "N", color: "#7c3aed",
    unread: 1, nexId: "Nex-77102", lastOnline: "12m ago", themeEnabled: false,
    status: "online",
    lastMessage: { text: "Wanted to introduce myself", time: "14:47", kind: "text", unread: true },
    location: "Accra", countryCode: "GH",
    photoUrl: "https://randomuser.me/api/portraits/women/61.jpg",
    nexTier: "free",
    isRequest: true, isFirstConnection: true,
  },
];

export const NEX_MOCK_FRIEND_THREADS: Record<string, FriendMessage[]> = {
  f1: [
    // ─── 7 days ago burst · demonstrates relative-day label ────────
    {
      id: "f1-w1", sender: "friend", text: "Did you get my email?", time: "2:14 PM",
      dayLabel: "7 days ago",
    },
    // ─── Yesterday burst ────────────────────────────────────────────
    {
      id: "f1-y1", sender: "friend", text: "Are you free tomorrow?", time: "5:30 PM",
      dayLabel: "Yesterday",
    },
    {
      id: "f1-y2", sender: "user", text: "Yeah, let's meet at 10am", time: "6:15 PM",
      dayLabel: "Yesterday",
    },
    // ─── Today burst ────────────────────────────────────────────────
    {
      id: "f1-1", sender: "friend", text: "Hey, when are we meeting?", time: "10:23 AM",
      dayLabel: "Today",
      pinned: true,
      postEvents: [
        { type: "sent",      time: "10:23:04 AM", actor: "Alex" },
        { type: "delivered", time: "10:23:06 AM" },
        { type: "read",      time: "10:23:41 AM", actor: "You" },
      ],
    },
    {
      id: "f1-2", sender: "friend", text: "Let me know your availability", time: "10:24 AM",
      dayLabel: "Today",
      reactions: [{ emoji: "👍", by: "user" }],
      postEvents: [
        { type: "sent",      time: "10:24:12 AM", actor: "Alex" },
        { type: "edited",    time: "10:24:38 AM", actor: "Alex" },
        { type: "delivered", time: "10:24:40 AM" },
        { type: "read",      time: "10:25:02 AM", actor: "You" },
      ],
    },
    {
      // Unread demo · reply dot pulses (heartbeat) until user reads it.
      id: "f1-3", sender: "friend", text: "Also, are we still doing the demo tomorrow?", time: "10:26 AM",
      dayLabel: "Today",
      read: false,
      postEvents: [
        { type: "sent",      time: "10:26:44 AM", actor: "Alex" },
        { type: "delivered", time: "10:26:46 AM" },
      ],
    },
  ],
  f2: [
    { id: "f2-1", sender: "friend", text: "Can you send me the file?",           time: "9:15 AM" },
  ],
  f3: [
    { id: "f3-1", sender: "friend", text: "Ready for lunch?",                    time: "11:42 AM" },
    { id: "f3-2", sender: "friend", text: "I'm at the usual spot",               time: "11:45 AM" },
    { id: "f3-3", sender: "friend", text: "Ping me when you're close",           time: "11:46 AM" },
  ],
  f4: [
    { id: "f4-1", sender: "friend", text: "Thanks for the help yesterday!",      time: "8:20 AM" },
  ],
  f5: [
    { id: "f5-1", sender: "friend", text: "Are you free tomorrow?",              time: "7:50 AM" },
  ],
};

const BUTTON_SIZE = 48;   // round Friends button diameter
const AVATAR_SIZE = 40;   // individual friend avatar diameter
const GUTTER      = 10;   // gap between button and row + between avatars
const MAX_VISIBLE = 4;    // how many avatars stay in view before scrolling

export function NexPendingChats({
  activeFriendId,
  onSelectFriend,
}: {
  activeFriendId: string | null;
  onSelectFriend: (id: string) => void;
}) {
  const withUnread   = NEX_MOCK_FRIENDS.filter((f) => (f.unread ?? 0) > 0);
  const totalUnread  = withUnread.reduce((n, f) => n + f.unread, 0);
  const [expanded, setExpanded]   = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Close on outside tap · classic mobile dock behaviour · doesn't
  // interfere with the corner buttons or the central orb (they live in
  // separate refs at higher z-indexes).
  useEffect(() => {
    if (!expanded) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setExpanded(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [expanded]);

  // Nothing to surface · leave the dock hidden so we never render an
  // orange button with no unread messages behind it (empty affordance).
  if (withUnread.length === 0) return null;

  const rowWidth = MAX_VISIBLE * AVATAR_SIZE + (MAX_VISIBLE - 1) * GUTTER;

  return (
    <div
      ref={rootRef}
      style={{
        position: "fixed",
        left: 22,
        bottom: "max(env(safe-area-inset-bottom), 14px)",
        display: "flex",
        alignItems: "center",
        gap: GUTTER,
        zIndex: 4,
      }}
      data-nex-pending-chats
      aria-label="Pending messages"
    >
      {/* Collapsed / expand-toggle · round orange NEX-language button. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-label={`Friends · ${totalUnread} unread message${totalUnread === 1 ? "" : "s"}`}
        aria-expanded={expanded}
        data-testid="nex-pending-chats-toggle"
        style={{
          position: "relative",
          width: BUTTON_SIZE,
          height: BUTTON_SIZE,
          borderRadius: "50%",
          background: NEX.bgSurfaceHi,
          border: `2px solid ${NEX.orange}`,
          color: NEX.text,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
          boxShadow: expanded
            ? `0 0 18px ${NEX.orangeGlow}`
            : `0 2px 10px rgba(0,0,0,0.55)`,
          transition: "box-shadow 220ms ease, transform 220ms ease",
          transform: expanded ? "scale(1.04)" : "scale(1)",
          flexShrink: 0,
        }}
      >
        <Users size={22} strokeWidth={1.75} color={NEX.orange} />
        {totalUnread > 0 && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 20,
              height: 20,
              padding: "0 6px",
              borderRadius: 999,
              background: NEX.orange,
              color: "#0a0a0a",
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #050505",
            }}
          >
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {/* Roll-out avatar row · horizontal scroll if more than MAX_VISIBLE.
          Width fixed at 4 slots so scroll is required at 5+; height matches
          avatar so no vertical overflow. Smooth width transition on expand. */}
      <div
        className="nex-no-scrollbar"
        role="list"
        aria-hidden={!expanded}
        style={{
          maxWidth: expanded ? rowWidth : 0,
          overflowX: "auto",
          overflowY: "hidden",
          display: "flex",
          alignItems: "center",
          gap: GUTTER,
          height: AVATAR_SIZE + 6,   // small vertical breathing room for unread dot
          padding: expanded ? "3px 4px" : 0,
          transition: "max-width 260ms cubic-bezier(0.16, 1, 0.3, 1), padding 260ms cubic-bezier(0.16, 1, 0.3, 1)",
          opacity: expanded ? 1 : 0,
          pointerEvents: expanded ? "auto" : "none",
          scrollSnapType: "x proximity",
        }}
      >
        {withUnread.map((friend) => {
          const isActive = activeFriendId === friend.id;
          return (
            <button
              key={friend.id}
              role="listitem"
              type="button"
              onClick={() => { onSelectFriend(friend.id); setExpanded(false); }}
              aria-label={`${friend.name} · ${friend.unread} unread`}
              style={{
                position: "relative",
                width: AVATAR_SIZE,
                height: AVATAR_SIZE,
                minWidth: AVATAR_SIZE,
                borderRadius: "50%",
                background: friend.color,
                color: "#fff",
                border: isActive
                  ? `2px solid ${NEX.orange}`
                  : `2px solid rgba(249,115,22,0.45)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                padding: 0,
                boxShadow: isActive
                  ? `0 0 12px ${NEX.orangeGlow}`
                  : "0 2px 8px rgba(0,0,0,0.5)",
                transition: "border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
                transform: isActive ? "scale(1.08)" : "scale(1)",
                scrollSnapAlign: "start",
                flexShrink: 0,
              }}
            >
              {friend.initial}
              {friend.unread > 0 && !isActive && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: -3,
                    right: -3,
                    minWidth: 16,
                    height: 16,
                    padding: "0 4px",
                    borderRadius: 8,
                    background: "#ef4444",
                    color: "#ffffff",
                    fontSize: 9,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1.5px solid #0a0a0a",
                    boxShadow: "0 0 6px rgba(239, 68, 68, 0.55)",
                  }}
                >
                  {friend.unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
