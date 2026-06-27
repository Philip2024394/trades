// Single post card for The Yard feed. Landscape layout designed to read
// at a glance: kind chip + trade pill, big title, who/where/when, body
// excerpt, and a yellow WhatsApp CTA. Sample posts wear a small
// yellow "Sample" badge so members know the feed is seeded.

import { tradeLabel } from "@/lib/tradeOff";
import type { HammerexTradeOffYardPost } from "@/lib/supabase";
import {
  YARD_KIND_LABELS,
  YARD_KIND_BG,
  YARD_KIND_FG,
  buildYardWhatsappUrl,
  buildYardPurchaseUrl,
  formatDayRate,
  formatPostDateRange,
  formatPostPrice,
  timeAgoShort
} from "@/lib/yardPosts";
import type { ReactionCounts } from "@/lib/yardReactions";
import { YardReactionBar } from "./YardReactionBar";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK = "#0A0A0A";

export type YardPoster = {
  slug: string;
  display_name: string;
  trading_name: string | null;
  city: string | null;
  country: string | null;
  primary_trade: string;
  whatsapp: string;
  avatar_url: string | null;
};

export function YardPostCard({
  post,
  poster,
  reactions = {}
}: {
  post: HammerexTradeOffYardPost;
  poster: YardPoster | null;
  reactions?: ReactionCounts;
}) {
  const kindBg = YARD_KIND_BG[post.kind];
  const kindFg = YARD_KIND_FG[post.kind];
  const tradeText = tradeLabel(post.trade_slug);
  const dateRange = formatPostDateRange(post.start_date, post.end_date);
  const dayRate = formatDayRate(post.day_rate_pence);
  const region = post.region ?? "";
  const posterName = poster?.trading_name?.trim() || poster?.display_name || "Member";

  const isProduct = post.kind === "product";
  const waUrl = poster
    ? isProduct
      ? buildYardPurchaseUrl({
          whatsapp: poster.whatsapp,
          posterName: poster.display_name.split(/\s+/)[0] || posterName,
          postTitle: post.title,
          price: post.product_price_pence
        })
      : buildYardWhatsappUrl({
          whatsapp: poster.whatsapp,
          posterName: poster.display_name.split(/\s+/)[0] || posterName,
          postTitle: post.title
        })
    : null;

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      {post.is_sample && (
        <span
          className="absolute right-3 top-3 z-10 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-neutral-900 shadow-sm"
          style={{ background: BRAND_YELLOW }}
        >
          Sample
        </span>
      )}

      <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
        {/* Top row — kind chip + time ago */}
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em]"
            style={{ background: kindBg, color: kindFg }}
          >
            {YARD_KIND_LABELS[post.kind]}
          </span>
          <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-700">
            {tradeText}
          </span>
          {!post.is_sample && (
            <span className="ml-auto text-[11px] font-bold text-neutral-400">
              {timeAgoShort(post.created_at)}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-base font-extrabold leading-snug text-neutral-900 sm:text-lg">
          {post.title}
        </h3>

        {/* Meta — region · dates · crew · rate · price */}
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-neutral-600">
          {region && (
            <li className="inline-flex items-center gap-1.5">
              <PinGlyph />
              {region}
            </li>
          )}
          {dateRange && (
            <li className="inline-flex items-center gap-1.5">
              <CalendarGlyph />
              {dateRange}
            </li>
          )}
          {post.kind === "needed" && post.crew_size_needed !== null && (
            <li className="inline-flex items-center gap-1.5">
              <CrewGlyph />
              {post.crew_size_needed} crew
            </li>
          )}
          {dayRate && (
            <li className="inline-flex items-center gap-1.5 font-extrabold text-neutral-900">
              {dayRate}
            </li>
          )}
        </ul>

        {/* Big price block for product posts — the conversion anchor. */}
        {isProduct && post.product_price_pence !== null && (
          <p
            className="text-2xl font-extrabold leading-none text-neutral-900 sm:text-3xl"
            aria-label="Price"
          >
            {formatPostPrice(post.product_price_pence)}
          </p>
        )}

        {/* Body excerpt — clamp to 3 lines so cards stay even-height. */}
        <p
          className="text-[13px] leading-relaxed text-neutral-700"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden"
          }}
        >
          {post.body}
        </p>

        {/* Attachments — image strip (up to 3), file chip, link chip.
            Members tap an image to open it full-screen via the native
            browser image viewer (no lightbox js needed for v1). */}
        {post.image_urls && post.image_urls.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {post.image_urls.slice(0, 3).map((url, i) => (
              <a
                key={`${post.id}-img-${i}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative aspect-[4/3] overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100"
                aria-label={`Attached image ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105"
                />
              </a>
            ))}
          </div>
        )}
        {(post.attachment_url || post.link_url) && (
          <div className="flex flex-wrap gap-1.5">
            {post.attachment_url && (
              <a
                href={post.attachment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 text-[11px] font-extrabold text-neutral-800 transition hover:border-neutral-300"
              >
                <FileGlyph />
                {post.attachment_name ?? (post.attachment_kind === "pdf" ? "PDF" : "File")}
              </a>
            )}
            {post.link_url && (
              <a
                href={post.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 text-[11px] font-extrabold text-neutral-800 transition hover:border-neutral-300"
              >
                <LinkGlyph />
                {post.link_title ?? new URL(post.link_url).hostname.replace(/^www\./, "")}
              </a>
            )}
          </div>
        )}

        {/* Reaction bar — sits above the poster row so the conversion
            CTA stays the visual anchor. */}
        <div className="border-t border-neutral-100 pt-3">
          <YardReactionBar postId={post.id} initialCounts={reactions} />
        </div>

        {/* Poster + CTA */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-neutral-100 pt-3">
          {poster ? (
            <a
              href={`/${poster.slug}`}
              className="flex min-w-0 items-center gap-2.5"
            >
              {poster.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={poster.avatar_url}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-neutral-200"
                />
              ) : (
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-neutral-900"
                  style={{ background: BRAND_YELLOW }}
                  aria-hidden="true"
                >
                  {posterName.charAt(0)}
                </span>
              )}
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[13px] font-extrabold text-neutral-900">
                  <span className="truncate">{posterName}</span>
                  {/* Verified tick — every Yard poster is a paying
                      member or builder-grade trade, so they've passed
                      Xrated's onboarding gate. Same yellow tick used
                      across the brand. */}
                  <span
                    className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full"
                    style={{ background: BRAND_YELLOW }}
                    aria-label="Verified — this tradesperson is real"
                    title="Verified — this tradesperson is real"
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                </span>
                <span className="block truncate text-[11px] text-neutral-500">
                  {poster.city ?? ""}
                  {poster.country && poster.country !== "UK"
                    ? `, ${poster.country}`
                    : ""}
                </span>
              </span>
            </a>
          ) : (
            <span className="text-[13px] text-neutral-500">Poster removed</span>
          )}

          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 text-[13px] font-extrabold uppercase tracking-wider text-white shadow-md transition active:scale-[0.97]"
              style={
                isProduct
                  ? {
                      background: BRAND_YELLOW,
                      color: BRAND_BLACK,
                      boxShadow: `0 6px 18px ${BRAND_YELLOW}55`
                    }
                  : {
                      background: "#0F7A3F",
                      boxShadow: "0 6px 18px rgba(15,122,63,0.4)"
                    }
              }
              aria-label={
                isProduct
                  ? `Buy ${post.title} on WhatsApp`
                  : `Message ${posterName} on WhatsApp about: ${post.title}`
              }
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Z" />
              </svg>
              {isProduct ? "Buy" : "Message"}
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function PinGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function CalendarGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function CrewGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function FileGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function LinkGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72" />
    </svg>
  );
}

export default YardPostCard;
