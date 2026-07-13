// assembleLayout — the moment the plan becomes real.
//
// Takes the deterministic picks the pipeline made (sectionPicks,
// prose, theme, journey) and produces a real StudioLayoutJson keyed
// by page id. That JSON is what StudioLiveShell renders — the same
// contract published Studio profiles use.
//
// This is step 12 of the 14-step pipeline. Steps 5–11 shipped the
// picks; this step materialises them.
//
// Scope: the HOME page is assembled from `sectionPicks` (which come
// from `layout.sequence`). About / Contact / Projects / etc. are
// left as plan-preview for now — those need per-page section picks
// that aren't part of the primary layout ranking. Follow-up step.

import "@/lib/studio/sections";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type { StudioLayoutJson } from "@/lib/studio/schema";
import type { BespokeProse, BespokePageCopy } from "./bespokeProse";
import { pickHeroForTrade, type HeroEntry } from "@/lib/heroLibrary";

type SectionPick = {
  role: string;
  containerId: string;
  sectionId: string | null;
  library: string | null;
};

export type AssembledLayouts = {
  home?: StudioLayoutJson;
  about?: StudioLayoutJson;
  contact?: StudioLayoutJson;
  projects?: StudioLayoutJson;
  services?: StudioLayoutJson;
  faq?: StudioLayoutJson;
  reviews?: StudioLayoutJson;
  coverage?: StudioLayoutJson;
  "product-grid"?: StudioLayoutJson;
};

/** Maps a page id to the section libraries the page pulls from, in
 *  order. The assembler picks the first registered section in each
 *  library so the layout is deterministic + trade-agnostic. */
const PAGE_LIBRARY_MAP: Record<string, readonly string[]> = {
  about: ["about", "trust_bar", "statistics", "team", "cta"],
  contact: ["hero", "contact", "cta"],
  projects: ["hero", "gallery", "portfolio", "testimonials", "cta"],
  services: ["hero", "services", "pricing", "cta"],
  faq: ["hero", "faq", "cta"],
  reviews: ["hero", "testimonials", "reviews-strip", "cta"],
  coverage: ["hero", "map", "service-areas", "cta"],
  "product-grid": ["hero", "product_grid", "cta"]
};

/** Deterministic random id — stable enough for a single generation
 *  pass. Not crypto-strong; that isn't the goal. */
function id(prefix: "sec" | "row"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Fallback banner-hero — used only when the hero library has no
 *  keyword match for the merchant's trade. Merchant can swap via the
 *  media picker post-publish. */
const FALLBACK_HERO_IMAGE =
  "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1600&h=900&q=80";

/** Extract copy fields from a BespokePageCopy that a hero section
 *  probably wants. Falls back to safe defaults. When a hero entry is
 *  supplied, its image_url + text-zone hint override the generic
 *  fallback so the merchant sees a trade-appropriate photograph
 *  immediately. */
function heroConfigFromProse(
  copy: BespokePageCopy | undefined,
  merchantName: string,
  hero?: HeroEntry | null
): Record<string, unknown> {
  const h = copy?.hero;
  const image = hero?.image_url ?? FALLBACK_HERO_IMAGE;
  return {
    // Common hero field names across our registered hero sections —
    // section renderers merge with their own defaults.
    eyebrow: h?.eyebrow ?? "",
    headline: h?.headline ?? merchantName,
    subheading: h?.subhead ?? "",
    subhead: h?.subhead ?? "",
    ctaLabel: h?.ctaPrimary ?? "Get a Quote",
    ctaPrimary: h?.ctaPrimary ?? "Get a Quote",
    ctaSecondary: h?.ctaSecondary ?? "",
    ctaSecondaryLabel: h?.ctaSecondary ?? "",
    // Banner image — every home hero renders with a photograph behind
    // the CTAs. Multiple field names because different hero section
    // manifests use different keys. Section renderers pick whichever
    // one their schema declares; the rest are ignored.
    backgroundImageUrl: image,
    imageUrl: image,
    heroImage: image,
    image,
    photoUrl: image,
    bgImage: image,
    // Text-placement hint from the hero library so section renderers
    // that support it can align the copy to the image's free-text zone.
    textZone: hero?.text_zone?.primary ?? "top-left",
    textShadowRecommended: hero?.text_zone?.text_shadow_recommended ?? false,
    heroPalette: hero?.theme_palette ?? null
  };
}

function servicesConfigFromProse(copy: BespokePageCopy | undefined): Record<string, unknown> {
  const s = copy?.services;
  return {
    heading: s?.heading ?? "Our services",
    items: (s?.items ?? []).map((it) => ({
      title: it.title,
      description: it.description,
      price: it.priceHint
    }))
  };
}

function aboutConfigFromProse(copy: BespokePageCopy | undefined): Record<string, unknown> {
  const a = copy?.about;
  return {
    heading: a?.heading ?? "About us",
    body: a?.story ?? "",
    story: a?.story ?? "",
    stats: a?.stats ?? []
  };
}

function contactConfigFromProse(copy: BespokePageCopy | undefined): Record<string, unknown> {
  const c = copy?.contact;
  return {
    heading: c?.heading ?? "Get in touch",
    subheading: c?.subhead ?? "",
    subhead: c?.subhead ?? "",
    responsePromise: c?.responsePromise ?? ""
  };
}

function faqConfigFromProse(copy: BespokePageCopy | undefined): Record<string, unknown> {
  const f = copy?.faq;
  return {
    heading: f?.heading ?? "Common questions",
    items: (f?.items ?? []).map((it) => ({
      question: it.question,
      answer: it.answer
    }))
  };
}

function reviewsConfigFromProse(copy: BespokePageCopy | undefined): Record<string, unknown> {
  const r = copy?.reviews;
  return {
    heading: r?.heading ?? "What our customers say",
    subhead: r?.subhead ?? ""
  };
}

function projectsConfigFromProse(copy: BespokePageCopy | undefined): Record<string, unknown> {
  const p = copy?.projects;
  return {
    heading: p?.heading ?? "Our work",
    subhead: p?.subhead ?? ""
  };
}

/** Pick a config shape based on the role hint on the layout step. */
function configForRole(
  role: string,
  copy: BespokePageCopy | undefined,
  merchantName: string,
  hero?: HeroEntry | null
): Record<string, unknown> {
  const r = role.toLowerCase();
  if (r.includes("hero") || r === "attention") return heroConfigFromProse(copy, merchantName, hero);
  if (r.includes("service") || r === "browse") return servicesConfigFromProse(copy);
  if (r.includes("about") || r === "trust") return aboutConfigFromProse(copy);
  if (r.includes("contact") || r === "action") return contactConfigFromProse(copy);
  if (r.includes("faq") || r.includes("reassure")) return faqConfigFromProse(copy);
  if (r.includes("review") || r.includes("testimonial")) return reviewsConfigFromProse(copy);
  if (r.includes("portfolio") || r.includes("project") || r.includes("gallery") || r === "consider") {
    return projectsConfigFromProse(copy);
  }
  return {};
}

export type AssembleLayoutInput = {
  merchantName: string;
  tradeSlug?: string;
  sectionPicks: readonly SectionPick[];
  prose: BespokeProse | null;
};

/** Assemble a real StudioLayoutJson for the HOME page from the
 *  pipeline's deterministic picks + the bespoke prose. Returns null
 *  when no picks resolved to registered sections. */
export function assembleHomeLayout(
  input: AssembleLayoutInput
): StudioLayoutJson | null {
  const filled = input.sectionPicks.filter((p) => p.sectionId && sectionRegistry.has(p.sectionId));
  if (filled.length === 0) return null;

  const homeCopy = input.prose?.pages.find((p) => p.pageId === "home");
  const heroPick = input.tradeSlug ? pickHeroForTrade(input.tradeSlug)?.entry : null;

  const sections = filled.map((p) => {
    const reg = sectionRegistry.get(p.sectionId as string);
    const defaults = (reg?.defaultConfig?.() ?? {}) as Record<string, unknown>;
    const proseConfig = configForRole(p.role, homeCopy, input.merchantName, heroPick);
    return {
      instanceId: id("sec"),
      key: p.sectionId as string,
      config: { ...defaults, ...proseConfig }
    };
  });

  // Each section gets its own row — single-column layout. Multi-column
  // rows land when we wire Container.plan groupings.
  const rows = sections.map((s) => ({
    id: id("row"),
    columns: [s.instanceId]
  }));

  return { sections, rows };
}

/** Deterministically pick the first registered section per library in
 *  the map for a given page id. Returns null when nothing resolves. */
function pickSectionsForPage(pageId: string): Array<{ role: string; sectionId: string }> {
  const libraries = PAGE_LIBRARY_MAP[pageId];
  if (!libraries) return [];
  const picks: Array<{ role: string; sectionId: string }> = [];
  for (const lib of libraries) {
    const inLib = sectionRegistry.list(lib as never);
    if (inLib.length > 0) {
      picks.push({ role: lib, sectionId: inLib[0].id });
    }
  }
  return picks;
}

/** Assemble a real StudioLayoutJson for a non-home page — About,
 *  Contact, Projects, etc. Uses library-based picks and the page's
 *  bespoke prose. */
export function assemblePageLayout(
  pageId: string,
  input: AssembleLayoutInput
): StudioLayoutJson | null {
  const picks = pickSectionsForPage(pageId);
  if (picks.length === 0) return null;

  const pageCopy = input.prose?.pages.find((p) => p.pageId === pageId);
  const heroPick = input.tradeSlug ? pickHeroForTrade(input.tradeSlug)?.entry : null;

  const sections = picks.map((p) => {
    const reg = sectionRegistry.get(p.sectionId);
    const defaults = (reg?.defaultConfig?.() ?? {}) as Record<string, unknown>;
    const proseConfig = configForRole(p.role, pageCopy, input.merchantName, heroPick);
    return {
      instanceId: id("sec"),
      key: p.sectionId,
      config: { ...defaults, ...proseConfig }
    };
  });

  const rows = sections.map((s) => ({
    id: id("row"),
    columns: [s.instanceId]
  }));

  return { sections, rows };
}

/** Full multi-page assembly. Home materialises from the ranked layout
 *  sequence; other pages materialise from a per-page library map. */
export function assemblePipelineLayouts(
  input: AssembleLayoutInput & { pageIds?: readonly string[] }
): AssembledLayouts {
  const out: AssembledLayouts = {};
  const home = assembleHomeLayout(input);
  if (home) out.home = home;

  const pageIds = input.pageIds ?? Object.keys(PAGE_LIBRARY_MAP);
  for (const pid of pageIds) {
    if (pid === "home") continue;
    const layout = assemblePageLayout(pid, input);
    if (layout) {
      // TypeScript-friendly index: only assign known keys.
      (out as Record<string, StudioLayoutJson>)[pid] = layout;
    }
  }
  return out;
}
