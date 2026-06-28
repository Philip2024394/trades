"use client";

// Live preview iframe — sits beside AppStudioPanel on desktop and
// refreshes itself the instant the panel's auto-save lands. Buyers
// see exactly what we render; the tradesperson sees exactly what
// buyers see, while they're editing.
//
// Refresh contract: AppStudioPanel dispatches `appstudio:saved` on
// every successful PATCH. This component listens, bumps a revision
// counter, and the iframe's src changes (cache-buster query param)
// so Next re-fetches the latest server-rendered profile.
//
// Hidden on mobile / tablet because a useful iframe needs at least
// 380px and a side-by-side dashboard breaks below the lg breakpoint.
// On mobile the same listing is one tap away via the "View live"
// button in the sticky save bar.

import { useEffect, useState } from "react";

export function LivePreviewIframe({ slug }: { slug: string }) {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const onSaved = () => setRevision((r) => r + 1);
    window.addEventListener("appstudio:saved", onSaved);
    return () => window.removeEventListener("appstudio:saved", onSaved);
  }, []);

  // Cache-buster query param on every save. The initial load skips the
  // query so search engines and dev-tools requests stay clean. Next.js
  // re-renders the page server-side because `revalidate = 300` doesn't
  // cache POST mutations — a fresh GET with a new query string forces
  // the render path.
  const src = revision === 0 ? `/${slug}` : `/${slug}?_studio=${revision}`;

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-6">
        <header className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p
              className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: "var(--trade-accent, #FFB300)" }}
            >
              Live preview
            </p>
            <p className="mt-0.5 text-[12px] text-neutral-500">
              Refreshes the moment your edits save.
            </p>
          </div>
          <a
            href={`/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-[12px] font-bold text-neutral-900 transition hover:border-neutral-400"
          >
            Open in tab
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </header>
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-md">
          <iframe
            src={src}
            title={`Live preview of ${slug}`}
            className="block h-[78vh] max-h-[900px] w-full"
            loading="lazy"
            // We deliberately allow same-origin so styling / fonts work;
            // we never run untrusted code in here (own listing only).
          />
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
          This is the page your customers see. Every save here ships
          straight to the live URL — no publish step.
        </p>
      </div>
    </aside>
  );
}
