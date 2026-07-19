"use client";

// SiteBookGalleryCard — the CORE Photo Library tile (always visible on
// /sitebook, no install needed).
//
// Behaviour:
//   • Empty state → single placeholder image so the container's
//     purpose is instantly obvious ("your project photos land here").
//   • Populated → 3×3 thumbnail grid. When >9 photos, the 9th slot
//     becomes a "+N" overflow tile.
//   • "+ Add photo" chip in the header lets the homeowner upload
//     straight into the container (routes to the most recent
//     project — or a mini picker when there's more than one).
//   • Click a thumbnail → lightbox opens inline over the page.
//   • "See all" → swaps the feed for the full gallery (?view=gallery).

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, X, ArrowUpRight } from "lucide-react";
import type { SiteBookPhoto } from "@/lib/homeowners/photos";

const BRAND_YELLOW = "#FFB300";

// Placeholder used on empty state so the container has visual weight
// even before the homeowner has uploaded anything. Unsplash construction
// stock — replaced by the homeowner's own photo as soon as one lands.
const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=400&h=400&fit=crop";

export function SiteBookGalleryCard({
  photos,
  seeAllHref     = "?view=gallery",
  postHrefPrefix = "/sitebook"
}: {
  photos:          SiteBookPhoto[];
  /** Kept for API compat — the card no longer uploads directly.
   *  Uploads now happen via the composer or the full gallery view. */
  projects?:       { id: string; title: string }[];
  /** Route for the "See all" link. Defaults to the current URL with
   *  ?view=gallery. Mock overrides to its own path. */
  seeAllHref?:     string;
  /** Prefix used when building the "Open post" link inside lightbox. */
  postHrefPrefix?: string;
  /** Kept for API compat. */
  demoMode?:       boolean;
}) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const visible  = photos.slice(0, 9);
  const overflow = Math.max(0, photos.length - 9);

  const isEmpty = photos.length === 0;

  return (
    <>
      <div
        className="rounded-2xl border-2 bg-white p-4 shadow-sm"
        style={{ borderColor: "rgba(0,0,0,0.08)" }}
      >
        {/* Header row — upload button removed per Philip 2026-07-19.
            Uploads happen via the composer (Image chip) OR the full
            gallery view ("+ Add photo" button after tapping See all). */}
        <div className="mb-3 flex items-baseline gap-2">
          <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Photo library
          </p>
          {!isEmpty && (
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 tabular-nums">
              {photos.length}
            </span>
          )}
        </div>

        {isEmpty ? (
          <EmptyStateWithPlaceholder />
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {visible.map((p, i) => {
              const isOverflowTile = i === 8 && overflow > 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setLightboxIdx(i)}
                  className="group relative aspect-square overflow-hidden rounded-md bg-neutral-100 transition hover:opacity-95"
                  title={p.caption || (p.stage ?? "Photo")}
                  aria-label={p.caption || "Open photo"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.storage_url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {p.stage && (
                    <span
                      className="absolute left-0 top-0 rounded-br-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white"
                      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
                    >
                      {p.stage === "in-progress" ? "WIP" : p.stage}
                    </span>
                  )}
                  {isOverflowTile && (
                    <span
                      className="absolute inset-0 flex items-center justify-center text-[13px] font-black text-white"
                      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
                    >
                      +{overflow}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* See-all link: shown when photos >= 9 OR always in populated state.
            Opens the full-gallery view in the center feed. */}
        {!isEmpty && (
          <Link
            href={seeAllHref}
            scroll={false}
            className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900"
          >
            {photos.length > 9 ? `See all ${photos.length}` : "See all"}
            <ChevronRight size={11} strokeWidth={2.5}/>
          </Link>
        )}

        <span className="hidden" style={{ color: BRAND_YELLOW }}/>
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && visible[lightboxIdx] && (
        <Lightbox
          photo={visible[lightboxIdx]}
          onClose={() => setLightboxIdx(null)}
          onPrev={lightboxIdx > 0 ? () => setLightboxIdx(lightboxIdx - 1) : undefined}
          onNext={lightboxIdx < visible.length - 1 ? () => setLightboxIdx(lightboxIdx + 1) : undefined}
          postHrefPrefix={postHrefPrefix}
        />
      )}
    </>
  );
}

// ─── Empty state placeholder ──────────────────────────────────────

function EmptyStateWithPlaceholder() {
  return (
    <div>
      <div className="grid grid-cols-3 gap-1">
        <div className="relative col-span-3 aspect-[3/1] overflow-hidden rounded-md bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={PLACEHOLDER_IMAGE}
            alt=""
            className="h-full w-full object-cover opacity-70"
            loading="lazy"
          />
          <span
            className="absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          >
            Example
          </span>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-neutral-600">
        <span className="font-black text-neutral-800">Your project photos land here.</span>{" "}
        Add photos from any feed post, or tap <span className="font-black text-neutral-800">See all</span> to upload directly.
      </p>
    </div>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────

function Lightbox({
  photo, onClose, onPrev, onNext, postHrefPrefix
}: {
  photo:          SiteBookPhoto;
  onClose:        () => void;
  onPrev?:        () => void;
  onNext?:        () => void;
  postHrefPrefix: string;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
          <div className="flex items-center gap-2 text-[11px] text-neutral-600">
            <span className="font-black uppercase tracking-wider text-neutral-800">
              {photo.stage ? (photo.stage === "in-progress" ? "In progress" : photo.stage) : "Photo"}
            </span>
            {photo.uploaded_by_name && (
              <>
                <span>·</span>
                <span>{photo.uploaded_by_name}</span>
              </>
            )}
            <span>·</span>
            <span>{new Date(photo.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
            aria-label="Close"
          >
            <X size={15}/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-neutral-50 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.storage_url}
            alt={photo.caption ?? ""}
            className="mx-auto max-h-[70vh] w-auto rounded-lg object-contain shadow-md"
          />
          {photo.caption && (
            <p className="mx-auto mt-3 max-w-2xl text-center text-[12.5px] text-neutral-700">
              {photo.caption}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-neutral-100 px-3 py-2">
          <div className="flex items-center gap-1">
            {onPrev && (
              <button type="button" onClick={onPrev} className="inline-flex h-8 items-center gap-1 rounded-full border border-neutral-300 bg-white px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50">
                Prev
              </button>
            )}
            {onNext && (
              <button type="button" onClick={onNext} className="inline-flex h-8 items-center gap-1 rounded-full border border-neutral-300 bg-white px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50">
                Next
              </button>
            )}
          </div>
          {photo.post_id ? (
            <Link
              href={`${postHrefPrefix}?post=${photo.post_id}`}
              className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm hover:brightness-95"
              style={{ backgroundColor: BRAND_YELLOW }}
            >
              Open post <ArrowUpRight size={11} strokeWidth={2.5}/>
            </Link>
          ) : (
            <span className="text-[10.5px] font-bold text-neutral-500">Source post removed</span>
          )}
        </div>
      </div>
    </div>
  );
}

