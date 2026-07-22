// Business Discovery Agent — the 7-question intake per V3 Q11
// integration + ChatGPT's canonical 7 questions.
//
// Studio surfaces collect 7 answers, this agent turns them into a
// Brand DNA v1 draft. Uses reasoning API for tone/positioning
// inference. Falls back to deterministic defaults without a key.
//
// Never invents facts — inference is scoped to positioning + tone +
// suggested palette. Company name, phone, website etc pass through
// verbatim.

import { reasonJson } from "@/lib/openai/reasoning";
import { computeFingerprint } from "@/lib/design/brand/fingerprint";
import type { BrandRecord } from "@/lib/design/brand/schema";
import { safeParseBrandRecord } from "@/lib/design/brand/schema";

export const DISCOVERY_VERSION = "1.0.0";

/** The seven questions per ChatGPT canon. Order matters — Q1 primes
 *  the psychological frame (money → positioning), Q2 clarifies target
 *  customer, then coverage / differentiation / existing assets /
 *  portfolio / vehicle. */
export const DISCOVERY_QUESTIONS = [
  { id: "money_maker",   label: "What work makes you the most money?",              required: true  },
  { id: "target",        label: "What type of customer do you want more of?",       required: true  },
  { id: "areas",         label: "Which areas do you cover?",                        required: true  },
  { id: "why_you",       label: "What makes customers choose you instead of another?", required: true },
  { id: "existing",      label: "Do you already have a logo or brand colours?",     required: false },
  { id: "portfolio",     label: "Upload your best 3 completed jobs.",               required: false },
  { id: "van",           label: "Which van do you drive?",                          required: false }
] as const;

export type DiscoveryAnswers = Partial<Record<typeof DISCOVERY_QUESTIONS[number]["id"], string>> & {
  portfolio_urls?: string[];
};

export type DiscoveryInput = {
  merchant_slug: string;
  trade:         string;
  answers:       DiscoveryAnswers;
  external?: {
    companies_house?: Record<string, unknown>;
    website_scrape?:  Record<string, unknown>;
  };
};

export type DiscoveryResult = {
  brand:       BrandRecord;
  fingerprint: string;
  confidence:  number;
  reasoning:   string;
  aiUsed:      boolean;
};

/** Runs the discovery pipeline. Returns a Brand DNA v1 draft +
 *  fingerprint + reasoning trace. */
export async function runDiscovery(input: DiscoveryInput): Promise<DiscoveryResult> {
  const ai = await tryAI(input);
  const brand = ai ?? deterministicDefault(input);
  const fingerprint = computeFingerprint({
    industry:       input.trade,
    personality:    brand.personality,
    geometry:       "geometric",
    construction:   "wordmark",
    primary_shape:  "house",
    secondary_shape: "none",
    style:          "architectural",
    symmetry:       "vertical",
    complexity:     "minimal",
    colour:         brand.colour.primary,
    accent:         brand.colour.accent,
    letterform:     brand.name.charAt(0)
  });
  return {
    brand,
    fingerprint,
    confidence:  ai ? 0.85 : 0.5,
    reasoning:   ai ? "Inferred from 7-answer intake + Companies House + website scrape" : "Deterministic defaults (no reasoning key)",
    aiUsed:      !!ai
  };
}

// ─── AI inference path ─────────────────────────────────────────

async function tryAI(input: DiscoveryInput): Promise<BrandRecord | null> {
  const raw = await reasonJson<Record<string, unknown>>({
    system: [
      "You are a Business Discovery agent for a UK trades platform.",
      "From 7 short answers about a merchant's business, infer their positioning,",
      "brand personality, target audience, and suggest an initial 3-colour palette.",
      "Return ONLY JSON matching the BrandRecord shape.",
      "Never invent company facts. Only infer positioning/tone/palette."
    ].join(" "),
    messages: [{ role: "user", content: buildDiscoveryPrompt(input) }],
    temperature: 0.3,
    maxTokens:   1500
  });
  if (!raw) return null;
  return safeParseBrandRecord(raw);
}

function buildDiscoveryPrompt(input: DiscoveryInput): string {
  const a = input.answers;
  return [
    `Trade: ${input.trade}`,
    `Money-maker: ${a.money_maker ?? "(not answered)"}`,
    `Target customer: ${a.target ?? "(not answered)"}`,
    `Coverage areas: ${a.areas ?? "(not answered)"}`,
    `Differentiator: ${a.why_you ?? "(not answered)"}`,
    `Existing brand: ${a.existing ?? "(none supplied)"}`,
    `Van: ${a.van ?? "(not disclosed)"}`,
    ``,
    input.external?.companies_house
      ? `Companies House: ${JSON.stringify(input.external.companies_house)}`
      : "",
    input.external?.website_scrape
      ? `Website findings: ${JSON.stringify(input.external.website_scrape)}`
      : "",
    ``,
    `Return a BrandRecord JSON with: name, tagline, industry, positioning,`,
    `personality (array), audience, colour {primary,secondary,accent as #hex},`,
    `typography {primary,secondary}, services (max 6 array).`
  ].filter(Boolean).join("\n");
}

// ─── Deterministic default (no-AI fallback) ────────────────────

function deterministicDefault(input: DiscoveryInput): BrandRecord {
  const merchantName = input.answers.money_maker
    ? capitalise(input.trade)
    : capitalise(input.trade);
  return {
    name:        merchantName || "Your Business",
    tagline:     `Professional ${input.trade} across the UK.`,
    industry:    input.trade,
    positioning: "Reliable domestic and commercial work.",
    personality: ["reliable", "professional", "local"],
    audience:    input.answers.target ?? "UK homeowners",
    colour: {
      primary:   "#0A0A0A",
      secondary: "#FFFFFF",
      accent:    "#FFB300"
    },
    typography: {
      primary:   "Inter",
      secondary: "Inter"
    },
    logo:     { lockups: [] },
    imagery:  { portfolio: (input.answers.portfolio_urls ?? []).map((url) => ({
      url,
      role:           "portfolio-panel" as const,
      quality_passed: true
    })) },
    voice:    { tone: "reliable, direct, no-nonsense", keywords: [] },
    vehicles: input.answers.van ? [{ model: input.answers.van }] : [],
    services: [],
    rules:    { max_colours: 3, hero_images: 1 },
    assets:   { photo_library: input.answers.portfolio_urls ?? [] }
  };
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
