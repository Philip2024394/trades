// Blueprint: Recruitment · Trade Contractor.
//
// Cross-trade recruitment blueprint. FMB State of Trade H1 2025:
// 60%+ of builders struggling to find skilled tradespeople, 23%
// cancelling work due to skills shortage. This blueprint is for
// contractors who need to fill vacancies fast.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "recruitment-contractor",
  name: "Recruitment · Trade Contractor",
  tagline: "Vacancies. Pay. Van. Progression. No CV wall.",
  description:
    "Vacancies-first blueprint for contractors hiring trades. Aimed at the 60% of UK builders (FMB H1 2025 data) struggling to find skilled tradespeople. Mobile-first apply flow — WhatsApp + phone-first, no CV upload wall. Progression + apprenticeship pathway callouts.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["builder", "commercial-builder", "house-builder", "electrician", "plumber", "carpenter"],
  outcomes: ["staff-recruitment", "phone-calls"],
  variant: "corporate",
  layout: {
    home: [
      {
        key: "hero.trust_anchor_1",
        slotHint: "hero",
        config: {
          headline: "Trades we're hiring. Van, pay, progression on the table.",
          subhead: "Full-time + subbie roles. Real interviews with the guv, not a form filter. Apply by WhatsApp or phone.",
          primaryCtaLabel: "WhatsApp to apply",
          secondaryCtaLabel: "Call the office",
          verifiedSchemes: ["fmb", "companies-house"]
        }
      },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Open roles",
          items: [
            { title: "Site foreman" },
            { title: "Carpenter (1st + 2nd fix)" },
            { title: "Electrician (Part P registered)" },
            { title: "Plumber / heating engineer" },
            { title: "Bricklayer" },
            { title: "Groundworker (CPCS carded)" },
            { title: "Apprentice carpenter" },
            { title: "Apprentice plumber" }
          ]
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "What we offer",
          items: [
            { title: "Fair day rates", body: "Reviewed every 6 months. Overtime paid at 1.5×." },
            { title: "Van + tools", body: "Company van for permanent roles. Power tools provided." },
            { title: "Progression path", body: "Foreman → contract manager for the right people. NVQ level 3 supported." },
            { title: "Local jobs", body: "Sites within 20 miles typical. No motorway commute." }
          ]
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What the team said", minCards: 3 } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Hiring FAQ",
          preseed: [
            { q: "Do I need a full CV?", a: "No — WhatsApp with your trade + years' experience. We call you back same day." },
            { q: "Do you take apprentices?", a: "Yes — level 2 + 3 apprentices in carpentry, plumbing, brickwork. Local college partnership." },
            { q: "Sub-contract or PAYE?", a: "Both — CIS sub roles for experienced tradespeople, PAYE for foremen + apprentices." },
            { q: "Where are your sites?", a: "Within 20 miles of the yard typically. Some occasional travel work." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Send your trade + years' experience", ctaLabel: "Apply" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 89, seo: 82, trust: 89, mobile: 96, accessibility: 94, speed: 91, brandConsistency: 90 },
  requiredCredentials: ["companies-house", "public-liability", "fmb"],
  suggestedApps: ["quote_pipeline", "meet_the_team", "trade_connections", "faq_page", "job_diary", "lead_alerts"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Vacancies-first recruitment site — WhatsApp + phone apply, no CV wall.",
    benefits: [
      "Aimed at the 60% of UK builders struggling to hire (FMB 2025)",
      "WhatsApp deep-link apply for phone-native trades",
      "Apprenticeship pathway callout for pipeline hiring",
      "Trade + years' experience the only required fields — no CV filter"
    ],
    priceLabel: "Free for contractors",
    estimatedBuildMinutes: 9
  }
};
blueprintRegistry.register(manifest);
export default manifest;
