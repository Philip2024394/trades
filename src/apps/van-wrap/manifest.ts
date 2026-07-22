// Van Wrap App — the reference Studio App implementation.
// Follows the manifest contract from V1 Part 3 of the Trade OS spec
// verbatim. Every subsequent Studio App copy-adapts this shape.

import type { StudioAppManifest } from "@/lib/design/trade-os/manifest";

export const manifest: StudioAppManifest = {
  id:          "vehicle.van-wrap",
  name:        "Van Wrap",
  version:     "0.1.0",
  studio:      "Vehicle",
  category:    "Vehicle Branding",
  description: "Professional UK commercial vehicle wrap generator. Produces a three-view mockup (side, front, rear) at agency quality.",
  icon:        "van",
  status:      "beta",

  dependencies: [
    { id: "brand",               minimumVersion: "2.0", required: true },
    { id: "prompt-compiler",     minimumVersion: "1.0", required: true },
    { id: "design-intelligence", minimumVersion: "1.0", required: true }
  ],

  requiredBrandFields: [
    { path: "identity.name",             required: true  },
    { path: "identity.phone",            required: true  },
    { path: "colours",                   required: true  },
    { path: "typography.heading",        required: true  },
    { path: "logo.masterSvg",            required: false },   // fallback to text-only wrap
    { path: "vehicle.preferredLayout",   required: false }
  ],

  outputs: [
    { type: "png", mime: "image/png",       resolution: "1600x900", editable: false },
    { type: "pdf", mime: "application/pdf", resolution: "print",    editable: true  }
  ],

  permissions: [
    { role: "Owner",    action: "generate" },
    { role: "Designer", action: "edit"     },
    { role: "Printer",  action: "download" }
  ],

  subscriptions: [
    { event: "Brand.Updated.v1",              handler: "generatePreview", priority: 1 },
    { event: "Identity.LogoChanged.v1",       handler: "generatePreview", priority: 2 },
    { event: "Identity.ColourChanged.v1",     handler: "generatePreview", priority: 2 }
  ],

  generator: {
    type:      "image",
    compiler:  "VehiclePromptCompiler",  // implemented once V3 Q13 lands
    workflow:  "VehicleWorkflow"
  },

  storage: {
    bucket:     "vehicle-assets",
    retention:  "forever",
    versioned:  true,
    cache:      true
  },

  exporters: [
    { type: "PNG", enabled: true },
    { type: "PDF", enabled: true },
    { type: "SVG", enabled: false },   // enable once vector cleanup pipeline ships
    { type: "ZIP", enabled: true }
  ],

  pricing: {
    plan:     "one_time",
    price:    6.99,
    credits:  50            // washer cost for a full session
  },

  ai: {
    reasoningModel: "gpt-5",
    imageModel:     "gpt-image-1",
    criticModel:    "gpt-5",
    maxAttempts:    3,
    temperature:    0.2
  },

  qa: {
    minimumScore:  92,
    autoFix:       true,
    humanApproval: false,      // becomes true for the £99 Own It tier
    rules: [
      "No graphics over number plate",
      "No graphics over headlights",
      "No graphics over tail lights",
      "No graphics over wheel arches",
      "Logo visible and legible at 20m",
      "Phone number readable at 20m",
      "Contrast AA minimum",
      "Premium score >92",
      "Lower charcoal skirt terminates at rear door shut line",
      "No wrap graphics cross the rear door seam"
    ]
  }
};
