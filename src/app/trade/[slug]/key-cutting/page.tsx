// Customer-facing /<slug>/key-cutting sub-page.
//
// Layout:
//   1. Trade profile header (same as every other sub-page)
//   2. Hero banner (merchant-uploaded image)
//   3. Trust bar — years cutting + machine brand + restricted brands
//   4. What we cut — grid of enabled categories with price + note
//   5. How to get a key cut — 3 tiles (walk-in / photo-scan / postal)
//   6. Postal details block (only when postal mode on)
//   7. Custom copy block
//   8. Sticky WhatsApp CTA on mobile

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { effectiveTier } from "@/lib/xratedTrades";
import { isKeyCuttingOn } from "@/lib/xratedAddons";
import { tradeLabel, whatsappDigits } from "@/lib/tradeOff";
import { TradeProfileHeader } from "@/components/xrated/TradeProfileHeader";
import { TradeProfileFooter } from "@/components/xrated/TradeProfileFooter";
import { PremiumHero } from "@/components/xrated/profile/PremiumHero";
import { PremiumStickyTrust } from "@/components/xrated/profile/PremiumStickyTrust";
import { adminWhatsapp } from "@/lib/whatsapp";

// Platform-level fallback illustration. Merchants edit their own
// image via the editor (illustration_image_url in KeyCuttingConfig);
// this URL only renders when they haven't set one.
const KEY_CUTTING_ILLUSTRATION_FALLBACK =
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2012_18_53%20PM.png?updatedAt=1782883156936";
import {
  KEY_CATEGORIES,
  formatPriceFrom,
  isCategoryCartEnabled,
  isKeyCuttingConfigured,
  normaliseKeyCuttingConfig
} from "@/lib/keyCutting";
import { KeyCuttingAddToCart } from "@/components/xrated/profile/KeyCuttingAddToCart";
import { KeyCuttingPhotoScan } from "@/components/xrated/profile/KeyCuttingPhotoScan";

export const revalidate = 60;

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Key Cutting — ${slug}`,
    alternates: { canonical: `/${slug}/key-cutting` }
  };
}

export default async function KeyCuttingPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listingRes = await supabase
    .from("hammerex_trade_off_listings")
    .select("*")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  if (!listingRes.data) notFound();
  const listing = listingRes.data;

  const tier = effectiveTier(listing);
  const isPaid = tier === "app_trial" || tier === "app_paid" || tier === "app_verified";
  if (!isPaid || !isKeyCuttingOn(listing)) redirect(`/${slug}`);

  const cfg = normaliseKeyCuttingConfig(listing.key_cutting);
  if (!isKeyCuttingConfigured(cfg)) redirect(`/${slug}`);

  const enabledCategories = KEY_CATEGORIES
    .map((meta) => ({ meta, c: cfg.categories[meta.slug] }))
    .filter((row) => row.c?.enabled);

  // Related products cross-sell — merchant picks which categories drive
  // it (falls back to sensible platform defaults when they haven't).
  const relatedCategories =
    cfg.related_product_categories.length > 0
      ? cfg.related_product_categories
      : ["padlocks", "nuts_bolts_screws", "hand_tools"];
  const relatedRes = await supabase
    .from("hammerex_xrated_products")
    .select("id, slug, name, price_pence, cover_url, merchant_category")
    .eq("listing_id", listing.id)
    .eq("status", "live")
    .in("merchant_category", relatedCategories)
    .limit(8);
  const relatedProducts = (relatedRes.data ?? []) as {
    id: string;
    slug: string | null;
    name: string;
    price_pence: number;
    cover_url: string | null;
    merchant_category: string | null;
  }[];

  const wa = whatsappDigits(listing.whatsapp ?? "");
  const primary = tradeLabel(listing.primary_trade);
  const merchantName = listing.display_name ?? slug;

  const enquireOnWa = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(
        `Hi ${merchantName}, I'd like to get a key cut. What I have: [describe / attach photo of both edges of the key].`
      )}`
    : "#";

  // Same waUrl the home page uses so PremiumHero renders identically.
  const waFallback = adminWhatsapp();
  const waFinal = wa || waFallback;
  const waUrl = waFinal
    ? `https://wa.me/${waFinal}?text=${encodeURIComponent(`Hi ${merchantName}, I'd like to enquire about key cutting.`)}`
    : "#";

  const heroTier = tier === "app_paid" || tier === "app_verified" ? "paid" : tier === "app_trial" ? "paid" : "free";

  // Resolved copy — merchant override wins, platform default falls back.
  const H1 = cfg.headline_text || "Unlock Quality With Each Turn";
  const headings = {
    trust_benefits: cfg.section_headings.trust_benefits || "Why customers choose our key cutting",
    brands: cfg.section_headings.brands || "Brands we work with",
    what_we_cut: cfg.section_headings.what_we_cut || "What we cut",
    how_to_get: cfg.section_headings.how_to_get || "How to get a key cut",
    bulk: cfg.section_headings.bulk || "Bulk key duplication",
    trade_customers: cfg.section_headings.trade_customers || "Trade & commercial customers we serve",
    related_products: cfg.section_headings.related_products || "While you're here",
    faq: cfg.section_headings.faq || "Frequently asked questions"
  };
  const defaultExplanatoryParagraphs = [
    "Services below are ordered from the everyday walk-in cuts to the specialist appointments. Standard cylinder, mortice and padlock keys are typically ready in 2-5 minutes over the counter. Dimple and laser keys need a dedicated machine and a few extra minutes. Restricted / high-security keys (Mul-T-Lock, EVVA, ASSA Abloy) can only be cut with the customer's authorisation card or a signed dealer letter — bring it with you.",
    "Car keys split into three tiers. Mechanical keys (typically pre-1998 cars) are a straight cut, same day. Transponder / chip keys need to be paired to the car's immobiliser — bring the vehicle and your V5C logbook. Remote / laser keys (BMW, Audi, VAG group) need an appointment booked 24-48 hours in advance because the blank usually has to be ordered in.",
    "Not sure what type of key you have? WhatsApp a photo and we'll identify it + tell you the exact price before you come in."
  ];
  const explanatoryParagraphs =
    cfg.explanatory_paragraphs.length > 0
      ? cfg.explanatory_paragraphs
      : defaultExplanatoryParagraphs;
  const modeBodies = {
    walk_in:
      cfg.mode_bodies.walk_in ||
      `Come to ${merchantName} during counter hours. Bring the key you want copied. Most cuts done in 2-5 minutes.`,
    photo_scan:
      cfg.mode_bodies.photo_scan ||
      "WhatsApp a clear photo of BOTH edges of the key (a coin next to it for scale). We confirm we can cut it, book you in and text you when it's ready.",
    postal:
      cfg.mode_bodies.postal ||
      (cfg.postal_turnaround_hours
        ? `Post the key in a padded envelope with a prepaid return envelope. Cut and returned within ${cfg.postal_turnaround_hours} hours.`
        : "Post the key in a padded envelope with a prepaid return envelope. Cut and returned within 48 hours.")
  };

  // JSON-LD — Service schema + FAQPage schema for SEO. Emitted server-
  // side so Google reads it on first crawl. FAQ schema drives rich
  // snippets in search; Service schema helps local ranking.
  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${H1} — Key Cutting`,
    serviceType: "Key Cutting",
    provider: {
      "@type": "LocalBusiness",
      name: merchantName,
      address: cfg.postal_address ? { "@type": "PostalAddress", streetAddress: cfg.postal_address } : undefined,
      telephone: listing.whatsapp ?? undefined
    },
    areaServed: cfg.postal_address ? "United Kingdom" : undefined,
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Key Cutting Services",
      itemListElement: enabledCategories.map(({ meta, c }) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: meta.label, description: meta.short_desc },
        priceSpecification: c?.price_from_pence
          ? {
              "@type": "PriceSpecification",
              price: (c.price_from_pence / 100).toFixed(2),
              priceCurrency: "GBP"
            }
          : undefined
      }))
    }
  };
  const faqLd = cfg.faq.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: cfg.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a }
        }))
      }
    : null;

  return (
    <main className="flex flex-1 flex-col bg-white pb-24">
      <TradeProfileHeader
        listing={listing}
        appName={`${primary} Service`}
        backHref={`/${slug}`}
      />

      {/* Home-page hero re-used on this sub-page so branding + container
       *  stay identical across the whole profile. Sub-pages that need a
       *  page-specific banner render it further down as content, never
       *  as a replacement hero. */}
      <PremiumHero
        listing={listing}
        waUrl={waUrl}
        currentPage="contact"
        tier={heroTier}
      />

      {/* JSON-LD — Service + FAQPage schemas for SEO rich snippets. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceLd) }}
      />
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      )}

      {/* Promotional banner — flash offers, seasonal promos. */}
      {cfg.promo_banner.enabled && cfg.promo_banner.text.trim().length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
            style={{ background: "#FFB300", color: "#0A0A0A" }}
          >
            <p className="text-[13px] font-extrabold sm:text-[14px]">
              {cfg.promo_banner.text}
            </p>
            {cfg.promo_banner.cta_label && cfg.promo_banner.cta_href && (
              <a
                href={cfg.promo_banner.cta_href}
                target={cfg.promo_banner.cta_href.startsWith("http") ? "_blank" : undefined}
                rel={cfg.promo_banner.cta_href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="inline-flex h-9 items-center rounded-lg bg-neutral-900 px-3 text-[11px] font-extrabold uppercase tracking-widest text-white transition hover:opacity-90"
              >
                {cfg.promo_banner.cta_label} →
              </a>
            )}
          </div>
        </section>
      )}

      {/* Page-specific title row — TEXT LEFT, ILLUSTRATION RIGHT.
       *  Kicker + H1 + custom copy on the left, merchant-supplied
       *  service illustration on the right. Stacks vertically on
       *  mobile. Standard container width so it aligns with the rest of
       *  the page below the shared hero. */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
              Key Cutting
            </p>
            <h1 className="mt-1 text-3xl font-extrabold text-neutral-900 sm:text-4xl">
              {H1}
            </h1>
            {cfg.custom_note && (
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-neutral-600">{cfg.custom_note}</p>
            )}
          </div>
          <div className="order-first flex justify-center sm:order-last">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cfg.illustration_image_url || KEY_CUTTING_ILLUSTRATION_FALLBACK}
              alt=""
              aria-hidden="true"
              className="h-32 w-auto object-contain sm:h-40 md:h-48"
            />
          </div>
        </div>
      </section>

      {/* Trust bar. */}
      {(cfg.years_cutting ||
        cfg.machine_brand ||
        cfg.turnaround_text ||
        cfg.restricted_brands.length > 0) && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
          <ul className="flex flex-wrap items-center gap-2">
            {cfg.years_cutting && (
              <TrustPill label={`${cfg.years_cutting}+ years cutting`} />
            )}
            {cfg.machine_brand && (
              <TrustPill label={`${cfg.machine_brand} machine`} />
            )}
            {cfg.turnaround_text && (
              <TrustPill label={cfg.turnaround_text} />
            )}
            {cfg.restricted_brands.length > 0 && (
              <TrustPill
                label={`Authorised key brands: ${cfg.restricted_brands.join(", ")}`}
                accent
              />
            )}
          </ul>
        </section>
      )}

      {/* Trust & Benefits — 8-item checkmark strip. */}
      {cfg.trust_benefits.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
          <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
            {headings.trust_benefits}
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {cfg.trust_benefits.map((b) => (
              <li
                key={b}
                className="flex items-start gap-2 rounded-xl border border-neutral-200 bg-white p-3"
              >
                <span
                  aria-hidden="true"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px] font-extrabold text-black"
                  style={{ background: "#FFB300" }}
                >
                  ✓
                </span>
                <span className="text-[12px] font-bold text-neutral-800">{b}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Key brands supported. */}
      {cfg.key_brands.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
          <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
            {headings.brands}
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] text-neutral-600">
            Blanks stocked or on next-day order for the UK&rsquo;s most common
            house, commercial and vehicle lock brands.
          </p>
          <ul className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-4">
            {cfg.key_brands.map((b) => (
              <li key={b.name} className="flex items-center">
                {b.logo_url ? (
                  /* No container — each logo renders at its own natural
                   *  aspect ratio, bounded only by a uniform display
                   *  height. Yale ships in a compact wordmark, so we
                   *  give it a 10% height boost so it doesn't visually
                   *  disappear next to wider logos. */
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={sharpenLogoUrl(b.logo_url)}
                    alt={b.name}
                    title={b.name}
                    loading="lazy"
                    className={
                      b.name.toLowerCase() === "yale"
                        ? "h-8 w-auto object-contain sm:h-9"
                        : "h-7 w-auto object-contain sm:h-8"
                    }
                  />
                ) : (
                  <span className="text-[13px] font-bold text-neutral-700">
                    {b.name}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* What we cut. */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">{headings.what_we_cut}</h2>
        <div className="mt-2 max-w-3xl space-y-3 text-[13px] leading-relaxed text-neutral-600">
          {explanatoryParagraphs.map((paragraph, i) => (
            <p key={i} className="whitespace-pre-line">{paragraph}</p>
          ))}
        </div>
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {enabledCategories.map(({ meta, c }) => (
            <li
              key={meta.slug}
              className="flex h-full flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                {c?.image_url ? (
                  /* No gray background box — image sits directly on the
                   *  tile. Uniform h-20 sm:h-24 across every category,
                   *  with per-category height boosts where the key
                   *  illustration reads too small at the standard size. */
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={c.image_url}
                    alt=""
                    aria-hidden="true"
                    className={
                      meta.slug === "padlock"
                        ? "h-[104px] w-auto shrink-0 object-contain sm:h-[125px]"
                        : "h-20 w-auto shrink-0 object-contain sm:h-24"
                    }
                  />
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-neutral-100 text-[22px]">
                    {meta.emoji}
                  </span>
                )}
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-black"
                  style={{ background: "#FFB300" }}
                >
                  {formatPriceFrom(c?.price_from_pence)}
                </span>
              </div>
              <p className="text-[14px] font-extrabold text-neutral-900">{meta.label}</p>
              <p className="text-[12px] text-neutral-600">{meta.short_desc}</p>
              {c?.sub_types && c.sub_types.length > 0 && (
                <ul className="mt-1 flex flex-wrap gap-1">
                  {c.sub_types.map((s) => (
                    <li
                      key={s}
                      className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-700"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              )}
              {c?.note && (
                <p className="mt-1 rounded-md bg-neutral-50 px-2 py-1 text-[11px] font-bold text-neutral-700">
                  {c.note}
                </p>
              )}
              {/* Prepay via cart — merchant enables per category. Verify-
               *  in-person categories (restricted / car transponder /
               *  car remote) default off; standard ones default on. */}
              {isCategoryCartEnabled(c, meta) && (c?.price_from_pence ?? 0) > 0 && (
                <KeyCuttingAddToCart
                  slug={slug}
                  categorySlug={meta.slug}
                  categoryLabel={meta.label}
                  pricePence={c!.price_from_pence!}
                />
              )}
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-3xl text-[12px] leading-relaxed text-neutral-500">
          Not sure what to buy? WhatsApp us with a photo of your key first —
          we&rsquo;ll tell you the exact type, size and price, then you can add it to cart or come pick it up.
        </p>
      </section>

      {/* How to get a key cut. */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          {headings.how_to_get}
        </h2>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {cfg.modes.walk_in && (
            <ModeTile
              n={1}
              title="Walk in"
              body={modeBodies.walk_in}
              cta={{ label: "Get directions", href: `/${slug}/contact` }}
            />
          )}
          {cfg.modes.photo_scan && (
            <ModeTile
              n={cfg.modes.walk_in ? 2 : 1}
              title="Send us a photo"
              body={modeBodies.photo_scan}
            >
              <KeyCuttingPhotoScan
                merchantName={merchantName}
                waHref={wa ? `https://wa.me/${wa}` : null}
              />
            </ModeTile>
          )}
          {cfg.modes.postal && (
            <ModeTile
              n={(cfg.modes.walk_in ? 1 : 0) + (cfg.modes.photo_scan ? 1 : 0) + 1}
              title="Post it to us"
              body={modeBodies.postal}
              cta={
                cfg.postal_address
                  ? { label: "See address", href: "#postal-address" }
                  : undefined
              }
            />
          )}
        </ul>
      </section>

      {/* Postal details. */}
      {cfg.modes.postal && cfg.postal_address && (
        <section
          id="postal-address"
          className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6"
        >
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#FFB300]">
              Postal address
            </p>
            <p className="mt-2 whitespace-pre-line font-mono text-[14px] text-neutral-900">
              {cfg.postal_address}
            </p>
            <p className="mt-3 text-[12px] text-neutral-600">
              Include a prepaid Royal Mail return envelope + copy of ID (for restricted keys) +
              a note with your name and mobile number. Track the return with Royal Mail
              Signed-For 1st Class for peace of mind.
            </p>
            <a
              href={`/${slug}/key-cutting/postal-form`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex h-10 items-center rounded-lg border-2 border-neutral-900 px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:bg-neutral-900 hover:text-white"
            >
              Print order form ↗
            </a>
          </div>
        </section>
      )}

      {/* Bulk key duplication tiers. */}
      {cfg.bulk_tiers.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
          <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
            {headings.bulk}
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] text-neutral-600">
            Trade discount on multi-key orders. Landlords, letting agents,
            schools, site managers — we cut hundreds of keys a week at trade
            prices with same-day turnaround for standard blanks.
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {cfg.bulk_tiers.map((t) => (
              <li
                key={t.min_qty}
                className="rounded-2xl border border-neutral-200 bg-white p-4 text-center"
              >
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                  {t.min_qty}+ keys
                </p>
                <p
                  className="mt-1 text-[14px] font-extrabold"
                  style={{ color: "#0A0A0A" }}
                >
                  {t.label}
                </p>
              </li>
            ))}
          </ul>
          {wa && (
            <a
              href={`https://wa.me/${wa}?text=${encodeURIComponent(
                `Hi ${merchantName}, I'd like a bulk key cutting quote. Details: [quantity, key type, timeline].`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex h-11 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90"
              style={{ background: "#FFB300" }}
            >
              Request bulk quote
            </a>
          )}
        </section>
      )}

      {/* Trade customers we serve. */}
      {cfg.trade_customers.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
          <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
            {headings.trade_customers}
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] text-neutral-600">
            Trade accounts welcome. Same-day cutting, bulk pricing, monthly
            invoicing.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {cfg.trade_customers.map((c) => (
              <li
                key={c}
                className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-bold text-neutral-800"
              >
                {c}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Related products cross-sell — pulled from the merchant's shop. */}
      {relatedProducts.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
          <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
            {headings.related_products}
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] text-neutral-600">
            Padlocks, key rings, key safes and small hardware — pick up while
            you wait for your key.
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {relatedProducts.map((p) => (
              <li key={p.id}>
                <a
                  href={`/${slug}/shop/${p.slug ?? p.id}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:border-[#FFB300]"
                >
                  <span
                    className="relative block w-full overflow-hidden bg-neutral-100"
                    style={{ aspectRatio: "1 / 1" }}
                    aria-hidden="true"
                  >
                    {p.cover_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={p.cover_url}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : null}
                  </span>
                  <div className="flex flex-col gap-2 p-3">
                    <p className="line-clamp-2 text-[12px] font-extrabold text-neutral-900">
                      {p.name}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-2">
                      <p className="text-[13px] font-bold text-neutral-900">
                        £{(p.price_pence / 100).toFixed(2)}
                      </p>
                      <span
                        className="inline-flex h-7 items-center rounded-md px-2 text-[10px] font-extrabold uppercase tracking-widest text-black transition group-hover:opacity-90"
                        style={{ background: "#FFB300" }}
                      >
                        View →
                      </span>
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* FAQ. */}
      {cfg.faq.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
          <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
            {headings.faq}
          </h2>
          <ul className="mt-4 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
            {cfg.faq.map((f, i) => (
              <li key={i}>
                <details className="group">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-[13px] font-extrabold text-neutral-900">
                    {f.q}
                    <span
                      aria-hidden="true"
                      className="text-[16px] font-extrabold text-[#FFB300] transition group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <div className="px-4 pb-4 text-[13px] leading-relaxed text-neutral-700">
                    {f.a}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-auto pt-12">
        <TradeProfileFooter listing={listing} appName={`${primary} Service`} />
      </div>

      {/* Same premium sticky footer as the home page: star rating on the
       *  left, small WhatsApp button on the right. Spacer above so
       *  content never gets clipped under the bar. */}
      <div aria-hidden="true" className="h-[72px]" />
      <PremiumStickyTrust
        ratingAvg={listing.rating_avg}
        ratingCount={listing.rating_count}
        whatsappHref={enquireOnWa}
      />
    </main>
  );
}

// ImageKit URL sharpener — serves brand logos at 2× the display
// height (~64px display → 128px raw). Height-only transform preserves
// each brand's natural aspect ratio server-side. Non-ImageKit URLs
// pass through unchanged.
function sharpenLogoUrl(url: string): string {
  if (!url.includes("ik.imagekit.io/")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}tr=h-72,q-95`;
}

function TrustPill({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <li
      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest"
      style={{
        background: accent ? "#FFB300" : "#F5F5F5",
        color: accent ? "#0A0A0A" : "#404040"
      }}
    >
      {label}
    </li>
  );
}

function ModeTile({
  n,
  title,
  body,
  cta,
  children
}: {
  n: number;
  title: string;
  body: string;
  cta?: { label: string; href: string; external?: boolean };
  children?: React.ReactNode;
}) {
  return (
    <li className="flex h-full flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4">
      <span
        className="grid h-9 w-9 place-items-center rounded-full text-[14px] font-extrabold text-black"
        style={{ background: "#FFB300" }}
      >
        {n}
      </span>
      <p className="text-[14px] font-extrabold text-neutral-900">{title}</p>
      <p className="flex-1 text-[12px] text-neutral-600">{body}</p>
      {cta && (
        <a
          href={cta.href}
          target={cta.external ? "_blank" : undefined}
          rel={cta.external ? "noopener noreferrer" : undefined}
          className="mt-2 inline-flex h-10 items-center justify-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90 active:scale-[0.98]"
          style={{ background: "#FFB300" }}
        >
          {cta.label}
        </a>
      )}
      {children}
    </li>
  );
}
