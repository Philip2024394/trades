"use client";

// Xrated Trades — premium-tier portfolio carousel.
// Replaces ProjectGalleryGrid on the premium layout. Renders projects as
// a horizontal snap-scroll carousel: 1-up on mobile, 2-up on desktop.
// Each card keeps the Before / During / After stage toggle pattern from
// the legacy grid, plus the Verified pill and the snap scroll prev/next
// affordances.

import { useCallback, useRef, useState } from "react";
import type { HammerexTradeOffProject } from "@/lib/supabase";

type Stage = "before" | "during" | "after";

const STAGE_LABEL: Record<Stage, string> = {
  before: "Before",
  during: "During",
  after: "After"
};

function stagesAvailable(p: HammerexTradeOffProject): Stage[] {
  const out: Stage[] = [];
  if (p.before_url) out.push("before");
  if (p.during_url) out.push("during");
  if (p.after_url) out.push("after");
  return out;
}

function stageUrl(p: HammerexTradeOffProject, stage: Stage): string | null {
  if (stage === "before") return p.before_url;
  if (stage === "during") return p.during_url;
  return p.after_url;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export function PortfolioCarousel({
  projects,
  themeColor
}: {
  projects: HammerexTradeOffProject[];
  themeColor: string;
}) {
  const scrollerRef = useRef<HTMLUListElement | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const scrollByCards = useCallback((dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    // Scroll by the width of one card (first child) so snap lines up.
    const first = el.querySelector<HTMLElement>("[data-portfolio-card]");
    const step = first ? first.offsetWidth + 16 /* gap */ : el.clientWidth * 0.9;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>("[data-portfolio-card]");
    const step = first ? first.offsetWidth + 16 : el.clientWidth * 0.9;
    if (step <= 0) return;
    setPageIndex(Math.round(el.scrollLeft / step));
  }, []);

  if (!projects || projects.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-2 pt-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: themeColor }}
          >
            Verified work
          </h2>
          <p className="mt-1 text-xs text-brand-muted">
            Swipe — every project verified by Hammerex Trade Off.
          </p>
        </div>
        <div className="hidden gap-2 sm:flex">
          <button
            type="button"
            aria-label="Previous projects"
            onClick={() => scrollByCards(-1)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-brand-line bg-brand-surface text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="More projects"
            onClick={() => scrollByCards(1)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-brand-line bg-brand-surface text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      <ul
        ref={scrollerRef}
        onScroll={onScroll}
        className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {projects.map((p) => (
          <li
            key={p.id}
            data-portfolio-card
            className="snap-start shrink-0 basis-[88%] sm:basis-[48%]"
          >
            <PortfolioCard project={p} themeColor={themeColor} />
          </li>
        ))}
      </ul>

      {/* Dots indicator — mobile-first feedback */}
      <div className="mt-2 flex items-center justify-center gap-1.5 sm:hidden">
        {projects.map((_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="block h-1.5 w-1.5 rounded-full transition"
            style={{
              background: i === pageIndex ? themeColor : "rgba(0,0,0,0.18)"
            }}
          />
        ))}
      </div>
    </section>
  );
}

function PortfolioCard({
  project,
  themeColor
}: {
  project: HammerexTradeOffProject;
  themeColor: string;
}) {
  const stages = stagesAvailable(project);
  const initial: Stage = stages[0] ?? "after";
  const [stage, setStage] = useState<Stage>(initial);
  const url = stageUrl(project, stage);
  const dateLabel = formatDate(project.completed_at);
  const showToggles = stages.length > 1;

  return (
    <article className="h-full overflow-hidden rounded-2xl border border-brand-line bg-brand-surface/40">
      <div className="relative aspect-[4/3] w-full bg-black">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={`${project.title} — ${STAGE_LABEL[stage]}`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-brand-muted">
            No photo
          </div>
        )}
        {project.verified && (
          <span
            className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm"
            style={{ background: themeColor, color: "#000" }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Verified
          </span>
        )}
        {showToggles && (
          <div
            role="tablist"
            aria-label={`${project.title} project stages`}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-full border border-white/15 bg-black/70 p-1 backdrop-blur"
          >
            {stages.map((s) => {
              const active = s === stage;
              return (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStage(s)}
                  className="h-8 rounded-full px-3 text-[11px] font-bold uppercase tracking-wide transition"
                  style={
                    active
                      ? { background: themeColor, color: "#000" }
                      : { color: "rgba(255,255,255,0.8)" }
                  }
                >
                  {STAGE_LABEL[s]}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <h3 className="text-[13px] font-bold text-brand-text">{project.title}</h3>
        {(project.location_city || dateLabel) && (
          <p className="text-[13px] text-brand-muted">
            {[project.location_city, dateLabel].filter(Boolean).join(" · ")}
          </p>
        )}
        {project.description && (
          <p className="text-[13px] leading-relaxed text-brand-muted">
            {project.description}
          </p>
        )}
      </div>
    </article>
  );
}
