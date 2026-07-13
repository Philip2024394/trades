"use client";

// TradePickerGrouped — the grouped trade selector for signup.
//
// Layout:
//   - Sticky search input at top (filters across every group)
//   - Selected-trade preview strip (only when something is picked)
//   - Ordered groups, each with a header + helper + wrap-flow of chips
//   - Bottom "Can't find yours?" custom-entry card that expands to a
//     text input when tapped
//
// Design rules baked in:
//   - Core Trades group appears first (Philip's strong-trades-on-top
//     rule from feedback)
//   - Chip labels are the raw trade label, no truncation
//   - Selected chip gets brand-yellow filled state
//   - Search matches label OR slug OR group label (fuzzy-friendly)
//   - Custom entry captures a free-text label bound to CUSTOM_TRADE_SLUG
//   - "No matches" empty state routes straight to custom entry
//
// Not force-wired into TradeOffForm — that's 2347 lines and risky.
// Slots into any new signup surface (wizard route, revamp, etc.) via
// controlled value + onChange.

import { useMemo, useState } from "react";
import { Search, ChevronDown, ChevronUp, X as XIcon, Sparkles, PenSquare, Check } from "lucide-react";
import { TRADE_GROUPS, TRADE_OFF_TRADES, CUSTOM_TRADE_SLUG, tradesByGroup } from "@/lib/tradeOff";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

export type TradePickerValue =
  | { kind: "known"; slug: string }
  | { kind: "custom"; label: string };

export function TradePickerGrouped({
  value,
  onChange,
  defaultCollapsedGroups = false
}: {
  value: TradePickerValue | null;
  onChange: (v: TradePickerValue | null) => void;
  /** When true, all non-core groups start collapsed. Useful in the
   *  wizard route where the initial view should feel less overwhelming. */
  defaultCollapsedGroups?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [customOpen, setCustomOpen] = useState(value?.kind === "custom");
  const [customText, setCustomText] = useState(value?.kind === "custom" ? value.label : "");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    if (!defaultCollapsedGroups) return new Set();
    // First group (core trades) stays open by default even in
    // "collapsed" mode — the strong trades must always be visible.
    return new Set(TRADE_GROUPS.slice(1).map((g) => g.slug));
  });

  const normalizedQuery = query.trim().toLowerCase();
  const searching = normalizedQuery.length > 0;

  const filteredGroups = useMemo(() => {
    if (!searching) {
      return TRADE_GROUPS.map((g) => ({ ...g, matches: tradesByGroup(g.slug) }));
    }
    return TRADE_GROUPS.map((g) => {
      const matches = tradesByGroup(g.slug).filter(
        (t) =>
          t.label.toLowerCase().includes(normalizedQuery) ||
          t.slug.includes(normalizedQuery) ||
          g.label.toLowerCase().includes(normalizedQuery)
      );
      return { ...g, matches };
    }).filter((g) => g.matches.length > 0);
  }, [normalizedQuery, searching]);

  const selectedLabel = useMemo(() => {
    if (!value) return null;
    if (value.kind === "custom") return value.label;
    return TRADE_OFF_TRADES.find((t) => t.slug === value.slug)?.label ?? value.slug;
  }, [value]);

  const selectKnown = (slug: string) => {
    setCustomOpen(false);
    onChange({ kind: "known", slug });
  };

  const submitCustom = () => {
    const label = customText.trim().slice(0, 60);
    if (label.length < 3) return;
    onChange({ kind: "custom", label });
  };

  const clear = () => {
    setCustomOpen(false);
    setCustomText("");
    onChange(null);
  };

  const toggleGroup = (slug: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const noMatches = searching && filteredGroups.length === 0;

  return (
    <div>
      {/* Search input — sticky-eligible; up to the parent to wrap in a
          sticky container if desired. */}
      <div
        className="flex items-center gap-2 rounded-full border bg-white px-3 py-2 shadow-sm"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <Search size={14} className="flex-shrink-0 text-neutral-400"/>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search 180+ trades. Try 'kitchen', 'CCTV', 'architect'..."
          className="min-w-0 flex-1 bg-transparent text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
            aria-label="Clear search"
          >
            <XIcon size={10}/>
          </button>
        )}
      </div>

      {/* Selected preview */}
      {selectedLabel && (
        <div
          className="mt-3 flex items-center gap-2 rounded-xl border-2 p-3 shadow-sm"
          style={{
            borderColor: BRAND_GREEN_DARK,
            backgroundColor: `${BRAND_GREEN_DARK}0F`
          }}
        >
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: BRAND_GREEN_DARK }}
          >
            <Check size={14} color="#FFFFFF" strokeWidth={2.5}/>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: BRAND_GREEN_DARK }}>
              You're signing up as
            </div>
            <div className="truncate text-[14px] font-black text-neutral-900">
              {selectedLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={clear}
            className="flex h-8 flex-shrink-0 items-center justify-center rounded-full border px-3 text-[10px] font-black uppercase tracking-wider text-neutral-600 transition hover:bg-white"
            style={{ borderColor: "rgba(139,69,19,0.20)" }}
          >
            Change
          </button>
        </div>
      )}

      {/* Grouped list */}
      <div className="mt-4 flex flex-col gap-4">
        {filteredGroups.map((group, groupIdx) => {
          const collapsed = collapsedGroups.has(group.slug);
          const showChips = searching || !collapsed;
          return (
            <section
              key={group.slug}
              className="rounded-2xl border bg-white p-4 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <button
                type="button"
                onClick={() => !searching && toggleGroup(group.slug)}
                className="flex w-full items-start justify-between text-left"
                aria-expanded={showChips}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {groupIdx === 0 && (
                      <Sparkles size={12} color={BRAND_YELLOW} strokeWidth={2.5}/>
                    )}
                    <span className="text-[10px] font-black uppercase tracking-[0.24em] text-neutral-700">
                      {group.label}
                    </span>
                    <span className="text-[10px] font-black text-neutral-400">
                      · {group.matches.length}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                    {group.helper}
                  </p>
                </div>
                {!searching && (
                  <span className="ml-2 flex-shrink-0 text-neutral-400">
                    {collapsed ? <ChevronDown size={16}/> : <ChevronUp size={16}/>}
                  </span>
                )}
              </button>
              {showChips && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {group.matches.map((t) => (
                    <TradeChip
                      key={t.slug}
                      label={t.label}
                      selected={value?.kind === "known" && value.slug === t.slug}
                      onClick={() => selectKnown(t.slug)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* No matches — nudge to custom entry */}
      {noMatches && (
        <div
          className="mt-4 rounded-2xl border-2 border-dashed p-6 text-center"
          style={{ borderColor: `${BRAND_YELLOW}66`, backgroundColor: `${BRAND_YELLOW}0F` }}
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: BRAND_YELLOW }}>
            <PenSquare size={22} color={BRAND_BLACK} strokeWidth={2}/>
          </div>
          <p className="mt-3 text-[10px] font-black uppercase tracking-[0.24em] text-neutral-700">
            Not a match
          </p>
          <h3 className="mt-1 text-[15px] font-black text-neutral-900">
            "{query}" isn't in the list yet.
          </h3>
          <p className="mt-1 text-[12px] leading-snug text-neutral-600">
            Enter your trade below — every custom trade helps The Network's next tradesperson find their category.
          </p>
        </div>
      )}

      {/* Custom entry — always available at the bottom */}
      <section
        className="mt-4 overflow-hidden rounded-2xl border-2 shadow-sm"
        style={{ borderColor: value?.kind === "custom" ? BRAND_GREEN_DARK : BRAND_YELLOW }}
      >
        {!customOpen ? (
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="flex w-full items-center justify-between p-4 text-left transition hover:bg-yellow-50/50"
            style={{ backgroundColor: `${BRAND_YELLOW}0F` }}
          >
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
                Can't find yours?
              </div>
              <div className="mt-0.5 text-[13px] font-black text-neutral-900">
                Enter your trade in your own words
              </div>
            </div>
            <span
              className="flex h-9 items-center gap-1 rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
              style={{ backgroundColor: BRAND_YELLOW }}
            >
              <PenSquare size={11} strokeWidth={2.5}/>
              Add
            </span>
          </button>
        ) : (
          <div className="p-4" style={{ backgroundColor: `${BRAND_YELLOW}0F` }}>
            <div className="flex items-center gap-1.5">
              <PenSquare size={12} color={BRAND_BLACK} strokeWidth={2.5}/>
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
                Your trade
              </span>
            </div>
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value.slice(0, 60))}
              placeholder="e.g. Rope-access technician, Yurt-builder..."
              className="mt-2 w-full rounded-lg border bg-white p-3 text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2"
              style={{ borderColor: "rgba(139,69,19,0.20)" }}
              autoFocus
            />
            <p className="mt-1.5 text-[11px] leading-snug text-neutral-500">
              Custom trades appear on your profile as-is. Verified against a real business email + phone during onboarding — no fake categories.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={submitCustom}
                disabled={customText.trim().length < 3}
                className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: BRAND_YELLOW }}
              >
                <Check size={12} strokeWidth={2.5}/>
                Use this trade
              </button>
              <button
                type="button"
                onClick={() => { setCustomOpen(false); setCustomText(""); }}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[11px] font-black uppercase tracking-wider text-neutral-600 transition hover:bg-white"
                style={{ borderColor: "rgba(139,69,19,0.20)" }}
              >
                Cancel
              </button>
            </div>
            {value?.kind === "custom" && (
              <div className="mt-2 text-[10px] font-black uppercase tracking-wider" style={{ color: BRAND_GREEN_DARK }}>
                <Check size={11} strokeWidth={2.5} className="mr-0.5 inline"/>
                Saved as "{value.label}"
              </div>
            )}
          </div>
        )}
      </section>

      {/* Debug — custom slug reservation. Rendered as a comment so
          it's grepable but doesn't leak to the DOM. */}
      {/* Custom trades submit under slug = "${CUSTOM_TRADE_SLUG}" */}
    </div>
  );
}

function TradeChip({
  label,
  selected,
  onClick
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[11px] font-black transition"
      style={
        selected
          ? { backgroundColor: BRAND_YELLOW, borderColor: BRAND_YELLOW, color: BRAND_BLACK }
          : { backgroundColor: "#FFFFFF", borderColor: "rgba(139,69,19,0.20)", color: "#525252" }
      }
    >
      {selected && <Check size={11} strokeWidth={2.5}/>}
      {label}
    </button>
  );
}
