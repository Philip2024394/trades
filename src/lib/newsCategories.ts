// Newsroom category metadata — single source of truth for the
// /news index, the per-post page, the admin composer dropdown and
// the seed script. Colours feed the card gradient fallback used when
// banner_url is null.

export const NEWS_CATEGORIES = [
  {
    slug: "platform",
    label: "Platform",
    description: "Product news, releases, what we shipped",
    gradientFrom: "#FFB300",
    gradientTo: "#7A4900"
  },
  {
    slug: "opinion",
    label: "Opinion",
    description: "Working-trade takes — clearly framed as opinion",
    gradientFrom: "#1F6FEB",
    gradientTo: "#0A0A0A"
  },
  {
    slug: "industry",
    label: "Industry",
    description: "What's happening across the trades right now",
    gradientFrom: "#15803D",
    gradientTo: "#0A0A0A"
  },
  {
    slug: "how-to",
    label: "How-to",
    description: "Practical guides — pricing, photography, customer comms",
    gradientFrom: "#C026D3",
    gradientTo: "#3B0764"
  },
  {
    slug: "general",
    label: "General",
    description: "Everything else worth saying",
    gradientFrom: "#525252",
    gradientTo: "#0A0A0A"
  }
] as const;

export type NewsCategorySlug = (typeof NEWS_CATEGORIES)[number]["slug"];

export function findCategory(slug: string | null | undefined) {
  return (
    NEWS_CATEGORIES.find((c) => c.slug === slug) ??
    NEWS_CATEGORIES[NEWS_CATEGORIES.length - 1]
  );
}

export const VALID_CATEGORY_SLUGS = NEWS_CATEGORIES.map((c) => c.slug);
export const VALID_STATUSES = ["draft", "live", "archived"] as const;
export type NewsStatus = (typeof VALID_STATUSES)[number];

// Slugify a title into a URL-safe slug. Mirrors the slug logic used in
// the listings code path (lowercase, hyphenated, alnum-only).
export function slugifyTitle(title: string): string {
  return (
    (title || "")
      .toLowerCase()
      .normalize("NFKD")
      // strip diacritics
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "post"
  );
}
