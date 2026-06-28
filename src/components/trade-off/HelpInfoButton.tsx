"use client";

// Small "(i)" icon next to a form-field label that opens a centred
// popup with the long-form explanation. Replaces inline helper-text
// paragraphs so the form reads tight — non-technical tradies who
// want detail can tap; everyone else gets a calm form.
//
// Same modal shape as ProductShareButton + BusinessCardButton — white
// rounded card, click-outside to close, ESC to close, focus trap on
// the close button.

import { useEffect, useRef, useState } from "react";

export function HelpInfoButton({
  title,
  body
}: {
  /** Section / field name the popup explains. */
  title: string;
  /** Plain-language paragraph. Can include line breaks (rendered as
   *  <br />) for short bullet lists. */
  body: string;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`What does "${title}" do?`}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-200 bg-white text-[11px] font-extrabold text-neutral-500 transition hover:border-neutral-400 hover:text-neutral-900"
        style={{ verticalAlign: "middle" }}
      >
        i
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[120] grid place-items-center bg-black/60 p-4 backdrop-blur"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
                  style={{ color: "var(--trade-accent, #FFB300)" }}
                >
                  What this does
                </p>
                <h2 className="mt-0.5 text-base font-extrabold text-neutral-900">
                  {title}
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900"
              >
                ×
              </button>
            </div>
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-neutral-700">
              {body}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
