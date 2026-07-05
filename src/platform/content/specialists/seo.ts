// SeoComposer — page structures + metadata + internal links.
//
// Uses tradeIntelligenceRegistry.seoKeywordTemplates + the merchant's
// serviceRadius to produce structured SEO pages. Deterministic v1.

import { tradeIntelligenceRegistry } from "@/platform/business";
import type { SeoPageBlockData } from "../blocks";
import { composerRegistry } from "../composers";
import { buildBlock, buildProvenance, buildRegenerationHints } from "../provenance";
import type { ContentBlock, CreativeBrief } from "../types";

const COMPOSER_META = {
  slug: "seo",
  version: "1.0.0",
  backend: "template" as const
};

const P = { name: "Xrated Trades Platform", verified: true } as const;

function locationsForRadius(
  radius: { kind: string } & Record<string, unknown>
): readonly string[] {
  if (radius.kind === "postcodes") {
    return (radius.postcodes as readonly string[] | undefined) ?? [];
  }
  if (radius.kind === "regions") {
    return (radius.regions as readonly string[] | undefined) ?? [];
  }
  return [];
}

function humanServiceLabel(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function composeSeoBlocks(brief: CreativeBrief): ContentBlock[] {
  const profile = brief.strategy.inputs.profile;
  const trade = tradeIntelligenceRegistry.get(profile.trade);
  if (!trade) return [];

  const locations = locationsForRadius(profile.serviceRadius as unknown as { kind: string } & Record<string, unknown>);
  const pushServices = brief.strategy.inputs.strategy.pushServices ?? [];
  const primaryLocation = locations[0] ?? (profile.regions?.[0] ?? profile.country);
  const blocks: ContentBlock[] = [];

  // Home page.
  const homeKeywords = trade.seoKeywordTemplates
    .filter((t) => (t.priority ?? 5) <= 2)
    .slice(0, 6)
    .map((t) =>
      t.template
        .replace("{location}", primaryLocation)
        .replace("{trade}", trade.slug)
    );
  const homeData: SeoPageBlockData = {
    pageKind: "home",
    slug: "home",
    path: "/",
    title: `${profile.name} — ${trade.name} in ${primaryLocation}`,
    description: `${trade.name} services in ${primaryLocation}. ${profile.yearsTrading}+ years of trading. Fully insured. Free quotes.`,
    h1: `${trade.name} in ${primaryLocation}`,
    keywords: homeKeywords,
    internalLinks: pushServices.slice(0, 3).map((slug) => ({
      slug: `service-${slug}`,
      label: humanServiceLabel(slug)
    })),
    schemaHints: ["LocalBusiness", "Service"]
  };
  blocks.push(
    buildBlock<SeoPageBlockData>({
      slug: "seo-home",
      kind: "seo-page",
      data: homeData,
      provenance: buildProvenance({
        strategy: brief.strategy,
        composer: COMPOSER_META,
        purpose: "seo",
        knowledgeRefs: [`trade:${trade.slug}`]
      }),
      regeneration: buildRegenerationHints({
        editableFields: ["title", "description", "h1", "keywords"],
        invalidatedBy: ["profile", "strategy", `trade:${trade.slug}`]
      })
    })
  );

  // Service pages — one per push service.
  for (const serviceSlug of pushServices.slice(0, 6)) {
    const svcMeta = trade.services.find((s) => s.slug === serviceSlug);
    const label = svcMeta?.label ?? humanServiceLabel(serviceSlug);
    const applicableTemplates = trade.seoKeywordTemplates.filter(
      (t) => !t.services || t.services.includes(serviceSlug)
    );
    const keywords = applicableTemplates
      .slice(0, 4)
      .map((t) =>
        t.template.replace("{location}", primaryLocation).replace("{trade}", trade.slug).replace("{service}", label.toLowerCase())
      );
    const svcData: SeoPageBlockData = {
      pageKind: "service",
      slug: `service-${serviceSlug}`,
      path: `/services/${serviceSlug}`,
      title: `${label} in ${primaryLocation} — ${profile.name}`,
      description: `${label} by ${profile.name}. ${svcMeta?.regulated ? "Fully regulated. " : ""}Free survey and quote.`,
      h1: `${label} in ${primaryLocation}`,
      keywords,
      internalLinks: [{ slug: "home", label: "Home" }],
      schemaHints: ["Service", svcMeta?.regulated ? "GovernmentService" : "LocalBusiness"].filter(Boolean) as string[]
    };
    blocks.push(
      buildBlock<SeoPageBlockData>({
        slug: `seo-service-${serviceSlug}`,
        kind: "seo-page",
        data: svcData,
        provenance: buildProvenance({
          strategy: brief.strategy,
          composer: COMPOSER_META,
          purpose: "seo",
          knowledgeRefs: [`trade:${trade.slug}`, `service:${serviceSlug}`]
        }),
        regeneration: buildRegenerationHints({
          editableFields: ["title", "description", "h1", "keywords"],
          invalidatedBy: ["strategy", `service:${serviceSlug}`, `trade:${trade.slug}`]
        })
      })
    );
  }

  // Town pages — one per top-4 location.
  for (const location of locations.slice(0, 4)) {
    const townKeywords = trade.seoKeywordTemplates
      .filter((t) => t.intent === "local")
      .slice(0, 4)
      .map((t) => t.template.replace("{location}", location).replace("{trade}", trade.slug));
    const townData: SeoPageBlockData = {
      pageKind: "town",
      slug: `town-${location.toLowerCase().replace(/\s+/g, "-")}`,
      path: `/${location.toLowerCase().replace(/\s+/g, "-")}`,
      title: `${trade.name} in ${location} — ${profile.name}`,
      description: `${trade.name} services in ${location}. ${profile.yearsTrading}+ years trading. Free quotes.`,
      h1: `${trade.name} in ${location}`,
      keywords: townKeywords,
      internalLinks: [
        { slug: "home", label: "Home" },
        ...pushServices.slice(0, 2).map((slug) => ({
          slug: `service-${slug}`,
          label: humanServiceLabel(slug)
        }))
      ],
      schemaHints: ["LocalBusiness"]
    };
    blocks.push(
      buildBlock<SeoPageBlockData>({
        slug: `seo-town-${location.toLowerCase().replace(/\s+/g, "-")}`,
        kind: "seo-page",
        data: townData,
        provenance: buildProvenance({
          strategy: brief.strategy,
          composer: COMPOSER_META,
          purpose: "seo",
          knowledgeRefs: [`trade:${trade.slug}`, `location:${location}`]
        }),
        regeneration: buildRegenerationHints({
          editableFields: ["title", "description", "h1", "keywords"],
          invalidatedBy: ["profile.serviceRadius", `trade:${trade.slug}`]
        })
      })
    );
  }

  return blocks;
}

composerRegistry.register({
  manifestVersion: 1,
  slug: COMPOSER_META.slug,
  name: "SEO Composer (template v1)",
  description:
    "Produces structured SEO page blocks (home, service, town) from trade SEO keyword templates and merchant service radius. Deterministic; keywords derived from tradeIntelligenceRegistry.",
  version: COMPOSER_META.version,
  supportedBlockKinds: ["seo-page"],
  supportedOutputMedia: ["website", "landing-page"],
  backend: COMPOSER_META.backend,
  compose: composeSeoBlocks,
  publisher: P
});
