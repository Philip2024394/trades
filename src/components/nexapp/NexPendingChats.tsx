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
};

export type FriendMessage = {
  id: string;
  sender: "user" | "friend";
  text: string;
  time: string;
};

export const NEX_MOCK_FRIENDS: MockFriend[] = [
  { id: "f1", name: "Alex",   initial: "A", color: "#e74c3c", unread: 2 },
  { id: "f2", name: "Sarah",  initial: "S", color: "#9b59b6", unread: 1 },
  { id: "f3", name: "Mike",   initial: "M", color: "#3498db", unread: 3 },
  { id: "f4", name: "Priya",  initial: "P", color: "#f39c12", unread: 1 },
  { id: "f5", name: "Jordan", initial: "J", color: "#1abc9c", unread: 1 },
];

export const NEX_MOCK_FRIEND_THREADS: Record<string, FriendMessage[]> = {
  f1: [
    { id: "f1-1", sender: "friend", text: "Hey, when are we meeting?",           time: "10:23 AM" },
    { id: "f1-2", sender: "friend", text: "Let me know your availability",       time: "10:24 AM" },
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
