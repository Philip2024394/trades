// Facebook-style feed post card. One per network post.
// Author + area chip + body + optional image + like/comment/share footer.

"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, MessageCircle, Share2, MoreHorizontal, ArrowRight } from "lucide-react";
import type { FeedPost } from "../data/socialGraph";

type Props = {
  post: FeedPost;
};

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h`;
  if (mins < 60 * 24 * 7) return `${Math.floor(mins / (60 * 24))}d`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function NetworkFeedCard({ post }: Props) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likeCount);

  function toggleLike() {
    setLiked((l) => {
      const next = !l;
      setLikeCount((c) => (next ? c + 1 : c - 1));
      return next;
    });
  }

  const authorHref =
    post.authorType === "merchant"
      ? `/tc/trade-center/merchant/${post.authorSlug}`
      : `/tc/trade/${post.authorSlug}`;

  return (
    <article
      className="rounded-2xl border bg-white shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      {/* Header */}
      <header className="flex items-start gap-3 p-4">
        <Link
          href={authorHref}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-black"
          style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
          aria-label={post.authorName}
        >
          {post.authorInitials}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={authorHref}
            className="text-[13px] font-black text-neutral-900 hover:underline"
          >
            {post.authorName}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-neutral-500">
            <span
              className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider"
              style={{ backgroundColor: `${post.authorAreaColour}18`, color: post.authorAreaColour }}
            >
              {post.authorAreaLabel}
            </span>
            <span>·</span>
            <span>{timeAgo(post.createdAtIso)}</span>
          </div>
        </div>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
          aria-label="More"
        >
          <MoreHorizontal size={16}/>
        </button>
      </header>

      {/* Body */}
      <div className="px-4 pb-3 text-[12.5px] leading-relaxed text-neutral-800">
        {post.body}
      </div>

      {/* Optional image */}
      {post.imageUrl && (
        <Link
          href={post.linkHref ?? authorHref}
          className="relative block aspect-[4/3] w-full overflow-hidden"
          style={{ backgroundColor: "#F5F0E4" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.imageUrl} alt="" className="h-full w-full object-cover"/>
        </Link>
      )}

      {/* Link preview */}
      {post.linkHref && !post.imageUrl && (
        <Link
          href={post.linkHref}
          className="mx-4 mb-3 inline-flex items-center gap-1.5 rounded-full border bg-neutral-50 px-3 py-1.5 text-[11px] font-black text-neutral-700 shadow-sm hover:bg-neutral-100"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          {post.linkLabel ?? "See more"}
          <ArrowRight size={11}/>
        </Link>
      )}

      {/* Actions footer */}
      <footer
        className="flex items-center gap-1 border-t px-2 py-1.5"
        style={{ borderColor: "rgba(139,69,19,0.10)" }}
      >
        <ActionButton
          Icon={Heart}
          count={likeCount}
          active={liked}
          onClick={toggleLike}
          activeColour="#DC2626"
          label="Like"
        />
        <ActionButton
          Icon={MessageCircle}
          count={post.commentCount}
          label="Comment"
        />
        <ActionButton
          Icon={Share2}
          count={post.shareCount}
          label="Share"
        />
      </footer>
    </article>
  );
}

function ActionButton({
  Icon,
  count,
  active,
  onClick,
  activeColour = "#0A0A0A",
  label
}: {
  Icon: typeof Heart;
  count: number;
  active?: boolean;
  onClick?: () => void;
  activeColour?: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-black uppercase tracking-wider transition hover:bg-neutral-100"
      style={{ color: active ? activeColour : "#525252" }}
      aria-label={label}
      aria-pressed={active}
    >
      <Icon size={13} fill={active ? activeColour : "none"} strokeWidth={2}/>
      <span>{label}</span>
      {count > 0 && <span className="text-[10px] text-neutral-500">· {count}</span>}
    </button>
  );
}
