// NEX Workspace · CHAT artifact · real conversation transcript.
//
// Migrated from the retired NexAppHome (2026-08-26 pass). Consumes the
// hoisted useNexVoice pipeline in NexAppShell via props · never owns voice
// state itself. Renders the message list in the CENTRE workspace zone;
// composer lives separately in the HUD frame's BOTTOM zone.
//
// Doctrine anchors:
//   project_nex_workspace_identity_doctrine_2026_08_25
//   project_nex_workspace_terminology_addendum_2026_08_25
//     (chat is one artifact the workspace can hold · conversation is the
//      control layer for the workspace)

"use client";

import React, { useEffect, useRef } from "react";
import type { NexVoiceState } from "@/lib/nex-voice";

export interface ChatMessage {
  id:     string;
  sender: "user" | "nex";
  text:   string;
  time:   string;
  /** Optional mascot posted with the message · rendered as an image in the
   *  bubble (Philip 2026-08-27 · mascot detail → post to chat). */
  mascotUrl?:  string;
  mascotName?: string;
}

interface Props {
  messages: ChatMessage[];
  nexState: NexVoiceState;
  onOrbTap?: () => void;
  error?:    string | null;
}

const NEX_STATE_LABEL: Record<NexVoiceState, string> = {
  idle:      "Ready",
  listening: "Listening",
  thinking:  "Thinking",
  speaking:  "Speaking",
  error:     "Retry",
};

const NEX_STATE_COLOR: Record<NexVoiceState, string> = {
  idle:      "rgba(249,115,22,0.55)",
  listening: "#f97316",
  thinking:  "#a855f7",
  speaking:  "#22d3ee",
  error:     "#f43f5e",
};

export function NexWorkspaceChat({ messages, nexState, onOrbTap, error }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, nexState]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header · NEX state indicator + orb tap. Small · workspace stays primary. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          type="button"
          onClick={onOrbTap}
          aria-label={`NEX ${NEX_STATE_LABEL[nexState]}`}
          style={{
            appearance: "none",
            border: `1px solid ${NEX_STATE_COLOR[nexState]}`,
            background: `radial-gradient(circle at 30% 30%, ${NEX_STATE_COLOR[nexState]} 0%, rgba(0,0,0,0.7) 80%)`,
            width: 24, height: 24, minWidth: 24,
            borderRadius: "50%",
            cursor: "pointer",
            padding: 0,
            boxShadow:
              nexState === "listening" ? "0 0 10px rgba(249,115,22,0.55)" :
              nexState === "thinking"  ? "0 0 10px rgba(168,85,247,0.55)" :
              nexState === "speaking"  ? "0 0 10px rgba(34,211,238,0.55)"  :
              "none",
            animation: (nexState === "listening" || nexState === "thinking" || nexState === "speaking")
              ? "nex-orb-pulse 1.6s ease-in-out infinite" : undefined,
          }}
        />
        <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: "rgba(245,245,245,0.55)", fontWeight: 600 }}>
          Ask NEX · {NEX_STATE_LABEL[nexState]}
        </div>
      </div>

      {/* Message list · autoscroll to bottom on new turn. */}
      <div
        ref={scrollRef}
        className="nex-no-scrollbar"
        style={{
          flex: 1,
          overflow: "auto",
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              alignSelf: "flex-start",
              maxWidth: "82%",
              padding: "8px 12px",
              borderRadius: 14,
              background: "rgba(249,115,22,0.10)",
              border: "1px solid rgba(249,115,22,0.28)",
              fontSize: 12,
              color: "rgba(245,245,245,0.92)",
              lineHeight: 1.35,
            }}
          >
            Hi. Ask me anything — food, stays, markets, or transport in your city.
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
              maxWidth: "82%",
              padding: "8px 12px",
              borderRadius: 14,
              background: m.sender === "user"
                ? "rgba(255,255,255,0.06)"
                : "rgba(249,115,22,0.10)",
              border: `1px solid ${m.sender === "user"
                ? "rgba(255,255,255,0.10)"
                : "rgba(249,115,22,0.28)"}`,
              fontSize: 12,
              color: "rgba(245,245,245,0.92)",
              lineHeight: 1.35,
            }}
          >
            {m.mascotUrl && (
              <img
                src={m.mascotUrl}
                alt={m.mascotName ?? "mascot"}
                loading="lazy"
                decoding="async"
                style={{
                  display: "block",
                  height: 72,
                  width: "auto",
                  maxWidth: "100%",
                  objectFit: "contain",
                  marginBottom: m.text ? 4 : 0,
                  filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
                }}
              />
            )}
            {m.text && <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>}
            <div style={{ marginTop: 2, fontSize: 10, opacity: 0.4, textAlign: "right" }}>
              {m.time}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: "6px 12px",
            fontSize: 11,
            color: "#fca5a5",
            background: "rgba(244,63,94,0.10)",
            borderTop: "1px solid rgba(244,63,94,0.28)",
          }}
        >
          {error}
        </div>
      )}

      <style>{`
        @keyframes nex-orb-pulse {
          0%, 100% { transform: scale(1);    opacity: 1; }
          50%      { transform: scale(1.10); opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}
