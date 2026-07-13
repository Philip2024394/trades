"use client";

// TradeInTheBox — trades-themed port of Hammerex's InTheBox.
//
// Bento grid of everything included in the delivery. Reads from the
// per-product hammerex_xrated_what_in_box table. Each tile can be
// tapped to enlarge (lightbox modal). Single-item lists render as one
// centred larger tile; multi-item lists render as a 5-up grid on
// desktop, 2/3-up on smaller viewports.
//
// The optional overlayImage prop (used sparingly on Hammerex for
// hero-item layering) is preserved but rarely useful for trades who
// sell straightforward SKUs — leave undefined and it does nothing.

import { useEffect, useState } from "react";
import type { HammerexXratedWhatInBox } from "@/lib/supabase";

export function TradeInTheBox({
  items,
  fallbackImage,
  overlayImage,
  title = "In the delivery",
  subtitle = "Everything that arrives with your order."
}: {
  items: HammerexXratedWhatInBox[];
  fallbackImage?: string | null;
  overlayImage?: string | null;
  title?: string;
  subtitle?: string;
}) {
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(null);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [zoom]);

  if (items.length === 0) return null;

  const single = items.length === 1;

  return (
    <section
      id="in-the-box"
      className="border-t border-[#1B1A17]/10 bg-[#FBF6EC] py-10"
    >
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-6">
          <h2 className="text-[18px] font-black text-[#1B1A17] md:text-[22px]">
            {title}
          </h2>
          <p className="mt-1 text-[12.5px] text-[#1B1A17]/60">{subtitle}</p>
        </div>
        <ul
          className={
            single
              ? "mx-auto flex max-w-md flex-col"
              : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
          }
        >
          {items.map((b, idx) => {
            const src = b.image_url ?? fallbackImage ?? null;
            const showOverlay = single && idx === 0 && !!overlayImage;
            return (
              <li
                key={b.id}
                className="overflow-hidden rounded-2xl border border-[#1B1A17]/10 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() =>
                    src && setZoom({ src: overlayImage || src, alt: b.label })
                  }
                  aria-label={`Enlarge ${b.label}`}
                  disabled={!src}
                  className="relative block aspect-square w-full overflow-hidden bg-neutral-50 disabled:cursor-default"
                >
                  {src && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={src}
                      alt={b.label}
                      className="h-full w-full object-contain p-2"
                      loading="lazy"
                    />
                  )}
                  {showOverlay && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={overlayImage!}
                      alt=""
                      aria-hidden
                      className="pointer-events-none absolute inset-y-2 right-2 block w-[56%] translate-y-[170px] object-contain object-right drop-shadow-[0_18px_30px_rgba(0,0,0,0.55)]"
                    />
                  )}
                  {src && (
                    <span
                      aria-hidden
                      className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-amber-400 text-[#0A0A0A] shadow-[0_1px_6px_rgba(0,0,0,0.15)]"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="11" cy="11" r="7" />
                        <line x1="21" y1="21" x2="16.5" y2="16.5" />
                      </svg>
                    </span>
                  )}
                </button>
                <div
                  className={
                    single
                      ? "p-4 text-center"
                      : "flex items-center justify-between gap-2 p-3"
                  }
                >
                  <span
                    className={
                      single
                        ? "text-[14px] font-black text-[#1B1A17]"
                        : "text-[12.5px] font-black text-[#1B1A17]"
                    }
                  >
                    {b.label}
                  </span>
                  {!single && b.qty > 1 && (
                    <span className="text-[11.5px] font-semibold text-[#1B1A17]/55 tabular-nums">
                      × {b.qty}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={zoom.alt}
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoom.src}
            alt={zoom.alt}
            onClick={(e) => e.stopPropagation()}
            className="block max-h-[88vh] max-w-full rounded-xl object-contain"
            style={{ touchAction: "pinch-zoom" }}
          />
          <button
            type="button"
            onClick={() => setZoom(null)}
            aria-label="Close"
            className="fixed right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-amber-400 text-[#0A0A0A] shadow-[0_2px_10px_rgba(255,179,0,0.4)] transition active:scale-95 hover:brightness-95"
          >
            ×
          </button>
        </div>
      )}
    </section>
  );
}
