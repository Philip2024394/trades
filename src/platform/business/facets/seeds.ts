// facetKindRegistry — initial facet kinds.
//
// Every kind declares its domain, field, owner Business OS layer, and
// merge strategy. Playbooks contribute to these; StrategyResolver
// merges contributions into a typed ResolvedStrategy tree.

import { facetKindRegistry } from "./registry";

// ─── Gallery (Section layer 8) ────────────────────────────────
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "gallery.style",
  name: "Gallery style",
  description: "Visual arrangement of the project gallery.",
  version: "1.0.0",
  ownerLayer: 8,
  domain: "gallery",
  field: "style",
  mergeStrategy: "highest-confidence"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "gallery.minImages",
  name: "Gallery min images",
  description: "Minimum number of gallery images.",
  version: "1.0.0",
  ownerLayer: 8,
  domain: "gallery",
  field: "minImages",
  mergeStrategy: "override"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "gallery.captionRules",
  name: "Gallery caption rules",
  description: "Which caption facets each project image displays.",
  version: "1.0.0",
  ownerLayer: 8,
  domain: "gallery",
  field: "captionRules",
  mergeStrategy: "union"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "gallery.requiresBeforeAfter",
  name: "Gallery requires before/after",
  description: "Whether the gallery requires before/after image pairs.",
  version: "1.0.0",
  ownerLayer: 8,
  domain: "gallery",
  field: "requiresBeforeAfter",
  mergeStrategy: "override"
});

// ─── Pricing (Section layer 8) ────────────────────────────────
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "pricing.display",
  name: "Pricing display mode",
  description: "How prices are displayed (hidden / guide / fixed / from / package).",
  version: "1.0.0",
  ownerLayer: 8,
  domain: "pricing",
  field: "display",
  mergeStrategy: "highest-confidence"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "pricing.highlight",
  name: "Pricing highlight",
  description: "Services to highlight in pricing sections.",
  version: "1.0.0",
  ownerLayer: 8,
  domain: "pricing",
  field: "highlight",
  mergeStrategy: "union"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "pricing.hide",
  name: "Pricing hide",
  description: "Services to hide from pricing sections.",
  version: "1.0.0",
  ownerLayer: 8,
  domain: "pricing",
  field: "hide",
  mergeStrategy: "union"
});

// ─── CTA (Component layer 9) ──────────────────────────────────
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "cta.primary",
  name: "Primary CTA",
  description: "Primary call-to-action label + intent.",
  version: "1.0.0",
  ownerLayer: 9,
  domain: "cta",
  field: "primary",
  mergeStrategy: "highest-confidence"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "cta.secondary",
  name: "Secondary CTA",
  description: "Secondary call-to-action label + intent.",
  version: "1.0.0",
  ownerLayer: 9,
  domain: "cta",
  field: "secondary",
  mergeStrategy: "highest-confidence"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "cta.placement",
  name: "CTA placement",
  description: "Where CTAs appear (hero / trust-bar / floating / footer).",
  version: "1.0.0",
  ownerLayer: 9,
  domain: "cta",
  field: "placement",
  mergeStrategy: "union"
});

// ─── SEO (AI layer 15) ────────────────────────────────────────
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "seo.pageKinds",
  name: "SEO page kinds",
  description: "Which SEO page kinds to generate (town / county / service-area / etc.).",
  version: "1.0.0",
  ownerLayer: 15,
  domain: "seo",
  field: "pageKinds",
  mergeStrategy: "union"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "seo.locationStrategy",
  name: "SEO location strategy",
  description: "Which location strategy to apply (town-only, hybrid, service-area-only).",
  version: "1.0.0",
  ownerLayer: 15,
  domain: "seo",
  field: "locationStrategy",
  mergeStrategy: "highest-confidence"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "seo.keywordEmphasis",
  name: "SEO keyword emphasis",
  description: "Prioritised keyword themes for SEO copy generation.",
  version: "1.0.0",
  ownerLayer: 15,
  domain: "seo",
  field: "keywordEmphasis",
  mergeStrategy: "union"
});

// ─── Trust (Section layer 8) ──────────────────────────────────
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "trust.placement",
  name: "Trust placement",
  description: "Where trust signals appear on the page.",
  version: "1.0.0",
  ownerLayer: 8,
  domain: "trust",
  field: "placement",
  mergeStrategy: "union"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "trust.elements",
  name: "Trust elements",
  description: "Which trust elements to surface (insurance, guarantees, reviews, years-trading, etc.).",
  version: "1.0.0",
  ownerLayer: 8,
  domain: "trust",
  field: "elements",
  mergeStrategy: "union"
});

// ─── Hero (Section layer 8) ───────────────────────────────────
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "hero.style",
  name: "Hero style",
  description: "Which hero pattern to prefer.",
  version: "1.0.0",
  ownerLayer: 8,
  domain: "hero",
  field: "style",
  mergeStrategy: "highest-confidence"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "hero.messageStrategy",
  name: "Hero message strategy",
  description: "Intent for the hero headline (playbooks own intent, not copy).",
  version: "1.0.0",
  ownerLayer: 8,
  domain: "hero",
  field: "messageStrategy",
  mergeStrategy: "highest-confidence"
});

// ─── Marketing (Automation layer 16) ──────────────────────────
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "marketing.upsellMoments",
  name: "Marketing upsell moments",
  description: "Trigger points for upsell campaigns.",
  version: "1.0.0",
  ownerLayer: 16,
  domain: "marketing",
  field: "upsellMoments",
  mergeStrategy: "union"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "marketing.campaignTypes",
  name: "Marketing campaign types",
  description: "Which campaign templates to seed for this business.",
  version: "1.0.0",
  ownerLayer: 16,
  domain: "marketing",
  field: "campaignTypes",
  mergeStrategy: "union"
});

// ─── Sections (Section layer 8) ───────────────────────────────
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "sections.emphasise",
  name: "Section role emphasis",
  description: "Which section roles the playbook emphasises in the sequence.",
  version: "1.0.0",
  ownerLayer: 8,
  domain: "sections",
  field: "emphasise",
  mergeStrategy: "union"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "sections.exclude",
  name: "Section role exclusion",
  description: "Section roles this playbook wants excluded.",
  version: "1.0.0",
  ownerLayer: 8,
  domain: "sections",
  field: "exclude",
  mergeStrategy: "union"
});

// ─── Theme (Theme layer 3) ────────────────────────────────────
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "theme.preferredMode",
  name: "Theme mode preference",
  description: "Light or dark theme preference.",
  version: "1.0.0",
  ownerLayer: 3,
  domain: "theme",
  field: "preferredMode",
  mergeStrategy: "highest-confidence"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "theme.preferredMotion",
  name: "Theme motion preference",
  description: "Motion tempo preference (restrained / standard / expressive).",
  version: "1.0.0",
  ownerLayer: 3,
  domain: "theme",
  field: "preferredMotion",
  mergeStrategy: "highest-confidence"
});

// ─── Automation (Automation layer 16) ─────────────────────────
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "automation.triggers",
  name: "Automation triggers",
  description: "Trigger→action rules seeded for this business.",
  version: "1.0.0",
  ownerLayer: 16,
  domain: "automation",
  field: "triggers",
  mergeStrategy: "union"
});

// ─── Form-specific (Forms layer 10) ───────────────────────────
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "form.successMessage",
  name: "Form success message intent",
  description:
    "Intent for the message shown after form submit. Playbooks own intent; copy comes from content layer.",
  version: "1.0.0",
  ownerLayer: 10,
  domain: "form",
  field: "successMessage",
  mergeStrategy: "highest-confidence"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "form.submitLabel",
  name: "Form submit label intent",
  description: "Overrides cta.primary intent for form contexts.",
  version: "1.0.0",
  ownerLayer: 10,
  domain: "form",
  field: "submitLabel",
  mergeStrategy: "highest-confidence"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "form.followupWorkflow",
  name: "Form follow-up workflow",
  description: "Which automation workflow fires after successful submit.",
  version: "1.0.0",
  ownerLayer: 10,
  domain: "form",
  field: "followupWorkflow",
  mergeStrategy: "highest-confidence"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "form.emphasiseFields",
  name: "Form field emphasis",
  description: "Field keys the strategy wants rendered first / larger.",
  version: "1.0.0",
  ownerLayer: 10,
  domain: "form",
  field: "emphasiseFields",
  mergeStrategy: "union"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "form.hideFields",
  name: "Form field hiding",
  description: "Field keys the strategy wants hidden entirely.",
  version: "1.0.0",
  ownerLayer: 10,
  domain: "form",
  field: "hideFields",
  mergeStrategy: "union"
});

// ─── Dashboard (Dashboard layer 11) ───────────────────────────
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "dashboard.primaryMetrics",
  name: "Dashboard primary metrics",
  description:
    "Ordered list of metricRegistry slugs the dashboard should emphasise for this business.",
  version: "1.0.0",
  ownerLayer: 11,
  domain: "dashboard",
  field: "primaryMetrics",
  mergeStrategy: "union"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "dashboard.blockOrder",
  name: "Dashboard block order",
  description: "Ordered list of block slugs the dashboard should render.",
  version: "1.0.0",
  ownerLayer: 11,
  domain: "dashboard",
  field: "blockOrder",
  mergeStrategy: "union"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "dashboard.kpiTargets",
  name: "Dashboard KPI targets",
  description: "Target values per metric slug; used to flag hit/miss on cards.",
  version: "1.0.0",
  ownerLayer: 11,
  domain: "dashboard",
  field: "kpiTargets",
  mergeStrategy: "union"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "dashboard.suggestedActions",
  name: "Dashboard suggested actions",
  description:
    "Actionable suggestions surfaced on the dashboard (e.g. 'Launch Fire Doors campaign').",
  version: "1.0.0",
  ownerLayer: 11,
  domain: "dashboard",
  field: "suggestedActions",
  mergeStrategy: "union"
});

// ─── Booking (Booking layer 12) ───────────────────────────────
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "booking.depositPolicy",
  name: "Booking deposit policy",
  description: "Whether the flow collects a deposit (required / optional / none).",
  version: "1.0.0",
  ownerLayer: 12,
  domain: "booking",
  field: "depositPolicy",
  mergeStrategy: "highest-confidence"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "booking.availabilityDisplay",
  name: "Booking availability display",
  description:
    "How availability is presented — calendar / next-available / callback-only / consultation.",
  version: "1.0.0",
  ownerLayer: 12,
  domain: "booking",
  field: "availabilityDisplay",
  mergeStrategy: "highest-confidence"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "booking.gate",
  name: "Booking entry gate",
  description:
    "Optional entry gate — e.g. emergency triage that short-circuits to call/callback.",
  version: "1.0.0",
  ownerLayer: 12,
  domain: "booking",
  field: "gate",
  mergeStrategy: "highest-confidence"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "booking.flowKind",
  name: "Booking flow kind",
  description:
    "Which booking flow shape best suits this business (simple / emergency / consultation / quote-only).",
  version: "1.0.0",
  ownerLayer: 12,
  domain: "booking",
  field: "flowKind",
  mergeStrategy: "highest-confidence"
});
facetKindRegistry.register({
  manifestVersion: 1,
  slug: "booking.priorityServices",
  name: "Booking priority services",
  description:
    "Ordered service slugs — the top of the list is the featured service.",
  version: "1.0.0",
  ownerLayer: 12,
  domain: "booking",
  field: "priorityServices",
  mergeStrategy: "union"
});
