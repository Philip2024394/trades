"use client";

// HowItWorksCard — one expandable feature card in the guide grid.
//
// Anatomy:
//   ┌────────────────────────────────────────┐
//   │ [wireframe SVG preview]  Section label │
//   │                          Title         │
//   │                          One-liner     │
//   │                                        │
//   │  Where to click: A → B → C             │
//   │                                        │
//   │  ▸ Learn more    [ Show me on page ]   │
//   └────────────────────────────────────────┘
//
// Expanded state reveals `deepBody` and additional images. Seen state
// (from useGuideProgress) shows a small green tick in the corner.

import { useState } from "react";
import { CheckCircle2, ChevronDown, MousePointerClick, Sparkles, Clock } from "lucide-react";
import type { GuideFeature } from "@/lib/homeowners/howItWorks";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

type Props = {
  feature:   GuideFeature;
  isSeen:    boolean;
  isFocused?: boolean;
  onOpen:    () => void;
  onShowMe:  () => void;
};

export function HowItWorksCard({ feature, isSeen, isFocused, onOpen, onShowMe }: Props) {
  const [expanded, setExpanded] = useState<boolean>(!!isFocused);

  function toggleExpand() {
    setExpanded((x) => !x);
    if (!expanded) onOpen();          // mark seen on first expand
  }

  return (
    <article
      id={`guide-${feature.id}`}
      className={
        "group flex flex-col overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition sm:flex-row " +
        (isFocused
          ? "ring-2 ring-offset-2"
          : "hover:-translate-y-0.5 hover:shadow-md")
      }
      style={{
        borderColor: "rgba(0,0,0,0.08)",
        boxShadow:   isFocused ? `0 8px 24px -8px ${BRAND_YELLOW}44` : undefined
      }}
    >
      {/* SVG wireframe preview — full-width on mobile, fixed left panel
          on desktop so the card can use its full horizontal space for
          copy + actions on the right. */}
      <div
        className="relative shrink-0 border-b bg-neutral-50 sm:w-[260px] sm:border-b-0 sm:border-r"
        style={{ borderColor: "rgba(0,0,0,0.06)" }}
      >
        <div
          className="aspect-[240/120] w-full [&_svg]:h-full [&_svg]:w-full sm:aspect-auto sm:h-full sm:min-h-[180px]"
          dangerouslySetInnerHTML={{ __html: feature.previewSvg }}
        />
        {/* Seen tick — top-right */}
        {isSeen && (
          <span
            className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm"
            title="You've opened this"
          >
            <CheckCircle2 size={14} strokeWidth={2.5} style={{ color: BRAND_GREEN }}/>
          </span>
        )}
        {/* Live/soon chip — bottom-left */}
        <span
          className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-sm"
          style={{
            backgroundColor: feature.live ? "rgba(22,101,52,0.15)" : "rgba(0,0,0,0.06)",
            color:           feature.live ? BRAND_GREEN            : "#525252"
          }}
        >
          {feature.live
            ? <><Sparkles size={9} strokeWidth={2.5}/> Live</>
            : <><Clock size={9} strokeWidth={2.5}/> Coming soon</>
          }
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <p className="text-[9.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
          {feature.sectionLabel}
        </p>
        <h3 className="text-[15px] font-black leading-tight text-neutral-900">
          {feature.title}
        </h3>
        <p className="text-[12.5px] leading-relaxed text-neutral-700">
          {feature.oneLiner}
        </p>

        {/* "Where to click" step chain */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-lg bg-neutral-50 px-2.5 py-2">
          <MousePointerClick size={11} className="shrink-0 text-neutral-400"/>
          {feature.clickPath.map((step, i) => (
            <span key={step} className="inline-flex items-center gap-1.5">
              <span className="text-[10.5px] font-black uppercase tracking-wider text-neutral-700">
                {step}
              </span>
              {i < feature.clickPath.length - 1 && (
                <span className="text-neutral-300">→</span>
              )}
            </span>
          ))}
        </div>

        {/* Expand button */}
        <button
          type="button"
          onClick={toggleExpand}
          className="mt-1 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
        >
          <ChevronDown
            size={12}
            strokeWidth={2.5}
            className={"transition " + (expanded ? "rotate-180" : "")}
          />
          {expanded ? "Hide details" : "Learn more"}
        </button>

        {/* Expanded body */}
        {expanded && (
          <div className="animate-[fadeIn_0.2s_ease-out] rounded-lg bg-neutral-50 p-3">
            <p className="text-[12.5px] leading-relaxed text-neutral-700 whitespace-pre-line">
              {feature.deepBody}
            </p>
          </div>
        )}

        {/* Show me on the page */}
        {feature.tourSteps.length > 0 && (
          <button
            type="button"
            onClick={() => { onOpen(); onShowMe(); }}
            className="mt-2 inline-flex h-9 items-center justify-center gap-1 self-start rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition hover:brightness-95"
            style={{ backgroundColor: BRAND_YELLOW }}
          >
            Show me on the page →
          </button>
        )}
      </div>
    </article>
  );
}
