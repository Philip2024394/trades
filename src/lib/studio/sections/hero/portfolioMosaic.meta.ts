// Metadata sidecar for hero.portfolio_mosaic_1.
// Server-safe registration so the AI routes can see this section (task #41 fix).

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type { SectionRegistration } from "@/lib/studio/sectionTypes";
import { PortfolioMosaicHero } from "./portfolioMosaic";

type Config = {
  eyebrow: string;
  heading: string;
  subheading: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  photo1: string;
  photo2: string;
  photo3: string;
  photo4: string;
  photo5: string;
  photo6: string;
  overlayOpacity: number;
  projectCountLabel: string;
  backgroundImageUrl: string;
  backgroundImageOpacity: number;
};

const registration: SectionRegistration<Config> = {
  id: "hero.portfolio_mosaic_1",
  name: "Portfolio Mosaic Hero",
  version: "1.0.0",
  library: "hero",
  description:
    "6-photo mosaic background with centred copy. Built for visual trades whose portfolio is the pitch — builders, kitchen fitters, landscape designers, tilers.",
  editableFields: [
    { key: "eyebrow", role: "eyebrow",label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "Recent work", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "heading", role: "headline",label: "Headline", type: { kind: "text", maxLength: 100 }, default: "Work that speaks for itself.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", role: "subhead",label: "Subheading", type: { kind: "text", maxLength: 200, multiline: true }, default: "Every project photographed. Every job signed off in writing. Every homeowner gets the same care.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "primaryCtaLabel", role: "primary_action_label",label: "Primary CTA label", type: { kind: "text", maxLength: 30 }, default: "Start your project", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "primaryCtaHref", role: "primary_action_href",label: "Primary CTA link", type: { kind: "link" }, default: "#whatsapp", group: "CTAs" },
    { key: "secondaryCtaLabel", role: "secondary_action_label",label: "Secondary CTA label", type: { kind: "text", maxLength: 30 }, default: "View all projects", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "secondaryCtaHref", role: "secondary_action_href",label: "Secondary CTA link", type: { kind: "link" }, default: "#projects", group: "CTAs" },
    { key: "photo1", role: "gallery_media",label: "Photo 1", type: { kind: "image", aspectRatio: "4:3" }, default: "", group: "Photos" },
    { key: "photo2", role: "gallery_media",label: "Photo 2", type: { kind: "image", aspectRatio: "4:3" }, default: "", group: "Photos" },
    { key: "photo3", role: "gallery_media",label: "Photo 3", type: { kind: "image", aspectRatio: "4:3" }, default: "", group: "Photos" },
    { key: "photo4", role: "gallery_media",label: "Photo 4", type: { kind: "image", aspectRatio: "4:3" }, default: "", group: "Photos" },
    { key: "photo5", role: "gallery_media",label: "Photo 5", type: { kind: "image", aspectRatio: "4:3" }, default: "", group: "Photos" },
    { key: "photo6", role: "gallery_media",label: "Photo 6", type: { kind: "image", aspectRatio: "4:3" }, default: "", group: "Photos" },
    { key: "overlayOpacity", role: "opacity",label: "Overlay darkness", type: { kind: "number", min: 0.3, max: 0.9, step: 0.05 }, default: 0.6, group: "Layout" },
    { key: "projectCountLabel", role: "trust_line",label: "Project count line", type: { kind: "text", maxLength: 80 }, default: "218 projects completed · 2011 – today", priority: "text", group: "Copy" },
    { key: "backgroundImageUrl", role: "background_media",label: "Background photo", type: { kind: "image", aspectRatio: "16:9", recommendedWidthPx: 1920 }, default: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2003_27_08%20PM.png", group: "Background", description: "Full-bleed photo behind the mosaic + overlay. Fills the whole hero when Photos 1-6 aren't set." },
    { key: "backgroundImageOpacity", role: "opacity",label: "Background photo opacity", type: { kind: "number", min: 0, max: 1, step: 0.05 }, default: 1, group: "Background" }
  ],
  animations: ["none", "fade-in", "parallax"],
  aiPrompts: {
    explain: "Explain when the Portfolio Mosaic hero works best.",
    improve: "Suggest which photo positions matter most.",
    rewrite: "Rewrite the headline for a visual trade.",
    suggestAlternative: "Which other hero would work if the merchant has few project photos?",
    score: "Score this hero for a visual trade merchant."
  },
  thumbnail: "",
  telemetryTags: ["hero", "portfolio", "visual"],
  bestForVerticals: ["builder", "kitchen-fitter", "bathroom-fitter", "tiler", "landscape-designer", "decorator", "carpenter", "roofer", "extension-builder"],
  defaultConfig: () => ({
    eyebrow: "Recent work",
    heading: "Work that speaks for itself.",
    subheading: "Every project photographed. Every job signed off in writing. Every homeowner gets the same care.",
    primaryCtaLabel: "Start your project",
    primaryCtaHref: "#whatsapp",
    secondaryCtaLabel: "View all projects",
    secondaryCtaHref: "#projects",
    photo1: "",
    photo2: "",
    photo3: "",
    photo4: "",
    photo5: "",
    photo6: "",
    overlayOpacity: 0.6,
    projectCountLabel: "218 projects completed · 2011 – today",
    backgroundImageUrl:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2003_27_08%20PM.png",
    backgroundImageOpacity: 1
  }),
  renderer: PortfolioMosaicHero
};

sectionRegistry.register(registration);
