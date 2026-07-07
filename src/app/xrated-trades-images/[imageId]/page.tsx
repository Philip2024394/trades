// /xrated-trades-images/[imageId] — image detail + tier picker.
//
// Server-renders the image + 4 tier options + a checkout form. The
// tier picker is a client island that handles the POST to
// /api/licenses/checkout and redirects to Stripe.
//
// Query params:
//   ?tier=standard|regional|buyout  — pre-selects a tier
//   ?merchantId=uuid                — merchant flow (skips email input)
//   ?canceled=1                     — shows a "no worries, try again"
//                                     banner if Stripe redirected back

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { allHeroImages } from "@/lib/hero-swap/library";
import { allBeforeAfterEntries } from "@/lib/before-after/library";
import { TierPicker } from "./TierPicker";

type PageProps = {
  params: Promise<{ imageId: string }>;
  searchParams: Promise<{
    tier?: string;
    merchantId?: string;
    canceled?: string;
    postcode?: string;
  }>;
};

function resolve(imageId: string) {
  const hero = allHeroImages().find((h) => h.id === imageId);
  if (hero) return { subject: hero.subject, keywords: hero.keywords_strict };
  const ba = allBeforeAfterEntries().find((b) => b.id === imageId);
  if (ba) return { subject: ba.subject, keywords: ba.keywords_strict };
  return null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { imageId } = await params;
  const r = resolve(imageId);
  if (!r) return { title: "Image not found · xrated trades" };
  return {
    title: `${r.subject} — Licence from £39 · xrated trades`,
    description: `Licence ${r.keywords.slice(0, 3).join(", ")} imagery for your business.`,
    openGraph: {
      images: [
        {
          url: `/api/image/serve/${encodeURIComponent(imageId)}`,
          width: 1200,
          height: 630,
          alt: r.subject
        }
      ]
    }
  };
}

export default async function ImageMarketplacePage({
  params,
  searchParams
}: PageProps) {
  const { imageId } = await params;
  const sp = await searchParams;
  const resolved = resolve(imageId);
  if (!resolved) notFound();

  const preselectedTier = normaliseTierParam(sp.tier);
  const canceled = sp.canceled === "1";

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Link
          href="/xrated-trades-images"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-neutral-700 hover:text-neutral-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to library
        </Link>

        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/image/serve/${encodeURIComponent(imageId)}`}
              alt={resolved.subject}
              className="w-full object-contain"
            />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              xrated trades · licenced image
            </div>
            <h1 className="mt-2 text-2xl font-bold text-neutral-900">
              {resolved.subject}
            </h1>
            <p className="mt-1 text-[13px] text-neutral-700">
              Tagged for {resolved.keywords.slice(0, 3).join(", ")}.
              Pick a licence tier below.
            </p>

            {canceled ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">
                Checkout cancelled — no charge. Pick a tier below to
                start again.
              </div>
            ) : null}

            <div className="mt-5">
              <TierPicker
                imageId={imageId}
                imageSubject={resolved.subject}
                merchantId={sp.merchantId ?? null}
                initialTier={preselectedTier}
                initialPostcode={sp.postcode ?? ""}
              />
            </div>

            <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 text-[11px] text-neutral-600">
              Every licence includes commercial-use rights for the buyer
              only. No sublicensing, no resale as-is. Full terms at{" "}
              <Link href="/image-licence-terms" className="underline">
                xratedtrades.com/image-licence-terms
              </Link>
              .
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function normaliseTierParam(v: string | undefined): string {
  if (!v) return "standard";
  if (v === "regional") return "regional_exclusive";
  if (v === "buyout") return "full_buyout";
  return v;
}
