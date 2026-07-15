"use client";

// CanteenMobilePostsRotator — mobile-only vertical rotator.
//
// Shows 3 post cards stacked, auto-scrolls up every 5 seconds so a
// visitor scanning the canteen page can catch the pulse of what's
// happening without reading the whole feed. Tap the panel to pause the
// auto-rotation; up/down chevron pills let the user step manually.
//
// Card content is intentionally minimal — author + preview body +
// timestamp + a Reply chip. Tapping Reply routes to /post which opens
// the composer over the hero. Tapping the card itself deep-links to the
// full feed with the post scrolled into view.
//
// Only mounts at < lg. The desktop side lane replaces it.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronUp, ChevronDown, MessageCircle, Pause, Play, Heart, MessageSquare } from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK } from "@/lib/brand/tokens";

export type RotatorPost = {
  id: string;
  authorDisplayName: string;
  authorSlug: string;
  body: string;
  createdAt: string;
  /** First uploaded photo URL if the post has one — used by the Live
   *  Feed cards as the right-side thumbnail. */
  imageUrl?: string | null;
  /** Poster's avatar image URL. When null the feed renders the yellow
   *  initial chip; when set the card shows a real face. */
  authorAvatarUrl?: string | null;
  /** Live reaction + reply counts so the rotator card mirrors the
   *  full CanteenPostCard's engagement bar. Defaults to 0 when the
   *  underlying post doesn't have them. */
  reactionsLike?: number;
  replyCount?: number;
};

const ROTATE_MS = 5000;

function isLive(iso: string): boolean {
  // Post is "LIVE" when it landed less than 5 minutes ago — same
  // freshness gate as the mockup's LIVE badge on the first post.
  return Date.now() - Date.parse(iso) < 5 * 60 * 1000;
}

function timeAgoShort(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

export function CanteenMobilePostsRotator({
  posts,
  canteenSlug
}: {
  posts: RotatorPost[];
  canteenSlug: string;
}) {
  // Ensure we always render exactly 3 slots even if fewer posts exist.
  const slots = useMemo(() => posts.slice(0, 6), [posts]); // pool of up to 6
  const [topIndex, setTopIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || slots.length <= 3) return;
    const t = setInterval(() => {
      setTopIndex((i) => (i + 1) % slots.length);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [paused, slots.length]);

  function step(direction: -1 | 1) {
    setTopIndex((i) => {
      const next = (i + direction + slots.length) % slots.length;
      return next;
    });
  }

  if (slots.length === 0) return null;
  // Compute the 3-window starting at topIndex (wraps around).
  const visible = [0, 1, 2].map((offset) => slots[(topIndex + offset) % slots.length]);

  return (
    <section className="lg:hidden">
      <div className="mb-2 flex items-center justify-between px-0.5">
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: BRAND_YELLOW }}
          />
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Live from the canteen
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous post"
            className="flex h-7 w-7 items-center justify-center rounded-full border bg-white text-neutral-600 shadow-sm active:scale-[0.95]"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <ChevronUp size={13}/>
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next post"
            className="flex h-7 w-7 items-center justify-center rounded-full border bg-white text-neutral-600 shadow-sm active:scale-[0.95]"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <ChevronDown size={13}/>
          </button>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Play rotation" : "Pause rotation"}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white shadow-sm active:scale-[0.95]"
            style={{ backgroundColor: BRAND_BLACK }}
          >
            {paused ? <Play size={11} strokeWidth={2.6}/> : <Pause size={11} strokeWidth={2.6}/>}
          </button>
        </div>
      </div>

      <ul className="flex flex-col">
        {visible.map((p, i) => (
          <li key={`${p.id}-${i}`}>
            {i > 0 && (
              /* Dashed divider between posts — inset 16px on each end
                 so the line doesn't run edge-to-edge. Matches the
                 FeedList tabbed-section separator styling exactly. */
              <div
                aria-hidden
                style={{
                  borderTop:    "1.5px dashed rgba(0,0,0,0.15)",
                  marginLeft:   "16px",
                  marginRight:  "16px",
                  marginTop:    "10px",
                  marginBottom: "10px"
                }}
              />
            )}
            <RotatorCard
              post={p}
              canteenSlug={canteenSlug}
              stackIndex={i}
            />
          </li>
        ))}
      </ul>

      {/* Project Quote CTA — sits at the bottom of the running rotator.
          Opens the in-page Contact tab via the same CustomEvent bridge
          the Quick Actions use, keeping the "never leaves the page" flow. */}
      <div className="mt-3">
        <a
          href="#tab-contact"
          onClick={(e) => {
            e.preventDefault();
            window.history.replaceState(null, "", "#tab-contact");
            window.dispatchEvent(new CustomEvent("canteen:set-tab", {
              detail: { tab: "contact" }
            }));
            document.getElementById("canteen-tabbed")?.scrollIntoView({
              behavior: "smooth",
              block: "start"
            });
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition active:scale-[0.97]"
          style={{ backgroundColor: BRAND_YELLOW }}
        >
          Project Quote
        </a>
      </div>
    </section>
  );
}

function RotatorCard({
  post,
  canteenSlug,
  stackIndex
}: {
  post: RotatorPost;
  canteenSlug: string;
  stackIndex: number;
}) {
  // Fade the second and third card slightly so the eye focuses on the
  // top post. Standard rotator visual pattern.
  const opacity = stackIndex === 0 ? 1 : stackIndex === 1 ? 0.85 : 0.7;
  return (
    <article
      className="rounded-xl border bg-white p-4 shadow-sm transition"
      style={{ borderColor: "rgba(139,69,19,0.15)", opacity }}
    >
      {/* Header row — matches CanteenPostCard's avatar + name +
          timestamp treatment so the visual language stays consistent
          with the full feed. LIVE badge on the right when the post is
          less than 5 minutes old (mockup pattern). */}
      <div className="mb-2 flex items-center gap-2">
        <span
          aria-hidden
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-black"
          style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
        >
          {post.authorDisplayName.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-black text-neutral-900">
            {post.authorDisplayName}
          </div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            {timeAgoShort(post.createdAt)}
          </div>
        </div>
        {isLive(post.createdAt) && (
          <span
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-black uppercase tracking-[0.16em] shadow-sm"
            style={{ backgroundColor: "rgba(184,134,11,0.15)", color: "#B8860B" }}
          >
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: "#B8860B" }}
            />
            LIVE
          </span>
        )}
      </div>

      {/* Body — same size + line-height as CanteenPostCard; clamped
          to 3 lines so all three rotator slots stay balanced. */}
      <p className="line-clamp-3 text-[13px] leading-relaxed text-neutral-700">
        {post.body}
      </p>

      {/* Reactions bar — mirrors CanteenPostCard's engagement row so
          the rotator cards ARE the live feed cards, not a simplified
          copy. Like + Comment count are read-only tap targets that
          navigate to the compose overlay so the full reactions flow
          lives on one surface (the /post page). Reply chip is the
          primary action, painted yellow to match brand. */}
      <RotatorReactionRow
        canteenSlug={canteenSlug}
        postId={post.id}
        likes={post.reactionsLike ?? 0}
        comments={post.replyCount ?? 0}
      />
    </article>
  );
}

function RotatorReactionRow({
  canteenSlug,
  postId,
  likes,
  comments
}: {
  canteenSlug: string;
  postId: string;
  likes: number;
  comments: number;
}) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(likes);
  const replyHref = `/trade-off/yard/canteens/${canteenSlug}/post?reply=${encodeURIComponent(postId)}`;

  async function toggleLike() {
    // Optimistic like — mirrors ReactionRow's toggle behavior. Fires
    // to the same /react endpoint so likes on rotator cards persist.
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => Math.max(0, c + (wasLiked ? -1 : 1)));
    try {
      const res = await fetch(`/api/canteens/posts/${encodeURIComponent(postId)}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "like" })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        // Roll back on server rejection.
        setLiked(wasLiked);
        setLikeCount((c) => Math.max(0, c + (wasLiked ? 1 : -1)));
        return;
      }
      if (typeof data.count === "number") setLikeCount(data.count);
      if (typeof data.reacted === "boolean") setLiked(data.reacted);
    } catch {
      setLiked(wasLiked);
      setLikeCount((c) => Math.max(0, c + (wasLiked ? 1 : -1)));
    }
  }

  return (
    <div
      className="mt-3 flex items-center justify-between border-t pt-2"
      style={{ borderColor: "rgba(139,69,19,0.10)" }}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleLike}
          className="inline-flex items-center gap-1 text-[11px] font-black text-neutral-600 transition active:scale-[0.95]"
          aria-label={liked ? "Unlike" : "Like"}
        >
          <Heart
            size={14}
            strokeWidth={2.2}
            className={liked ? "fill-current text-red-500" : ""}
          />
          <span className={liked ? "text-red-500" : ""}>{likeCount}</span>
        </button>
        <Link
          href={replyHref}
          className="inline-flex items-center gap-1 text-[11px] font-black text-neutral-600 transition active:scale-[0.95]"
          aria-label={`${comments} comments`}
        >
          <MessageSquare size={14} strokeWidth={2.2} fill={BRAND_YELLOW} style={{ color: BRAND_YELLOW }}/>
          <span>{comments}</span>
          <span className="text-neutral-400">
            comment{comments === 1 ? "" : "s"}
          </span>
        </Link>
      </div>
      <Link
        href={replyHref}
        className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[11px] font-black uppercase tracking-wider shadow-sm active:scale-[0.97]"
        style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
      >
        <MessageCircle size={11} strokeWidth={2.5}/>
        Reply
      </Link>
    </div>
  );
}
