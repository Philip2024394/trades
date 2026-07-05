// Blueprint: Damp Specialist · Diagnosis + Treatment.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "damp-specialist-pca",
  name: "Damp Specialist · PCA-registered",
  tagline: "Diagnose properly. Treat only what's needed. Guaranteed.",
  description:
    "PCA / PCA-registered damp specialist blueprint. Positioned honestly — 'diagnose first, treat second' — because homeowners are increasingly (rightly) skeptical of injection-first quotes. Rising damp, penetrating damp, condensation, timber treatment.",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["renovation-specialist", "builder"],
  outcomes: ["quote-requests", "service-sales", "local-coverage"],
  variant: "corporate",
  layout: {
    home: [
      {
        key: "hero.split_photo_left_1",
        slotHint: "hero",
        config: {
          headline: "Damp diagnosed. Only fixed if it's really damp.",
          subhead:
            "PCA-registered. We survey, measure, and tell you honestly whether you have rising damp, condensation, or a leak. No injection until we're sure.",
          primaryCtaLabel: "Book a damp survey",
          secondaryCtaLabel: "Free advice call"
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "Our diagnostic process",
          items: [
            { title: "Meter + probe", body: "Protimeter + salts test. Condensation ≠ rising damp — the meter tells us." },
            { title: "Cause investigation", body: "Leaking gutter? Failed pointing? Bridged DPC? Blocked airbrick? We find the source, not just the symptom." },
            { title: "Report + honest quote", body: "Some jobs need no treatment. Some need a tenner's worth of pointing. Some need injection. We tell you which." },
            { title: "PCA-guaranteed treatment", body: "If treatment IS needed — CIGA / GPI 20-year insurance-backed guarantee registered on your behalf." }
          ]
        }
      },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Services",
          items: [
            { title: "Damp survey + written report" },
            { title: "Rising damp diagnosis + chemical DPC injection" },
            { title: "Penetrating damp remediation" },
            { title: "Condensation + mould treatment" },
            { title: "Timber treatment (woodworm, dry rot, wet rot)" },
            { title: "Basement + cellar tanking" },
            { title: "Cavity wall tie replacement" },
            { title: "Bridged DPC + external ground level" },
            { title: "Mortgage / pre-purchase damp report" },
            { title: "Insurance claim damp reports" }
          ]
        }
      },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the damp?" } },
      { key: "testimonials.card_grid_1", slotHint: "body", config: { heading: "What homeowners said", minCards: 3 } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Damp FAQ",
          preseed: [
            { q: "Is 'rising damp' real?", a: "Yes — but far less common than the surveying industry sometimes suggests. Most 'rising damp' turns out to be condensation, penetrating damp, or a plumbing leak. We diagnose properly first." },
            { q: "Do I need injection?", a: "Only when the DPC has genuinely failed + no other cause explains the moisture. We won't inject if we're not sure." },
            { q: "What warranty?", a: "20-year insurance-backed guarantee via GPI / CIGA on chemical DPC + tanking work. Ordinary treatments: 12-month workmanship." },
            { q: "Are you PCA registered?", a: "Yes — Property Care Association registered. Certificate available on request." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Send photos + a note", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 86, seo: 88, trust: 94, mobile: 91, accessibility: 94, speed: 89, brandConsistency: 92 },
  requiredCredentials: ["companies-house", "vat", "public-liability"],
  suggestedApps: ["quote_pipeline", "downloads", "trade_connections", "meet_the_team", "faq_page", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "Damp specialist site with honest diagnose-first narrative — trust wedge in a mistrusted trade.",
    benefits: [
      "'Diagnose before treat' positioning differentiates from injection-first competitors",
      "20-year GPI / CIGA guarantee narrative when treatment IS needed",
      "Mortgage / pre-purchase damp report cross-sell",
      "PCA badge + honest FAQ answers common misdiagnosis"
    ],
    priceLabel: "Free for damp specialists",
    estimatedBuildMinutes: 11
  }
};
blueprintRegistry.register(manifest);
export default manifest;
