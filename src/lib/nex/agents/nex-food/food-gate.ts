// src/lib/nex/agents/nex-food/food-gate.ts
//
// WAVE-S-4 · Deterministic food classifier + safety signals
// Founder BEGIN WAVE-S-4 · 2026-09-08

import type { FoodRequest, FoodRequestKind, FoodResponse, FoodSafetySignal } from "./types";

export function classifyFoodRequest(text: string): FoodRequestKind {
  const t = (text ?? "").toLowerCase();
  if (!t) return "unknown";
  // Medical-boundary short-circuit · specialized handler owns it
  if (/\b(diagnos(e|is)|prescription|clinical nutrition|meal plan for (diabetes|cancer|kidney|heart)|treat (my|the) )/i.test(t)) return "unknown";
  if (/\b(allergy|allergen|allergies|allergic|anaphylaxis|epipen)\b/.test(t)) return "allergen_check";
  // Cultural/religious check runs BEFORE dietary because halal-for-ramadan is cultural, not dietary
  if (/\b(ramadan|iftar|suhoor|passover|shabbat|diwali|hindu|buddhist|muslim|jewish|orthodox|christmas dinner)\b/.test(t)) return "cultural_practice";
  // Storage/shelf-life · includes fridge/freezer/last-in-the-fridge language
  if (/\b(shelf life|expiry|expires|expired|leftover|freezer burn|refrigerate|use.by|best.before|fridge|freezer|last(?:s)? in the (?:fridge|freezer)|how long does .* last)\b/.test(t)) return "storage_shelf_life";
  if (/\b(temperature|thermometer|internal temp|cook to \d+|degrees|celsius|fahrenheit|leave (?:meat|chicken|poultry|fish) out)\b/.test(t)) return "temperature_guidance";
  if (/\b(vegan|vegetarian|gluten.free|dairy.free|kosher|halal|jain|pescatarian|keto|paleo)\b/.test(t)) return "dietary_restriction";
  if (/\b(safe to eat|ok to eat|is (?:this|it) (?:ok|safe)|eat (?:raw|undercooked)|food safety|hygiene|contamination|foodborne|salmonella|listeria|e\.?coli|botulism|same (?:board|knife|utensil) for raw)\b/.test(t)) return "food_safety";
  if (/\b(hand wash|wash(?:ing)? hands?|sanitize|clean surface|prep board|utensil|cutting board)\b/.test(t)) return "hygiene_practice";
  if (/\b(recipe|cook|bake|fry|roast|grill|boil|simmer|marinat(?:e|ed|ing)|braise|sauce|dish|meal|ingredient|dinner ideas|sushi|sashimi)\b/.test(t)) return "recipe_help";
  return "unknown";
}

const COMMON_ALLERGENS_RE = /\b(peanut|peanuts|tree nut|tree nuts|almond|almonds|walnut|walnuts|cashew|cashews|hazelnut|hazelnuts|pistachio|pistachios|pecan|pecans|milk|dairy|lactose|egg|eggs|wheat|gluten|soy|soybean|shellfish|shrimp|prawn|prawns|crab|lobster|fish|salmon|tuna|cod|sesame|mustard|celery|sulphite|sulfite)\b/i;
const RAW_UNDERCOOKED_RE = /\b(raw chicken|raw poultry|undercooked chicken|undercooked poultry|raw pork|undercooked pork|raw egg|undercooked egg|runny egg|steak tartare|sushi|sashimi|raw fish|raw shellfish|raw oyster|rare hamburger|rare mince|raw mince)\b/i;
const MEDICAL_DIETARY_RE = /\b(diagnos(e|is)|prescription|treat my|cure my|clinical nutrition|meal plan for (diabetes|cancer|kidney disease|heart disease|crohn|celiac disease))\b/i;
const UNSUPPORTED_HEALTH_RE = /\b(cures? (cancer|diabetes|arthritis|any disease)|guaranteed weight loss|melts? fat|detox(es|ify|ifying)? (your |the )?body|superfood that (cures?|prevents?|treats?)|miracle (cure|food))\b/i;
const CROSS_CONTAMINATION_RE = /\b(same (board|knife|utensil) for raw|raw meat next to|reuse marinade|reuse .* from raw|touch cooked food after raw)\b/i;
const TEMPERATURE_UNSAFE_RE = /\b(leave (meat|chicken|poultry|fish) out for (\d+|several) hours|cook chicken to (rare|medium.rare|130|140|150)|room temperature for (days|hours)|thaw on (counter|worktop)( for)?)\b/i;
const CULTURAL_PRACTICE_RE = /\b(halal|kosher|jain diet|hindu vegetarian|buddhist vegetarian|ramadan|iftar|suhoor|passover|shabbat|no beef .* hindu|no pork .* muslim)\b/i;

export function detectFoodSafetySignals(req: FoodRequest, kind: FoodRequestKind): FoodSafetySignal[] {
  const out: FoodSafetySignal[] = [];
  const text = (req.request_text ?? "").toLowerCase();

  if (MEDICAL_DIETARY_RE.test(text)) {
    out.push({
      kind: "medical_dietary_boundary",
      description: "request touches clinical nutrition · diagnosis · prescription · NEX Phase 3 does not provide medical or clinical dietary advice · registered dietitian / clinician required",
    });
  }

  if (UNSUPPORTED_HEALTH_RE.test(text)) {
    out.push({
      kind: "unsupported_health_claim",
      description: "claim implies a health outcome NEX cannot verify (cures / detox / guaranteed weight loss) · rephrase without unsupported certainty · defer to registered dietitian for real dietary advice",
    });
  }

  const allergenMatch = text.match(COMMON_ALLERGENS_RE);
  if (allergenMatch) {
    // Suppress when the allergen appears in a "-free" / "no <allergen>" / "without <allergen>"
    // context · those phrases indicate the request is AVOIDING the allergen, not exposing to it.
    const allergen = allergenMatch[0];
    const negatedRe = new RegExp(`\\b(?:${allergen}[- ]?free|no ${allergen}|without ${allergen}|${allergen}[- ]?free)\\b`, "i");
    if (!negatedRe.test(text)) {
      out.push({
        kind: "allergen_present",
        allergen,
        description: `request mentions a common allergen (${allergen}) · verify recipient allergy status · label ingredient sources · declare allergen category on packaging or menu`,
      });
    }
  }

  const rawMatch = text.match(RAW_UNDERCOOKED_RE);
  if (rawMatch) {
    out.push({
      kind: "raw_undercooked_risk",
      ingredient: rawMatch[0],
      description: `request touches raw or undercooked (${rawMatch[0]}) · foodborne-illness risk · pregnant / immunocompromised / very young / elderly should avoid · use pasteurized alternatives when possible`,
    });
  }

  if (CROSS_CONTAMINATION_RE.test(text)) {
    out.push({
      kind: "cross_contamination_risk",
      description: "cross-contamination risk detected · separate boards / knives / surfaces for raw and ready-to-eat · sanitize between uses · never reuse raw-meat marinade without boiling",
    });
  }

  if (TEMPERATURE_UNSAFE_RE.test(text)) {
    out.push({
      kind: "temperature_out_of_range",
      description: "temperature or holding-time appears outside food-safe window · reference: refrigerate at ≤4°C · hold hot at ≥60°C · poultry internal 74°C · minced meat 71°C · never leave perishables at room temp >2h (>1h in hot weather)",
    });
  }

  const cultMatch = text.match(CULTURAL_PRACTICE_RE);
  if (cultMatch) {
    out.push({
      kind: "cultural_religious_awareness",
      practice: cultMatch[0],
      description: `request touches a cultural or religious food practice (${cultMatch[0]}) · verify certification when serving observant diners · avoid substitutions that break the practice`,
    });
  }

  if (out.length === 0) out.push({ kind: "no_food_safety_concern" });
  return out;
}

export function respondFood(req: FoodRequest): FoodResponse {
  const kind = classifyFoodRequest(req.request_text);
  const signals = detectFoodSafetySignals(req, kind);
  const has_serious = signals.some((s) => s.kind !== "no_food_safety_concern");
  // Phase 3 defers real recipe generation / macro calculation / real-time
  // supplier data / cuisine-specific advice to Phase 4 (LLM via gateway).
  const deferred = kind === "recipe_help" || kind === "dietary_restriction" || kind === "cultural_practice";
  const requires_review = has_serious || kind === "unknown";

  const lines: string[] = [];
  lines.push(`Food request classified as: ${kind}.`);
  if (deferred) lines.push("Phase 3 specialist does not generate recipes / macro-calculated meal plans / cuisine-specific creative content · deferred to Phase 4 (LLM via gateway).");
  for (const s of signals) {
    if (s.kind === "no_food_safety_concern") continue;
    if (s.kind === "medical_dietary_boundary") lines.push(`⚠️ NEX does not provide medical or clinical dietary advice. Speak to a registered dietitian or clinician for individual guidance.`);
    else if (s.kind === "unsupported_health_claim") lines.push(`Health-claim flag · claims implying cures / detox / guaranteed outcomes are not supported by NEX.`);
    else if (s.kind === "allergen_present") lines.push(`Allergen flag (${s.allergen}) · verify allergy status · declare category on menu / packaging.`);
    else if (s.kind === "raw_undercooked_risk") lines.push(`Raw/undercooked flag (${s.ingredient}) · foodborne-illness risk · protect vulnerable groups.`);
    else if (s.kind === "cross_contamination_risk") lines.push(`Cross-contamination flag · separate raw / ready-to-eat surfaces + utensils.`);
    else if (s.kind === "temperature_out_of_range") lines.push(`Temperature flag · reference food-safe temperature and holding times.`);
    else if (s.kind === "cultural_religious_awareness") lines.push(`Cultural/religious practice flag (${s.practice}) · verify certification where required.`);
  }

  return {
    request_id: req.request_id,
    detected_kind: kind,
    safety_signals: signals,
    advisory_text: lines.join(" "),
    requires_human_review: requires_review,
    deferred_to_phase_4: deferred,
  };
}
