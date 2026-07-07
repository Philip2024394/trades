// HeroSwapSheet — the sheet that opens when the merchant taps
// "Change image" on the hero. Combines LibraryCarousel + UploadPanel
// + PresetPicker + EditControls + SuggestionChip + a Restore button.

"use client";

import { Info, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useEditModeOptional } from "@/apps/live-edit/EditModeContext";
import { CropPreview } from "./CropPreview";
import { EditControls } from "./EditControls";
import { LibraryCarousel } from "./LibraryCarousel";
import { PresetPicker } from "./PresetPicker";
import { SiblingsRail } from "./SiblingsRail";
import { SuggestionChip } from "./SuggestionChip";
import { UploadPanel } from "./UploadPanel";
import type { UseHeroSwapReturn } from "../useHeroSwap";

export type HeroSwapSheetProps = {
  open: boolean;
  onClose: () => void;
  calc: UseHeroSwapReturn;
};

export function HeroSwapSheet({ open, onClose, calc }: HeroSwapSheetProps) {
  const editCtx = useEditModeOptional();
  const merchantParam = editCtx?.merchantId
    ? `&merchantId=${encodeURIComponent(editCtx.merchantId)}`
    : "";
  if (!open) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-t-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <div>
            <div className="text-[13px] font-semibold text-neutral-900">
              Change your hero
            </div>
            <div className="text-[11px] text-neutral-500">
              Suggested for your trade — swap in one tap
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={calc.restoreOriginal}
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1.5 text-neutral-500 transition hover:bg-neutral-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
          {calc.image ? (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-2.5">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-700" />
              <div className="flex-1 text-[11px] leading-snug text-blue-900">
                <span className="font-semibold">Free to use.</span> Your live
                site shows a subtle <span className="font-mono">xratedtrades.com</span>{" "}
                mark in the corner —{" "}
                <Link
                  href={`/xrated-trades-images/${calc.image.id}?tier=standard${merchantParam}`}
                  className="font-semibold underline"
                >
                  licence for £39
                </Link>{" "}
                to remove it, or{" "}
                <Link
                  href={`/xrated-trades-images/${calc.image.id}?tier=regional${merchantParam}`}
                  className="font-semibold underline"
                >
                  lock it to your area from £29/mo
                </Link>
                .
              </div>
            </div>
          ) : null}
          <div className="mb-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Suggested for your trade ({calc.matchedImages.length})
            </div>
            <LibraryCarousel
              images={calc.matchedImages}
              currentImageId={calc.image?.id}
              onSelect={calc.swapToImageId}
            />
          </div>

          {calc.image && calc.siblings.length > 0 ? (
            <div className="mb-4">
              <SiblingsRail
                currentImage={calc.image}
                siblings={calc.siblings}
                onSelectSibling={calc.swapToImageId}
                onApplyAcrossSite={() => {
                  void calc.applySeriesAcrossSite();
                }}
              />
            </div>
          ) : null}
          {calc.saveState !== "idle" ? (
            <div className="mb-3 flex items-center gap-1.5 text-[11px]">
              {calc.saveState === "saving" ? (
                <span className="text-neutral-500">Saving…</span>
              ) : null}
              {calc.saveState === "saved" ? (
                <span className="text-emerald-700">✓ Saved to your site</span>
              ) : null}
              {calc.saveState === "error" ? (
                <span className="text-red-700">
                  Save failed — will retry when you edit next
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="mb-4">
            <UploadPanel
              onUpload={calc.setUpload}
              uploadUrl={calc.uploadUrl}
            />
            {calc.uploadUrl ? (
              <div className="mt-3">
                <CropPreview
                  sourceDataUrl={calc.uploadUrl}
                  focals={calc.uploadFocals}
                  onFocalChange={calc.setUploadFocal}
                />
              </div>
            ) : null}
          </div>

          <div className="mb-4">
            <PresetPicker
              current={calc.preset}
              onChange={calc.applyPreset}
              suggested={calc.suggestion?.suggest_preset}
            />
          </div>

          {calc.suggestion ? (
            <div className="mb-4">
              <SuggestionChip
                suggestion={calc.suggestion}
                onApply={() => {
                  if (calc.suggestion?.suggest_preset) {
                    calc.applyPreset(calc.suggestion.suggest_preset);
                  }
                }}
                onDismiss={() => {
                  // no-op — the suggestion is derived, it'll re-appear
                  // if the underlying condition still matches. This
                  // dismiss is UI-only (visual acknowledgement).
                }}
              />
            </div>
          ) : null}

          <div className="mb-2">
            <EditControls edits={calc.edits} onChange={calc.patchEdit} />
          </div>
        </div>
      </div>
    </div>
  );
}
