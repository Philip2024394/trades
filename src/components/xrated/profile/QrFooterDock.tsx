"use client";

// Xrated Trades — sticky footer dock above the global XratedFooter.
// LEFT: QR thumbnail (~64px) — click to open a centered lightbox at ~360px.
// RIGHT: big orange "Contact" WhatsApp button.
// ESC closes the lightbox. Pure client component (lightbox state only).

import { useEffect, useState } from "react";
import { XRATED_BRAND } from "@/lib/xratedTrades";

export function QrFooterDock({
  qrPngUrl,
  whatsappHref,
  themeColor
}: {
  qrPngUrl: string;
  whatsappHref: string;
  themeColor: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    // Prevent scrolling underneath when lightbox is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Sticky dock — sits above the global XratedFooter. The older
          TradeMobileActionBar is suppressed on premium tier, so no
          mb-[64px] spacer is needed here. */}
      <div
        data-qr-dock
        className="sticky bottom-0 z-30 mt-8 border-t border-brand-line bg-brand-bg/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Show profile QR code"
            data-qr-thumb
            className="group inline-flex items-center gap-2 rounded-xl border border-brand-line bg-white p-1.5 transition hover:border-brand-accent"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrPngUrl}
              alt="Profile QR code"
              width={56}
              height={56}
              className="block h-14 w-14"
            />
            <span className="hidden pr-2 text-[11px] font-bold uppercase tracking-widest text-brand-text/80 group-hover:text-brand-accent sm:inline-block">
              Tap to enlarge
            </span>
          </button>

          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-[13px] font-bold transition active:scale-[0.98]"
            style={{ background: themeColor, color: "#000" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Zm-7.05 15.4a8.36 8.36 0 0 1-4.27-1.17l-.3-.18-3.34.87.89-3.26-.2-.33A8.32 8.32 0 1 1 12 20.31Z" />
            </svg>
            Contact
          </a>
        </div>
      </div>

      {open && (
        <div
          data-qr-lightbox-open
          role="dialog"
          aria-modal="true"
          aria-label="Profile QR code"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/10 text-black hover:bg-black/20"
            >
              ×
            </button>
            {/* QR — kept clean (no centre overlay so scanners aren't slowed
                by additional masking). Xrated trademark sits below the
                code as the small attribution mark. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrPngUrl}
              alt="Profile QR code"
              width={360}
              height={360}
              className="mx-auto block h-[300px] w-[300px] sm:h-[360px] sm:w-[360px]"
            />
            <div className="mt-3 flex items-center justify-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={XRATED_BRAND.logoUrl}
                alt={XRATED_BRAND.name}
                width={20}
                height={20}
                className="h-5 w-auto object-contain"
              />
              <span className="text-[11px] font-bold uppercase tracking-widest text-black/60">
                {XRATED_BRAND.name}
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold text-black">
                Scan to open this profile
              </p>
              <a
                href={`${qrPngUrl}?download=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center justify-center gap-1 rounded-lg px-4 text-[13px] font-bold"
                style={{ background: themeColor, color: "#000" }}
              >
                Save
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default QrFooterDock;
