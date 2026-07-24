"use client";

// PopularStylesRow — horizontal-scrolling card row of trade-specific
// styles. Each card tap transitions to Compare state with the picked
// style loaded, and slides the chat up so Nex introduces the shortlist.

import { Heart, ArrowRight } from "lucide-react";
import { useConversationState } from "../state/ConversationStateProvider";

// Styles are trade-config content in real usage; hardcoded for the
// Staircase MVP + inheritance test until Business Brains populate.
// Unsplash source URLs for photo-realistic placeholders until real
// merchant photos populate via Business Brain.
const STAIRCASE_STYLES = [
  { id: "straight", title: "Straight Staircase", subtitle: "Classic & timeless",  material: "Wood",  imageUrl: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=400&q=80" },
  { id: "l-shape",  title: "L-Shape Staircase",  subtitle: "Space saving design", material: "Wood",  imageUrl: "https://images.unsplash.com/photo-1615529162924-f8605388461d?w=400&q=80" },
  { id: "u-shape",  title: "U-Shape Staircase",  subtitle: "Efficient & elegant", material: "Wood",  imageUrl: "https://images.unsplash.com/photo-1600566753104-685f4f24cb4d?w=400&q=80" },
  { id: "spiral",   title: "Spiral Staircase",   subtitle: "Compact & stylish",   material: "Metal", imageUrl: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=400&q=80" }
];

export function PopularStylesRow() {
  const { transitionTo, config } = useConversationState();
  if (config.trade_slug !== "staircase") return null;

  return (
    <section className="mt-5">
      <header className="mx-5 mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-bold" style={{ color: "var(--nex-neutral-900)" }}>
          Popular Staircase Styles
        </h3>
        <button
          type="button"
          className="flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold"
          style={{
            borderColor: "var(--nex-accent-500)",
            color: "var(--nex-accent-500)"
          }}
        >
          View All <ArrowRight size={12} strokeWidth={2.25} />
        </button>
      </header>

      <div className="scrollbar-none flex gap-3 overflow-x-auto px-5 pb-1">
        {STAIRCASE_STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() =>
              transitionTo("compare", {
                payload:      { variant: "styles", items: [s.id] },
                nexNarration: `Great — the ${s.title.toLowerCase()} is ${s.subtitle.toLowerCase()}. Want me to shortlist a few similar ones or explain how the regs affect this style?`
              })
            }
            className="relative flex-none rounded-2xl text-left transition-transform active:scale-[0.98]"
            style={{
              width: 148,
              background: "var(--nex-neutral-0)",
              boxShadow: "var(--nex-shadow-sm)",
              border: "1px solid var(--nex-neutral-200)"
            }}
            aria-label={`Explore ${s.title}`}
          >
            <div className="relative h-40 w-full overflow-hidden rounded-t-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.imageUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <span
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full"
                style={{ background: "rgba(255,255,255,0.9)" }}
              >
                <Heart size={14} strokeWidth={1.75} style={{ color: "var(--nex-neutral-700)" }} />
              </span>
            </div>
            <div className="px-3 py-3">
              <div className="text-[13px] font-bold" style={{ color: "var(--nex-neutral-900)" }}>
                {s.title}
              </div>
              <div className="mt-0.5 text-[11px]" style={{ color: "var(--nex-neutral-500)" }}>
                {s.subtitle}
              </div>
              <div
                className="mt-2 inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold"
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
    </section>
  );
}
