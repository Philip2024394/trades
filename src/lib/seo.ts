import type { HammerexTradeOffListing } from "./supabase";

const FALLBACK = "http://localhost:3008";

export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_XRATED_SITE_URL?.trim() ??
    process.env.NEXT_PUBLIC_HAMMEREX_SITE_URL?.trim();
  if (!raw) return FALLBACK;
  return raw.replace(/\/+$/, "");
}

export function absolute(path: string): string {
  if (!path) return siteUrl();
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

// Brand block consumed across the Xrated pages — kept Hammerex-shaped
// (name / tagline / description / logo / whatsapp / locale) so existing
// imports `import { BRAND } from "@/lib/seo"` keep their full type
// surface intact. Values are Xrated-branded for the standalone repo.
export const BRAND = {
  name: "Xrated Trades",
  legalName: "Xrated Trades",
  tagline: "Your shareable trade profile",
  description:
    "The shareable trade profile for tradies anywhere. Reviews, photos, prices, WhatsApp — one link. Built for tradespeople who want their work, their pricing and their reputation in one place customers can share.",
  descriptionShort:
    "Linktree for tradies. One shareable profile with reviews, photos, prices and WhatsApp.",
  logo: "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/product-images/migrated/85e5e067cf0cb299.png",
  whatsapp: process.env.ADMIN_WHATSAPP ?? process.env.NEXT_PUBLIC_HAMMEREX_WHATSAPP ?? "+6281392000050",
  locale: "en_GB"
};

export const SEO_KEYWORDS = [
  "tradesperson profile",
  "tradie profile",
  "trade directory",
  "find a tradesperson",
  "tradie linktree",
  "WhatsApp tradesperson",
  "construction profile",
  "verified trades"
];

// Strip markdown so the bio field doesn't bleed `**bold**`, `### heading`,
// list bullets, links and code fences into <meta description> / OG / Twitter
// previews. Conservative: collapse to plain text + single spaces.
export function stripMarkdown(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|\s)\*([^*\s][^*]*)\*/g, "$1$2")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\r?\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function clampDescription(input: string, max = 160): string {
  if (input.length <= max) return input;
  const slice = input.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 80 ? slice.slice(0, lastSpace) : slice).trim() + "…";
}

export function organizationJsonLd() {
  const digits = BRAND.whatsapp.replace(/\D/g, "");
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND.name,
    legalName: BRAND.legalName,
    url: siteUrl(),
    logo: BRAND.logo,
    description: BRAND.description,
    inLanguage: "en-GB",
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: `+${digits}`,
        contactType: "customer support",
        availableLanguage: ["en-GB", "en"]
      }
    ]
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND.name,
    url: siteUrl(),
    inLanguage: "en-GB"
  };
}

export function breadcrumbJsonLd(trail: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      item: absolute(t.url)
    }))
  };
}

// FAQPage JSON-LD — Google's required shape for the AI Overview / featured
// snippet panel. Only emit when there is at least one Q/A pair, otherwise
// validators flag it as an empty mainEntity array.
export function faqJsonLd(faq: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a }
    }))
  };
}

// LocalBusiness schema for a tradesperson profile.
// Surfaces the listing to Google as a local trade so /<slug> can rank for
// "<trade> in <city>" queries the way Checkatrade pages do.
export function localBusinessJsonLd(listing: HammerexTradeOffListing, tradeLabelText: string) {
  const url = absolute(`/trade/${listing.slug}`);
  const photo = listing.avatar_url ?? listing.photos[0] ?? BRAND.logo;
  const digits = listing.whatsapp.replace(/\D/g, "");
  const geo =
    listing.lat != null && listing.lng != null
      ? { "@type": "GeoCoordinates", latitude: listing.lat, longitude: listing.lng }
      : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": url,
    name: listing.trading_name ?? listing.display_name,
    description: stripMarkdown(listing.bio).slice(0, 320),
    image: photo,
    url,
    telephone: digits ? `+${digits}` : undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: listing.city,
      addressCountry: listing.country,
      postalCode: listing.postcode_prefix ?? undefined
    },
    geo,
    areaServed: listing.service_postcodes.length ? listing.service_postcodes : [listing.city],
    knowsAbout: [tradeLabelText, ...listing.secondary_trades],
    foundingDate: listing.start_year ? `${listing.start_year}-01-01` : undefined,
    sameAs: [
      listing.website,
      listing.instagram ? `https://instagram.com/${listing.instagram.replace(/^@/, "")}` : null
    ].filter(Boolean)
  };
}

export function escapeXml(input: string): string {
  return input.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;"
  );
}
