"use client";

// src/app/nex-native/settings/profile/_nex-id-share.tsx
//
// Bridge 80 · Prominent NEX ID display with one-tap copy + share.
// ---------------------------------------------------------------
// Founder direction 2026-09-29: the nex-XXXX handle IS the identity
// friends use to add you. Currently it hides on the friends page and
// the public /u/[handle] surface only · the profile page never
// surfaces it at all. This puts it front-and-center on the Personal
// tab so users can copy or share it in one tap.
//
// Native Web Share API is used when available (opens the OS share
// sheet on mobile), with a clipboard-copy fallback for desktop.

import * as React from "react";

const NEX = {
  panel: "#03101D",
  fieldBg: "#04101F",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  orange: "#FF7200",
  green: "#22E37A",
};

export function NexIdShare({
  handle,
  displayName,
}: {
  handle: string | null;
  displayName: string;
}): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);

  const handleValue = handle ?? "";
  const hasHandle = !!handle;

  const copy = React.useCallback(async () => {
    if (!hasHandle) return;
    try {
      await navigator.clipboard.writeText(handleValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Older browsers · silent fail is acceptable here (the value is
      // already visible on screen for manual selection).
    }
  }, [handleValue, hasHandle]);

  const share = React.useCallback(async () => {
    if (!hasHandle) return;
    const text = `Add me on NEX: ${handleValue}`;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: `${displayName} on NEX`,
          text,
        });
        return;
      } catch {
        // User cancelled or share unavailable · fall through to copy.
      }
    }
    void copy();
  }, [handleValue, hasHandle, displayName, copy]);

  return (
    <section
      style={{
        padding: 16,
        background:
          "linear-gradient(135deg, rgba(0,175,255,0.10) 0%, rgba(3,16,29,0.72) 100%)",
        border: `1px solid ${NEX.cyanSoft}`,
        borderRadius: 14,
        marginBottom: 16,
        boxShadow: "0 8px 22px rgba(0,175,255,0.10)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: NEX.cyan,
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        Your NEX ID
      </div>
      <div
        style={{
          fontSize: 12,
          color: NEX.textSecondary,
          lineHeight: 1.55,
          marginBottom: 12,
        }}
      >
        Share this so friends can add you · your phone number stays
        private and is only used to sign in.
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "stretch",
          flexWrap: "wrap",
        }}
      >
        <div
          aria-label="Your NEX ID"
          style={{
            flex: "1 1 220px",
            minHeight: 48,
            padding: "10px 14px",
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: "0.02em",
            background: NEX.fieldBg,
            border: `1px solid ${NEX.cyanSoft}`,
            borderRadius: 10,
            color: hasHandle ? NEX.textPrimary : NEX.textMute,
            display: "inline-flex",
            alignItems: "center",
            userSelect: "all",
            fontFamily:
              "ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
          }}
        >
          {hasHandle ? handleValue : "pending · reload if this persists"}
        </div>

        <button
          type="button"
          onClick={copy}
          disabled={!hasHandle}
          aria-label="Copy NEX ID"
          style={{
            minHeight: 48,
            padding: "10px 16px",
            borderRadius: 10,
            border: `1px solid ${NEX.cyanSoft}`,
            background: copied ? "rgba(34,227,122,0.18)" : NEX.cyanFaint,
            color: copied ? NEX.green : NEX.cyan,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: hasHandle ? "pointer" : "not-allowed",
            transition: "background 160ms ease, color 160ms ease",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>

        <button
          type="button"
          onClick={share}
          disabled={!hasHandle}
          aria-label="Share NEX ID"
          style={{
            minHeight: 48,
            padding: "10px 16px",
            borderRadius: 10,
            border: "none",
            background: NEX.orange,
            color: "#0B0F1A",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: hasHandle ? "pointer" : "not-allowed",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          Share
        </button>
      </div>
    </section>
  );
}
