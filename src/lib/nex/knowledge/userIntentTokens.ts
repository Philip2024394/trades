// USER INTENT TOKENS — Phase 2 of the NEX Knowledge Engine Roadmap.
//
// For every image, extract the vocabulary NEX uses to understand what
// users mean when they search. Not tags — INTENT tokens grouped by
// category (materials · components · styles · construction · applications
// · search phrases). Downstream Query Decomposer matches user queries
// against these tokens to compute per-fragment understanding confidence.
//
// Per ADR-0034: "The knowledge is the product. The user's intent is
// the destination."

export type IntentCategory =
  | "materials"
  | "components"
  | "styles"
  | "construction"
  | "applications"
  | "search_phrases";

export type UserIntentTokens = {
  materials: string[];
  components: string[];
  styles: string[];
  construction: string[];
  applications: string[];
  search_phrases: string[];
};

/** Category vocabularies — extend as new domains join the Knowledge Engine. */
const VOCAB: Record<IntentCategory, string[]> = {
  materials: [
    "european oak", "american white oak", "white oak", "red oak",
    "walnut", "american walnut", "black walnut",
    "pine", "yellow pine", "red deal", "white deal", "scandinavian pine",
    "sapele", "mahogany", "ash", "beech", "cherry", "birch", "maple",
    "hardwood", "softwood", "engineered timber", "reclaimed timber",
    "glass", "toughened glass", "frameless glass",
    "steel", "stainless steel", "wrought iron", "brass", "brushed steel",
    "stone", "natural stone", "concrete", "brick", "slate",
    "leather", "carpet", "runner", "pink runner", "red runner",
    "mdf", "plywood", "chipboard",
  ],
  components: [
    "handrail", "banister", "baserail", "newel", "newel post",
    "volute", "monkey tail volute", "scroll volute", "spiral volute",
    "baluster", "spindle", "square baluster", "turned baluster", "twisted baluster",
    "string", "cut string", "wall string", "closed string", "open string",
    "tread", "riser", "nosing", "bullnose", "return nosing",
    "landing", "half landing", "quarter landing", "winder",
    "stringer", "carriage", "wedge", "angle block",
    "door", "window", "frame", "hinge", "lock",
    "cabinet", "worktop", "countertop", "backsplash",
  ],
  styles: [
    "victorian", "georgian", "edwardian", "regency", "art deco",
    "arts and crafts", "colonial",
    "contemporary", "modern", "traditional", "transitional", "eclectic",
    "industrial", "loft", "minimalist", "scandinavian", "japandi",
    "rustic", "cottage", "farmhouse", "country",
    "luxury", "premium", "opulent", "grand",
    "coastal", "shabby chic", "french provincial", "mediterranean",
  ],
  construction: [
    "straight flight", "single flight",
    "l-shape", "l-shaped", "quarter turn",
    "u-shape", "u-shaped", "half turn", "half landing",
    "winder", "double winder", "kite winder",
    "curved", "sweeping curve",
    "helical", "spiral",
    "floating", "cantilever", "cantilevered",
    "open riser", "closed riser", "open tread",
    "loft conversion", "loft stair", "space saver", "paddle stair",
    "cut string", "closed string", "housed string",
    "glue block", "angle block", "wedged", "wedge fixed",
    "hardwood joinery", "traditional joinery", "modern joinery",
  ],
  applications: [
    "luxury residence", "luxury home", "mansion", "townhouse", "penthouse",
    "hotel", "boutique hotel", "restaurant", "bar", "cafe",
    "commercial", "office", "retail", "showroom",
    "renovation", "refurbishment", "restoration", "extension",
    "new build", "new-build",
    "cottage", "period property", "listed building", "heritage",
    "loft conversion", "attic conversion", "basement conversion",
    "open plan", "traditional layout",
    "family home", "single-storey", "two-storey", "three-storey", "three floor",
    "residential", "domestic",
  ],
  search_phrases: [
    "oak handrail", "walnut handrail", "glass balustrade",
    "monkey tail volute", "traditional volute",
    "victorian staircase", "victorian handrail", "victorian volute",
    "luxury staircase", "luxury interior", "modern staircase",
    "straight flight staircase", "helical staircase", "floating staircase",
    "loft ladder", "loft stair", "space saver stair",
    "curved staircase", "bespoke staircase",
    "staircase renovation", "handrail replacement", "banister replacement",
  ],
};

/** Extract USER INTENT TOKENS from an image's MASTER DESCRIPTION.
 *  Returns tokens grouped by category — the vocabulary NEX will use
 *  to match user queries. */
export function extractUserIntentTokens(text: string): UserIntentTokens {
  const t = text.toLowerCase();
  const out: UserIntentTokens = {
    materials: [],
    components: [],
    styles: [],
    construction: [],
    applications: [],
    search_phrases: [],
  };
  for (const category of Object.keys(VOCAB) as IntentCategory[]) {
    for (const term of VOCAB[category]) {
      // Word-boundary match for short terms, substring for phrases
      const pattern =
        term.length <= 4
          ? new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
          : new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      if (pattern.test(t) && !out[category].includes(term)) {
        out[category].push(term);
      }
    }
  }
  return out;
}

/** Full vocabulary export for the Query Decomposer to consume. */
export const INTENT_VOCAB = VOCAB;
