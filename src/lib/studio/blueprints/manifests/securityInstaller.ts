// Blueprint: Security Installer · Alarms + CCTV.

import { blueprintRegistry } from "../registry";
import type { BlueprintManifest } from "../types";

const manifest: BlueprintManifest = {
  manifestVersion: 1,
  slug: "security-installer",
  name: "Security Installer · Alarms + CCTV",
  tagline: "Intruder alarms, CCTV, access control. SSAIB / NSI approved.",
  description:
    "SSAIB / NSI-registered security installer blueprint. Domestic + commercial split. Foregrounds insurer-recognised scheme membership (police-response alarm systems need this). GDPR-safe CCTV copy (DP notification + subject rights).",
  version: "1.0.0",
  publisher: { name: "Xrated Trades", verified: true },
  trades: ["security-installer"],
  outcomes: ["quote-requests", "service-sales", "local-coverage"],
  variant: "corporate",
  layout: {
    home: [
      {
        key: "hero.trust_anchor_1",
        slotHint: "hero",
        config: {
          headline: "Security systems that insurers accept.",
          subhead:
            "SSAIB-registered. Police-response-compatible intruder alarms, IP CCTV, access control. Domestic + commercial.",
          primaryCtaLabel: "Book a survey",
          secondaryCtaLabel: "See systems",
          verifiedSchemes: ["companies-house", "public-liability"]
        }
      },
      {
        key: "features.icon_grid_1",
        slotHint: "body",
        config: {
          heading: "What we install",
          items: [
            { title: "Intruder alarms", body: "Wired + wireless. Police-response compatible where accredited." },
            { title: "IP CCTV", body: "4MP – 8MP, remote view, GDPR-compliant signage + notice." },
            { title: "Access control", body: "Fob, card, keypad, biometric. Cloud + on-premise." },
            { title: "Fire alarms + emergency lighting", body: "BS5839 compliant install + certification." }
          ]
        }
      },
      { key: "gallery.grid_1", slotHint: "body", config: { heading: "Recent installs", minTiles: 8 } },
      {
        key: "services.list_1",
        slotHint: "body",
        config: {
          heading: "Full service list",
          items: [
            { title: "Intruder alarm design + install" },
            { title: "Police-response alarm registration (URN)" },
            { title: "IP CCTV design + install" },
            { title: "CCTV DPO consult + signage" },
            { title: "Access control (fob + card + biometric)" },
            { title: "Video intercom install" },
            { title: "Fire alarm install (BS5839)" },
            { title: "Emergency lighting install" },
            { title: "Servicing + monitoring contracts" },
            { title: "Break-in response + upgrade" }
          ]
        }
      },
      { key: "hero.postcode_local_1", slotHint: "body", config: { heading: "Where's the property?" } },
      {
        key: "faq.accordion_1",
        slotHint: "body",
        config: {
          heading: "Security FAQ",
          preseed: [
            { q: "Will my insurer accept the alarm?", a: "SSAIB / NSI-installed alarms are recognised by all mainstream UK insurers. Certificate issued on completion." },
            { q: "Do I need to notify anyone about CCTV?", a: "If it captures any area beyond your boundary — yes, ICO notification + on-site signage. We advise + install." },
            { q: "Servicing?", a: "Annual for domestic, 6-monthly for police-response + commercial. Contract discounts available." },
            { q: "Cloud or on-premise?", a: "Both — cloud simpler for domestic, on-premise (NVR) safer for GDPR-heavy commercial." }
          ]
        }
      },
      { key: "contact.split_1", slotHint: "footer", config: { heading: "Book a survey", ctaLabel: "Send" } },
      { key: "footer.minimal_1", slotHint: "footer" }
    ]
  },
  score: { conversion: 86, seo: 86, trust: 91, mobile: 91, accessibility: 94, speed: 90, brandConsistency: 91 },
  requiredCredentials: ["companies-house", "vat", "public-liability"],
  suggestedApps: ["quote_pipeline", "job_diary", "trade_connections", "meet_the_team", "faq_page", "downloads", "online_payments"],
  compliance: ["consumer-contracts-14day", "asa-superlative-guard", "gdpr-form-auditor"],
  browserCard: {
    oneLiner: "SSAIB/NSI security installer site with insurer-safe alarm + GDPR CCTV copy.",
    benefits: [
      "Insurer-accepted alarm narrative (URN + police response)",
      "GDPR-safe CCTV consult copy (ICO notification + signage)",
      "Domestic + commercial dual-track service catalogue",
      "BS5839 fire alarm cross-sell for commercial buildings"
    ],
    priceLabel: "Free for security installers",
    estimatedBuildMinutes: 12
  }
};
blueprintRegistry.register(manifest);
export default manifest;
