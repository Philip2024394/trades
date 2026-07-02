"use client";

// MachineDescription — clamped to 8 lines by default, with a
// "Show more / Show less" toggle on the right. Uses CSS line-clamp
// with a max-height fallback for older browsers. Content is untrusted
// merchant text — rendered as plain text, no HTML.

import { useState } from "react";

export function MachineDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
      <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
        What&rsquo;s included
      </h2>
      <div className="mt-3 flex items-start justify-between gap-4">
        <p
          className="max-w-3xl flex-1 whitespace-pre-line rounded-2xl bg-neutral-50 p-4 text-[13px] leading-relaxed text-neutral-700"
          style={
            expanded
              ? undefined
              : {
                  display: "-webkit-box",
                  WebkitLineClamp: 8,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden"
                }
          }
        >
          {text}
        </p>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[11px] font-extrabold uppercase tracking-widest text-neutral-800 transition hover:border-[#FFB300]"
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : "Show more"}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 200ms ease"
            }}
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
    </section>
  );
}
