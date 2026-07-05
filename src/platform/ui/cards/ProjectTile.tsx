// ProjectTile — 2-per-row mobile, 3-per-row desktop project card.
//
// Compact on mobile (image + title + one meta line + review indicator),
// expanded on desktop (adds description + quote + materials).

import { Camera, Clock, MapPin, Star } from "lucide-react";
import type { ReactNode } from "react";
import { CARD_RADIUS } from "../tokens";

export type ProjectTileProps = {
  title: string;
  location?: string;
  duration?: string;
  photoCount?: number;
  solution?: string;
  materials?: readonly string[];
  customerQuote?: { text: string; attribution: string } | undefined;
  imageSlot?: ReactNode;                    // custom image; default = Camera placeholder
  href?: string;
};

export function ProjectTile({
  title,
  location,
  duration,
  photoCount = 0,
  solution,
  materials = [],
  customerQuote,
  imageSlot,
  href
}: ProjectTileProps) {
  const Wrapper = href ? "a" : "article";
  const wrapperProps = href
    ? { href, className: `overflow-hidden ${CARD_RADIUS} block border border-neutral-200 bg-white transition hover:border-neutral-300` }
    : { className: `overflow-hidden ${CARD_RADIUS} border border-neutral-200 bg-white` };

  return (
    <Wrapper {...(wrapperProps as Record<string, unknown>)}>
      <div className="aspect-[4/3] bg-neutral-200">
        {imageSlot ?? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-neutral-500">
            <Camera className="h-6 w-6 md:h-8 md:w-8" />
            {photoCount ? (
              <div className="text-[10px] md:text-[11px]">
                {photoCount} photos
              </div>
            ) : null}
          </div>
        )}
      </div>
      <div className="p-3 md:p-4">
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-neutral-500 md:text-[11px]">
          {location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {location}
            </span>
          ) : null}
          {duration ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {duration}
            </span>
          ) : null}
        </div>
        <h3 className="text-[13px] font-semibold leading-tight text-neutral-900 md:text-[15px]">
          {title}
        </h3>
        {solution ? (
          <p className="mt-1 hidden text-[12px] text-neutral-600 md:block">
            {solution}
          </p>
        ) : null}
        {customerQuote ? (
          <blockquote className="mt-2 hidden rounded-lg bg-amber-50 p-3 text-[12px] italic text-neutral-800 md:block">
            &ldquo;{customerQuote.text}&rdquo;
            <div className="mt-1 text-[11px] not-italic text-neutral-600">
              — {customerQuote.attribution}
            </div>
          </blockquote>
        ) : null}
        {materials.length ? (
          <div className="mt-2 hidden flex-wrap gap-1 md:flex">
            {materials.slice(0, 3).map((m, i) => (
              <span
                key={i}
                className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-700"
              >
                {m}
              </span>
            ))}
          </div>
        ) : null}
        {/* Mobile-only review chip when a real quote exists. */}
        {customerQuote ? (
          <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 md:hidden">
            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
            Customer review
          </div>
        ) : null}
      </div>
    </Wrapper>
  );
}
