// Live Feed App editor — Studio-mode content editor.
//
// Per memory rule feedback_studio_appearance_vs_content, the Studio
// section toolbar is styling-only; this editor edits CONTENT (heading,
// subhead, limit, chip toggle). Studio opens this component when the
// merchant taps "Edit content →" on the section.

"use client";

import type { StudioAppEditorProps } from "@/platform/studio/manifest";

export function LiveFeedAppEditor({ content, onChange }: StudioAppEditorProps) {
  const heading =
    typeof content.heading === "string" ? content.heading : "Recent work";
  const subhead =
    typeof content.subhead === "string"
      ? content.subhead
      : "Fresh jobs, straight from the site.";
  const limit = typeof content.limit === "number" ? content.limit : 6;
  const showFacetChips = content.showFacetChips !== false;

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Heading
        </span>
        <input
          type="text"
          value={heading}
          onChange={(e) => onChange({ heading: e.currentTarget.value })}
          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px]"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Subhead
        </span>
        <input
          type="text"
          value={subhead}
          onChange={(e) => onChange({ subhead: e.currentTarget.value })}
          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px]"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Post count
        </span>
        <input
          type="number"
          min={3}
          max={24}
          value={limit}
          onChange={(e) => onChange({ limit: Number(e.currentTarget.value) })}
          className="w-24 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px]"
        />
      </label>
      <label className="flex items-center gap-2 text-[12px] text-neutral-800">
        <input
          type="checkbox"
          checked={showFacetChips}
          onChange={(e) => onChange({ showFacetChips: e.currentTarget.checked })}
        />
        Show trade / material chips
      </label>
    </div>
  );
}
