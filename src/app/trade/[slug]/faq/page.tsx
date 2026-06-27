// Dedicated "FAQ" page.
//
// Standalone surface a tradesperson can share separately from their main
// profile — e.g. "All the questions I get about plastering, with photos:
// xratedtrade.com/<slug>/faq". Hero up top so the visitor knows whose
// FAQs these are; category filter chips; one card per FAQ with the ref
// code badge, question, answer, image grid (lightbox), share button.
//
// Indexable. Schema.org FAQPage JSON-LD is the SEO wedge — long-tail
// "<plain question>" queries land here and rank for the AI Overview /
// rich-snippet panel. OG / Twitter cards use the first image of the
// first FAQ as the social preview.
//
// Gated to paid tier AND the `faq_page` add-on enabled. Free or
// add-on-off profiles bounce back to the main profile rather than
// render a dead page.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  supabase,
  type HammerexTradeOffListing,
  type HammerexXratedFaqItem,
  type HammerexXratedFaqImage
} from "@/lib/supabase";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { PremiumHero } from "@/components/xrated/profile/PremiumHero";
import { FaqImageLightbox } from "@/components/xrated/profile/FaqImageLightbox";
import { FaqShareButton } from "@/components/xrated/profile/FaqShareButton";
import { FaqPageClientChrome } from "@/components/xrated/profile/FaqPageClientChrome";
import { tradeLabel, whatsappQuoteUrl } from "@/lib/tradeOff";
import { effectiveTier } from "@/lib/xratedTrades";
import { isFaqPageOn } from "@/lib/xratedAddons";
import { absolute, BRAND, faqJsonLd } from "@/lib/seo";

export const revalidate = 600;

type FaqCategory = HammerexXratedFaqItem["category"];

const CATEGORY_LABEL: Record<FaqCategory, string> = {
  general: "General",
  pricing: "Pricing",
  process: "Process",
  materials: "Materials",
  trust: "Trust",
  warranty: "Warranty",
  aftercare: "Aftercare"
};

const CATEGORY_ORDER: FaqCategory[] = [
  "general",
  "pricing",
  "process",
  "materials",
  "trust",
  "warranty",
  "aftercare"
];

async function loadListing(
  slug: string
): Promise<HammerexTradeOffListing | null> {
  const res = await supabase
    .from("hammerex_trade_off_listings")
    .select("*")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  return (res.data ?? null) as HammerexTradeOffListing | null;
}

async function loadFaqs(listingId: string): Promise<
  (HammerexXratedFaqItem & { images: HammerexXratedFaqImage[] })[]
> {
  const faqsRes = await supabase
    .from("hammerex_xrated_faq_items")
    .select("*")
    .eq("listing_id", listingId)
    .eq("status", "live")
    .order("sort_order", { ascending: true });
  const faqs = (faqsRes.data ?? []) as HammerexXratedFaqItem[];
  if (faqs.length === 0) return [];

  const imgRes = await supabase
    .from("hammerex_xrated_faq_images")
    .select("*")
    .in("faq_id", faqs.map((f) => f.id))
    .order("sort_order", { ascending: true });
  const imagesByFaq = ((imgRes.data ?? []) as HammerexXratedFaqImage[]).reduce<
    Record<string, HammerexXratedFaqImage[]>
  >((acc, img) => {
    (acc[img.faq_id] = acc[img.faq_id] ?? []).push(img);
    return acc;
  }, {});

  return faqs.map((f) => ({ ...f, images: imagesByFaq[f.id] ?? [] }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) return { title: "FAQ" };
  const firstName =
    listing.display_name.split(/\s+/)[0] ?? listing.display_name;
  const primary = tradeLabel(listing.primary_trade);
  const faqs = await loadFaqs(listing.id);
  const count = faqs.length;
  const firstImage = faqs.find((f) => f.images.length > 0)?.images[0]?.image_url;
  const title = `${firstName}'s FAQs — ${count} answers from a ${primary.toLowerCase()} in ${listing.city} | Xrated`;
  const description =
    count === 0
      ? `${firstName} (${primary} in ${listing.city}) is preparing their FAQ knowledge base.`
      : `${firstName} (${primary} in ${listing.city}) answers ${count} of the questions customers ask before booking — with reference-numbered photos.`;
  const url = absolute(`/${slug}/faq`);
  const ogImage = firstImage ?? listing.photos[0] ?? listing.avatar_url ?? BRAND.logo;
  return {
    title,
    description,
    alternates: { canonical: `/${slug}/faq` },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      siteName: BRAND.name,
      images: ogImage ? [{ url: ogImage }] : undefined
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined
    }
  };
}

export default async function FaqPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) notFound();

  const tier = effectiveTier(listing);
  const isPaid = tier === "app_trial" || tier === "app_paid";
  if (!isPaid || !isFaqPageOn(listing)) redirect(`/${slug}`);

  const primary = tradeLabel(listing.primary_trade);
  const waUrl = whatsappQuoteUrl(
    listing.whatsapp,
    listing.display_name,
    primary
  );
  const firstName =
    listing.display_name.split(/\s+/)[0] ?? listing.display_name;
  const faqs = await loadFaqs(listing.id);

  const categoriesPresent: FaqCategory[] = CATEGORY_ORDER.filter((c) =>
    faqs.some((f) => f.category === c)
  );

  // Schema.org FAQPage — reuse the shared helper so the JSON shape stays
  // consistent across the contact-page accordion + this dedicated page.
  const faqLd = faqs.length === 0
    ? null
    : faqJsonLd(faqs.map((f) => ({ q: f.question, a: f.answer })));

  return (
    <main className="flex flex-1 flex-col pb-20 md:pb-0">
      <PremiumHero listing={listing} waUrl={waUrl} currentPage="profile" />

      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      )}

      <section className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-10">
        <a
          href={`/${slug}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-xs font-bold text-neutral-700 transition hover:border-[#FFB300] hover:text-[#FFB300] sm:text-sm"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to {firstName}&rsquo;s profile
        </a>

        <div className="mt-5">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "#FFB300" }}
          >
            FAQ &middot; curated by {firstName}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl md:text-4xl">
            {firstName}&rsquo;s{" "}
            <span style={{ color: "#FFB300" }}>FAQs.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-neutral-600 sm:text-sm">
            Tap any image to enlarge. Share a question with its ref code:
            FAQ-001.
          </p>
        </div>

        {categoriesPresent.length > 1 && (
          <div className="mt-5">
            <FaqPageClientChrome slug={slug} categories={categoriesPresent} />
          </div>
        )}
      </section>

      {faqs.length === 0 ? (
        <section className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6">
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
            <p className="text-sm text-neutral-600 sm:text-base">
              {firstName} hasn&rsquo;t added any FAQs yet.
            </p>
            <a
              href={`/${slug}`}
              className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-lg px-4 text-xs font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.98] sm:text-sm"
              style={{ background: "#FFB300" }}
            >
              Back to profile
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </a>
          </div>
        </section>
      ) : (
        <section className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6">
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {faqs.map((f) => (
              <li
                key={f.id}
                id={f.ref_code.toLowerCase()}
                data-faq-ref={f.ref_code}
                data-faq-category={f.category}
                className="scroll-mt-24 rounded-2xl border border-neutral-200 bg-white p-5 transition sm:p-6"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-900"
                    style={{ background: "#FFB300" }}
                  >
                    {f.ref_code}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-600">
                    {CATEGORY_LABEL[f.category]}
                  </span>
                </div>
                <h2 className="mt-3 text-base font-extrabold leading-tight text-neutral-900 sm:text-lg">
                  {f.question}
                </h2>
                <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-neutral-700 sm:text-sm">
                  {f.answer}
                </p>
                {f.images.length > 0 && (
                  <div className="mt-4">
                    <FaqImageLightbox images={f.images} refCode={f.ref_code} />
                  </div>
                )}
                <div className="mt-4 flex items-center justify-end">
                  <FaqShareButton
                    shareUrl={absolute(`/${slug}/faq#${f.ref_code.toLowerCase()}`)}
                    refCode={f.ref_code}
                    question={f.question}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6">
        <div
          className="overflow-hidden rounded-3xl px-6 py-8 text-center sm:px-12"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "#FFB300" }}
          >
            Are you a tradesperson with questions to answer?
          </p>
          <h2 className="mt-2 text-xl font-extrabold leading-tight text-white sm:text-2xl">
            Get your own Xrated profile and{" "}
            <span style={{ color: "#FFB300" }}>publish your FAQs.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[13px] leading-relaxed text-white/70 sm:text-sm">
            14-day free trial &mdash; no card. Turn the questions you answer
            on every job into a shareable knowledge base your customers
            can bookmark.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <a
              href={`/trade-off/signup?ref=${encodeURIComponent(slug)}`}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-xs font-extrabold uppercase tracking-wider text-neutral-900 shadow-lg transition active:scale-[0.98] sm:text-sm"
              style={{ background: "#FFB300" }}
            >
              Join XratedTrade
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </a>
            <a
              href="/trade-off/pricing"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-white/30 bg-white/5 px-5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10 sm:text-sm"
            >
              See pricing
            </a>
          </div>
        </div>
      </section>

      <div className="mt-auto">
        {!isPaid && <XratedHeader />}
        <XratedFooter />
      </div>
    </main>
  );
}
