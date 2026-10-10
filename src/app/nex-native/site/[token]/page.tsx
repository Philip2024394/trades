// src/app/nex-native/site/[token]/page.tsx
// Wave D Slice 16b/c/d · Public 1-page site rendered from generated params.
//
// Doctrine:
//   · Real content only · products/hours/banners come from live nex_* rows
//   · "Message us" CTA routes to /nex-native/<slug> · that page owns the
//     real chat entry (products list + conversation)
//   · No fabrication · if the merchant has 0 products we don't invent any
//   · Draft sites (published_at IS NULL) render but with a visible
//     "PREVIEW · not yet published" banner (honest)
//
// Slice 16d refactor: sections are iterated in the order stored in
// params.sections. Every section is a small pure function of the fetched
// data + accent + template classes.

import Link from "next/link";
import { notFound } from "next/navigation";
import * as siteService from "@/lib/nex-native/site-service";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import * as bannerService from "@/lib/nex-native/banner-service";
import type { NexSiteSection } from "@/lib/nex-native/site-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCENT: Record<string, {
  headerBg: string; heroText: string; ctaBg: string; ctaHoverBg: string;
  cardBorder: string; sectionAccent: string; footerBg: string; softBand: string;
}> = {
  sage:   { headerBg: "bg-emerald-50",  heroText: "text-emerald-950", ctaBg: "bg-emerald-800", ctaHoverBg: "hover:bg-emerald-900", cardBorder: "border-emerald-200", sectionAccent: "text-emerald-700", footerBg: "bg-emerald-900", softBand: "bg-emerald-100" },
  amber:  { headerBg: "bg-amber-50",    heroText: "text-amber-950",   ctaBg: "bg-amber-800",   ctaHoverBg: "hover:bg-amber-900",   cardBorder: "border-amber-200",   sectionAccent: "text-amber-700",   footerBg: "bg-amber-900", softBand: "bg-amber-100" },
  slate:  { headerBg: "bg-slate-50",    heroText: "text-slate-900",   ctaBg: "bg-slate-900",   ctaHoverBg: "hover:bg-slate-800",   cardBorder: "border-slate-200",   sectionAccent: "text-slate-700",   footerBg: "bg-slate-900", softBand: "bg-slate-100" },
  rose:   { headerBg: "bg-rose-50",     heroText: "text-rose-950",    ctaBg: "bg-rose-800",    ctaHoverBg: "hover:bg-rose-900",    cardBorder: "border-rose-200",    sectionAccent: "text-rose-700",    footerBg: "bg-rose-900", softBand: "bg-rose-100" },
  indigo: { headerBg: "bg-indigo-50",   heroText: "text-indigo-950",  ctaBg: "bg-indigo-800",  ctaHoverBg: "hover:bg-indigo-900",  cardBorder: "border-indigo-200",  sectionAccent: "text-indigo-700",  footerBg: "bg-indigo-900", softBand: "bg-indigo-100" },
  black:  { headerBg: "bg-neutral-50",  heroText: "text-neutral-950", ctaBg: "bg-black",       ctaHoverBg: "hover:bg-neutral-800", cardBorder: "border-neutral-200", sectionAccent: "text-neutral-700", footerBg: "bg-black", softBand: "bg-neutral-100" },
};

const TEMPLATE: Record<string, {
  heroPadding: string; headlineFont: string; headlineSize: string;
  cardRadius: string; ctaShape: string; heroBgOverride: string | null;
  productsGridClass: string; footerAccent: boolean;
}> = {
  "modern-minimal": {
    heroPadding: "py-16 sm:py-24",
    headlineFont: "font-semibold tracking-tight",
    headlineSize: "text-4xl sm:text-5xl",
    cardRadius: "rounded-2xl",
    ctaShape: "rounded-full",
    heroBgOverride: null,
    productsGridClass: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
    footerAccent: true,
  },
  "warm-artisan": {
    heroPadding: "py-20 sm:py-32",
    headlineFont: "font-serif font-normal tracking-wide",
    headlineSize: "text-5xl sm:text-6xl",
    cardRadius: "rounded-3xl",
    ctaShape: "rounded-md",
    heroBgOverride: "bg-orange-50/60",
    productsGridClass: "grid gap-6 sm:grid-cols-2",
    footerAccent: false,
  },
};

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABEL: Record<typeof DAY_ORDER[number], string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const site = await siteService.getSiteByToken(token);
  if (!site) notFound();
  const business = await businessService.getBusinessById(site.business_id);
  if (!business) notFound();

  const sections = siteService.effectiveSections(site.params);

  const [products, banners] = await Promise.all([
    sections.includes("products") || sections.includes("gallery")
      ? productService.listProductsByBusiness(business.id, "live")
      : Promise.resolve([]),
    sections.includes("banners")
      ? bannerService.listBannersByBusiness(business.id, "live")
      : Promise.resolve([]),
  ]);

  const accent = ACCENT[site.params.accent] ?? ACCENT.slate;
  const tpl = TEMPLATE[site.template_name] ?? TEMPLATE["modern-minimal"];

  const chatHref = `/nex-native/${business.slug}`;
  const productsHref = `/nex-native/${business.slug}`;

  // Gallery aggregates product gallery_urls + primary image_url
  const galleryImages = products.flatMap((p) => {
    const arr: Array<{ url: string; name: string }> = [];
    if (p.image_url) arr.push({ url: p.image_url, name: p.name });
    if (p.gallery_urls) {
      for (const u of p.gallery_urls) arr.push({ url: u, name: p.name });
    }
    return arr;
  }).slice(0, 12);

  return (
    <main className={`min-h-screen ${accent.headerBg}`}>
      {!site.published_at && (
        <div className="bg-amber-200 px-4 py-2 text-center text-xs font-medium text-amber-900">
          Preview · not yet published
        </div>
      )}

      {sections.map((sec) => renderSection(sec, {
        site, business, products, banners, galleryImages, accent, tpl, chatHref, productsHref,
      }))}

      {/* FOOTER · always rendered */}
      <footer className={`px-4 py-8 text-center text-sm ${
        tpl.footerAccent ? `${accent.footerBg} text-white/80` : "bg-orange-100 text-neutral-700"
      }`}>
        <div className="mx-auto max-w-3xl">
          <div className={`mb-2 text-base font-medium ${tpl.footerAccent ? "text-white" : "text-neutral-900"}`}>
            {business.display_name}
          </div>
          <div className="text-xs opacity-70">
            Built with NEX ·{" "}
            <Link href={chatHref} className="underline hover:opacity-100">
              open the chat
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

type SectionCtx = {
  site: Awaited<ReturnType<typeof siteService.getSiteByToken>>;
  business: Awaited<ReturnType<typeof businessService.getBusinessById>>;
  products: Awaited<ReturnType<typeof productService.listProductsByBusiness>>;
  banners: Awaited<ReturnType<typeof bannerService.listBannersByBusiness>>;
  galleryImages: Array<{ url: string; name: string }>;
  accent: (typeof ACCENT)[string];
  tpl: (typeof TEMPLATE)[string];
  chatHref: string;
  productsHref: string;
};

function renderSection(sec: NexSiteSection, ctx: SectionCtx) {
  const { site, business, products, banners, galleryImages, accent, tpl, chatHref, productsHref } = ctx;
  if (!site || !business) return null;

  switch (sec) {
    case "hero":
      return (
        <section key="hero" className={`px-4 ${tpl.heroPadding} ${accent.heroText} ${tpl.heroBgOverride ?? ""}`}>
          <div className="mx-auto max-w-3xl text-center">
            {business.logo_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={business.logo_url} alt={`${business.display_name} logo`}
                className="mx-auto mb-8 h-16 w-16 rounded-full border border-white/40 bg-white object-contain shadow-sm" />
            )}
            <h1 className={`${site.params.hero_headline ? "" : ""} ${tpl.headlineSize} ${tpl.headlineFont}`}>
              {site.params.hero_headline}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg opacity-80 sm:text-xl">
              {site.params.hero_subline}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={chatHref}
                className={`${accent.ctaBg} ${accent.ctaHoverBg} inline-flex items-center gap-2 ${tpl.ctaShape} px-6 py-3 text-base font-medium text-white shadow-md transition-colors`}
              >
                {site.params.cta_label} →
              </Link>
              {business.public_phone && (
                <a href={`tel:${business.public_phone}`}
                  className="inline-flex items-center gap-2 rounded-full border border-current/20 bg-white/50 px-6 py-3 text-base font-medium backdrop-blur-sm hover:bg-white/70">
                  {business.public_phone}
                </a>
              )}
            </div>
            {business.status_message && (
              <p className={`mt-6 inline-block rounded-full border border-current/20 bg-white/40 px-4 py-1 text-sm ${accent.sectionAccent}`}>
                {business.status_message}
              </p>
            )}
          </div>
        </section>
      );

    case "banners":
      if (banners.length === 0) return null;
      return (
        <section key="banners" className="bg-white px-4 py-8">
          <div className="mx-auto max-w-3xl grid gap-3 sm:grid-cols-2">
            {banners.map((b) => (
              <div key={b.id} className={`${tpl.cardRadius} border ${accent.cardBorder} p-6 text-center shadow-sm`}>
                <div className="text-lg font-semibold text-neutral-900">{b.headline}</div>
                {b.subline && <div className="mt-1 text-sm text-neutral-600">{b.subline}</div>}
              </div>
            ))}
          </div>
        </section>
      );

    case "features": {
      // Auto-derive 3 features from business.description + first three tags across products
      const bits = (business.description ?? "").split(/[.·•]|(?:\r?\n)/).map((s) => s.trim()).filter(Boolean);
      const tagPool = Array.from(new Set(products.flatMap((p) => p.tags ?? [])));
      const featureCards: Array<{ heading: string; body: string }> = [];
      if (bits.length >= 3) {
        for (let i = 0; i < 3; i++) featureCards.push({ heading: `0${i + 1}`, body: bits[i]! });
      } else if (tagPool.length >= 3) {
        for (const t of tagPool.slice(0, 3)) featureCards.push({ heading: t, body: `${products.filter((p) => p.tags?.includes(t)).length} products in this category.` });
      } else if (bits.length > 0) {
        featureCards.push({ heading: "About us", body: bits.join(" · ") });
      } else {
        // Skip if nothing to say
        return null;
      }
      return (
        <section key="features" className="bg-white px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-4xl">
            <h2 className={`mb-8 text-center text-2xl font-semibold tracking-tight ${accent.sectionAccent}`}>
              Why {business.display_name}
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {featureCards.map((f, i) => (
                <div key={i} className={`${tpl.cardRadius} border ${accent.cardBorder} bg-white p-5 text-left shadow-sm`}>
                  <div className={`mb-2 text-xs font-semibold uppercase tracking-wider ${accent.sectionAccent}`}>
                    {f.heading}
                  </div>
                  <p className="text-sm text-neutral-700">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case "products":
      if (products.length === 0) return null;
      return (
        <section key="products" className="bg-white px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-4xl">
            <div className="mb-6 flex items-baseline justify-between">
              <h2 className={`text-2xl font-semibold tracking-tight ${accent.sectionAccent}`}>What we offer</h2>
              <Link href={productsHref}
                className="text-sm font-medium underline underline-offset-4 hover:no-underline">
                View all + message →
              </Link>
            </div>
            <ul className={tpl.productsGridClass}>
              {products.slice(0, 6).map((p) => (
                <li key={p.id} className={`overflow-hidden ${tpl.cardRadius} border ${accent.cardBorder} bg-white shadow-sm transition-shadow hover:shadow-md`}>
                  {p.image_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.image_url} alt={p.name} className="h-40 w-full object-cover" />
                  )}
                  <div className="p-4">
                    <div className="mb-1 text-base font-medium text-neutral-900">{p.name}</div>
                    <div className="text-sm text-neutral-600">
                      {p.currency} {(p.price_pence / 100).toFixed(2)}
                      {p.stock_status && (
                        <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700">
                          {p.stock_status.replace("_", " ")}
                        </span>
                      )}
                    </div>
                    {p.description && (
                      <p className="mt-2 line-clamp-3 text-sm text-neutral-600">{p.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-8 text-center">
              <Link href={productsHref}
                className={`${accent.ctaBg} ${accent.ctaHoverBg} inline-flex items-center gap-2 ${tpl.ctaShape} px-6 py-3 text-base font-medium text-white shadow-md transition-colors`}>
                See all products + message →
              </Link>
            </div>
          </div>
        </section>
      );

    case "gallery":
      if (galleryImages.length === 0) return null;
      return (
        <section key="gallery" className="bg-neutral-50 px-4 py-12">
          <div className="mx-auto max-w-5xl">
            <h2 className={`mb-6 text-center text-2xl font-semibold tracking-tight ${accent.sectionAccent}`}>Gallery</h2>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {galleryImages.map((g, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={i} src={g.url} alt={g.name}
                  className={`aspect-square w-full object-cover ${tpl.cardRadius} border ${accent.cardBorder} shadow-sm`} />
              ))}
            </div>
          </div>
        </section>
      );

    case "cta_band":
      return (
        <section key="cta_band" className={`${accent.softBand} px-4 py-14`}>
          <div className="mx-auto max-w-3xl text-center">
            <p className={`text-2xl font-semibold ${accent.sectionAccent} sm:text-3xl`}>
              Ready to chat about your project?
            </p>
            <p className="mt-2 text-sm text-neutral-700">
              Every conversation starts inside NEX · secure, on-record, and instant.
            </p>
            <Link
              href={chatHref}
              className={`${accent.ctaBg} ${accent.ctaHoverBg} mt-6 inline-flex items-center gap-2 ${tpl.ctaShape} px-8 py-3 text-base font-medium text-white shadow-md transition-colors`}
            >
              {site.params.cta_label} →
            </Link>
          </div>
        </section>
      );

    case "pricing": {
      if (products.length === 0) return null;
      // Sort by ascending price · take up to 3 as "from £X" entries
      const cheapest = [...products].sort((a, b) => a.price_pence - b.price_pence).slice(0, 3);
      const currency = cheapest[0]!.currency;
      return (
        <section key="pricing" className="bg-white px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-4xl">
            <h2 className={`mb-8 text-center text-2xl font-semibold tracking-tight ${accent.sectionAccent}`}>
              Simple, honest pricing
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {cheapest.map((p) => (
                <div key={p.id} className={`${tpl.cardRadius} border ${accent.cardBorder} p-6 text-center shadow-sm`}>
                  <div className="text-xs uppercase tracking-wider text-neutral-500">from</div>
                  <div className={`mt-1 text-3xl font-semibold ${accent.sectionAccent}`}>
                    {p.currency} {(p.price_pence / 100).toFixed(2)}
                  </div>
                  <div className="mt-2 text-sm text-neutral-700">{p.name}</div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-neutral-500">
              Prices reflect current live rates in {currency} · message us for a tailored quote.
            </p>
            <div className="mt-6 text-center">
              <Link href={productsHref}
                className={`${accent.ctaBg} ${accent.ctaHoverBg} inline-flex items-center gap-2 ${tpl.ctaShape} px-6 py-3 text-sm font-medium text-white shadow-md`}>
                See full price list on NEX →
              </Link>
            </div>
          </div>
        </section>
      );
    }

    case "testimonials": {
      // No fabricated reviews · until a real review system lands (future slice)
      // this section renders an HONEST placeholder card so merchants know it
      // is present without misleading buyers with fake quotes.
      return (
        <section key="testimonials" className="bg-neutral-50 px-4 py-12">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className={`mb-4 text-2xl font-semibold tracking-tight ${accent.sectionAccent}`}>
              What our customers say
            </h2>
            <div className={`${tpl.cardRadius} border-2 border-dashed ${accent.cardBorder} bg-white p-8`}>
              <p className="text-sm text-neutral-600">
                No reviews here yet · be the first to send a message and start a project.
                Real reviews from real conversations will appear once we launch the review system.
              </p>
              <Link href={chatHref}
                className={`${accent.ctaBg} ${accent.ctaHoverBg} mt-4 inline-flex items-center gap-2 ${tpl.ctaShape} px-6 py-2 text-sm font-medium text-white`}>
                Message us first →
              </Link>
            </div>
          </div>
        </section>
      );
    }

    case "faq": {
      // Auto-derive Q&A from real business data · never invent answers.
      type FaqRow = { q: string; a: string };
      const faqs: FaqRow[] = [];
      if (business.hours) {
        const openDays = DAY_ORDER.filter((d) =>
          (business.hours as Record<string, { open: string; close: string } | null>)[d] !== null);
        if (openDays.length > 0) {
          faqs.push({
            q: "When are you open?",
            a: `We are open ${openDays.map((d) => DAY_LABEL[d]).join(", ")}. Full weekly hours are shown further down this page.`,
          });
        }
      }
      if (business.accepts_cod) {
        faqs.push({
          q: "Do you accept cash on delivery?",
          a: "Yes · we accept cash on delivery. Message us to confirm eligibility for your postcode before we dispatch.",
        });
      }
      if (business.accepts_pickup) {
        faqs.push({
          q: "Can I collect in person?",
          a: `Yes · in-person collection is available${business.address ? ` from ${business.address.split("\n")[0]}` : ""}. Please message first to arrange a time.`,
        });
      }
      if (business.payment_instructions) {
        faqs.push({
          q: "How do I pay?",
          a: "We share payment details directly after you confirm your order in NEX chat · no online processor in the middle. Full details land in your conversation.",
        });
      }
      faqs.push({
        q: "How do I get in touch?",
        a: `Every project starts inside a NEX conversation. Tap "${site.params.cta_label}" above and we usually reply within a few working hours.`,
      });
      if (faqs.length === 0) return null;
      return (
        <section key="faq" className="bg-white px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className={`mb-6 text-center text-2xl font-semibold tracking-tight ${accent.sectionAccent}`}>
              Common questions
            </h2>
            <div className="space-y-3">
              {faqs.map((f, i) => (
                <details key={i} className={`${tpl.cardRadius} border ${accent.cardBorder} bg-white p-4`}>
                  <summary className="cursor-pointer text-base font-medium text-neutral-900">{f.q}</summary>
                  <p className="mt-2 text-sm text-neutral-700">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case "hours_contact": {
      const showHours = business.hours && site.params.show_hours !== false;
      const showContact = business.address || business.public_email || business.website_url;
      if (!showHours && !showContact) return null;
      return (
        <section key="hours_contact" className="bg-neutral-50 px-4 py-12">
          <div className="mx-auto max-w-3xl grid gap-6 sm:grid-cols-2">
            {showHours && (
              <div>
                <h3 className={`mb-3 text-sm font-semibold uppercase tracking-wide ${accent.sectionAccent}`}>Hours</h3>
                <table className="text-sm text-neutral-700">
                  <tbody>
                    {DAY_ORDER.map((d) => {
                      const h = (business.hours as Record<string, { open: string; close: string } | null>)[d];
                      return (
                        <tr key={d}>
                          <td className="pr-4 py-0.5 text-neutral-500">{DAY_LABEL[d]}</td>
                          <td className="py-0.5">
                            {h === null ? <span className="text-neutral-400">closed</span>
                              : <span className="font-mono">{h.open} – {h.close}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {showContact && (
              <div>
                <h3 className={`mb-3 text-sm font-semibold uppercase tracking-wide ${accent.sectionAccent}`}>Contact</h3>
                <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm text-neutral-700">
                  {business.address && (
                    <>
                      <dt className="text-neutral-500">Address</dt>
                      <dd className="whitespace-pre-wrap">{business.address}</dd>
                    </>
                  )}
                  {business.public_email && (
                    <>
                      <dt className="text-neutral-500">Email</dt>
                      <dd><a href={`mailto:${business.public_email}`} className="underline">{business.public_email}</a></dd>
                    </>
                  )}
                  {business.website_url && (
                    <>
                      <dt className="text-neutral-500">Site</dt>
                      <dd><a href={business.website_url} target="_blank" rel="noopener noreferrer" className="break-all underline">{business.website_url}</a></dd>
                    </>
                  )}
                </dl>
                <Link href={chatHref}
                  className={`${accent.ctaBg} ${accent.ctaHoverBg} mt-6 inline-flex items-center gap-2 ${tpl.ctaShape} px-4 py-2 text-sm font-medium text-white`}>
                  {site.params.cta_label} on NEX →
                </Link>
              </div>
            )}
          </div>
        </section>
      );
    }
  }
  return null;
}
