"use client";

// src/components/nex-native/surface-health/SafeFallbackRenderer.tsx
//
// Dependency-light fallback renderer per doctrine §6.
//
// Rules observed in this file:
//   · Deliberately boring · plain inline styles, system fonts, no
//     animations, no gradients, no network-fetched chrome.
//   · Deterministic · same props produce same output.
//   · Dependency-light · imports ONLY React. No theme utility, no
//     chat-theme-service, no theme-skin, no sticker/emoji registry,
//     no animation module, no cover utility.
//   · Core-only · consumes messages + viewerAccountId. Enough for the
//     user to continue the essential conversation experience.
//   · Self-contained · reachable even if the broken theme bundle fails
//     to load. The file does not import anything from
//     src/lib/nex-native/chat-theme-service, src/lib/nex-native/theme-*,
//     src/app/nex-native/themes/*, or chat-render/.
//   · Independence check lives in
//     src/components/nex-native/surface-health/__tests__/safe-fallback-independence.test.ts

import * as React from "react";

export interface SafeFallbackMessage {
  id: string;
  body: string;
  sender_account_id: string;
  sent_at: string;
}

export interface SafeFallbackRendererProps {
  messages: SafeFallbackMessage[];
  viewerAccountId: string;
  /** Optional label shown above the message list ("Chat continues · reduced"
   *  by default). Never surface technical detail. */
  statusLabel?: string;
}

export function SafeFallbackRenderer(props: SafeFallbackRendererProps): React.ReactElement {
  const { messages, viewerAccountId } = props;
  const statusLabel = props.statusLabel ?? "Chat continues · reduced";

  return (
    <div
      role="log"
      aria-live="polite"
      style={{
        boxSizing: "border-box",
        width: "100%",
        minHeight: "100%",
        padding: "16px 16px 12px",
        backgroundColor: "#0b1420",
        color: "#f4f7fc",
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        fontSize: 14,
        lineHeight: 1.45,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          alignSelf: "center",
          padding: "4px 10px",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#8ba9d1",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 999,
        }}
      >
        {statusLabel}
      </div>
      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {messages.length === 0 ? (
          <li style={{ opacity: 0.7, textAlign: "center", padding: 16 }}>
            No messages yet.
          </li>
        ) : (
          messages.map((m) => {
            const mine = m.sender_account_id === viewerAccountId;
            return (
              <li
                key={m.id}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: mine ? "#17365f" : "#0f2238",
                  color: "#f4f7fc",
                  alignSelf: mine ? "flex-end" : "flex-start",
                  maxWidth: "80%",
                  wordBreak: "break-word",
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.body}
              </li>
            );
          })
        )}
      </ol>
    </div>
  );
}
