"use client";

// Cookie consent banner — UK PECR / GDPR compliance surface.
// Fixed at the bottom of every page until the visitor either accepts
// all cookies or selects essential-only. Choice is stored in a
// first-party cookie (`xrated_cookie_consent`) with a 90-day expiry,
// so no third-party SDK is involved.
//
// The banner is rendered from the root layout so it appears on every
// page (marketing, profiles, legal, dashboards). Hidden by default to
// avoid hydration mismatch — flipped on once a client-side effect
// confirms the cookie is missing.

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
  // Render nothing on the server; the client-side effect decides
  // whether to surface the banner. This avoids a flash for visitors
  // who have already chosen and keeps SSR HTML stable.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasConsentCookie()) setVisible(true);
  }, []);

  if (!visible) return null;

  function accept(value: "all" | "essential") {
    setConsentCookie(value);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-white/10 bg-black/95 backdrop-blur"
      style={{
        // Respect iOS safe-area so the banner clears the home indicator.
        paddingBottom: "max(env(safe-area-inset-bottom), 0px)"
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:py-4">
        <p className="text-[13px] leading-relaxed text-white/85 sm:flex-1">
          We use cookies to keep you signed in, remember your preferences,
          and understand how the site is used. Read our{" "}
          <a
            href="/legal/privacy"
            className="font-semibold underline hover:text-white"
            style={{ color: "#FFB300" }}
          >
            Privacy Policy
          </a>
          .
        </p>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => accept("essential")}
            className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-lg border border-white/25 bg-transparent px-4 text-[13px] font-bold text-white transition hover:bg-white/10 sm:h-10 sm:min-h-0"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => accept("all")}
            className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-lg px-4 text-[13px] font-extrabold text-black transition active:scale-[0.98] sm:h-10 sm:min-h-0"
            style={{ background: "#FFB300" }}
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
