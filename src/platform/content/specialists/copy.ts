// CopyComposer — hero / service-list / value-props / trust-copy / faq.
//
// v1 = deterministic template composer. Produces structured blocks
// from ResolvedStrategy + Trade Intelligence + Business Profile. LLM
// backends will register against the same `slug: "copy"` in a future
// batch; the director will pick per plan tier.

import { tradeIntelligenceRegistry } from "@/platform/business";
import type { FrozenTradeIntelligenceManifest } from "@/platform/business";
import type {
  FaqBlockData,
  HeroBlockData,
  ServiceListBlockData,
  TrustCopyBlockData,
  ValuePropsBlockData
} from "../blocks";
import { composerRegistry } from "../composers";
import { buildBlock, buildProvenance, buildRegenerationHints } from "../provenance";
import type { ContentBlock, CreativeBrief } from "../types";

const COMPOSER_META = {
  slug: "copy",
  version: "1.0.0",
  backend: "template" as const
};

const P = { name: "Xrated Trades Platform", verified: true } as const;

// ─── CTA label vocabulary (matches explainer + booking) ──────
const CTA_INTENT_TO_LABEL: Record<string, string> = {
  "book-consultation": "Book Consultation",
  "book-appointment": "Book Appointment",
  "book-survey": "Book Survey",
  "free-survey": "Book Free Survey",
  "request-quote": "Request a Quote",
  "call-now": "Call Now",
  whatsapp: "Message on WhatsApp",
  "open-trade-account": "Open Trade Account",
  "start-conversation": "Get in Touch"
};

function ctaFromStrategy(brief: CreativeBrief): string {
  const cta = brief.strategy.get("cta", "primary") as
    | { intent?: string; ctaLabelHint?: string }
    | undefined;
  if (cta?.ctaLabelHint) return cta.ctaLabelHint;
  const intent = cta?.intent ?? "start-conversation";
  return CTA_INTENT_TO_LABEL[intent] ?? "Get in Touch";
}

function humanServiceLabel(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function tradeFor(brief: CreativeBrief): FrozenTradeIntelligenceManifest | undefined {
  return tradeIntelligenceRegistry.get(brief.strategy.inputs.profile.trade);
}

// ─── Compose ────────────────────────────────────────────────
function composeCopyBlocks(brief: CreativeBrief): ContentBlock[] {
  const profile = brief.strategy.inputs.profile;
  const growth = brief.strategy.inputs.strategy;
  const trade = tradeFor(brief);

  const cta = ctaFromStrategy(brief);
  const pushServices = growth.pushServices?.length
    ? growth.pushServices
    : profile.primaryServices;
  const featuredService = pushServices[0] ?? profile.primaryServices[0] ?? "our services";
  const featuredLabel = humanServiceLabel(featuredService);

  const blocks: ContentBlock[] = [];

  // ─── Hero ────────────────────────────────────────────────
  const heroData: HeroBlockData = {
    headline: `${featuredLabel} you can trust in ${profile.regions?.[0] ?? profile.country}`,
    subheadline: `${profile.name} — ${profile.yearsTrading} years of ${humanServiceLabel(profile.trade).toLowerCase()} experience.`,
    supportingLine: trade
      ? `Fully insured. ${(trade.trustBuilders as readonly string[])
          .filter((tb) => tb !== "before-after" && tb !== "workshop-photos")
          .slice(0, 2)
          .map((tb) => tb.replace(/-/g, " "))
          .join(" · ")}.`
      : undefined,
    primaryCtaLabel: cta,
    trustBadges: trade?.compliance?.audienceExpectedBadges?.slice(0, 3),
    imageHint: `${featuredLabel} finished project — hero photo`
  };
  blocks.push(
    buildBlock<HeroBlockData>({
      slug: "hero",
      kind: "hero",
      data: heroData,
      provenance: buildProvenance({
        strategy: brief.strategy,
        composer: COMPOSER_META,
        purpose: "conversion",
        audience: profile.isCommercial ? "commercial-customer" : "residential-customer"
      }),
      regeneration: buildRegenerationHints({
        editableFields: ["headline", "subheadline", "supportingLine", "primaryCtaLabel"],
        invalidatedBy: ["profile", "strategy", `trade:${profile.trade}`, "playbook:trust-first", "playbook:emergency-response"],
        regenerationHint: "Try a different headline angle or push a different service"
      })
    })
  );

  // ─── Service List ────────────────────────────────────────
  const servicesFromTrade = trade?.services ?? [];
  const orderedServices = pushServices.slice();
  for (const s of servicesFromTrade) {
    if (!orderedServices.includes(s.slug)) orderedServices.push(s.slug);
  }
  const items = orderedServices.slice(0, 8).map((slug, i) => {
    const meta = servicesFromTrade.find((s) => s.slug === slug);
    const title = meta?.label ?? humanServiceLabel(slug);
    const description = meta?.regulated
      ? `${title} — compliant with UK / IE regulation. Certified installers.`
      : meta?.requiresSurvey
      ? `${title} — free on-site survey then a fixed quote.`
      : `${title} — professional service by our in-house team.`;
    return {
      slug,
      title,
      description,
      marginBand: meta?.margin,
      featured: i === 0,
      tags: meta?.regulated ? ["regulated"] : undefined
    };
  });
  const serviceListData: ServiceListBlockData = {
    intro: `${featuredLabel} is our specialty — but we cover everything you'd expect from a ${humanServiceLabel(profile.trade).toLowerCase()}.`,
    items
  };
  blocks.push(
    buildBlock<ServiceListBlockData>({
      slug: "services",
      kind: "service-list",
      data: serviceListData,
      provenance: buildProvenance({
        strategy: brief.strategy,
        composer: COMPOSER_META,
        purpose: "conversion",
        knowledgeRefs: [`trade:${profile.trade}`]
      }),
      regeneration: buildRegenerationHints({
        editableFields: ["intro", "items"],
        invalidatedBy: ["strategy", `trade:${profile.trade}`, "growthStrategy.pushServices"],
        regenerationHint: "Change the order of services or emphasise a different lead service"
      })
    })
  );

  // ─── Value Props ─────────────────────────────────────────
  const trustList = ((brief.strategy.get("trust", "elements") as { list?: readonly string[] } | undefined)?.list ?? trade?.trustBuilders ?? []).slice(0, 4);
  const valuePropsData: ValuePropsBlockData = {
    heading: `Why ${profile.name}`,
    items: trustList.map((tb) => valuePropForTrust(tb, profile.trade, profile.yearsTrading))
  };
  blocks.push(
    buildBlock<ValuePropsBlockData>({
      slug: "value-props",
      kind: "value-props",
      data: valuePropsData,
      provenance: buildProvenance({
        strategy: brief.strategy,
        composer: COMPOSER_META,
        purpose: "trust"
      }),
      regeneration: buildRegenerationHints({
        editableFields: ["heading", "items"],
        invalidatedBy: ["profile", "playbook:trust-first"]
      })
    })
  );

  // ─── Trust Copy ──────────────────────────────────────────
  const trustBullets: string[] = [];
  if (profile.yearsTrading) trustBullets.push(`${profile.yearsTrading}+ years of trading in ${profile.country}`);
  if (trade?.compliance?.typicalCertifications?.length) {
    trustBullets.push(`Fully accredited: ${trade.compliance.typicalCertifications.slice(0, 3).join(", ")}`);
  }
  trustBullets.push("Fully insured — public liability and employer liability");
  trustBullets.push("Written guarantees on every job we complete");

  const trustCopyData: TrustCopyBlockData = {
    heading: "Why customers choose us",
    intro: undefined,
    bullets: trustBullets,
    guaranteeLine: "We stand behind our work. If it's not right, we come back and fix it.",
    badges: trade?.compliance?.audienceExpectedBadges
  };
  blocks.push(
    buildBlock<TrustCopyBlockData>({
      slug: "trust",
      kind: "trust-copy",
      data: trustCopyData,
      provenance: buildProvenance({
        strategy: brief.strategy,
        composer: COMPOSER_META,
        purpose: "trust"
      }),
      regeneration: buildRegenerationHints({
        editableFields: ["heading", "bullets", "guaranteeLine"],
        invalidatedBy: ["profile", "playbook:trust-first"]
      })
    })
  );

  // ─── FAQ ─────────────────────────────────────────────────
  if (trade?.commonFaqs?.length) {
    const faqItems = trade.commonFaqs.slice(0, 6).map((f) => ({
      question: f.question,
      answer: f.answerHint ?? "[Add your answer — the platform doesn't fabricate answers on your behalf.]",
      services: f.services
    }));
    const faqData: FaqBlockData = {
      heading: "Frequently asked questions",
      items: faqItems
    };
    blocks.push(
      buildBlock<FaqBlockData>({
        slug: "faq",
        kind: "faq",
        data: faqData,
        provenance: buildProvenance({
          strategy: brief.strategy,
          composer: COMPOSER_META,
          purpose: "reassurance",
          knowledgeRefs: [`trade:${profile.trade}`]
        }),
        regeneration: buildRegenerationHints({
          editableFields: ["heading", "items"],
          invalidatedBy: [`trade:${profile.trade}`]
        })
      })
    );
  }

  return blocks;
}

function valuePropForTrust(
  builderKind: string,
  _tradeSlug: string,
  yearsTrading: number
): { title: string; description: string; iconHint?: string } {
  switch (builderKind) {
    case "years-trading":
      return {
        title: `${yearsTrading}+ years trading`,
        description: `A track record you can call — and a workshop you can visit.`,
        iconHint: "CalendarClock"
      };
    case "insurance":
      return {
        title: "Fully insured",
        description: "Public liability + employer liability on every job. Certificates available on request.",
        iconHint: "ShieldCheck"
      };
    case "certifications":
      return {
        title: "Certified installers",
        description: "Our team holds the certifications your job requires — nothing gets subcontracted out.",
        iconHint: "Award"
      };
    case "response-time-promise":
      return {
        title: "Fast response",
        description: "On-site within our published window — or we tell you why up front.",
        iconHint: "Clock"
      };
    case "no-callout-fee":
      return {
        title: "No callout fee",
        description: "You pay for the fix, not for the visit.",
        iconHint: "BadgeCheck"
      };
    case "guarantees":
      return {
        title: "Written guarantee",
        description: "Every job comes with a written guarantee. Not marketing — actual paper.",
        iconHint: "FileCheck"
      };
    case "before-after":
      return {
        title: "Real before/after photos",
        description: "Every case study on our site is a real project — no stock imagery.",
        iconHint: "Camera"
      };
    case "van-branded":
      return {
        title: "Branded vans",
        description: "You'll see us coming. Our vans are ours — not subcontracted labour in unmarked cars.",
        iconHint: "Truck"
      };
    default:
      return {
        title: builderKind.replace(/-/g, " "),
        description: `${builderKind.replace(/-/g, " ")} — one of the things we do well.`,
        iconHint: "Check"
      };
  }
}

// ─── Register ────────────────────────────────────────────────
composerRegistry.register({
  manifestVersion: 1,
  slug: COMPOSER_META.slug,
  name: "Copy Composer (template v1)",
  description:
    "Produces hero, service-list, value-props, trust-copy, and FAQ blocks from ResolvedStrategy + Trade Intelligence. Deterministic template backend — LLM backends register alongside in future batches.",
  version: COMPOSER_META.version,
  supportedBlockKinds: [
    "hero",
    "service-list",
    "value-props",
    "trust-copy",
    "faq",
    "cta-band"
  ],
  supportedOutputMedia: ["website", "landing-page", "brochure"],
  backend: COMPOSER_META.backend,
  compose: composeCopyBlocks,
  publisher: P
});
