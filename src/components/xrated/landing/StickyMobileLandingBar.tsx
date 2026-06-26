"use client";

// Xrated Trades — sticky mobile bottom action bar.
// Mobile-only (`md:hidden`), 56px tall, two equal-width CTAs. Auto-hides
// when the page footer scrolls into view to stop covering the contact /
// legal links. Uses IntersectionObserver on the element with id="xrated-footer".

import { useEffect, useState } from "react";

export function StickyMobileLandingBar() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // The XratedFooter exposes a wrapper we can observe. Fall back to
    // observing the document end if no marker is present.
    const target =
      document.getElementById("xrated-footer") ??
      document.querySelector("footer");
    if (!target) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          setHidden(e.isIntersecting);
        }
      },
      { rootMargin: "0px 0px 0px 0px", threshold: 0.05 }
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  return (
    <div
      aria-hidden={hidden}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur md:hidden ${
        hidden ? "pointer-events-none translate-y-full" : "translate-y-0"
      } transition-transform duration-300`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-6xl items-stretch gap-2 px-3 py-2">
        {/* Reframed after the pivot to app-for-tradies: secondary link
            opens the pricing page, primary CTA starts the free trial. */}
        <a
          href="/trade-off/pricing"
          className="inline-flex h-14 flex-1 items-center justify-center rounded-xl border border-neutral-300 bg-white px-3 text-xs font-bold text-neutral-900 transition active:scale-[0.98]"
        >
          See pricing
        </a>
        <a
          href="/trade-off/signup"
          className="inline-flex h-14 flex-1 items-center justify-center rounded-xl bg-[#FFB300] px-3 text-xs font-extrabold text-neutral-900 shadow-lg transition active:scale-[0.98]"
        >
          Start free trial
        </a>
      </div>
    </div>
  );
}

export default StickyMobileLandingBar;
