"use client";

// DiagramCard — premium educational-diagram card for NEX Brain
// responses. Dark charcoal container with thin yellow accent border,
// tap-to-enlarge full-screen modal, numbered labels with descriptions.
//
// Rendered inside AskNex replies whenever a matched Brain entry
// carries a `diagram` payload. Not decorative — supports the answer.

import { useEffect, useState } from "react";
import { X, ZoomIn } from "lucide-react";
import type { Diagram } from "@/lib/nex/knowledge/retrieve";

export function DiagramCard({ diagram }: { diagram: Diagram }) {
  const [enlarged, setEnlarged] = useState(false);

  useEffect(() => {
    if (!enlarged) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setEnlarged(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enlarged]);

  return (
    <>
      <figure
        className="mt-4 overflow-hidden rounded-[18px]"
        style={{
          background: "#0F0F16",
          border: "1px solid rgba(251,191,36,0.24)",
          boxShadow:
            "0 12px 30px -14px rgba(246,138,30,0.35), 0 4px 14px -8px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.04) inset"
        }}
      >
        {/* Image · tap to enlarge */}
        <button
          type="button"
          onClick={() => setEnlarged(true)}
          className="group relative block w-full overflow-hidden"
          style={{ background: "#1A1A24" }}
          aria-label={`Enlarge ${diagram.title ?? "diagram"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={diagram.url}
            alt={diagram.alt ?? diagram.title ?? "Educational diagram"}
            className="w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
            loading="lazy"
          />
          <span
            className="pointer-events-none absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-white opacity-0 transition-opacity group-hover:opacity-100"
            style={{ background: "rgba(0,0,0,0.62)", backdropFilter: "blur(6px)" }}
            aria-hidden
          >
            <ZoomIn size={15} strokeWidth={2} />
          </span>
        </button>

        {/* Caption + labels */}
        <figcaption className="px-4 pt-4 pb-4">
          <div
            className="text-[10px] font-black uppercase tracking-[0.24em]"
            style={{ color: "#FBBF24" }}
          >
            Educational diagram
          </div>
          {diagram.title && (
            <h4 className="mt-1 text-[14px] font-black" style={{ color: "#F5F5FA" }}>
              {diagram.title}
            </h4>
          )}
          {diagram.caption && (
            <p className="mt-1.5 text-[11.5px] leading-[1.5]" style={{ color: "#9797A8" }}>
              {diagram.caption}
            </p>
          )}

          {/* Numbered labels */}
          {diagram.labels && diagram.labels.length > 0 && (
            <ul className="mt-3.5 space-y-2">
              {diagram.labels.map((l) => (
                <li key={l.n} className="flex items-start gap-2.5">
                  <span
                    className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-[10.5px] font-black text-[#141416]"
                    style={{
                      background: "linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)",
                      boxShadow: "0 4px 10px -3px rgba(251,191,36,0.5)"
                    }}
                  >
                    {l.n}
                  </span>
                  <div className="min-w-0 flex-1 text-[11.5px] leading-[1.5]">
                    <span className="font-black" style={{ color: "#F5F5FA" }}>
                      {l.name}
                    </span>
                    <span style={{ color: "#9797A8" }}> — {l.description}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {diagram.footnote && (
            <p
              className="mt-3 border-t pt-3 text-[11px] italic leading-[1.5]"
              style={{ color: "#8888A0", borderColor: "rgba(255,255,255,0.08)" }}
            >
              {diagram.footnote}
            </p>
          )}
        </figcaption>
      </figure>

      {/* Full-screen enlarged view */}
      {enlarged && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={diagram.title ?? "Diagram"}
          onClick={() => setEnlarged(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: "rgba(4, 4, 8, 0.92)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)"
          }}
        >
          <button
            type="button"
            onClick={() => setEnlarged(false)}
            aria-label="Close"
            className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full text-white"
            style={{
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.20)",
              backdropFilter: "blur(6px)"
            }}
          >
            <X size={18} strokeWidth={2} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={diagram.url}
            alt={diagram.alt ?? diagram.title ?? "Educational diagram"}
            className="max-h-full max-w-full rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
