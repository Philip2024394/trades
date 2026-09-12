"use client";

// src/components/nex-app/live/EntityLiveCarousel.tsx
//
// NEX LIVE · Master Experience · Tall Live carousel for an entity
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Master Build
//
// §8 · §9 · §10 · §40 · Portrait/tall 9:16 cards belonging to a
// specific NEX entity. Media dominates. UI minimal.
//
// §11 immutable · this is EXPERIENCE. It must NEVER contain product
// cards. Products belong to a separate <ProductCarousel> on the same
// entity page.
//
// The caller fetches items and hands them in — this component only
// renders. That keeps discovery ranking, capability decisions, and
// evidence discipline in one server-side layer.

import Link from "next/link";
import { useMemo, useRef } from "react";

export type EntityLiveCard = {
  media_id: string;
  title: string | null;
  category: string | null;
  live_status: "LIVE_NOW" | "STARTING_SOON" | "TONIGHT" | "UPCOMING" | "ENDED" | "STALE" | "UNKNOWN";
  status_label: string;
  poster_url: string | null;
  playback_url: string | null;
  duration_hint_min: number | null;
  is_mock_fixture: boolean;
};

export type EntityLiveCarouselProps = {
  entity_name: string;
  cards: ReadonlyArray<EntityLiveCard>;
  /** Where each card navigates when tapped. Defaults to /nex-live?media=<id>. */
  hrefFor?: (card: EntityLiveCard) => string;
  /** Empty-state copy · never fabricated */
  emptyLabel?: string;
};

export function EntityLiveCarousel({ entity_name, cards, hrefFor, emptyLabel }: EntityLiveCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const handleHref = useMemo(
    () => hrefFor ?? ((c: EntityLiveCard) => `/nex-live?media=${encodeURIComponent(c.media_id)}`),
    [hrefFor],
  );

  if (cards.length === 0) {
    return (
      <section
        className="w-full py-4 px-4"
        data-testid="nex-live-entity-carousel-empty"
      >
        <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">
          LIVE FROM {entity_name.toUpperCase()}
        </div>
        <div className="text-sm text-white/50">
          {emptyLabel ?? "No Live from this place right now."}
        </div>
      </section>
    );
  }

  return (
    <section
      className="w-full py-4"
      data-testid="nex-live-entity-carousel"
      data-card-count={cards.length}
    >
      <div className="px-4 mb-3 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-white/50">
          LIVE FROM {entity_name.toUpperCase()}
        </div>
        {cards.length > 3 && (
          <div className="text-[10px] text-white/40">
            {cards.length} sessions
          </div>
        )}
      </div>

      {/* Horizontal scroller · scroll-snap so each 9:16 card centers */}
      <div
        ref={scrollerRef}
        className="flex gap-3 px-4 overflow-x-auto snap-x snap-mandatory pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        {cards.map((card) => {
          const isLiveNow = card.live_status === "LIVE_NOW";
          const isStarting = card.live_status === "STARTING_SOON";
          const isEnded = card.live_status === "ENDED";
          return (
            <Link
              key={card.media_id}
              href={handleHref(card)}
              className="snap-start shrink-0 relative rounded-xl overflow-hidden bg-neutral-900 border border-white/10"
              style={{ width: "168px", height: "300px" }}   // ~9:16 · fits ≥2 on iPhone portrait
              data-testid={`nex-live-entity-card-${card.media_id}`}
              data-live-status={card.live_status}
            >
              {/* Media surface · poster fills · never fabricated */}
              {card.poster_url ? (
                <img
                  src={card.poster_url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-neutral-800 to-neutral-950">
                  <span className="text-white/25 text-5xl select-none">▶</span>
                </div>
              )}

              {/* LIVE / STARTING SOON pill · top-left · calm */}
              {(isLiveNow || isStarting) && (
                <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur px-2 py-0.5">
                  {isLiveNow && (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-red-500"
                      style={{ boxShadow: "0 0 6px rgba(239,68,68,0.9)" }}
                    />
                  )}
                  <span className={`text-[9px] uppercase tracking-wider ${isLiveNow ? "text-red-400" : "text-white/80"}`}>
                    {card.status_label}
                  </span>
                </div>
              )}

              {/* MOCK marker · dev clarity · never hidden */}
              {card.is_mock_fixture && (
                <div className="absolute top-2 right-2 rounded-full bg-black/60 backdrop-blur px-2 py-0.5">
                  <span className="text-[8px] uppercase tracking-wider text-amber-400">Mock</span>
                </div>
              )}

              {/* Bottom overlay · title · calm */}
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/70 to-transparent">
                {card.title && (
                  <div className="text-[13px] font-medium text-white line-clamp-2">
                    {card.title}
                  </div>
                )}
                {card.duration_hint_min !== null && !isEnded && (
                  <div className="text-[10px] text-white/60 mt-1">
                    {isLiveNow ? "LIVE" : card.status_label} · {card.duration_hint_min}m
                  </div>
                )}
                {isEnded && (
                  <div className="text-[10px] text-white/40 mt-1">Ended</div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
