// NEX Staircase Knowledge Adapter · Types
//
// Philip 2026-08-17 · STANDING.
//
// TypeScript surface for the four machine-readable research files.
// These types describe the SHAPE of the JSON — they are loose on
// purpose (many optional fields, string enums typed as `string`) so a
// v2 corpus can add fields without breaking type-checks.
//
// Consumers should NOT rely on any field being present without checking
// — every accessor in `./index.ts` returns explicit `undefined` /
// `UNKNOWN` when a piece of knowledge is missing, per the research-gaps
// discipline.

export type Confidence = "high" | "medium" | "low" | "unknown" | "needs_review";

export type CountryCode =
  | "UK" | "IE" | "US" | "CA" | "DE" | "AT" | "CH"
  | "IT" | "FR" | "ES" | "NL" | "BE"
  | "SE" | "NO" | "DK" | "FI"
  | "AU" | "NZ";

/** Layer keys from the taxonomy (A · material family, B · geometry,
 *  C · structural, D · riser, E · treads, F · string appearance,
 *  G · balustrade, H · handrail, I · newel, J · landing, K · specialist). */
export type LayerKey =
  | "A_material_family"
  | "B_geometry"
  | "C_structural"
  | "D_riser"
  | "E_treads"
  | "F_string_appearance"
  | "G_balustrade"
  | "H_handrail"
  | "I_newel"
  | "J_landing"
  | "K_specialist";

// ─── staircase-terminology-global.json ─────────────────────────────

export type ConceptRecord = {
  id: string;
  canonical_en: string;
  customer_language?: string;
  regional?: Partial<Record<CountryCode | string, string>>;
  regional_species?: Partial<Record<CountryCode | string, string>>;
  species?: string[];
  sub_types?: string[];
  notes?: string;
  confidence?: Confidence;
  sources?: string[];
  /** Optional canonical image URL for this concept (used by the wizard's
   *  visual comparison overlay). When absent, the compare card renders
   *  a neutral placeholder. Curated images are added to the terminology
   *  JSON as they become available — never fabricated. */
  image_url?: string;
};

export type TerminologyLayer = { concepts: ConceptRecord[] };

export type TerminologyGlobal = {
  $schema: string;
  version: string;
  generated: string;
  scope: {
    countries: CountryCode[];
    principle: string;
    confidence_scale: Confidence[];
  };
  layers: Partial<Record<LayerKey, TerminologyLayer>>;
};

// ─── staircase-decision-tree.json ──────────────────────────────────

export type DecisionOption = {
  value: string;
  label: string;
  concept_id?: string;
  flag?: string;
  route?: string;
  restriction?: string;
  next?: string;
  loads_regional_pack?: CountryCode;
  compare?: string[]; // values to visually compare when 'I'm not sure'
  /** Optional plain-English explanation for the customer, surfaced by a
   *  round `?` help button next to the option (Philip 2026-08-18 · Q2
   *  building context). Explains WHAT the level means and hints at the
   *  kind of downstream requirements / regulations it drives · never
   *  makes hard compliance claims. Missing means no help button
   *  renders for that option. */
  help_en?: string;
  /** Optional short heading rendered above `help_en` when the help
   *  panel opens (Philip 2026-08-18 · Q3 geometry). Use to name what
   *  the option IS (e.g. "Straight Staircase Type") so the customer
   *  knows the panel is about the shape they clicked. Missing = no
   *  heading, help body renders alone. */
  help_title_en?: string;
  /** Optional inline quick-pick shortcut · lets a customer answer a
   *  downstream question in the same click if they already know the
   *  answer (Philip 2026-08-18 · Q3 straight + handrail-position).
   *  Purely optional — clicking the parent card without touching a
   *  quick-pick still records only the shape, and the downstream
   *  question fires normally with its own "I'm not sure" chip.
   *  Preserves Principle 1 (no forced decisions). */
  quick_picks?: {
    /** Node ID the sub-selection writes to (e.g. "Q_handrail_position"). */
    writes_to: string;
    /** Optional heading rendered above the thumbnails. */
    heading_en?: string;
    /** Thumbnails offered to the customer. Selecting one records both
     *  the parent option value AND this sub-value for `writes_to`. */
    options: Array<{
      value: string;
      label: string;
      image_url: string;
    }>;
  };
  /** Optional curated image URL for the option. When present, the
   *  wizard renders a thumbnail above the label in the option card
   *  (Philip 2026-08-18 · Q5 main-design). Images are curated on
   *  ImageKit — URLs are stored verbatim including cache-busting query
   *  params. Missing = no thumbnail (mixed grids are acceptable while
   *  the curated set is being built). Distinct from ConceptRecord.
   *  image_url which is consumed by the compare overlay. */
  image_url?: string;
  /** Optional CSS aspect-ratio value for the option's image slot,
   *  overriding the default 1/1 square (Philip 2026-08-18). Use "2/3"
   *  or "3/4" for portrait staircase photos so they fill the tile
   *  without letterbox. Format is a CSS aspect-ratio string like
   *  "2/3", "3/4", "16/9" — passed straight into inline style. When
   *  siblings in the same question mix aspects, tiles will differ in
   *  height · set consistently across a question's options for a
   *  uniform grid. */
  image_aspect?: string;
  /** Optional array of up to 3 example staircase photos rendered as a
   *  small inline thumbnail row on the option card (Philip 2026-08-20
   *  · Q6a / Q6c / Q7a species). Gives the customer a visual reference
   *  of what a staircase actually looks like in the chosen wood
   *  species. Missing / empty = no thumbnail row renders (honest empty
   *  state — no fabricated visuals). Third-party CDN URLs; distinct
   *  from `image_url` (which is the wood swatch shown as the primary
   *  thumb). */
  example_staircases?: string[];
  /** Optional geographic origin label rendered as an info line on the
   *  option card (Philip 2026-08-19 · Q6a / Q7a timber species). Free-form
   *  string — regional or country label as appropriate ("Europe",
   *  "West Africa", "SE Asia", "N. America"). Displayed alongside
   *  `hardness` under the option label. Missing = no origin line renders. */
  origin?: string;

  /** Optional wood hardness classification rendered on the option card
   *  next to `origin` (Philip 2026-08-19 · Q6a / Q7a timber species).
   *  Enum-typed so canonical identity is preserved across surfaces —
   *  UI looks up the display label. Missing = no hardness rendered. */
  hardness?: "hardwood" | "softwood";

  /** Optional cross-node compatibility gate (Philip 2026-08-19). When
   *  set, this option is only shown if the customer's answer to the
   *  named prerequisite node is IN the allow-list. Multiple keys
   *  AND-combine (all gates must pass). Missing = always compatible
   *  (default behaviour, backward-compat). Special case: if the
   *  prerequisite answer is UNKNOWN_VALUE (customer picked "not sure"
   *  upstream) or missing entirely, the gate is skipped and the option
   *  is shown — the doctrine says No Forced Decisions upstream should
   *  never restrict downstream choice. Used by Q5 to hide structural
   *  types the customer's Q4 material can't fulfill (wood-maker
   *  supplier constraint). */
  compatible_with?: Record<string, string[]>;
  /** Optional usage-context tag surfacing on the option card as a
   *  small chip so customers see at-a-glance where this design is
   *  typically installed (Philip 2026-08-19 · Q5_structural). Independent
   *  of the specialist-review flag — a design can be "both" AND still
   *  require specialist review. Missing = no chip renders. Three
   *  values: 'private_residence' (home only), 'commercial' (non-domestic
   *  only), 'both' (used in both settings). */
  usage?: "private_residence" | "commercial" | "both";
  /** Optional list of curated "installed example" images (photos of
   *  finished staircases of this type in real settings). When present,
   *  the option card surfaces a small "Examples" chip that opens a
   *  lightbox. The lightbox dismisses back to the wizard without
   *  changing selection state (Philip 2026-08-18). Missing / empty =
   *  no chip renders. Curated set typically 3-4 photos per option ·
   *  never fabricated. Two accepted shapes:
   *    · bare string URL                                (no caption)
   *    · `{ url, caption }` object                      (optional caption
   *      rendered as an overlay pill at the bottom of the tile + the
   *      enlarged view — Philip 2026-08-18: label configurations like
   *      "Left Side Handrail" so the customer knows what each photo
   *      demonstrates).
   *  Union kept for backwards compatibility with earlier entries. */
  installed_examples?: Array<string | { url: string; caption?: string }>;
};

export type DecisionNode = {
  question_en: string;
  explanation_en?: string;
  /** Node UI type. `textarea` renders a freeform text input (customer
   *  notes). `info_card` renders a body-copy + CTA card that only has
   *  one forward action (used for deferred placeholders like the
   *  attachments-in-chat card). Both are Philip 2026-08-18 additions
   *  for the project-classification block. */
  type:
    | "single_select"
    | "multi_select"
    | "review_screen"
    | "handoff"
    | "textarea"
    | "info_card";
  region_aware?: boolean;
  if_material_not_timber?: "skip";
  options?: DecisionOption[];
  /** Textarea nodes only · placeholder shown when the field is empty. */
  placeholder_en?: string;
  /** Textarea nodes only · soft character limit. */
  max_length?: number;
  /** Info_card nodes only · body copy under the question. */
  body_en?: string;
  /** Info_card nodes only · label for the single forward CTA button. */
  cta_label_en?: string;
  /** As of corpus v1.2 each entry is a full `DecisionOption` (value +
   *  label + any of image_url, origin, hardness, compatible_with, next,
   *  etc.). Legacy v1.0 `string[]` shape is still accepted defensively —
   *  see `getDecisionNode` in `./index.ts` for the compatibility layer.
   *  Widened 2026-08-20 · Philip: Q7a country arrays carry per-species
   *  images and metadata that were previously being stripped by the
   *  narrower {value, label} contract. */
  options_by_country?: Partial<
    Record<
      CountryCode,
      Array<string | DecisionOption>
    >
  >;
  next?: string;
  conditional_next?: Record<string, string>;
  actions?: Array<{ action: string; label: string; route?: string }>;
  message_en?: string;
  attaches?: string[];
};

export type DecisionTree = {
  $schema: string;
  version: string;
  generated: string;
  purpose: string;
  handoff_rule: string;
  root: string;
  nodes: Record<string, DecisionNode>;
};

// ─── staircase-compatibility.json ──────────────────────────────────

export type CompatibilityRule = {
  id: string;
  description: string;
  if: Record<string, unknown>;
  then: string;
  regions_common?: CountryCode[];
  restrictions?: string[];
  regional_notes?: Partial<Record<CountryCode, string>>;
  regional_thresholds?: Partial<Record<CountryCode, string>>;
  note?: string;
};

export type CompatibilityFile = {
  $schema: string;
  version: string;
  generated: string;
  purpose: string;
  principles: string[];
  rules: CompatibilityRule[];
  regional_common_defaults: Partial<
    Record<
      CountryCode,
      {
        most_common_geometry?: string[];
        most_common_material?: string | string[];
        most_common_structural?: string | string[];
        most_common_balustrade?: string[];
        note?: string;
        notable_market?: string;
        notable_species?: string[];
        protected_species?: string[];
      }
    >
  >;
};

// ─── staircase-regional-terminology.json ───────────────────────────

export type RegionalPack = {
  language: string;
  code_anchor: string;
  terms: Record<string, string> | string;
  colloquialisms?: Record<string, string>;
  false_friends?: Record<string, string>;
  notable?: string;
  native_species?: string[];
  protected_species?: string[];
};

export type RegionalTerminologyFile = {
  $schema: string;
  version: string;
  generated: string;
  purpose: string;
  countries: Partial<Record<CountryCode, RegionalPack>>;
};

// ─── Adapter public shapes ─────────────────────────────────────────

export type SpecialistReviewRequirement = {
  required: boolean;
  reason?: string;
  rule_id?: string;
  regional_thresholds?: Partial<Record<CountryCode, string>>;
};

export type CustomerExplanation = {
  canonical: string;
  plain: string;
  confidence: Confidence;
  regional_label?: string;
  regional_notes?: string;
};

export type AlternativeSet = {
  question_id: string;
  question_plain_en: string;
  alternatives: Array<{
    value: string;
    label: string;
    concept_id?: string;
    plain_en?: string;
    image_url?: string;
  }>;
};

/** Everything the wizard needs to render one screen. */
export type WizardNode = {
  id: string;
  question: string;
  explanation?: string;
  type: DecisionNode["type"];
  options: DecisionOption[];
  isTerminal: boolean;
  /** Textarea nodes only — placeholder + soft character limit. */
  placeholder?: string;
  maxLength?: number;
  /** Info_card nodes only — body copy + label for the single forward CTA. */
  body?: string;
  ctaLabel?: string;
};
