// App: Newsletter.
//
// UK GDPR + PECR compliant email capture. Merchants export the list;
// xratedtrade never sends emails on their behalf. Reuses the existing
// NewsletterSignup profile component.

import type { AppManifest } from "@/platform/manifest/types";

export const newsletterManifest: AppManifest = {
  manifestVersion: 1,

  slug: "newsletter",
  name: "Newsletter",
  tagline: "GDPR-compliant email capture on your profile footer.",
  description:
    "A signup form on your profile lets customers opt in to your stock, promo and arrival updates. Consent + timestamps + IP are stored per subscriber. Export the CSV and send through your own tool (Mailchimp, Brevo, anything). Every subscriber gets a one-click unsubscribe link.",
  icon: "✉️",
  category: "sales",
  version: "1.0.0",

  publisher: {
    name: "Xrated Trades",
    verified: true
  },

  compatibility: {
    industries: ["*"],
    pages: ["home", "shop", "footer"],
    createsPages: []
  },

  requirements: {
    plan: "free",
    dependencies: [],
    conflicts: [],
    capabilities: ["messaging"],
    permissions: ["read:listing"]
  },

  studio: {
    sections: [
      {
        id: "inline",
        name: "Newsletter Signup",
        library: "newsletter",
        description:
          "Inline email capture form — appearance-only fields. Consent flow is compliance-managed.",
        moduleImport: "./sections/inline"
      }
    ],
    slotHints: ["home.footer", "shop.footer"],
    contentEditor: {
      route: "/trade-off/edit/{slug}/newsletter",
      title: "Manage subscribers",
      surface: "slide-over"
    }
  },

  navigation: [],

  events: {
    publishes: ["newsletter.subscribed"],
    subscribes: []
  },

  ai: {
    keywords: [
      "email",
      "newsletter",
      "signup",
      "mailing list",
      "marketing",
      "subscribers"
    ],
    userStories: [
      "As a merchant, I want customers to sign up to my mailing list so I can notify them when new stock lands."
    ],
    recommendedFor: [
      "merchants with recurring stock",
      "builders' merchants",
      "trade suppliers",
      "tool retailers"
    ]
  },

  appStore: {
    screenshots: [],
    benefits: [
      "Footer signup form on your public profile — GDPR-compliant by default",
      "Dashboard table of subscribers + one-click CSV export",
      "Per-subscriber unsubscribe link you paste into every email"
    ],
    priceLabel: "Free"
  }
};
