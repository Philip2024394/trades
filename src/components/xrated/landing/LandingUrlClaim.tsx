"use client";

// Hero URL-claim widget — the visitor types the slug they want for
// their xratedtrade.com/<slug> URL, then clicks Start free trial.
// We slugify live (lowercase, hyphen-separated, no funky characters)
// so the user always sees a valid preview, and we navigate to the
// signup page with the slug pre-populated.

import { useState } from "react";
import { slugifyXrated, validateXratedSlug, SLUG_MAX_LENGTH } from "@/lib/xratedSlug";

export function LandingUrlClaim() {
  const [raw, setRaw] = useState("");
  const slug = slugifyXrated(raw);
  const placeholder = "your-name";
  // We only show the validation error after the visitor has typed
  // something — empty state stays clean for first-render polish.
  const error = raw.length > 0 ? validateXratedSlug(slug) : null;

  function go() {
    const target = slug
      ? `/trade-off/signup?slug=${encodeURIComponent(slug)}`
      : "/trade-off/signup";
    window.location.href = target;
  }

  return (
    <div className="w-full max-w-xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
        className="flex items-stretch overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-black/10 focus-within:ring-2 focus-within:ring-[#FFB300]"
      >
        {/* Domain prefix — visible on tablet+; on mobile we save the
            space and surface the full URL in the preview line below. */}
        <span className="hidden select-none items-center bg-neutral-50 pl-3 pr-1 text-xs font-bold text-neutral-500 sm:flex sm:text-sm">
          xratedtrade.com/
        </span>
        <input
          type="text"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={placeholder}
          aria-label="Choose your profile URL"
          inputMode="text"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={SLUG_MAX_LENGTH}
          className="h-14 flex-1 bg-white px-3.5 text-base font-bold text-neutral-900 placeholder:text-neutral-400 focus:outline-none sm:h-12 sm:text-base"
        />
        <button
          type="submit"
          className="inline-flex h-14 shrink-0 items-center gap-1 px-4 text-xs font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.97] sm:h-12 sm:px-5 sm:text-sm"
          style={{ background: "#FFB300" }}
        >
          <span className="hidden sm:inline">Start free trial</span>
          <span className="sm:hidden">Claim</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </form>

      {/* URL preview — own line so it never breaks the form layout on
          tight mobile widths. Also doubles as the only place mobile sees
          the full xratedtrade.com domain (the prefix is hidden in the
          input on mobile to give the typed slug more room). */}
      <p className="mt-2.5 break-all rounded-md bg-black/40 px-3 py-1.5 font-mono text-[13px] text-white shadow-sm sm:text-sm">
        xratedtrade.com/<span style={{ color: "#FFB300" }}>{slug || placeholder}</span>
      </p>
      {error && (
        <p
          className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-red-500/15 px-2 py-1 text-xs font-semibold text-red-100 ring-1 ring-red-400/40"
          role="alert"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12" y2="16" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
