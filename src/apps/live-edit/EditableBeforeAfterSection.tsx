// EditableBeforeAfterSection — Before/After viewer wrapped in the
// live-edit framework. In edit mode:
//   - Floating pencil opens the editor sheet
//   - Sheet shows: pair list (drag-reorder future), library-suggested
//     pairs matching the merchant's trade keywords, add-your-own upload,
//     and per-pair caption/label/orientation controls
//   - Any change marks the page dirty for the Publish button

"use client";

import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { BeforeAfterViewer } from "@/apps/before-after/BeforeAfterViewer";
import {
  matchBeforeAfterForMerchant,
  siblingsFromBeforeAfterList
} from "@/lib/before-after/library";
import type {
  BeforeAfterLibraryEntry,
  BeforeAfterPair
} from "@/lib/before-after/types";
import { Sparkles } from "lucide-react";
import { useEditMode } from "./EditModeContext";
import { EditableSection } from "./EditableSection";

export type EditableBeforeAfterSectionProps = {
  id: string;
  merchantTradeKeywords: string[];
  initialPairs?: BeforeAfterPair[];
  heading?: string;
  subhead?: string;
};

const MAX_PAIRS = 4;

function entryToPair(entry: BeforeAfterLibraryEntry): BeforeAfterPair {
  return {
    id: entry.id,
    mode: entry.mode,
    // Route the library URL through the watermark endpoint so public
    // views get the preview-tier watermark + SEO backlink. Merchants
    // with an active licence get standard/clean tier automatically
    // once Phase C wires up image_licenses lookup.
    before_url: `/api/image/serve/${encodeURIComponent(entry.id)}`,
    orientation: entry.orientation,
    composite_split: entry.composite_split,
    before_label: entry.before_label,
    after_label: entry.after_label,
    caption: entry.subject
  };
}

export function EditableBeforeAfterSection({
  id,
  merchantTradeKeywords,
  initialPairs,
  heading: initialHeading = "See the difference",
  subhead: initialSubhead
}: EditableBeforeAfterSectionProps) {
  const editCtx = useEditMode();
  const [pairs, setPairs] = useState<BeforeAfterPair[]>(initialPairs ?? []);
  const [heading, setHeading] = useState(initialHeading);
  const [subhead, setSubhead] = useState(initialSubhead ?? "Real before-and-after from our recent jobs.");
  const [editing, setEditing] = useState(false);

  const matchedLibrary = matchBeforeAfterForMerchant(merchantTradeKeywords);

  // Report section state to the shell's auto-save registry
  useEffect(() => {
    editCtx.registerSectionState(id, { pairs, heading, subhead });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, pairs, heading, subhead]);

  const movePair = (pairId: string, direction: "up" | "down") => {
    setPairs((prev) => {
      const idx = prev.findIndex((p) => p.id === pairId);
      if (idx < 0) return prev;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next;
    });
    editCtx.markDirty();
  };

  const addFromLibrary = (entry: BeforeAfterLibraryEntry) => {
    if (pairs.length >= MAX_PAIRS) return;
    if (pairs.some((p) => p.id === entry.id)) return;
    setPairs((prev) => [...prev, entryToPair(entry)]);
    editCtx.markDirty();
  };

  const removePair = (pairId: string) => {
    setPairs((prev) => prev.filter((p) => p.id !== pairId));
    editCtx.markDirty();
  };

  const updatePair = (pairId: string, patch: Partial<BeforeAfterPair>) => {
    setPairs((prev) =>
      prev.map((p) => (p.id === pairId ? { ...p, ...patch } : p))
    );
    editCtx.markDirty();
  };

  return (
    <EditableSection
      id={id}
      type="custom"
      label="Before / After"
      onEdit={() => setEditing(true)}
    >
      <div className="px-4 py-8 md:py-12">
        <BeforeAfterViewer pairs={pairs} heading={heading} subhead={subhead} />
      </div>

      {editing ? (
        <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pb-4">
          <div className="pointer-events-auto w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold text-neutral-900">
                  Edit before / after
                </div>
                <div className="text-[10px] text-neutral-500">
                  Up to {MAX_PAIRS} pairs. Merchants see 1 main + up to 3 thumbnails.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(false)}
                aria-label="Close editor"
                className="rounded-md p-1 text-neutral-500 transition hover:bg-neutral-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Heading + subhead */}
            <div className="mb-4 flex flex-col gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Section heading
                </span>
                <input
                  type="text"
                  value={heading}
                  onChange={(e) => {
                    setHeading(e.currentTarget.value);
                    editCtx.markDirty();
                  }}
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
                  onChange={(e) => {
                    setSubhead(e.currentTarget.value);
                    editCtx.markDirty();
                  }}
                  className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px]"
                />
              </label>
            </div>

            {/* Current pairs list */}
            <div className="mb-4">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Your pairs ({pairs.length}/{MAX_PAIRS})
                </span>
              </div>
              {pairs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center text-[11px] text-neutral-600">
                  No pairs yet. Add one from the library below.
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {pairs.map((p, idx) => (
                    <li
                      key={p.id}
                      className="flex gap-2 rounded-lg border border-neutral-200 bg-white p-2"
                    >
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => movePair(p.id, "up")}
                          disabled={idx === 0}
                          aria-label="Move up"
                          className="rounded-md border border-neutral-200 bg-white p-0.5 text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-white"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => movePair(p.id, "down")}
                          disabled={idx === pairs.length - 1}
                          aria-label="Move down"
                          className="rounded-md border border-neutral-200 bg-white p-0.5 text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-white"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                      <img
                        src={p.before_url}
                        alt=""
                        className="h-12 w-20 rounded object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <input
                          type="text"
                          value={p.caption ?? ""}
                          onChange={(e) =>
                            updatePair(p.id, { caption: e.currentTarget.value })
                          }
                          placeholder="Caption"
                          className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px]"
                        />
                        <div className="mt-1 flex gap-1">
                          <select
                            value={p.orientation}
                            onChange={(e) =>
                              updatePair(p.id, {
                                orientation:
                                  e.currentTarget.value === "vertical"
                                    ? "vertical"
                                    : "horizontal"
                              })
                            }
                            className="rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px]"
                          >
                            <option value="horizontal">Left / Right</option>
                            <option value="vertical">Top / Bottom</option>
                          </select>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePair(p.id)}
                        aria-label="Remove pair"
                        className="self-start rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-medium text-red-700 transition hover:bg-red-100"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Sibling series — if any of the current pairs belongs to a
                library series, offer to add the whole series in one tap. */}
            {(() => {
              // Find the first current pair that has siblings in the
              // matched library not yet added
              const pairIdsInPairs = new Set(pairs.map((p) => p.id));
              const availableSiblings = pairs.flatMap((p) => {
                const sibs = siblingsFromBeforeAfterList(matchedLibrary, p.id);
                return sibs.filter((s) => !pairIdsInPairs.has(s.id));
              });
              // Dedupe by id
              const dedupedSiblings = Array.from(
                new Map(availableSiblings.map((s) => [s.id, s])).values()
              );
              if (dedupedSiblings.length === 0) return null;
              const remainingSlots = MAX_PAIRS - pairs.length;
              const takeCount = Math.min(remainingSlots, dedupedSiblings.length);
              return (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-900">
                      Part of a series ({dedupedSiblings.length})
                    </span>
                  </div>
                  <p className="mb-2 text-[11px] text-blue-800">
                    Your current pairs belong to a shared series. Add the rest
                    with one tap for consistent brand visuals across your
                    site.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      dedupedSiblings.slice(0, takeCount).forEach((s) => {
                        setPairs((prev) =>
                          prev.length >= MAX_PAIRS ? prev : [...prev, entryToPair(s)]
                        );
                      });
                      editCtx.markDirty();
                    }}
                    disabled={remainingSlots === 0}
                    className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {remainingSlots === 0
                      ? "No slots left"
                      : `Add ${takeCount} more from series`}
                  </button>
                </div>
              );
            })()}

            {/* Suggested from library */}
            {matchedLibrary.length > 0 && pairs.length < MAX_PAIRS ? (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Suggested for your trade
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                  {matchedLibrary
                    .filter((e) => !pairs.some((p) => p.id === e.id))
                    .map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => addFromLibrary(entry)}
                        className="group relative shrink-0 overflow-hidden rounded-lg border-2 border-neutral-200 bg-white text-left transition hover:border-blue-400"
                        style={{ width: 140 }}
                      >
                        <div className="aspect-[16/9] w-full overflow-hidden bg-neutral-100">
                          <img
                            src={`/api/image/serve/${encodeURIComponent(entry.id)}`}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div className="flex items-center justify-between p-1.5 text-[10px]">
                          <span className="line-clamp-1 font-medium text-neutral-800">
                            {entry.orientation === "vertical" ? "Top/Bottom" : "Left/Right"}
                          </span>
                          <Plus className="h-3 w-3 text-blue-600" />
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </EditableSection>
  );
}
