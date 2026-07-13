// LiveFeedBlock — the embeddable component the merchant drops onto
// their landing page (via PageBuilder or manually). Renders the last
// N published feed posts as a magazine-style timeline.
//
// Server-safe: reads directly from the loader. No client bundle.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { loadPublishedFeed } from "@/lib/feed/loader";
import type { FeedPost } from "@/lib/feed/types";

export type LiveFeedBlockProps = {
  merchantId: string;
  limit?: number;
  heading?: string;
  subhead?: string;
  showFacetChips?: boolean;
};

export async function LiveFeedBlock({
  merchantId,
  limit = 6,
  heading = "Recent work",
  subhead = "Fresh jobs, straight from the site.",
  showFacetChips = true
}: LiveFeedBlockProps) {
  const posts = await loadPublishedFeed(merchantId, limit);
  if (posts.length === 0) {
    return null;
  }
  return (
    <section className="px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <h2 className="text-[22px] font-bold text-neutral-900 md:text-[28px]">
            {heading}
          </h2>
          {subhead ? (
            <p className="mt-1 text-[13px] text-neutral-600 md:text-[14px]">
              {subhead}
            </p>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <FeedCard
              key={post.id}
              post={post}
              merchantId={merchantId}
              showFacetChips={showFacetChips}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeedCard({
  post,
  merchantId,
  showFacetChips
}: {
  post: FeedPost;
  merchantId: string;
  showFacetChips: boolean;
}) {
  const trade = post.facets.trade as string | undefined;
  const service = post.facets.service as string | undefined;
  const materials = (post.facets.materials as string[] | undefined) ?? [];
  const permalink = `/feed/${encodeURIComponent(merchantId)}/${encodeURIComponent(post.slug)}`;
  return (
    <Link
      href={permalink}
      className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:border-neutral-300 hover:shadow-sm"
    >
      {post.heroImageUrl ? (
        // object-contain per platform rule (no cropping). Soft grey
        // padding on either side when the source isn't 16:9.
        <div className="relative aspect-[16/9] w-full bg-[#F3F4F6]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.heroImageUrl}
            alt={post.headline}
            className="absolute inset-0 h-full w-full object-contain p-1"
            loading="lazy"
          />
        </div>
      ) : null}
      <div className="p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          {relativeDate(post.publishedAt ?? post.updatedAt)}
        </div>
        <h3 className="mt-1 text-[15px] font-bold text-neutral-900">
          {post.headline}
        </h3>
        <p className="mt-1 line-clamp-2 text-[13px] text-neutral-700">
          {post.bodyMarkdown}
        </p>
        {showFacetChips ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {trade ? <Chip>{humanise(trade)}</Chip> : null}
            {service ? <Chip>{humanise(service)}</Chip> : null}
            {materials.slice(0, 2).map((m) => (
              <Chip key={m} muted>
                {humanise(m)}
              </Chip>
            ))}
          </div>
        ) : null}
        <div className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-neutral-900">
          Read <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

function Chip({
  children,
  muted = false
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
        muted
          ? "bg-neutral-100 text-neutral-600"
          : "bg-amber-100 text-amber-900"
      }`}
    >
      {children}
    </span>
  );
}

function humanise(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (t) => t.toUpperCase());
}

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const days = Math.floor((now - then) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "Last week";
  if (weeks < 4) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "Last month";
  return `${months} months ago`;
}
