// NEX pending chats · 2026-08-23 (Philip refinement).
//
// Bottom-left footer row of profile avatars for friends who have sent
// the user a message that hasn't been replied to yet. Selecting an
// avatar switches the chat view to a mock thread with that friend and
// opens the composer for typing a reply.
//
// Mock data only for this iteration ("display now mock profiles for
// view") · real backend wiring is deferred. NEX_MOCK_FRIENDS +
// NEX_MOCK_FRIEND_THREADS are exported so NexFriendChatView + NexAppHome
// can share the same source of truth.

"use client";

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

export function NexPendingChats({
  activeFriendId,
  onSelectFriend,
}: {
  activeFriendId: string | null;
  onSelectFriend: (id: string) => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        left: 22,
        bottom: "max(env(safe-area-inset-bottom), 14px)",
        display: "flex",
        gap: 8,
        zIndex: 4,
      }}
      data-nex-pending-chats
      aria-label="Pending messages"
    >
      {NEX_MOCK_FRIENDS.map((friend) => {
        const isActive = activeFriendId === friend.id;
        return (
          <button
            key={friend.id}
            type="button"
            onClick={() => onSelectFriend(friend.id)}
            aria-label={`${friend.name} · ${friend.unread} unread message${friend.unread === 1 ? "" : "s"}`}
            style={{
              position: "relative",
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: friend.color,
              border: isActive
                ? "2px solid #f97316"
                : "2px solid rgba(249, 115, 22, 0.45)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              padding: 0,
              boxShadow: isActive
                ? "0 0 12px rgba(249, 115, 22, 0.6)"
                : "0 2px 8px rgba(0,0,0,0.5)",
              transition: "border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
              transform: isActive ? "scale(1.08)" : "scale(1)",
            }}
          >
            {friend.initial}
            {friend.unread > 0 && !isActive && (
              <span
                style={{
                  position: "absolute",
                  top: -3,
                  right: -3,
                  minWidth: 15,
                  height: 15,
                  padding: "0 3px",
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
                aria-hidden
              >
                {friend.unread}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
