// Facebook-style feed item for a Yard Trade Chat post. Full-bleed
// vertical layout (NOT a grid card) — designed to read as a social
// feed, mobile-first. Distinct from YardPostCard so chat threads
// stack like a forum, not a marketplace.

import { tradeLabel } from "@/lib/tradeOff";
import type { HammerexTradeOffYardPost } from "@/lib/supabase";
import {
  buildYardWhatsappUrl,
  timeAgoShort
} from "@/lib/yardPosts";
import type { ReactionCounts } from "@/lib/yardReactions";
import type { YardPoster } from "./YardPostCard";
import { YardReactionBar } from "./YardReactionBar";
import { YardImageThumbs } from "./YardImageThumbs";

const BRAND_YELLOW = "#FFB300";

export function YardChatPost({
  post,
  poster,
  reactions
}: {
  post: HammerexTradeOffYardPost;
  poster: YardPoster | null;
  reactions: ReactionCounts;
}) {
  const posterName =
    poster?.trading_name?.trim() || poster?.display_name || "Member";
  const firstName =
    poster?.display_name.split(/\s+/)[0] ?? posterName;
  const tradeText = tradeLabel(post.trade_slug);

  const replyUrl = poster
    ? buildYardWhatsappUrl({
        whatsapp: poster.whatsapp,
        posterName: firstName,
        postTitle: `[Chat] ${post.title}`
      })
    : null;

  return (
    <article className="relative w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">

      <div className="flex flex-col gap-3 p-4 sm:p-5">
        {/* Poster header — avatar + name + verified tick + meta */}
        <header className="flex items-center gap-3">
          {poster && (
            <a
              href={`/${poster.slug}`}
              className="shrink-0"
              aria-label={`Open ${posterName}'s profile`}
            >
              {poster.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={poster.avatar_url}
                  alt=""
                  className="h-11 w-11 rounded-full object-cover ring-2 ring-neutral-100"
                />
              ) : (
                <span
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[14px] font-extrabold text-neutral-900"
                  style={{ background: BRAND_YELLOW }}
                  aria-hidden="true"
                >
                  {posterName.charAt(0)}
                </span>
              )}
            </a>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <a
                href={poster ? `/${poster.slug}` : "#"}
                className="truncate text-[14px] font-extrabold text-neutral-900 sm:text-[15px]"
              >
                {posterName}
              </a>
              {/* "Real tradesperson" badge — every Yard poster is a
                  paid member or builder-grade trade, so they've passed
                  Xrated's onboarding gate. Yellow tick = trusted. */}
              <span
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                style={{ background: BRAND_YELLOW }}
                aria-label="Verified — this tradesperson is real"
                title="Verified — this tradesperson is real"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
            </div>
            <p className="truncate text-[11px] text-neutral-500 sm:text-[12px]">
              {tradeText}
              {post.region ? ` · ${post.region}` : ""}
              {" · "}
              {timeAgoShort(post.created_at)}
            </p>
          </div>
          <span
            className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-neutral-900"
            style={{ background: BRAND_YELLOW }}
          >
            Trade Chat
          </span>
        </header>

        {/* Title + body */}
        <div>
          <h3 className="text-base font-extrabold leading-snug text-neutral-900 sm:text-lg">
            {post.title}
          </h3>
          <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-neutral-800">
            {post.body}
          </p>
        </div>

        {/* Attachment chips — file + link only; images move to the
            action row as thumbnails. */}
        {(post.attachment_url || post.link_url) && (
          <div className="flex flex-wrap gap-1.5">
            {post.attachment_url && (
              <a
                href={post.attachment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 text-[11px] font-extrabold text-neutral-800 hover:border-neutral-300"
              >
                {post.attachment_name ??
                  (post.attachment_kind === "pdf" ? "PDF" : "File")}
              </a>
            )}
            {post.link_url && (
              <a
                href={post.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 text-[11px] font-extrabold text-neutral-800 hover:border-neutral-300"
              >
                {post.link_title ??
                  new URL(post.link_url).hostname.replace(/^www\./, "")}
              </a>
            )}
          </div>
        )}

        {/* Reaction bar — thumbs up / dislike only. */}
        <div className="border-t border-neutral-100 pt-3">
          <YardReactionBar postId={post.id} initialCounts={reactions} />
        </div>

        {/* Action row — Reply / Open thread on the left, image
            thumbnails on the right. Thumbnails enlarge in a lightbox
            on tap so members can see the project / drawing at full
            size without leaving the feed. */}
        <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {replyUrl ? (
              <a
                href={`/api/trade-off/yard/posts/${encodeURIComponent(post.id)}/contact?to=${encodeURIComponent(replyUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-extrabold text-neutral-900 transition active:scale-[0.97]"
                style={{
                  background: BRAND_YELLOW,
                  boxShadow: `0 4px 14px ${BRAND_YELLOW}55`
                }}
                aria-label={`Reply to ${posterName} on WhatsApp`}
              >
                <ReplyGlyph />
                Reply
              </a>
            ) : null}
            <a
              href={`/trade-off/yard/${post.id}`}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-extrabold text-neutral-700 transition hover:border-neutral-300"
            >
              Open thread
            </a>
          </div>
          {post.image_urls && post.image_urls.length > 0 && (
            <YardImageThumbs
              urls={post.image_urls}
              alt={`Attached to: ${post.title}`}
            />
          )}
        </div>

        {/* X contacted — plain text, centered, end of card. Always
            rendered so every thread shows the signal honestly. */}
        <p className="text-center text-[12px] font-bold text-neutral-500">
          {post.contact_count} contacted
        </p>
      </div>
    </article>
  );
}

function ReplyGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

export default YardChatPost;
