// Nex Recommendation Engine (Pipeline Stage 8b).
//
// Given a query + retrieved knowledge + identity + intent, generates a set of
// VOLUNTEERED recommendations across 12 categories. Rule-based MVP · reads
// coordination rules from _shared/design-coordination/ conceptually + hardcoded
// coordination table for MVP performance.
//
// Doctrine: docs/brains/nex-recommendation-engine-philip-2026-08-03.md
// Composes with Foundation Brain 6 + Foundation Brain 15.

import type { IdentityRegister } from "../identity";
import type { IntentClassification } from "../universal-intent";

export type RecommendationCategory =
  | "design"
  | "future_ideas"
  | "considerations"
  | "related_products"
  | "budget"
  | "timeline"
  | "common_mistakes"
  | "maintenance"
  | "images"
  | "professionals"
  | "planning_checklist"
  | "next_project";

/** Priority tier per Recommendation Objects doctrine (Philip 2026-08-03).
 *  Essential = ★★★★★ · Recommended = ★★★★ · Optional = ★★★ · Luxury = ★★ · Decorative = ★ */
export type RecommendationPriority = "Essential" | "Recommended" | "Optional" | "Luxury" | "Decorative";

/** Difficulty tier — informs whether the customer can DIY or needs a pro. */
export type RecommendationDifficulty = "Easy" | "Medium" | "Complex" | "Expert";

/** Structured budget impact per Philip's Budget Impact schema. */
export type BudgetImpact = {
  extra_cost_gbp?: { min: number; max: number };
  savings_gbp?: number;
  property_value_uplift_gbp?: number;
  can_delay?: boolean;
};

/** Compatibility star rating per Compatibility Engine doctrine. */
export type CompatibilityEntry = {
  element: string;
  stars: 0 | 1 | 2 | 3 | 4 | 5;
  reason?: string;
};

/** User-clickable action offered on a recommendation card. */
export type RecommendationAction = {
  id: string;
  label: string;
  leads_to: string;
};

/** Full Recommendation Object — first-class structured object per Phase D.7 doctrine.
 *  All new fields are optional to preserve backward compatibility with Phase D.6 rules. */
export type Recommendation = {
  /** Category (12-value enum from Phase D.6). */
  category: RecommendationCategory;
  /** Human-readable title/item. Backward-compatible with Phase D.6 `item`. */
  item: string;
  /** WHY this recommendation exists (Foundation Brain 6). */
  reason: string;
  /** Source citation (Evidence Quality metric · Rule c). */
  source: string;
  /** Optional next-step offer (Foundation Brain 15). */
  next_step?: string;
  /** Retrieval confidence 0..1. */
  confidence: number;
  // ─── Phase D.7 additions ───
  /** Stable unique ID for logging + interactive UIs. */
  id?: string;
  /** Priority tier — helps users understand what MATTERS most. */
  priority?: RecommendationPriority;
  /** Difficulty tier — helps route DIY vs pro. */
  difficulty?: RecommendationDifficulty;
  /** Best time to do this (e.g. "Before staircase installation"). */
  best_time?: string;
  /** Pros (positive trade-offs · Foundation Brain 6). */
  pros?: readonly string[];
  /** Cons (negative trade-offs · Foundation Brain 6). */
  cons?: readonly string[];
  /** Related domains beyond the primary. */
  related_domains?: readonly string[];
  /** Specimen image URLs from the manifest (Image-Driven Recommendations). */
  images?: readonly string[];
  /** Brain article paths to consult for deep-dive (Evidence Quality metric). */
  brain_articles?: readonly string[];
  /** What to ask next to refine the recommendation. */
  next_questions?: readonly string[];
  /** Interactive actions the user can take. */
  actions?: readonly RecommendationAction[];
  /** Budget impact (Philip's 4-question schema). */
  budget_impact?: BudgetImpact;
  /** Compatibility Engine matrix — what pairs · what conflicts. */
  compatibility?: {
    matches?: readonly CompatibilityEntry[];
    conflicts?: readonly CompatibilityEntry[];
  };
};

export type RecommendationSet = {
  categories: Partial<Record<RecommendationCategory, Recommendation[]>>;
  total_count: number;
  register_adapted_for: IdentityRegister;
  trace_reason: string;
};

// ─── Design Coordination Rules (from _shared/design-coordination/) ───

type CoordinationRule = {
  when_domain: string;
  suggests: Array<{
    category: RecommendationCategory;
    item: string;
    reason: string;
    source: string;
    next_step?: string;
    // Phase D.7 optional fields — coordination rules can carry the extended object shape
    priority?: RecommendationPriority;
    difficulty?: RecommendationDifficulty;
    pros?: readonly string[];
    cons?: readonly string[];
    images?: readonly string[];
    budget_impact?: BudgetImpact;
    compatibility?: Recommendation["compatibility"];
    actions?: readonly RecommendationAction[];
    next_questions?: readonly string[];
  }>;
};

const COORDINATION_RULES: CoordinationRule[] = [
  {
    when_domain: "kitchen",
    suggests: [
      // Enriched example · demonstrates full Phase D.7 Recommendation Object schema
      {
        category: "design",
        item: "Oak staircase (matching timber species + palette)",
        reason: "Matches the shaker/oak language · classic pairing · repeats through the home · staircase and kitchen are the two largest joinery items and should feel like one project",
        source: "_shared/design-coordination/staircase-and-kitchen-relationship.md",
        priority: "Essential",
        difficulty: "Medium",
        pros: [
          "Creates single design language across the home",
          "Increases perceived quality + resale value",
          "One workshop can manufacture both (shared timber batch · matched spray colour · one warranty)",
          "Simpler project management (one designer · one install team)",
        ],
        cons: [
          "Higher upfront cost than sourcing separately",
          "Longer lead time coordinating both",
          "Commits to a single timber for both features",
        ],
        images: [
          "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%203,%202026,%2010_15_45%20PM.png",
          "https://ik.imagekit.io/5vv5pw26q/Untitledsadasdvv.png",
          "https://ik.imagekit.io/5vv5pw26q/Untitledsadasdvvasdds.png",
          "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%203,%202026,%2010_33_28%20PM.png",
          "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%203,%202026,%2010_48_29%20PM.png",
        ],
        budget_impact: {
          extra_cost_gbp: { min: 8000, max: 15000 },
          savings_gbp: 500,
          property_value_uplift_gbp: 12000,
          can_delay: false,
        },
        compatibility: {
          matches: [
            { element: "oak_flooring", stars: 5 },
            { element: "shaker_kitchen", stars: 5 },
            { element: "walnut_accents", stars: 4 },
            { element: "grey_walls", stars: 4 },
          ],
          conflicts: [
            { element: "high_gloss_black_kitchen", stars: 2, reason: "Style clash · era mismatch" },
            { element: "red_laminate_flooring", stars: 0, reason: "Colour clash · disrupts visual continuity" },
          ],
        },
        actions: [
          { id: "view_examples", label: "View 5 coordinated examples", leads_to: "image_gallery?tag=coordinated_kitchen_staircase&min=5" },
          { id: "compare_timber", label: "Compare oak vs walnut", leads_to: "domain/staircase/faq?q=oak_or_walnut" },
          { id: "calculate_budget", label: "Get a coordinated joinery budget", leads_to: "budget_estimator?scope=kitchen_plus_staircase" },
          { id: "book_visit", label: "Book a whole-home joinery survey", leads_to: "book/site_visit" },
        ],
        next_questions: [
          "Do you want the same timber species throughout?",
          "Painted or natural finish?",
          "Is the staircase visible from the kitchen?",
          "Are you renovating the whole ground floor?",
        ],
        next_step: "Want to see 5 coordinated kitchen+staircase examples with oak timber?",
      },
      { category: "design", item: "Oak or engineered oak flooring", reason: "Creates visual continuity from hallway to kitchen", source: "_shared/design-coordination/matching-your-kitchen-with-the-rest-of-your-home.md", priority: "Recommended", difficulty: "Medium", budget_impact: { extra_cost_gbp: { min: 2000, max: 5000 }, can_delay: true, property_value_uplift_gbp: 4000 } },
      { category: "design", item: "Coordinated internal doors", reason: "Same timber species + moulding profile ties the joinery together", source: "_shared/design-coordination/matching-your-kitchen-with-the-rest-of-your-home.md" },
      { category: "design", item: "Matching wall panelling", reason: "Continuing panelling from hallway through staircase to kitchen reads professionally designed", source: "_shared/design-coordination/staircase-and-kitchen-relationship.md" },
      { category: "related_products", item: "Satin brass handles across kitchen + doors + light fittings", reason: "One metal finish throughout coordinates every visible detail", source: "_shared/design-coordination/matching-your-kitchen-with-the-rest-of-your-home.md" },
      { category: "budget", item: "Typical bespoke kitchen £15k-£40k + coordinated staircase £8k-£15k", reason: "Whole-home joinery package · balanced investment principle", source: "kitchen/articles/kitchen-vs-staircase-budget-allocation.md", next_step: "Want a costed whole-home joinery breakdown?" },
      { category: "timeline", item: "12-22 weeks from design meeting to fully finished kitchen · 6-10 weeks manufacturing", reason: "Standard bespoke timeline · order appliances early", source: "kitchen/faqs.jsonl faq-042" },
      { category: "common_mistakes", item: "Mixing too many timber colours · using different metal finishes · ignoring how kitchen and staircase look together", reason: "Three of the top 10 kitchen design mistakes", source: "_shared/design-coordination/matching-your-kitchen-with-the-rest-of-your-home.md" },
      { category: "planning_checklist", item: "15-step planning journey (Understand needs → Measure → Budget → Style → Layout → Storage → Appliances → Worktop → Doors → Lighting → Flooring → Services → Details → Install → Enjoy)", reason: "Structured process avoids common mistakes", source: "kitchen/articles/kitchen-planning-journey.md", next_step: "Want to walk through the 15 steps together?" },
      { category: "professionals", item: "Kitchen designer · plumber · electrician · plasterer · decorator · flooring fitter", reason: "Multi-trade coordination · one lead contractor recommended", source: "_shared/trade-business/articles/customer-communication.md" },
      { category: "next_project", item: "Utility room · pantry · boot room · matching fitted furniture", reason: "Same workshop can extend the design language into adjacent spaces", source: "_shared/design-coordination/staircase-is-the-spine.md" },
    ],
  },
  {
    when_domain: "staircase",
    suggests: [
      { category: "design", item: "Coordinated kitchen (matching timber + palette)", reason: "Staircase + kitchen are the two largest joinery items in most homes — should feel like one project", source: "_shared/design-coordination/staircase-and-kitchen-relationship.md" },
      { category: "design", item: "Matching internal doors", reason: "Same timber species + moulding profile ties the joinery together across the whole home", source: "_shared/design-coordination/staircase-design-dos-and-donts.md" },
      { category: "design", item: "Continuous flooring hallway → staircase → living spaces", reason: "One floor connects everything · no visual breaks", source: "_shared/design-coordination/staircase-and-kitchen-relationship.md" },
      { category: "design", item: "Under-stair storage (pantry · wine · coat cupboard · boot room · pet station)", reason: "Turns dead space into value · often the highest-ROI joinery add-on", source: "docs/brains/staircase-understair-storage-integration-philip-2026-08-03.md" },
      { category: "related_products", item: "LED tread lighting · handrail lighting · plinth lighting on same warm-white circuit as kitchen under-cabinet", reason: "One lighting language throughout the sight-line", source: "_shared/design-coordination/staircase-is-the-spine.md" },
      { category: "budget", item: "Staircase typically 8-15% of a full renovation · £8k-£15k for £100k projects · £30k-£60k for luxury £300k projects", reason: "Balanced investment principle · staircase creates strongest first impression", source: "kitchen/articles/kitchen-vs-staircase-budget-allocation.md" },
      { category: "timeline", item: "Design + revisions 2-4 weeks · manufacturing 4-8 weeks · install 3-7 days · decoration + snag 1-2 weeks", reason: "Standard bespoke staircase timeline · coordinate with adjacent renovation work", source: "docs/brains/staircase-installation-site-preparation-*.md" },
      { category: "common_mistakes", item: "Choosing the staircase before planning the interior · mixing timber colours · ignoring sight lines from the entrance · forgetting to plan lighting", reason: "Four of the top 10 staircase design mistakes", source: "_shared/design-coordination/staircase-design-dos-and-donts.md" },
      { category: "considerations", item: "Sight lines from front door · sight lines from kitchen · Approved Doc K regulations · Building Control if structural", reason: "Sight-line coordination is what separates good design from great · regs are non-negotiable", source: "_shared/design-coordination/staircase-design-dos-and-donts.md" },
      { category: "planning_checklist", item: "Site visit · floor-to-floor measurement · headroom check · light angle for balustrade · services location · Approved Doc K check · design + revisions · quotation · manufacturing · install · snag · handover", reason: "Standard staircase project sequence · every stage matters", source: "_shared/trade-business/articles/site-visit-process.md", next_step: "Want to book a site visit?" },
      { category: "professionals", item: "Bespoke staircase manufacturer · joiner for install · electrician for LED · structural engineer if load-bearing walls involved · plasterer for making-good", reason: "Multi-trade coordination often needed", source: "docs/brains/staircase-floating-engineering-slatted-balustrade-philip-2026-08-03.md" },
      { category: "next_project", item: "Coordinated kitchen · utility room · fitted wardrobes · media wall · window seats · library/study joinery", reason: "One workshop can extend the same design language across the whole home", source: "_shared/trade-business/articles/trade-capability-crossover.md" },
    ],
  },
];

// ─── Register-based depth ───

const DEPTH_BY_REGISTER: Record<IdentityRegister, number> = {
  homeowner_novice: 3,
  homeowner_informed: 4,
  builder: 5,
  joiner: 6,
  architect: 6,
  interior_designer: 5,
  developer: 5,
  manufacturer: 6,
  student: 4,
  diy: 4,
  business_owner: 4,
};

const MAX_CATEGORIES_BY_REGISTER: Record<IdentityRegister, number> = {
  homeowner_novice: 4,
  homeowner_informed: 5,
  builder: 5,
  joiner: 6,
  architect: 6,
  interior_designer: 5,
  developer: 5,
  manufacturer: 6,
  student: 5,
  diy: 4,
  business_owner: 5,
};

export function generateRecommendations(
  domain: string,
  intent: IntentClassification,
  register: IdentityRegister,
): RecommendationSet {
  const rule = COORDINATION_RULES.find((r) => r.when_domain === domain);
  if (!rule) {
    return {
      categories: {},
      total_count: 0,
      register_adapted_for: register,
      trace_reason: `no coordination rules for domain '${domain}'`,
    };
  }

  const depthPerCategory = DEPTH_BY_REGISTER[register] ?? 4;
  const maxCategories = MAX_CATEGORIES_BY_REGISTER[register] ?? 5;

  // Bucket suggestions by category · then trim each bucket to depth · then pick top N categories.
  const byCategory: Partial<Record<RecommendationCategory, Recommendation[]>> = {};
  let idCounter = 1;
  for (const suggestion of rule.suggests) {
    const rec: Recommendation = {
      category: suggestion.category,
      item: suggestion.item,
      reason: suggestion.reason,
      source: suggestion.source,
      next_step: suggestion.next_step,
      confidence: 0.9,
      // Phase D.7 additions · pass through all provided fields
      id: `rec_${domain}_${String(idCounter++).padStart(3, "0")}`,
      priority: suggestion.priority,
      difficulty: suggestion.difficulty,
      pros: suggestion.pros,
      cons: suggestion.cons,
      images: suggestion.images,
      budget_impact: suggestion.budget_impact,
      compatibility: suggestion.compatibility,
      actions: suggestion.actions,
      next_questions: suggestion.next_questions,
    };
    if (!byCategory[suggestion.category]) byCategory[suggestion.category] = [];
    if (byCategory[suggestion.category]!.length < depthPerCategory) {
      byCategory[suggestion.category]!.push(rec);
    }
  }

  // Prioritise categories relevant to intent verb.
  const priorityCategories = pickPriorityCategories(intent, byCategory, maxCategories);

  const filtered: Partial<Record<RecommendationCategory, Recommendation[]>> = {};
  let total = 0;
  for (const cat of priorityCategories) {
    filtered[cat] = byCategory[cat];
    total += byCategory[cat]?.length ?? 0;
  }

  return {
    categories: filtered,
    total_count: total,
    register_adapted_for: register,
    trace_reason: `generated ${total} recommendations across ${priorityCategories.length} categories · register=${register} depth=${depthPerCategory} maxCats=${maxCategories}`,
  };
}

function pickPriorityCategories(
  intent: IntentClassification,
  available: Partial<Record<RecommendationCategory, Recommendation[]>>,
  maxCategories: number,
): RecommendationCategory[] {
  const availableCats = Object.keys(available) as RecommendationCategory[];
  // Intent-based priority.
  const preferenceByVerb: Record<string, RecommendationCategory[]> = {
    Create: ["design", "planning_checklist", "related_products", "budget", "timeline", "professionals", "next_project"],
    Communicate: ["design", "considerations", "related_products"],
    Decide: ["design", "considerations", "common_mistakes", "related_products", "budget"],
    Plan: ["planning_checklist", "timeline", "budget", "professionals", "next_project", "considerations"],
    Manage: ["considerations", "maintenance", "professionals"],
    Automate: ["planning_checklist", "considerations"],
    Analyse: ["considerations", "common_mistakes"],
    Learn: ["design", "considerations", "common_mistakes", "related_products", "images"],
    Improve: ["considerations", "common_mistakes", "maintenance", "next_project"],
    Monitor: ["maintenance", "considerations"],
  };
  const preferred = preferenceByVerb[intent.layer1_verb] ?? ["design", "considerations", "related_products"];
  const ordered = preferred.filter((c) => availableCats.includes(c));
  // Fill remaining slots with any remaining categories.
  for (const c of availableCats) if (!ordered.includes(c) && ordered.length < maxCategories) ordered.push(c);
  return ordered.slice(0, maxCategories);
}
