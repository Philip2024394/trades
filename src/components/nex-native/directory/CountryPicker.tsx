"use client";

// src/components/nex-native/directory/CountryPicker.tsx
//
// NEX Directory · country picker.
//
// Button anchored inside the search field's right edge · 32-36px circle
// · opens a scrollable listbox (max-height ~320px) · 250 countries ·
// search input · ARIA listbox/option · keyboard navigation · focus
// return to the button on close.
//
// Flag asset strategy
//   The picker never ships an emoji flag — Windows does not render
//   regional-indicator sequences and would show "GB"/"ID". The default
//   render is a circular badge with the ISO-2 code (text-badge
//   fallback). A caller may pass `flagSrcFor(isoAlpha2) → string | null`
//   to resolve a real SVG asset (e.g. `/flags/<code>.svg`); when the
//   function returns null, the picker falls back to the text badge.
//   No new dependency is introduced.
//
// Data contract
//   `entries` is the already-joined { isoAlpha2, name, count } list from
//   `src/lib/nex-native/directory/country-counts.ts`. Component does
//   NOT fetch · the parent (server component) supplies.
//
// Behaviour on select
//   The component is URL-aware: it updates `?country=<code>` on the
//   current pathname via Next's `useRouter` and reflects the selection
//   in its own `selected` state. Caller can also hook `onChange` for
//   additional side effects (re-fetch listings, telemetry).

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export interface CountryEntry {
  readonly isoAlpha2: string;
  readonly name: string | null;
  readonly count: number;
}

export interface CountryPickerProps {
  /** Country list derived from nex.business_directory_v (counts > 0). */
  readonly entries: readonly CountryEntry[];
  /**
   * Initial selected country (ISO alpha-2 uppercase). The caller is
   * responsible for defaulting via IP geoip lookup
   * (`src/lib/nex-native/geo/geoip-lookup.ts`) or falling back to "ID".
   */
  readonly initialSelected: string;
  /**
   * Optional · resolve an SVG flag asset path for a country.
   * Return `null` to force the text-badge fallback for that country.
   * Default (undefined) → always text-badge.
   */
  readonly flagSrcFor?: (isoAlpha2: string) => string | null;
  /**
   * Optional · callback when the user picks a new country.
   * The component always updates the URL via `router.replace` even
   * when this is undefined.
   */
  readonly onChange?: (isoAlpha2: string) => void;
  /** Optional · accessible name override. */
  readonly ariaLabel?: string;
  /**
   * Trigger button appearance. "globe" renders a world/earth icon
   * (default · signals "click to change country"); "flag" renders
   * the currently-selected country's flag/ISO badge.
   */
  readonly triggerIcon?: "globe" | "flag";
}

/** Inline globe · no dependency · 24-viewbox stroke-based earth. */
function GlobeIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

interface FlagBadgeProps {
  readonly isoAlpha2: string;
  readonly size: number;
  readonly flagSrcFor?: (isoAlpha2: string) => string | null;
}

function FlagBadge({ isoAlpha2, size, flagSrcFor }: FlagBadgeProps) {
  const src = flagSrcFor ? flagSrcFor(isoAlpha2) : null;
  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    overflow: "hidden",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A1300",
    color: "#F2F5F8",
    fontSize: Math.max(10, Math.floor(size * 0.42)),
    fontWeight: 600,
    letterSpacing: 0,
    userSelect: "none",
    border: "1px solid rgba(255, 255, 255, 0.08)",
  };
  if (src) {
    return (
      <span style={style} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </span>
    );
  }
  return (
    <span style={style} aria-hidden="true">
      {isoAlpha2}
    </span>
  );
}

export function CountryPicker(props: CountryPickerProps) {
  const { entries, initialSelected, flagSrcFor, onChange, ariaLabel } = props;
  const triggerIcon = props.triggerIcon ?? "globe";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState(initialSelected.toUpperCase());
  const [activeIndex, setActiveIndex] = React.useState(0);

  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const listRef = React.useRef<HTMLUListElement | null>(null);

  // Keep selected in sync with props if the parent re-renders with a
  // different initial selected (rare but respects React semantics).
  React.useEffect(() => {
    setSelected(initialSelected.toUpperCase());
  }, [initialSelected]);

  const filtered = React.useMemo<readonly CountryEntry[]>(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return entries;
    return entries.filter((e) => {
      const name = (e.name ?? "").toLowerCase();
      return e.isoAlpha2.toLowerCase().includes(q) || name.includes(q);
    });
  }, [entries, query]);

  const selectedEntry = React.useMemo(
    () => entries.find((e) => e.isoAlpha2 === selected) ?? null,
    [entries, selected],
  );

  const close = React.useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
    // Focus returns to the trigger button per the sealed UI spec.
    requestAnimationFrame(() => buttonRef.current?.focus());
  }, []);

  const commit = React.useCallback(
    (isoAlpha2: string) => {
      const up = isoAlpha2.toUpperCase();
      setSelected(up);
      // Reflect in URL so the view is shareable + crawlable.
      const next = new URLSearchParams(Array.from(searchParams?.entries() ?? []));
      next.set("country", up);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
      onChange?.(up);
      close();
    },
    [close, onChange, pathname, router, searchParams],
  );

  // Open: focus the search box, position activeIndex on selected row
  // (so arrow-up / arrow-down don't start from the top when the user
  // is already on a specific country).
  React.useEffect(() => {
    if (!open) return;
    const idx = filtered.findIndex((e) => e.isoAlpha2 === selected);
    setActiveIndex(idx >= 0 ? idx : 0);
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [open, selected, filtered]);

  // Click-outside to close.
  React.useEffect(() => {
    if (!open) return;
    function onDocDown(ev: MouseEvent) {
      const b = buttonRef.current;
      const l = listRef.current;
      if (b && b.contains(ev.target as Node)) return;
      if (l && l.contains(ev.target as Node)) return;
      close();
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open, close]);

  const onKeyDown = React.useCallback(
    (ev: React.KeyboardEvent) => {
      if (!open) return;
      if (ev.key === "Escape") {
        ev.preventDefault();
        close();
        return;
      }
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
        return;
      }
      if (ev.key === "ArrowUp") {
        ev.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (ev.key === "Home") {
        ev.preventDefault();
        setActiveIndex(0);
        return;
      }
      if (ev.key === "End") {
        ev.preventDefault();
        setActiveIndex(filtered.length - 1);
        return;
      }
      if (ev.key === "Enter") {
        ev.preventDefault();
        const row = filtered[activeIndex];
        if (row) commit(row.isoAlpha2);
      }
    },
    [open, filtered, activeIndex, close, commit],
  );

  const selectedLabel =
    selectedEntry?.name ?? selected ?? "Country";

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        ref={buttonRef}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? `Change country — currently ${selectedLabel} (${selected})`}
        onClick={() => setOpen((o) => !o)}
        data-nex-directory-country-picker-trigger
        style={{
          width: 38,
          height: 38,
          padding: 0,
          borderRadius: "50%",
          border: "1px solid rgba(255, 255, 255, 0.18)",
          background: "transparent",
          color: "#F2F5F8",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {triggerIcon === "globe" ? (
          <GlobeIcon size={22} />
        ) : (
          <FlagBadge isoAlpha2={selected} size={28} flagSrcFor={flagSrcFor} />
        )}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Country list"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            width: 280,
            maxHeight: 360,
            backgroundColor: "rgba(3, 16, 29, 0.98)",
            color: "#F2F5F8",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: 8,
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.45)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 50,
          }}
        >
          <div style={{ padding: 8, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(ev) => {
                setQuery(ev.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search country"
              aria-controls="country-picker-listbox"
              aria-autocomplete="list"
              style={{
                width: "100%",
                padding: "6px 8px",
                fontSize: 13,
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.14)",
                backgroundColor: "rgba(255,255,255,0.04)",
                color: "inherit",
                outline: "none",
              }}
            />
          </div>
          <ul
            id="country-picker-listbox"
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            onKeyDown={onKeyDown}
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              overflowY: "auto",
              maxHeight: 320,
            }}
          >
            {filtered.length === 0 ? (
              <li
                role="option"
                aria-selected="false"
                aria-disabled="true"
                style={{ padding: "10px 12px", fontSize: 13, opacity: 0.65 }}
              >
                No match
              </li>
            ) : (
              filtered.map((entry, i) => {
                const isSelected = entry.isoAlpha2 === selected;
                const isActive = i === activeIndex;
                return (
                  <li
                    key={entry.isoAlpha2}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => commit(entry.isoAlpha2)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 10px",
                      fontSize: 13,
                      cursor: "pointer",
                      backgroundColor: isActive ? "rgba(255, 114, 0, 0.14)" : "transparent",
                      color: "inherit",
                    }}
                  >
                    <FlagBadge isoAlpha2={entry.isoAlpha2} size={20} flagSrcFor={flagSrcFor} />
                    <span
                      style={{ width: 24, fontVariantNumeric: "tabular-nums", opacity: 0.72 }}
                    >
                      {entry.isoAlpha2}
                    </span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.name ?? entry.isoAlpha2}
                    </span>
                    <span
                      style={{ opacity: 0.6, fontSize: 12, fontVariantNumeric: "tabular-nums" }}
                      aria-hidden="true"
                    >
                      {entry.count}
                    </span>
                    {isSelected ? (
                      <span aria-hidden="true" style={{ color: "#00AFFF" }}>
                        ✓
                      </span>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
