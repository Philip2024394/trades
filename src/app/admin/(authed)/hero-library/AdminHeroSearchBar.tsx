// AdminHeroSearchBar — client component. Provides a text search + a
// sibling-group filter dropdown. Both submit as GET params so the
// server component re-renders with filtered data.

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export type AdminHeroSearchBarProps = {
  siblingGroups: string[];
  currentQ: string;
  currentSibling: string;
};

export function AdminHeroSearchBar({
  siblingGroups,
  currentQ,
  currentSibling
}: AdminHeroSearchBarProps) {
  const router = useRouter();
  const search = useSearchParams();
  const [q, setQ] = useState(currentQ);
  const [sibling, setSibling] = useState(currentSibling);

  const submit = (next: { q?: string; sibling?: string }) => {
    const params = new URLSearchParams(search.toString());
    if (next.q !== undefined) {
      if (next.q) params.set("q", next.q);
      else params.delete("q");
    }
    if (next.sibling !== undefined) {
      if (next.sibling) params.set("sibling", next.sibling);
      else params.delete("sibling");
    }
    router.push(`/admin/hero-library?${params.toString()}`);
  };

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit({ q });
        }}
        className="flex flex-1 min-w-[240px] gap-1"
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          placeholder="Search id, subject, vibe…"
          className="flex-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[12px]"
        />
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-neutral-800"
        >
          Search
        </button>
      </form>
      <select
        value={sibling}
        onChange={(e) => {
          setSibling(e.currentTarget.value);
          submit({ sibling: e.currentTarget.value });
        }}
        className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-[12px]"
      >
        <option value="">All sibling groups</option>
        {siblingGroups.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
      {(currentQ || currentSibling) && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            setSibling("");
            router.push("/admin/hero-library");
          }}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-[12px] text-neutral-700 transition hover:bg-neutral-50"
        >
          Clear
        </button>
      )}
    </div>
  );
}
