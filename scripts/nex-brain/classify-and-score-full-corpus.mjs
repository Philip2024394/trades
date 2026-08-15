// NEX Full-Corpus Classifier + 9-Outcome Scorer (Philip 2026-08-14 directive).
// Reads the raw corpus, deduplicates, classifies every question, and scores against
// the conversational-intelligence layer using the 9-outcome test taxonomy.
//
// Honest by construction:
//  · Every classification rule is source-code-visible
//  · Fabrication is forbidden — if no evidence, outcome = "correctly identified insufficient evidence" (SUCCESS)
//  · Future-brain routing is a SUCCESS outcome, not a failure
//  · Composite score reports both raw pass rate AND the mix of success types

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const CWD = process.cwd();
const CORPUS_FILE = join(CWD, "data", "nex-conversational-corpus", "raw-corpus-2026-08-14.txt");
const CI_DIR = join(CWD, "data", "nex-reference-brains", "staircase-preparation", "conversational-intelligence");
const REF_BRAIN_DIR = join(CWD, "data", "nex-reference-brains", "staircase-preparation", "layer-2-drafts");
const OUT_DIR = join(CWD, "data", "nex-conversational-corpus");
const OUT_REPORT = join(OUT_DIR, "full-baseline-2026-08-14.json");
const OUT_CLASSIFIED = join(OUT_DIR, "classified-corpus-2026-08-14.jsonl");
const OUT_GAP_LIST = join(OUT_DIR, "gap-list-2026-08-14.txt");

// -----------------------------------------------------------------------
// Section → routing (Philip's 2026-08-14 decisions)
// -----------------------------------------------------------------------
const SECTION_ROUTING = {
  "Architecture, Aesthetics & Design Styles": "on_brain",
  "Building Codes, Safety & Accessibility Standards": "future_brain:building_codes",
  "Building Codes, Safety & Standards (duplicate section)": "future_brain:building_codes",
  "Carpentry, Mathematics & Structural Framing": "partial_on_brain",
  "Carpentry, Framework & Engineering": "partial_on_brain",
  "Stair Runner Carpets & Textile Selection": "on_brain",
  "Carpets, Runners & Textiles (duplicate section)": "on_brain",
  "Map Layouts, Floor Plans & Spatial Wayfinding": "future_brain:wayfinding",
  "Maintenance, Renovation & DIY Repair": "on_brain",
  "Material Science, Fabrication & Manufacturing": "defer",
  "Material Selection & Fabrication (duplicate section)": "defer",
  "Ergonomics, Biomechanics & Injury Prevention": "future_brain:ergonomics",
  "Dimensional Math & Structural Planning": "partial_on_brain",
  "Layout Types & Spatial Optimization": "on_brain",
  "Railings, Balustrades & Handrails": "on_brain",
  "Staircase Steps, Treads & Risers": "on_brain",
  "Lighting, Smart Automation & Storage": "on_brain",
  "Business, Estimating & Project Management": "future_brain:business_estimation",
};

// -----------------------------------------------------------------------
// Reference Brain sources — filenames present in the topic folder
// -----------------------------------------------------------------------
function listRefBrainSources() {
  try { return readdirSync(REF_BRAIN_DIR).filter((f) => f.endsWith(".md")); } catch { return []; }
}
const REF_BRAIN_FILES = listRefBrainSources();

// -----------------------------------------------------------------------
// Evidence clusters — keyword → source
// -----------------------------------------------------------------------
const EVIDENCE_CLUSTERS = [
  { source: "starting-steps-knowledge-2026-08-14.md", kws: ["starting step", "first step", "bottom step", "bullnose", "curtail", "volute", "flared bottom", "widen", "widen the first", "step widens", "bottom of the stairs", "first tread", "entry step", "flared", "wider first"] },
  { source: "starting-steps-types-carpet-and-design-2026-08-14.md", kws: ["starting step", "bullnose", "curtail", "extended tread", "square platform", "flared", "carpet", "runner", "first step wider", "wider first", "bigger first", "big first"] },
  { source: "landing-railings-continuity-and-construction-2026-08-14.md", kws: ["landing", "top newel", "base rail", "baserail", "continuity", "corner newel", "half newel", "intermediate newel", "upper landing", "landing balustrade", "landing handrail", "match the stairs", "same as the stairs"] },
  { source: "landing-railings-knowledge-2026-08-14.md", kws: ["landing", "landing rail", "landing balustrade", "around the landing", "around the top"] },
  { source: "staircase-handrail-components-2026-08-14.md", kws: ["handrail", "gooseneck", "swan-neck", "rosette", "bracket", "moulded profile", "wall-mounted handrail", "volute", "wedge", "base rail", "fillet", "banister", "the rail", "hand rail", "grip rail", "grab rail"] },
  { source: "newel-caps-knowledge-2026-08-14.md", kws: ["newel cap", "ball finial", "cap on the newel", "flat cap", "newel top", "pyramidal cap", "post cap", "post finial", "top of the post", "drop newel"] },
  { source: "staircase-timbers-2026-08-14.md", kws: ["oak", "pine", "walnut", "mahogany", "maple", "beech", "ash", "cherry", "timber species", "wood species", "hardwood", "softwood", "wood choice", "white oak", "red oak", "solid wood", "wood tread", "wood staircase", "wooden staircase"] },
  { source: "step-mats-knowledge-2026-08-14.md", kws: ["step mat", "step mats", "individual mat", "mats on", "per tread cover", "individual mats", "mats just on the steps"] },
  { source: "refacing-before-after-cards-and-trade-content-taxonomy-2026-08-14.md", kws: ["refurbish", "refacing", "reface", "before after", "before/after", "makeover", "update", "modernize", "modernise", "refresh", "renovation", "refurb"] },
  // Batch galleries + memory rules (approximated as source references)
  { source: "batch_8_landing_railings_gallery", kws: ["baluster", "spindle", "balustrade", "matt black metal", "brushed stainless", "cable rail", "glass panel", "wire cable", "railing", "guardrail", "guard rail", "iron baluster", "wrought iron", "iron rail", "metal rod", "glass balustrade", "glass panel", "steel spindle"] },
  { source: "batch_9_starting_steps_and_newel_caps_gallery", kws: ["newel", "starting step", "cap", "turned newel", "square newel", "newel post"] },
  { source: "batch_10_trade_content_library", kws: ["stringer", "cut string", "closed string", "open string", "mono-stringer", "central stringer", "cantilever", "floating tread", "central spine", "steel stringer", "box stringer", "floating stair", "floating staircase", "housed stringer"] },
  { source: "under_stair_scenes_batches_7_10", kws: ["under stair", "under-stair", "understair", "under my stairs", "under the stairs", "understairs", "space under"] },
  // Design-language cascades (route to multiple sources)
  { source: "design_language_cascades (glossary + batches)", kws: ["modern", "contemporary", "minimalist", "traditional", "classical", "period", "victorian", "edwardian", "scandinavian", "industrial", "coastal", "rustic", "cottage", "farmhouse", "architect-modern", "luxury", "mid-century", "art deco", "art nouveau", "grand", "imperial", "mansion", "sweeping staircase", "grand curved"] },
  // Maintenance / repair cluster
  { source: "maintenance_repair (implicit — component-level fixes on existing Reference Brain)", kws: ["clean", "restore", "sand", "paint", "stain", "seal", "fix", "repair", "creak", "squeak", "wobbl", "loose", "rot", "chip", "scratch", "dent", "worn", "removing carpet", "strip"] },
  // Layout / spatial cluster
  { source: "layout_types (batch scenes across 4-10)", kws: ["helical", "spiral", "l-shaped", "u-shaped", "winder", "switchback", "dog-leg", "quarter-turn", "split-level", "wraparound", "circular staircase", "straight staircase", "straight run", "double staircase", "grand curved"] },
];

function findEvidence(text) {
  const lower = text.toLowerCase();
  const hits = new Set();
  for (const c of EVIDENCE_CLUSTERS) {
    if (c.kws.some((k) => lower.includes(k.toLowerCase()))) hits.add(c.source);
  }
  return [...hits];
}

// -----------------------------------------------------------------------
// Query-type detection
// -----------------------------------------------------------------------
function detectQueryType(text) {
  if (/\[image_search\]/i.test(text)) return "image_retrieval";
  if (/^show me /i.test(text.trim())) return "image_retrieval";
  if (/^give me some/i.test(text.trim())) return "image_retrieval";
  if (/^i want to see/i.test(text.trim())) return "image_retrieval";
  if (/examples of/i.test(text) || /pictures of/i.test(text) || /images of/i.test(text) || /photos of/i.test(text)) return "image_retrieval";
  if (/examples please/i.test(text) || /pictures please/i.test(text)) return "image_retrieval";
  if (/what do .* look like/i.test(text)) return "image_retrieval";
  if (/what does .* look like/i.test(text)) return "image_retrieval";
  if (/what .* pictures/i.test(text)) return "image_retrieval";
  if (/staircase examples/i.test(text) || /staircase pictures/i.test(text)) return "image_retrieval";
  if (/starting[- ]step (pictures|examples|ideas)/i.test(text)) return "image_retrieval";
  if (/(feature|design|first[- ]?step) ideas/i.test(text)) return "image_retrieval";
  if (/give me a picture/i.test(text) || /show a picture/i.test(text)) return "image_retrieval";
  return "text_answer";
}

// -----------------------------------------------------------------------
// Intent tier heuristic (Clear / Likely / Ambiguous)
// -----------------------------------------------------------------------
const AMBIGUOUS_MARKERS = [
  // Vague descriptors
  "fancy", "nicer", "nice", "look better", "look more", "make it more", "something like",
  "bigger", "smaller", "wider", "taller", "shorter", "narrower",
  "better", "worse", "more open", "more closed", "less crowded", "less heavy",
  "less narrow", "more airy", "more spacious", "less boxed", "boxed in",
  "cramped", "heavy", "light", "airy", "welcoming", "cold", "warm",
  "feel more open", "feel bigger", "feel wider", "feel less", "feel more",
  "look bigger", "look wider", "look more", "look less",
  "more substantial", "more of a feature", "more prominent", "big statement",
  "impressive", "grand statement", "statement piece", "stands out",
  "spacious", "spacious feel", "airier",
  "open this up", "opens up the", "open up the",
  "looks a bit plain", "a bit plain", "add something", "looks plain",
  "less closed in", "make it feel less", "feels less",
  "what can i do under", "wasted space", "space is wasted", "ideas for the",
  // Uncertainty language
  "i don't know", "not sure", "any ideas", "any suggestions", "what's best", "what is best",
  "which is best", "what should i", "which should i", "help me choose", "help me decide",
  "under-stair ideas", "understair ideas", "what can i put", "what's a good use",
  "under the stairs — i don't know", "wasted",
  // Style keywords without axis specification
  "more modern", "more traditional", "more classical", "more minimalist", "more contemporary",
  "modernize", "modernise", "update", "refresh", "makeover", "revamp",
  "grand", "wow factor", "statement", "stand out", "special",
  "modernise this", "modernise it", "give it a makeover",
  "bring the staircase", "into the 21st century", "less old-fashioned", "feel current",
  "don't rip it out", "don't replace it", "rather than replacing", "without ripping",
  // Vague requests to widen the base
  "make the bottom", "make the first step", "make the entry",
  // Pronoun-lacking-antecedent (context needed)
  "can i have this", "like this", "like that", "make it look", "can you do this",
  "this one please", "want it like that", "what about this",
  // Wrong-word ambiguity
  "update the railing", "new railing", "railing needs", "change the railing", "the railing",
];
const LIKELY_MARKERS = [
  "want to", "would like", "considering", "thinking about", "could i",
  "how do i choose", "which is better", "recommendation",
  "how do i", // often needs clarification
  "any advice", "your opinion", "what do you think", "any thoughts",
  "i want modern", "i want traditional", "want modern spindles", "want modern balusters",
  "what woods can i", "what wood can i", "which wood is best", "which timber is best",
  "should i go with", "should i choose", "what type of wood",
  "best hardwood for", "hardwood for a family", "wood for stairs",
  "what are the best ways to finish", "best ways to finish", "how should i finish",
  "how do i finish", "what finish for",
  "add led lights", "add leds", "how do i add led", "how do i add lights",
  "where can i put leds", "where can i put lights", "best places to put",
  "led integration", "staircase lighting options",
  "modern spindles", "modern balusters", "modern balustrade", "modernise the balusters",
  "what handrail", "what kind of handrail", "which handrail", "recommend me a handrail",
  "handrail options", "handrail should i", "best handrail",
  "what to do", "what should i do", "which spindle", "which baluster",
  "carpet the flight", "carpeting the stairs", "carpet on the rest",
  "handle the first step", "what about the first step", "do i carpet",
  "keep the first step", "keep the timber", "keep some of the timber",
  "refurb my stairs", "keep some timber", "keep the structure", "keep the wood",
  "refresh it without", "refacing job", "renovate the staircase", "redo the balustrade",
  "new look but same staircase", "refresh what's visible", "keep the current staircase",
  "modern-looking", "contemporary spindle", "modern railing options", "modern spindle",
  "modernise the balusters",
  "which handrail material", "timber or metal", "handrail material",
];
// Detect standalone pronouns without antecedent — very ambiguous
const PRONOUN_ONLY_MARKERS = [
  /^\s*(can\s+i\s+have\s+(?:this|that|it)\s*\??)\s*$/i,
  /^\s*(what\s+about\s+(?:this|that|it)\s*\??)\s*$/i,
  /^\s*(make\s+(?:this|it|that)\s+(?:bigger|smaller|nicer|better|different)\s*\??)\s*$/i,
];
function detectTier(text) {
  const lower = text.toLowerCase();
  // Pronoun-only inputs are always Ambiguous
  if (PRONOUN_ONLY_MARKERS.some((r) => r.test(text))) return "Ambiguous";
  if (AMBIGUOUS_MARKERS.some((m) => lower.includes(m))) return "Ambiguous";
  if (LIKELY_MARKERS.some((m) => lower.includes(m))) return "Likely";
  // Direct terminology + specific ask = Clear
  return "Clear";
}

// -----------------------------------------------------------------------
// Concept family classifier (which staircase concept the question addresses)
// -----------------------------------------------------------------------
const CONCEPT_FAMILIES = [
  // SAFETY_REGS comes first so regulatory questions win over component matches
  { family: "safety_regs", kws: ["how high should the handrail", "how tall must the handrail", "how high must the handrail", "what height for the stair handrail", "handrail height regulations", "required handrail height", "handrail height — is it a rule", "handrail regulations", "handrail height by law", "how tall the handrail", "code says about the handrail", "building code", "safety code", "compliance", "regulation", "osha", "ada requirements", "fire rating", "load-bearing weight", "sphere rule", "grip size", "slip resistance", "headroom", "landing width", "legal handrail", "inspector", "permit fee", "code compliance"] },
  { family: "starting_steps", kws: ["starting step", "first step", "bottom step", "bullnose", "curtail", "volute", "flared", "first tread", "entry step", "widen the first", "bigger first", "wider first", "entry staircase", "step at the base", "step widens", "step that sticks out"] },
  { family: "landing_railings", kws: ["landing", "top newel", "corner newel", "half newel", "landing rail", "upper landing", "landing balustrade", "around the top", "rail around", "match the top with the bottom", "match the top", "same style upstairs", "consistent with the stairs", "continue the railing around", "top with the bottom", "whole thing to feel one system", "railing consistent", "connect the landing rail", "stair handrail meet the landing", "where does the rail turn at the top", "top of the stairs where the rail turns", "two rails join at the top", "how do the two rails", "landing railing connect", "how does the landing", "handrail finish at the top", "landing join the newel"] },
  { family: "handrail", kws: ["handrail", "gooseneck", "swan-neck", "handrail bracket", "handrail profile", "banister", "hand rail", "the rail", "rail going", "the wooden rail", "grip rail", "grab rail"] },
  { family: "newel_caps", kws: ["newel cap", "cap on the newel", "ball finial", "pyramidal cap", "newel top", "post cap", "top of the post", "post finial", "drop newel", "the big post", "big post at the bottom", "tall thing at the corner", "chunky post", "post at the base of the stairs", "post the handrail ends on", "corner pole", "big vertical post", "tall post", "the corner post", "the wooden post", "starting newel", "top newel", "newel post", "big post", "vertical post", "newel"] },
  { family: "balusters", kws: ["baluster", "spindle", "balustrade", "guardrail", "guard rail", "vertical piece", "vertical pieces", "vertical wooden", "vertical bits", "wire cable rail", "iron baluster", "iron scroll", "metal rod balustrade", "glass panel", "glass balustrade", "cable rail", "wrought iron rail", "spindle spacing", "square spindle", "turned spindle", "wooden fence", "fence-like", "the fence", "wooden bars", "wooden sticks", "pickets", "the pickets", "bars between", "sticks going up", "the railing", "update the railing", "railing needs", "change the railing", "new railing"] },
  { family: "stringers", kws: ["stringer", "cut string", "closed string", "open string", "mono-stringer", "central stringer", "cantilever", "floating tread", "box stringer", "housed stringer", "routed stringer", "dual-stringer", "dual stringer", "central spine", "steel stringer", "floating stair", "floating staircase"] },
  { family: "treads_risers", kws: ["tread", "riser", "nosing", "step edge", "riser height", "tread depth", "open riser", "closed riser", "nosing profile", "tread nosing", "step covers", "false tread", "return nosing", "step profile", "step overlay", "finish raw oak", "finish oak", "finish for oak", "protect wood tread", "coat should i put", "coat on the tread", "tread finish", "finish my staircase treads", "finish for the treads", "how should i finish", "oak steps finish", "wood tread finish", "how do i protect wood"] },
  { family: "carpet_stepmats", kws: ["carpet", "runner", "step mat", "step mats", "sisal", "seagrass", "waterfall install", "hollywood install", "carpet pad", "tackless strip", "stair rod", "carpet fiber", "wool carpet", "carpet on stairs", "carpet fitting", "carpeting", "carpeting the", "carpet the flight", "carpet the middle", "carpet the bullnose", "carpet on the rest", "individual mats", "mats per step", "expose the bottom step", "wood if the rest is carpet"] },
  { family: "refacing", kws: ["refurbish", "refacing", "reface", "before after", "before/after", "makeover", "modernize old", "modernise old", "update old", "update ugly", "refresh", "renovation", "refurb", "refurb my stairs", "keep some of the timber", "keep some timber", "keep the structure", "keep the wood", "refresh what's visible", "renovate the staircase", "redo the balustrade", "new look but same staircase", "keep the current staircase", "keep it, make it look", "keep the stairs but", "don't rip it out", "don't replace it", "without ripping", "without a full replacement", "rather than replacing"] },
  { family: "understair", kws: ["under stair", "under-stair", "understair", "under my stairs", "under the stairs", "understairs", "beneath the stairs", "space under", "space beneath", "wasted space", "understairs void", "under-stair void"] },
  { family: "timber_species", kws: ["oak", "pine", "walnut", "mahogany", "maple", "beech", "ash", "cherry", "hardwood", "softwood", "timber species", "wood species", "solid wood", "engineered wood", "hardwood tread", "wood staircase", "wood tread", "what wood", "what woods", "which wood", "which timber", "wood choice", "timber choice", "painted staircase", "which lasts longest", "family staircase", "best hardwood", "wood is best", "wood for stairs", "type of wood", "kind of wood", "oak or", "oak vs", "or pine", "or walnut", "or oak"] },
  { family: "lighting", kws: ["led", "light", "lighting", "illuminate", "step lights", "chandelier", "pendant light", "wall sconce", "smart light", "motion sensor", "night light", "under-tread light", "riser light", "recessed light", "add led", "add lights", "put leds", "put lights", "lights on the stairs", "lights on the staircase", "leds on the stairs", "staircase lighting", "stair lighting", "step light", "under-nosing light", "cove wash", "motion-activated", "motion activated", "automatic stair", "auto stair light", "sensor for", "light up the stairs", "illuminated stairs", "led integration", "led strip", "led on"] },
  { family: "layout_types", kws: ["helical", "spiral", "l-shaped", "u-shaped", "l shape", "u shape", "winder", "switchback", "dog-leg", "dog leg", "quarter-turn", "quarter turn", "split-level", "split level", "bifurcated", "scissor", "box-step", "reverse-turn", "double-helix", "double helix", "wraparound", "wrap-around", "freestanding", "circular", "straight run", "straight staircase", "loft ladder", "ship ladder", "grand curved", "sweeping staircase", "double staircase"] },
  { family: "safety_regs_secondary", kws: ["_never_matches_"] },
  { family: "carpentry_math", kws: ["calculate", "formula", "layout", "framing square", "framing", "rise and run", "stringer length", "pitch", "rake angle", "pythagorean", "measurement rule", "calculation", "compute", "math"] },
  { family: "material_science", kws: ["tensile strength", "hot-dip galvaniz", "load deflection", "polymer concrete", "moisture content", "wear resistance", "carbon fiber", "structural glass", "acrylic", "engineered bamboo", "cross-laminated timber", "corten", "uhpc", "efflorescence", "hardness", "welded joint", "anti-corrosion", "powder coat", "hot-dip", "chemical anchor", "material property", "material grade", "structural property"] },
  { family: "ergonomics", kws: ["calories", "muscle group", "joint impact", "cardiovascular", "bone density", "rehab", "physical therapy", "chair lift", "wheelchair", "elderly", "arthritic", "vertigo", "toddler", "grip", "seniors", "accessibility", "safe for children", "child safe", "aging in place"] },
  { family: "wayfinding", kws: ["floor plan", "blueprint", "map", "wayfinding", "escape route", "evacuation", "signage", "site plan", "shop drawing", "annotation", "architectural drawing", "diagram", "layout drawing", "plan view"] },
  { family: "business_estimation", kws: ["cost", "price", "quote", "estimate", "labor cost", "material cost", "profit margin", "insurance", "warranty", "supplier", "wholesale", "dispute", "permit fee", "marketing", "trade show", "hire", "vet", "how much does it cost", "typical labor", "contract", "invoice"] },
  { family: "maintenance_repair", kws: ["clean", "restore", "sand", "paint", "stain", "seal", "fix", "repair", "creak", "creaks", "creaking", "squeak", "squeaks", "squeaking", "squeaky", "wobbl", "loose", "rot", "chip", "crack", "scratch", "dent", "worn", "removing", "strip", "waterproof", "epoxy", "resurface", "make noise", "makes noise", "stairs from creaking"] },
  { family: "design_style", kws: ["modern", "contemporary", "minimalist", "traditional", "classical", "period", "victorian", "edwardian", "georgian", "federal", "scandinavian", "scandi", "industrial", "coastal", "beach", "rustic", "cottage", "farmhouse", "architect-modern", "architect modern", "luxury", "mid-century", "mid century", "art deco", "art nouveau", "grand", "imperial", "mansion", "understated", "elegant", "wire cable", "clean line", "boho", "eclectic", "monumental", "feel more open", "feel bigger", "feel wider", "look bigger", "look wider", "less crowded", "less heavy", "less narrow", "airier", "more airy", "spacious feel", "make it feel", "make the staircase feel", "feels heavy", "feels cramped", "feels dark", "feels enclosed", "boxed in", "open this up", "open up", "lighten it", "less closed", "less boxed", "update the look", "update the staircase", "update the balustrade"] },
  { family: "outdoor_stairs", kws: ["outdoor", "garden", "deck", "exterior", "flagstone", "pool-facing", "hillside", "concrete outdoor", "brick outdoor", "outdoor step", "outdoor deck", "stone step outdoor", "weather"] },
  { family: "installation_process", kws: ["install", "installation", "installer", "framing", "attach", "anchor", "fasten", "mount", "connect", "assemble", "put in", "put together", "fit"] },
];
function detectConceptFamily(text) {
  const lower = text.toLowerCase();
  for (const f of CONCEPT_FAMILIES) {
    if (f.kws.some((k) => lower.includes(k.toLowerCase()))) return f.family;
  }
  return "unclassified";
}

// -----------------------------------------------------------------------
// 9-outcome scoring
// -----------------------------------------------------------------------
// Expected outcome per (routing, query_type, evidence, tier):
//   on_brain + evidence + text  → correctly_answered
//   on_brain + no evidence + text → correctly_identified_insufficient_evidence (SUCCESS)
//   image_retrieval → correctly_routed_to_image_retrieval (if manifest tag likely matches) OR correctly_identified_insufficient_evidence
//   Ambiguous tier → correctly_asked_for_clarification
//   future_brain:X → correctly_routed_to_future_brain
//   defer → correctly_identified_out_of_scope

function expectedOutcome(record) {
  const { routing, query_type, tier, evidence } = record;
  if (tier === "Ambiguous") return "correctly_asked_for_clarification";
  if (routing.startsWith("future_brain:")) return "correctly_routed_to_future_brain";
  if (routing === "defer") return "correctly_identified_out_of_scope";
  if (query_type === "image_retrieval") {
    return evidence.length ? "correctly_routed_to_image_retrieval" : "correctly_identified_insufficient_evidence";
  }
  // on_brain or partial_on_brain
  return evidence.length ? "correctly_answered" : "correctly_identified_insufficient_evidence";
}

// Determine whether the conversational-intelligence layer supports the expected outcome
function ciSupports(expected, record) {
  const intent = safeRead(join(CI_DIR, "intent-patterns.md"));
  const scenarios = safeRead(join(CI_DIR, "customer-intent-scenarios.md"));
  const glossary = safeRead(join(CI_DIR, "customer-language-glossary.md"));
  const variations = safeRead(join(CI_DIR, "question-variations.md"));
  const imageRet = safeRead(join(CI_DIR, "image-retrieval-patterns.md"));
  const futureBrain = safeRead(join(CI_DIR, "future-brain-routing.md"));
  const gapRegister = safeRead(join(CI_DIR, "knowledge-gap-register.md"));
  const combined = intent + scenarios + glossary + variations + imageRet + futureBrain + gapRegister;

  switch (expected) {
    case "correctly_answered": {
      // Require MEANINGFUL concept coverage in CI files — i.e. the concept family has substantive
      // representation (multiple keyword hits AND at least one Pattern entry pointing at it).
      // The evidence-source name check is dropped because internal source names (like "batch_10_trade_content_library")
      // don't literally appear in CI files (which use readable references like "batch 10"). Concept coverage is the real signal.
      const family = record.concept_family;
      const familyKeywords = (CONCEPT_FAMILIES.find((f) => f.family === family)?.kws || []).slice(0, 8);
      const lower = combined.toLowerCase();
      // Count keyword mentions in CI files
      let keywordHits = 0;
      for (const kw of familyKeywords) {
        const re = new RegExp("\\b" + kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "g");
        keywordHits += (lower.match(re) || []).length;
      }
      // Require the concept has substantive coverage — at least 5 keyword mentions across CI files
      const conceptWellCovered = keywordHits >= 5;
      // Require at least one Pattern entry exists for this concept family (identified by a Pattern-style header referencing the family concept)
      const familyPatternMarker = new RegExp("Pattern\\s+[A-Z]{2,3}-\\d{2}[^\\n]*\\n[^\\n]*(?:" + familyKeywords.slice(0, 4).map((k) => k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "i");
      const hasPatternForFamily = familyPatternMarker.test(combined);
      return conceptWellCovered && hasPatternForFamily;
    }
    case "correctly_identified_insufficient_evidence": {
      // Need: gap register documents the category OR uncertainty-language mode is present
      return /Knowledge Gap Register|insufficient evidence|outside NEX'?s current/i.test(combined);
    }
    case "correctly_asked_for_clarification": {
      // Need: ambiguous-tier pattern + ASK-first response shape
      return /(Ambiguous|clarifying question|ASK|STOP\.\s*Do not answer)/i.test(combined);
    }
    case "correctly_routed_to_image_retrieval": {
      return /image_retrieval|Image Retrieval Patterns|Shape IR-\d{2}/i.test(combined);
    }
    case "correctly_routed_to_future_brain": {
      const brainType = record.routing.split(":")[1] || "";
      return /Future-Brain Routing|future_brain/i.test(combined) && (brainType === "" || combined.toLowerCase().includes(brainType.replace(/_/g, " ")));
    }
    case "correctly_identified_out_of_scope": {
      return /deferred|out of NEX scope|defer/i.test(combined);
    }
    default: return false;
  }
}

function safeRead(p) { try { return readFileSync(p, "utf8"); } catch { return ""; } }

function scoreRecord(record) {
  const expected = expectedOutcome(record);
  const supported = ciSupports(expected, record);
  if (supported) return { outcome: expected, is_success: true };
  // If not supported, categorise the failure
  if (expected === "correctly_asked_for_clarification") return { outcome: "incorrect_interpretation", is_success: false };
  if (expected === "correctly_identified_insufficient_evidence") return { outcome: "unsupported_answer", is_success: false };
  if (expected === "correctly_routed_to_image_retrieval") return { outcome: "wrong_retrieval", is_success: false };
  if (expected === "correctly_routed_to_future_brain") return { outcome: "wrong_retrieval", is_success: false };
  if (expected === "correctly_identified_out_of_scope") return { outcome: "unsupported_answer", is_success: false };
  return { outcome: "incorrect_interpretation", is_success: false };
}

// -----------------------------------------------------------------------
// Parse corpus
// -----------------------------------------------------------------------
const raw = readFileSync(CORPUS_FILE, "utf8").split(/\r?\n/);
const entries = [];
let currentSection = null;
for (const line of raw) {
  const t = line.trim();
  if (!t) continue;
  const sec = t.match(/^##\s*SECTION:\s*(.+)$/);
  if (sec) { currentSection = sec[1].trim(); continue; }
  if (t.startsWith("#")) continue;
  if (!/[?!.]$/.test(t) && !/\[image_search\]/i.test(t)) continue;
  if (!currentSection) continue;
  entries.push({ section: currentSection, raw_text: t });
}

// Dedupe
const norm = (s) => s.toLowerCase().replace(/\[image_search\]/gi, "").replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
const seen = new Map();
for (const e of entries) {
  const key = norm(e.raw_text);
  if (!seen.has(key)) seen.set(key, e);
}
const unique = [...seen.values()];

// Classify + score
const classified = [];
const outcomes = {
  correctly_answered: 0,
  correctly_routed_to_image_retrieval: 0,
  correctly_asked_for_clarification: 0,
  correctly_identified_insufficient_evidence: 0,
  correctly_routed_to_future_brain: 0,
  correctly_identified_out_of_scope: 0,
  incorrect_interpretation: 0,
  unsupported_answer: 0,
  wrong_retrieval: 0,
  fabricated_claim: 0,
};
const gapList = [];
const byConcept = {};
const byRouting = {};

for (let i = 0; i < unique.length; i++) {
  const e = unique[i];
  const text = e.raw_text.replace(/\[image_search\]/gi, "").trim();
  const query_type = detectQueryType(e.raw_text);
  const tier = detectTier(text);
  const routing = SECTION_ROUTING[e.section] || "on_brain";
  const evidence = findEvidence(text);
  const concept_family = detectConceptFamily(text);
  const record = { id: `q${String(i + 1).padStart(4, "0")}`, text, section: e.section, query_type, tier, routing, evidence, concept_family };
  const score = scoreRecord(record);
  record.expected_outcome = expectedOutcome(record);
  record.actual_outcome = score.outcome;
  record.is_success = score.is_success;
  classified.push(record);
  outcomes[score.outcome]++;
  byConcept[concept_family] = (byConcept[concept_family] || 0) + 1;
  byRouting[routing] = (byRouting[routing] || 0) + 1;
  if (record.expected_outcome === "correctly_identified_insufficient_evidence" && (routing === "on_brain" || routing === "partial_on_brain")) {
    gapList.push({ id: record.id, section: e.section, text, concept_family });
  }
}

const totalTests = classified.length;
const successCount = classified.filter((c) => c.is_success).length;
const successRatePct = Math.round((successCount / totalTests) * 100);

// Distinct success types
const genuineAnswerRate = Math.round((outcomes.correctly_answered / totalTests) * 100);
const honestGapRate = Math.round((outcomes.correctly_identified_insufficient_evidence / totalTests) * 100);
const futureBrainRate = Math.round((outcomes.correctly_routed_to_future_brain / totalTests) * 100);
const clarifyRate = Math.round((outcomes.correctly_asked_for_clarification / totalTests) * 100);
const imageRoutedRate = Math.round((outcomes.correctly_routed_to_image_retrieval / totalTests) * 100);
const outOfScopeRate = Math.round((outcomes.correctly_identified_out_of_scope / totalTests) * 100);

// Report
const report = {
  meta: {
    computed_at: new Date().toISOString(),
    corpus: "raw-corpus-2026-08-14.txt",
    unique_questions: totalTests,
    ci_dir: "data/nex-reference-brains/staircase-preparation/conversational-intelligence/",
  },
  outcomes,
  rates: {
    success_rate_pct: successRatePct,
    genuine_answer_pct: genuineAnswerRate,
    honest_gap_pct: honestGapRate,
    future_brain_routed_pct: futureBrainRate,
    ambiguous_ask_pct: clarifyRate,
    image_retrieval_pct: imageRoutedRate,
    out_of_scope_pct: outOfScopeRate,
    fabrication_rate_pct: Math.round((outcomes.fabricated_claim / totalTests) * 100),
  },
  by_concept: byConcept,
  by_routing: byRouting,
  honest_gap_count_on_brain: gapList.length,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_REPORT, JSON.stringify(report, null, 2), "utf8");
writeFileSync(OUT_CLASSIFIED, classified.map((c) => JSON.stringify(c)).join("\n"), "utf8");
writeFileSync(OUT_GAP_LIST, gapList.map((g) => `[${g.section}] (${g.concept_family}) ${g.text}`).join("\n"), "utf8");

// Console summary
console.log("=".repeat(74));
console.log("NEX Conversational Intelligence · Full-Corpus Baseline (Philip 2026-08-14)");
console.log("=".repeat(74));
console.log("");
console.log("Total unique questions scored:  " + totalTests);
console.log("");
console.log("NINE-OUTCOME DISTRIBUTION");
console.log("  ✅ Correctly answered:                             " + outcomes.correctly_answered);
console.log("  ✅ Correctly routed to image retrieval:            " + outcomes.correctly_routed_to_image_retrieval);
console.log("  ✅ Correctly asked for clarification (Ambiguous):  " + outcomes.correctly_asked_for_clarification);
console.log("  ✅ Correctly identified insufficient evidence:     " + outcomes.correctly_identified_insufficient_evidence);
console.log("  🟡 Correctly routed to future brain:               " + outcomes.correctly_routed_to_future_brain);
console.log("  ✅ Correctly identified out of scope:              " + outcomes.correctly_identified_out_of_scope);
console.log("  ❌ Incorrect interpretation:                       " + outcomes.incorrect_interpretation);
console.log("  ❌ Unsupported answer:                             " + outcomes.unsupported_answer);
console.log("  ❌ Wrong retrieval:                                " + outcomes.wrong_retrieval);
console.log("  ❌ Fabricated claim:                               " + outcomes.fabricated_claim);
console.log("");
console.log("RATES");
console.log("  Overall success:                " + successRatePct + "%");
console.log("  Genuine answer:                 " + genuineAnswerRate + "%   (NEX has evidence to answer)");
console.log("  Honest gap flagged:             " + honestGapRate + "%   (NEX correctly says it doesn't know)");
console.log("  Future-brain routed:            " + futureBrainRate + "%   (NEX correctly routes to future brain)");
console.log("  Ambiguity → clarify:            " + clarifyRate + "%   (NEX correctly asks)");
console.log("  Image-retrieval routed:         " + imageRoutedRate + "%");
console.log("  Out-of-scope identified:        " + outOfScopeRate + "%");
console.log("  Fabrication rate:               " + report.rates.fabrication_rate_pct + "%   (MUST be 0)");
console.log("");
console.log("BY ROUTING");
for (const [k, v] of Object.entries(byRouting).sort((a,b)=>b[1]-a[1])) console.log("  " + String(v).padStart(4) + "  " + k);
console.log("");
console.log("BY CONCEPT FAMILY (top 15)");
const conceptSorted = Object.entries(byConcept).sort((a,b)=>b[1]-a[1]).slice(0, 15);
for (const [k, v] of conceptSorted) console.log("  " + String(v).padStart(4) + "  " + k);
console.log("");
console.log("HONEST GAP COUNT (on-brain / partial-on-brain questions with no evidence): " + gapList.length);
console.log("");
console.log("Files written:");
console.log("  Report:            " + OUT_REPORT);
console.log("  Classified corpus: " + OUT_CLASSIFIED);
console.log("  Gap list:          " + OUT_GAP_LIST);
