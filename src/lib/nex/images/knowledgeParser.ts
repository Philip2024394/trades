// NEX Image Knowledge Parser (ADR-0026).
//
// Takes two authored inputs — MASTER DESCRIPTION + MASTER AI PROMPT —
// and derives the complete ImageKnowledge structure:
//
//   IMAGE DNA (nested, versioned, with score + hash)
//   AI INTENT
//   LOCKED ATTRIBUTES
//   MATERIAL JOURNEY
//   OBJECTS
//   TAGS
//   SETTING / MOOD / VIEW / PALETTE / SUBJECT DOMAIN
//
// Zero user maintenance beyond the two authored fields. Runs at save
// time in the tagger and on any subsequent re-parse (e.g. when the
// parser algorithm improves and we bump image_dna.version).

// ── Public types ────────────────────────────────────────────────

/** Confidence band per ADR-0027 Rule #6. */
export type ConfidenceBand = "very-high" | "high" | "good" | "flag-for-review";

export function bandFromDNAScore(score: number): ConfidenceBand {
  if (score >= 99) return "very-high";
  if (score >= 95) return "high";
  if (score >= 85) return "good";
  return "flag-for-review";
}

/** ADR-0035 Second Law · 7-band classification. Every image gets a
 *  band. There is no "failed" band — the lowest is Visual Knowledge,
 *  which is still knowledge. Score = amount of knowledge extracted,
 *  never the image's value. */
export type KnowledgeBand =
  | "master" // 97-100
  | "excellent" // 90-96
  | "good" // 75-89
  | "specialist" // 60-74
  | "reference" // 40-59
  | "limited" // 20-39
  | "visual"; // 1-19

export function knowledgeBandFromScore(score: number): KnowledgeBand {
  if (score >= 97) return "master";
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "specialist";
  if (score >= 40) return "reference";
  if (score >= 20) return "limited";
  return "visual";
}

export function knowledgeBandLabel(band: KnowledgeBand): string {
  const labels: Record<KnowledgeBand, string> = {
    master: "Master Knowledge",
    excellent: "Excellent Knowledge",
    good: "Good Knowledge",
    specialist: "Specialist Knowledge",
    reference: "Reference Knowledge",
    limited: "Limited Knowledge",
    visual: "Visual Knowledge",
  };
  return labels[band];
}

export type ImageDNA = {
  version: 1;
  score: number; // 0-100
  hash: number; // 32-bit deterministic
  STYLE: { primary?: string; secondary?: string; photographic?: string };
  CAMERA: {
    view?: string;
    lens?: string;
    orientation?: string;
    height?: string;
  };
  MATERIALS: { primary?: string; secondary?: string; roof?: string };
  LIGHTING: { primary?: string; characteristics: string[] };
  QUALITY: { resolution?: string; realism?: string; rendering?: string };
  SETTING: { primary?: string; secondary?: string };
};

export type AIIntent = {
  purpose?: string;
  role?: string;
  collection?: string;
  user_use_cases: string[];
};

export type LockedAttributes = {
  must_keep: string[];
  editable: string[];
  never_change: string[];
};

export type MaterialJourney = {
  id?: string;
  stage?: number;
  stage_name?: string;
  total_stages?: number;
  previous_stage_id?: string;
  next_stage_id?: string;
  previous_stage_name?: string;
  next_stage_name?: string;
};

export type ObjectDetection = {
  primary: string[];
  secondary: string[];
  background: string[];
};

/** Image type — Rule #11. What the image IS in creative-memory terms.
 *  Determines transformation rules (MUST HAVE / MAY HAVE / MUST NOT HAVE
 *  for text, prices, logos, phone, WhatsApp, transparency). */
export type ImageType =
  | "hero_image"
  | "facebook_banner"
  | "instagram_banner"
  | "instagram_story"
  | "construction_banner"
  | "website_banner"
  | "marketing_banner"
  | "educational_banner"
  | "installation_banner"
  | "black_friday_banner"
  | "material_journey_stage"
  | "transparent_asset"
  | "product_shot"
  | "avatar"
  | "logo"
  | "diagram"
  | "collection_banner"
  | "video_thumbnail"
  | "other";

/** Nested image purpose — what this image is FOR. Rule #11. */
export type ImagePurpose = {
  primary: string; // e.g. "marketing"
  secondary?: string; // e.g. "facebook banner"
  tertiary?: string; // e.g. "construction industry"
};

/** ADR-0032 NEX Knowledge Master — one image belongs to MANY collections.
 *  Multi-collection classification derived from description text.
 *  Same logic used by both the save endpoint and the Global Intelligence
 *  Pipeline so scoring stays consistent between the two callers. */
export function inferCollectionMemberships(text: string): string[] {
  const t = text.toLowerCase();
  const collections = new Set<string>();
  if (/staircase|stair|balustrade|newel|tread|riser|handrail|banister/.test(t)) {
    collections.add("staircases");
    if (/luxury|premium|architectural|floating|cantilever/.test(t)) collections.add("luxury_staircases");
    if (/interior|home|living/.test(t)) collections.add("luxury_interiors");
  }
  if (/oak|walnut|pine|hardwood|softwood|timber|wood grain/.test(t)) collections.add("timber_samples");
  if (/manufactur|workshop|production|machining|joinery/.test(t)) collections.add("manufacturing");
  if (/material journey|stage \d+/.test(t)) collections.add("material_journeys");
  if (/pinterest|social/.test(t)) collections.add("pinterest_collections");
  if (/logo|brand mark/.test(t)) collections.add("brand_assets");
  if (/hero|banner|cover/.test(t)) collections.add("hero_images");
  if (/facebook|instagram|social media/.test(t)) collections.add("social_media_assets");
  if (/website|homepage/.test(t)) collections.add("website_assets");
  if (/educational|teach|learn|diagram/.test(t)) collections.add("educational_graphics");
  if (/install|guide|how to/.test(t)) collections.add("installation_guides");
  if (/product|catalogue/.test(t)) collections.add("product_images");
  if (/avatar|profile/.test(t)) collections.add("avatars");
  if (/transparent|isolated|cutout/.test(t)) collections.add("transparent_assets");
  return [...collections];
}

/** ADR-0033 Rule #4-6 · isolated brains. Each brain strictly scoped. */
export type PrimaryBrain =
  | "staircase_brain"
  | "door_brain"
  | "interior_brain"
  | "kitchen_brain"
  | "bathroom_brain"
  | "tools_brain"
  | "timber_brain"
  | "flooring_brain"
  | "lighting_brain"
  | "roofing_brain"
  | "marketing_brain"
  | null; // null = classifier could not confidently assign; SAVE FAILED per Rule #7

/** ADR-0033 · classify to exactly one primary_brain. Returns null when
 *  no brain scores confidently — that row will be refused at save
 *  per Rule #7 rather than dumped into a general brain (Rule #5). */
export function classifyPrimaryBrain(
  description: string,
  ai_intent: AIIntent,
  image_type: ImageType,
  tags: string[]
): PrimaryBrain {
  const t = (description + " " + tags.join(" ")).toLowerCase();

  // Score each brain by evidence weight — winner-takes-all, but only
  // if it clearly leads. Ties or weak leaders → null (admin review).
  const scores: Record<Exclude<PrimaryBrain, null>, number> = {
    staircase_brain: 0,
    door_brain: 0,
    interior_brain: 0,
    kitchen_brain: 0,
    bathroom_brain: 0,
    tools_brain: 0,
    timber_brain: 0,
    flooring_brain: 0,
    lighting_brain: 0,
    roofing_brain: 0,
    marketing_brain: 0,
  };

  // Staircase — strong signals
  if (/\bstaircase\b|\bstairs\b|\bstair\b/.test(t)) scores.staircase_brain += 4;
  if (/balustrade|newel|tread|riser|handrail|banister|volute|spindle|stringer/.test(t))
    scores.staircase_brain += 3;
  if (/floating stair|cantilever stair|helical stair|winder|loft stair/.test(t))
    scores.staircase_brain += 2;

  // Under-stair features — Philip 2026-07-27 HARD LAW: under-stair office,
  // cabinets, playhouse, wine rack, seating, feature panels, storage all
  // belong to the staircase family. Joinery shops that make staircases
  // routinely make these too, so intelligence should co-locate.
  if (/under[- ]?stair|beneath (the |your )?staircase|space (under|beneath) (the |your )?staircase/.test(t))
    scores.staircase_brain += 5;
  if (/under[- ]?stair (office|cabinet|cabinets|playhouse|play area|wine rack|wine cellar|seating|bench|storage|panel|panels|nook|reading|feature)/.test(t))
    scores.staircase_brain += 3;

  // Furniture PHYSICALLY ATTACHED to the staircase — Philip 2026-07-27 HARD
  // LAW extension: anything glued / nailed / screwed / built-in / bonded /
  // fixed to the staircase geometry belongs in staircase_brain. If a joiner
  // fabricated it as part of the staircase build it stays with the staircase
  // family regardless of what the item itself is.
  if (/(glued|nailed|screwed|fixed|bolted|bonded|attached|built[- ]?in|integrated|mounted)\s+(?:to|into|onto|with|on)\s+(?:the\s+)?(?:staircase|stair|newel|string|riser|tread|handrail|balustrade)/.test(t))
    scores.staircase_brain += 4;
  if (/(?:staircase|stair|newel|string|riser|tread|handrail|balustrade)[- ]?(?:mounted|attached|fixed|integrated|built[- ]?in|bonded)/.test(t))
    scores.staircase_brain += 3;

  // Flooring in the staircase context — Philip 2026-07-27 HARD LAW extension:
  // landing flooring + downstairs flooring paired to a staircase belong in the
  // staircase family. The width-matching norm (landing board width should
  // match downstairs board width — material can differ, WIDTH is what the eye
  // catches) is staircase-family knowledge, not standalone flooring knowledge.
  if (/landing (flooring|board|boards|timber|planks?)|top of (the )?staircase flooring|landing floor/.test(t))
    scores.staircase_brain += 5;
  if (/\bflooring\b|floorboard|floor board|plank/.test(t) && /staircase|stair|tread|landing|hallway/.test(t))
    scores.staircase_brain += 3;

  // Door — strong signals (careful — must NOT trip on "cottage door" inside a stair description)
  if (/\bdoor\b|\bdoors\b|door frame|door hinge|door lock/.test(t)) scores.door_brain += 3;
  if (/frame|hinge|lock|glazing/.test(t) && !/stair/.test(t)) scores.door_brain += 1;

  // Interior — carefully so we don't trip on staircase-in-interior
  if (/\binterior\b|\bfurniture\b|living room|dining room|lounge/.test(t))
    scores.interior_brain += 2;

  // Kitchen
  if (/\bkitchen\b|worktop|cabinet|kitchen island|kitchen unit/.test(t))
    scores.kitchen_brain += 4;

  // Bathroom
  if (/\bbathroom\b|shower|bathtub|basin|wc\b|toilet/.test(t)) scores.bathroom_brain += 4;

  // Tools
  if (/\btool\b|\btools\b|machinery|power tool|drill|saw|ppe/.test(t)) scores.tools_brain += 3;

  // Timber (wood samples specifically — not staircase timber references)
  if (/wood grain|timber sample|wood species|oak sample|walnut sample|pine sample/.test(t))
    scores.timber_brain += 4;
  if (image_type === "product_shot" && /oak|walnut|pine|hardwood|softwood/.test(t) && !/stair/.test(t))
    scores.timber_brain += 2;

  // Flooring
  if (/\bflooring\b|floorboard|laminate floor|vinyl floor|floor tile/.test(t))
    scores.flooring_brain += 4;

  // Lighting
  if (/\blighting\b|light fitting|pendant light|chandelier|lamp shade/.test(t))
    scores.lighting_brain += 3;

  // Roofing
  if (/\broofing\b|roof tile|slate roof|felt roof|torch on felt|roof shingle/.test(t))
    scores.roofing_brain += 4;

  // Marketing (only when there's no clear subject brain)
  if (/facebook banner|instagram banner|marketing asset|black friday|promotion/.test(t))
    scores.marketing_brain += 2;

  // Find the winner
  const entries = Object.entries(scores) as Array<[Exclude<PrimaryBrain, null>, number]>;
  entries.sort((a, b) => b[1] - a[1]);
  const [topBrain, topScore] = entries[0];
  const runnerScore = entries[1]?.[1] ?? 0;

  // Confident classification requires: top score ≥ 4 AND lead of ≥ 2
  // over runner-up. Otherwise return null → admin review per Rule #7.
  if (topScore >= 4 && topScore - runnerScore >= 2) {
    return topBrain;
  }
  return null;
}

/** Family tree — Rule #14. Every image has children (banners,
 *  transparent PNGs, videos, 3D versions, etc.) that inherit
 *  the parent's intelligence. */
export type FamilyTreeChild = {
  type: ImageType;
  url: string;
  generated_at: string;
  generated_by?: string;
  notes?: string;
};
export type FamilyTree = {
  parent_url?: string; // set if THIS image is a child of another
  children: FamilyTreeChild[]; // set if THIS image has derivatives
};

/** Geometry preservation — Rule #13. When users request
 *  modifications, preserve 95% of original intelligence. Only
 *  change what was explicitly requested. */
export type GeometryPreservation = {
  preserve_by_default: boolean; // always true for source assets
  allowed_modifications: string[]; // material · colour · background · lighting · text-overlay · aspect-crop
  never_change_without_explicit_request: string[]; // geometry · proportions · dimensions · relationships · composition
};

/** Learning signal — Rule #12. Every user interaction with an
 *  image teaches NEX something. Collections aggregate these over
 *  time to seed intelligence for future images. */
export type LearningSignal = {
  signal_type:
    | "user_requested_transformation"
    | "user_requested_material"
    | "user_requested_output"
    | "user_requested_variant"
    | "user_flagged_issue"
    | "user_approved"
    | "user_edited";
  detail: string; // e.g. "walnut" · "facebook_banner" · "enlarged 30%"
  requested_at: string; // ISO
  requested_by?: string;
};

/** Transformation rules per image type — MUST HAVE / MAY HAVE / MUST NOT HAVE. */
export type ImageTypeRules = {
  must_have: string[];
  may_have: string[];
  must_not_have: string[];
  default_sizes: string[]; // ["1920x1080", "1080x1080"]
};

export type ImageKnowledge = {
  master_description: string;
  master_ai_prompt: string;
  image_dna: ImageDNA;
  ai_intent: AIIntent;
  locked_attributes: LockedAttributes;
  material_journey?: MaterialJourney;
  objects: ObjectDetection;
  tags: string[];
  subject_domain?: string;
  setting?: string;
  mood?: string;
  view_type?: string;
  colour_palette?: string;
  a_plus: boolean;
  // Rule #11 fields
  image_type: ImageType;
  image_purpose: ImagePurpose;
  can_become: ImageType[]; // what transformations are allowed from this source
  collection_id?: string; // FK to Collection DNA
  // Rules #12/13/14 fields (ADR-0027 v1.2 + ADR-0028)
  family_tree: FamilyTree; // parent + children graph
  geometry_preservation: GeometryPreservation; // Rule #13 defaults
  learning_signals: LearningSignal[]; // Rule #12 telemetry — appended over time
  // ADR-0033 Rules #4-6 — isolated brains + single primary_brain per image
  primary_brain: PrimaryBrain;
  // ADR-0032 Knowledge Master — one image can belong to many collections
  collection_memberships: string[];
};

// ── Rule #11 — image type registry + transformation rules ──────

/** Rules per image type — MUST HAVE / MAY HAVE / MUST NOT HAVE. */
export const IMAGE_TYPE_RULES: Record<ImageType, ImageTypeRules> = {
  hero_image: {
    must_have: ["maximum-quality", "ai-modification-friendly", "website-safe-aspect"],
    may_have: [],
    must_not_have: ["text", "prices", "phone", "logo", "whatsapp", "watermark"],
    default_sizes: ["1920x1080", "1200x800"],
  },
  facebook_banner: {
    must_have: [],
    may_have: ["text", "prices", "promotions", "cta-button", "logo"],
    must_not_have: ["phone-only-content"],
    default_sizes: ["1200x630", "1080x1080"],
  },
  instagram_banner: {
    must_have: [],
    may_have: ["text", "logo", "prices", "offers", "qr-code", "whatsapp", "cta-button"],
    must_not_have: [],
    default_sizes: ["1080x1080", "1080x1350"],
  },
  instagram_story: {
    must_have: [],
    may_have: ["text", "logo", "cta-button", "sticker"],
    must_not_have: [],
    default_sizes: ["1080x1920"],
  },
  construction_banner: {
    must_have: ["blank-layout-zones"],
    may_have: ["large-text-areas", "offer-areas", "price-areas", "telephone-areas", "logo"],
    must_not_have: [],
    default_sizes: ["1200x400", "1920x600"],
  },
  website_banner: {
    must_have: ["responsive-safe"],
    may_have: ["text", "cta-button", "logo"],
    must_not_have: ["phone", "whatsapp"],
    default_sizes: ["1920x1080", "1200x400"],
  },
  marketing_banner: {
    must_have: [],
    may_have: ["text", "prices", "promotions", "cta-button", "logo", "whatsapp"],
    must_not_have: [],
    default_sizes: ["1200x630", "1080x1080"],
  },
  educational_banner: {
    must_have: ["clear-labels"],
    may_have: ["text", "diagrams", "logo"],
    must_not_have: ["prices", "cta-button"],
    default_sizes: ["1920x1080"],
  },
  installation_banner: {
    must_have: ["step-clarity"],
    may_have: ["text", "arrows", "numbered-steps", "logo"],
    must_not_have: ["prices"],
    default_sizes: ["1920x1080"],
  },
  black_friday_banner: {
    must_have: ["urgency-visual"],
    may_have: ["text", "prices", "cta-button", "logo", "whatsapp", "countdown"],
    must_not_have: [],
    default_sizes: ["1080x1080", "1200x630"],
  },
  material_journey_stage: {
    must_have: ["stage-context"],
    may_have: ["stage-number", "step-labels", "material-tags"],
    must_not_have: ["prices", "cta-button"],
    default_sizes: ["1920x1080"],
  },
  transparent_asset: {
    must_have: ["transparent-background", "isolated-object"],
    may_have: ["subtle-shadow-if-required"],
    must_not_have: ["text", "background", "watermark"],
    default_sizes: ["1024x1024", "2048x2048"],
  },
  product_shot: {
    must_have: ["clean-background"],
    may_have: ["subtle-shadow", "logo"],
    must_not_have: ["prices", "cta-button", "phone"],
    default_sizes: ["1200x1200", "2000x2000"],
  },
  avatar: {
    must_have: ["face-or-logo-centered"],
    may_have: [],
    must_not_have: ["text", "prices", "phone", "logo-if-face"],
    default_sizes: ["512x512", "1024x1024"],
  },
  logo: {
    must_have: ["transparent-background-or-solid"],
    may_have: ["variant-versions"],
    must_not_have: ["photorealistic-elements"],
    default_sizes: ["512x512", "1024x1024"],
  },
  diagram: {
    must_have: ["clear-labels", "line-work"],
    may_have: ["annotations", "numbered-callouts"],
    must_not_have: ["prices"],
    default_sizes: ["1920x1080"],
  },
  collection_banner: {
    must_have: [],
    may_have: ["text", "logo", "collection-title"],
    must_not_have: [],
    default_sizes: ["1920x600", "1200x400"],
  },
  video_thumbnail: {
    must_have: ["play-button-safe-zone"],
    may_have: ["text", "logo"],
    must_not_have: ["cta-button"],
    default_sizes: ["1280x720", "1920x1080"],
  },
  other: {
    must_have: [],
    may_have: [],
    must_not_have: [],
    default_sizes: [],
  },
};

/** Rule #11 — canonical transformation graph. From this source type,
 *  what can it become? Hero images are the most versatile source. */
export const CAN_BECOME: Record<ImageType, ImageType[]> = {
  hero_image: [
    "facebook_banner",
    "instagram_banner",
    "instagram_story",
    "website_banner",
    "marketing_banner",
    "black_friday_banner",
    "collection_banner",
    "video_thumbnail",
  ],
  transparent_asset: [
    "product_shot",
    "website_banner",
    "educational_banner",
    "installation_banner",
    "marketing_banner",
  ],
  material_journey_stage: [
    "educational_banner",
    "collection_banner",
    "website_banner",
    "instagram_banner",
  ],
  product_shot: [
    "facebook_banner",
    "instagram_banner",
    "website_banner",
    "marketing_banner",
    "black_friday_banner",
  ],
  diagram: ["educational_banner", "installation_banner", "website_banner"],
  logo: ["avatar", "website_banner"],
  // Non-source types (already derived) — generally can't become other derivatives
  facebook_banner: [],
  instagram_banner: [],
  instagram_story: [],
  construction_banner: [],
  website_banner: [],
  marketing_banner: [],
  educational_banner: [],
  installation_banner: [],
  black_friday_banner: [],
  collection_banner: [],
  avatar: [],
  video_thumbnail: [],
  other: [],
};

/** Infer image_type from description + AI intent. Ordered by specificity —
 *  explicit stage-of-N language wins over generic type hints so material
 *  journey images are classified correctly per ADR-0027 Rule #11. */
export function inferImageType(desc: string, ai_intent: AIIntent): ImageType {
  const t = desc.toLowerCase();

  // HIGH-PRIORITY: explicit material journey markers. These beat every
  // other classifier because a stage-of-N image is definitionally a
  // material_journey_stage regardless of styling.
  if (
    /material\s+journey\s+stage/i.test(t) ||
    /stage\s+\d+\s+of\s+\d+/i.test(t) ||
    /\(this\s+image\)/i.test(t) || // "(THIS IMAGE)" marker in journey blocks
    (ai_intent.role && /^stage_\d+/.test(ai_intent.role)) ||
    (ai_intent.purpose === "material_journey" &&
      /\bstage\s+\d+/i.test(desc))
  ) {
    return "material_journey_stage";
  }

  if (/transparent\s+(?:background|asset|png)|isolated\s+object|cutout/.test(t))
    return "transparent_asset";
  if (/facebook\s+banner|fb\s+banner|facebook\s+ad/.test(t)) return "facebook_banner";
  if (/instagram\s+story/.test(t)) return "instagram_story";
  if (/instagram\s+(?:banner|post|ad)/.test(t)) return "instagram_banner";
  if (/construction\s+banner|trade\s+banner|building\s+banner/.test(t))
    return "construction_banner";
  if (/website\s+banner|homepage\s+banner|web\s+hero/.test(t)) return "website_banner";
  if (/black\s+friday|cyber\s+monday|xmas|christmas\s+banner/.test(t))
    return "black_friday_banner";
  if (/installation\s+guide|install(?:ation)?\s+banner|how\s+to\s+install/.test(t))
    return "installation_banner";
  if (/educational\s+(?:banner|image|graphic)|teaching\s+material/.test(t))
    return "educational_banner";
  if (/marketing\s+banner|marketing\s+asset/.test(t)) return "marketing_banner";
  if (/collection\s+banner|collection\s+hero/.test(t)) return "collection_banner";
  if (/video\s+(?:thumbnail|cover)/.test(t)) return "video_thumbnail";
  if (/diagram|schematic|blueprint\s+illustration/.test(t)) return "diagram";
  if (/product\s+shot|product\s+photo|product\s+image/.test(t)) return "product_shot";
  if (/avatar|profile\s+picture/.test(t)) return "avatar";
  if (/\blogo\b|brand\s+mark/.test(t)) return "logo";
  if (
    ai_intent.purpose === "sales_image" ||
    ai_intent.purpose === "architectural_showcase" ||
    /hero\s+(?:image|shot)/.test(t)
  )
    return "hero_image";
  return "hero_image"; // sensible default: source asset
}

/** Rule #11 — derive image_purpose (nested primary/secondary/tertiary)
 *  from ai_intent + image_type. */
export function inferImagePurpose(
  ai_intent: AIIntent,
  image_type: ImageType
): ImagePurpose {
  let primary = "marketing";
  if (ai_intent.purpose === "material_journey") primary = "education";
  else if (ai_intent.purpose === "installation_guide") primary = "installation";
  else if (ai_intent.purpose === "material_education") primary = "education";
  else if (ai_intent.purpose === "sales_image") primary = "marketing";
  else if (ai_intent.purpose === "architectural_showcase") primary = "showcase";

  const secondary = image_type.replace(/_/g, " ");
  const tertiary = ai_intent.collection;

  return { primary, secondary, tertiary };
}

// ── Section extraction ──────────────────────────────────────────

/** Extract a labelled section from a MASTER DESCRIPTION. Handles
 *  Philip's format where headers are uppercase words followed by
 *  content until the next uppercase header. */
function extractSection(desc: string, header: string): string {
  if (!desc) return "";
  // Match `HEADER` on a line by itself (or with colon), capture until
  // the next same-scope header (equal-or-more-uppercase words) or end.
  // For headers themselves in all caps (e.g. "OBJECT DETECTION"), the
  // boundary is another all-caps header. For Title Case sub-headers
  // (e.g. "Primary Style"), we treat any following all-caps line as
  // the boundary (which is what we want anyway).
  const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `${escaped}\\s*:?\\s*\\n+([\\s\\S]*?)(?=\\n\\s*[A-Z][A-Z0-9\\s&]{4,}\\s*(?:\\n|$)|$)`,
    "i"
  );
  const m = desc.match(pattern);
  return m ? m[1].trim() : "";
}

/** Extract a labelled field within a section — "Primary Style:\nfoo".
 *  Handles multi-blank-line separators and skips values that are
 *  only punctuation (a common regex-glitch when the field is empty). */
function extractField(section: string, label: string): string | undefined {
  if (!section) return undefined;
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // \s* covers \n as well in JS regex — no need for separate \n?
  const pattern = new RegExp(`${escaped}\\s*:?\\s*([^\\n]+)`, "i");
  const m = section.match(pattern);
  if (!m) return undefined;
  const value = m[1].trim().replace(/^-\s*/, "").replace(/[:;,]\s*$/, "");
  if (!value) return undefined;
  // Reject values that are ONLY punctuation (regex glitch)
  if (!/[a-z0-9]/i.test(value)) return undefined;
  return value;
}

/** Extract a bullet-point list from a section — lines starting with
 *  "-" or "•". */
function extractBulletList(section: string): string[] {
  const lines = section.split(/\r?\n/);
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const m = line.match(/^[-•*]\s+(.+)$/);
    if (m) {
      out.push(m[1].trim());
      continue;
    }
    // Also accept plain lines when we're inside a clearly list-y
    // block (short non-header lines). Skip if it looks like a
    // "Label:" pair which extractField will handle.
    if (
      line.length > 0 &&
      line.length < 80 &&
      !/[A-Z][A-Z\s&]{4,}$/.test(line) &&
      !line.endsWith(":") &&
      !line.includes(": ")
    ) {
      // Don't grab uppercase-only lines (they're headers)
      if (line !== line.toUpperCase() || line.split(" ").length > 3) {
        // (kept minimal — main path is the bullet marker)
      }
    }
  }
  return out;
}

// ── MASTER AI PROMPT extractor ──────────────────────────────────

/** Extract the MASTER AI PROMPT section — the ~500-word ready-to-paste
 *  regeneration prompt. Handles Philip's format where it's a labelled
 *  section OR a paragraph after "Short AI Prompt Version". */
export function extractMasterAiPrompt(desc: string): string {
  // 1. Section labelled "MASTER AI PROMPT"
  const master = extractSection(desc, "MASTER AI PROMPT");
  if (master) {
    // Trim any trailing meta commentary (Philip's example had
    // "The advantage of structuring it this way is…" trailing).
    const stopAt = master.search(/\n\s*The advantage of structuring/i);
    return stopAt > 0 ? master.slice(0, stopAt).trim() : master;
  }
  // 2. "Short AI Prompt Version"
  const short = extractSection(desc, "Short AI Prompt Version");
  if (short) return short.replace(/^"|"$/g, "").trim();
  // 3. Any paragraph starting with "Ultra photorealistic" as a
  //    reasonable heuristic for AI prompts
  const ultra = desc.match(/["“]?(Ultra photorealistic[^"”]+)/i);
  if (ultra) return ultra[1].trim();
  return "";
}

// ── LOCKED ATTRIBUTES extractor ─────────────────────────────────

export function extractLockedAttributes(desc: string): LockedAttributes {
  const reproSection = extractSection(desc, "AI REPRODUCTION RULES");
  const importantSection = extractSection(
    desc,
    "IMPORTANT ELEMENTS THAT MUST NOT CHANGE"
  );

  // MUST KEEP
  const mustKeepBlock =
    extractSection(reproSection, "MUST KEEP") ||
    extractSection(desc, "MUST KEEP");
  const must_keep = [
    ...extractBulletList(mustKeepBlock),
    ...extractBulletList(importantSection),
  ];

  // DO NOT CHANGE / NEVER CHANGE
  const doNotChangeBlock =
    extractSection(reproSection, "DO NOT CHANGE") ||
    extractSection(desc, "DO NOT CHANGE");
  const never_change = extractBulletList(doNotChangeBlock);

  // EDITABLE / ALLOWED MODIFICATIONS
  const allowedBlock =
    extractSection(reproSection, "ALLOWED MODIFICATIONS") ||
    extractSection(desc, "ALLOWED MODIFICATIONS") ||
    extractSection(desc, "EDITABLE");
  // "Users may change:" is a sub-header inside ALLOWED MODIFICATIONS.
  // Strip that phrase then grab bullets.
  const editableBody = allowedBlock.replace(/Users may change:?/i, "");
  const editable = extractBulletList(editableBody);

  return {
    must_keep: dedupe(must_keep).slice(0, 25),
    editable: dedupe(editable).slice(0, 25),
    never_change: dedupe(never_change).slice(0, 25),
  };
}

// ── MATERIAL JOURNEY extractor ──────────────────────────────────

export function extractMaterialJourney(
  desc: string
): MaterialJourney | undefined {
  const identity = extractSection(desc, "IMAGE IDENTITY");
  // "Material Journey Stage: Stage 4 - Precision Timber Machining"
  // The label is followed by a value that itself starts with "Stage N".
  // extractField gets us "Stage 4 - Precision Timber Machining".
  const rawStageValue =
    extractField(identity, "Material Journey Stage") ??
    // Fallback: scan raw description if identity block missed it
    (() => {
      const m = desc.match(/Material\s+Journey\s+Stage\s*:?\s*\n?\s*([^\n]+)/i);
      return m ? m[1].trim().replace(/^-\s*/, "") : undefined;
    })();

  const previousName =
    extractField(identity, "Previous Stage") ||
    extractField(desc, "Previous Stage");
  const nextName =
    extractField(identity, "Next Stage") || extractField(desc, "Next Stage");

  // Parse stage number + name from "Stage 4 - Precision Timber Machining"
  let stage: number | undefined;
  let stageName: string | undefined;
  if (rawStageValue) {
    const m = rawStageValue.match(/Stage\s+(\d+)\s*[-–—]?\s*(.*)?/i);
    if (m) {
      stage = Number.parseInt(m[1], 10);
      stageName = (m[2] ?? "").trim() || undefined;
    } else {
      stageName = rawStageValue;
    }
  }

  // For total_stages we scan the WHOLE description for "Stage N" —
  // the MANUFACTURING PROCESS / MATERIAL JOURNEY blocks list the
  // full journey and each stage carries a number. Highest wins.
  let total_stages: number | undefined;
  if (stage === undefined) {
    // Fallback: find "(THIS IMAGE)" marker anywhere in desc
    const thisImageIdx = desc.search(/\(THIS IMAGE\)/i);
    if (thisImageIdx > 0) {
      const before = desc.slice(0, thisImageIdx);
      const stageMatches = [...before.matchAll(/Stage\s+(\d+)/gi)];
      if (stageMatches.length > 0) {
        stage = Number.parseInt(stageMatches[stageMatches.length - 1][1], 10);
      }
    }
  }
  const allStageNumbers = [...desc.matchAll(/Stage\s+(\d+)/gi)].map((s) =>
    Number.parseInt(s[1], 10)
  );
  if (allStageNumbers.length >= 3) {
    total_stages = Math.max(...allStageNumbers);
  }

  // Journey id — derive from Category. Clean, non-empty slug.
  const category = extractField(identity, "Category");
  let journeyId: string | undefined;
  if (category) {
    const slug = category
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (slug && slug.length > 2) {
      journeyId = `${slug}_001`;
    }
  }

  const anyFound =
    stage !== undefined ||
    stageName !== undefined ||
    previousName !== undefined ||
    nextName !== undefined ||
    total_stages !== undefined ||
    journeyId !== undefined;
  if (!anyFound) return undefined;

  return {
    id: journeyId,
    stage,
    stage_name: stageName,
    total_stages,
    previous_stage_name: previousName,
    next_stage_name: nextName,
  };
}

// ── AI INTENT extractor ─────────────────────────────────────────

export function extractAIIntent(desc: string): AIIntent {
  const identity = extractSection(desc, "IMAGE IDENTITY");
  const category = extractField(identity, "Category");
  const subCategory = extractField(identity, "Sub Category");
  const stageName = extractField(identity, "Material Journey Stage");
  const primaryStyle = extractField(identity, "Primary Style");

  // Purpose — infer from category/style keywords
  let purpose: string | undefined;
  const catLower = (category ?? "").toLowerCase() + " " + (primaryStyle ?? "").toLowerCase();
  if (/manufacturing|production|process/.test(catLower)) purpose = "material_journey";
  else if (/marketing|sales|hero/.test(catLower)) purpose = "sales_image";
  else if (/install|guide|how/.test(catLower)) purpose = "installation_guide";
  else if (/education|explain/.test(catLower)) purpose = "material_education";
  else if (/architecture|design|luxury/.test(catLower)) purpose = "architectural_showcase";

  // Role — extract stage if present
  let role: string | undefined;
  if (stageName) {
    const sm = stageName.match(/Stage\s+(\d+)/i);
    if (sm) role = `stage_${sm[1]}`;
  }

  // Collection — from Category root or Sub Category. Guard against
  // empty/underscore-only slugs that a naive replace() can produce.
  function slug(s: string | undefined): string | undefined {
    if (!s) return undefined;
    const out = s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return out && out.length > 2 ? out : undefined;
  }
  const collection = slug(subCategory) ?? slug(category);

  // User use cases — infer from purpose
  const user_use_cases: string[] = [];
  if (purpose === "material_journey") {
    user_use_cases.push("education", "recreation", "modification");
  } else if (purpose === "sales_image") {
    user_use_cases.push("sales", "marketing", "hero");
  } else if (purpose === "installation_guide") {
    user_use_cases.push("installation", "guide", "reference");
  } else if (purpose === "material_education") {
    user_use_cases.push("education", "reference");
  } else if (purpose === "architectural_showcase") {
    user_use_cases.push("marketing", "portfolio", "recreation");
  }

  return { purpose, role, collection, user_use_cases };
}

// ── OBJECT DETECTION extractor ──────────────────────────────────

export function extractObjects(desc: string): ObjectDetection {
  // These are ALL-CAPS subsections; the section extractor uses uppercase
  // headers as boundaries, so we scan the whole description directly
  // rather than nesting inside "OBJECT DETECTION".
  const primary = extractBulletList(extractSection(desc, "PRIMARY OBJECTS"));
  const secondary = extractBulletList(
    extractSection(desc, "SECONDARY OBJECTS")
  );
  const background = extractBulletList(
    extractSection(desc, "BACKGROUND OBJECTS")
  );
  return {
    primary: dedupe(primary).slice(0, 30),
    secondary: dedupe(secondary).slice(0, 30),
    background: dedupe(background).slice(0, 30),
  };
}

// ── IMAGE DNA composer ──────────────────────────────────────────

export function composeImageDNA(desc: string, prompt: string): ImageDNA {
  const identity = extractSection(desc, "IMAGE IDENTITY");
  const camera = extractSection(desc, "CAMERA INFORMATION") ||
    extractSection(desc, "CAMERA SETTINGS");
  const materials = extractSection(desc, "MATERIAL ANALYSIS") ||
    extractSection(desc, "MATERIALS");
  const lighting = extractSection(camera, "Lighting") || extractSection(desc, "LIGHTING");
  const style = extractSection(desc, "STYLE REQUIREMENTS");

  const combined = (desc + "\n" + prompt).toLowerCase();

  // STYLE
  const stylePrimary =
    extractField(identity, "Primary Style") ??
    firstMatch(style || combined, [
      /rustic\s+cottage/i,
      /woodland\s+cottage/i,
      /modern\s+architectural/i,
      /industrial\s+workshop/i,
      /premium\s+manufacturing/i,
      /luxury\s+staircase/i,
    ]);
  const styleSecondary =
    extractField(identity, "Secondary Style") ??
    firstMatch(style || combined, [
      /english\s+countryside/i,
      /premium\s+staircase\s+manufacturing/i,
      /architectural\s+visualization/i,
    ]);
  const stylePhoto =
    extractField(identity, "Photographic Style") ??
    firstMatch(combined, [
      /architectural\s+photography/i,
      /industrial\s+photography/i,
      /product\s+photography/i,
      /photorealistic/i,
    ]);

  // CAMERA
  const cameraView =
    extractField(camera, "View") ??
    firstMatch(combined, [
      /front[- ]left\s+three[- ]quarter/i,
      /three[- ]quarter/i,
      /front\s+view/i,
      /side\s+view/i,
      /top\s+down/i,
      /aerial/i,
    ]);
  const cameraOrientation =
    extractField(camera, "Image Orientation") ??
    firstMatch(combined, [/landscape/i, /portrait/i, /square/i]);
  const cameraHeight =
    extractField(camera, "Camera Position") ??
    firstMatch(combined, [/eye[- ]level/i, /low\s+angle/i, /high\s+angle/i]);
  const cameraLens = firstMatch(combined, [
    /(\d{2,3})\s*mm/i,
    /wide[- ]angle/i,
    /telephoto/i,
    /macro/i,
  ]);

  // MATERIALS
  const materialPrimary = firstMatch(materials || combined, [
    /american\s+(?:white\s+)?oak/i,
    /european\s+oak/i,
    /walnut/i,
    /red\s+deal\s+pine/i,
    /ash/i,
    /sapele/i,
    /oak\s+timber/i,
    /timber/i,
  ]);
  const materialSecondary = firstMatch(combined, [
    /glass\s+balustrade/i,
    /stainless\s+steel/i,
    /wrought\s+iron/i,
    /natural\s+stone/i,
    /granite/i,
    /marble/i,
  ]);
  const materialRoof = firstMatch(combined, [
    /charcoal\s+(?:roof\s+)?shingles?/i,
    /slate\s+roof/i,
    /torch[- ]on\s+felt/i,
    /(?:roof\s+)?felt(?:ed)?/i,
    /clay\s+tiles?/i,
    /concrete\s+tiles?/i,
    /welsh\s+slate/i,
  ]);

  // LIGHTING
  const lightingPrimary = firstMatch(lighting || combined, [
    /natural\s+(?:day)?light/i,
    /overcast/i,
    /golden\s+hour/i,
    /studio\s+lighting/i,
    /workshop\s+lighting/i,
    /interior\s+illumination/i,
  ]);
  const lightingCharacteristics: string[] = [];
  const characteristicChecks: Array<[RegExp, string]> = [
    [/soft\s+shadows?/i, "soft-shadows"],
    [/hard\s+shadows?/i, "hard-shadows"],
    [/high\s+dynamic\s+range|hdr/i, "hdr"],
    [/realistic\s+shadows/i, "realistic-shadows"],
    [/led\s+(?:under[- ]tread|lighting)/i, "led-lit"],
    [/backlit/i, "backlit"],
  ];
  for (const [re, tag] of characteristicChecks) {
    if (re.test(combined)) lightingCharacteristics.push(tag);
  }

  // QUALITY
  const qualityResolution = firstMatch(combined, [
    /8k/i,
    /4k/i,
    /(\d+)\s*megapixel/i,
  ]);
  const qualityRealism = firstMatch(combined, [
    /ultra\s+photorealistic/i,
    /photorealistic/i,
    /realistic/i,
    /stylised/i,
  ]);
  const qualityRendering = firstMatch(combined, [
    /architectural\s+visualization/i,
    /premium\s+rendering/i,
    /product\s+rendering/i,
    /studio\s+quality/i,
  ]);

  // SETTING
  const settingPrimary = firstMatch(combined, [
    /woodland/i,
    /countryside/i,
    /english\s+cottage\s+garden/i,
    /workshop/i,
    /manufacturing\s+facility/i,
    /joinery\s+workshop/i,
    /studio/i,
    /outdoor/i,
    /interior/i,
    /commercial/i,
  ]);
  const settingSecondary = firstMatch(combined, [
    /cottage\s+garden/i,
    /industrial\s+facility/i,
    /premium\s+workshop/i,
    /assembly\s+area/i,
  ]);

  const dna: ImageDNA = {
    version: 1,
    score: 0,
    hash: 0,
    STYLE: {
      primary: normaliseLower(stylePrimary),
      secondary: normaliseLower(styleSecondary),
      photographic: normaliseLower(stylePhoto),
    },
    CAMERA: {
      view: normaliseLower(cameraView),
      lens: normaliseLower(cameraLens),
      orientation: normaliseLower(cameraOrientation),
      height: normaliseLower(cameraHeight),
    },
    MATERIALS: {
      primary: normaliseLower(materialPrimary),
      secondary: normaliseLower(materialSecondary),
      roof: normaliseLower(materialRoof),
    },
    LIGHTING: {
      primary: normaliseLower(lightingPrimary),
      characteristics: lightingCharacteristics,
    },
    QUALITY: {
      resolution: normaliseLower(qualityResolution),
      realism: normaliseLower(qualityRealism),
      rendering: normaliseLower(qualityRendering),
    },
    SETTING: {
      primary: normaliseLower(settingPrimary),
      secondary: normaliseLower(settingSecondary),
    },
  };

  dna.score = computeDNAScore(dna);
  dna.hash = computeDNAHash(dna);
  return dna;
}

/** DNA SCORE — percentage of DNA nested fields that were extractable.
 *  ADR-0027 Rule #6 confidence bands (immutable):
 *    99% = Very High · 95% = High · 85% = Good · <85% = FLAG for review
 *  Any consumer surfacing an image with score <85 must show a review flag. */
export function computeDNAScore(dna: ImageDNA): number {
  const scalarFields: Array<string | undefined> = [
    dna.STYLE.primary,
    dna.STYLE.secondary,
    dna.STYLE.photographic,
    dna.CAMERA.view,
    dna.CAMERA.lens,
    dna.CAMERA.orientation,
    dna.CAMERA.height,
    dna.MATERIALS.primary,
    dna.MATERIALS.secondary,
    dna.MATERIALS.roof,
    dna.LIGHTING.primary,
    dna.QUALITY.resolution,
    dna.QUALITY.realism,
    dna.QUALITY.rendering,
    dna.SETTING.primary,
    dna.SETTING.secondary,
  ];
  const filled = scalarFields.filter((f) => f && f.length > 0).length;
  const lightingBonus = dna.LIGHTING.characteristics.length > 0 ? 1 : 0;
  return Math.round(((filled + lightingBonus) / (scalarFields.length + 1)) * 100);
}

/** Deterministic 32-bit hash of the load-bearing DNA fields.
 *  Two images with identical hashes are visually near-identical.
 *  FNV-1a variant — cheap, stable, good distribution. */
export function computeDNAHash(dna: ImageDNA): number {
  const key = [
    dna.STYLE.primary,
    dna.CAMERA.view,
    dna.MATERIALS.primary,
    dna.LIGHTING.primary,
    dna.SETTING.primary,
    dna.QUALITY.rendering,
    dna.STYLE.photographic,
  ]
    .filter(Boolean)
    .join("|");
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  // Normalise to unsigned 32-bit
  return hash >>> 0;
}

// ── Main entry point ────────────────────────────────────────────

export function parseImageKnowledge(input: {
  master_description: string;
  master_ai_prompt?: string | null;
}): ImageKnowledge {
  const master_description = input.master_description ?? "";
  // Prefer authored master_ai_prompt; fall back to extraction from
  // description if the field is empty.
  const master_ai_prompt =
    (input.master_ai_prompt && input.master_ai_prompt.trim()) ||
    extractMasterAiPrompt(master_description);

  const image_dna = composeImageDNA(master_description, master_ai_prompt);
  const ai_intent = extractAIIntent(master_description);
  const locked_attributes = extractLockedAttributes(master_description);
  const material_journey = extractMaterialJourney(master_description);
  const objects = extractObjects(master_description);

  // Legacy scalar fields — kept for backward compatibility with
  // the existing matcher. Derived from DNA where possible.
  const subject_domain = inferSubjectDomain(master_description);
  const setting = image_dna.SETTING.primary;
  const mood = inferMood(master_description);
  const view_type = image_dna.CAMERA.view;
  const colour_palette = inferColourPalette(master_description);

  // Tags — auto-extracted using the existing vocabulary in the tagger.
  // Duplicated here so the parser is self-contained; keep in sync.
  const tags = extractTags(master_description);

  // A+ auto-tick for rich descriptions (>=500 chars) per ADR-0026
  const a_plus = master_description.trim().length >= 500;

  // Rule #11 (ADR-0027 v1.1) — image_type + image_purpose + can_become
  const image_type = inferImageType(master_description, ai_intent);
  const image_purpose = inferImagePurpose(ai_intent, image_type);
  const can_become = CAN_BECOME[image_type] ?? [];
  const collection_id = ai_intent.collection;

  // Rule #14 (ADR-0027 v1.2) — family tree. New images start with an
  // empty children array; parent_url is set only when the image is
  // itself a derivative. Both mutated externally by transformation
  // pipelines that create children.
  const family_tree: FamilyTree = {
    children: [],
  };

  // Rule #13 (ADR-0027 v1.2) — geometry preservation defaults. Every
  // image starts locked-by-default; user can broaden allowed_modifications.
  const geometry_preservation: GeometryPreservation = {
    preserve_by_default: true,
    allowed_modifications: [
      "material",
      "colour",
      "background",
      "lighting",
      "text-overlay",
      "aspect-crop",
      "logo-overlay",
    ],
    never_change_without_explicit_request: [
      "geometry",
      "proportions",
      "dimensions",
      "outlines",
      "object-relationships",
      "composition",
      "perspective",
      "architectural-details",
    ],
  };

  // Rule #12 (ADR-0027 v1.2) — learning signals. Start empty; appended
  // over time as users interact with the image. Collection aggregators
  // read these to teach future images.
  const learning_signals: LearningSignal[] = [];

  return {
    master_description,
    master_ai_prompt,
    image_dna,
    ai_intent,
    locked_attributes,
    material_journey,
    objects,
    tags,
    subject_domain,
    setting,
    mood,
    view_type,
    colour_palette,
    a_plus,
    // Rule #11
    image_type,
    image_purpose,
    can_become,
    collection_id,
    // Rules #12/13/14
    family_tree,
    geometry_preservation,
    learning_signals,
    // ADR-0033 Rule #4-6 — classify to exactly one primary brain (or null → SAVE FAILED)
    primary_brain: classifyPrimaryBrain(master_description, ai_intent, image_type, tags),
    // ADR-0032 NEX Knowledge Master — one image can belong to many collections
    collection_memberships: inferCollectionMemberships(master_description),
  };
}

// ── Small helpers ───────────────────────────────────────────────

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const key = item.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  if (!text) return undefined;
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return undefined;
}

function normaliseLower(s: string | undefined): string | undefined {
  if (!s) return undefined;
  return s.trim().toLowerCase();
}

function inferSubjectDomain(desc: string): string | undefined {
  const t = desc.toLowerCase();
  if (/manufacturing|workshop|production/.test(t)) return "hero-banner";
  if (/staircase|stair|balustrade|newel|tread|riser/.test(t)) return "staircase";
  if (/oak\s+wood|walnut\s+wood|pine\s+wood|timber\s+sample|wood grain/.test(t))
    return "wood-sample";
  if (/logo|brand mark/.test(t)) return "logo";
  if (/avatar|profile/.test(t)) return "avatar";
  if (/diagram|schematic/.test(t)) return "diagram";
  return "staircase";
}

function inferMood(desc: string): string | undefined {
  const t = desc.toLowerCase();
  if (/luxur|premium/.test(t)) return "luxurious";
  if (/rustic|cosy|cozy|warm and inviting/.test(t)) return "cosy";
  if (/minimalist|clean lines/.test(t)) return "minimalist";
  if (/industrial|workshop/.test(t)) return "industrial";
  if (/traditional/.test(t)) return "traditional";
  if (/warm|inviting/.test(t)) return "warm";
  if (/grand/.test(t)) return "grand";
  return undefined;
}

function inferColourPalette(desc: string): string | undefined {
  const t = desc.toLowerCase();
  if (/warm.*(tone|palette)|honey|amber|burgundy|timber\s+tones/.test(t))
    return "warm";
  if (/cool.*(tone|palette)|grey\s+tones|blue tint/.test(t)) return "cool";
  if (/monochrome|black and white/.test(t)) return "monochrome";
  if (/high[- ]contrast/.test(t)) return "high-contrast";
  if (/neutral/.test(t)) return "neutral";
  if (/colour variations|multiple colour|mixed/.test(t)) return "mixed";
  return undefined;
}

// ── ADR-0030 · Intelligence Layers Before Admin ─────────────────

/** Enhanced parser that applies the 6-level intelligence stack per
 *  ADR-0030 before flagging anything as admin-review-required.
 *
 *  Level 1: Collection Intelligence (aggregate DNA inheritance)
 *  Level 2: Image Intelligence (per-image DNA extraction — base parser)
 *  Level 3: Relationship Intelligence (parent + siblings — deferred; needs family_tree data)
 *  Level 4: Auto-generated MASTER AI PROMPT from inherited + inferred fields
 *  Level 5: Vision Intelligence (deferred — needs vision model wiring)
 *  Level 6: Admin Review (LAST resort — only if all above fail below 85% confidence)
 *
 *  Returns the enriched knowledge + a report of which layers fired
 *  + final overall_confidence used by the validator to decide whether
 *  to flag for admin. */
export type InheritanceReport = {
  base_dna_score: number;
  boosted_dna_score: number;
  fields_inherited: string[];
  master_ai_prompt_auto_generated: boolean;
  overall_confidence: number;
};

export async function parseWithInheritance(input: {
  master_description: string;
  master_ai_prompt?: string | null;
}): Promise<{ knowledge: ImageKnowledge; inheritance: InheritanceReport }> {
  // Level 2: base parser first
  const knowledge = parseImageKnowledge(input);
  const base_dna_score = knowledge.image_dna.score;

  // Level 1: collection intelligence — dynamic import to avoid circular
  const { getCollectionIntelligence, applyCollectionInheritance, autoGenerateMasterAiPrompt } =
    await import("./collectionIntelligence");
  const intel = await getCollectionIntelligence(knowledge.collection_id);

  let fields_inherited: string[] = [];
  if (intel.overall_confidence >= 60 && intel.sample_size >= 3) {
    const applied = applyCollectionInheritance(
      {
        image_dna: knowledge.image_dna,
        tags: knowledge.tags,
        image_type: knowledge.image_type,
      },
      intel
    );
    fields_inherited = applied.fieldsInherited;
  }

  // Level 4: auto-generate MASTER AI PROMPT if missing/thin
  let master_ai_prompt_auto_generated = false;
  if (!knowledge.master_ai_prompt || knowledge.master_ai_prompt.trim().length < 40) {
    knowledge.master_ai_prompt = autoGenerateMasterAiPrompt({
      image_dna: knowledge.image_dna,
      image_type: knowledge.image_type,
      ai_intent: knowledge.ai_intent,
      tags: knowledge.tags,
    });
    master_ai_prompt_auto_generated = true;
  }

  // Compute overall_confidence = weighted combination of image DNA
  // score + collection intelligence contribution
  const overall_confidence =
    fields_inherited.length > 0
      ? Math.round(
          knowledge.image_dna.score * 0.7 + intel.overall_confidence * 0.3
        )
      : knowledge.image_dna.score;

  // Re-hash DNA after inheritance (fields changed)
  knowledge.image_dna.hash = computeDNAHash(knowledge.image_dna);

  return {
    knowledge,
    inheritance: {
      base_dna_score,
      boosted_dna_score: knowledge.image_dna.score,
      fields_inherited,
      master_ai_prompt_auto_generated,
      overall_confidence,
    },
  };
}

/** Tag vocab kept minimal here — the fuller version lives in the
 *  tagger. Parser needs enough to seed tags for consumers that
 *  don't run through the tagger UI. */
function extractTags(desc: string): string[] {
  const t = desc.toLowerCase();
  const tags = new Set<string>();
  const vocab: Array<[string, RegExp]> = [
    ["oak", /\boak\b/],
    ["walnut", /\bwalnut\b/],
    ["pine", /\bpine\b/],
    ["hardwood", /\bhardwood\b/],
    ["softwood", /\bsoftwood\b/],
    ["timber", /\btimber\b/],
    ["glass", /\bglass\b/],
    ["steel", /\bsteel\b/],
    ["iron", /\biron\b/],
    ["stone", /\bstone\b/],
    ["staircase", /staircase|stairs?\b/],
    ["handrail", /handrail/],
    ["balustrade", /balustrade/],
    ["newel", /newel/],
    ["spindle", /spindle/],
    ["tread", /\btread\b/],
    ["riser", /\briser\b/],
    ["floating", /floating/],
    ["curved", /\bcurved\b/],
    ["helical", /helical/],
    ["cantilever", /cantilever/],
    ["traditional", /traditional/],
    ["modern", /\bmodern\b/],
    ["luxury", /luxury/],
    ["industrial", /industrial/],
    ["premium", /premium/],
    ["photorealistic", /photorealistic/],
    ["rustic", /rustic/],
    ["cottage", /cottage/],
    ["workshop", /workshop/],
    ["manufacturing", /manufactur/],
    ["natural-wood", /natural\s+(?:wood|timber)/],
    ["warm", /\bwarm\b/],
    ["hero-shot", /hero\s+shot/],
    ["three-quarter-view", /three[- ]quarter/],
    ["eye-level", /eye[- ]level/],
    ["natural-daylight", /natural\s+(?:day)?light/],
    ["soft-shadows", /soft\s+shadow/],
    ["hdr", /high\s+dynamic\s+range|\bhdr\b/],
    ["8k", /\b8k\b/],
  ];
  for (const [canonical, pattern] of vocab) {
    if (pattern.test(t)) tags.add(canonical);
  }
  return [...tags];
}
