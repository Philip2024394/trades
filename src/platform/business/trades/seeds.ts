// tradeIntelligenceRegistry — 5 seed trades.
//
// EVIDENCE HONESTY:
//   All seeds ship with evidence.strength = "anecdotal" and
//   confidence = 60. These represent v1 platform-authored
//   knowledge from public UK trade sources + accumulated platform
//   experience. They are NOT validated against merchant outcomes.
//   Numbers like averageJobValue are OMITTED when uncertain rather
//   than fabricated. Real numbers arrive via Phase 2 Industry
//   Research + Phase 5 Evidence & Outcome Engine.

import { tradeIntelligenceRegistry } from "./registry";

const P = { name: "Xrated Trades Platform", verified: true } as const;

const V1_EVIDENCE = {
  confidence: 60,
  strength: "anecdotal" as const,
  sampleSize: 0,
  marketsValidated: ["GB", "IE"],
  sources: [
    "Platform-authored v1 from public UK trade guides, Checkatrade / Trustpilot benchmarks, accumulated Xrated Trades merchant conversations"
  ],
  lastReviewed: "2026-07-05"
};

// ─── 1. Carpenter ────────────────────────────────────────────
tradeIntelligenceRegistry.register({
  manifestVersion: 1,
  slug: "carpenter",
  name: "Carpenter",
  description:
    "Trade knowledge for carpenters: doors, kitchens, wardrobes, decking, joinery, small repairs.",
  version: "1.0.0",
  countries: ["GB", "IE"],
  aliases: ["carpentry", "joiner", "joinery"],
  businessGoals: [
    {
      slug: "sell-more-doors",
      label: "Sell more doors",
      pushesServices: ["door-installation", "fire-doors", "internal-doors", "composite-doors"],
      impliesPlaybooks: ["quote-driven", "trust-first", "portfolio-heavy"]
    },
    {
      slug: "sell-more-kitchens",
      label: "Sell more kitchens",
      pushesServices: ["kitchen-fitting"],
      impliesPlaybooks: ["premium-luxury", "portfolio-heavy", "quote-driven"]
    },
    {
      slug: "sell-more-wardrobes",
      label: "Sell more fitted wardrobes",
      pushesServices: ["fitted-wardrobes"],
      impliesPlaybooks: ["portfolio-heavy", "quote-driven"]
    },
    {
      slug: "sell-more-decking",
      label: "Sell more decking",
      pushesServices: ["decking"],
      impliesPlaybooks: ["before-after", "portfolio-heavy"]
    },
    {
      slug: "increase-maintenance",
      label: "Increase maintenance work",
      pushesServices: ["small-repairs"],
      impliesPlaybooks: ["local-seo", "trust-first"]
    },
    {
      slug: "increase-commercial",
      label: "Increase commercial work",
      pushesServices: ["commercial-fit-out"],
      impliesPlaybooks: ["commercial-focus", "high-margin-focus"]
    }
  ],
  services: [
    { slug: "door-installation", label: "Door installation", margin: "high", requiresSurvey: true },
    { slug: "fire-doors", label: "Fire door installation", margin: "high", regulated: true, requiresSurvey: true },
    { slug: "internal-doors", label: "Internal doors", margin: "high", requiresSurvey: true },
    { slug: "composite-doors", label: "Composite doors", margin: "high", requiresSurvey: true, packagePriced: true },
    { slug: "kitchen-fitting", label: "Kitchen fitting", margin: "high", requiresSurvey: true },
    { slug: "fitted-wardrobes", label: "Fitted wardrobes", margin: "high", requiresSurvey: true },
    { slug: "decking", label: "Decking", margin: "medium", requiresSurvey: true },
    { slug: "flooring", label: "Flooring", margin: "medium" },
    { slug: "commercial-fit-out", label: "Commercial fit-out", margin: "high", requiresSurvey: true },
    { slug: "small-repairs", label: "Small repairs", margin: "low" }
  ],
  trustBuilders: [
    "years-trading",
    "insurance",
    "before-after",
    "workshop-photos",
    "van-branded",
    "team-photos",
    "guarantees",
    "certifications"
  ],
  imageStrategy: {
    priorityOrder: [
      "hero",
      "finished-work",
      "before-after",
      "process",
      "team",
      "van",
      "workshop"
    ],
    galleryMix: {
      "finished-work": 70,
      process: 20,
      team: 10
    },
    requiresBeforeAfter: true,
    requiresProcess: true,
    minFinishedWorkPhotos: 8
  },
  pricingPresentation: "guide",
  primaryCta: "Book Free Survey",
  contentFlow: {
    servicesPlacement: "after-hero",
    galleryPlacement: "after-services",
    testimonialsPlacement: "after-gallery",
    pricingPlacement: "after-services",
    faqPlacement: "after-pricing",
    contactPlacement: "before-faq"
  },
  seoKeywordTemplates: [
    { template: "{service} {location}", intent: "local", priority: 1 },
    { template: "{service} installation {location}", intent: "commercial", priority: 2 },
    { template: "carpenter {location}", intent: "local", priority: 1 },
    { template: "fire door installation {location}", services: ["fire-doors"], intent: "commercial", priority: 1 },
    { template: "composite doors {location}", services: ["composite-doors"], intent: "commercial", priority: 2 },
    { template: "internal doors {location}", services: ["internal-doors"], intent: "commercial", priority: 3 },
    { template: "bespoke joinery {location}", intent: "informational", priority: 3 }
  ],
  commonFaqs: [
    { question: "Do you supply the doors or do I need to buy them?", services: ["door-installation", "fire-doors", "internal-doors", "composite-doors"] },
    { question: "How long does a typical door installation take?" },
    { question: "Are you fully insured?" },
    { question: "Do you offer any guarantee on your work?" },
    { question: "Do you clean up after the job?" },
    { question: "Can you fit fire doors to Building Regulations?", services: ["fire-doors"] },
    { question: "What areas do you cover?" }
  ],
  commonObjections: [
    {
      objection: "Your quote is more expensive than others.",
      counter:
        "Present certifications + guarantees + workshop credentials — position on quality, not price."
    },
    {
      objection: "Can you do the job next week?",
      counter:
        "Publish a next-available date band and be honest about lead time — buyers respect straight answers."
    },
    {
      objection: "How do I know you'll turn up?",
      counter:
        "Foreground reviews mentioning punctuality and van livery photos."
    }
  ],
  buyingJourney: {
    stages: [
      "awareness",
      "research",
      "shortlist",
      "consultation",
      "quote-received",
      "decision",
      "job-active",
      "post-completion"
    ],
    multipleQuotes: true
  },
  seasonality: [
    { monthIndex: 0, demandIndex: 45 },
    { monthIndex: 1, demandIndex: 50 },
    { monthIndex: 2, demandIndex: 60 },
    { monthIndex: 3, demandIndex: 70, label: "Spring uplift" },
    { monthIndex: 4, demandIndex: 80 },
    { monthIndex: 5, demandIndex: 85, label: "Peak — decking + garden joinery" },
    { monthIndex: 6, demandIndex: 80 },
    { monthIndex: 7, demandIndex: 70 },
    { monthIndex: 8, demandIndex: 65 },
    { monthIndex: 9, demandIndex: 60 },
    { monthIndex: 10, demandIndex: 55, label: "Kitchen enquiries rise (Christmas cook-off)" },
    { monthIndex: 11, demandIndex: 40, label: "Quiet Dec — plan new-year push" }
  ],
  positioningModifiers: {
    luxury: {
      primaryCta: "Book Consultation",
      pricingPresentation: "hidden",
      extraTrustBuilders: ["accreditations", "case-studies"],
      extraPlaybooks: ["premium-luxury"],
      galleryMix: { "finished-work": 85, process: 10, team: 5 }
    },
    commercial: {
      primaryCta: "Request Trade Quote",
      extraTrustBuilders: ["case-studies", "public-liability", "safe-contractor"],
      extraPlaybooks: ["commercial-focus"]
    },
    emergency: {
      primaryCta: "Call for Emergency Boarding-up",
      extraPlaybooks: ["emergency-response"]
    }
  },
  compliance: {
    typicalCertifications: ["City & Guilds Carpentry", "CSCS card", "FIRAS (fire doors)"],
    requiresPublicLiabilityDisplay: true,
    audienceExpectedBadges: ["Checkatrade", "Trustpilot"]
  },
  evidence: V1_EVIDENCE,
  publisher: P
});

// ─── 2. Electrician ──────────────────────────────────────────
tradeIntelligenceRegistry.register({
  manifestVersion: 1,
  slug: "electrician",
  name: "Electrician",
  description:
    "Trade knowledge for electricians: fault finding, EICR, fuse boards, rewires, emergency call-outs.",
  version: "1.0.0",
  countries: ["GB", "IE"],
  aliases: ["sparks", "electrical"],
  businessGoals: [
    {
      slug: "increase-emergency",
      label: "Increase 24-hour emergency callouts",
      pushesServices: ["emergency-callout", "fault-finding"],
      impliesPlaybooks: ["emergency-response", "local-seo"]
    },
    {
      slug: "grow-eicr",
      label: "Grow EICR + landlord certificates",
      pushesServices: ["eicr", "landlord-certificates"],
      impliesPlaybooks: ["quote-driven", "local-seo"]
    },
    {
      slug: "sell-more-fuse-boards",
      label: "Sell more fuse-board upgrades",
      pushesServices: ["fuse-board-upgrade"],
      impliesPlaybooks: ["quote-driven", "trust-first"]
    },
    {
      slug: "grow-ev-chargers",
      label: "Grow EV charger installations",
      pushesServices: ["ev-charger-install"],
      impliesPlaybooks: ["quote-driven", "high-margin-focus"]
    },
    {
      slug: "increase-commercial",
      label: "Increase commercial work",
      pushesServices: ["commercial-electrical"],
      impliesPlaybooks: ["commercial-focus"]
    }
  ],
  services: [
    { slug: "emergency-callout", label: "24-hour emergency callout", margin: "high" },
    { slug: "fault-finding", label: "Fault finding", margin: "high" },
    { slug: "eicr", label: "EICR (electrical safety report)", margin: "medium", regulated: true, packagePriced: true },
    { slug: "landlord-certificates", label: "Landlord certificates", margin: "medium", regulated: true, packagePriced: true },
    { slug: "fuse-board-upgrade", label: "Fuse-board upgrade", margin: "high", requiresSurvey: true },
    { slug: "rewire", label: "Full rewire", margin: "high", requiresSurvey: true },
    { slug: "ev-charger-install", label: "EV charger installation", margin: "high", requiresSurvey: true, regulated: true },
    { slug: "commercial-electrical", label: "Commercial electrical", margin: "high", requiresSurvey: true },
    { slug: "socket-install", label: "Extra sockets", margin: "low" }
  ],
  trustBuilders: [
    "certifications",
    "insurance",
    "years-trading",
    "response-time-promise",
    "van-branded",
    "no-callout-fee",
    "guarantees",
    "safe-contractor"
  ],
  imageStrategy: {
    priorityOrder: [
      "hero",
      "van",
      "certificate",
      "finished-work",
      "team",
      "process"
    ],
    galleryMix: {
      "finished-work": 40,
      certificate: 20,
      van: 20,
      team: 20
    },
    requiresBeforeAfter: false,
    requiresProcess: false,
    minFinishedWorkPhotos: 4
  },
  pricingPresentation: "package",
  primaryCta: "Call Now",
  contentFlow: {
    servicesPlacement: "after-hero",
    galleryPlacement: "after-services",
    testimonialsPlacement: "after-gallery",
    pricingPlacement: "after-services",
    faqPlacement: "after-pricing",
    contactPlacement: "in-hero"
  },
  seoKeywordTemplates: [
    { template: "emergency electrician {location}", services: ["emergency-callout"], intent: "urgent", priority: 1 },
    { template: "24 hour electrician {location}", services: ["emergency-callout"], intent: "urgent", priority: 1 },
    { template: "electrician {location}", intent: "local", priority: 1 },
    { template: "EICR {location}", services: ["eicr"], intent: "commercial", priority: 2 },
    { template: "landlord certificate {location}", services: ["landlord-certificates"], intent: "commercial", priority: 2 },
    { template: "fuse board replacement {location}", services: ["fuse-board-upgrade"], intent: "commercial", priority: 2 },
    { template: "EV charger installation {location}", services: ["ev-charger-install"], intent: "commercial", priority: 2 }
  ],
  commonFaqs: [
    { question: "Are you Part P registered?" },
    { question: "How quickly can you attend an emergency?", services: ["emergency-callout"] },
    { question: "Do you charge a call-out fee?" },
    { question: "Do you issue a certificate after the work?", services: ["eicr", "landlord-certificates", "rewire"] },
    { question: "How long does an EICR take?", services: ["eicr"] },
    { question: "Do you provide receipts for landlords?" }
  ],
  commonObjections: [
    {
      objection: "How do I know you're qualified?",
      counter:
        "Foreground NICEIC / NAPIT registration + Part P badges in the hero band."
    },
    {
      objection: "Is there a call-out charge if you can't fix it?",
      counter:
        "State the no-fix-no-fee policy above the fold — this converts."
    }
  ],
  buyingJourney: {
    stages: ["awareness", "shortlist", "consultation", "quote-received", "decision", "job-active"],
    multipleQuotes: false
  },
  seasonality: [
    { monthIndex: 0, demandIndex: 55, label: "Cold snap boiler + heating faults" },
    { monthIndex: 1, demandIndex: 60 },
    { monthIndex: 2, demandIndex: 60 },
    { monthIndex: 3, demandIndex: 55 },
    { monthIndex: 4, demandIndex: 50 },
    { monthIndex: 5, demandIndex: 55 },
    { monthIndex: 6, demandIndex: 60 },
    { monthIndex: 7, demandIndex: 55 },
    { monthIndex: 8, demandIndex: 60, label: "EICR rush before new tenants" },
    { monthIndex: 9, demandIndex: 65 },
    { monthIndex: 10, demandIndex: 70, label: "Winter heating faults" },
    { monthIndex: 11, demandIndex: 65 }
  ],
  positioningModifiers: {
    emergency: {
      primaryCta: "Call Now",
      extraTrustBuilders: ["response-time-promise", "no-callout-fee"],
      extraPlaybooks: ["emergency-response"]
    },
    commercial: {
      primaryCta: "Request Commercial Quote",
      extraTrustBuilders: ["safe-contractor", "public-liability", "employer-liability"],
      extraPlaybooks: ["commercial-focus"]
    },
    luxury: {
      primaryCta: "Book Consultation",
      pricingPresentation: "hidden",
      extraPlaybooks: ["premium-luxury"]
    }
  },
  compliance: {
    typicalCertifications: ["NICEIC", "NAPIT", "ELECSA", "Part P"],
    requiresPublicLiabilityDisplay: true,
    audienceExpectedBadges: ["NICEIC", "TrustMark"]
  },
  evidence: V1_EVIDENCE,
  publisher: P
});

// ─── 3. Plumber ──────────────────────────────────────────────
tradeIntelligenceRegistry.register({
  manifestVersion: 1,
  slug: "plumber",
  name: "Plumber",
  description:
    "Trade knowledge for plumbers: emergency leaks, boiler installs, bathrooms, gas safe.",
  version: "1.0.0",
  countries: ["GB", "IE"],
  aliases: ["plumbing", "heating-engineer"],
  businessGoals: [
    {
      slug: "increase-emergency",
      label: "Increase emergency callouts",
      pushesServices: ["emergency-callout", "leak-repair", "burst-pipe"],
      impliesPlaybooks: ["emergency-response", "local-seo"]
    },
    {
      slug: "grow-boiler-installs",
      label: "Grow boiler installations",
      pushesServices: ["boiler-installation", "boiler-repair"],
      impliesPlaybooks: ["quote-driven", "high-margin-focus", "trust-first"]
    },
    {
      slug: "grow-bathrooms",
      label: "Grow bathroom installations",
      pushesServices: ["bathroom-installation"],
      impliesPlaybooks: ["portfolio-heavy", "quote-driven", "before-after"]
    }
  ],
  services: [
    { slug: "emergency-callout", label: "Emergency callout", margin: "high" },
    { slug: "leak-repair", label: "Leak repair", margin: "medium" },
    { slug: "burst-pipe", label: "Burst pipe", margin: "high" },
    { slug: "boiler-installation", label: "Boiler installation", margin: "high", regulated: true, requiresSurvey: true, packagePriced: true },
    { slug: "boiler-repair", label: "Boiler repair", margin: "medium", regulated: true },
    { slug: "bathroom-installation", label: "Bathroom installation", margin: "high", requiresSurvey: true },
    { slug: "power-flush", label: "Power flush", margin: "medium", packagePriced: true },
    { slug: "toilet-repair", label: "Toilet repair", margin: "low" }
  ],
  trustBuilders: [
    "certifications",
    "years-trading",
    "insurance",
    "response-time-promise",
    "van-branded",
    "no-callout-fee",
    "guarantees"
  ],
  imageStrategy: {
    priorityOrder: [
      "hero",
      "van",
      "before-after",
      "finished-work",
      "certificate",
      "team",
      "process"
    ],
    galleryMix: {
      "finished-work": 50,
      "before-after": 25,
      van: 15,
      certificate: 10
    },
    requiresBeforeAfter: true,
    requiresProcess: false,
    minFinishedWorkPhotos: 6
  },
  pricingPresentation: "package",
  primaryCta: "Call Now",
  contentFlow: {
    servicesPlacement: "after-hero",
    galleryPlacement: "after-services",
    testimonialsPlacement: "after-gallery",
    pricingPlacement: "after-services",
    faqPlacement: "after-pricing",
    contactPlacement: "in-hero"
  },
  seoKeywordTemplates: [
    { template: "emergency plumber {location}", services: ["emergency-callout", "burst-pipe"], intent: "urgent", priority: 1 },
    { template: "24 hour plumber {location}", services: ["emergency-callout"], intent: "urgent", priority: 1 },
    { template: "plumber {location}", intent: "local", priority: 1 },
    { template: "boiler installation {location}", services: ["boiler-installation"], intent: "commercial", priority: 2 },
    { template: "boiler repair {location}", services: ["boiler-repair"], intent: "commercial", priority: 2 },
    { template: "bathroom installation {location}", services: ["bathroom-installation"], intent: "commercial", priority: 2 },
    { template: "burst pipe {location}", services: ["burst-pipe"], intent: "urgent", priority: 1 }
  ],
  commonFaqs: [
    { question: "Are you Gas Safe registered?" },
    { question: "How quickly can you attend an emergency?", services: ["emergency-callout", "burst-pipe"] },
    { question: "Do you charge a call-out fee?" },
    { question: "What guarantee do you provide on new boilers?", services: ["boiler-installation"] },
    { question: "How long does a boiler installation take?", services: ["boiler-installation"] },
    { question: "Do you supply the boiler?", services: ["boiler-installation", "boiler-repair"] }
  ],
  commonObjections: [
    {
      objection: "How much will an emergency callout cost?",
      counter: "Publish a clear callout fee band above the fold; no hidden charges."
    },
    {
      objection: "Are you actually available at 3am?",
      counter: "Show recent testimonials mentioning out-of-hours response times."
    }
  ],
  buyingJourney: {
    stages: ["awareness", "shortlist", "quote-received", "decision", "job-active"],
    multipleQuotes: false
  },
  seasonality: [
    { monthIndex: 0, demandIndex: 90, label: "Cold snap — burst pipes + boiler faults" },
    { monthIndex: 1, demandIndex: 85 },
    { monthIndex: 2, demandIndex: 70 },
    { monthIndex: 3, demandIndex: 55 },
    { monthIndex: 4, demandIndex: 50 },
    { monthIndex: 5, demandIndex: 45 },
    { monthIndex: 6, demandIndex: 45 },
    { monthIndex: 7, demandIndex: 50 },
    { monthIndex: 8, demandIndex: 55 },
    { monthIndex: 9, demandIndex: 65, label: "Boiler service push" },
    { monthIndex: 10, demandIndex: 80 },
    { monthIndex: 11, demandIndex: 85, label: "Winter emergencies" }
  ],
  positioningModifiers: {
    emergency: {
      primaryCta: "Call Now",
      extraTrustBuilders: ["response-time-promise", "no-callout-fee"],
      extraPlaybooks: ["emergency-response"]
    },
    residential: {
      extraTrustBuilders: ["guarantees", "years-trading"],
      extraPlaybooks: ["residential-focus"]
    },
    luxury: {
      primaryCta: "Book Bathroom Consultation",
      pricingPresentation: "hidden",
      extraPlaybooks: ["premium-luxury"]
    }
  },
  compliance: {
    typicalCertifications: ["Gas Safe", "OFTEC", "CIPHE"],
    requiresPublicLiabilityDisplay: true,
    audienceExpectedBadges: ["Gas Safe", "TrustMark"]
  },
  evidence: V1_EVIDENCE,
  publisher: P
});

// ─── 4. Kitchen fitter (luxury-leaning) ──────────────────────
tradeIntelligenceRegistry.register({
  manifestVersion: 1,
  slug: "kitchen-fitter",
  name: "Kitchen fitter",
  description:
    "Trade knowledge for kitchen fitters: bespoke design, showroom appointments, high-value installs.",
  version: "1.0.0",
  countries: ["GB", "IE"],
  aliases: ["kitchen-installer", "kitchen-company"],
  businessGoals: [
    {
      slug: "grow-bespoke",
      label: "Grow bespoke kitchen sales",
      pushesServices: ["bespoke-kitchen"],
      impliesPlaybooks: ["premium-luxury", "portfolio-heavy"]
    },
    {
      slug: "fill-showroom",
      label: "Fill showroom appointments",
      pushesServices: ["design-consultation"],
      impliesPlaybooks: ["premium-luxury", "trust-first"]
    },
    {
      slug: "grow-repeat-referrals",
      label: "Grow repeat + referrals",
      pushesServices: ["bespoke-kitchen"],
      impliesPlaybooks: ["portfolio-heavy", "before-after"]
    }
  ],
  services: [
    { slug: "bespoke-kitchen", label: "Bespoke kitchen", margin: "high", requiresSurvey: true },
    { slug: "shaker-kitchen", label: "Shaker kitchen", margin: "high", requiresSurvey: true, packagePriced: true },
    { slug: "modern-kitchen", label: "Contemporary kitchen", margin: "high", requiresSurvey: true, packagePriced: true },
    { slug: "design-consultation", label: "Design consultation", margin: "medium" },
    { slug: "kitchen-supply-only", label: "Supply-only kitchen", margin: "medium" }
  ],
  trustBuilders: [
    "years-trading",
    "accreditations",
    "case-studies",
    "before-after",
    "insurance",
    "guarantees"
  ],
  imageStrategy: {
    priorityOrder: [
      "hero",
      "showroom",
      "finished-work",
      "before-after",
      "team",
      "process"
    ],
    galleryMix: {
      "finished-work": 60,
      showroom: 20,
      "before-after": 20
    },
    requiresBeforeAfter: true,
    requiresProcess: false,
    minFinishedWorkPhotos: 12
  },
  pricingPresentation: "hidden",
  primaryCta: "Book Design Consultation",
  contentFlow: {
    servicesPlacement: "after-hero",
    galleryPlacement: "after-services",
    testimonialsPlacement: "after-gallery",
    pricingPlacement: "after-faq",
    faqPlacement: "after-gallery",
    contactPlacement: "footer"
  },
  seoKeywordTemplates: [
    { template: "bespoke kitchens {location}", services: ["bespoke-kitchen"], intent: "commercial", priority: 1 },
    { template: "kitchen showroom {location}", services: ["design-consultation"], intent: "commercial", priority: 1 },
    { template: "kitchen designer {location}", intent: "commercial", priority: 2 },
    { template: "shaker kitchens {location}", services: ["shaker-kitchen"], intent: "commercial", priority: 2 },
    { template: "modern kitchens {location}", services: ["modern-kitchen"], intent: "commercial", priority: 2 },
    { template: "kitchen fitters {location}", intent: "local", priority: 3 }
  ],
  commonFaqs: [
    { question: "How much does a bespoke kitchen cost?", services: ["bespoke-kitchen"] },
    { question: "What's included in a design consultation?", services: ["design-consultation"] },
    { question: "How long from order to installation?", services: ["bespoke-kitchen", "shaker-kitchen", "modern-kitchen"] },
    { question: "Can I see your showroom?" },
    { question: "Do you handle plumbing and electrical?" },
    { question: "What guarantee do you offer?" }
  ],
  commonObjections: [
    {
      objection: "Your prices are higher than the high-street brands.",
      counter:
        "Lead with materials + longevity + designer-service comparisons; hide the number, sell the outcome."
    },
    {
      objection: "How do I know it will match my vision?",
      counter:
        "Foreground before/after gallery pairs + designer bios."
    }
  ],
  buyingJourney: {
    stages: [
      "awareness",
      "research",
      "shortlist",
      "consultation",
      "quote-received",
      "decision",
      "job-active",
      "post-completion"
    ],
    multipleQuotes: true
  },
  seasonality: [
    { monthIndex: 0, demandIndex: 65, label: "New-year showroom traffic" },
    { monthIndex: 1, demandIndex: 70 },
    { monthIndex: 2, demandIndex: 75 },
    { monthIndex: 3, demandIndex: 75 },
    { monthIndex: 4, demandIndex: 70 },
    { monthIndex: 5, demandIndex: 60 },
    { monthIndex: 6, demandIndex: 55 },
    { monthIndex: 7, demandIndex: 55 },
    { monthIndex: 8, demandIndex: 65 },
    { monthIndex: 9, demandIndex: 75, label: "Pre-Christmas push — decision phase" },
    { monthIndex: 10, demandIndex: 70 },
    { monthIndex: 11, demandIndex: 45, label: "Quiet Dec" }
  ],
  positioningModifiers: {
    luxury: {
      primaryCta: "Book Private Consultation",
      pricingPresentation: "hidden",
      extraTrustBuilders: ["accreditations", "case-studies"],
      extraPlaybooks: ["premium-luxury"]
    },
    premium: {
      primaryCta: "Book Showroom Visit",
      extraPlaybooks: ["portfolio-heavy"]
    },
    residential: {
      extraPlaybooks: ["residential-focus"]
    }
  },
  compliance: {
    typicalCertifications: ["KBSA", "BiKBBI"],
    requiresPublicLiabilityDisplay: true,
    audienceExpectedBadges: ["KBSA", "TrustMark"]
  },
  evidence: V1_EVIDENCE,
  publisher: P
});

// ─── 5. Restaurant ───────────────────────────────────────────
// Very different shape from tradesmen — showcases that the manifest
// is elastic enough for hospitality without inventing a second schema.
tradeIntelligenceRegistry.register({
  manifestVersion: 1,
  slug: "restaurant",
  name: "Restaurant",
  description:
    "Hospitality knowledge for restaurants: menus, reservations, opening hours, table bookings.",
  version: "1.0.0",
  countries: ["GB", "IE"],
  aliases: ["cafe", "bistro", "eatery"],
  businessGoals: [
    {
      slug: "fill-tables",
      label: "Fill tables — increase reservations",
      pushesServices: ["reservation"],
      impliesPlaybooks: ["portfolio-heavy", "local-seo"]
    },
    {
      slug: "grow-events",
      label: "Grow private events + functions",
      pushesServices: ["private-hire", "events"],
      impliesPlaybooks: ["portfolio-heavy", "premium-luxury"]
    },
    {
      slug: "grow-takeaway",
      label: "Grow takeaway + delivery",
      pushesServices: ["takeaway", "delivery"],
      impliesPlaybooks: ["local-seo"]
    }
  ],
  services: [
    { slug: "reservation", label: "Table reservation", margin: "medium" },
    { slug: "private-hire", label: "Private hire", margin: "high", requiresSurvey: true },
    { slug: "events", label: "Events", margin: "high", requiresSurvey: true },
    { slug: "takeaway", label: "Takeaway", margin: "medium" },
    { slug: "delivery", label: "Delivery", margin: "medium" }
  ],
  trustBuilders: [
    "case-studies",
    "years-trading",
    "before-after"
  ],
  imageStrategy: {
    priorityOrder: [
      "hero",
      "interior",
      "menu",
      "chef",
      "team"
    ],
    galleryMix: {
      "interior": 40,
      menu: 30,
      chef: 20,
      team: 10
    },
    requiresBeforeAfter: false,
    requiresProcess: false,
    minFinishedWorkPhotos: 10
  },
  pricingPresentation: "menu",
  primaryCta: "Book a Table",
  contentFlow: {
    servicesPlacement: "after-hero",
    galleryPlacement: "after-services",
    testimonialsPlacement: "after-gallery",
    pricingPlacement: "after-services",
    faqPlacement: "after-pricing",
    contactPlacement: "footer"
  },
  seoKeywordTemplates: [
    { template: "restaurants in {location}", intent: "local", priority: 1 },
    { template: "restaurant near me", intent: "local", priority: 1 },
    { template: "best {cuisine} restaurant {location}", intent: "local", priority: 2 },
    { template: "private dining {location}", services: ["private-hire"], intent: "commercial", priority: 2 },
    { template: "restaurant with private room {location}", services: ["private-hire"], intent: "commercial", priority: 3 },
    { template: "takeaway {location}", services: ["takeaway"], intent: "local", priority: 3 }
  ],
  locationPageHints: ["town", "neighbourhood"],
  commonFaqs: [
    { question: "Do you take walk-ins?" },
    { question: "Do you cater for dietary requirements?" },
    { question: "Is there parking nearby?" },
    { question: "Do you offer private hire?", services: ["private-hire"] },
    { question: "What are your opening hours?" },
    { question: "Can we bring children?" }
  ],
  commonObjections: [
    {
      objection: "I've never eaten here before — is the food good?",
      counter: "Foreground recent 5-star reviews with dish names + chef intros."
    },
    {
      objection: "Is it kid-friendly?",
      counter: "Show family testimonials + interior photos including kids."
    }
  ],
  buyingJourney: {
    stages: ["awareness", "research", "decision"],
    multipleQuotes: false
  },
  seasonality: [
    { monthIndex: 0, demandIndex: 45 },
    { monthIndex: 1, demandIndex: 60, label: "Valentine's push" },
    { monthIndex: 2, demandIndex: 55 },
    { monthIndex: 3, demandIndex: 60 },
    { monthIndex: 4, demandIndex: 65, label: "Mother's Day" },
    { monthIndex: 5, demandIndex: 75 },
    { monthIndex: 6, demandIndex: 80, label: "Summer terrace" },
    { monthIndex: 7, demandIndex: 80 },
    { monthIndex: 8, demandIndex: 70 },
    { monthIndex: 9, demandIndex: 65 },
    { monthIndex: 10, demandIndex: 75, label: "Christmas parties booking" },
    { monthIndex: 11, demandIndex: 95, label: "Christmas peak" }
  ],
  positioningModifiers: {
    luxury: {
      primaryCta: "Reserve Table",
      pricingPresentation: "hidden",
      extraPlaybooks: ["premium-luxury"]
    },
    residential: {
      extraPlaybooks: ["residential-focus"]
    }
  },
  compliance: {
    typicalCertifications: ["Food Hygiene Rating 5", "Allergen Awareness"],
    requiresPublicLiabilityDisplay: false,
    audienceExpectedBadges: ["Food Hygiene 5", "Trip Advisor"]
  },
  evidence: V1_EVIDENCE,
  publisher: P
});
