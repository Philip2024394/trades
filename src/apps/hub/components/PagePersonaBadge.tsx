// PagePersonaBadge — [DEV BUTTON] pill that stamps which persona a
// surface is designed for so we can tell trade pages from merchant
// pages at a glance while building.
//
// Blue  = trade-facing page
// Pink  = merchant-facing page
//
// Only renders when NODE_ENV !== "production". Wrapped in the standard
// [DEV BUTTON] marker so `remove dev buttons` strips every instance in
// one sweep.

"use client";

import { User, Store } from "lucide-react";

type Persona = "trade" | "merchant";

type Props = {
  persona: Persona;
  /** Optional short label — defaults to the persona name. */
  label?: string;
};

export function PagePersonaBadge({ persona, label }: Props) {
  if (process.env.NODE_ENV === "production") return null;
  const isTrade = persona === "trade";
  const bg = isTrade ? "#2563EB" : "#EC4899";
  const Icon = isTrade ? User : Store;
  const text = label ?? (isTrade ? "Trade page" : "Merchant page");

  return (
    /* [DEV BUTTON] — remove on "remove dev buttons" */
    <div
      className="fixed bottom-4 left-4 z-[70] pointer-events-none"
      aria-hidden
    >
      <div
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-lg ring-2 ring-white/80"
        style={{ backgroundColor: bg }}
        title={`Dev-only page persona marker — ${text}`}
      >
        <Icon size={11} strokeWidth={2.5}/>
        {text}
      </div>
    </div>
    /* [/DEV BUTTON] */
  );
}
