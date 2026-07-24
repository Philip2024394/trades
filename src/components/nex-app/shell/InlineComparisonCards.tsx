"use client";

// InlineComparisonCards — the Compare state, rendered inline inside
// the chat message stream (per canonical Staircase chat mockup which
// shows horizontal product cards after Nex's reply).
//
// This is the load-bearing component: it proves that a conversation
// state can summon rich UI directly into the chat rather than requiring
// page navigation. That IS the platform validation this session set
// out to prove.

import { useConversationState } from "../state/ConversationStateProvider";

// Staircase-style content — hardcoded until Trade Brain feeds it.
// Real implementation reads from config + Brain retrieval.
const STAIRCASE_STYLES = [
  { id: "straight",   title: "Straight Staircase", subtitle: "Classic & timeless",  material: "Wood",  imageBg: "linear-gradient(160deg, #d4a574, #8b5a3c)" },
  { id: "l-shape",    title: "L-Shape Staircase",  subtitle: "Space saving design", material: "Wood",  imageBg: "linear-gradient(160deg, #c8956d, #7a4f34)" },
  { id: "u-shape",    title: "U-Shape Staircase",  subtitle: "Efficient & elegant", material: "Wood",  imageBg: "linear-gradient(160deg, #bc8558, #6e4529)" },
  { id: "spiral",     title: "Spiral Staircase",   subtitle: "Compact & stylish",   material: "Metal", imageBg: "linear-gradient(160deg, #b0b0b0, #4a4a4a)" }
];

export function InlineComparisonCards() {
  const { canvasPayload, transitionTo } = useConversationState();
  const focusedId = canvasPayload.items?.[0];
  const cards = focusedId
    ? [STAIRCASE_STYLES.find(s => s.id === focusedId)!, ...STAIRCASE_STYLES.filter(s => s.id !== focusedId).slice(0, 3)]
    : STAIRCASE_STYLES;

  return (
    <div className="mb-3 -mx-2">
      <div className="scrollbar-none flex gap-3 overflow-x-auto px-2 pb-1">
        {cards.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() =>
              transitionTo("configure", {
                payload:      { variant: "staircase", items: [s.id] },
                nexNarration: `Great — let's shape a ${s.title.toLowerCase()}. What's your floor-to-floor rise? (You can also just type "not sure" and I'll walk you through measuring it.)`
              })
            }
            className="flex-none rounded-2xl text-left transition-transform active:scale-[0.98]"
            style={{
              width: 130,
              background: "var(--nex-neutral-0)",
              boxShadow: "var(--nex-shadow-sm)",
              border: "1px solid var(--nex-neutral-200)"
            }}
            aria-label={`Configure a ${s.title}`}
          >
            <div className="h-24 w-full rounded-t-2xl" style={{ background: s.imageBg }} />
            <div className="px-3 py-2">
              <div className="text-[12px] font-bold" style={{ color: "var(--nex-neutral-900)" }}>{s.title}</div>
              <div className="mt-0.5 text-[10px]" style={{ color: "var(--nex-neutral-500)" }}>{s.subtitle}</div>
              <div
                className="mt-1.5 inline-block rounded-md px-1.5 py-0.5 text-[9px] font-semibold"
                style={{
                  background: "var(--nex-accent-100)",
                  color: "var(--nex-accent-700)"
                }}
              >
                {s.material}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
