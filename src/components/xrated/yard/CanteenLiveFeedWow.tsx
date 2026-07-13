"use client";

// CanteenLiveFeedWow — mockup-mirrored Live Feed for mobile.
//
// Each row is a 2-column layout: text on the left (avatar + author +
// timestamp + optional LIVE badge + title + body), thumbnail on the
// right. Rows separated by hairline. Header carries "Live Feed •" + a
// "View All →" link (which opens the compose overlay in read-more
// mode — the underlying feed system routes through the same shell).

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { RotatorPost } from "@/components/xrated/yard/CanteenMobilePostsRotator";

const TAN = "#B8860B";

function isLive(iso: string): boolean {
  return Date.now() - Date.parse(iso) < 5 * 60 * 1000;
}

function timeAgoShort(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Split body into title + body. Convention: first sentence or first
// short line = title (bold), the rest = body. Uses a period or newline
// as the delimiter. Keeps the mockup's two-line "title / body" pattern.
function splitTitleBody(raw: string): { title: string; body: string } {
  const trimmed = raw.trim();
  const nl = trimmed.indexOf("\n");
  if (nl > 0 && nl < 80) {
    return { title: trimmed.slice(0, nl).trim(), body: trimmed.slice(nl + 1).trim() };
  }
  // Split at first period after 20 chars — gives a proper "title.
  // body." pattern.
  for (let i = 20; i < Math.min(80, trimmed.length); i++) {
    if (trimmed[i] === "." || trimmed[i] === "—") {
      return {
        title: trimmed.slice(0, i).trim(),
        body:  trimmed.slice(i + 1).trim()
      };
    }
  }
  return { title: trimmed.slice(0, 80), body: trimmed.slice(80).trim() };
}

// Hero-library kitchen thumbnails as fallback so demo mocks look real.
const DEMO_THUMBS = [
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2011_04_56%20PM.png",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2008_44_32%20AM.png",
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2030,%202026,%2006_38_39%20PM.png"
];

// Continuous vertical marquee CSS — duplicates the post list so the
// translateY(-50%) keyframe loops seamlessly. Pauses on hover so users
// can actually read a post they're interested in.
const MARQUEE_CSS = `
@keyframes canteen-live-feed-scroll-up {
  0%   { transform: translateY(0); }
  100% { transform: translateY(-50%); }
}
.canteen-live-feed-marquee {
  animation: canteen-live-feed-scroll-up 45s linear infinite;
  will-change: transform;
}
.canteen-live-feed-shell:hover .canteen-live-feed-marquee { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) {
  .canteen-live-feed-marquee { animation: none; }
}
`;

export function CanteenLiveFeedWow({
  posts,
  canteenSlug,
  inline = false
}: {
  posts: RotatorPost[];
  canteenSlug: string;
  inline?: boolean;
}) {
  if (posts.length === 0) return null;
  // Duplicate so translateY(-50%) loops seamlessly. When there are only
  // 1-2 posts the duplication makes the loop still feel like continuous
  // scroll (the same posts recycle) — matches the user's "if no new
  // posts show the posts over again" spec.
  const looped = [...posts, ...posts];
  const Wrapper: React.ElementType = inline ? "div" : "section";
  return (
    <Wrapper className={inline ? "" : "mx-auto max-w-6xl px-3 pt-5 md:px-6 md:pt-6"}>
      <style>{MARQUEE_CSS}</style>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[16px] font-black text-neutral-900">Live Feed</span>
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
            style={{ backgroundColor: TAN }}
          />
        </div>
        <Link
          href={`/trade-off/yard/canteens/${canteenSlug}/post`}
          className="inline-flex items-center gap-0.5 text-[11px] font-black text-neutral-700 hover:text-neutral-900"
          style={{ color: TAN }}
        >
          View All <ChevronRight size={12} strokeWidth={2.5}/>
        </Link>
      </div>

      {/* Fixed-height window with fade masks at top + bottom so posts
          enter/leave softly instead of hard-clipping. Marquee scrolls
          upward continuously; pauses on hover. */}
      <div
        className="canteen-live-feed-shell relative overflow-hidden"
        style={{
          height: "min(75vh, 340px)",
          maskImage: "linear-gradient(to bottom, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)"
        }}
      >
      <ul className="canteen-live-feed-marquee flex flex-col gap-3">
        {looped.map((p, i) => {
          const { title, body } = splitTitleBody(p.body);
          // Prefer the post's real image when available; deterministic
          // demo thumb (seeded by author slug) otherwise so the same
          // trade always gets the same fallback thumbnail.
          const thumbUrl = p.imageUrl || DEMO_THUMBS[
            (p.authorSlug.charCodeAt(0) + i) % DEMO_THUMBS.length
          ];
          return (
            <li key={`${p.id}-${i}`}>
              <Link
                href={`/trade-off/yard/canteens/${canteenSlug}/post?reply=${encodeURIComponent(p.id)}`}
                className="flex items-start gap-3 rounded-2xl p-1 transition active:bg-neutral-900/[0.03]"
              >
                {/* Text column */}
                <div className="min-w-0 flex-1">
                  {/* Author row: avatar + name + timestamp + LIVE */}
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      aria-hidden
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
                      style={{ backgroundColor: TAN }}
                    >
                      {p.authorDisplayName.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-black text-neutral-900">
                        {p.authorDisplayName}
                      </div>
                      <div className="text-[10px] text-neutral-500">
                        {timeAgoShort(p.createdAt)}
                      </div>
                    </div>
                    {isLive(p.createdAt) && (
                      <span
                        className="flex-shrink-0 rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em]"
                        style={{ backgroundColor: "rgba(184,134,11,0.15)", color: TAN }}
                      >
                        LIVE
                      </span>
                    )}
                  </div>
                  {/* Title (bold, one line) */}
                  <div className="line-clamp-1 text-[13.5px] font-black text-neutral-900">
                    {title}
                  </div>
                  {/* Body (small, 2 lines) */}
                  {body && (
                    <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-neutral-600">
                      {body}
                    </p>
                  )}
                </div>

                {/* Thumbnail — right side, aspect-square */}
                <div
                  className="h-[86px] w-[86px] flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100 shadow-sm sm:h-24 sm:w-24"
                  style={{
                    backgroundImage: `url('${thumbUrl}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center"
                  }}
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
      </div>
    </Wrapper>
  );
}
