// Xrated Trades — Newsroom index. /news
//
// Public, SSR'd, Google-indexable. Reads live posts from
// hammerex_xrated_news_posts ordered by published_at DESC. Filters by
// category via ?category=<slug>. Drafts + archived are hidden.
//
// Header reuses the XratedHeader so site nav (incl. the "News" link)
// renders consistently across the site.

import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { BRAND, absolute } from "@/lib/seo";
import { NEWS_CATEGORIES, findCategory } from "@/lib/newsCategories";

export const dynamic = "force-dynamic";

const HERO_BANNER =
  "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/imagekit-import/news-hero.png";

const TITLE = "Trade News — The Network";
const DESCRIPTION =
  "Construction news, platform announcements, and working-tradesperson opinion from The Network. Stay updated across every project.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/news" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: TITLE,
    description: DESCRIPTION,
    url: absolute("/news"),
    images: [{ url: HERO_BANNER, alt: "xratedtrade.com Construction News" }]
  }
};

type NewsRow = {
  id: string;
  slug: string;
  title: string;
  category: string;
  excerpt: string | null;
  banner_url: string | null;
  published_at: string | null;
};

type SearchParams = Promise<{ category?: string }>;

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

async function loadPosts(category: string | null): Promise<NewsRow[]> {
  let q = supabaseAdmin
    .from("hammerex_xrated_news_posts")
    .select("id, slug, title, category, excerpt, banner_url, published_at")
    .eq("status", "live")
    .order("published_at", { ascending: false })
    .limit(60);
  if (category) {
    q = q.eq("category", category);
  }
  const { data, error } = await q;
  if (error) {
    console.error("[news/index] load failed:", error);
    return [];
  }
  return (data ?? []) as NewsRow[];
}

export default async function NewsIndexPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const activeCategory =
    sp.category && NEWS_CATEGORIES.some((c) => c.slug === sp.category)
      ? sp.category
      : null;

  const posts = await loadPosts(activeCategory);

  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      {/* Hero — full-bleed banner with dark gradient overlay. Matches
          the /trade-off/tips rhythm. */}
      <section className="relative min-h-[360px] w-full overflow-hidden border-b border-neutral-200 sm:min-h-[460px] md:min-h-[520px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_BANNER}
          alt="xratedtrade.com Construction News — what's new at the platform"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(10,10,10,0.85) 0%, rgba(10,10,10,0.55) 45%, rgba(10,10,10,0.15) 75%, rgba(10,10,10,0) 100%)"
          }}
        />
        <div className="relative mx-auto flex min-h-[360px] max-w-5xl flex-col justify-end px-4 pb-12 pt-16 sm:min-h-[460px] sm:px-6 sm:pb-16 sm:pt-20 md:min-h-[520px]">
          <p
            className="text-xs font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Newsroom
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white drop-shadow-md sm:text-4xl md:text-5xl">
            Construction News
          </h1>
          <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-white/90 drop-shadow sm:text-sm">
            Stay updated whenever you’ve got a trade project running.
          </p>
        </div>
      </section>

      {/* Filter — segmented control. Sticky on scroll. Routes back to
          /news?category= for each category, plus "All" to clear. */}
      <nav
        aria-label="Newsroom categories"
        className="sticky top-[64px] z-20 border-b border-neutral-200 bg-white/95 backdrop-blur sm:top-[72px]"
      >
        <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
          <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-neutral-900 p-1 shadow-sm">
            <FilterSegment
              href="/news"
              label="All"
              active={!activeCategory}
            />
            {NEWS_CATEGORIES.map((c) => (
              <FilterSegment
                key={c.slug}
                href={`/news?category=${c.slug}`}
                label={c.label}
                active={activeCategory === c.slug}
              />
            ))}
          </div>
        </div>
      </nav>

      {/* Grid — 1 col mobile, 2 col tablet, 3 col desktop. */}
      <section className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-10">
        {posts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center text-[13px] text-neutral-500 sm:text-sm">
            No posts yet in this category. Check back soon.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => {
              const cat = findCategory(post.category);
              return (
                <li key={post.id}>
                  <Link
                    href={`/news/${post.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {post.banner_url ? (
                      <div className="relative h-40 w-full overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={post.banner_url}
                          alt={post.title}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        className="relative h-40 w-full"
                        style={{
                          background: `linear-gradient(135deg, ${cat.gradientFrom} 0%, ${cat.gradientTo} 100%)`
                        }}
                        aria-hidden="true"
                      >
                        <div
                          className="absolute inset-0 opacity-25 mix-blend-overlay"
                          style={{
                            background:
                              "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 50%)"
                          }}
                        />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-5">
                      <p
                        className="text-[11px] font-extrabold uppercase tracking-widest"
                        style={{ color: XRATED_BRAND.accent }}
                      >
                        {cat.label}
                      </p>
                      <h2 className="mt-1.5 text-base font-extrabold leading-snug text-neutral-900 sm:text-lg">
                        {post.title}
                      </h2>
                      {post.excerpt && (
                        <p className="mt-2 flex-1 text-[13px] leading-relaxed text-neutral-600 sm:text-sm">
                          {post.excerpt}
                        </p>
                      )}
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="text-[11px] text-neutral-500">
                          {formatDate(post.published_at)}
                        </span>
                        <span
                          className="inline-flex items-center gap-1 text-[13px] font-extrabold text-neutral-900 transition group-hover:gap-2 sm:text-sm"
                        >
                          Read{" "}
                          <span style={{ color: XRATED_BRAND.accent }}>
                            &rarr;
                          </span>
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <XratedFooter />
    </main>
  );
}

function FilterSegment({
  href,
  label,
  active
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "inline-flex h-9 shrink-0 items-center rounded-full px-4 text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 transition-colors"
          : "inline-flex h-9 shrink-0 items-center rounded-full bg-transparent px-4 text-[13px] font-bold uppercase tracking-wider text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      }
      style={
        active
          ? { background: XRATED_BRAND.accent }
          : undefined
      }
    >
      {label}
    </Link>
  );
}
