// Blueprint: Insulation Installer.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "insulation-installer",
  name: "Insulation Installer",
  tagline: "Loft, cavity wall, EWI. TrustMark + PAS 2035.",
  description:
    "PAS 2035 / TrustMark registered insulation installer blueprint. Positioned for GB Insulation Scheme / ECO4 eligible households + private-pay retrofit. Honest 'we do NOT do spray foam' clause protects merchant + homeowner from mortgage lender pushback.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["insulation-installer"],
  outcomes: ["quote-requests", "service-sales", "local-coverage"],
  variant: "corporate",
  layout: {
    home: [
      {
        key: "hero.split_photo_left_1",
        slotHint: "hero",
        config: {
          headline: "Insulation done properly. TrustMark + PAS 2035.",
          subhead:
            "Loft, cavity wall, external wall insulation (EWI). ECO4 + GBIS grant applications handled. No spray foam.",
          primaryCtaLabel: "Book a survey",
          secondaryCtaLabel: "See recent installs"
        }
      },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Insulation services",
          items: [
            { title: "Loft insulation (mineral wool, 270mm)" },
            { title: "Cavity wall insulation (bead + fibre)" },
            { title: "External wall insulation (EWI) — full render" },
            { title: "Internal wall insulation (IWI)" },
            { title: "Floor insulation (suspended + solid)" },
            { title: "Room-in-roof insulation" },
            { title: "Loft-hatch + tank-jacket upgrades" },
            { title: "Ventilation upgrade (post-insulation)" },
            { title: "Cavity wall extraction (when required)" },
            { title: "Guarantee registration (25-year CIGA / SWIGA)" }
          ]
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "Grants + private-pay",
          items: [
            { title: "ECO4 grants", body: "Eligible households — install can be free or heavily subsidised. We check + apply." },
            { title: "GB Insulation Scheme", body: "£1,000+ towards cavity wall + loft insulation for eligible EPC bands." },
            { title: "Private-pay retrofit", body: "Non-eligible? Standard quote. 25-year guarantee registered with CIGA / SWIGA." },
            { title: "No spray foam", body: "We do NOT install spray foam. Lender + insurer risks are too high — full stop." }
          ]
        }
      },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the property?" } },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What homeowners said", minCards: 3 } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Insulation FAQ",
          preseed: [
            { q: "Do I qualify for ECO4?", a: "Depends on income, benefits, EPC band. We check at survey — no commitment." },
            { q: "How long does cavity wall take?", a: "Typical 3-bed 2–4 hours. Access from outside — no mess indoors." },
            { q: "Why don't you do spray foam?", a: "Mortgage lenders + insurers increasingly reject spray-foam properties. Removal is expensive. We won't install it." },
            { q: "What warranty?", a: "25-year CIGA (cavity) or SWIGA (solid wall) insurance-backed guarantee. Registered on your behalf." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Book a survey", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 86, seo: 88, trust: 93, mobile: 91, accessibility: 94, speed: 89, brandConsistency: 92 },
  requiredCredentials: ["companies-house", "vat", "public-liability", "trustmark"],
  suggestedApps: ["quote_pipeline", "downloads", "trade_connections", "meet_the_team", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "PAS 2035 insulation installer site with ECO4 grant funnel + no-spray-foam stance.",
    benefits: [
      "TrustMark + PAS 2035 narrative",
      "ECO4 + GBIS grant workflow explained honestly",
      "Explicit 'no spray foam' — differentiator + risk-avoidance",
      "CIGA / SWIGA 25-year guarantee registration copy"
    ],
    priceLabel: "Free for insulation installers",
    estimatedBuildMinutes: 11
  }
};
blueprintRegistry.register(manifest);
export default manifest;
