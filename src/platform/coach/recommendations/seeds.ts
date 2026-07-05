// recommendationRegistry — 10 seed recommendations covering all 6
// health dimensions.
//
// Every seed is cross-checked against playbookRegistry / patternRegistry
// / evidenceRegistry at registration — dangling citations fail loudly.

import { tradeIntelligenceRegistry } from "@/platform/business";
import type { CoachContext, RecommendationEvaluation } from "../types";
import { recommendationRegistry } from "./registry";

const P = { name: "Xrated Trades Platform", verified: true } as const;

function humanServiceLabel(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function ok(): RecommendationEvaluation {
  return { triggered: false, detail: "" };
}

// ─── 1. Portfolio below recommended minimum ───────────────────
recommendationRegistry.register({
  manifestVersion: 1,
  slug: "portfolio-below-minimum",
  title: "Upload more completed projects",
  description:
    "Your portfolio is below the level similar businesses typically show. More projects means more proof.",
  version: "1.0.0",
  dimension: "portfolio",
  category: "portfolio",
  scope: { trades: ["*"], countries: ["*"] },
  condition: {
    description: "projectCount < trade-recommended minimum (default 10)",
    check: (ctx) => {
      const projectCount = ctx.projectCount ?? 0;
      const trade = tradeIntelligenceRegistry.get(
        ctx.strategy.inputs.profile.trade
      );
      const target = trade?.imageStrategy?.minFinishedWorkPhotos ?? 10;
      if (projectCount >= target) return ok();
      const gap = target - projectCount;
      return {
        triggered: true,
        currentValue: projectCount,
        targetValue: target,
        gapPercentage: Math.round((gap / target) * 100),
        detail: `You have ${projectCount} completed project${
          projectCount === 1 ? "" : "s"
        }; similar ${
          trade?.name.toLowerCase() ?? "trade"
        } businesses typically show ${target}. Add ${gap} more.`
      };
    }
  },
  action: {
    label: "Upload projects",
    autoFix: { handler: "open-project-wizard" }
  },
  priority: 5,
  estimatedImpact: "high",
  citesPlaybooks: ["portfolio-heavy"],
  rationale: {
    whyItMatters:
      "Buyers of trade services shortlist on visible proof of past work. Empty portfolios are a common reason quotes get ignored.",
    expectedOutcome:
      "More projects → more time on page → more enquiries. The gallery is what converts browsers to leads."
  },
  publisher: P
});

// ─── 2. Push-service missing dedicated page ───────────────────
recommendationRegistry.register({
  manifestVersion: 1,
  slug: "push-service-missing-page",
  title: "Create service pages for your push services",
  description:
    "You're growing a service but don't have a dedicated page for it — search can't find you.",
  version: "1.0.0",
  dimension: "local-seo",
  category: "seo",
  scope: { trades: ["*"], countries: ["*"] },
  condition: {
    description: "pushServices with no matching seo-page block in manifest",
    check: (ctx) => {
      const pushServices = ctx.strategy.inputs.strategy.pushServices ?? [];
      if (!pushServices.length) return ok();
      const seoBlocks =
        ctx.manifest?.pages.flatMap((p) =>
          p.sections.flatMap((s) => s.blocks)
        ).filter((b) => b.kind === "seo-page") ?? [];
      const missing = pushServices.filter(
        (svc) =>
          !seoBlocks.some((b) => {
            const d = b.data as { slug?: string; pageKind?: string };
            return d.pageKind === "service" && d.slug === `service-${svc}`;
          })
      );
      if (!missing.length) return ok();
      return {
        triggered: true,
        currentValue: pushServices.length - missing.length,
        targetValue: pushServices.length,
        gapPercentage: Math.round((missing.length / pushServices.length) * 100),
        detail: `Your growth strategy pushes ${pushServices
          .map(humanServiceLabel)
          .join(", ")} — but ${missing.length} of these don't have a dedicated service page yet.`
      };
    }
  },
  action: {
    label: "Generate service pages",
    autoFix: { handler: "regenerate-seo-service-pages" }
  },
  priority: 5,
  estimatedImpact: "high",
  citesPlaybooks: ["local-seo"],
  rationale: {
    whyItMatters:
      "Google ranks pages, not sites. A service page for each push service gives you commercial-intent SEO coverage.",
    expectedOutcome:
      "Better ranking on commercial-intent search terms → more organic leads for the services you actually want to sell."
  },
  publisher: P
});

// ─── 3. Town pages not generated ──────────────────────────────
recommendationRegistry.register({
  manifestVersion: 1,
  slug: "town-pages-not-generated",
  title: "Publish town landing pages for your service area",
  description:
    "Your service radius covers multiple locations but you haven't published town landing pages yet.",
  version: "1.0.0",
  dimension: "local-seo",
  category: "seo",
  scope: { trades: ["*"], countries: ["*"] },
  condition: {
    description: "profile.serviceRadius has locations but no town-* SEO pages",
    check: (ctx) => {
      const radius = ctx.strategy.inputs.profile.serviceRadius as
        | { kind: string; postcodes?: readonly string[]; regions?: readonly string[] };
      const locations =
        radius.kind === "postcodes"
          ? radius.postcodes ?? []
          : radius.kind === "regions"
          ? radius.regions ?? []
          : [];
      if (!locations.length) return ok();
      const seoBlocks =
        ctx.manifest?.pages.flatMap((p) =>
          p.sections.flatMap((s) => s.blocks)
        ).filter((b) => b.kind === "seo-page") ?? [];
      const townPages = seoBlocks.filter(
        (b) => (b.data as { pageKind?: string }).pageKind === "town"
      );
      if (townPages.length >= locations.length) return ok();
      const missing = locations.slice(townPages.length);
      return {
        triggered: true,
        currentValue: townPages.length,
        targetValue: locations.length,
        gapPercentage: Math.round((missing.length / locations.length) * 100),
        detail: `Your service radius includes ${locations.join(", ")} — but you only have ${
          townPages.length
        } town page${townPages.length === 1 ? "" : "s"} published. Missing: ${missing.join(", ")}.`
      };
    }
  },
  action: {
    label: "Generate town pages",
    autoFix: { handler: "regenerate-seo-town-pages" }
  },
  priority: 4,
  estimatedImpact: "medium",
  citesPlaybooks: ["local-seo"],
  rationale: {
    whyItMatters:
      "Local search intent ('electrician Cork') dominates the trade buying journey. A page per town captures that intent.",
    expectedOutcome:
      "Higher local pack visibility across your entire service area, not just your headquarters town."
  },
  publisher: P
});

// ─── 4. Trust certifications missing above the fold ───────────
recommendationRegistry.register({
  manifestVersion: 1,
  slug: "trust-certifications-missing",
  title: "Show certifications above the fold",
  description:
    "Your trade typically requires visible certifications — customers check for them before enquiring.",
  version: "1.0.0",
  dimension: "trust",
  category: "trust",
  scope: { trades: ["*"], countries: ["GB", "IE"] },
  condition: {
    description: "trust.elements missing 'certifications' when trade requires them",
    check: (ctx) => {
      const trade = tradeIntelligenceRegistry.get(
        ctx.strategy.inputs.profile.trade
      );
      const needsCerts = (trade?.compliance?.typicalCertifications?.length ?? 0) > 0;
      if (!needsCerts) return ok();
      const trustElements =
        (ctx.strategy.get("trust", "elements") as { list?: readonly string[] } | undefined)
          ?.list ?? [];
      if (trustElements.includes("certifications")) return ok();
      return {
        triggered: true,
        detail: `Your trade typically requires ${trade!.compliance!
          .typicalCertifications!.slice(0, 3)
          .join(", ")}. Showing these badges above the fold answers the first question every buyer asks: "Are they qualified?"`
      };
    }
  },
  action: {
    label: "Add certification badges",
    autoFix: { handler: "open-trust-editor" }
  },
  priority: 4,
  estimatedImpact: "high",
  citesPlaybooks: ["trust-first"],
  citesPatterns: ["trust-above-the-fold-general"],
  citesEvidence: ["trust-badges-above-fold-general", "gas-safe-badge-plumber-trust"],
  rationale: {
    whyItMatters:
      "For regulated trades (Gas Safe, NICEIC, Part P), the absence of a visible certification badge is a known enquiry disqualifier.",
    expectedOutcome:
      "Higher perceived credibility, fewer visitors bouncing to look at competitors."
  },
  publisher: P
});

// ─── 5. FAQ answers missing (placeholders) ────────────────────
recommendationRegistry.register({
  manifestVersion: 1,
  slug: "faq-answers-missing",
  title: "Answer your FAQ questions",
  description:
    "The Creative Director never invents answers — placeholder FAQs need your input.",
  version: "1.0.0",
  dimension: "content-quality",
  category: "content",
  scope: { trades: ["*"], countries: ["*"] },
  condition: {
    description: "Any FAQ block contains placeholder answers ('[Add your answer…]')",
    check: (ctx) => {
      const faqBlocks =
        ctx.manifest?.pages.flatMap((p) =>
          p.sections.flatMap((s) => s.blocks)
        ).filter((b) => b.kind === "faq") ?? [];
      let unanswered = 0;
      for (const block of faqBlocks) {
        const items = (block.data as { items: readonly { answer: string }[] }).items;
        for (const item of items) {
          if (item.answer.startsWith("[Add your answer")) unanswered++;
        }
      }
      if (unanswered === 0) return ok();
      return {
        triggered: true,
        currentValue: unanswered,
        targetValue: 0,
        detail: `You have ${unanswered} unanswered FAQ${
          unanswered === 1 ? "" : "s"
        } on your site. The platform doesn't fabricate answers — provide the real ones so visitors don't leave.`
      };
    }
  },
  action: {
    label: "Answer FAQs",
    autoFix: { handler: "open-faq-editor" }
  },
  priority: 3,
  estimatedImpact: "medium",
  citesPlaybooks: [],
  rationale: {
    whyItMatters:
      "FAQ blocks are one of the highest-viewed page zones. Placeholder text signals a rushed site and reduces trust.",
    expectedOutcome:
      "Fewer visitors bouncing to email you the questions you could have answered."
  },
  publisher: P
});

// ─── 6. CTA mismatch with growth goal ─────────────────────────
recommendationRegistry.register({
  manifestVersion: 1,
  slug: "cta-mismatch-with-goal",
  title: "Align your primary CTA with your growth goal",
  description:
    "Your growth goal implies a different primary CTA than what's currently on your site.",
  version: "1.0.0",
  dimension: "conversion",
  category: "conversion",
  scope: { trades: ["*"], countries: ["*"] },
  condition: {
    description: "cta.primary.intent differs from goal-recommended intent",
    check: (ctx) => {
      const goal = ctx.strategy.inputs.strategy.currentGoal;
      const recommended =
        goal === "bookings"
          ? "book-appointment"
          : goal === "quotes" || goal === "lead-generation"
          ? "free-survey"
          : goal === "increase-conversion-rate"
          ? "free-survey"
          : undefined;
      if (!recommended) return ok();
      const current = (ctx.strategy.get("cta", "primary") as { intent?: string } | undefined)
        ?.intent;
      if (!current || current === recommended) return ok();
      return {
        triggered: true,
        currentValue: current,
        targetValue: recommended,
        detail: `Your goal is "${goal.replace(/-/g, " ")}" but your primary CTA intent is "${current}". Similar businesses win more work with "${recommended}".`
      };
    }
  },
  action: {
    label: "Update primary CTA",
    autoFix: { handler: "regenerate-hero", confirmationRequired: true }
  },
  priority: 5,
  estimatedImpact: "high",
  citesPlaybooks: ["quote-driven"],
  citesPatterns: ["doors-carpenter-free-survey-gallery-first"],
  citesEvidence: ["free-survey-cta-carpenter-doors"],
  rationale: {
    whyItMatters:
      "The primary CTA is the single biggest conversion lever on any page. When it doesn't match the buyer's intent, the site works against you.",
    expectedOutcome:
      "Higher form submission rate on the goal your business actually needs to grow."
  },
  publisher: P
});

// ─── 7. Case studies missing customer quote ───────────────────
recommendationRegistry.register({
  manifestVersion: 1,
  slug: "case-study-missing-customer-quote",
  title: "Ask customers for a quote on each finished job",
  description:
    "Your case studies are missing customer quotes — the platform never fabricates them.",
  version: "1.0.0",
  dimension: "content-quality",
  category: "content",
  scope: { trades: ["*"], countries: ["*"] },
  condition: {
    description: "project-story blocks with no customerQuote",
    check: (ctx) => {
      const projectBlocks =
        ctx.manifest?.pages.flatMap((p) =>
          p.sections.flatMap((s) => s.blocks)
        ).filter((b) => b.kind === "project-story") ?? [];
      if (!projectBlocks.length) return ok();
      const missing = projectBlocks.filter(
        (b) => !(b.data as { customerQuote?: unknown }).customerQuote
      );
      if (!missing.length) return ok();
      return {
        triggered: true,
        currentValue: projectBlocks.length - missing.length,
        targetValue: projectBlocks.length,
        gapPercentage: Math.round((missing.length / projectBlocks.length) * 100),
        detail: `${missing.length} of your ${projectBlocks.length} case stud${
          projectBlocks.length === 1 ? "y is" : "ies are"
        } missing a customer quote. Real quotes lift enquiries — the platform won't invent them.`
      };
    }
  },
  action: {
    label: "Request customer quotes",
    autoFix: { handler: "send-review-requests" }
  },
  priority: 3,
  estimatedImpact: "medium",
  citesPlaybooks: ["portfolio-heavy"],
  rationale: {
    whyItMatters:
      "A named quote from a real customer is the highest-trust content on any site. Even one sentence outperforms three paragraphs of generic marketing copy.",
    expectedOutcome:
      "Higher time-on-page for your case studies and more downstream enquiries."
  },
  publisher: P
});

// ─── 8. Emergency response time promise missing ───────────────
recommendationRegistry.register({
  manifestVersion: 1,
  slug: "emergency-response-promise-missing",
  title: "Publish a response-time promise",
  description:
    "Emergency customers convert when they see a clear response-time promise in the hero.",
  version: "1.0.0",
  dimension: "conversion",
  category: "conversion",
  scope: {
    trades: ["*"],
    countries: ["GB", "IE"],
    profileFlags: ["emergency"]
  },
  condition: {
    description: "profile.isEmergency && trust.elements missing 'response-time-promise'",
    check: (ctx) => {
      if (!ctx.strategy.inputs.profile.isEmergency) return ok();
      const trustElements =
        (ctx.strategy.get("trust", "elements") as { list?: readonly string[] } | undefined)
          ?.list ?? [];
      if (trustElements.includes("response-time-promise")) return ok();
      return {
        triggered: true,
        detail:
          "You've positioned your business as emergency-response, but there's no visible response-time promise in the hero. Customers panicked at 2am need to know how fast you'll get there."
      };
    }
  },
  action: {
    label: "Add response-time promise",
    autoFix: { handler: "regenerate-hero" }
  },
  priority: 5,
  estimatedImpact: "high",
  citesPlaybooks: ["emergency-response"],
  citesPatterns: ["emergency-plumber-response-promise"],
  citesEvidence: ["emergency-response-time-promise-plumbers"],
  rationale: {
    whyItMatters:
      "Emergency search intent is time-critical. A visible response window ('within 60 minutes') is what converts the panicked search into a phone call.",
    expectedOutcome:
      "Higher phone-call rate from emergency search terms."
  },
  publisher: P
});

// ─── 9. Reviews below trade benchmark ─────────────────────────
recommendationRegistry.register({
  manifestVersion: 1,
  slug: "reviews-below-benchmark",
  title: "Collect more customer reviews",
  description:
    "Public review count is a top-3 factor in trade shortlist decisions.",
  version: "1.0.0",
  dimension: "trust",
  category: "trust",
  scope: { trades: ["*"], countries: ["*"] },
  condition: {
    description: "reviewCount < 10 (v1 benchmark; per-trade benchmarks in future)",
    check: (ctx) => {
      const count = ctx.reviewCount ?? 0;
      const target = 10;                            // v1 benchmark
      if (count >= target) return ok();
      const gap = target - count;
      return {
        triggered: true,
        currentValue: count,
        targetValue: target,
        gapPercentage: Math.round((gap / target) * 100),
        detail: `You have ${count} public review${
          count === 1 ? "" : "s"
        }. Similar businesses in this trade see a step-change in enquiries above 10.`
      };
    }
  },
  action: {
    label: "Send review requests",
    autoFix: { handler: "send-review-requests" }
  },
  priority: 4,
  estimatedImpact: "medium",
  citesPlaybooks: ["trust-first"],
  rationale: {
    whyItMatters:
      "Review count is a shortlist-elimination signal. Buyers filter out low-review businesses before reading a single review's content.",
    expectedOutcome:
      "More enquiries by making it past the shortlist filter."
  },
  publisher: P
});

// ─── 10. Strategy hasn't been reviewed in 90+ days ───────────
recommendationRegistry.register({
  manifestVersion: 1,
  slug: "strategy-quarterly-review-due",
  title: "Review your growth strategy",
  description:
    "It's been more than 90 days since you last reviewed your growth strategy.",
  version: "1.0.0",
  dimension: "strategy-alignment",
  category: "strategy",
  scope: { trades: ["*"], countries: ["*"] },
  condition: {
    description: "lastStrategyReviewAt older than 90 days",
    check: (ctx) => {
      if (!ctx.lastStrategyReviewAt) return ok();
      const last = new Date(ctx.lastStrategyReviewAt).getTime();
      const daysSince = Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24));
      if (daysSince < 90) return ok();
      return {
        triggered: true,
        currentValue: daysSince,
        targetValue: 90,
        detail: `You last reviewed your growth strategy ${daysSince} days ago. A lot can change in a quarter — is your focus still on the same growth goal?`
      };
    }
  },
  action: {
    label: "Review growth strategy",
    autoFix: { handler: "open-strategy-editor" }
  },
  priority: 2,
  estimatedImpact: "medium",
  rationale: {
    whyItMatters:
      "A stale growth strategy silently mis-configures the entire site. If your priorities have moved, every downstream layer keeps working on the wrong problem.",
    expectedOutcome:
      "Recalibrated site around your CURRENT priorities, not last quarter's."
  },
  publisher: P
});
