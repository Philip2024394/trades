"use client";

// Video Center — grid of YouTube video cards with machine-tagged
// modal. Merchant-configured; auto-derives thumbnail from URL. Each
// card can link back to a fleet machine's detail page.

import { useState } from "react";
import Link from "next/link";
import {
  PLANT_CATEGORIES,
  type PlantVideoCenter as VideoCenter,
  type PlantVideo
} from "@/lib/plantHire";
import { youtubeEmbedUrl, youtubeThumbnailUrl } from "@/lib/youtube";

export function PlantVideoCenterSection({
  cfg,
  merchantSlug
}: {
  cfg: VideoCenter;
  merchantSlug: string;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  if (!cfg.enabled || cfg.videos.length === 0) return null;
  return (
    <div className="mt-10">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
        Video centre
      </p>
      <h3 className="mt-1 text-2xl font-extrabold text-neutral-900 sm:text-3xl">
        {cfg.heading}
      </h3>
      <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">{cfg.subheading}</p>

      <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cfg.videos.map((v, i) => (
          <li key={v.youtube_url + i}>
            <VideoCard v={v} onOpen={() => setOpenIdx(i)} />
          </li>
        ))}
      </ul>

      {openIdx !== null && (
        <VideoModal
          v={cfg.videos[openIdx]}
          merchantSlug={merchantSlug}
          onClose={() => setOpenIdx(null)}
        />
      )}
    </div>
  );
}

function VideoCard({ v, onOpen }: { v: PlantVideo; onOpen: () => void }) {
  const thumb = v.thumbnail_url || youtubeThumbnailUrl(v.youtube_url) || "";
  const machineMeta = v.linked_machine_slug
    ? PLANT_CATEGORIES.find((m) => m.slug === v.linked_machine_slug)
    : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left transition hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-lg"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-neutral-900">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={v.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/40">
            No thumbnail
          </div>
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover:bg-black/40"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[#FFB300] text-neutral-900 shadow-lg transition group-hover:scale-105">
            ▶
          </span>
        </div>
        {v.duration_label && (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white">
            {v.duration_label}
          </span>
        )}
      </div>
      <div className="flex-1 p-4">
        <p className="text-[14px] font-extrabold leading-tight text-neutral-900">{v.title}</p>
        {v.description && (
          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-neutral-600">
            {v.description}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {machineMeta && (
            <span className="inline-flex items-center rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white">
              {machineMeta.label}
            </span>
          )}
          {v.location && (
            <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-700">
              📍 {v.location}
            </span>
          )}
          {v.date_uploaded && (
            <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-500">
              {v.date_uploaded}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function VideoModal({
  v,
  merchantSlug,
  onClose
}: {
  v: PlantVideo;
  merchantSlug: string;
  onClose: () => void;
}) {
  const embed = youtubeEmbedUrl(v.youtube_url);
  const machineMeta = v.linked_machine_slug
    ? PLANT_CATEGORIES.find((m) => m.slug === v.linked_machine_slug)
    : null;
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
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/70 text-[14px] font-extrabold text-white transition hover:bg-black"
        >
          ×
        </button>
        <div className="aspect-video w-full bg-black">
          {embed ? (
            <iframe
              src={embed}
              title={v.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-white/60">
              Video unavailable — bad URL.
            </div>
          )}
        </div>
        <div className="max-h-[40vh] overflow-y-auto p-5 sm:p-6">
          <p className="text-[18px] font-extrabold leading-tight text-neutral-900">{v.title}</p>
          {v.description && (
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">{v.description}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {machineMeta && (
              <span className="inline-flex items-center rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white">
                {machineMeta.label}
              </span>
            )}
            {v.location && (
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-700">
                📍 {v.location}
              </span>
            )}
          </div>
          {machineMeta && (
            <div className="mt-5 border-t border-neutral-200 pt-4">
              <Link
                href={`/${merchantSlug}/plant-hire/machines/${machineMeta.slug}`}
                onClick={onClose}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#FFB300] px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95"
              >
                View this machine →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
