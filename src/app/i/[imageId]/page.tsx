// /i/[imageId] — the SEO backlink landing.
//
// This is the URL embedded in every preview-tier corner watermark
// (visually) AND in every image's LSB steganography payload. When
// someone Googles a stolen image and lands here, they see:
//
//   - The image itself (with our license CTA overlaid)
//   - Who currently licences it (if anyone) — or a call to license it
//   - Three related images from the same trade / vibe
//   - "Log a report" button if they think their image was stolen
//
// The page is server-rendered so search engines index the trade
// keywords + related images. Every visit is a lead.

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ShieldAlert,
  Sparkles
} from "lucide-react";
import { allHeroImages } from "@/lib/hero-swap/library";
import { allBeforeAfterEntries } from "@/lib/before-after/library";
import type { HeroImage } from "@/lib/hero-swap/types";

type PageProps = {
  params: Promise<{ imageId: string }>;
};

function resolveEntry(imageId: string) {
  const hero = allHeroImages().find((h) => h.id === imageId);
  if (hero) return { kind: "hero" as const, entry: hero };
  const ba = allBeforeAfterEntries().find((b) => b.id === imageId);
  if (ba) return { kind: "before-after" as const, entry: ba };
  return null;
}

export async function generateMetadata({
  params
}: PageProps): Promise<Metadata> {
  const { imageId } = await params;
  const resolved = resolveEntry(imageId);
  if (!resolved) {
    return {
      title: "Image not found · xrated trades",
      description: "This image is not in the xrated trades library."
    };
  }
  const subject =
    resolved.kind === "hero"
      ? (resolved.entry as HeroImage).subject
      : resolved.entry.subject;
  const keywords =
    resolved.kind === "hero"
      ? (resolved.entry as HeroImage).keywords_strict
      : resolved.entry.keywords_strict;
  return {
    title: `${subject} · Licence this image · xrated trades`,
    description: `Original professional imagery for ${keywords.slice(0, 3).join(", ")}. Licence for £39 or claim exclusive regional rights. UK-specific trade photography, tagged + curated.`,
    openGraph: {
      title: `${subject} — xrated trades`,
      description: `Licence this image for your business. UK trade taxonomy, keyword-matched.`,
      images: [
        {
          url: `/api/image/serve/${encodeURIComponent(imageId)}`,
          width: 1200,
          height: 630,
          alt: subject
        }
      ]
    },
    // Machine-readable copyright hint for image search bots.
    other: {
      "og:type": "article",
      "article:author": "xratedtrades.com",
      copyright: "© xratedtrades.com — All rights reserved"
    }
  };
}

export default async function ImageBacklinkPage({ params }: PageProps) {
  const { imageId } = await params;
  const resolved = resolveEntry(imageId);

  if (!resolved) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-neutral-400" />
        <h1 className="mt-2 text-xl font-bold text-neutral-900">
          Image not in the library
        </h1>
        <p className="mt-1 text-[13px] text-neutral-600">
          This ID doesn&apos;t match any image we&apos;ve published. If you
          think an image has been stolen from our library and you have a
          copy, you can{" "}
          <Link href="/i/verify" className="underline">
            verify it via our decoder
          </Link>
          .
        </p>
      </main>
    );
  }

  const subject =
    resolved.kind === "hero"
      ? (resolved.entry as HeroImage).subject
      : resolved.entry.subject;
  const keywords =
    resolved.kind === "hero"
      ? (resolved.entry as HeroImage).keywords_strict
      : resolved.entry.keywords_strict;
  const related = getRelated(imageId, keywords);

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
          <BadgeCheck className="h-3.5 w-3.5" />
          xrated trades · licensed image library
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 md:text-3xl">
          {subject}
        </h1>
        <p className="mt-1 text-[13px] text-neutral-700">
          Tagged for {keywords.slice(0, 3).join(", ")} · UK-specific trade
          imagery · curated + keyword-matched
        </p>

        <div className="mt-5 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/image/serve/${encodeURIComponent(imageId)}`}
            alt={subject}
            className="w-full object-contain"
          />
        </div>

        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <h2 className="text-[15px] font-bold text-neutral-900">
                Licence this image — from £39
              </h2>
              <p className="mt-1 text-[13px] text-neutral-700">
                One-time licence for your website, ads, and print. Or lock
                it exclusively to your postcode from £29/mo so no other
                merchant near you can use it.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/xrated-trades-images/${imageId}?tier=standard`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-neutral-800"
                >
                  Licence for £39 <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href={`/xrated-trades-images/${imageId}?tier=regional`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-neutral-900 transition hover:bg-neutral-50"
                >
                  Lock it to my area from £29/mo
                </Link>
                <Link
                  href={`/xrated-trades-images/${imageId}?tier=buyout`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-neutral-900 transition hover:bg-neutral-50"
                >
                  Own it outright from £299
                </Link>
              </div>
            </div>
          </div>
        </section>

        {related.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-[15px] font-bold text-neutral-900">
              Related images in the {keywords[0]} library
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={`/i/${r.id}`}
                  className="group overflow-hidden rounded-xl border border-neutral-200 bg-white transition hover:border-neutral-300"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/image/serve/${encodeURIComponent(r.id)}`}
                    alt={r.subject}
                    className="aspect-video w-full object-cover"
                  />
                  <div className="p-2">
                    <div className="line-clamp-2 text-[12px] font-medium text-neutral-800">
                      {r.subject}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="text-[13px] font-bold text-neutral-900">
            Think your image was stolen and appears in our library?
          </h2>
          <p className="mt-1 text-[12px] text-neutral-700">
            Every image in the xrated trades library carries an invisible
            provenance mark. Upload the version you have — our decoder
            reads the mark and shows the original owner.
          </p>
          <Link
            href="/i/verify"
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-neutral-900 transition hover:bg-neutral-50"
          >
            Verify an image
          </Link>
        </section>
      </div>
    </main>
  );
}

function getRelated(
  currentId: string,
  keywords: string[]
): Array<{ id: string; subject: string }> {
  const kws = new Set(keywords.map((k) => k.toLowerCase()));
  const heroes = allHeroImages()
    .filter(
      (h) =>
        h.id !== currentId &&
        h.keywords_strict.some((k) => kws.has(k.toLowerCase()))
    )
    .slice(0, 3)
    .map((h) => ({ id: h.id, subject: h.subject }));
  return heroes;
}
