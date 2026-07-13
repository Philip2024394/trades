// Shared mood + activity library for The Yard (and quote-form flair).
//
// Used by:
//   - YardInboxShell (render side — shows the character on each card)
//   - YardInlineComposer (compose side — live suggestion + picker)
//   - Quote forms (optional bottom-right character based on trade)
//
// Every character = one entry in MOOD_LIBRARY. Adding a keyword hint
// for auto-suggestion = one entry in MOOD_KEYWORDS. Zero rendering
// code needs to change.

export type MoodSlug =
  // ── Emotions / states ─────────────
  | "confused"
  | "thinking"
  | "frustrated"
  | "celebrating"
  | "laughing"
  | "asleep"
  | "injured"
  | "still-working"      // injured but still going
  | "kept-going"         // stuck it out
  | "pushing"            // heavy graft
  | "hard-at-work"       // head down, hammering it
  | "dizzy"              // overwhelmed
  | "shocked"
  | "friday-feeling"     // going for beer
  | "unimpressed"        // "you don't say" deadpan
  | "angry"
  // ── Trade activities ──────────────
  | "on-staircase"
  | "in-kitchen"
  | "on-bobcat"
  | "mixing"
  | "fitting-panels"
  | "on-roof"
  | "shoveling"
  | "on-scaffolding"
  | "painting"
  | "bricklaying"
  | "welding"
  | "metalworking"
  | "landscaping"
  | "plumbing"
  | "plastering"
  | "electrical"
  // ── Keyword-only utility characters ──────────
  // These live in MOOD_LIBRARY but are deliberately NOT in MOOD_ORDER,
  // so they never appear as an explicit pick in the composer. They are
  // only surfaced by the keyword scanner (`suggestMood`) when a post
  // text matches — a general-purpose character bank for automatic
  // decoration, not a formal mood status.
  | "on-tools"
  | "announcement"
  | "for-sale"
  | "sold-out"
  | "make-me-offer";

export type MoodDef = {
  slug: MoodSlug;
  url: string;
  label: string;
  alt: string;
  /** Which trade slugs this activity character best fits. Used by the
   *  quote-form to pick a character for the bottom-right slot when the
   *  merchant's primary trade is known. Empty = generic mood, not
   *  trade-specific. */
  trades?: readonly string[];
};

export const MOOD_LIBRARY: Record<MoodSlug, MoodDef> = {
  // ── Emotions / states ─────────────
  confused: {
    slug: "confused",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%208,%202026,%2005_19_18%20PM.png",
    label: "Confused",
    alt: "Construction worker leaning on shovel, scratching head with question marks"
  },
  thinking: {
    slug: "thinking",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%209,%202026,%2009_15_26%20AM.png",
    label: "Thinking",
    alt: "Tradesman hard at work, focused"
  },
  frustrated: {
    slug: "frustrated",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%209,%202026,%2008_29_14%20AM.png",
    label: "Frustrated",
    alt: "Tradesman looking angry / frustrated"
  },
  celebrating: {
    slug: "celebrating",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%209,%202026,%2009_27_26%20AM.png",
    label: "Celebrating",
    alt: "Tradesman who kept going and made it through"
  },
  laughing: {
    slug: "laughing",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%209,%202026,%2008_47_33%20AM.png",
    label: "Laughing",
    alt: "Tradesman heading off for a beer, cheerful"
  },
  asleep: {
    slug: "asleep",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%209,%202026,%2009_10_23%20AM.png",
    label: "Asleep",
    alt: "Tradesman looking dizzy / dozing off"
  },
  injured: {
    slug: "injured",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%209,%202026,%2009_37_10%20AM.png",
    label: "Injured",
    alt: "Tradesman with a bandaged injury"
  },
  "still-working": {
    slug: "still-working",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%209,%202026,%2009_32_47%20AM.png",
    label: "Still Working",
    alt: "Tradesman injured but still on the tools"
  },
  "kept-going": {
    slug: "kept-going",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%209,%202026,%2009_27_26%20AM.png",
    label: "Kept Going",
    alt: "Tradesman who kept going through the job"
  },
  pushing: {
    slug: "pushing",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%209,%202026,%2009_23_14%20AM.png",
    label: "Pushing Through",
    alt: "Tradesman pushing through heavy graft"
  },
  "hard-at-work": {
    slug: "hard-at-work",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%209,%202026,%2009_15_26%20AM.png",
    label: "Hard at Work",
    alt: "Tradesman heads-down on the job"
  },
  dizzy: {
    slug: "dizzy",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%209,%202026,%2009_10_23%20AM.png",
    label: "Dizzy",
    alt: "Tradesman feeling dizzy / overwhelmed"
  },
  shocked: {
    slug: "shocked",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%209,%202026,%2009_04_06%20AM.png",
    label: "Shocked",
    alt: "Tradesman with a shocked look"
  },
  "friday-feeling": {
    slug: "friday-feeling",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%209,%202026,%2008_47_33%20AM.png",
    label: "Friday Feeling",
    alt: "Tradesman heading off for a Friday beer"
  },
  unimpressed: {
    slug: "unimpressed",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%209,%202026,%2008_38_19%20AM.png",
    label: "Unimpressed",
    alt: "Tradesman with a deadpan 'you don't say' look"
  },
  angry: {
    slug: "angry",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%209,%202026,%2008_29_14%20AM.png",
    label: "Angry",
    alt: "Tradesman looking angry"
  },
  // ── Trade activities ──────────────
  "on-staircase": {
    slug: "on-staircase",
    url: "https://ik.imagekit.io/9mrgsv2rp/Untitledasdasdasddssd-removebg-preview.png",
    label: "On the Stairs",
    alt: "Tradesman working on a staircase",
    trades: ["carpenter", "joiner", "trim-carpenter"]
  },
  "in-kitchen": {
    slug: "in-kitchen",
    url: "https://ik.imagekit.io/9mrgsv2rp/Untitledasdasd-removebg-preview%20(2).png",
    label: "In the Kitchen",
    alt: "Tradesman fitting a kitchen",
    trades: ["kitchen-fitter", "carpenter", "joiner"]
  },
  "on-bobcat": {
    slug: "on-bobcat",
    url: "https://ik.imagekit.io/9mrgsv2rp/Untitledasdasdsdsdsdsdsd-removebg-preview.png",
    label: "On the Bobcat",
    alt: "Tradesman operating a bobcat",
    trades: ["groundworker", "landscaper", "driveway-installer", "plant-hire"]
  },
  mixing: {
    slug: "mixing",
    url: "https://ik.imagekit.io/9mrgsv2rp/Untitledsdsdsdsdsdsds-removebg-preview.png",
    label: "Mixing",
    alt: "Tradesman mixing concrete or mortar",
    trades: ["concrete-specialist", "bricklayer", "block-layer", "renderer", "plasterer", "general-builder"]
  },
  "fitting-panels": {
    slug: "fitting-panels",
    url: "https://ik.imagekit.io/9mrgsv2rp/Untitledsdsd.png",
    label: "Fitting Panels",
    alt: "Tradesman fitting a panel",
    trades: ["carpenter", "joiner", "drywaller", "plasterer", "fencer"]
  },
  "on-roof": {
    slug: "on-roof",
    url: "https://ik.imagekit.io/9mrgsv2rp/Untitledasdasdasdasdasdsdsds-removebg-preview.png",
    label: "On the Roof",
    alt: "Roofer working on a roof",
    trades: ["roofer", "fascia-and-soffit"]
  },
  shoveling: {
    slug: "shoveling",
    url: "https://ik.imagekit.io/9mrgsv2rp/Untitledcxcxcxc-removebg-preview.png",
    label: "Shoveling",
    alt: "Tradesman shoveling",
    trades: ["landscaper", "groundworker", "general-builder"]
  },
  "on-scaffolding": {
    slug: "on-scaffolding",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%208,%202026,%2010_38_31%20PM.png",
    label: "On Scaffolding",
    alt: "Scaffolder up on scaffolding",
    trades: ["scaffolder", "roofer", "renderer", "painter"]
  },
  painting: {
    slug: "painting",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%208,%202026,%2010_35_15%20PM.png",
    label: "Painting",
    alt: "Painter at work",
    trades: ["painter", "decorator"]
  },
  bricklaying: {
    slug: "bricklaying",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%208,%202026,%2010_32_00%20PM.png",
    label: "Laying Bricks",
    alt: "Bricklayer laying bricks",
    trades: ["bricklayer", "block-layer", "general-builder"]
  },
  welding: {
    slug: "welding",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%208,%202026,%2010_28_52%20PM.png",
    label: "Welding",
    alt: "Welder at work",
    trades: ["welder", "metal-engineer", "metalworker", "fabricator"]
  },
  metalworking: {
    slug: "metalworking",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%208,%202026,%2010_27_52%20PM.png",
    label: "Metalworking",
    alt: "Metal engineer working steel",
    trades: ["metal-engineer", "metalworker", "fabricator", "welder"]
  },
  landscaping: {
    slug: "landscaping",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%208,%202026,%2010_25_05%20PM.png",
    label: "Landscaping",
    alt: "Landscaper at work in a garden",
    trades: ["landscaper", "garden-designer", "groundworker"]
  },
  plumbing: {
    slug: "plumbing",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%208,%202026,%2010_16_19%20PM.png",
    label: "Plumbing",
    alt: "Plumber under a sink",
    trades: ["plumber", "gas-engineer", "bathroom-fitter", "heating-engineer"]
  },
  plastering: {
    slug: "plastering",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2002_47_42%20AM.png",
    label: "Plastering",
    alt: "Plasterer skimming a wall",
    trades: ["plasterer", "renderer", "drywaller", "taper-and-finisher"]
  },
  electrical: {
    slug: "electrical",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2002_59_09%20AM.png",
    label: "Electrical",
    alt: "Electrician working on wiring",
    trades: ["electrician", "electrical-contractor", "solar-installer", "ev-charger-installer"]
  },
  // ── Keyword-only utility ────────────────────
  "on-tools": {
    slug: "on-tools",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2003_29_36%20AM.png",
    label: "On the Tools",
    alt: "Tradesman on the tools — general work"
  },
  announcement: {
    slug: "announcement",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2003_45_22%20AM.png",
    label: "Announcement",
    alt: "Tradesman giving an important notice"
  },
  "for-sale": {
    slug: "for-sale",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2003_48_59%20AM.png",
    label: "For Sale",
    alt: "Tradesman with something for sale"
  },
  "sold-out": {
    slug: "sold-out",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2003_53_40%20AM.png",
    label: "Sold Out",
    alt: "Tradesman signalling sold out / all gone"
  },
  // Special: seller-selectable mood on marketplace listings. When
  // applied, the side-lane card renders an inline offer input beside
  // the price and shows live offers underneath. See SideLanePost.
  "make-me-offer": {
    slug: "make-me-offer",
    url: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2004_45_54%20AM.png",
    label: "Make Me an Offer",
    alt: "Tradesman holding sign inviting offers"
  }
};

/** Picker order — moods first (most common on Yard cards), then trade
 *  activities. The composer picker walks this list. Keyword-only
 *  utility characters (see MoodSlug comment) are intentionally NOT in
 *  this array — they render on posts via `suggestMood` matches only. */
export const MOOD_ORDER: MoodSlug[] = [
  "hard-at-work",
  "thinking",
  "confused",
  "frustrated",
  "angry",
  "unimpressed",
  "shocked",
  "dizzy",
  "pushing",
  "kept-going",
  "still-working",
  "injured",
  "celebrating",
  "laughing",
  "friday-feeling",
  "asleep",
  "on-staircase",
  "in-kitchen",
  "on-bobcat",
  "mixing",
  "fitting-panels",
  "on-roof",
  "shoveling",
  "on-scaffolding",
  "painting",
  "bricklaying",
  "welding",
  "metalworking",
  "landscaping",
  "plumbing",
  "plastering",
  "electrical"
];

// Keyword → mood heuristic. First match wins, so put specific
// patterns first. Deliberately shallow — this is NOT sentiment
// analysis. We accept the occasional wrong pick as the trade-off
// for zero API cost and instant response as the user types.
const MOOD_KEYWORDS: Array<{ pattern: RegExp; slug: MoodSlug }> = [
  // ── Emotions ─────────────────────────
  { pattern: /\b(injur|hurt|cut|bleeding|bandage|sliced|hospital|A&E)\b/i, slug: "injured" },
  { pattern: /\b(carrying on|carrying it|still on it|not stopping|kept at it)\b/i, slug: "still-working" },
  { pattern: /\b(shattered|beaten|broken|drained|exhausted|shattered|nearly out)\b/i, slug: "pushing" },
  { pattern: /\b(fuming|raging|livid|absolute joke|joker|proper wound up)\b/i, slug: "angry" },
  { pattern: /\b(you don't say|no way|really\?|come on|surely not|deadpan)\b/i, slug: "unimpressed" },
  { pattern: /\b(spinning|dizzy|head gone|overwhelmed|too much)\b/i, slug: "dizzy" },
  { pattern: /\b(shocked|no way|jaw dropped|stunned|couldn't believe)\b/i, slug: "shocked" },
  { pattern: /\b(friday|beer|pub|pint|weekend|clocked off|off the tools)\b/i, slug: "friday-feeling" },
  { pattern: /\b(smashed it|nailed it|finished|done|proud|got the job|landed the job|milestone)\b/i, slug: "celebrating" },
  { pattern: /\b(haha|lol|joke|funny|hilarious|cracked up)\b/i, slug: "laughing" },
  { pattern: /\b(knackered|kip|snooze|dozing|nodding off)\b/i, slug: "asleep" },
  { pattern: /\b(delay|waiting|stuck|chase|nothing back|late|overdue)\b/i, slug: "frustrated" },
  { pattern: /\b(anyone got|any tips|advice|which one|recommend|thoughts|not sure|help)\b/i, slug: "confused" },
  { pattern: /\b(day rate|£|charging|charge|price|fee|budget|quote|invoice|paying)\b/i, slug: "thinking" },

  // ── Trade activities ────────────────
  { pattern: /\b(staircase|stairs|stair|banister|handrail)\b/i, slug: "on-staircase" },
  { pattern: /\b(kitchen|worktop|cabinet|cupboard|island)\b/i, slug: "in-kitchen" },
  { pattern: /\b(bobcat|digger|excavator|dumper|plant)\b/i, slug: "on-bobcat" },
  { pattern: /\b(mix|mortar|concrete|screed|plaster mix)\b/i, slug: "mixing" },
  { pattern: /\b(panel|panels|panelling|drywall|plasterboard)\b/i, slug: "fitting-panels" },
  { pattern: /\b(roof|tile|slate|flashing|ridge|gutter)\b/i, slug: "on-roof" },
  { pattern: /\b(shovel|dig|digging|graft)\b/i, slug: "shoveling" },
  { pattern: /\b(scaffold|scaff|edge protection|tower)\b/i, slug: "on-scaffolding" },
  { pattern: /\b(paint|painting|emulsion|undercoat|topcoat|gloss)\b/i, slug: "painting" },
  { pattern: /\b(brick|brickie|pointing|render)\b/i, slug: "bricklaying" },
  { pattern: /\b(weld|welder|mig|tig|arc)\b/i, slug: "welding" },
  { pattern: /\b(metal|steel|fabricat|structural|beam)\b/i, slug: "metalworking" },
  { pattern: /\b(landscape|garden|turf|patio|paving|decking)\b/i, slug: "landscaping" },
  { pattern: /\b(plumb|pipe|leak|boiler|tap|radiator|drain)\b/i, slug: "plumbing" },
  { pattern: /\b(plaster|skim|render|screed|scratch coat)\b/i, slug: "plastering" },
  { pattern: /\b(electric|sparks|wiring|consumer unit|CU|fusebox|socket|EV charger|EICR)\b/i, slug: "electrical" },

  // ── Keyword-only utility characters ──────────
  // General "on the tools" character — fires when the post talks about
  // being at work / on site / grafting but doesn't mention a specific
  // trade activity. Runs LAST so it doesn't shadow the specific
  // trade patterns above. Never surfaced by the picker.
  { pattern: /\b(on site|on-site|graft|grafting|on the tools|toolbox|clocked on|day on)\b/i, slug: "on-tools" },
  { pattern: /\b(important|notice|attention|heads up|announcement|announce|warning|urgent|PSA|listen up)\b/i, slug: "announcement" },
  { pattern: /\b(for sale|selling|£\d+|swap|swaps|offers?|make me an offer|need gone|clearance|second hand|used|barely used|going cheap|reduced|bargain)\b/i, slug: "for-sale" },
  { pattern: /\b(sold|sold out|all gone|no longer available|taken|spoken for|pending collection|collected|thanks all)\b/i, slug: "sold-out" },
  { pattern: /\b(make me an offer|open to offers?|offers over|best offer|OBO|highest bid|price negotiable|price OBO|any offers)\b/i, slug: "make-me-offer" }
];

/** Client-side heuristic. Returns the best-match mood slug for the
 *  given draft text, or "hard-at-work" as the neutral default. Runs in
 *  under 1ms — safe to call on every keystroke. */
export function suggestMood(text: string | null | undefined): MoodSlug {
  const t = (text ?? "").trim();
  if (!t) return "hard-at-work";
  for (const { pattern, slug } of MOOD_KEYWORDS) {
    if (pattern.test(t)) return slug;
  }
  return "hard-at-work";
}

/** Reads mood from a post's metadata.mood jsonb field. Returns null
 *  when no explicit mood is set — caller can then fall back to
 *  suggestMood() on the body. */
export function readMoodFrom(
  metadata: unknown
): MoodSlug | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = (metadata as { mood?: unknown }).mood;
  if (typeof m !== "string") return null;
  return (m in MOOD_LIBRARY ? m : null) as MoodSlug | null;
}

/** For quote-form flair. Given a trade slug (the merchant's primary
 *  trade), returns the best activity character to render at bottom-
 *  right of the form. Falls back to `hard-at-work` if no activity
 *  character matches. */
export function moodForTrade(tradeSlug: string): MoodDef {
  for (const slug of MOOD_ORDER) {
    const def = MOOD_LIBRARY[slug];
    if (def.trades?.includes(tradeSlug)) return def;
  }
  return MOOD_LIBRARY["hard-at-work"];
}
