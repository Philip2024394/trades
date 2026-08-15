// Metadata sidecar for hero.product_showroom_1. Server-safe registration
// (Phase 19D · Philip 2026-08-14).
//
// The sibling `productShowroom.tsx` is a "use client" module because the
// renderer uses client-side React features. Next.js does NOT run the
// module-level `sectionRegistry.register()` side effect on the server
// when a "use client" module is imported from a Server Component / API
// route — so the SSR catalog was missing this section and the App
// Builder validator failed with:
//   "section registryId \"product/detail-hero\" cannot resolve …"
//
// This file is NOT "use client", so its top-level register() call runs
// on BOTH the server (populating the SSR + API-route catalog) AND the
// client (populating the editor catalog). The renderer is imported from
// the sibling .tsx: on the server it becomes a client-component
// reference (never invoked at render), on the client it's the real
// component.

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type { SectionRegistration } from "@/lib/studio/sectionTypes";
import { ProductShowroomHero } from "./productShowroom";

type VisualEffect = "none" | "grid";

type Config = {
  eyebrow: string;
  heading: string;
  subheading: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  deliveryChip: string;
  tradeAccountChip: string;
  visualEffect: VisualEffect;
  product1Image: string;
  product1Label: string;
  product1Badge: string;
  product2Image: string;
  product2Label: string;
  product3Image: string;
  product3Label: string;
  product4Image: string;
  product4Label: string;
  product5Image: string;
  product5Label: string;
  product6Image: string;
  product6Label: string;
  backgroundImageUrl: string;
  backgroundImageOpacity: number;
};

const registration: SectionRegistration<Config> = {
  id: "hero.product_showroom_1",
  name: "Merchant Product Showroom Hero",
  version: "1.0.0",
  library: "hero",
  description:
    "Storefront-first hero for building merchants, tool suppliers, materials yards. Product grid on the right, copy + trade-account CTA + delivery chip on the left.",
  editableFields: [
    { key: "eyebrow", role: "eyebrow", label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "Yard open · Monday to Saturday", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "heading", role: "headline", label: "Headline", type: { kind: "text", maxLength: 100 }, default: "Everything you need to get on site.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", role: "subhead", label: "Subheading", type: { kind: "text", maxLength: 200, multiline: true }, default: "Building materials, tools and consumables in stock. Same-day delivery inside our zone. Trade account holders get 30-day credit.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "primaryCtaLabel", role: "primary_action_label", label: "Primary CTA label", type: { kind: "text", maxLength: 30 }, default: "Open a trade account", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "primaryCtaHref", role: "primary_action_href", label: "Primary CTA link", type: { kind: "link" }, default: "#trade-account", group: "CTAs" },
    { key: "secondaryCtaLabel", role: "secondary_action_label", label: "Secondary CTA label", type: { kind: "text", maxLength: 30 }, default: "Browse stock", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "secondaryCtaHref", role: "secondary_action_href", label: "Secondary CTA link", type: { kind: "link" }, default: "#shop", group: "CTAs" },
    { key: "deliveryChip", label: "Delivery chip", type: { kind: "text", maxLength: 40 }, default: "Same-day within 15 miles", group: "Chips" },
    { key: "tradeAccountChip", label: "Trade account chip", type: { kind: "text", maxLength: 40 }, default: "30-day trade credit", group: "Chips" },
    { key: "product1Image", role: "hero_media", label: "Product 1 image", type: { kind: "image", aspectRatio: "1:1" }, default: "", group: "Product 1 (featured)" },
    { key: "product1Label", role: "product_name", label: "Product 1 label", type: { kind: "text", maxLength: 30 }, default: "Cement 25kg", group: "Product 1 (featured)" },
    { key: "product1Badge", role: "product_badge", label: "Product 1 badge", type: { kind: "text", maxLength: 20 }, default: "New", group: "Product 1 (featured)" },
    { key: "product2Image", role: "hero_media", label: "Product 2 image", type: { kind: "image", aspectRatio: "1:1" }, default: "", group: "Products" },
    { key: "product2Label", role: "product_name", label: "Product 2 label", type: { kind: "text", maxLength: 30 }, default: "Plasterboard", group: "Products" },
    { key: "product3Image", role: "hero_media", label: "Product 3 image", type: { kind: "image", aspectRatio: "1:1" }, default: "", group: "Products" },
    { key: "product3Label", role: "product_name", label: "Product 3 label", type: { kind: "text", maxLength: 30 }, default: "Insulation", group: "Products" },
    { key: "product4Image", role: "hero_media", label: "Product 4 image", type: { kind: "image", aspectRatio: "1:1" }, default: "", group: "Products" },
    { key: "product4Label", role: "product_name", label: "Product 4 label", type: { kind: "text", maxLength: 30 }, default: "Timber", group: "Products" },
    { key: "product5Image", role: "hero_media", label: "Product 5 image", type: { kind: "image", aspectRatio: "1:1" }, default: "", group: "Products" },
    { key: "product5Label", role: "product_name", label: "Product 5 label", type: { kind: "text", maxLength: 30 }, default: "Tools", group: "Products" },
    { key: "product6Image", role: "hero_media", label: "Product 6 image", type: { kind: "image", aspectRatio: "1:1" }, default: "", group: "Products" },
    { key: "product6Label", role: "product_name", label: "Product 6 label", type: { kind: "text", maxLength: 30 }, default: "Fixings", group: "Products" },
    { key: "backgroundImageUrl", role: "background_media", label: "Background photo", type: { kind: "image", aspectRatio: "16:9", recommendedWidthPx: 1920 }, default: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2002_36_48%20PM.png?updatedAt=1782977828849", group: "Background", description: "Full-bleed photo behind the copy + product grid. Leave empty for the plain dark surface." },
    { key: "backgroundImageOpacity", role: "opacity", label: "Background photo opacity", type: { kind: "number", min: 0, max: 1, step: 0.05 }, default: 1, group: "Background" },
    { key: "visualEffect", label: "Background effect", type: { kind: "select", options: [{ value: "grid", label: "Grid pattern (default)" }, { value: "none", label: "None" }] }, default: "grid", description: "Subtle Magic UI grid layered above the background photo.", group: "Background" }
  ],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "Explain when the Product-Showroom hero works best for merchants.",
    improve: "Suggest which product tile to feature.",
    rewrite: "Rewrite the headline for a materials merchant.",
    suggestAlternative: "Which hero would work for a service merchant with no product catalogue?",
    score: "Score this hero on the six standard axes."
  },
  thumbnail: "",
  telemetryTags: ["hero", "merchant", "product-grid", "trade-account"],
  bestForVerticals: ["building-merchant", "builders-supplies", "tool-hire", "materials-yard", "kitchen-showroom", "bathroom-showroom", "timber-merchant"],
  defaultConfig: () => ({
    eyebrow: "Yard open · Monday to Saturday",
    heading: "Everything you need to get on site.",
    subheading: "Building materials, tools and consumables in stock. Same-day delivery inside our zone. Trade account holders get 30-day credit.",
    primaryCtaLabel: "Open a trade account",
    primaryCtaHref: "#trade-account",
    secondaryCtaLabel: "Browse stock",
    secondaryCtaHref: "#shop",
    deliveryChip: "Same-day within 15 miles",
    tradeAccountChip: "30-day trade credit",
    product1Image: "",
    product1Label: "Cement 25kg",
    product1Badge: "New",
    product2Image: "",
    product2Label: "Plasterboard",
    product3Image: "",
    product3Label: "Insulation",
    product4Image: "",
    product4Label: "Timber",
    product5Image: "",
    product5Label: "Tools",
    product6Image: "",
    product6Label: "Fixings",
    backgroundImageUrl:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2002_36_48%20PM.png?updatedAt=1782977828849",
    backgroundImageOpacity: 1,
    visualEffect: "grid"
  }),
  renderer: ProductShowroomHero
};

sectionRegistry.register(registration);
