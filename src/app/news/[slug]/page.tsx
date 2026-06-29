// Xrated Trades — Newsroom post page. /news/[slug]
//
// Server component. Reads one row from hammerex_xrated_news_posts via
// slug; 404s when not found OR not live. Renders title + byline +
// banner + optional video + markdown body + share row + back-link.
//
// NO COMMENTS. NO REACTION BAR. Members react + chat about the piece
// inside the Yard cross-post (created by /api/admin/news when the
// post goes live).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { BRAND, absolute } from "@/lib/seo";
import { findCategory } from "@/lib/newsCategories";
import { renderNewsMarkdown, readingMinutes } from "@/lib/newsMarkdown";
import { NewsShareRow } from "@/components/xrated/news/NewsShareRow";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

type NewsRow = {
  id: string;
  slug: string;
  title: string;
  category: string;
  body_markdown: string;
  excerpt: string | null;
  banner_url: string | null;
  video_url: string | null;
  status: string;
  published_at: string | null;
};

async function loadPost(slug: string): Promise<NewsRow | null> {
  const { data, error } = await supabaseAdmin
    .from("hammerex_xrated_news_posts")
    .select(
      "id, slug, title, category, body_markdown, excerpt, banner_url, video_url, status, published_at"
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("[news/slug] load failed:", error);
    return null;
  }
  if (!data || data.status !== "live") return null;
  return data as NewsRow;
}

function formatDateLong(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export async function generateMetadata({
  params
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) {
    return {
      title: "Newsroom | xratedtrade.com",
      description: "Newsroom post not found."
    };
  }
  const description =
    post.excerpt ?? `${post.title} — xratedtrade.com Newsroom.`;
  return {
    title: `${post.title} | xratedtrade.com Newsroom`,
    description,
    alternates: { canonical: `/news/${post.slug}` },
    openGraph: {
      type: "article",
      siteName: BRAND.name,
      title: post.title,
      description,
      url: absolute(`/news/${post.slug}`),
      images: post.banner_url
        ? [{ url: post.banner_url, alt: post.title }]
        : undefined
    }
  };
}

export default async function NewsPostPage({
  params
}: {
  params: Params;
}) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) {
    notFound();
  }

  const cat = findCategory(post.category);
  const html = renderNewsMarkdown(post.body_markdown);
  const minutes = readingMinutes(post.body_markdown);
  const dateLabel = formatDateLong(post.published_at);
  const canonical = absolute(`/news/${post.slug}`);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    author: { "@type": "Organization", name: "xratedtrade.com" },
    publisher: {
      "@type": "Organization",
      name: "xratedtrade.com",
      logo: { "@type": "ImageObject", url: BRAND.logo }
    },
    datePublished: post.published_at ?? undefined,
    dateModified: post.published_at ?? undefined,
    description: post.excerpt ?? post.title,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    image: post.banner_url ?? BRAND.logo
  };

  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <article className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <Link
          href="/news"
          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-neutral-500 transition hover:text-neutral-900"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to Newsroom
        </Link>

        <span
          className="mt-4 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900"
          style={{ background: XRATED_BRAND.accent }}
        >
          {cat.label}
        </span>

        <h1 className="mt-4 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
          {post.title}
        </h1>

        {post.excerpt && (
          <p className="mt-3 text-[15px] leading-relaxed text-neutral-700 sm:text-base">
            {post.excerpt}
          </p>
        )}

        <p className="mt-4 text-[13px] text-neutral-500">
          xratedtrade.com team
          {dateLabel ? ` · published ${dateLabel}` : ""} · {minutes} min read
        </p>

        {post.banner_url && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={post.banner_url}
            alt={post.title}
            className="mt-6 w-full rounded-2xl border border-neutral-200 object-cover"
          />
        )}

        {post.video_url && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-900">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={post.video_url}
              controls
              playsInline
              preload="metadata"
              className="block h-auto w-full"
            >
              Sorry, your browser does not support embedded video.
            </video>
          </div>
        )}

        <div
          className="prose-news mt-2"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <NewsShareRow url={canonical} title={post.title} />

        <div className="mt-10 border-t border-neutral-200 pt-6 text-center">
          <Link
            href="/news"
            className="inline-flex h-12 items-center gap-2 rounded-xl px-6 text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.98]"
            style={{
              background: XRATED_BRAND.accent,
              boxShadow: `0 4px 14px ${XRATED_BRAND.accent}66`
            }}
          >
            Read more from Newsroom
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>
      </article>

      <XratedFooter />
    </main>
  );
}
