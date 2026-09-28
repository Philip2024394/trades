"use client";

// src/app/nex-native/chat/peer/[accountId]/_safe-trade-consent-modal.tsx
//
// Bridge 16b · JIT consent modal for the safe-trade doctrine.
// -----------------------------------------------------------
// Fires when the buyer opens a commerce chat (peer owns a business)
// for the FIRST time and hasn't yet acknowledged the current terms
// version. Blocks the surface behind a portal-rendered modal · user
// must tick + submit to continue. Submission fires
// acknowledgeSafeTradeAction which stamps
// nex_account.safe_trade_consent_at + version.
//
// Design goals:
//   · Cannot be dismissed without acknowledgement · this is the
//     legal waiver moment (see /nex-native/terms section 3).
//   · Full-screen scrim so the underlying chat surface is
//     unreachable · escapes the shell's stacking context via
//     createPortal to document.body.
//   · Terms + safe-trade links open in a new tab so reading them
//     doesn't leave the modal.
//   · One tick box + one submit button · that's it.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { SafeTradeStrings } from "@/lib/nex-native/i18n/safe-trade-strings";

export function SafeTradeConsentModal({
  action,
  nextHref,
  termsVersion,
  strings,
}: {
  /** Bound Server Action · acknowledgeSafeTradeAction. */
  action: (formData: FormData) => Promise<never> | void;
  /** Where to send the user after acknowledgement. Usually the
   *  current chat URL so they land back where they were. */
  nextHref: string;
  /** Current terms version · shown in the modal footer. */
  termsVersion: string;
  /** Locale-aware copy · resolved server-side by resolveLocale(). */
  strings: SafeTradeStrings;
}) {
  const [mounted, setMounted] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => setMounted(true), []);

  // Lock body scroll while the modal is up.
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nex-safe-trade-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "rgba(2,9,20,0.86)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          maxHeight: "90dvh",
          overflowY: "auto",
          background: "#050f1e",
          border: "1px solid rgba(22,214,107,0.35)",
          borderRadius: 18,
          padding: "28px 24px 22px",
          color: "#F4F7FC",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          boxShadow:
            "0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(22,214,107,0.10)",
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "#16D66B",
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          {strings.modal_eyebrow}
        </div>

        <h2
          id="nex-safe-trade-title"
          style={{
            margin: 0,
            fontFamily:
              "'Cormorant Garamond', 'EB Garamond', Georgia, serif",
            fontSize: 30,
            lineHeight: 1.15,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            marginBottom: 12,
          }}
        >
          {strings.modal_title}
        </h2>

        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.65,
            color: "rgba(244,247,252,0.88)",
            marginBottom: 14,
          }}
          dangerouslySetInnerHTML={{
            __html: `${strings.modal_lede} <b>${strings.modal_paths_short}</b>.`,
          }}
        />

        <div
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            background: "rgba(255,51,85,0.08)",
            border: "1px solid rgba(255,51,85,0.35)",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#FF7A85",
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            {strings.modal_warning_eyebrow}
          </div>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: "rgba(244,247,252,0.9)",
            }}
            dangerouslySetInnerHTML={{ __html: strings.modal_warning_body }}
          />
        </div>

        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.6,
            color: "rgba(139,169,209,0.90)",
            marginBottom: 22,
          }}
        >
          {strings.modal_read_terms}{" "}
          <Link
            href="/nex-native/terms"
            target="_blank"
            rel="noopener"
            style={{
              color: "#00AFFF",
              textDecoration: "underline",
              textDecorationColor: "rgba(0,175,255,0.5)",
              textUnderlineOffset: 3,
            }}
          >
            /nex-native/terms
          </Link>
          {" · "}
          <Link
            href="/nex-native/safe-trade"
            target="_blank"
            rel="noopener"
            style={{
              color: "#00AFFF",
              textDecoration: "underline",
              textDecorationColor: "rgba(0,175,255,0.5)",
              textUnderlineOffset: 3,
            }}
          >
            {strings.modal_safe_trade_link}
          </Link>
        </p>

        <form
          action={action}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <input type="hidden" name="next" value={nextHref} />

          <label
            style={{
              display: "grid",
              gridTemplateColumns: "22px 1fr",
              gap: 10,
              alignItems: "start",
              padding: "12px 14px",
              borderRadius: 12,
              background: checked
                ? "rgba(22,214,107,0.10)"
                : "rgba(139,169,209,0.06)",
              border: checked
                ? "1px solid rgba(22,214,107,0.35)"
                : "1px solid rgba(139,169,209,0.24)",
              cursor: "pointer",
              userSelect: "none",
              transition: "background 120ms, border-color 120ms",
            }}
          >
            <input
              type="checkbox"
              required
              checked={checked}
              onChange={(e) => setChecked(e.currentTarget.checked)}
              style={{
                width: 18,
                height: 18,
                marginTop: 2,
                accentColor: "#16D66B",
              }}
            />
            <span
              style={{
                fontSize: 13,
                lineHeight: 1.55,
                color: "rgba(244,247,252,0.92)",
              }}
            >
              {strings.modal_checkbox_label}
            </span>
          </label>

          <button
            type="submit"
            disabled={!checked}
            style={{
              padding: "14px 18px",
              borderRadius: 12,
              background: checked
                ? "linear-gradient(180deg, #22E37A 0%, #16D66B 100%)"
                : "rgba(139,169,209,0.16)",
              border: checked
                ? "1px solid rgba(22,214,107,0.55)"
                : "1px solid rgba(139,169,209,0.24)",
              color: checked ? "#0B0F1A" : "rgba(244,247,252,0.5)",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: checked ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              boxShadow: checked
                ? "0 12px 30px rgba(22,214,107,0.35), inset 0 1px 0 rgba(255,255,255,0.28)"
                : "none",
            }}
          >
            {strings.modal_submit}
          </button>
        </form>

        <div
          style={{
            marginTop: 18,
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "rgba(139,169,209,0.55)",
            textAlign: "center",
          }}
        >
          {strings.modal_version_prefix} {termsVersion}
        </div>
      </div>
    </div>,
    document.body,
  );
}
