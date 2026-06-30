"use client";

// Xrated Trades — About column header + bio.
//
// Renders the About Us heading with a yellow "Services" button on the
// right. The bio is line-clamped to 8 lines; if the content actually
// overflows the clamp, a yellow "Read more" toggle appears. The toggle
// is detected at runtime by comparing scrollHeight to clientHeight on
// the clamped node — so short bios render with no toggle.
//
// Bio paragraphs split only on a BLANK line so a tradesperson's
// continuous prose stays one paragraph unless they deliberately add a
// blank-line break.

import { useEffect, useRef, useState } from "react";

export function AboutFlipPanel({
  bioParas,
  defaultBio,
  slug
}: {
  bioParas: string[];
  defaultBio: string;
  slug: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = bodyRef.current;
    if (!node) return;
    if (!expanded) {
      setOverflows(node.scrollHeight - node.clientHeight > 1);
    }
  }, [expanded, bioParas]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          About Us
        </h2>
        <a
          href={`/trade/${slug}/services`}
          className="inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.97]"
          style={{ background: "#FFB300" }}
        >
          {/* Folded-map icon — signals "delivery zones, see the map" */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          Delivery Zones
        </a>
      </div>

      <div
        ref={bodyRef}
        className={`mt-3 ${expanded ? "" : "line-clamp-8"}`}
      >
        {bioParas.length === 0 ? (
          <p className="text-justify text-[15px] leading-[1.55] text-neutral-700">
            {defaultBio}
          </p>
        ) : (
          bioParas.map((p, i) => (
            <p
              key={i}
              className={`text-justify text-[15px] leading-[1.55] text-neutral-700 ${i === 0 ? "" : "mt-1.5"}`}
            >
              {p}
            </p>
          ))
        )}
      </div>

      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 inline-flex h-11 items-center gap-1 text-[13px] font-extrabold underline-offset-4 hover:underline"
          style={{ color: "#FFB300" }}
          aria-expanded={expanded}
        >
          {expanded ? "Read less" : "Read more"}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}
