"use client";

// ProjectGalleryRow — 3 project cards with orange badge overlays per
// canonical Staircase mockup. Each card is a project photo with badge
// (Before & After · Featured Project · Customer Project).
//
// V1: Uses Unsplash source URLs for placeholder staircase photos.
// Real implementation reads Business Brain project data.

import { ArrowRight } from "lucide-react";
import { useConversationState } from "../state/ConversationStateProvider";

const PROJECTS = [
  {
    id: "before-after",
    badge: "Before & After",
    imageUrl: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&q=80",
    swipeIndicator: true
  },
  {
    id: "featured",
    badge: "Featured Project",
    imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80"
  },
  {
    id: "customer",
    badge: "Customer Project",
    imageUrl: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&q=80"
  }
];

export function ProjectGalleryRow() {
  const { transitionTo, config } = useConversationState();
  if (config.trade_slug !== "staircase") return null;

  return (
    <section className="mt-5 mb-3">
      <header className="mx-5 mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-bold" style={{ color: "var(--nex-neutral-900)" }}>
          Project Gallery
        </h3>
        <button
          type="button"
          className="flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold"
          style={{ color: "var(--nex-accent-500)" }}
        >
          View All <ArrowRight size={12} strokeWidth={2.25} />
        </button>
      </header>

      <div className="scrollbar-none flex gap-3 overflow-x-auto px-5 pb-2">
        {PROJECTS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() =>
              transitionTo("discover", {
                payload:      { variant: "gallery", items: [p.id] },
                nexNarration: `Here's the ${p.badge.toLowerCase()} — want me to show you the full gallery or shortlist similar work?`
              })
            }
            className="relative flex-none overflow-hidden rounded-2xl text-left transition-transform active:scale-[0.98]"
            style={{
              width: 140,
              height: 180,
              boxShadow: "var(--nex-shadow-sm)"
            }}
            aria-label={p.badge}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.imageUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <span
              className="absolute left-2 top-2 rounded-md px-2 py-1 text-[10px] font-bold text-white"
              style={{ background: "var(--nex-accent-500)" }}
            >
              {p.badge}
            </span>
            {p.swipeIndicator && (
              <span
                className="absolute bottom-3 left-1/2 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full"
                style={{ background: "var(--nex-neutral-0)", color: "var(--nex-accent-500)", boxShadow: "var(--nex-shadow-sm)" }}
                aria-hidden
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 7l-4 5 4 5" />
                  <path d="M16 7l4 5-4 5" />
                </svg>
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
