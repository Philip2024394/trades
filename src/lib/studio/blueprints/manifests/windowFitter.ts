// Blueprint: Windows & Doors · FENSA-Verified.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "window-fitter-fensa",
  name: "Windows & Doors · FENSA",
  tagline: "uPVC + aluminium + composite. FENSA / CERTASS certified.",
  description:
    "FENSA / CERTASS registered installer blueprint. Foregrounds the FENSA badge (mandatory route since April 2002 for replacement windows). Homeowner FAQ addresses Building Regs certificate + finance options. ASA-safe — no unqualified 'lifetime' or 'cheapest' claims.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["window-fitter", "door-fitter"],
  outcomes: ["quote-requests", "project-showcase", "service-sales"],
  variant: "corporate",
  layout: {
    home: [
      {
        key: "hero.split_photo_left_1",
        slotHint: "hero",
        config: {
          headline: "New windows and doors. FENSA certificate on completion.",
          subhead:
            "uPVC, aluminium, composite. Registered installer — your Building Regs certificate arrives within 10 working days.",
          primaryCtaLabel: "Book a survey",
          secondaryCtaLabel: "See recent installs"
        }
      },
      { key: "gallery.grid_1", slotHint: "body", config: { heading: "Recent installs", minTiles: 9 } },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Windows & doors",
          items: [
            { title: "uPVC casement windows" },
            { title: "Sliding sash windows (uPVC + timber)" },
            { title: "Bay + bow windows" },
            { title: "Aluminium windows (slim-line)" },
            { title: "Composite front doors" },
            { title: "uPVC back doors + French doors" },
            { title: "Bifold doors (aluminium)" },
            { title: "Sliding patio doors" },
            { title: "Roof lanterns + rooflights" },
            { title: "Conservatory replacement" },
            { title: "Garage doors" },
            { title: "Repair + refurbish existing units" }
          ]
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "The install journey",
          items: [
            { title: "Home survey", body: "Free within our radius — we measure + quote in your kitchen." },
            { title: "Manufacture", body: "Made to your measurements. 2–4 week lead-time typical." },
            { title: "Install day", body: "1 day per house for standard casement work. Tidied and glazed same day." },
            { title: "FENSA certificate", body: "Auto-registered — certificate emailed within 10 working days." }
          ]
        }
      },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What homeowners said", minCards: 3 } },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the property?" } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Windows + doors FAQ",
          preseed: [
            { q: "Do I get a Building Regs certificate?", a: "Yes — we're FENSA registered. Certificate emailed within 10 working days of install. No extra charge." },
            { q: "How long from order to install?", a: "Typical 3–4 weeks for uPVC, 5–7 weeks for aluminium + composite." },
            { q: "Do you finance?", a: "0% and low-APR finance available on qualifying orders through our authorised broker." },
            { q: "What warranty?", a: "10-year manufacturer warranty on frames + sealed units. FENSA insurance-backed guarantee included." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Book a home visit", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 88, seo: 87, trust: 93, mobile: 92, accessibility: 94, speed: 89, brandConsistency: 93 },
  requiredCredentials: ["companies-house", "vat", "public-liability", "fensa"],
  suggestedApps: ["quote_pipeline", "job_diary", "meet_the_team", "trade_connections", "faq_page", "downloads", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "FENSA-registered windows + doors installer with certificate-workflow copy.",
    benefits: [
      "FENSA badge auto-lights when you add your number",
      "Building Regs certificate promise (10 working days) — ASA-safe",
      "Finance option copy stays compliant with authorised-broker requirements",
      "12-product catalogue including bifold + roof lanterns"
    ],
    priceLabel: "Free for FENSA installers",
    estimatedBuildMinutes: 12
  }
};
blueprintRegistry.register(manifest);
export default manifest;
