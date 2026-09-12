// src/components/nex-app/shell/WorldCardsInline.tsx
//
// Universal Discovery Slice · WorldCardsInline
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE
//
// LAYOUT (§2 of AUTHORIZE)
//   Landscape · IMAGE on LEFT · information on RIGHT. Stack of full-width
//   cards (one per row) · scroll vertically inside the chat stream ·
//   ordinal badges anchor "the second one" references. Compact enough for
//   a phone viewport. Never fabricates · missing fields render as pills.
//
// PREVIOUS SHAPE (deprecated by this slice)
//   Horizontal scroll strip of image-top vertical cards. That shape is
//   preserved in git history; this slice REPLACES it with the AUTHORIZE-
//   mandated image-LEFT landscape layout.
//
// COMPATIBILITY
//   Same props signature (`cards`, `onCardTap`). Same test-ids
//   (`world-cards-inline`, `world-card`, `world-card-ordinal`) so the
//   existing ChatSurface + FriendChatSurface + Playwright fixtures all
//   continue to work unchanged.

"use client";

import { Star, MapPin, ChevronRight } from "lucide-react";
import type { ChatArtifactWorldCard } from "./chat-artifacts";

export function WorldCardsInline({
  cards,
  onCardTap,
}: {
  cards: readonly ChatArtifactWorldCard[];
  onCardTap?: (refId: string | undefined, name: string, index: number) => void;
}) {
  if (cards.length === 0) return null;
  return (
    <div
      className="mt-2 flex flex-col gap-2"
      data-testid="world-cards-inline"
      data-card-count={cards.length}
    >
      {cards.map((card, i) => {
        const ordinal = i + 1;
        return (
          <button
            key={card.refId ?? `${card.name}-${i}`}
            type="button"
            onClick={() => onCardTap?.(card.refId, card.name, ordinal)}
            className="relative flex w-full items-stretch overflow-hidden rounded-2xl border text-left transition-shadow active:shadow-md"
            style={{
              background:      "var(--nex-cream, #FDFCF9)",
              borderColor:     "var(--nex-neutral-200, #e5e5e5)",
              boxShadow:       "0 1px 2px rgba(17,17,17,0.04)",
              minHeight:       "96px",
            }}
            data-testid="world-card"
            data-ordinal={ordinal}
            data-ref-id={card.refId ?? ""}
            aria-label={`Result ${ordinal}: ${card.name}`}
          >
            {/* LEFT · image + ordinal badge · fixed square area */}
            <div className="relative flex-shrink-0" style={{ width: "112px" }}>
              {card.imageUrl ? (
                <div
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${JSON.stringify(card.imageUrl)})` }}
                  aria-hidden
                />
              ) : (
                <div
                  className="h-full w-full"
                  style={{
                    background: "linear-gradient(135deg, rgba(249,115,22,0.10) 0%, rgba(249,115,22,0.02) 100%)",
                  }}
                  aria-hidden
                />
              )}
              <div
                className="absolute left-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ background: "rgba(17,17,17,0.72)", backdropFilter: "blur(6px)" }}
                aria-hidden
                data-testid="world-card-ordinal"
              >
                {ordinal}
              </div>
            </div>

            {/* RIGHT · information column */}
            <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-[15px] font-semibold leading-tight"
                      style={{ color: "var(--nex-neutral-900, #111)" }}
                    >
                      {card.name}
                    </div>
                    {card.category && (
                      <div
                        className="mt-0.5 truncate text-[11px] uppercase tracking-wide"
                        style={{ color: "var(--nex-neutral-500, #666)" }}
                      >
                        {card.category}
                      </div>
                    )}
                  </div>
                  {card.rating !== undefined && (
                    <div
                      className="flex items-baseline gap-0.5 text-[13px]"
                      style={{ color: "var(--nex-neutral-900, #111)" }}
                    >
                      <Star size={12} strokeWidth={2.4} fill="currentColor" aria-hidden />
                      <span className="font-semibold">{card.rating.toFixed(1)}</span>
                      {card.reviewCount !== undefined && (
                        <span
                          className="text-[10px]"
                          style={{ color: "var(--nex-neutral-500, #666)" }}
                        >
                          ({card.reviewCount})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {(card.priceLine || card.distanceLine) && (
                  <div
                    className="mt-1 space-y-0.5 text-[12px] leading-tight"
                    style={{ color: "var(--nex-neutral-700, #444)" }}
                  >
                    {card.priceLine && <div className="truncate">{card.priceLine}</div>}
                    {card.distanceLine && (
                      <div className="flex items-center gap-1 truncate">
                        <MapPin size={11} strokeWidth={2.2} aria-hidden />
                        <span className="truncate">{card.distanceLine}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-1.5 flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {card.missingFieldPills.slice(0, 2).map((pill) => (
                    <span
                      key={pill}
                      className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        color:       "var(--nex-neutral-500, #666)",
                        borderColor: "var(--nex-neutral-200, #e5e5e5)",
                        background:  "rgba(255,255,255,0.55)",
                      }}
                    >
                      {pill}
                    </span>
                  ))}
                </div>
                <ChevronRight
                  size={16}
                  strokeWidth={2.2}
                  style={{ color: "var(--nex-neutral-400, #999)", flexShrink: 0 }}
                  aria-hidden
                />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
