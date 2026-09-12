// src/lib/nex1-orchestrator/understanding.ts
// Deterministic keyword-based understanding extractor.
// NO LLM. NO network. Regex + slot-filling only.

import type { StructuredIntent } from "./types";

const PAGE_TYPE_HINTS: Array<{ re: RegExp; page_type: string }> = [
  { re: /\b(landing|home)\s+page\b/i,                                      page_type: "landing_page" },
  { re: /\becommerce|shop|store|catalog(ue)?\b/i,                          page_type: "ecommerce" },
  { re: /\b(marketplace|multi[-\s]?vendor)\b/i,                            page_type: "marketplace" },
  { re: /\bdashboard|admin panel|control panel\b/i,                        page_type: "dashboard" },
  { re: /\bportfolio|showcase|gallery\b/i,                                 page_type: "portfolio" },
  { re: /\bblog|news site|magazine\b/i,                                    page_type: "blog" },
  { re: /\bdocs? site|documentation site|knowledge base\b/i,               page_type: "documentation" },
];

const GOAL_HINTS: Array<{ re: RegExp; primary_goal: string }> = [
  { re: /\benquir(y|ies)|contact form|quote\b/i,                           primary_goal: "lead_generation" },
  { re: /\bcheckout|purchase|buy now|payment\b/i,                          primary_goal: "conversion" },
  { re: /\bsign\s?up|register|create account\b/i,                          primary_goal: "signup" },
  { re: /\bbrowse|discover|explore|catalog\b/i,                            primary_goal: "product_discovery" },
  { re: /\bnewsletter|subscribe\b/i,                                       primary_goal: "subscription" },
];

const FEATURE_HINTS: Array<{ re: RegExp; feature: string }> = [
  { re: /\bproduct cate(gor|gories)\b/i,                                   feature: "product_categories" },
  { re: /\btimber|wood|hardwood|softwood\b/i,                              feature: "timber_categories" },
  { re: /\bimagery|images|photos|photography|gallery\b/i,                  feature: "product_imagery" },
  { re: /\bresponsive|mobile[-\s]?friendly|mobile layout\b/i,              feature: "responsive_mobile" },
  { re: /\bcontact form|enquiry form\b/i,                                  feature: "contact_form" },
  { re: /\bshopping cart|basket\b/i,                                       feature: "cart" },
  { re: /\bsearch\b/i,                                                     feature: "search" },
  { re: /\bfilter|facet(ed)?\b/i,                                          feature: "filters" },
  { re: /\btestimonial|review\b/i,                                         feature: "testimonials" },
  { re: /\bpricing/i,                                                      feature: "pricing" },
];

export function extractStructuredIntent(raw: string): StructuredIntent {
  let page_type: string | undefined;
  for (const h of PAGE_TYPE_HINTS) if (h.re.test(raw)) { page_type = h.page_type; break; }
  let primary_goal: string | undefined;
  for (const h of GOAL_HINTS) if (h.re.test(raw)) { primary_goal = h.primary_goal; break; }
  const must_have_features: string[] = [];
  for (const h of FEATURE_HINTS) if (h.re.test(raw)) must_have_features.push(h.feature);
  // deterministic sort
  must_have_features.sort();
  return {
    page_type, primary_goal,
    audience: undefined,
    must_have_features,
    must_not_have: [],
    deterministic_extractor_version: "v0.1.0-keyword-regex",
  };
}
