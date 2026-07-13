"use client";

// Flip-card wrapper. Renders two sides — the passed-in server-rendered
// post content (front) and the client-rendered YardCardBack (back) —
// on a CSS 3D-transformed container so the flip animation is pure CSS.
//
// The shell also injects a small "flip" button on the front's top-right
// corner and a "View Profile" quick button on the front's bottom-right
// so buyers who don't want to flip can still land directly on the trade
// profile in one tap. Both are optional — if the post has no poster
// data we render the children pass-through with no chrome.

import { useState } from "react";
import { UserSquare } from "lucide-react";
import { YardCardBack } from "./YardCardBack";
import type { YardPoster } from "./YardPostCard";

export function YardCardFlipShell({
  poster,
  children
}: {
  poster: YardPoster | null;
  children: React.ReactNode;
}) {
  const [flipped, setFlipped] = useState(false);

  if (!poster) {
    // No poster context = no flip surface. Pass through so the front
    // renders exactly as it always has.
    return <>{children}</>;
  }

  return (
    <div
      className="group relative h-full"
      style={{ perspective: "1200px" }}
      data-flipped={flipped ? "true" : "false"}
    >
      <div
        className="relative h-full transition-transform duration-500 ease-out"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)"
        }}
      >
        {/* FRONT */}
        <div
          className="relative h-full w-full"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden"
          }}
        >
          {children}

          {/* Flip toggle — top-right, yellow. The yellow "Profile" CTA
              lives under the thumbnail (inside the card) so nothing
              overlays post content. */}
          <button
            type="button"
            onClick={() => setFlipped(true)}
            aria-label="Flip card to see poster identity"
            className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full shadow-md transition hover:scale-105 active:scale-95"
            style={{
              background: "#FFB300",
              color: "#0A0A0A",
              touchAction: "manipulation"
            }}
          >
            <UserSquare className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        {/* BACK */}
        <div
          className="absolute inset-0 h-full w-full"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)"
          }}
        >
          <YardCardBack poster={poster} onFlipBack={() => setFlipped(false)} />
        </div>
      </div>
    </div>
  );
}
