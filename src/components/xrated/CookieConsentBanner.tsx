"use client";

// Cookie consent · UK PECR / GDPR compliance surface.
//
// v2 (Philip 2026-08-14): the banner now slides in from the RIGHT as a
// compact card with a single Accept button, instead of the previous
// full-width bottom bar with two options. Rationale: the fullbar was
// dominating premium-template previews and creating a competing focal
// point at the bottom of every page. The right-side slide-in respects
// the composition and disappears the moment the visitor accepts.
//
// Choice is stored in a first-party cookie (`xrated_cookie_consent`)
// with a 90-day expiry, so no third-party SDK is involved. "Manage"
// link routes to /legal/cookies for finer-grained control (retains
// PECR/GDPR compliance surface even though the primary CTA is single-
// action).

import { useEffect, useState } from "react";

const COOKIE_NAME = "xrated_cookie_consent";
const COOKIE_MAX_AGE_DAYS = 90;

function hasConsentCookie(): boolean {
  if (typeof document === "undefined") return true;
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith(`${COOKIE_NAME}=`));
}

function setConsentCookie(value: "all" | "essential") {
  if (typeof document === "undefined") return;
  const maxAgeSeconds = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

export function CookieConsentBanner() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!hasConsentCookie()) {
      // Delay 1 frame so the "slide-in" transition has a starting state
      // to animate from.
      requestAnimationFrame(() => setVisible(true));
    }
  }, []);

  if (!mounted) return null;
  if (!visible && hasConsentCookie()) return null;

  function accept() {
    setConsentCookie("all");
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: 60,
        maxWidth: 380,
        width: "calc(100vw - 40px)",
        transform: visible ? "translateX(0)" : "translateX(calc(100% + 20px))",
        opacity: visible ? 1 : 0,
        transition: "transform 320ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms ease-out",
        pointerEvents: visible ? "auto" : "none",
        paddingBottom: "max(env(safe-area-inset-bottom), 0px)"
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E6DFD1",
          borderRadius: 14,
          padding: 18,
          fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
          color: "#3A3428",
          boxShadow: "0 24px 60px -20px rgba(58, 52, 40, 0.25), 0 2px 6px -2px rgba(58, 52, 40, 0.08)"
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div
            aria-hidden
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#F5EBDA",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              color: "#B58F5E"
            }}
          >
            <CookieGlyph />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25 }}>
              We use cookies
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "#6B5F52" }}>
              To keep you signed in, remember your preferences, and understand how the site is used.{" "}
              <a
                href="/legal/cookies"
                onClick={(e) => e.stopPropagation()}
                style={{ color: "#B58F5E", fontWeight: 600, textDecoration: "underline" }}
              >
                Manage
              </a>
              .
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={accept}
          style={{
            marginTop: 14,
            width: "100%",
            padding: "12px 16px",
            background: "#3A3428",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.02em",
            cursor: "pointer"
          }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}

function CookieGlyph() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3a9 9 0 1 0 9 9 4 4 0 0 1-4-4 4 4 0 0 1-4-4 4 4 0 0 1-1-1Z" />
      <circle cx="9" cy="12" r="0.5" />
      <circle cx="13" cy="9" r="0.5" />
      <circle cx="15" cy="14" r="0.5" />
      <circle cx="10" cy="16" r="0.5" />
    </svg>
  );
}
