"use client";

// src/components/nex-app/discover/DiscoverySelector.tsx
//
// NEX Social · discovery preference selector · Phase Social §3-§7
// Philip 2026-09-07
//
// Compact top selector immediately underneath the existing Social
// header. Three-state: Female · Everyone · Male. Tiles use a portrait
// image, dark glass, thin luminous border, and a NEX-orange perimeter
// on the active tile.
//
// §7 immutable: this is a DISCOVERY preference · NOT a public identity.
// The selected value is stored in localStorage via social-store and
// never affects the user's own profile.
//
// §5 §26 · smooth 180-350ms transition on activation · no giant
// checkmarks · no aggressive colour flash.
//
// Accessibility (§32):
//   · role="radiogroup" · aria-labels · aria-checked
//   · keyboard: ArrowLeft/Right + Home/End to move focus, Enter/Space
//     to select · reduced-motion honored via CSS media query

import { useCallback, useEffect, useRef, useState } from "react";
import type { DiscoveryCategory } from "@/lib/nex/social/social-store";
import { readDiscoveryCategory, writeDiscoveryCategory } from "@/lib/nex/social/social-store";

export type DiscoverySelectorProps = {
  /** Fires when the user changes their discovery preference. The parent
   *  should update its floating-profile filter accordingly. */
  onCategoryChange?: (category: DiscoveryCategory) => void;
};

const TILES: ReadonlyArray<{
  id: DiscoveryCategory;
  label: string;
  hint: string;
  imageUrl: string;
  aria: string;
}> = [
  {
    id: "female",
    label: "Female",
    hint: "Discover women near you",
    imageUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80",
    aria: "Discover female profiles",
  },
  {
    id: "everyone",
    label: "Everyone",
    hint: "Discover everyone",
    imageUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80",
    aria: "Discover everyone",
  },
  {
    id: "male",
    label: "Male",
    hint: "Discover men near you",
    imageUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80",
    aria: "Discover male profiles",
  },
];

export function DiscoverySelector({ onCategoryChange }: DiscoverySelectorProps) {
  // Client-only initial hydration to avoid SSR/localStorage mismatch.
  const [active, setActive] = useState<DiscoveryCategory>("everyone");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setActive(readDiscoveryCategory());
    setHydrated(true);
  }, []);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const pick = useCallback((cat: DiscoveryCategory) => {
    setActive(cat);
    writeDiscoveryCategory(cat);
    onCategoryChange?.(cat);
    // Bridge to the existing FloatingProfileUniverse category state
    // via a custom event · avoids restructuring the universe's state
    // ownership and keeps this a decoupled subscription.
    if (typeof document !== "undefined") {
      document.dispatchEvent(new CustomEvent("nex-social-discovery-category", { detail: { category: cat } }));
    }
  }, [onCategoryChange]);

  // Keyboard navigation between tiles (radiogroup pattern)
  const onKeyDown = useCallback((ev: React.KeyboardEvent) => {
    const order: DiscoveryCategory[] = ["female", "everyone", "male"];
    const idx = order.indexOf(active);
    if (ev.key === "ArrowRight") { ev.preventDefault(); pick(order[Math.min(order.length - 1, idx + 1)]); }
    else if (ev.key === "ArrowLeft") { ev.preventDefault(); pick(order[Math.max(0, idx - 1)]); }
    else if (ev.key === "Home") { ev.preventDefault(); pick(order[0]); }
    else if (ev.key === "End")  { ev.preventDefault(); pick(order[order.length - 1]); }
  }, [active, pick]);

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label="Discovery preference · who to discover"
      data-testid="nex-social-discovery-selector"
      data-active={active}
      data-hydrated={hydrated}
      onKeyDown={onKeyDown}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 8,
        padding: "10px 12px",
        // Backdrop reads on the dark ImageKit hero without competing
        // with it · thin luminous line separates from the floating field.
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 100%)",
        pointerEvents: "auto",
      }}
    >
      {TILES.map((tile) => {
        const isActive = active === tile.id;
        return (
          <button
            key={tile.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={tile.aria}
            onClick={() => pick(tile.id)}
            data-testid={`nex-social-discovery-tile-${tile.id}`}
            data-active={isActive}
            className="nex-discovery-tile"
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              padding: 0,
              border: "none",
              borderRadius: 14,
              overflow: "hidden",
              cursor: "pointer",
              // Aspect ratio · portrait tile · reads clearly as "a person"
              aspectRatio: "3 / 4",
              background: "#0a0a0e",
              // Thin luminous border · switches to NEX orange on active
              boxShadow: isActive
                ? "inset 0 0 0 1.5px #F97316, 0 6px 16px -4px rgba(249,115,22,0.28), 0 0 24px -6px rgba(249,115,22,0.35)"
                : "inset 0 0 0 1px rgba(150,180,220,0.14), 0 4px 10px -4px rgba(0,0,0,0.5)",
              transition: "box-shadow 220ms cubic-bezier(0.4,0,0.2,1), transform 180ms ease",
              transform: isActive ? "translateY(-1px)" : "translateY(0)",
            }}
          >
            {/* Photo · subtle mask so text stays readable */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tile.imageUrl}
              alt=""
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: isActive ? "saturate(1.05) brightness(0.92)" : "saturate(0.85) brightness(0.7)",
                transition: "filter 240ms ease",
              }}
              draggable={false}
            />
            {/* Bottom gradient · label chip */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,0.85) 100%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0, right: 0, bottom: 0,
                padding: "10px 10px 8px",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                  color: isActive ? "#F97316" : "rgba(255,255,255,0.55)",
                  fontWeight: 700,
                  transition: "color 200ms ease",
                }}
              >
                {isActive ? "Active" : "Discover"}
              </span>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#ffffff",
                  letterSpacing: -0.2,
                  lineHeight: 1.1,
                }}
              >
                {tile.label}
              </span>
            </div>
            {/* Active perimeter · subtle NEX orange top-corner dot */}
            {isActive && (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: 8, right: 8,
                  width: 8, height: 8,
                  borderRadius: 999,
                  background: "#F97316",
                  boxShadow: "0 0 8px rgba(249,115,22,0.9)",
                }}
              />
            )}
          </button>
        );
      })}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .nex-discovery-tile { transition: none !important; }
        }
      `}</style>
    </div>
  );
}
