"use client";

// src/components/nex-app/live/FirstUseTutorial.tsx
//
// NEX Music/Video · Progressive spatial-gesture tutorial · Phase M
// §12 · §13 · §14 · §15 · §17
//
// Rule: NEVER four permanent arrows around the screen. The tutorial
// teaches ONE lesson at a time, uses a subtle animated hand + caption,
// and disappears the moment the user performs the demonstrated gesture
// (or explicitly dismisses it).
//
// The lesson cursor lives in localStorage (see first-use-prefs.ts). The
// component just renders the currently-active lesson. Reduced-motion
// users see a static hint (no animation) with the same caption.
//
// Accessibility (§17):
//   · role="status" · caption announced by screen readers
//   · Skip button (visible tap alternative · required per §17)
//   · Reduced-motion preference honored via a CSS media query

import { useEffect, useState } from "react";
import type { TutorialLesson } from "@/lib/nex/live/first-use-prefs";
import { advanceTutorialLesson, currentTutorialLesson, markTutorialComplete } from "@/lib/nex/live/first-use-prefs";

const CAPTIONS: Record<Exclude<TutorialLesson, "done">, string> = {
  down:  "Swipe to discover",
  left:  "Explore the artist",
  right: "Create something",
  up:    "Go back",
};

const HAND_ANIMATION_BY_DIR: Record<Exclude<TutorialLesson, "done">, string> = {
  down:  "nex-tutorial-hand-down",
  left:  "nex-tutorial-hand-left",
  right: "nex-tutorial-hand-right",
  up:    "nex-tutorial-hand-up",
};

export type FirstUseTutorialProps = {
  /** Fired when the user completes or dismisses the current lesson.
   *  Parent may advance the cursor or hide the tutorial entirely. */
  onLessonAdvanced?: (nextLesson: TutorialLesson) => void;
};

export function FirstUseTutorial({ onLessonAdvanced }: FirstUseTutorialProps) {
  // Hydration-safe · read the cursor once on mount, never during SSR.
  const [lesson, setLesson] = useState<TutorialLesson | null>(null);
  useEffect(() => {
    setLesson(currentTutorialLesson());
  }, []);

  if (!lesson || lesson === "done") return null;

  const caption = CAPTIONS[lesson];
  const handAnimation = HAND_ANIMATION_BY_DIR[lesson];

  function advance() {
    const next = advanceTutorialLesson(lesson as Exclude<TutorialLesson, "done">);
    setLesson(next);
    if (onLessonAdvanced) onLessonAdvanced(next);
  }

  function skip() {
    markTutorialComplete();
    setLesson("done");
    if (onLessonAdvanced) onLessonAdvanced("done");
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Tutorial · ${caption}`}
      data-testid="nex-first-use-tutorial"
      data-lesson={lesson}
      className="absolute inset-0 z-30 pointer-events-none"
    >
      {/* Soft dark backdrop · never fully opaque · media stays visible
          so the user learns from the actual screen response, not from
          a covered-up UI (§13 "hand movement + actual screen response"). */}
      <div
        aria-hidden
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
      />

      {/* Hand · animates in the demonstrated direction · reduced-motion
          users see a static hand without the sweep (announced caption
          conveys intent). */}
      <div className={`nex-tutorial-hand ${handAnimation}`} aria-hidden>
        <span className="nex-tutorial-hand-glyph">✋</span>
      </div>

      {/* Caption + skip · pointer-events restored on the caption chrome */}
      <div className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-3 pointer-events-auto">
        <div className="rounded-full bg-black/70 backdrop-blur px-5 py-2 text-white text-[13px] font-medium shadow-lg">
          {caption}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={advance}
            className="rounded-full bg-white text-black text-[12px] font-semibold px-4 py-1.5 hover:bg-white/90"
            data-testid="nex-first-use-tutorial-got-it"
          >
            Got it
          </button>
          <button
            type="button"
            onClick={skip}
            className="rounded-full bg-white/15 text-white text-[12px] font-semibold px-4 py-1.5 hover:bg-white/25"
            data-testid="nex-first-use-tutorial-skip"
          >
            Skip
          </button>
        </div>
      </div>

      <style>{`
        .nex-tutorial-hand {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 56px;
          height: 56px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: rgba(255,255,255,0.10);
          box-shadow: 0 8px 24px -4px rgba(0,0,0,0.5);
          will-change: transform;
        }
        .nex-tutorial-hand-glyph {
          font-size: 30px;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
        }
        .nex-tutorial-hand-down  { animation: nex-tut-down  1600ms cubic-bezier(0.4,0,0.2,1) infinite; }
        .nex-tutorial-hand-up    { animation: nex-tut-up    1600ms cubic-bezier(0.4,0,0.2,1) infinite; }
        .nex-tutorial-hand-left  { animation: nex-tut-left  1600ms cubic-bezier(0.4,0,0.2,1) infinite; }
        .nex-tutorial-hand-right { animation: nex-tut-right 1600ms cubic-bezier(0.4,0,0.2,1) infinite; }

        @keyframes nex-tut-down  {
          0%   { transform: translate(-50%, -110%); opacity: 0; }
          20%  { transform: translate(-50%, -50%);  opacity: 1; }
          80%  { transform: translate(-50%, 20%);   opacity: 1; }
          100% { transform: translate(-50%, 60%);   opacity: 0; }
        }
        @keyframes nex-tut-up {
          0%   { transform: translate(-50%, 40%);   opacity: 0; }
          20%  { transform: translate(-50%, -50%);  opacity: 1; }
          80%  { transform: translate(-50%, -120%); opacity: 1; }
          100% { transform: translate(-50%, -160%); opacity: 0; }
        }
        @keyframes nex-tut-left {
          0%   { transform: translate(30%, -50%);   opacity: 0; }
          20%  { transform: translate(-50%, -50%);  opacity: 1; }
          80%  { transform: translate(-130%, -50%); opacity: 1; }
          100% { transform: translate(-170%, -50%); opacity: 0; }
        }
        @keyframes nex-tut-right {
          0%   { transform: translate(-130%, -50%); opacity: 0; }
          20%  { transform: translate(-50%, -50%);  opacity: 1; }
          80%  { transform: translate(30%, -50%);   opacity: 1; }
          100% { transform: translate(70%, -50%);   opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .nex-tutorial-hand-down,
          .nex-tutorial-hand-up,
          .nex-tutorial-hand-left,
          .nex-tutorial-hand-right {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
