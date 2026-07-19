// Template registry — the ONE place that maps template slugs to
// template implementations. Adding a new template = create a folder
// under `src/templates/<slug>/`, export `{ meta, Component }`, add
// one line here.
//
// Canteen page (src/app/trade-off/yard/canteens/[slug]/page.tsx)
// reads canteen.templateSlug, resolves the template via
// `resolveTemplate()`, and renders `<Component data={...}/>`. If the
// slug is missing / unknown, `resolveTemplate` falls back to Template
// 1 (Chalk) — the platform default.

import type { Template, TemplateMeta } from "./_contract";
import template1Chalk from "./template-1-chalk";

/** One layout, palette-driven variance (Philip 2026-07-16 — after
 *  the T1/T2/T3 experiment, the platform is going back to a single
 *  template with customer choice on colour, mode, and intensity
 *  instead of layout divergence). Adding a new template is still a
 *  1-line change if we need to reverse this later. */
export const TEMPLATES: Record<string, Template> = {
  [template1Chalk.meta.slug]: template1Chalk
};

/** Platform-wide default. Used when a canteen has no template_slug
 *  or an unknown template_slug (e.g. a template was renamed). */
export const DEFAULT_TEMPLATE_SLUG = template1Chalk.meta.slug;

/** Resolve a canteen's template. Never returns null — always falls
 *  back to the default template. */
export function resolveTemplate(slug: string | null | undefined): Template {
  if (slug && TEMPLATES[slug]) return TEMPLATES[slug];
  return TEMPLATES[DEFAULT_TEMPLATE_SLUG]!;
}

/** All template metadata — powers the picker + admin views. */
export function allTemplateMeta(): readonly TemplateMeta[] {
  return Object.values(TEMPLATES).map((t) => t.meta);
}
