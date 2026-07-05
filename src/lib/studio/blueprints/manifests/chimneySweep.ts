// Blueprint: Chimney Sweep · HETAS + Stove Servicing.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "chimney-sweep-hetas",
  name: "Chimney Sweep · HETAS",
  tagline: "Sweep, cert, servicing. HETAS registered. Insurance-recognised.",
  description:
    "HETAS-registered chimney sweep + stove servicer blueprint. Annual-service recurring-revenue funnel + certificate for home insurers. CO alarm + safety survey cross-sell.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["chimney-sweep"],
  outcomes: ["service-sales", "quote-requests", "local-coverage"],
  variant: "tradesman",
  layout: {
    home: [
      {
        key: "hero.trust_anchor_1",
        slotHint: "hero",
        config: {
          headline: "Sweep. Certificate. Servicing.",
          subhead:
            "HETAS registered. Sweep certificate accepted by all major UK home insurers. Stove services + CO alarm checks.",
          primaryCtaLabel: "Book a sweep",
          secondaryCtaLabel: "Stove service enquiry",
          verifiedSchemes: ["hetas", "companies-house"]
        }
      },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Sweep + service catalogue",
          items: [
            { title: "Annual chimney sweep + certificate" },
            { title: "Wood-burner + multi-fuel stove servicing" },
            { title: "Open fire sweep" },
            { title: "Bird nest / blockage removal" },
            { title: "CCTV chimney survey" },
            { title: "Flue liner check + advice" },
            { title: "Carbon monoxide alarm supply + fit" },
            { title: "Cowl + bird guard supply + fit" },
            { title: "Pot repair / repointing referral" },
            { title: "Solid-fuel safety inspection" }
          ]
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "Why an annual sweep",
          items: [
            { title: "Insurance requirement", body: "Most home insurers require annual sweep + cert. Ours is accepted UK-wide." },
            { title: "Fire safety", body: "Creosote build-up = chimney fire. Annual sweep prevents it." },
            { title: "Carbon monoxide", body: "Blocked flue = CO risk. Sweep + CO alarm check together." },
            { title: "Efficient stove", body: "Clean flue draws better — more heat, less fuel." }
          ]
        }
      },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the chimney?" } },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What locals said", minCards: 3 } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Chimney sweep FAQ",
          preseed: [
            { q: "How often should I sweep?", a: "Wood 2× a year (start + end of season). Coal 1×. Smokeless fuel 1×. Insurance usually mandates annual minimum." },
            { q: "Do you install stoves?", a: "We service + certify. New stove installs done by our HETAS-registered installer partner." },
            { q: "How long does a sweep take?", a: "45 minutes to an hour typical. We cover the fireplace + use vacuum to keep the room clean." },
            { q: "CCTV survey?", a: "Recommended for chimneys we've never seen, or if you've had smoke drift back. Shows lining condition + blockages." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Book a sweep", ctaLabel: "Book" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 88, seo: 85, trust: 91, mobile: 92, accessibility: 94, speed: 92, brandConsistency: 90 },
  requiredCredentials: ["companies-house", "public-liability", "hetas"],
  suggestedApps: ["quote_pipeline", "job_diary", "trade_connections", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "HETAS chimney sweep site with insurance-cert + annual reminder funnel.",
    benefits: [
      "HETAS badge foregrounded",
      "Insurance-cert narrative for the mandatory-service angle",
      "CO alarm + CCTV survey cross-sell",
      "Annual reminder funnel for recurring revenue"
    ],
    priceLabel: "Free for HETAS sweeps",
    estimatedBuildMinutes: 9
  }
};
blueprintRegistry.register(manifest);
export default manifest;
