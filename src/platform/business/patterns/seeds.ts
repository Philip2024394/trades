// patternRegistry — seed patterns.
//
// Every pattern here has been extracted from ≥1 reviewed evidence
// finding. Confidence is DERIVED from underlying evidence — the
// registry recomputes on demand via patternRegistry.confidenceOf().

import { patternRegistry } from "./registry";

const P = { name: "Xrated Trades Platform", verified: true } as const;

// ─── 1. Trust above the fold ─────────────────────────────────
patternRegistry.register({
  manifestVersion: 1,
  slug: "trust-above-the-fold-general",
  title: "Trust signals above the fold",
  statement:
    "Placing insurance, certifications, and review scores above the fold correlates with higher perceived credibility and reduced bounce.",
  version: "1.0.0",
  scope: { trades: ["*"], countries: ["*"] },
  informsFacetKinds: ["trust.placement", "trust.elements"],
  supportingEvidence: ["trust-badges-above-fold-general"],
  candidacy: {
    status: "adopted",
    lastStateChangeAt: "2026-07-05",
    adoptedByPlaybooks: ["trust-first"]
  },
  quantification: undefined,
  tags: ["trust", "above-the-fold"],
  publisher: P
});

// ─── 2. Doors carpenter → free-survey CTA + gallery-first ────
patternRegistry.register({
  manifestVersion: 1,
  slug: "doors-carpenter-free-survey-gallery-first",
  title: "Doors-focused carpenters: Free Survey CTA + gallery-first",
  statement:
    "In the UK and Ireland, carpenter websites specialising in door installation predominantly use 'Book Free Survey' as the primary CTA and place their finished-project gallery ABOVE the pricing section. Observation basis: 18 top-listed Checkatrade carpenter sites, June 2026.",
  version: "1.0.0",
  scope: {
    trades: ["carpenter"],
    countries: ["GB", "IE"],
    goals: ["sell-more-doors"]
  },
  informsFacetKinds: ["cta.primary", "sections.emphasise"],
  supportingEvidence: [
    "free-survey-cta-carpenter-doors",
    "gallery-before-pricing-visual-trades"
  ],
  candidacy: {
    status: "adopted",
    lastStateChangeAt: "2026-07-05",
    adoptedByPlaybooks: ["quote-driven", "portfolio-heavy"]
  },
  quantification: {
    sampleSize: 18,
    unit: "sites"
  },
  tags: ["carpenter", "doors", "cta", "gallery"],
  publisher: P
});

// ─── 3. Emergency plumber response-time promise ──────────────
patternRegistry.register({
  manifestVersion: 1,
  slug: "emergency-plumber-response-promise",
  title: "Emergency plumber: hero response-time promise + Call Now CTA",
  statement:
    "UK emergency plumber sites that feature an explicit response-time promise (e.g. 'within 60 minutes') in the hero band consistently appear across the observed sample and are strongly associated with a Call Now primary CTA. Sample: 12 UK emergency plumber sites.",
  version: "1.0.0",
  scope: {
    trades: ["plumber"],
    countries: ["GB", "IE"],
    profileFlags: ["emergency"]
  },
  informsFacetKinds: ["hero.messageStrategy", "cta.primary"],
  supportingEvidence: [
    "emergency-response-time-promise-plumbers",
    "gas-safe-badge-plumber-trust"
  ],
  candidacy: {
    status: "adopted",
    lastStateChangeAt: "2026-07-05",
    adoptedByPlaybooks: ["emergency-response"]
  },
  quantification: {
    sampleSize: 12,
    unit: "sites"
  },
  tags: ["plumber", "emergency", "hero"],
  publisher: P
});

// ─── 4. Luxury kitchens: hide price + consultation flow ──────
patternRegistry.register({
  manifestVersion: 1,
  slug: "luxury-kitchen-consultation-first",
  title: "Luxury kitchens: hide pricing, lead with consultation booking",
  statement:
    "UK premium kitchen brands consistently hide prices and lead with a design-consultation booking flow. Peer sample: 6 UK premium kitchen brands.",
  version: "1.0.0",
  scope: {
    trades: ["kitchen-fitter"],
    countries: ["GB", "IE"],
    profileFlags: ["luxury", "premium"]
  },
  informsFacetKinds: ["pricing.display", "cta.primary", "booking.flowKind"],
  supportingEvidence: ["consultation-first-luxury-kitchens"],
  candidacy: {
    status: "adopted",
    lastStateChangeAt: "2026-07-05",
    adoptedByPlaybooks: ["premium-luxury"]
  },
  quantification: {
    sampleSize: 6,
    unit: "brands"
  },
  tags: ["kitchen-fitter", "luxury", "consultation"],
  publisher: P
});
