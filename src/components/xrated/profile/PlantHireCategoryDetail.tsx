"use client";

// PlantHireCategoryDetail — renders the Wave-1 detail block under each
// machine tile: specs table, gallery, video, downloads, compatible
// attachments cross-sell, and reviews. Every subsection is toggled by
// the merchant's sections_enabled flags — a section only renders if the
// flag is on AND the data exists.

import { useState } from "react";
import {
  mergeSpecs,
  type PlantCategorySlug,
  type PlantHireSectionsEnabled,
  type PlantReview,
  type PlantSpec
} from "@/lib/plantHire";

type CategoryLite = { slug: string; label: string; emoji: string };

export function PlantHireCategoryDetail({
  categorySlug,
  sectionsEnabled,
  specs,
  galleryUrls,
  videoUrl,
  brochureUrl,
  lolerCertUrl,
  compatibleAttachments,
  allCategories,
  rating,
  reviews
}: {
  categorySlug: PlantCategorySlug;
  sectionsEnabled: PlantHireSectionsEnabled;
  specs: PlantSpec | undefined;
  galleryUrls: string[] | undefined;
  videoUrl: string | undefined;
  brochureUrl: string | undefined;
  lolerCertUrl: string | undefined;
  compatibleAttachments: string[] | undefined;
  allCategories: CategoryLite[];
  rating: { avg: number; count: number } | undefined;
  reviews: PlantReview[] | undefined;
}) {
  const [openReviews, setOpenReviews] = useState(false);

  const mergedSpecs = mergeSpecs(categorySlug, specs);
  const hasSpec =
    sectionsEnabled.spec_panel &&
    Object.values(mergedSpecs).some((v) => v !== null && v !== undefined && v !== "");
  const hasGallery = sectionsEnabled.gallery && galleryUrls && galleryUrls.length > 0;
  const hasVideo = sectionsEnabled.video && videoUrl && videoUrl.length > 0;
  const hasDocs =
    sectionsEnabled.documents && ((brochureUrl && brochureUrl.length > 0) || (lolerCertUrl && lolerCertUrl.length > 0));
  const compatSlugs = new Set(compatibleAttachments ?? []);
  const compat = allCategories.filter((c) => compatSlugs.has(c.slug));
  const hasCompat = sectionsEnabled.attachments_compat && compat.length > 0;
  const hasReviews =
    sectionsEnabled.reviews &&
    ((rating && rating.count > 0) || (reviews && reviews.length > 0));

  if (!hasSpec && !hasGallery && !hasVideo && !hasDocs && !hasCompat && !hasReviews) {
    return null;
  }

  return (
    <div className="space-y-3 pt-2">
      {hasSpec && <SpecTable specs={mergedSpecs} />}

      {hasGallery && galleryUrls && (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {galleryUrls.map((u) => (
            <li key={u} className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={u}
                alt=""
                className="h-20 w-28 rounded-md object-cover"
                loading="lazy"
              />
            </li>
          ))}
        </ul>
      )}

      {hasVideo && videoUrl && (
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 text-[11px] font-extrabold text-neutral-900 transition hover:border-[#FFB300]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          Watch walkaround
        </a>
      )}

      {hasDocs && (
        <ul className="flex flex-wrap gap-2">
          {brochureUrl && brochureUrl.length > 0 && (
            <li>
              <a
                href={brochureUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 text-[10px] font-extrabold uppercase tracking-widest text-neutral-800 transition hover:border-[#FFB300]"
              >
                ↓ Brochure PDF
              </a>
            </li>
          )}
          {lolerCertUrl && lolerCertUrl.length > 0 && (
            <li>
              <a
                href={lolerCertUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 text-[10px] font-extrabold uppercase tracking-widest text-neutral-800 transition hover:border-[#FFB300]"
              >
                ↓ LOLER cert
              </a>
            </li>
          )}
        </ul>
      )}

      {hasCompat && (
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
            Frequently hired with
          </p>
          <ul className="mt-1 flex flex-wrap gap-1">
            {compat.map((c) => (
              <li
                key={c.slug}
                className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-800"
              >
                <span>{c.emoji}</span>
                {c.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasReviews && (
        <div>
          <button
            type="button"
            onClick={() => setOpenReviews((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-md bg-neutral-50 px-2 py-1.5 text-left text-[11px] font-bold text-neutral-800 transition hover:bg-neutral-100"
          >
            <span>
              {rating && rating.avg > 0 ? (
                <>
                  <span className="font-extrabold text-[#FFB300]">★ {rating.avg.toFixed(1)}</span>
                  <span className="ml-1 text-neutral-500">({rating.count} reviews)</span>
                </>
              ) : (
                <>Customer reviews</>
              )}
            </span>
            <span className="text-[13px] text-[#FFB300]" aria-hidden="true">
              {openReviews ? "−" : "+"}
            </span>
          </button>
          {openReviews && reviews && reviews.length > 0 && (
            <ul className="mt-2 space-y-2">
              {reviews.slice(0, 5).map((r, i) => (
                <li key={i} className="rounded-md border border-neutral-200 bg-white p-2 text-[11px] text-neutral-800">
                  <p className="flex items-center gap-2">
                    <span className="font-extrabold">{r.author}</span>
                    <span className="font-bold text-[#FFB300]">
                      {"★".repeat(Math.max(1, Math.round(r.rating)))}
                    </span>
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-widest text-neutral-500">
                      {r.date}
                    </span>
                  </p>
                  <p className="mt-1 leading-relaxed text-neutral-700">{r.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SpecTable({ specs }: { specs: PlantSpec }) {
  const rows: { label: string; value: string }[] = [];
  if (specs.weight_kg) rows.push({ label: "Weight", value: `${specs.weight_kg.toLocaleString()} kg` });
  if (specs.hp) rows.push({ label: "Power", value: `${specs.hp} hp` });
  if (specs.dig_depth_mm) rows.push({ label: "Dig depth", value: `${(specs.dig_depth_mm / 1000).toFixed(2)} m` });
  if (specs.reach_mm) rows.push({ label: "Reach", value: `${(specs.reach_mm / 1000).toFixed(2)} m` });
  if (specs.bucket_l) rows.push({ label: "Bucket", value: `${specs.bucket_l} L` });
  if (specs.transport_length_mm)
    rows.push({ label: "Transport L", value: `${(specs.transport_length_mm / 1000).toFixed(2)} m` });
  if (specs.transport_width_mm)
    rows.push({ label: "Transport W", value: `${(specs.transport_width_mm / 1000).toFixed(2)} m` });
  if (specs.transport_height_mm)
    rows.push({ label: "Transport H", value: `${(specs.transport_height_mm / 1000).toFixed(2)} m` });
  if (specs.fuel_type) rows.push({ label: "Fuel", value: fuelLabel(specs.fuel_type) });
  if (specs.emission) rows.push({ label: "Emission", value: emisLabel(specs.emission) });
  if (rows.length === 0) return null;
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-2">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">Specs</p>
      <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
        {rows.map((r) => (
          <li key={r.label} className="flex justify-between gap-2 text-[11px]">
            <span className="text-neutral-500">{r.label}</span>
            <span className="font-bold text-neutral-900">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function fuelLabel(v: string): string {
  return v === "diesel" ? "Diesel" : v === "petrol" ? "Petrol" : v === "electric" ? "Electric" : "Hybrid";
}
function emisLabel(v: string): string {
  return v === "stage_v" ? "Stage V" : v === "stage_iiib" ? "Stage IIIB" : "Euro 6";
}
