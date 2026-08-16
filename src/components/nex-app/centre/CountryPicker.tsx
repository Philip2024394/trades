"use client";

// NEX Trade Centre · CountryPicker
//
// ONE Trade Centre · ONE URL · country as first-class filter.
// Panel grouped by region_group (never a <select>). "All countries" pinned.
// "Change market" affordance = the trigger button itself; every mounted
// surface must render the picker in its header.
//
// This component is deliberately UI-only. Persistence + IP default live in
// the countryStore + the mounting surface — the picker only exposes value
// and onChange.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  COUNTRIES,
  REGION_GROUPS,
  type Country,
  type CountryCode,
  type RegionGroup,
} from "@/lib/nex/geography/countries";
import type { SelectedCountry } from "@/lib/nex/geography/countryStore";

export type CountryPickerProps = {
  value: SelectedCountry;
  onChange: (next: SelectedCountry) => void;
  /** Optional row-count chips shown next to each active country. */
  counts?: Partial<Record<CountryCode | "all", number>>;
  /** Compact = header pill; sheet = full panel (mobile / owner surfaces). */
  variant?: "compact" | "sheet";
  /** Aria label for the trigger — override when the surrounding label is unclear. */
  label?: string;
};

const REGION_LABELS: Record<RegionGroup, string> = {
  Europe: "Europe",
  "North America": "North America",
  APAC: "APAC",
  MEA: "Middle East · Africa",
  "South America": "South America",
};

function formatCount(n: number | undefined): string | null {
  if (typeof n !== "number") return null;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

export function CountryPicker({
  value,
  onChange,
  counts,
  variant = "compact",
  label = "Change market",
}: CountryPickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const grouped = useMemo(() => {
    const map = new Map<RegionGroup, Country[]>();
    for (const g of REGION_GROUPS) map.set(g, []);
    for (const c of COUNTRIES) map.get(c.region_group)?.push(c);
    return map;
  }, []);

  const selected: Country | null = useMemo(() => {
    if (value === "all") return null;
    return COUNTRIES.find((c) => c.code === value) ?? null;
  }, [value]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onClick(e: MouseEvent) {
      const target = e.target as Node | null;
      if (
        panelRef.current &&
        target &&
        !panelRef.current.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  // Focus the first selectable option when the panel opens.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const firstOption = panelRef.current?.querySelector<HTMLButtonElement>(
        'button[data-country-option]:not([disabled])'
      );
      firstOption?.focus();
    }, 20);
    return () => clearTimeout(t);
  }, [open]);

  const activeCount = counts?.all ?? undefined;

  const triggerLabel = selected
    ? `${selected.flag} ${selected.short_name ?? selected.name}`
    : "🌍 All countries";

  function handleSelect(next: SelectedCountry) {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  }

  const isSheet = variant === "sheet";

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/80 shadow-sm hover:bg-black/5"
      >
        <span aria-hidden>{triggerLabel}</span>
        <span aria-hidden className="text-black/40">▾</span>
      </button>

      {open && (
        <>
          {isSheet && (
            <div
              className="fixed inset-0 z-40 bg-black/30"
              aria-hidden
              onClick={() => setOpen(false)}
            />
          )}
          <div
            ref={panelRef}
            role="dialog"
            aria-modal={isSheet}
            aria-labelledby="country-picker-title"
            className={
              isSheet
                ? "fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl"
                : "absolute right-0 z-30 mt-2 w-[320px] max-h-[500px] overflow-y-auto rounded-2xl border border-black/10 bg-white p-3 shadow-xl"
            }
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <h2 id="country-picker-title" className="text-[11px] font-black uppercase tracking-wide text-black/60">
                Change market
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close market picker"
                className="rounded-full p-1 text-black/40 hover:bg-black/5 hover:text-black/70"
              >
                <span aria-hidden>×</span>
              </button>
            </div>

            {/* All countries · pinned */}
            <button
              type="button"
              data-country-option
              role="menuitemradio"
              aria-checked={value === "all"}
              onClick={() => handleSelect("all")}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                value === "all" ? "bg-black/5 font-semibold" : "hover:bg-black/5"
              }`}
            >
              <span className="flex items-center gap-2">
                <span aria-hidden>🌍</span>
                <span>All countries</span>
              </span>
              {typeof activeCount === "number" && (
                <span className="text-[11px] font-semibold text-black/50">
                  {formatCount(activeCount)}
                </span>
              )}
            </button>

            <div className="my-2 border-t border-black/5" />

            {REGION_GROUPS.map((group) => {
              const entries = grouped.get(group) ?? [];
              if (entries.length === 0) return null;
              const anyActive = entries.some((c) => c.active);
              return (
                <div key={group} className="mb-3">
                  <div className="px-2 pb-1 text-[10px] font-black uppercase tracking-[0.08em] text-black/40">
                    {REGION_LABELS[group]}
                  </div>
                  <ul className="flex flex-col gap-0.5">
                    {entries.map((c) => {
                      const isSelected = value === c.code;
                      const chip = formatCount(counts?.[c.code]);
                      return (
                        <li key={c.code}>
                          <button
                            type="button"
                            data-country-option
                            role="menuitemradio"
                            aria-checked={isSelected}
                            aria-disabled={!c.active}
                            tabIndex={c.active ? 0 : -1}
                            disabled={!c.active}
                            onClick={() => c.active && handleSelect(c.code)}
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm transition ${
                              !c.active
                                ? "cursor-not-allowed text-black/30"
                                : isSelected
                                ? "bg-black/5 font-semibold text-black"
                                : "text-black/80 hover:bg-black/5"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span aria-hidden>{c.flag}</span>
                              <span>{c.name}</span>
                              {!c.active && (
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-black/30">
                                  coming soon
                                </span>
                              )}
                            </span>
                            {c.active && chip && (
                              <span className="text-[11px] font-semibold text-black/50">
                                {chip}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                    {!anyActive && (
                      <li className="px-3 py-1 text-[11px] italic text-black/30">
                        no active markets yet
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}

            <p className="mt-1 border-t border-black/5 px-2 pt-2 text-[10px] leading-snug text-black/40">
              NEX Trade Centre is one marketplace across every market you choose.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
