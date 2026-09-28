"use client";

// src/app/nex-native/chat/peer/[accountId]/_report-user-modal.tsx
//
// Bridge 16d · Report user modal (client).
// ----------------------------------------
// Opens from a "Report user" affordance in the peer chat 3-dot menu.
// Renders a form with radio reason picker + note field + submit. The
// bound Server Action snapshots the current conversation on the
// server side so the reviewer keeps evidence even if messages are
// later deleted.
//
// Not shown when the viewer has already reported this user (page
// gates via `viewerHasReported`) · avoids spam-reporting the same
// person repeatedly.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

interface ReasonMeta {
  slug: string;
  emoji: string;
  label: string;
  blurb: string;
}

export function ReportUserModal({
  action,
  open,
  onClose,
  peerName,
  backHref,
  reasons,
  strings,
}: {
  action: (formData: FormData) => Promise<never> | void;
  open: boolean;
  onClose: () => void;
  peerName: string;
  backHref: string;
  reasons: ReasonMeta[];
  strings: {
    title: string;
    lede: string;
    reason_label: string;
    note_label: string;
    note_placeholder: string;
    submit: string;
    cancel: string;
    disclaimer: string;
  };
}) {
  const [mounted, setMounted] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nex-report-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "rgba(2,9,20,0.86)",
        backdropFilter: "blur(6px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          maxHeight: "90dvh",
          overflowY: "auto",
          background: "#050f1e",
          border: "1px solid rgba(255,51,85,0.35)",
          borderRadius: 18,
          padding: "26px 22px 20px",
          color: "#F4F7FC",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "#FF7A85",
              fontWeight: 700,
            }}
          >
            🚨 Report
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              background: "rgba(139,169,209,0.08)",
              border: "1px solid rgba(139,169,209,0.24)",
              color: "rgba(244,247,252,0.75)",
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "inherit",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <h2
          id="nex-report-title"
          style={{
            margin: 0,
            fontFamily:
              "'Cormorant Garamond', 'EB Garamond', Georgia, serif",
            fontSize: 26,
            lineHeight: 1.15,
            fontWeight: 500,
            letterSpacing: "-0.008em",
            marginBottom: 8,
          }}
        >
          {strings.title.replace("{name}", peerName)}
        </h2>

        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.55,
            color: "rgba(244,247,252,0.85)",
            marginBottom: 18,
          }}
        >
          {strings.lede}
        </p>

        <form action={action}>
          <input type="hidden" name="back" value={backHref} />

          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(139,169,209,0.85)",
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            {strings.reason_label}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 18,
            }}
          >
            {reasons.map((r) => {
              const checked = selectedReason === r.slug;
              return (
                <label
                  key={r.slug}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "22px 26px 1fr",
                    gap: 10,
                    alignItems: "start",
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: checked
                      ? "rgba(255,51,85,0.08)"
                      : "rgba(139,169,209,0.05)",
                    border: checked
                      ? "1px solid rgba(255,51,85,0.35)"
                      : "1px solid rgba(139,169,209,0.20)",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.slug}
                    checked={checked}
                    onChange={() => setSelectedReason(r.slug)}
                    style={{
                      width: 16,
                      height: 16,
                      marginTop: 3,
                      accentColor: "#FF3355",
                    }}
                  />
                  <span
                    aria-hidden
                    style={{
                      fontSize: 16,
                      lineHeight: "22px",
                      textAlign: "center",
                    }}
                  >
                    {r.emoji}
                  </span>
                  <span>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        marginBottom: 2,
                      }}
                    >
                      {r.label}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "rgba(139,169,209,0.85)",
                        lineHeight: 1.45,
                      }}
                    >
                      {r.blurb}
                    </div>
                  </span>
                </label>
              );
            })}
          </div>

          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(139,169,209,0.85)",
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            {strings.note_label}
          </div>
          <textarea
            name="note"
            rows={3}
            maxLength={2000}
            placeholder={strings.note_placeholder}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(139,169,209,0.24)",
              color: "#F4F7FC",
              fontSize: 13,
              fontFamily: "inherit",
              lineHeight: 1.5,
              resize: "vertical",
              outline: "none",
              marginBottom: 16,
            }}
          />

          <p
            style={{
              margin: "0 0 16px",
              fontSize: 11,
              color: "rgba(139,169,209,0.70)",
              lineHeight: 1.5,
            }}
          >
            {strings.disclaimer}{" "}
            <Link
              href="/nex-native/terms"
              target="_blank"
              rel="noopener"
              style={{ color: "#00AFFF", textDecoration: "underline" }}
            >
              /terms
            </Link>
          </p>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(139,169,209,0.08)",
                border: "1px solid rgba(139,169,209,0.24)",
                color: "rgba(244,247,252,0.85)",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {strings.cancel}
            </button>
            <button
              type="submit"
              disabled={!selectedReason}
              style={{
                flex: 2,
                padding: "12px 14px",
                borderRadius: 12,
                background: selectedReason
                  ? "linear-gradient(180deg, #FF5A70 0%, #FF3355 100%)"
                  : "rgba(255,51,85,0.15)",
                border: selectedReason
                  ? "1px solid rgba(255,51,85,0.55)"
                  : "1px solid rgba(255,51,85,0.20)",
                color: selectedReason ? "#0B0F1A" : "rgba(244,247,252,0.5)",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: selectedReason ? "pointer" : "not-allowed",
                fontFamily: "inherit",
                boxShadow: selectedReason
                  ? "0 10px 22px rgba(255,51,85,0.42)"
                  : "none",
              }}
            >
              {strings.submit}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

/** Small "Report user" trigger button rendered inside a client-only
 *  wrapper · use inside the peer chat header's 3-dot menu. */
export function ReportUserTrigger({
  onOpen,
  label,
}: {
  onOpen: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: "block",
        width: "100%",
        padding: "10px 12px",
        borderRadius: 10,
        background: "transparent",
        border: "1px solid rgba(255,51,85,0.20)",
        color: "#FFB4C0",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      🚨 {label}
    </button>
  );
}
