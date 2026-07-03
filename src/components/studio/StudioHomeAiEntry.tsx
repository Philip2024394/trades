"use client";

// StudioHomeAiEntry — the "Describe your app" call-out on Studio home.
//
// A companion to the "Add an App" card. Opens the AI recommender
// modal on click. Kept isolated as its own client boundary so the
// rest of the home page stays a server component.

import { useState } from "react";
import { StudioAppRecommendModal } from "./StudioAppRecommendModal";

const YELLOW = "#FFB300";

export function StudioHomeAiEntry() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative flex w-full overflow-hidden rounded-2xl border-2 border-neutral-200 bg-white text-left text-neutral-900 shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-900 hover:shadow-lg"
      >
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-70 transition group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(circle at 90% 50%, #FFB30022 0%, transparent 65%)"
          }}
        />
        <div className="relative flex w-full flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="min-w-0">
            <p
              className="text-[10px] font-extrabold uppercase tracking-widest"
              style={{ color: YELLOW }}
            >
              Not sure which App? · under 3 min
            </p>
            <h2 className="mt-1 text-[20px] font-extrabold leading-tight sm:text-[22px]">
              Describe your app — we&rsquo;ll find the fit
            </h2>
            <p className="mt-2 max-w-md text-[13px] leading-relaxed text-neutral-600">
              Tell us what you want on your site in plain English. Our AI
              searches every App we&rsquo;ve built and shows the best
              matches. If nothing fits, submit it as a new App idea and
              our team will build it.
            </p>
          </div>
          <span
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl border-2 border-neutral-900 px-5 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition group-hover:bg-neutral-900 group-hover:text-white"
          >
            <span aria-hidden="true">✦</span> Start describing
          </span>
        </div>
      </button>

      {open && (
        <StudioAppRecommendModal onClose={() => setOpen(false)} />
      )}
    </>
  );
}
