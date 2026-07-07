// /feed/[merchantId] — the merchant's public live feed timeline.
//
// SEO-first: server-rendered, meta description populated, LocalBusiness
// structured data hint (via JSON-LD), permalinks per post. This is
// what Google indexes and what customers land on.

import type { Metadata } from "next";
import { LiveFeedBlock } from "@/components/feed/LiveFeedBlock";
import { loadPublishedFeed } from "@/lib/feed/loader";

type PageProps = {
  params: Promise<{ merchantId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { merchantId } = await params;
  const posts = await loadPublishedFeed(merchantId, 3);
  const preview = posts
    .map((p) => p.headline)
    .slice(0, 3)
    .join(" · ");
  return {
    title: preview ? `${preview} · Recent work` : "Recent work",
    description: preview
      ? `${preview}. Fresh completed jobs and project updates.`
      : "Recent completed jobs and project updates."
  };
}

export default async function MerchantFeedPage({ params }: PageProps) {
  const { merchantId } = await params;
  const posts = await loadPublishedFeed(merchantId, 24);

  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
            Live feed
          </div>
          <h1 className="mt-2 text-3xl font-bold text-neutral-900 md:text-4xl">
            Recent work
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-neutral-700">
            Every job posted straight from the site. Updated in real time as
            the team finishes work.
          </p>
        </div>
      </header>

      {posts.length === 0 ? (
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-[13px] text-neutral-600">
            No published posts yet. Head to{" "}
            <a href="/capture" className="font-semibold underline">
              /capture
            </a>{" "}
            to record your first.
          </div>
        </div>
      ) : (
        <LiveFeedBlock
          merchantId={merchantId}
          limit={24}
          heading=""
          subhead=""
        />
      )}

      {/* Structured data — helps Google surface individual posts */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: posts.slice(0, 10).map((p, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `/feed/${encodeURIComponent(merchantId)}/${encodeURIComponent(p.slug)}`,
              name: p.headline
            }))
          })
        }}
      />
    </main>
  );
}
