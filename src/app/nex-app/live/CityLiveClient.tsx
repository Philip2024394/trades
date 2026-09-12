"use client";

// src/app/nex-app/live/CityLiveClient.tsx
//
// NEX · Phase D · City Live "What's Happening?" client
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase D
//
// PURPOSE (§11 §12 §13 §15 §36 §44)
//   Renders the city-first Live discovery experience INSIDE the NEX
//   phone shell (max-w-md, cream surface, NEX header semantics).
//
// TRUTH RULES
//   · §35 · every displayed group answers "how do you know?" with real
//     evidence coming from /api/nex-live/tonight (fixture-backed).
//   · §36 · categories with zero items are NEVER shown as empty chips.
//   · §15 · horizontal exploration WITHIN a section · vertical scroll
//     across sections. That's the calm mental model.
//   · §14 · zero manufactured metadata (no viewer count / trending / likes).

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, RotateCcw } from "lucide-react";
import { EntityLiveCarousel, type EntityLiveCard } from "@/components/nex-app/live/EntityLiveCarousel";
import { groupCityLiveByStatus, filterCityLiveByCategory, availableCategoriesFromItems, type CityLiveApiItem, type CityLiveCategory } from "@/lib/nex/live/city-live-groupings";

export type CityLiveClientProps = {
  defaultCity: string;
  defaultCityLabel: string;
};

type LoadState = "IDLE" | "LOADING" | "READY" | "ERROR";

export function CityLiveClient({ defaultCity, defaultCityLabel }: CityLiveClientProps) {
  const [items, setItems] = useState<CityLiveApiItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<CityLiveCategory>("all");

  const fetchItems = useCallback(async () => {
    setLoadState("LOADING");
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("city", defaultCity);
      params.set("status", "LIVE_NOW,STARTING_SOON,TONIGHT");
      params.set("limit", "30");
      const r = await fetch(`/api/nex-live/tonight?${params.toString()}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
      setItems(Array.isArray(j?.items) ? j.items : []);
      setLoadState("READY");
    } catch (e) {
      setError((e as Error).message);
      setLoadState("ERROR");
    }
  }, [defaultCity]);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  const availableCategories = useMemo(() => availableCategoriesFromItems(items), [items]);
  const filtered = useMemo(() => filterCityLiveByCategory(items, category), [items, category]);
  const groups = useMemo(() => groupCityLiveByStatus(filtered), [filtered]);

  return (
    <div
      className="relative mx-auto flex min-h-screen max-w-md flex-col bg-[var(--nex-cream,#FDFCF9)] pb-16"
      data-testid="nex-city-live-root"
      data-scope="phone-frame"
      data-city={defaultCity}
    >
      {/* In-shell header · matches NEX phone semantics · not a desktop header */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-black/5 bg-[var(--nex-cream,#FDFCF9)]/95 px-3 py-2 backdrop-blur">
        <Link
          href="/nex-appchat"
          className="grid h-9 w-9 place-items-center rounded-full text-[var(--nex-neutral-700,#444)] transition hover:bg-black/[0.06]"
          aria-label="Back to NEX"
          data-testid="nex-city-live-back"
        >
          <ChevronLeft size={20} strokeWidth={2.2} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-widest text-[var(--nex-neutral-500,#666)]">
            What&apos;s happening?
          </div>
          <div className="truncate text-[15px] font-semibold text-[var(--nex-neutral-900,#111)]">
            Live in {defaultCityLabel}
          </div>
        </div>
        <button
          type="button"
          onClick={fetchItems}
          className="grid h-9 w-9 place-items-center rounded-full text-[var(--nex-neutral-700,#444)] transition hover:bg-black/[0.06]"
          aria-label="Refresh"
          data-testid="nex-city-live-refresh"
        >
          <RotateCcw size={16} strokeWidth={2.2} />
        </button>
      </header>

      {/* Category chips · only rendered for categories that have real items */}
      {loadState === "READY" && items.length > 0 && (
        <div
          className="flex gap-2 overflow-x-auto px-3 py-3 border-b border-black/5"
          data-testid="nex-city-live-category-chips"
          style={{ scrollbarWidth: "none" }}
        >
          <CategoryChip label="All" active={category === "all"} onClick={() => setCategory("all")} testId="all" />
          {availableCategories.map((c) => (
            <CategoryChip
              key={c.id}
              label={c.label}
              active={category === c.id}
              onClick={() => setCategory(c.id)}
              testId={c.id}
            />
          ))}
        </div>
      )}

      {/* States */}
      {loadState === "LOADING" && (
        <div className="flex-1 grid place-items-center text-[13px] text-[var(--nex-neutral-500,#666)]">
          Loading tonight’s Live…
        </div>
      )}

      {loadState === "ERROR" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="text-[14px] text-[var(--nex-neutral-900,#111)] font-semibold">
            Could not reach Live discovery
          </div>
          <div className="text-[12px] text-[var(--nex-neutral-500,#666)]">{error}</div>
          <button
            type="button"
            onClick={fetchItems}
            className="rounded-full bg-orange-500 px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-600"
          >
            Retry
          </button>
        </div>
      )}

      {loadState === "READY" && items.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <div className="text-[14px] text-[var(--nex-neutral-900,#111)] font-semibold">
            Nothing Live right now
          </div>
          <div className="text-[12px] text-[var(--nex-neutral-500,#666)]">
            NEX will surface real events here when they start · we do not fabricate activity.
          </div>
        </div>
      )}

      {loadState === "READY" && items.length > 0 && (
        <div className="flex-1 bg-neutral-950 text-white">
          <StatusSection label="Live now" cards={groups.liveNow} emptyLabel="Nothing live right this second." />
          <StatusSection label="Starting soon" cards={groups.startingSoon} emptyLabel="Nothing starting in the next hour." />
          <StatusSection label="Tonight" cards={groups.tonight} emptyLabel="Nothing else scheduled tonight." />
        </div>
      )}
    </div>
  );
}

function CategoryChip({ label, active, onClick, testId }: { label: string; active: boolean; onClick: () => void; testId: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`nex-city-live-chip-${testId}`}
      aria-pressed={active}
      className={[
        "flex-shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap transition",
        active
          ? "bg-neutral-900 text-white"
          : "bg-white border border-black/10 text-[var(--nex-neutral-700,#444)] hover:border-black/20",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function StatusSection({
  label,
  cards,
  emptyLabel,
}: {
  label: string;
  cards: EntityLiveCard[];
  emptyLabel: string;
}) {
  return (
    <section
      data-testid={`nex-city-live-section-${label.toLowerCase().replace(/\s+/g, "-")}`}
      data-card-count={cards.length}
    >
      {cards.length > 0 ? (
        <EntityLiveCarousel
          entity_name={label}
          cards={cards}
          emptyLabel={emptyLabel}
        />
      ) : (
        <div className="px-4 py-3 text-[11px] text-white/40 border-b border-white/5">
          <span className="uppercase tracking-widest text-white/50">{label}</span>
          <span className="ml-2">· {emptyLabel}</span>
        </div>
      )}
    </section>
  );
}
