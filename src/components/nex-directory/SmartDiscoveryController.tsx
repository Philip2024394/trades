"use client";

// src/components/nex-directory/SmartDiscoveryController.tsx
//
// Orchestrates SmartDiscoveryCard flips at the feed level.
//
// Rules (Philip 2026-08-24 · strict frequency controls):
//   · Max 1-2 automatic flips visible per session
//   · Never re-flip the same card
//   · Only eligible cards participate
//   · 3-4s display · then flip back
//   · User interaction cancels
//   · Scroll does not cause chaotic flipping
//   · Never flips several cards simultaneously
//   · Respects prefers-reduced-motion
//
// State scope: session · sessionStorage key `nex.smart-discovery.flipped-refs`.
// The parent SmartDiscoveryCard reads its own `isFlipped` from a Set stored
// in a shared React state · controller writes to that state via callback.

import { useEffect } from "react";

interface Props {
  eligibleRefs: string[];                // publicListingRefs that MAY flip
  flippedRefs: Set<string>;              // current flip state · owned by parent
  onFlip: (ref: string) => void;         // request a flip
  onUnflip: (ref: string) => void;       // request an unflip (used by SmartDiscoveryCard callback)
  maxFlipsPerSession?: number;           // default 2
  firstFlipAfterMs?: number;             // default 5500ms · give the user a chance to look
  secondFlipAfterMs?: number;            // default 22000ms after first · not chatty
}

const SESSION_KEY = "nex.smart-discovery.flipped-refs";
const SESSION_COUNT_KEY = "nex.smart-discovery.flip-count";

function readFlipped(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "[]")); }
  catch { return new Set(); }
}
function writeFlipped(s: Set<string>) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify([...s]));
}
function readCount(): number {
  if (typeof window === "undefined") return 0;
  return Number(sessionStorage.getItem(SESSION_COUNT_KEY) ?? "0") || 0;
}
function bumpCount(): number {
  const next = readCount() + 1;
  if (typeof window !== "undefined") sessionStorage.setItem(SESSION_COUNT_KEY, String(next));
  return next;
}

export function SmartDiscoveryController({
  eligibleRefs, flippedRefs, onFlip, onUnflip,
  maxFlipsPerSession = 2, firstFlipAfterMs = 5500, secondFlipAfterMs = 22000,
}: Props): null {
  useEffect(() => {
    if (eligibleRefs.length === 0) return;

    // Respect prefers-reduced-motion · never auto-flip.
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    // Session cap · count is per browser tab · sessionStorage clears with tab.
    if (readCount() >= maxFlipsPerSession) return;

    const alreadyFlipped = readFlipped();
    // Pick a ref that hasn't been flipped this session · stable order chooses
    // the first-eligible-not-yet-flipped so the "which cards flip" is
    // deterministic per session and never blinks the same card twice.
    const pickable = eligibleRefs.filter((ref) => !alreadyFlipped.has(ref));
    if (pickable.length === 0) return;

    const timers: Array<ReturnType<typeof setTimeout>> = [];

    // First flip
    timers.push(setTimeout(() => {
      // Re-check inside the timer · user may have already flipped past cap.
      if (readCount() >= maxFlipsPerSession) return;
      const currentFlipped = readFlipped();
      const nextRef = pickable.find((r) => !currentFlipped.has(r));
      if (!nextRef) return;
      currentFlipped.add(nextRef); writeFlipped(currentFlipped);
      bumpCount();
      onFlip(nextRef);
    }, firstFlipAfterMs));

    // Second flip (if allowed)
    if (maxFlipsPerSession >= 2) {
      timers.push(setTimeout(() => {
        if (readCount() >= maxFlipsPerSession) return;
        const currentFlipped = readFlipped();
        const nextRef = pickable.find((r) => !currentFlipped.has(r));
        if (!nextRef) return;
        currentFlipped.add(nextRef); writeFlipped(currentFlipped);
        bumpCount();
        onFlip(nextRef);
      }, firstFlipAfterMs + secondFlipAfterMs));
    }

    return () => { for (const t of timers) clearTimeout(t); };
    // eligibleRefs is a stable prop from the server payload · effect only
    // runs once per feed mount which is exactly the semantics we want.

  }, [eligibleRefs.join(","), maxFlipsPerSession, firstFlipAfterMs, secondFlipAfterMs, onFlip]);

  // Auto-unflip is handled inside SmartDiscoveryCard (setTimeout 3.5s → onFlipComplete).
  // The parent handles onFlipComplete by calling onUnflip · this controller
  // does not manage timing on the way back. Present here as pass-through
  // documentation so the shape is clear at a glance.
  void flippedRefs; void onUnflip;

  return null;
}
