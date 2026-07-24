// Business Card Studio manifest — per HOW_TO_ADD_A_STUDIO.md.

import type { StudioAppManifest } from "@/lib/design/trade-os/manifest";

export const manifest: StudioAppManifest = {
  id:          "print.business-card",
  name:        "Business Card Studio",
  version:     "1.0.0",
  studio:      "Print",
  category:    "print",
  description: "Generate the merchant's business card front + back at print-ready 85x55mm.",
  icon:        "CreditCard",
  status:      "beta",

  dependencies:        [],
  requiredBrandFields: [
    { path: "name",               required: true },
    { path: "colour.primary",     required: true },
    { path: "typography.primary", required: true }
  ],
  outputs: [
    { type: "business-card", mime: "image/png", resolution: "1004x650", editable: false }
  ],
  permissions:   [{ role: "Owner", action: "generate" }],
  subscriptions: [],

  generator: { type: "image", compiler: "1.0.0", workflow: "single-shot" },
  storage:   { bucket: "business-cards", retention: "forever", versioned: true, cache: true },
  exporters: [{ type: "png", enabled: true }],

  pricing: { plan: "one_time", price: 4.99, credits: 0 },
  ai: {
    reasoningModel: "gpt-5",
    imageModel:     "ideogram-v3",
    criticModel:    "gpt-4o",
    maxAttempts:    3,
    temperature:    0.3
  },
  qa: {
    minimumScore:  92,
    rules:         ["no_gradients", "cmyk_safe", "3mm_bleed"],
    autoFix:       true,
    humanApproval: false
  }
};
