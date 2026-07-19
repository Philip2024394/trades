"use client";

// HowItWorksGuide — the main guide surface. Replaces the feed area
// when the "How it works" button is toggled on. Renders:
//   • Header (title + progress + close)
//   • Search field (matches title, oneLiner, deepBody, clickPath)
//   • Section filter chips (All / Trades & Suppliers / Composer / …)
//   • Grid of HowItWorksCard components
//
// Deep-link support: `?guide=<featureId>` scrolls to + expands that
// card on mount, marks it as seen. Clear query on close.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Sparkles, RotateCcw } from "lucide-react";
import {
  HOW_IT_WORKS_FEATURES,
  GUIDE_SECTIONS,
  type GuideSection
} from "@/lib/homeowners/howItWorks";
import { HowItWorksCard } from "./HowItWorksCard";
import { useGuideProgress } from "./useGuideProgress";
import { useGuideTour } from "./useGuideTour";
import { emitGuideEvent } from "./guideAnalytics";

const BRAND_YELLOW = "#FFB300";

type Props = {
  onClose:   () => void;
  /** When set, the guide auto-opens + focuses this feature id on mount. */
  focusId?:  string | null;
};

export function HowItWorksGuide({ onClose, focusId = null }: Props) {
  const router                      = useRouter();
  const searchParams                = useSearchParams();
  const [q, setQ]                   = useState<string>("");
  const [section, setSection]       = useState<GuideSection | "all">("all");
  const [focused, setFocused]       = useState<string | null>(focusId);
  const { seen, markSeen, reset }   = useGuideProgress();
  const { runTour, stopTour }       = useGuideTour();
  const gridRef                     = useRef<HTMLDivElement>(null);

  // On mount, if ?guide= is present, focus that card + scroll to it.
  useEffect(() => {
    const paramId = searchParams.get("guide") || focusId;
    emitGuideEvent("tn:guide:opened", { featureId: paramId });
    if (!paramId || paramId === "1") return;
    setFocused(paramId);
    markSeen(paramId);
    emitGuideEvent("tn:guide:featureView", { featureId: paramId });
    setTimeout(() => {
      document.getElementById(`guide-${paramId}`)?.scrollIntoView({
        behavior: "smooth", block: "center"
      });
    }, 120);
  }, [searchParams, focusId, markSeen]);

  // Filter + search
  const filtered = useMemo(() => {
    let list = HOW_IT_WORKS_FEATURES;
    if (section !== "all") list = list.filter((f) => f.section === section);
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((f) =>
        f.title.toLowerCase().includes(query) ||
        f.oneLiner.toLowerCase().includes(query) ||
        f.deepBody.toLowerCase().includes(query) ||
        f.clickPath.join(" ").toLowerCase().includes(query)
      );
    }
    return list;
  }, [q, section]);

  // Section counts for the chip strip (post-search)
  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = { all: HOW_IT_WORKS_FEATURES.length };
    for (const s of GUIDE_SECTIONS) {
      counts[s.id] = HOW_IT_WORKS_FEATURES.filter((f) => f.section === s.id).length;
    }
    return counts;
  }, []);

  function handleClose() {
    emitGuideEvent("tn:guide:closed", { featuresSeen: seen.size });
    // Clean the ?guide= param on close so a page refresh doesn't
    // re-open the guide unintentionally.
    if (searchParams.get("guide")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("guide");
      router.replace(url.pathname + url.search);
    }
    stopTour();
    onClose();
  }

  const totalSeen = seen.size;
  const totalAll  = HOW_IT_WORKS_FEATURES.length;

  return (
    <div className="rounded-2xl border-2 bg-white shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
        <div>
          <p className="text-[10.5px] font-black uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>
            <Sparkles size={11} strokeWidth={2.5} className="inline mr-1 -mt-0.5"/>
            SiteBook · How it works
          </p>
          <h2 className="mt-1 text-[20px] font-black leading-tight text-neutral-900">
            Every feature, every button — explained.
          </h2>
          <p className="mt-1 text-[12.5px] text-neutral-600">
            {totalSeen === totalAll
              ? `You've explored all ${totalAll} features. Nice.`
              : `${totalSeen} of ${totalAll} explored. Tap any card to open, then "Show me on the page" to see it live.`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalSeen > 0 && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-neutral-300 bg-white px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-600 hover:bg-neutral-50"
              title="Clear 'seen' progress"
            >
              <RotateCcw size={11} strokeWidth={2.5}/> Reset
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-9 items-center gap-1 rounded-full bg-neutral-900 px-3 text-[10.5px] font-black uppercase tracking-wider text-white shadow-sm"
          >
            <X size={12} strokeWidth={2.5}/> Close guide
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-neutral-100" aria-hidden="true">
        <div
          className="h-full transition-all"
          style={{
            width:           `${(totalSeen / totalAll) * 100}%`,
            backgroundColor: BRAND_YELLOW
          }}
        />
      </div>

      {/* Search + section chips */}
      <div className="border-b p-4" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"/>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search features (e.g. reveal, warranty, message)"
            className="h-10 w-full rounded-xl border-2 bg-neutral-50 pl-9 pr-3 text-[13px] outline-none focus:bg-white"
            style={{ borderColor: "rgba(0,0,0,0.08)" }}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <ChipBtn active={section === "all"} onClick={() => setSection("all")} count={sectionCounts.all}>All</ChipBtn>
          {GUIDE_SECTIONS.filter((s) => sectionCounts[s.id] > 0).map((s) => (
            <ChipBtn key={s.id} active={section === s.id} onClick={() => setSection(s.id)} count={sectionCounts[s.id]}>
              {s.label}
            </ChipBtn>
          ))}
        </div>
      </div>

      {/* Cards grid — full-width single column matching feed post card width */}
      <div ref={gridRef} className="flex flex-col gap-4 p-4">
        {filtered.length === 0 ? (
          <div className="col-span-full rounded-xl border-2 border-dashed p-8 text-center" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
            <p className="text-[13px] font-black text-neutral-900">No features match your search.</p>
            <p className="mt-1 text-[11.5px] text-neutral-600">Try a broader term or clear the filter.</p>
          </div>
        ) : (
          filtered.map((f) => (
            <HowItWorksCard
              key={f.id}
              feature={f}
              isSeen={seen.has(f.id)}
              isFocused={focused === f.id}
              onOpen={() => {
                markSeen(f.id);
                emitGuideEvent("tn:guide:featureView", { featureId: f.id });
              }}
              onShowMe={() => {
                if (f.tourSteps.length > 0) {
                  emitGuideEvent("tn:guide:tourStart", {
                    featureId: f.id,
                    stepCount: f.tourSteps.length
                  });
                  handleClose();               // close the guide overlay
                  setTimeout(() => runTour(f.tourSteps), 250);   // let the DOM settle
                }
              }}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t p-4 text-center text-[11px] text-neutral-500" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
        Missing something? Every card links a live SiteBook feature — new ones appear here as they ship.
      </div>
    </div>
  );
}

function ChipBtn({
  children, active, onClick, count
}: {
  children: React.ReactNode;
  active:   boolean;
  onClick:  () => void;
  count?:   number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider transition " +
        (active
          ? "text-neutral-900 shadow-sm"
          : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50")
      }
      style={active ? { backgroundColor: BRAND_YELLOW } : {}}
    >
      {children}
      {typeof count === "number" && (
        <span className={"rounded-full px-1.5 text-[9.5px] tabular-nums " +
          (active ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500")}
        >
          {count}
        </span>
      )}
    </button>
  );
}
