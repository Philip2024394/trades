"use client";

// View-card lightbox — opens when a customer taps "View" on a priced
// service card. Yellow-bordered modal showing:
//   - After/Before tabs (Before tab only appears when before_image_url
//     is set on the service)
//   - Big focal image
//   - Service name + description + price
//   - Primary "Enquire on WhatsApp" button (uses the same prefill +
//     navigation as the legacy EnquireButton)
//   - Close button (X top-right, Esc key, backdrop click)
//
// Replaces the inline EnquireButton on paid-tier service cards. Free
// tier doesn't render the card row that calls this — the cards are
// stripped to image + name only.

import { useEffect, useState } from "react";
import type { PricedService } from "./ServicesTabbedGallery";

const ENQUIRY_KEY = "xrated_enquiry_service";

export function ViewCardModal({
  svc,
  slug
}: {
  svc: PricedService;
  slug: string;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"after" | "before">("after");
  const hasBefore = Boolean(svc.before_image_url?.trim());

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function enquire() {
    try {
      sessionStorage.setItem(
        ENQUIRY_KEY,
        JSON.stringify({ name: svc.name, price: svc.price, unit: svc.unit })
      );
    } catch {
      // sessionStorage unavailable (private mode etc.) — navigation
      // still works, prefill just won't apply.
    }
    window.location.href = `/${slug}/contact#contact-panel`;
  }

  const activeImage =
    tab === "before" && svc.before_image_url
      ? svc.before_image_url
      : svc.image_url ?? "";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setTab("after");
        }}
        className="inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.97]"
        style={{ background: "#FFB300" }}
        aria-label={`View ${svc.name}`}
      >
        View
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${svc.name} details`}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 backdrop-blur"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-4 ring-[#FFB300]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button — top-right, ABOVE the tabs */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur-sm transition hover:bg-black sm:right-4 sm:top-4"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Before/After tabs — only render when there's a before image */}
            {hasBefore && (
              <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 pt-3 sm:px-5">
                <TabButton
                  label="After"
                  active={tab === "after"}
                  onClick={() => setTab("after")}
                />
                <TabButton
                  label="Before"
                  active={tab === "before"}
                  onClick={() => setTab("before")}
                />
              </div>
            )}

            {/* Image */}
            {activeImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={activeImage}
                alt={`${svc.name} — ${tab}`}
                className="block w-full bg-neutral-100 object-cover"
                style={{ maxHeight: "55vh", objectPosition: svc.image_position ?? "center" }}
              />
            ) : (
              <div className="flex h-48 items-center justify-center bg-neutral-100 text-xs text-neutral-400">
                No image yet
              </div>
            )}

            {/* Body */}
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5 sm:p-6">
              <div>
                <p className="text-lg font-extrabold leading-tight text-neutral-900 sm:text-xl">
                  {svc.name}
                </p>
                {svc.description && (
                  <p className="mt-2 text-sm leading-relaxed text-neutral-700">
                    {svc.description}
                  </p>
                )}
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold text-neutral-900 sm:text-3xl">
                  £{svc.price.toLocaleString("en-GB")}
                </span>
                <span className="text-xs text-neutral-500 sm:text-sm">
                  {svc.unit}
                </span>
              </div>

              <div className="mt-2 flex flex-col gap-2 border-t border-neutral-100 pt-4 sm:flex-row">
                <button
                  type="button"
                  onClick={enquire}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-extrabold uppercase tracking-wider text-white shadow-lg transition active:scale-[0.98]"
                  style={{ background: "#25D366", boxShadow: "0 8px 22px rgba(37,211,102,0.45)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Z" />
                  </svg>
                  Enquire on WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-12 items-center justify-center rounded-xl border-2 border-neutral-300 bg-white px-5 text-sm font-extrabold uppercase tracking-wider text-neutral-700 transition active:scale-[0.98]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TabButton({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative inline-flex h-10 items-center px-3 text-xs font-extrabold uppercase tracking-wider transition sm:text-sm"
      style={{ color: active ? "#0A0A0A" : "#737373" }}
    >
      {label}
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 -bottom-px h-[3px] rounded-t-full"
          style={{ background: "#FFB300" }}
        />
      )}
    </button>
  );
}
