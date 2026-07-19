// Template 1 — Chalk (default).
//
// The current canteen layout, wrapped in the template contract. Ships
// as the platform default so every existing canteen keeps rendering
// identically post-cutover. Divergent design work (extracting a
// bespoke hero, changing feed shape, etc.) happens under this folder
// in follow-up sessions.

import type { Template } from "../_contract";
import { Template1Chalk } from "./Template";

const template: Template = {
  meta: {
    slug: "template-1-chalk",
    name: "Chalk",
    tagline: "The bright, kitchen-fitter canteen. Cream surfaces, warm brown accents, floating KPI cards.",
    defaultPaletteSlug: "chalk",
    previewCanteenSlug: "uk-kitchen-fitters",
    version: "1.0.0"
  },
  Component: Template1Chalk
};

export default template;
