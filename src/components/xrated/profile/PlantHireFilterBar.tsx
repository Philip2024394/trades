"use client";

// PlantHireFilterBar — client-side filter over the plant tile grid.
// Filters run on data-* attributes stamped on each <li> by the server
// component so we don't need to hydrate the whole listing.
//
// Filters:
//   - text: matches against data-label
//   - available-today: only tiles with data-available-today="true"
//   - min/max weight (kg): matches data-weight (skips tiles without a spec)

import { useEffect, useMemo, useState } from "react";

type Cat = { slug: string; label: string; weight_kg: number | null; available_today: boolean };

export function PlantHireFilterBar({ categories }: { categories: Cat[] }) {
  const [text, setText] = useState("");
  const [availToday, setAvailToday] = useState(false);
  const [minWeight, setMinWeight] = useState("");
  const [maxWeight, setMaxWeight] = useState("");

  const matched = useMemo(() => {
    const t = text.trim().toLowerCase();
    const min = minWeight === "" ? null : Number(minWeight);
    const max = maxWeight === "" ? null : Number(maxWeight);
    return categories.filter((c) => {
      if (t && !c.label.toLowerCase().includes(t)) return false;
      if (availToday && !c.available_today) return false;
      if (min !== null && (c.weight_kg === null || c.weight_kg < min)) return false;
      if (max !== null && (c.weight_kg === null || c.weight_kg > max)) return false;
      return true;
    });
  }, [text, availToday, minWeight, maxWeight, categories]);

  useEffect(() => {
    const grid = document.getElementById("plant-tiles");
    if (!grid) return;
    const allowed = new Set(matched.map((m) => m.slug));
    for (const li of grid.querySelectorAll<HTMLLIElement>("li[data-slug]")) {
      const slug = li.dataset.slug;
      li.style.display = slug && allowed.has(slug) ? "" : "none";
    }
  }, [matched]);

  return (
    <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <label className="block">
          <span className="sr-only">Search</span>
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search machines (e.g. digger, telehandler, dumper)"
            className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-[13px] text-neutral-900 outline-none focus:border-[#FFB300]"
          />
        </label>
        <label className="block">
          <span className="sr-only">Min weight kg</span>
          <input
            type="number"
            min={0}
            value={minWeight}
            onChange={(e) => setMinWeight(e.target.value)}
            placeholder="Min kg"
            className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 font-mono text-[12px] text-neutral-900 outline-none focus:border-[#FFB300] sm:w-24"
          />
        </label>
        <label className="block">
          <span className="sr-only">Max weight kg</span>
          <input
            type="number"
            min={0}
            value={maxWeight}
            onChange={(e) => setMaxWeight(e.target.value)}
            placeholder="Max kg"
            className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 font-mono text-[12px] text-neutral-900 outline-none focus:border-[#FFB300] sm:w-24"
          />
        </label>
        <label className="inline-flex items-center gap-2 whitespace-nowrap text-[12px] font-bold text-neutral-800">
          <input
            type="checkbox"
            checked={availToday}
            onChange={(e) => setAvailToday(e.target.checked)}
            className="h-4 w-4 accent-[#FFB300]"
          />
          Available today
        </label>
      </div>
      <p className="mt-2 text-[11px] text-neutral-500">
        Showing {matched.length} of {categories.length} machines.
      </p>
    </div>
  );
}
