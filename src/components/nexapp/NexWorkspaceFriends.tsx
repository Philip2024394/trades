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

import React, { useState } from "react";
import {
  NEX_MOCK_FRIENDS,
  NEX_MOCK_FRIEND_THREADS,
  type FriendMessage,
} from "./NexPendingChats";

export function NexWorkspaceFriends() {
  const [activeId, setActiveId] = useState<string | null>(null);

  if (activeId) {
    const friend = NEX_MOCK_FRIENDS.find((f) => f.id === activeId);
    const thread: FriendMessage[] = NEX_MOCK_FRIEND_THREADS[activeId] ?? [];
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            type="button"
            onClick={() => setActiveId(null)}
            aria-label="Back to friends"
            style={{ appearance: "none", border: "none", background: "transparent", color: "rgba(245,245,245,0.7)", cursor: "pointer", fontSize: 16, padding: 2 }}
          >
            ‹
          </button>
          <span
            aria-hidden
            style={{
              width: 28, height: 28, borderRadius: "50%",
              background: friend?.color ?? "#666",
              color: "#fff", fontWeight: 700, fontSize: 13,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {friend?.initial}
          </span>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{friend?.name}</div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }} className="nex-no-scrollbar">
          {thread.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
                maxWidth: "78%",
                padding: "6px 10px",
                borderRadius: 12,
                background: m.sender === "user" ? "rgba(249,115,22,0.18)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${m.sender === "user" ? "rgba(249,115,22,0.35)" : "rgba(255,255,255,0.08)"}`,
                fontSize: 12,
                color: "rgba(245,245,245,0.92)",
              }}
            >
              <div>{m.text}</div>
              <div style={{ marginTop: 2, fontSize: 10, opacity: 0.5, textAlign: "right" }}>{m.time}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 12px", fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: "rgba(245,245,245,0.55)", fontWeight: 600 }}>
        Friends
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "0 8px 10px", display: "flex", flexDirection: "column", gap: 4 }} className="nex-no-scrollbar">
        {NEX_MOCK_FRIENDS.map((f) => {
          const thread = NEX_MOCK_FRIEND_THREADS[f.id] ?? [];
          const last = thread[thread.length - 1];
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveId(f.id)}
              style={{
                appearance: "none",
                border: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.02)",
                borderRadius: 10,
                padding: "8px 10px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 32, height: 32, minWidth: 32,
                  borderRadius: "50%",
                  background: f.color,
                  color: "#fff", fontWeight: 700, fontSize: 13,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {f.initial}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: 12, fontWeight: 600, color: "rgba(245,245,245,0.9)" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  {last && <span style={{ fontSize: 10, opacity: 0.5 }}>{last.time}</span>}
                </div>
                <div style={{ fontSize: 11, opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {last?.text ?? "No messages yet"}
                </div>
              </div>
              {f.unread > 0 && (
                <span style={{ background: "#f97316", color: "#000", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 999 }}>
                  {f.unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
