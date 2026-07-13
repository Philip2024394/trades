// Metadata sidecar for gallery.grid_1. Server-safe registration so the AI routes can see this section (task #41 fix).
//
// The sibling `grid.tsx` is a "use client" module because the renderer
// uses React client features. Next.js does NOT run the module-level
// `sectionRegistry.register()` side effect on the server when a
// "use client" module is imported from an RSC / API route — so the
// server-side catalog was missing this section, and the AI router
// couldn't propose it.
//
// This file is NOT "use client", so its top-level register() call runs
// on BOTH the server (populating the API-route registry) AND the client
// (populating the editor registry). The renderer is imported from the
// sibling .tsx: on the server it becomes a client-component reference
// (never called), on the client it's the real component.

import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type { SectionRegistration } from "@/lib/studio/sectionTypes";
import { GalleryGrid } from "./grid";

type ItemShape = { url?: string; alt?: string; href?: string };

type Config = {
  eyebrow: string;
  heading: string;
  subheading: string;
  photo1Url: string; photo1Alt: string; photo1Href: string;
  photo2Url: string; photo2Alt: string; photo2Href: string;
  photo3Url: string; photo3Alt: string; photo3Href: string;
  photo4Url: string; photo4Alt: string; photo4Href: string;
  photo5Url: string; photo5Alt: string; photo5Href: string;
  photo6Url: string; photo6Alt: string; photo6Href: string;
  photo7Url: string; photo7Alt: string; photo7Href: string;
  photo8Url: string; photo8Alt: string; photo8Href: string;
  items?: ItemShape[];
  surface: "light" | "dark";
};

// Inlined here (not imported from grid.tsx) because that file is
// "use client" — non-component named exports become opaque proxies
// when read from the server bundle. Component references (like
// GalleryGrid) are the only cross-boundary import that works.
const buildPhotoFields = () => {
  const fields = [];
  for (let i = 1; i <= 8; i++) {
    fields.push({ key: `photo${i}Url`, label: `Photo ${i} URL`, type: { kind: "image" as const, aspectRatio: "1/1", recommendedWidthPx: 800 }, default: "", priority: "image" as const, role: "gallery_media" as const, group: `Photo ${i}` });
    fields.push({ key: `photo${i}Alt`, label: `Photo ${i} alt`, type: { kind: "text" as const, maxLength: 100 }, default: `Portfolio image ${i}`, group: `Photo ${i}` });
    fields.push({ key: `photo${i}Href`, label: `Photo ${i} link (optional)`, type: { kind: "link" as const, allowInternal: true, allowExternal: true }, default: "", group: `Photo ${i}` });
  }
  return fields;
};

const registration: SectionRegistration<Config> = {
  id: "gallery.grid_1",
  name: "Gallery grid",
  version: "2.0.0",
  library: "gallery",
  description:
    "Photo gallery grid on shadcn foundation. Mobile: 2-col; Tablet: 3-col; Desktop: 4-col. Staggered Framer Motion reveal. Supports fixed photo1..8 slots OR items[] array.",
  editableFields: [
    { key: "eyebrow", label: "Small kicker", type: { kind: "text", maxLength: 40 }, default: "Recent work", priority: "text", role: "eyebrow", group: "Copy" },
    { key: "heading", label: "Heading", type: { kind: "text", maxLength: 80 }, default: "Some of our projects", priority: "text", role: "headline", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Subheading", type: { kind: "text", maxLength: 200, multiline: true }, default: "", priority: "text", role: "subhead", aiPromptable: true, group: "Copy" },
    ...buildPhotoFields(),
    { key: "surface", role: "surface_mode", label: "Surface", type: { kind: "select", options: [{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }] }, default: "light", group: "Layout" }
  ] as unknown as SectionRegistration<Config>["editableFields"],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "A photo gallery grid. Explain when this beats a carousel.",
    improve: "Curate a stronger subset of 6 photos from 8. Return patched fields only.",
    rewrite: "Rewrite alt text in a {tone} voice for accessibility + SEO.",
    suggestAlternative: "Suggest an alternative when photos are diverse aspect ratios.",
    score: "Score across Loading, Accessibility, Sales, SEO, Mobile, Brand Consistency. JSON only."
  },
  thumbnail: "",
  scoreHints: { loading: { imageWeightBudgetKb: 1200 }, accessibility: { contrastMin: 4.5, requiredAlt: ["photo1Url", "photo2Url", "photo3Url", "photo4Url"] }, sales: { socialProofRecommended: true }, seo: { headingLevel: 2 }, mobile: { minTapTargetPx: 44 }, brandConsistency: { boundTokens: [] } },
  telemetryTags: ["gallery", "grid", "portfolio", "photo_heavy", "shadcn", "framer_motion"],
  bestForVerticals: ["landscaping", "carpentry", "tiling", "roofing", "extension-builder", "kitchen-fitter", "bathroom-fitter", "painter"],
  defaultConfig: () => ({
    eyebrow: "Recent work",
    heading: "Some of our projects",
    subheading: "",
    photo1Url: "", photo1Alt: "Portfolio image 1", photo1Href: "",
    photo2Url: "", photo2Alt: "Portfolio image 2", photo2Href: "",
    photo3Url: "", photo3Alt: "Portfolio image 3", photo3Href: "",
    photo4Url: "", photo4Alt: "Portfolio image 4", photo4Href: "",
    photo5Url: "", photo5Alt: "Portfolio image 5", photo5Href: "",
    photo6Url: "", photo6Alt: "Portfolio image 6", photo6Href: "",
    photo7Url: "", photo7Alt: "Portfolio image 7", photo7Href: "",
    photo8Url: "", photo8Alt: "Portfolio image 8", photo8Href: "",
    surface: "light"
  }),
  renderer: GalleryGrid
};

sectionRegistry.register(registration);
