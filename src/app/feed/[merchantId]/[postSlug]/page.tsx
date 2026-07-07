// /feed/[merchantId]/[postSlug] — per-post permalink. This is what
// Google indexes deeply and what customers land on from search or
// social shares. Full case-study-style layout with Article structured
// data for rich results.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, MessageSquare } from "lucide-react";
import { loadFeedPostBySlug } from "@/lib/feed/loader";

type PageProps = {
  params: Promise<{ merchantId: string; postSlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { merchantId, postSlug } = await params;
  const post = await loadFeedPostBySlug(merchantId, postSlug);
  if (!post) return { title: "Post not found" };
  return {
    title: post.headline,
    description: post.bodyMarkdown.slice(0, 160),
    openGraph: {
      title: post.headline,
      description: post.bodyMarkdown.slice(0, 160),
      images: post.heroImageUrl
        ? [{ url: post.heroImageUrl, alt: post.headline }]
        : undefined
    }
  };
}

export default async function FeedPostPage({ params }: PageProps) {
  const { merchantId, postSlug } = await params;
  const post = await loadFeedPostBySlug(merchantId, postSlug);
  if (!post || post.status !== "published") notFound();

  const trade = post.facets.trade as string | undefined;
  const service = post.facets.service as string | undefined;
  const materials = (post.facets.materials as string[] | undefined) ?? [];
  const city = post.facets.city as string | undefined;
  const postcode = post.facets.postcode as string | undefined;

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href={`/feed/${encodeURIComponent(merchantId)}`}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-neutral-700 hover:text-neutral-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to feed
        </Link>

        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            {new Date(post.publishedAt ?? post.updatedAt).toLocaleDateString(
              "en-GB",
              { day: "numeric", month: "long", year: "numeric" }
            )}
          </div>
          <h1 className="mt-1 text-2xl font-bold text-neutral-900 md:text-3xl">
            {post.headline}
          </h1>

          {post.heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.heroImageUrl}
              alt={post.headline}
              className="mt-4 w-full rounded-2xl border border-neutral-200 object-cover shadow-sm"
            />
          ) : null}

          <p className="mt-4 text-[15px] leading-relaxed text-neutral-800">
            {post.bodyMarkdown}
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {trade ? (
              <FactRow label="Trade">{humanise(trade)}</FactRow>
            ) : null}
            {service ? (
              <FactRow label="Service">{humanise(service)}</FactRow>
            ) : null}
            {materials.length > 0 ? (
              <FactRow label="Materials">
                {materials.map(humanise).join(", ")}
              </FactRow>
            ) : null}
            {(city || postcode) ? (
              <FactRow label="Location">
                {[city, postcode].filter(Boolean).join(" · ")}
              </FactRow>
            ) : null}
          </div>

          {post.photoUrls.length > 1 ? (
            <section className="mt-6">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Job photos
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {post.photoUrls.slice(1).map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={url}
                    alt={`${post.headline} photo ${i + 2}`}
                    className="aspect-square w-full rounded-lg object-cover"
                    loading="lazy"
                  />
                ))}
              </div>
            </section>
          ) : null}

          {post.ctaKind && post.ctaTarget ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="text-[15px] font-bold text-neutral-900">
                Interested in something similar?
              </h2>
              <div className="mt-3">
                <CtaButton kind={post.ctaKind} target={post.ctaTarget} />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.headline,
            datePublished: post.publishedAt ?? post.updatedAt,
            image: post.heroImageUrl ?? undefined,
            articleBody: post.bodyMarkdown,
            about: [trade, service].filter(Boolean),
            locationCreated: postcode
              ? { "@type": "Place", name: postcode }
              : undefined
          })
        }}
      />
    </main>
  );
}

function FactRow({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-0.5 text-[13px] font-medium text-neutral-900">
        {children}
      </div>
    </div>
  );
}

function CtaButton({ kind, target }: { kind: string; target: string }) {
  const label =
    kind === "get_quote"
      ? "Get a quote"
      : kind === "call"
      ? "Call now"
      : kind === "book"
      ? "Book"
      : "Message us";
  const Icon = kind === "call" ? Phone : kind === "book" ? Mail : MessageSquare;
  return (
    <Link
      href={target}
      className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-neutral-800"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

function humanise(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (t) => t.toUpperCase());
}
