// Facebook-style feed item for a Yard Trade Chat post. Full-bleed
// vertical layout (NOT a grid card) — designed to read as a social
// feed, mobile-first. Distinct from YardPostCard so chat threads
// stack like a forum, not a marketplace.

import { Fragment } from "react";
import { tradeLabel } from "@/lib/tradeOff";
import type { HammerexTradeOffYardPost } from "@/lib/supabase";
import {
  buildYardWhatsappUrl,
  timeAgoShort,
  isNewPost,
  daysRemaining
} from "@/lib/yardPosts";
import type { ReactionCounts } from "@/lib/yardReactions";
import type { YardPoster } from "./YardPostCard";
import { YardReactionBar } from "./YardReactionBar";
import { YardImageThumbs } from "./YardImageThumbs";
import { YardFlagButton } from "./YardFlagButton";
import { YardPostLightbox } from "./YardPostLightbox";
import { YardCommentsPanel } from "./YardCommentsPanel";

const BRAND_YELLOW = "#FFB300";
const ANNOUNCEMENT_IMAGE =
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%208,%202026,%2002_20_45%20PM.png";
const CHAT_AVATAR_IMAGE =
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%208,%202026,%2002_57_40%20PM.png";

// Split a body string into React nodes with any http(s) URL rendered as a
// clickable link. Trailing punctuation (. , ) ! ? ; :) is peeled off the
// URL and rendered as plain text — otherwise "…profile." grabs the dot.
// Keeps whitespace-pre-wrap semantics for non-URL segments (React
// preserves the raw string).
function renderBodyWithLinks(text: string) {
  const URL_RE = /(https?:\/\/\S+)/g;
  const segments = text.split(URL_RE);
  return segments.map((segment, i) => {
    if (!/^https?:\/\//.test(segment)) return segment;
    const match = segment.match(/^(.*?)([.,;:!?)\]]*)$/);
    const url = match?.[1] ?? segment;
    const trailing = match?.[2] ?? "";
    return (
      <Fragment key={i}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-800"
        >
          {url}
        </a>
        {trailing}
      </Fragment>
    );
  });
}

export function YardChatPost({
  post,
  poster,
  reactions,
  inCircle = false
}: {
  post: HammerexTradeOffYardPost;
  poster: YardPoster | null;
  reactions: ReactionCounts;
  /** Viewer signed in with magic link and this post's author is in
   *  their Trade Circle — subtle amber corner ribbon. */
  inCircle?: boolean;
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

  // Admin announcements wear the yellow rim + tinted background so the
  // Trade Off team voice is immediately distinguishable from member
  // posts. Also overrides the trailing "Trade Chat" chip with
  // "ANNOUNCEMENT" further down.
  const isAnnouncement = post.is_admin_announcement === true;
  // Cards are always white — only the border colour differentiates
  // admin announcements from member posts (yellow rim vs neutral).
  const articleClass = isAnnouncement
    ? "relative w-full overflow-hidden rounded-2xl border-2 bg-white shadow-sm"
    : "relative w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm";
  const articleStyle = isAnnouncement ? { borderColor: BRAND_YELLOW } : undefined;
  const heroImage = post.image_urls?.[0] ?? null;
  const extraImages = (post.image_urls ?? []).slice(1, 4);
  return (
    <article className={articleClass} style={articleStyle}>
      {inCircle && (
        <div
          className="pointer-events-none absolute right-0 top-0 z-10 select-none rounded-bl-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
          style={{
            background: "linear-gradient(135deg, #FFB300 0%, #B8860B 100%)",
            color: "#1B1A17"
          }}
          title="From your Trade Circle"
        >
          Your Circle
        </div>
      )}
      <div className="flex flex-col gap-2 p-3 sm:p-4">
        {/* Poster header — avatar (left) + name/meta (middle) +
            hero image thumbnail (right, if any). Compact 9x9 avatar. */}
        <header className="flex items-start gap-2.5">
          {isAnnouncement && (
            <span
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-2 ring-amber-400 shadow-sm"
              aria-hidden="true"
              title="Announcement from thenetworkers.app"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ANNOUNCEMENT_IMAGE}
                alt=""
                className="h-full w-full object-cover"
              />
            </span>
          )}
          {!isAnnouncement && (
            <a
              href={poster ? `/${poster.slug}` : "#"}
              className="shrink-0"
              aria-label={
                poster ? `Open ${posterName}'s profile` : "Trade chat post"
              }
            >
              <span
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-2 ring-amber-400 shadow-sm"
                aria-hidden="true"
                title="Trade Chat"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={CHAT_AVATAR_IMAGE}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </span>
            </a>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <a
                href={isAnnouncement ? "#" : poster ? `/${poster.slug}` : "#"}
                className="truncate text-[14px] font-extrabold text-neutral-900 sm:text-[15px]"
              >
                {isAnnouncement ? "thenetworkers.app Team" : posterName}
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
          {/* Hero image thumbnail — top-right, 44x44 square. Click
              opens the full lightbox. Extra images render as small
              thumbnails below in a mini strip. */}
          {heroImage && (
            <YardPostLightbox
              postId={post.id}
              imageUrl={heroImage}
              title={post.title}
              body={post.body}
              poster={poster}
              tradeText={tradeText}
              region={post.region ?? null}
              createdAt={post.created_at}
              waReplyUrl={replyUrl}
              variant="compact"
            />
          )}
        </header>

        {/* Extra image thumbnails — a compact strip under the header
            when the post has more than one image. Each opens the same
            lightbox on click. */}
        {extraImages.length > 0 && (
          <div className="flex gap-1.5">
            {extraImages.map((url) => (
              <YardPostLightbox
                key={url}
                postId={post.id}
                imageUrl={url}
                title={post.title}
                body={post.body}
                poster={poster}
                tradeText={tradeText}
                region={post.region ?? null}
                createdAt={post.created_at}
                waReplyUrl={replyUrl}
                variant="compact"
              />
            ))}
          </div>
        )}

        {/* Title + body. whitespace-pre-wrap keeps every newline the
            poster typed. Compact type sizes so the card stays tight. */}
        <div>
          <h3 className="text-[14px] font-extrabold leading-snug text-neutral-900 sm:text-[15px]">
            {post.title}
          </h3>
          <p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-[1.5] text-neutral-800">
            {renderBodyWithLinks(post.body)}
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

        {/* Reaction bar — thumbs up / dislike only. Flag hugs the
            right edge of the same row; not shown on announcements
            (official) or on the viewer's own posts. */}
        <div className="flex items-start justify-between gap-3 border-t border-neutral-100 pt-3">
          <div className="min-w-0 flex-1">
            <YardReactionBar
              postId={post.id}
              initialCounts={reactions}
              variant="minimal"
            />
          </div>
          {!isAnnouncement && (
            <YardFlagButton postId={post.id} posterSlug={poster?.slug ?? null} />
          )}
        </div>

        {/* Action row — WhatsApp (private DM to poster) on the left,
            image thumbnails on the right. Public conversation happens
            via the Comments panel below, not here. */}
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
                aria-label={`WhatsApp ${posterName} privately`}
              >
                <ReplyGlyph />
                WhatsApp
              </a>
            ) : null}
          </div>
        </div>

        {/* Public conversation — Facebook-style inline thread. */}
        <YardCommentsPanel
          postId={post.id}
          initialCount={post.comment_count ?? 0}
        />

        {/* Footer meta — contacted + days-left + new flag, one centred
            grey line. */}
        <p className="text-center text-[12px] font-bold text-neutral-500">
          {post.contact_count} contacted
          <span className="mx-1.5 text-neutral-300">&middot;</span>
          {daysRemaining(post.expires_at)}d left
          {isNewPost(post.created_at) && (
            <>
              <span className="mx-1.5 text-neutral-300">&middot;</span>
              <span style={{ color: "#92400E" }}>NEW</span>
            </>
          )}
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
