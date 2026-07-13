// Toolbar for the Notebook regulars view.
//
// Search + sort filter. View-mode toggles were removed — the notebook
// only renders landscape cards now, so there's no view to switch.

"use client";

import { Search, Filter } from "lucide-react";

export type NotebookSortMode =
  | "nearest"
  | "cheapest"
  | "discounted"
  | "clearance"
  | "most-reordered"
  | "recent"
  | "az";

// Kept for backwards compatibility with existing page prop drilling.
// The toolbar no longer renders view toggles, but callers still track
// the mode and pass it through.
export type NotebookViewMode = "grid" | "list" | "compact";

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  sort: NotebookSortMode;
  onSortChange: (s: NotebookSortMode) => void;
  view?: NotebookViewMode;
  onViewChange?: (v: NotebookViewMode) => void;
  /** Kept for compatibility with the old visible / total counter; unused now. */
  totalCount?: number;
  visibleCount?: number;
};

const SORT_LABELS: Record<NotebookSortMode, string> = {
  nearest:          "Nearest merchant",
  cheapest:         "Cheapest (your choice) ⓘ",
  discounted:       "Discounted first",
  clearance:        "Clearance / end-of-line",
  "most-reordered": "Most reordered",
  recent:           "Recently added",
  az:               "A → Z"
};

export function NotebookToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange
}: Props) {
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border bg-white p-3 shadow-sm md:flex-row md:items-center"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      {/* Search */}
      <label
        className="flex min-h-[44px] flex-1 items-center gap-2 rounded-md border bg-neutral-50 px-3"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <Search size={13} className="text-neutral-500"/>
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search your notebook — trowel, multi-finish, PVA…"
          className="flex-1 bg-transparent text-[13px] text-neutral-900 outline-none placeholder:text-neutral-400"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
          >
            Clear
          </button>
        )}
      </label>

      {/* Filter label + sort dropdown */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-600">
          <Filter size={12} className="text-neutral-500"/>
          Filter
        </span>
        <label
          className="flex min-h-[44px] items-center gap-2 rounded-md border bg-neutral-50 px-3 md:min-w-[220px]"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as NotebookSortMode)}
            className="flex-1 bg-transparent text-[12.5px] text-neutral-900 outline-none"
          >
            {(Object.keys(SORT_LABELS) as NotebookSortMode[]).map((s) => (
              <option key={s} value={s}>{SORT_LABELS[s]}</option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
