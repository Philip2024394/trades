// NEX home · horizontal business carousel + card.
//
// Cards show: photo · name · rating (stars + review count) · distance ·
// open/closed + closes-at time. No price fields — Owner-Provenanced
// Pricing doctrine forbids fabricated prices in the UI (real cards from
// NEX Listings will carry owner-authorised pricing later).
//
// Pagination dots below · orange = active · gray = inactive · updates
// as the carousel is scrolled (IntersectionObserver on each card).

"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { NEX } from "@/lib/nexapp/tokens";
import type { BusinessCard } from "@/lib/nexapp/mockData";

export function BusinessCarousel({ cards }: { cards: BusinessCard[] }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const cardWidth = el.scrollWidth / cards.length;
      const idx = Math.round(el.scrollLeft / Math.max(1, cardWidth));
      setActiveIndex(Math.max(0, Math.min(cards.length - 1, idx)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [cards.length]);

  const dotCount = Math.max(4, cards.length);

  return (
    <div>
      <div
        ref={scrollRef}
        className="nex-no-scrollbar"
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          paddingBottom: 4,
          paddingRight: 12,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {cards.map((card) => (
          <BusinessCardTile key={card.id} card={card} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-start", gap: 5, marginTop: 8, marginLeft: 4 }}>
        {Array.from({ length: dotCount }).map((_, i) => (
          <span
            key={i}
            style={{
              width: i === activeIndex ? 14 : 6,
              height: 4,
              borderRadius: 2,
              background: i === activeIndex ? NEX.orange : "rgba(255,255,255,0.16)",
              transition: "width 200ms ease, background 200ms ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function BusinessCardTile({ card }: { card: BusinessCard }) {
  return (
    <div
      style={{
        flex: "0 0 156px",
        scrollSnapAlign: "start",
        // 2026-08-24 · Philip · frosted BLACK glass to match chat bubbles.
        // Same material system (dark translucent + backdrop blur + subtle
        // white edge + inset highlight + outer shadow) so cards + bubbles
        // read as one design language on the artwork background.
        background: "rgba(0, 0, 0, 0.38)",
        backdropFilter: "blur(18px) saturate(1.2)",
        WebkitBackdropFilter: "blur(18px) saturate(1.2)",
        border: `1px solid rgba(255, 255, 255, 0.10)`,
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        borderRadius: 12,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ position: "relative", width: "100%", aspectRatio: "1.35 / 1", background: "#151515" }}>
        <Image
          src={card.imageUrl}
          alt={card.name}
          fill
          sizes="156px"
          style={{ objectFit: "cover" }}
          unoptimized
        />
      </div>
      <div style={{ padding: "8px 10px 10px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: NEX.text, lineHeight: 1.2, marginBottom: 4, minHeight: 30 }}>
          {card.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
          <StarIcon />
          <span style={{ fontSize: 12, color: NEX.text, fontWeight: 600 }}>{card.ratingStars.toFixed(1)}</span>
          <span style={{ fontSize: 11, color: NEX.textFaint }}>({card.reviewCount})</span>
        </div>
        <div style={{ fontSize: 11, color: NEX.textMuted, marginBottom: 3 }}>
          {card.distanceKm.toFixed(1)} km away
        </div>
        <div style={{ fontSize: 11, color: NEX.textMuted }}>
          {/* 2026-08-24 · Cyber Aurora · "Open now" is a LIVE/ACTIVE state so
              it gets electric-cyan · "Closed" stays red for stop-state clarity. */}
          <span style={{ color: card.open ? NEX.cyan : "#EF4444", fontWeight: 600 }}>
            {card.open ? "Open" : "Closed"}
          </span>
          <span style={{ margin: "0 4px" }}>·</span>
          <span>Closes {card.closesAt}</span>
        </div>
      </div>
    </div>
  );
}

function StarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill={NEX.orange} stroke="none" aria-hidden>
      <path d="M12 2l3 7 7 .8-5.3 4.7L18.2 22 12 18.3 5.8 22l1.5-7.5L2 9.8 9 9z" />
    </svg>
  );
}
