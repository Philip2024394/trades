// prompt.extract-intent — LLM task #2 of the 14-step AI Composition
// Engine v2.
//
// Reads a merchant's plain-English description + the trade detected by
// business.discover (step 1) and extracts structured intent signals:
//   audience, tone, style, urgency, goals[], wants (feature flags),
//   keywords[]
//
// Downstream:
//   - journeyRegistry.selectFor(intent, trade)   ← step 3
//   - layoutRegistry.rank({trade, goals, wants}) ← step 4
//   - themeRegistry / designTokenRegistry        ← steps 10-11
//   - asset scorer                                ← step 12
//
// Retrieval-first: goals + urgency + wants values are constrained to
// finite enums so downstream scorers never see hallucinated tokens.

import { completeWithUsage, type CompleteResult } from "@/lib/llm/anthropic";
import { UNIVERSAL_DESIGN_RULES } from "./designConstitution";

export const INTENT_AUDIENCES = [
  "homeowner",
  "landlord",
  "commercial",
  "trade",
  "public"
] as const;
export type IntentAudience = (typeof INTENT_AUDIENCES)[number];

export const INTENT_TONES = [
  "trades-native",
  "professional",
  "premium",
  "friendly",
  "urgent"
] as const;
export type IntentTone = (typeof INTENT_TONES)[number];

export const INTENT_STYLES = [
  "minimal",
  "bold",
  "photo-heavy",
  "classic",
  "modern",
  "industrial"
] as const;
export type IntentStyle = (typeof INTENT_STYLES)[number];

export const INTENT_URGENCIES = ["emergency", "planned", "browse"] as const;
export type IntentUrgency = (typeof INTENT_URGENCIES)[number];

/** Business goals — mirrors JourneyGoal + LayoutRegistry BusinessGoal
 *  so the same slug flows through the pipeline unchanged. */
export const INTENT_GOALS = [
  "lead-generation",
  "bookings",
  "quotes",
  "portfolio-showcase",
  "ecommerce",
  "brand-awareness",
  "directory-listing",
  "operations-dashboard",
  "content-publishing",
  "trust-building",
  "search-anchored"
] as const;
export type IntentGoal = (typeof INTENT_GOALS)[number];

export type IntentWants = {
  booking: boolean;
  ecommerce: boolean;
  portfolio: boolean;
  search: boolean;
  map: boolean;
  floatingCta: boolean;
};

export type ExtractedIntent = {
  audience: IntentAudience;
  tone: IntentTone;
  style: IntentStyle;
  urgency: IntentUrgency;
  goals: IntentGoal[];
  wants: IntentWants;
  keywords: string[];
  confidence: number;
};

export type ExtractIntentInput = {
  /** The merchant's plain-English business description. */
  description: string;
  /** Trade slug from business.discover (step 1). May be null when
   *  discovery couldn't detect — extractor still runs so downstream
   *  gets a best-effort intent. */
  tradeSlug: string | null;
  /** Optional hint: the merchant's city / postcode, if known. */
  city?: string;
};

export type ExtractIntentResult = {
  intent: ExtractedIntent | null;
  usage: CompleteResult["usage"] | null;
};

const SYSTEM_PROMPT = `You are an intent extraction engine for a UK-trades platform's AI Composition pipeline.

Given a merchant's plain-English description + the detected trade, extract structured signals a deterministic composer downstream will consume.

STRICT OUTPUT RULES (NON-NEGOTIABLE):
- Return ONLY a JSON object matching the schema below. No prose. No markdown fences.
- Every enum field MUST use a value from the provided list. Never invent values.
- goals: 1-4 entries. Only from the provided list. Order best-first.
- keywords: 3-8 short lowercase words / phrases the merchant would use themselves.
- confidence: 0.0-1.0 — how sure the extraction reflects the description.

WHEN THE DESCRIPTION IS SPARSE:
- Default audience to "homeowner", tone to "trades-native", style to "modern", urgency to "planned".
- Set confidence < 0.5 so the composer can fall back to trade-typical defaults.

INTERPRETING SIGNALS:
- "emergency", "24/7", "callout", "urgent", "same-day" → urgency: "emergency"
- "portfolio", "gallery", "case study" → wants.portfolio: true
- "book", "appointment", "slot" → wants.booking: true, goals: ["bookings"]
- "shop", "buy", "products", "delivery" → wants.ecommerce: true, goals: ["ecommerce"]
- "map", "service area", "coverage" → wants.map: true
- "call now", "phone" → wants.floatingCta: true
- Commercial-only language ("B2B", "trade accounts") → audience: "trade"

SCHEMA:
{
  "audience": "homeowner" | "landlord" | "commercial" | "trade" | "public",
  "tone": "trades-native" | "professional" | "premium" | "friendly" | "urgent",
  "style": "minimal" | "bold" | "photo-heavy" | "classic" | "modern" | "industrial",
  "urgency": "emergency" | "planned" | "browse",
  "goals": ["<from goals enum>", ...],
  "wants": { "booking": bool, "ecommerce": bool, "portfolio": bool, "search": bool, "map": bool, "floatingCta": bool },
  "keywords": ["short", "phrases"],
  "confidence": 0.0-1.0
}

Return the raw JSON object.

---

${UNIVERSAL_DESIGN_RULES}`;

/** Clamp + validate an LLM response into an ExtractedIntent. Returns
 *  null when the response is unparseable. Missing fields fall back to
 *  sensible defaults so the pipeline is never blocked by a stray field. */
function coerceIntent(raw: unknown): ExtractedIntent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const audience = INTENT_AUDIENCES.includes(r.audience as IntentAudience)
    ? (r.audience as IntentAudience)
    : "homeowner";
  const tone = INTENT_TONES.includes(r.tone as IntentTone)
    ? (r.tone as IntentTone)
    : "trades-native";
  const style = INTENT_STYLES.includes(r.style as IntentStyle)
    ? (r.style as IntentStyle)
    : "modern";
  const urgency = INTENT_URGENCIES.includes(r.urgency as IntentUrgency)
    ? (r.urgency as IntentUrgency)
    : "planned";

  const goalsArr = Array.isArray(r.goals) ? r.goals : [];
  const goals = goalsArr
    .filter((g): g is string => typeof g === "string")
    .filter((g): g is IntentGoal =>
      (INTENT_GOALS as readonly string[]).includes(g)
    )
    .slice(0, 4);

  const wantsRaw =
    r.wants && typeof r.wants === "object"
      ? (r.wants as Record<string, unknown>)
      : {};
  const wants: IntentWants = {
    booking: wantsRaw.booking === true,
    ecommerce: wantsRaw.ecommerce === true,
    portfolio: wantsRaw.portfolio === true,
    search: wantsRaw.search === true,
    map: wantsRaw.map === true,
    floatingCta: wantsRaw.floatingCta === true
  };

  const keywordsArr = Array.isArray(r.keywords) ? r.keywords : [];
  const keywords = keywordsArr
    .filter((k): k is string => typeof k === "string")
    .map((k) => k.toLowerCase().trim())
    .filter((k) => k.length > 0 && k.length <= 40)
    .slice(0, 8);

  const confidence =
    typeof r.confidence === "number"
      ? Math.max(0, Math.min(1, r.confidence))
      : 0.5;

  return { audience, tone, style, urgency, goals, wants, keywords, confidence };
}

/** Run the prompt.extract-intent LLM task. Returns null intent when
 *  the API key is missing or the response is unparseable — callers
 *  fall back to trade-typical defaults. */
export async function extractIntent(
  input: ExtractIntentInput
): Promise<ExtractIntentResult> {
  const userMessage = `MERCHANT DESCRIPTION:
"${input.description}"

DETECTED TRADE: ${input.tradeSlug ?? "(unknown)"}
${input.city ? `CITY: ${input.city}` : ""}

Extract the intent signals as a JSON object.`;

  const result = await completeWithUsage({
    system: "Return ONLY valid JSON. No markdown fences. No prose.",
    cachedSystem: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 500,
    temperature: 0.2
  });

  if (!result?.text) {
    return { intent: null, usage: null };
  }

  let parsed: unknown = null;
  try {
    const cleaned = result.text
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = null;
  }

  return { intent: coerceIntent(parsed), usage: result.usage };
}
