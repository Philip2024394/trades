// /trade-off/inspiration/[id] — inspiration image detail page.
//
// Server-rendered. Full-page treatment of a single The Site image
// with two conversion paths on one screen:
//   1. Contact a trade near you — 3 WhatsApp-opted trades matching
//      the image's trade tags, sorted by rating volume + score
//   2. Browse related — sibling-group images if curated
//
// Google indexes each ID as its own ImageObject-schema page so this
// route is also SEO surface (12k+ URLs across all inspiration).
//
// Anti-theft: image renders with the same watermark helper the
// search feed uses. Right-click / drag / selection blocked.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { BRAND, absolute } from "@/lib/seo";
import {
  loadInspirationDetail,
  loadRelated,
  nearestWhatsappTrades
} from "@/lib/inspirationDetail.server";
import { watermarkImageUrl } from "@/lib/imageWatermark";
import { tradeLabel } from "@/lib/tradeOff";
import { InspirationImage } from "./InspirationImage";
import { ShareButton } from "@/components/forms/ShareButton";
import { VerifiedContactButton } from "@/components/xrated/VerifiedContactButton";
import { BeaconRequestForm } from "@/components/beacon/BeaconRequestForm";

export const revalidate = 600;

export async function generateMetadata({
  params
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const detail = await loadInspirationDetail(decodeURIComponent(id));
  if (!detail) return { title: "Image not found | Thenetworkers" };
  const title = `${firstClause(detail.subject)} | ${BRAND.name}`;
  const desc  = `Inspiration image on Thenetworkers: ${firstClause(detail.subject)}. Contact a UK trade who does work like this on WhatsApp — no lead fees, no bidding wars.`;
  return {
    title,
    description: desc,
    alternates: { canonical: `/trade-off/inspiration/${id}` },
    openGraph: {
      type: "article",
      title,
      description: desc,
      images: [{ url: detail.imageUrl }],
      url: absolute(`/trade-off/inspiration/${id}`),
      siteName: BRAND.name
    }
  };
}

export default async function InspirationDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const detail = await loadInspirationDetail(decodeURIComponent(id));
  if (!detail) notFound();

  const sp    = searchParams ? await searchParams : {};
  const city  = pick(sp["city"]);

  // Load trade cards + related images in parallel.
  const [trades, related] = await Promise.all([
    nearestWhatsappTrades({ keywords: detail.keywords, city, limit: 3 }),
    Promise.resolve(loadRelated(detail, 8))
  ]);

  const watermarked = watermarkImageUrl(detail.imageUrl);
  const caption     = firstClause(detail.subject);
  const shareUrl    = absolute(`/trade-off/inspiration/${id}`);

  // ImageObject JSON-LD — Google Images indexes each inspiration URL
  // separately. Includes the platform-wide image-use terms.
  const jsonLd = {
    "@context":     "https://schema.org",
    "@type":        "ImageObject",
    contentUrl:     detail.imageUrl,
    thumbnailUrl:   detail.imageUrl,
    name:           caption,
    description:    detail.subject,
    url:            shareUrl,
    creditText:     BRAND.name,
    copyrightNotice:`© ${BRAND.name}`,
    license:        absolute("/legal/image-license"),
    ...(detail.widthPx && detail.heightPx
      ? { width: detail.widthPx, height: detail.heightPx }
      : {})
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <XratedHeader/>

      <nav className="mx-auto max-w-6xl px-4 pt-4 text-xs text-brand-muted" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2">
          <li><Link href="/" className="hover:text-brand-text">Home</Link></li>
          <li>/</li>
          <li><Link href="/trade-off/search?tab=inspiration" className="hover:text-brand-text">Inspiration</Link></li>
          <li>/</li>
          <li className="truncate text-brand-text">{caption}</li>
        </ol>
      </nav>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[minmax(0,1fr)_320px]">
        {/* Left: big image */}
        <div>
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
            <InspirationImage
              src={watermarked}
              alt={detail.subject}
              width={detail.widthPx  ?? 800}
              height={detail.heightPx ?? 1067}
            />
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#B8860B]">
                Inspiration
              </p>
              <h1 className="mt-1 text-[22px] font-black leading-tight text-neutral-900 sm:text-[26px]">
                {caption}
              </h1>
            </div>
            <ShareButton
              shareUrl={shareUrl}
              shareText={`${caption} · ${BRAND.name}`}
              variant="ghost"
            />
          </div>
          {detail.keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {detail.keywords.slice(0, 8).map((k) => (
                <Link
                  key={k}
                  href={`/trade-off/search?q=${encodeURIComponent(k)}&tab=inspiration`}
                  className="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50"
                  style={{ borderColor: "rgba(0,0,0,0.10)" }}
                >
                  {k}
                </Link>
              ))}
            </div>
          )}
          {detail.submitter && (
            <p className="mt-4 text-[11px] text-neutral-500">
              Submitted by{" "}
              {detail.sourceCanteen ? (
                <Link href={`/trade/${detail.submitter.slug}`} className="font-black text-neutral-800 hover:underline">
                  {detail.submitter.display ?? detail.submitter.slug}
                </Link>
              ) : (
                <span className="font-black text-neutral-800">{detail.submitter.display ?? detail.submitter.slug}</span>
              )}
            </p>
          )}
        </div>

        {/* Right: conversion column — trades + store + share */}
        <aside className="space-y-4">
          {trades.length > 0 ? (
            <section
              className="rounded-2xl border p-4"
              style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#FFF7DB" }}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7A5B00]">
                {city ? `${trades.length} in ${city.charAt(0).toUpperCase()}${city.slice(1)}` : `${trades.length} near you`}
              </p>
              <p className="mt-1 text-[14px] font-black text-neutral-900">
                Connect with a trade that offers similar services
              </p>
              <ul className="mt-3 space-y-2">
                {trades.map((t) => (
                  <TradeCard key={t.slug} trade={t} shareUrl={shareUrl} caption={caption}/>
                ))}
              </ul>
              <p className="mt-3 text-[10px] text-neutral-500">
                Contact goes direct on WhatsApp. No lead fees, no bidding wars.
              </p>
            </section>
          ) : (
            // Empty state — no matching trades. Show the beacon form so
            // the enquiry still becomes a lead we can route (Tier 3 admin
            // residual escalation kicks in server-side if no trades
            // exist AT ALL in the trade slug).
            <BeaconRequestForm
              tradeSlug={detail.keywords[0] ?? "general-builder"}
              tradeLabel={detail.keywords[0] ? tradeLabel(detail.keywords[0]) : "Trade"}
              city={city}
              sourceSurface="inspiration-detail"
              sourceImageId={detail.id}
            />
          )}

        </aside>
      </div>

      {related.length > 0 && (
        <section className="border-t bg-white" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <div className="mx-auto max-w-6xl px-4 py-8">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#B8860B]">
              More like this
            </p>
            <p className="mt-1 text-[16px] font-black text-neutral-900">
              From the same set
            </p>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
              {related.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/trade-off/inspiration/${encodeURIComponent(r.id)}`}
                    className="group block overflow-hidden rounded-xl border"
                    style={{ borderColor: "rgba(0,0,0,0.08)" }}
                  >
                    <div style={{ aspectRatio: (r.width_px && r.height_px) ? `${r.width_px} / ${r.height_px}` : "3 / 4" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={watermarkImageUrl(r.image_url)}
                        alt={r.subject}
                        width={r.width_px  ?? 400}
                        height={r.height_px ?? 533}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <XratedFooter/>
    </main>
  );
}

function TradeCard({
  trade,
  shareUrl,
  caption
}: {
  trade:     Awaited<ReturnType<typeof nearestWhatsappTrades>>[number];
  shareUrl:  string;
  caption:   string;
}) {
  const initials = (trade.displayName.charAt(0) || "?").toUpperCase();
  const label    = trade.tradingName ?? trade.displayName;
  const firstName = (trade.displayName.split(" ")[0] || label).trim();

  return (
    <li
      className="flex items-center gap-3 rounded-xl border bg-white p-2.5"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    >
      <Link href={`/trade/${trade.slug}`} className="shrink-0">
        {trade.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={trade.avatarUrl}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFB300] text-[13px] font-black text-neutral-900">
            {initials}
          </span>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/trade/${trade.slug}`} className="block truncate text-[12px] font-black text-neutral-900 hover:underline">
          {label}
        </Link>
        <p className="truncate text-[10px] text-neutral-500">
          {tradeLabel(trade.primaryTrade)} · {trade.city}
          {trade.ratingCount > 0 && trade.ratingAvg != null && (
            <> · ★ {trade.ratingAvg.toFixed(1)} ({trade.ratingCount})</>
          )}
        </p>
      </div>
      {/* Routes through the washer rail: opens the VerifiedContactModal,
          user fills the qualifier form (name + email/phone + ≥60-char
          description), then WhatsApp opens + washer deducts from the
          trade's bag. Matches feedback_form_gate_not_washer_for_contact
          + project_washers_lead_gen_model rules. */}
      <VerifiedContactButton
        merchantSlug={trade.slug}
        merchantDisplayName={trade.displayName}
        merchantFirstName={firstName}
        merchantWhatsapp={trade.whatsapp}
        tradeLabel={tradeLabel(trade.primaryTrade)}
        city={trade.city}
        source="inspiration-detail"
        sourceLabel={`Inspiration: ${caption}`}
        className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-white transition hover:opacity-90"
        style={{ backgroundColor: "#166534" }}
      >
        WhatsApp
      </VerifiedContactButton>
    </li>
  );
}

function firstClause(s: string): string {
  if (!s) return "Inspiration";
  const first = s.split(/[,;·—]/)[0].trim();
  const trimmed = first.replace(/\s+(with|showing|featuring|and|on|in|of|at)\s*$/i, "");
  return trimmed.length > 90 ? `${trimmed.slice(0, 87)}…` : trimmed;
}

function pick(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}
