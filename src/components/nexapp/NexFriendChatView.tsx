// NEX friend chat view · 2026-08-23 (Philip refinement).
//
// Shown inside the conversation frame when the user selects a pending
// friend from NexPendingChats. Header shows friend avatar + name + a
// close button (returns to NEX conversation). Body is a scrollable
// mock message thread with user bubbles on the right and friend bubbles
// on the left. Composer stays open for typing (handled by NexAppHome).

"use client";

import { X } from "lucide-react";
import type { CSSProperties } from "react";
import { NEX } from "@/lib/nexapp/tokens";
import type { MockFriend, FriendMessage } from "./NexPendingChats";

export function NexFriendChatView({
  friend,
  messages,
  onClose,
}: {
  friend: MockFriend;
  messages: FriendMessage[];
  onClose: () => void;
}) {
  return (
    <div style={containerStyle}>
      {/* Header · avatar + name + close */}
      <div style={headerStyle}>
        <div style={avatarStyle(friend)}>{friend.initial}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: NEX.text,
              letterSpacing: -0.1,
            }}
          >
            {friend.name}
          </div>
          <div style={{ fontSize: 10, color: NEX.textFaint }}>Online</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close friend chat"
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: NEX.bgSurface,
            border: `1px solid ${NEX.borderMuted}`,
            color: NEX.textMuted,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <X size={14} strokeWidth={1.8} />
        </button>
      </div>

      {/* Scrollable thread */}
      <div className="nex-no-scrollbar" style={messageListStyle}>
        {messages.map((m) => {
          const isUser = m.sender === "user";
          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isUser ? "flex-end" : "flex-start",
                gap: 6,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 8,
                  maxWidth: "85%",
                }}
              >
                {!isUser && (
                  <div style={{ ...avatarStyle(friend), width: 28, height: 28, minWidth: 28, fontSize: 11 }}>
                    {friend.initial}
                  </div>
                )}
                <div
                  style={{
                    background: isUser
                      ? "linear-gradient(180deg, rgba(249,115,22,0.22) 0%, rgba(249,115,22,0.10) 100%)"
                      : NEX.bgSurfaceHi,
                    border: `1px solid ${NEX.borderMuted}`,
                    borderRadius: 16,
                    padding: "10px 14px",
                    fontSize: 14,
                    lineHeight: 1.45,
                    color: NEX.text,
                  }}
                >
                  {m.text}
                  <div
                    style={{
                      fontSize: 10,
                      color: NEX.textFaint,
                      marginTop: 6,
                      textAlign: isUser ? "right" : "left",
                    }}
                  >
                    {m.time}
                    {isUser && <span style={{ marginLeft: 4, color: NEX.textFaint }}>✓</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function avatarStyle(friend: MockFriend): CSSProperties {
  return {
    width: 34,
    height: 34,
    minWidth: 34,
    borderRadius: "50%",
    background: friend.color,
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0.2,
  };
}

const containerStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "6px 6px 12px",
  borderBottom: `1px solid ${NEX.borderMuted}`,
  marginBottom: 12,
};

const messageListStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  paddingRight: 2,
  paddingLeft: 2,
  paddingBottom: 60,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  scrollBehavior: "smooth",
};
