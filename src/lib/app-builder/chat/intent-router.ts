// NEX App Builder · Chat · Intent router (Philip 2026-08-14).
//
// Takes a customer's plain-English prompt and picks a STARTER template.
// Uses keyword-intersection · no third-party LLM (per NEX Core Dependency Rule).
//
// Extending: add another entry to TEMPLATE_ROUTES. Every template must
// have keywords that unambiguously identify the vertical.

import type { AppBlueprint } from "../blueprint-schema";
import {
  scenario1_SimpleElectrician,
  scenario2_MultiPageKitchen,
  scenario3_ImageHeavyPhotographer,
  scenario4_EcommerceFurniture,
  scenario5_ServiceBusinessPlumber,
  scenario10_LargeWebsite
} from "../examples/phase10-scenarios";
import { staircaseCompletedBlueprint } from "../examples/staircase-company-completed";

export type StarterTemplate = {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  build: () => AppBlueprint;
};

const TEMPLATE_ROUTES: StarterTemplate[] = [
  {
    id: "staircase",
    label: "Staircase company",
    description: "Bespoke staircase design, manufacture and installation",
    keywords: ["staircase", "stair", "stairs", "banister", "handrail", "balustrade"],
    // Phase 20 · Philip 2026-08-14 · Return the completed staircase seed so
    // the App Builder produces a fully-populated app (products including
    // Helix, services, gallery) rather than a bare shell. The owner then
    // customises via NEX Assist mutations on the workspace.
    build: () => staircaseCompletedBlueprint
  },
  {
    id: "plumbing",
    label: "Plumbing & heating",
    description: "Local plumber with a service area",
    keywords: ["plumb", "plumber", "boiler", "heating", "leak", "pipe"],
    build: () => scenario5_ServiceBusinessPlumber()
  },
  {
    id: "electrician",
    label: "Electrician",
    description: "Simple local electrical services website",
    keywords: ["electric", "electrician", "rewire", "electrical", "eicr"],
    build: () => scenario1_SimpleElectrician()
  },
  {
    id: "kitchen",
    label: "Kitchen fitter",
    description: "Kitchen design and installation portfolio",
    keywords: ["kitchen", "cabinet", "worktop", "cabinetry"],
    build: () => scenario2_MultiPageKitchen()
  },
  {
    id: "photographer",
    label: "Photographer",
    description: "Image-heavy portfolio and gallery site",
    keywords: ["photo", "photograph", "photographer", "portrait", "wedding photog"],
    build: () => scenario3_ImageHeavyPhotographer()
  },
  {
    id: "furniture",
    label: "Furniture maker (ecommerce)",
    description: "Product catalog with Stripe checkout",
    keywords: ["furniture", "chair", "table", "cabinet", "handmade"],
    build: () => scenario4_EcommerceFurniture()
  },
  {
    id: "renderer",
    label: "Renderer / masonry (large site)",
    description: "Large multi-page architectural site",
    keywords: ["render", "masonry", "stone", "plasterer", "brick"],
    build: () => scenario10_LargeWebsite()
  }
];

export type IntentRouteResult =
  | { kind: "matched"; template: StarterTemplate; score: number; matchedKeywords: string[] }
  | { kind: "ambiguous"; candidates: StarterTemplate[] }
  | { kind: "unknown"; suggestions: StarterTemplate[] };

/** Route a customer prompt to a starter template. */
export function routeIntent(prompt: string): IntentRouteResult {
  const p = prompt.toLowerCase();
  const scored: Array<{ template: StarterTemplate; score: number; matched: string[] }> = [];

  for (const template of TEMPLATE_ROUTES) {
    const matched: string[] = [];
    let score = 0;
    for (const kw of template.keywords) {
      if (p.includes(kw)) {
        matched.push(kw);
        // Longer keyword = more specific match
        score += kw.length;
      }
    }
    if (score > 0) scored.push({ template, score, matched });
  }

  scored.sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { kind: "unknown", suggestions: TEMPLATE_ROUTES.slice(0, 5) };
  }

  // Clear winner if top score is at least 1.5× the second-best
  if (scored.length === 1 || scored[0].score >= scored[1].score * 1.5) {
    return {
      kind: "matched",
      template: scored[0].template,
      score: scored[0].score,
      matchedKeywords: scored[0].matched
    };
  }

  // Two or more close matches
  return { kind: "ambiguous", candidates: scored.slice(0, 3).map((s) => s.template) };
}

export function listStarterTemplates(): StarterTemplate[] {
  return [...TEMPLATE_ROUTES];
}

export function getStarterTemplateById(id: string): StarterTemplate | null {
  return TEMPLATE_ROUTES.find((t) => t.id === id) ?? null;
}
