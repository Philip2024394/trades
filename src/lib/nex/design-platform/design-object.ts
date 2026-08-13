// Design Platform · The Design Object Model (DOM).
//
// Every noun in Nex is a DesignObject. One object · everywhere:
// the knowledge layer stores it · reasoning recommends it · planning configures
// it · the design platform composes it · the renderer draws it · the delivery
// layer publishes it · the manufacturer builds it · the marketer sells it — all
// from the same row.
//
// Doctrine: docs/brains/nex-design-platform-and-design-object-model-philip-2026-08-04.md

// ─── Taxonomy roots ──────────────────────────────────────────────────────

export type DesignObjectCategory =
  | "ProductObject"
  | "MarketingObject"
  | "ConstructionObject"
  | "DesignTokenObject"
  | "EnvironmentObject";

// Fine-grained type identifiers. Each is a dotted path from the category root ·
// e.g. "ProductObject.Staircase.Handrail" or "MarketingObject.CTA".
export type DesignObjectType = string;

// ─── The 7 capability flags (every object declares what it can do) ───────

export type DesignObjectCapabilities = {
  renderable: boolean;                   // Rendering Platform can draw it
  searchable: boolean;                   // Knowledge Platform can find it
  recommendable: boolean;                // Recommendation Platform can suggest it
  configurable: readonly string[];       // Planning Platform can adjust these named properties
  compatible_with: readonly string[];    // IDs of other DesignObjects this one pairs with
  manufacturable: boolean;               // Workflow Platform knows how to produce it
  marketable: boolean;                   // Marketing Platform knows how to sell it
};

// ─── Provenance (Rule 7 · every decision explainable) ────────────────────

export type DesignObjectProvenance = {
  named_expert?: string;                 // e.g. "Philip O'Farrell"
  authored?: string;                     // ISO date
  knowledge_refs?: readonly string[];    // e.g. ["nex-knowledge/staircase/knowledge.yaml#handrails"]
  version?: string;
  supersedes?: string;                   // previous object id
};

// ─── The DesignObject base contract ──────────────────────────────────────

export type DesignObjectBase = {
  id: string;                            // globally unique
  category: DesignObjectCategory;
  type: DesignObjectType;
  properties: Record<string, unknown>;   // domain-specific (material · size · finish · etc.)
  capabilities: DesignObjectCapabilities;
  provenance: DesignObjectProvenance;
  tags?: readonly string[];
  aliases?: readonly string[];
};

// ─── Specialisations ──────────────────────────────────────────────────────

export type ProductObject = DesignObjectBase & {
  category: "ProductObject";
  properties: {
    material?: string;
    finish?: string;
    dimensions_mm?: { width?: number; height?: number; depth?: number };
    profile?: string;
    style?: string;
    [k: string]: unknown;
  };
};

export type MarketingObject = DesignObjectBase & {
  category: "MarketingObject";
  properties: {
    text?: string;
    role?: "headline" | "subheadline" | "body" | "cta" | "badge" | "feature" | "testimonial" | "contact";
    icon?: string;
    max_chars?: number;
    [k: string]: unknown;
  };
};

export type ConstructionObject = DesignObjectBase & {
  category: "ConstructionObject";
  properties: {
    structural_role?: string;
    material?: string;
    load_bearing?: boolean;
    [k: string]: unknown;
  };
};

export type DesignTokenObject = DesignObjectBase & {
  category: "DesignTokenObject";
  properties: {
    token_kind: "color" | "font" | "spacing" | "radius" | "shadow";
    value: string | number;
    [k: string]: unknown;
  };
};

export type EnvironmentObject = DesignObjectBase & {
  category: "EnvironmentObject";
  properties: {
    kind: "lighting" | "camera" | "hdri" | "weather" | "time_of_day";
    [k: string]: unknown;
  };
};

export type DesignObject = ProductObject | MarketingObject | ConstructionObject | DesignTokenObject | EnvironmentObject;

// ─── Capability defaults ─────────────────────────────────────────────────

/** Sensible capability defaults for a new DesignObject. Individual objects
 *  override any field they want to specify explicitly. */
export function defaultCapabilities(overrides?: Partial<DesignObjectCapabilities>): DesignObjectCapabilities {
  return {
    renderable: true,
    searchable: true,
    recommendable: true,
    configurable: [],
    compatible_with: [],
    manufacturable: false,
    marketable: false,
    ...overrides,
  };
}

// ─── Type guards ─────────────────────────────────────────────────────────

export function isProduct(obj: DesignObject): obj is ProductObject { return obj.category === "ProductObject"; }
export function isMarketing(obj: DesignObject): obj is MarketingObject { return obj.category === "MarketingObject"; }
export function isConstruction(obj: DesignObject): obj is ConstructionObject { return obj.category === "ConstructionObject"; }
export function isDesignToken(obj: DesignObject): obj is DesignTokenObject { return obj.category === "DesignTokenObject"; }
export function isEnvironment(obj: DesignObject): obj is EnvironmentObject { return obj.category === "EnvironmentObject"; }
