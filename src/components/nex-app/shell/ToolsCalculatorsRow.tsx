"use client";

// ToolsCalculatorsRow — 3 horizontal calculator cards per canonical
// Staircase mockup. Icon left · text middle · arrow right. Each tap
// transitions to Configure state with the specific calculator loaded.

import { ArrowRight, ChevronRight, Grip, LineChart } from "lucide-react";
import { useConversationState } from "../state/ConversationStateProvider";

const CALCULATORS = [
  {
    id: "staircase_calc",
    title: "Staircase Calculator",
    subtitle: "Calculate rise, run & angle",
    iconLetters: "S"    // decorative — icon rendered as monogram in warm-orange square
  },
  {
    id: "railing_calc",
    title: "Railing Calculator",
    subtitle: "Baluster, height & spacing",
    iconLetters: "R"
  },
  {
    id: "stringer_calc",
    title: "Stringer Calculator",
    subtitle: "Cut stringer with ease",
    iconLetters: "T"
  }
];

export function ToolsCalculatorsRow() {
  const { transitionTo, config } = useConversationState();
  if (config.trade_slug !== "staircase") return null;

  return (
    <section className="mt-5">
      <header className="mx-5 mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-bold" style={{ color: "var(--nex-neutral-900)" }}>
          Tools &amp; Calculators
        </h3>
        <button
          type="button"
          className="flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold"
          style={{ color: "var(--nex-accent-500)" }}
        >
          View All <ArrowRight size={12} strokeWidth={2.25} />
        </button>
      </header>

      <div className="scrollbar-none flex gap-3 overflow-x-auto px-5 pb-1">
        {CALCULATORS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() =>
              transitionTo("configure", {
                payload:      { variant: c.id },
                nexNarration: `Let's use the ${c.title.toLowerCase()} — give me a starting number or ask me what to measure first.`
              })
            }
            className="flex flex-none items-center gap-3 rounded-2xl px-3 py-3 text-left transition-transform active:scale-[0.98]"
            style={{
              width: 220,
              background: "var(--nex-neutral-0)",
              boxShadow: "var(--nex-shadow-sm)",
              border: "1px solid var(--nex-neutral-200)"
            }}
            aria-label={c.title}
          >
            <span
              className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl"
              style={{ background: "var(--nex-accent-50)", color: "var(--nex-accent-500)" }}
              aria-hidden
            >
              <MiniCalcIcon variant={c.id} />
            </span>
            <span className="flex flex-1 flex-col">
              <span className="text-[13px] font-bold" style={{ color: "var(--nex-neutral-900)" }}>
                {c.title}
              </span>
              <span className="text-[11px] leading-tight" style={{ color: "var(--nex-neutral-500)" }}>
                {c.subtitle}
              </span>
            </span>
            <ChevronRight size={16} strokeWidth={2} style={{ color: "var(--nex-neutral-400)" }} />
          </button>
        ))}
      </div>
    </section>
  );
}

// Small custom icons approximating the mockup style: staircase steps,
// railing bars, and a stringer cut. Rendered as SVG so we can match
// the outline-orange feel exactly.
function MiniCalcIcon({ variant }: { variant: string }) {
  const stroke = "currentColor";
  if (variant === "staircase_calc") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="1.75" stroke={stroke} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h4v-4h4v-4h4V9h4V5h4" />
      </svg>
    );
  }
  if (variant === "railing_calc") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="1.75" stroke={stroke} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5h16" />
        <path d="M4 19h16" />
        <path d="M8 5v14" />
        <path d="M12 5v14" />
        <path d="M16 5v14" />
      </svg>
    );
  }
  // stringer_calc
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="1.75" stroke={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20l6-16 4 4-6 12z" />
      <path d="M14 8l6-4" />
    </svg>
  );
}
