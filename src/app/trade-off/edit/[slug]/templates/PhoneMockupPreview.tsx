"use client";

// PhoneMockupPreview — live preview of the merchant's canteen inside
// an iPhone frame, right-column companion to ThemeControls. iframes
// the canteen at ?embed=1 (so GlobalHeader + duplicate chrome
// suppress) and reloads whenever `refreshTick` bumps — the parent
// bumps it after every save in ThemeControls so the phone reflects
// the change within ~1s.
//
// Chassis + scale pattern mirrors CanteenMobileAppShowcase — 390px
// iframe viewport (real iPhone width) scaled to 0.55 so the phone
// slots into the picker sidebar without dominating.

import { useEffect, useRef } from "react";

const IFRAME_SCALE = 0.55;

export function PhoneMockupPreview({
  slug,
  refreshTick
}: {
  slug: string;
  /** Bumped externally after each theme save; forces iframe remount
   *  by feeding a new key + cache-buster query. */
  refreshTick: number;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => {
    // Also try soft-reload via .contentWindow so we don't tear down
    // the whole iframe if key remount is slow.
    try {
      iframeRef.current?.contentWindow?.location.reload();
    } catch { /* cross-origin edge; key remount handles it */ }
  }, [refreshTick]);

  const src = `/trade-off/yard/canteens/${encodeURIComponent(slug)}?embed=1&_t=${refreshTick}`;

  return (
    <div className="sticky top-4 flex flex-col items-center gap-3">
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
        Live preview
      </div>
      {/* Phone chassis — dark rounded frame with a notch. Aspect-
          ratio matches iPhone 15 (9:19.5). Screen fills the interior
          with a scaled iframe. */}
      <div
        className="relative w-full max-w-[280px] overflow-hidden rounded-[36px] border-[4px] border-neutral-900 bg-neutral-950 shadow-2xl"
        style={{
          aspectRatio: "9 / 19.5",
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset"
        }}
      >
        {/* Notch approximation */}
        <div
          aria-hidden
          className="absolute left-1/2 top-2 z-30 h-4 w-16 -translate-x-1/2 rounded-full bg-black"
        />
        {/* Screen — scaled iframe wrapper */}
        <div
          className="absolute inset-0 overflow-hidden bg-white"
          style={{ borderRadius: "32px", isolation: "isolate" }}
        >
          <div
            style={{
              transform:       `scale(${IFRAME_SCALE})`,
              transformOrigin: "top left",
              width:           `${100 / IFRAME_SCALE}%`,
              height:          `${100 / IFRAME_SCALE}%`,
              overflow:        "hidden",
              willChange:      "transform"
            }}
          >
            <iframe
              key={refreshTick}
              ref={iframeRef}
              src={src}
              title="Live canteen preview"
              sandbox="allow-scripts allow-same-origin"
              loading="lazy"
              className="h-full w-full"
              style={{ border: "none", background: "#FBF6EC" }}
            />
          </div>
        </div>
      </div>
      <p className="max-w-[260px] text-center text-[10.5px] leading-snug text-neutral-500">
        Auto-refreshes on every change. Open the canteen full-screen with the <b>View app</b> button above.
      </p>
    </div>
  );
}
