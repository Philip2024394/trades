// NEX Explore background image slideshow · 2026-08-23 (Philip).
//
// Cycles through a list of background images with an auto cross-fade
// transition. New image appears every 1 second; each transition is a
// smooth opacity cross-fade so the image never "hard cuts."
//
// Truth Invariant: only NEX-authored theme assets belong here — never
// stock imagery. Add new URLs to IMAGES below; the component handles
// timing automatically.

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const IMAGES = [
  "https://ik.imagekit.io/7grri5v7d/Untitledsdsaaa.png",
  "https://ik.imagekit.io/7grri5v7d/Untitledsdsaaaasd.png",
  "https://ik.imagekit.io/7grri5v7d/Untitledsdsaaaasdasda.png",
  "https://ik.imagekit.io/7grri5v7d/UntitledsdsaaaasdasdazxcxZx.png",
];

const CYCLE_MS = 1000;         // new image every 1 s (Philip spec)
const CROSSFADE_MS = 500;      // fade duration for each transition

export function NexExploreBackground() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (IMAGES.length < 2) return; // nothing to cycle
    const id = setInterval(() => {
      setIdx((prev) => (prev + 1) % IMAGES.length);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 24,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
      aria-hidden
      data-nex-explore-background
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={idx}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: CROSSFADE_MS / 1000, ease: [0.4, 0, 0.2, 1] }}
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("${IMAGES[idx]}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
      </AnimatePresence>
    </div>
  );
}
