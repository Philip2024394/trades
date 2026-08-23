// Concept Extractor · turns (description + optional OCR + optional vision)
// into the banana-shaped concept structure Philip specified.
//
// Doctrine anchors:
//   · project_nex_owns_intelligence_capabilities_2026_08_22
//   · project_nex_owner_provenanced_pricing_2026_08_20 (never turn arbitrary
//     image prices into authoritative business prices)
//
// Deterministic. Rule-based. Zero LLM. NEX-owned extraction logic. Later
// iterations can replace this with an LLM-driven extractor BEHIND the same
// interface without touching consumers.
//
// The Banana Test target (Philip 2026-08-22 verbatim):
//   Input:  banana image + "This is a ripe yellow banana, a common fruit in Southeast Asia."
//   Output: { concept: "banana", category: "fruit", food: true,
//             typical_visual_characteristics: ["elongated","curved","yellow when ripe"],
//             related_concepts: ["fruit","food","peel","bunch","plant","southeast-asia"],
//             ... }

import type { NexVisionResponse } from "./nex-vision-service";
import type { NexOcrResponse } from "./nex-ocr-service";

// ── Concept knowledge structure (matches Philip's banana example) ────────

export interface ConceptKnowledge {
  concept: string;                              // primary noun
  category: string | null;                      // e.g. fruit · staircase · signage
  food: boolean;                                // is it food?
  typical_visual_characteristics: string[];     // adjectives + descriptors
  related_concepts: string[];                   // expansion via known concept graph + text tokens
  evidence: string;                             // human-readable evidence summary
  source: string;                               // where the input came from
  source_type: "uploaded_file" | "image_url" | "ai_generated" | "unknown";
  rights_status: "declared_by_user" | "unknown" | "restricted";
  ai_generated: boolean;
  vision_provider: string;                      // adapter name that ran (or "stub")
  ocr_provider: string;                         // same
  perceptual_hash: string | null;
  confidence: number;                           // 0-100
  classification_band: "HIGH" | "MEDIUM" | "LOW" | "DUPLICATE" | "UNREADABLE" | "REVIEW";
  extracted_at: string;                         // ISO
}

// ── Concept ontology (rule-based · NEX-owned · expandable) ──────────────
//
// This is the seed of the concept graph. Every concept has a canonical
// category · food flag · optional related concepts. Additions here are
// deterministic edits · reviewable · no LLM.

const CONCEPT_ONTOLOGY: Record<string, {
  category: string;
  food: boolean;
  related: string[];
  characteristics_hints: string[];
}> = {
  // Food · fruits
  banana:      { category: "fruit", food: true, related: ["fruit","food","peel","bunch","plant"], characteristics_hints: ["elongated","curved","yellow","ripe"] },
  apple:       { category: "fruit", food: true, related: ["fruit","food","tree","seed"], characteristics_hints: ["round","red","green"] },
  mango:       { category: "fruit", food: true, related: ["fruit","food","tropical","seed"], characteristics_hints: ["oval","yellow","orange","ripe"] },
  // Food · dishes
  "nasi goreng": { category: "dish", food: true, related: ["food","indonesian","rice","fried"], characteristics_hints: ["fried","rice","brown"] },
  pizza:       { category: "dish", food: true, related: ["food","italian","cheese","dough"], characteristics_hints: ["round","flat","cheese"] },
  // Trades · staircase
  staircase:   { category: "construction-component", food: false, related: ["stairs","construction","architecture","tread","riser","balustrade","newel"], characteristics_hints: ["stepped","structural"] },
  handrail:    { category: "construction-component", food: false, related: ["staircase","safety","balustrade"], characteristics_hints: ["linear","gripped"] },
  // Buildings
  house:       { category: "building", food: false, related: ["building","home","residence","architecture"], characteristics_hints: ["structural","enclosed"] },
  // Tools
  hammer:      { category: "tool", food: false, related: ["tool","construction","striking"], characteristics_hints: ["metal","handled"] },
  // Symbols
  heart:       { category: "symbol", food: false, related: ["symbol","love","affection","organ"], characteristics_hints: ["red","curved","symmetric"] },
};

// Common English + ID stopwords · never counted as concept nouns
const STOPWORDS = new Set([
  "a","an","the","this","that","these","those","is","are","was","were","be","been","being",
  "in","on","at","to","from","of","for","with","by","and","or","but","not","no",
  "i","you","he","she","it","we","they","my","your","his","her","its","our","their",
  "ini","itu","yang","dan","atau","di","ke","dari","pada","untuk","dengan","tidak","juga","saja",
  "common","typical","usually","often","sometimes","ripe","fresh","new","old",
]);

// Detect a location mention · adds to related_concepts as a tag
const LOCATION_PATTERNS: Array<[RegExp, string]> = [
  [/southeast\s+asia/i, "southeast-asia"],
  [/asia/i, "asia"],
  [/europe/i, "europe"],
  [/indonesia/i, "indonesia"],
  [/yogyakarta/i, "yogyakarta"],
  [/jakarta/i, "jakarta"],
];

// PII patterns · MUST be stripped from concept outputs
const PII_PATTERNS = [
  /\+?\d[\d\s\-()]{6,}/g,           // phones
  /[\w.-]+@[\w.-]+\.\w+/gi,         // emails
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,  // card numbers
];

function stripPii(text: string): string {
  let cleaned = text;
  for (const p of PII_PATTERNS) cleaned = cleaned.replace(p, "[redacted]");
  return cleaned;
}

// Rp / IDR / USD / £ / $ · currency detection · flagged not extracted
function containsPriceLike(text: string): boolean {
  return /\b(rp\s*\d|\$\s*\d|£\s*\d|idr\s*\d|\d+[.,]\d{3}|\d+k(?:\s|$))/i.test(text);
}

// ── Extraction ────────────────────────────────────────────────────────────

export interface ExtractConceptOptions {
  description?: string;
  ocr?: NexOcrResponse | null;
  vision?: NexVisionResponse | null;
  imageUrlOrRef: string;
  sourceType: ConceptKnowledge["source_type"];
  rightsStatus: ConceptKnowledge["rights_status"];
  aiGenerated: boolean;
  visionProviderName: string;
  ocrProviderName: string;
  perceptualHash: string | null;
  filenameHint?: string;
}

export function extractConcept(opts: ExtractConceptOptions): ConceptKnowledge {
  const description = stripPii(opts.description ?? "");
  const ocrText = stripPii(opts.ocr?.text ?? "");
  const combinedText = `${description} ${ocrText} ${opts.filenameHint ?? ""}`.trim();

  // 1. Detect primary concept · match against ontology (multi-word first)
  const lc = combinedText.toLowerCase();
  let concept: string | null = null;
  const keys = Object.keys(CONCEPT_ONTOLOGY).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (lc.includes(k)) { concept = k; break; }
  }
  // If no ontology hit, take the last non-stopword noun-like token from description
  if (!concept && description) {
    const tokens = description.toLowerCase().split(/\s+/).filter(t => t.length >= 3 && !STOPWORDS.has(t.replace(/[^\w]/g,"")));
    if (tokens.length > 0) concept = tokens[tokens.length - 1]!.replace(/[^\w]/g, "");
  }
  if (!concept) concept = "unknown";

  // 2. Category + food flag from ontology (else best-effort)
  const ont = CONCEPT_ONTOLOGY[concept];
  const category = ont?.category ?? null;
  const food = ont?.food ?? false;

  // 3. Visual characteristics from description adjectives + ontology hints
  const characteristics = new Set<string>();
  if (ont) for (const h of ont.characteristics_hints) if (lc.includes(h)) characteristics.add(h);
  // Extract adjective-like tokens from description (simple heuristic: -ed / -ing / colour words)
  const adjPatterns = /\b(yellow|red|blue|green|orange|black|white|brown|elongated|curved|round|flat|large|small|tall|short|ripe|fresh|old|new|modern|traditional)\b/gi;
  const adjMatches = description.match(adjPatterns) ?? [];
  for (const a of adjMatches) characteristics.add(a.toLowerCase());
  // Compose "yellow when ripe" style descriptor if both terms found
  if (characteristics.has("yellow") && characteristics.has("ripe")) characteristics.add("yellow when ripe");

  // 4. Related concepts · ontology + location detection + vision observations
  const related = new Set<string>();
  if (ont) for (const r of ont.related) related.add(r);
  for (const [rx, tag] of LOCATION_PATTERNS) if (rx.test(combinedText)) related.add(tag);
  if (opts.vision) {
    for (const obs of opts.vision.observations) {
      if (obs.kind === "concept" || obs.kind === "object") related.add(obs.value.toLowerCase());
    }
  }

  // 5. Confidence · rule-based composition
  let confidence = 30;
  if (description) confidence += 20;
  if (ont) confidence += 20;                   // ontology hit
  if (opts.ocr?.text) confidence += 10;
  if (opts.vision && opts.vision.observations.length > 0) confidence += 15;
  if (characteristics.size >= 2) confidence += 5;
  confidence = Math.min(95, confidence);       // never claim 100 · always leave room

  // 6. Classification band
  let band: ConceptKnowledge["classification_band"];
  if (!description && !opts.ocr?.text && !opts.vision) band = "UNREADABLE";
  else if (concept === "unknown" && characteristics.size === 0) band = "LOW";
  else if (confidence >= 70 && characteristics.size >= 2) band = "HIGH";
  else if (confidence >= 50) band = "MEDIUM";
  else band = "LOW";

  // 7. Doctrine gate: if content contains price-like text, flag for REVIEW
  //    (Owner-Provenanced Pricing · never turn arbitrary image price into fact)
  if (containsPriceLike(combinedText)) band = "REVIEW";

  // 8. Evidence summary · human-readable · deterministic
  const evidenceParts: string[] = [];
  if (description) evidenceParts.push(`description supplied (${description.length} chars)`);
  if (opts.ocr?.text) evidenceParts.push(`OCR extracted ${opts.ocr.text.length} chars`);
  if (opts.vision) evidenceParts.push(`vision returned ${opts.vision.observations.length} observations`);
  if (opts.filenameHint) evidenceParts.push(`filename hint "${opts.filenameHint}"`);
  const evidence = evidenceParts.join(" · ") || "no evidence";

  return {
    concept,
    category,
    food,
    typical_visual_characteristics: [...characteristics],
    related_concepts: [...related],
    evidence,
    source: opts.imageUrlOrRef,
    source_type: opts.sourceType,
    rights_status: opts.rightsStatus,
    ai_generated: opts.aiGenerated,
    vision_provider: opts.visionProviderName,
    ocr_provider: opts.ocrProviderName,
    perceptual_hash: opts.perceptualHash,
    confidence,
    classification_band: band,
    extracted_at: new Date().toISOString(),
  };
}
