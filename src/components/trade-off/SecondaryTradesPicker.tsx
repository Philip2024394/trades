"use client";

// Searchable secondary-trades picker. Replaces the 37-button wall with
// a combobox that:
//   - shows the picked trades as chips at the top (max 3),
//   - filters the curated TRADE_OFF_TRADES list by what the
//     tradesperson types,
//   - lets them add a CUSTOM trade name when their craft isn't in the
//     curated list (rendered as a chip just like a curated pick).
//
// Custom trades pass through to the API as plain strings (the array
// already accepts any string); display falls back to the string itself
// via tradeLabel(). No schema change required.

import { useMemo, useRef, useState } from "react";
import { TRADE_OFF_TRADES, tradeLabel } from "@/lib/tradeOff";

const MAX = 3;

export function SecondaryTradesPicker({
  primaryTrade,
  value,
  onChange
}: {
  primaryTrade: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();

  // Filter: exclude the primary trade + anything already picked, and
  // match against either the curated label or the slug so a tradie can
  // type "merchant" or "building-merchant" and find the same row.
  const matches = useMemo(() => {
    const taken = new Set([primaryTrade, ...value]);
    return TRADE_OFF_TRADES.filter((t) => {
      if (taken.has(t.slug)) return false;
      if (lower.length === 0) return true;
      return (
        t.label.toLowerCase().includes(lower) ||
        t.slug.toLowerCase().includes(lower)
      );
    }).slice(0, 8);
  }, [primaryTrade, value, lower]);

  // Custom-add row appears when there's a non-empty query AND no
  // curated row exactly matches it (label-insensitive). Prevents the
  // tradesperson from creating a "Plumber" custom when "plumber" is
  // already curated under a different slug.
  const exactMatch = trimmed.length > 0
    && TRADE_OFF_TRADES.some(
      (t) =>
        t.label.toLowerCase() === lower ||
        t.slug.toLowerCase() === lower
    );
  const showCustomRow =
    trimmed.length >= 2 && !exactMatch && !value.includes(trimmed);

  const atCap = value.length >= MAX;

  function add(slugOrLabel: string) {
    if (atCap) return;
    if (value.includes(slugOrLabel)) return;
    onChange([...value, slugOrLabel]);
    setQuery("");
    setOpen(true);
    inputRef.current?.focus();
  }

  function remove(slugOrLabel: string) {
    onChange(value.filter((v) => v !== slugOrLabel));
  }

  return (
    <div className="space-y-2">
      {/* Selected chips — what the API will receive. Remove via the × on
          each chip. Empty state is the helper line below. */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((slug) => (
            <span
              key={slug}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-brand-line bg-brand-surface pl-3 pr-1 text-[13px] font-semibold text-brand-text"
            >
              {tradeLabel(slug)}
              <button
                type="button"
                onClick={() => remove(slug)}
                aria-label={`Remove ${tradeLabel(slug)}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-brand-muted transition hover:bg-neutral-100 hover:text-neutral-900"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Combobox — search/typeahead + scrollable matches. The list only
          renders while focused or while the tradie is mid-search so a
          calm form doesn't sprout a permanent dropdown. */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={atCap}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Defer close so a click on a suggestion lands before the
            // panel unmounts. 120ms is a forgiving click target.
            window.setTimeout(() => setOpen(false), 120);
          }}
          placeholder={
            atCap
              ? `${MAX}/${MAX} picked — remove one to add another`
              : "Search trades, or type your own"
          }
          className="h-11 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none disabled:opacity-60"
        />
        {open && !atCap && (matches.length > 0 || showCustomRow) && (
          <ul
            className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-brand-line bg-white shadow-lg"
            // Block the input's blur from firing when the user mouses
            // down on a suggestion — the blur would close us first.
            onMouseDown={(e) => e.preventDefault()}
          >
            {matches.map((t) => (
              <li key={t.slug}>
                <button
                  type="button"
                  onClick={() => add(t.slug)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[13px] text-brand-text transition hover:bg-brand-surface"
                >
                  <span>{t.label}</span>
                  <span className="text-[11px] uppercase tracking-wider text-brand-muted">
                    Add
                  </span>
                </button>
              </li>
            ))}
            {showCustomRow && (
              <li
                className={
                  matches.length > 0
                    ? "border-t border-brand-line"
                    : ""
                }
              >
                <button
                  type="button"
                  onClick={() => add(trimmed)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[13px] font-bold text-brand-text transition hover:bg-brand-surface"
                >
                  <span>
                    + Use &ldquo;{trimmed}&rdquo; as your trade
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-neutral-900"
                    style={{ background: "var(--trade-accent, #FFB300)" }}
                  >
                    Custom
                  </span>
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      <p className="text-[13px] text-brand-muted">
        Pick up to {MAX}. Don&rsquo;t see your trade?{" "}
        <span className="font-bold text-brand-text">
          Type it in and tap &ldquo;Custom&rdquo;
        </span>{" "}
        — we&rsquo;ll show it on your profile as you wrote it.
      </p>
    </div>
  );
}
