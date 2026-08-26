// NexActivityBars · fixed bottom-right affordance on /nexapp home.
//
// Three dancing orange bars — a small button-chrome that says "activity is
// happening, tap for the right-side drawer." Deliberately NOT a full
// equalizer around the central NEX orb — that surface belongs to the
// Siri-style voice presence inside NexIdentityButton and must not compete.
//
// Design language:
//   · Dark translucent pill · same NEX.bgSurfaceHi + border tokens as the
//     Friends button + input dock.
//   · Bars animate via CSS keyframes · pure client · no JS tick, respects
//     prefers-reduced-motion.
//   · onClick fires an `onOpen` callback so parent (NexAppHome) owns the
//     drawer state + body content.

"use client";

import { NEX } from "@/lib/nexapp/tokens";

export function NexActivityBars({ onOpen, isOpen }: { onOpen: () => void; isOpen: boolean }) {
  return (
    <>
      <style>{`
        @keyframes nex-activity-bar-dance {
          0%   { transform: scaleY(0.35); }
          22%  { transform: scaleY(1);    }
          46%  { transform: scaleY(0.55); }
          70%  { transform: scaleY(0.90); }
          100% { transform: scaleY(0.35); }
        }
        .nex-activity-btn {
          appearance: none;
          background: ${NEX.bgSurfaceHi};
          border: 1px solid ${NEX.borderMuted};
          border-radius: 999px;
          display: inline-flex;
          align-items: flex-end;
          justify-content: center;
          gap: 3px;
          padding: 10px 14px;
          height: 44px;
          cursor: pointer;
          transition: box-shadow 200ms ease, border-color 200ms ease, transform 120ms ease;
        }
        .nex-activity-btn:hover { border-color: ${NEX.orangeSoft}; }
        .nex-activity-btn:active { transform: scale(0.96); }
        .nex-activity-btn:focus-visible { outline: 2px solid ${NEX.orange}; outline-offset: 3px; }
        .nex-activity-btn.open {
          border-color: ${NEX.orange};
          box-shadow: 0 0 14px ${NEX.orangeGlow};
        }
        .nex-activity-btn span {
          display: inline-block;
          width: 3px;
          height: 18px;
          background: ${NEX.orange};
          border-radius: 2px;
          transform-origin: 50% 100%;
          animation: nex-activity-bar-dance 900ms ease-in-out infinite;
        }
        .nex-activity-btn span:nth-child(2) { animation-delay: 180ms; }
        .nex-activity-btn span:nth-child(3) { animation-delay: 360ms; }
        @media (prefers-reduced-motion: reduce) {
          .nex-activity-btn span { animation: none !important; }
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          right: 22,
          // Match NexPendingChats bottom placement so the two affordances
          // sit on the same visual band — friends dock LEFT, activity bars RIGHT.
          bottom: "max(env(safe-area-inset-bottom), 14px)",
          zIndex: 4,
        }}
      >
        <button
          type="button"
          onClick={onOpen}
          aria-label="Open activity drawer"
          aria-expanded={isOpen}
          className={`nex-activity-btn ${isOpen ? "open" : ""}`}
          data-testid="nex-activity-bars"
        >
          <span aria-hidden />
          <span aria-hidden />
          <span aria-hidden />
        </button>
      </div>
    </>
  );
}
