"use client";

// DesignSystemBrowser — the full-page catalogue browser.
//
// Every preview renders live with the merchant's active theme. A
// palette switcher lets the merchant try alternate palettes without
// leaving the browser — same components, different colours, instant
// preview update across the whole grid.

import { useMemo, useState } from "react";
import { designSystemRegistry } from "@/platform/design/registry";
// Side-effect: registers every built-in component before we list them.
import "@/platform/design/components";
import type { FrozenDesignComponent } from "@/platform/design/types";
import type { DesignComponentCategory } from "@/platform/design/types";
import type { DesignTheme } from "@/platform/design/theme/types";
import { PALETTES, type PaletteId } from "@/platform/design/theme/palettes";
import { DesignPreviewCard } from "./DesignPreviewCard";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";

const CATEGORY_LABELS: Record<DesignComponentCategory, string> = {
  typography: "Typography",
  buttons: "Buttons",
  containers: "Containers",
  cards: "Cards",
  forms: "Forms",
  navigation: "Navigation",
  sections: "Sections",
  media: "Media"
};

const ORDERED_CATEGORIES: DesignComponentCategory[] = [
  "typography",
  "buttons",
  "containers",
  "cards",
  "forms",
  "navigation",
  "sections",
  "media"
];

export function DesignSystemBrowser({
  brandName,
  merchantTheme
}: {
  brandName: string;
  merchantTheme: DesignTheme;
}) {
  const allComponents = useMemo(() => designSystemRegistry.list(), []);

  const [query, setQuery] = useState<string>("");
  const [activeCategory, setActiveCategory] =
    useState<DesignComponentCategory | null>(null);
  const [previewPalette, setPreviewPalette] = useState<PaletteId | "brand">(
    "brand"
  );

  const activeTheme: DesignTheme =
    previewPalette === "brand" ? merchantTheme : PALETTES[previewPalette];

  const visible = useMemo(() => {
    let out: FrozenDesignComponent[];
    if (query.trim()) {
      out = designSystemRegistry.search(query.trim(), 200);
    } else {
      out = allComponents;
    }
    if (activeCategory) {
      out = out.filter((c) => c.category === activeCategory);
    }
    return out;
  }, [allComponents, query, activeCategory]);

  const populatedCategories = useMemo(() => {
    const counts = new Map<DesignComponentCategory, number>();
    for (const c of allComponents) {
      counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
    }
    return counts;
  }, [allComponents]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 sm:py-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        {brandName} · Design System
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        Every component. Themed to your brand.
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        The visual foundation for every App, page, and section on your site.
        Previews below render with your live theme — switch the palette to
        see what other colour schemes would look like without leaving this
        page.
      </p>

      {/* Search + palette switcher */}
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-md">
          <label
            htmlFor="design-search"
            className="mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-neutral-500"
          >
            Search
          </label>
          <input
            id="design-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. quote button, hero, product card"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-neutral-900"
          />
        </div>

        <PaletteSwitcher
          active={previewPalette}
          onChange={setPreviewPalette}
        />
      </div>

      {/* Category tabs */}
      <div className="mt-6 flex flex-wrap gap-2 border-b border-neutral-200 pb-2">
        <CategoryPill
          label="All"
          count={allComponents.length}
          active={activeCategory === null}
          onClick={() => setActiveCategory(null)}
        />
        {ORDERED_CATEGORIES.map((cat) => {
          const count = populatedCategories.get(cat) ?? 0;
          return (
            <CategoryPill
              key={cat}
              label={CATEGORY_LABELS[cat]}
              count={count}
              active={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
              dim={count === 0}
            />
          );
        })}
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <EmptyState query={query} category={activeCategory} />
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => (
            <li key={c.id}>
              <DesignPreviewCard registration={c} theme={activeTheme} />
            </li>
          ))}
        </ul>
      )}

      {/* Footer note */}
      <p className="mt-12 text-center text-[11px] text-neutral-400">
        {allComponents.length} component
        {allComponents.length === 1 ? "" : "s"} registered · palette live
        preview updates the entire grid instantly
      </p>
    </div>
  );
}

// ─── Bits ─────────────────────────────────────────

function CategoryPill({
  label,
  count,
  active,
  onClick,
  dim
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  dim?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={dim && !active}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest transition disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        background: active ? BLACK : "transparent",
        color: active ? "#FFFFFF" : "#525252",
        borderColor: active ? BLACK : "#D4D4D4"
      }}
    >
      <span>{label}</span>
      <span
        className="rounded-full px-1.5 text-[9px]"
        style={{
          background: active ? "rgba(255,255,255,0.2)" : "#F5F5F5",
          color: active ? "#FFFFFF" : "#525252"
        }}
      >
        {count}
      </span>
    </button>
  );
}

function PaletteSwitcher({
  active,
  onChange
}: {
  active: PaletteId | "brand";
  onChange: (id: PaletteId | "brand") => void;
}) {
  const paletteIds = Object.keys(PALETTES) as PaletteId[];
  return (
    <div>
      <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
        Preview palette
      </p>
      <div className="flex flex-wrap gap-2">
        <PaletteChip
          label="Your brand"
          active={active === "brand"}
          onClick={() => onChange("brand")}
        />
        {paletteIds.map((id) => (
          <PaletteChip
            key={id}
            label={id.replace(/-/g, " ")}
            active={active === id}
            onClick={() => onChange(id)}
            colour={PALETTES[id].color.primary}
          />
        ))}
      </div>
    </div>
  );
}

function PaletteChip({
  label,
  active,
  onClick,
  colour
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  colour?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest transition"
      style={{
        background: active ? BLACK : "transparent",
        color: active ? "#FFFFFF" : "#525252",
        borderColor: active ? BLACK : "#D4D4D4"
      }}
    >
      {colour && (
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: colour }}
          aria-hidden="true"
        />
      )}
      <span>{label}</span>
    </button>
  );
}

function EmptyState({
  query,
  category
}: {
  query: string;
  category: DesignComponentCategory | null;
}) {
  const msg = query
    ? `No components match "${query}"${
        category ? ` in ${category}` : ""
      }.`
    : category
      ? `No components in "${category}" yet — this category populates as we ship more.`
      : "No components registered.";
  return (
    <div className="mt-12 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-16 text-center">
      <p className="text-[13px] font-bold text-neutral-600">{msg}</p>
      <p className="max-w-md text-[11px] text-neutral-500">
        Every new component appears here automatically once it&rsquo;s
        registered — no config, no cache to bust.
      </p>
    </div>
  );
}
