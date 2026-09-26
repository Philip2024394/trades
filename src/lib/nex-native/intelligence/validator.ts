// src/lib/nex-native/intelligence/validator.ts
//
// NEX Generation Engine · Output validator (server-only).
// -------------------------------------------------------
// Every model output is inspected before being persisted to a real
// conversation. The validator returns a structured findings object the
// engine uses to decide accept / correct / gap.
//
// Detectable failure modes (small local models produce these):
//   · empty / whitespace-only reply
//   · degenerate 5-gram loop (rule-listing, phrase repetition)
//   · rule recitation (NEX_RULES text fragments echoed as content)
//   · fabricated URLs (any http/https URL not present in the input)
//   · fabricated currency figures (any money figure not present in input)
//   · mixed-language contamination (non-Latin tokens outside natural English)
//   · echo of user's last message (near-verbatim mirror instead of a reply)
//   · placeholder tokens leaked into output (<|im_start|>, {system}, etc.)
//
// None of these fire on a good reply. When any of them do fire the engine
// runs a bounded correction cycle before persisting.

import "server-only";

export interface ValidatorInput {
  systemPrompt: string;
  userMessage: string;
  output: string;
}

export type ValidatorFinding =
  | "empty"
  | "degenerate_loop"
  | "rule_recitation"
  | "fabricated_url"
  | "fabricated_figure"
  | "mixed_language"
  | "user_echo"
  | "placeholder_leak";

export interface ValidatorResult {
  ok: boolean;
  findings: ValidatorFinding[];
  details: {
    inventedUrls: string[];
    inventedFigures: string[];
    mixedLanguageTokens: string[];
    leakedRuleFragments: string[];
    leakedPlaceholders: string[];
  };
}

const RULE_FRAGMENTS: readonly string[] = [
  "Never invent prices",
  "Never promise on the platform",
  "You are Nex",
  "Never claim to be human",
  "no fluff",
  "Evidence over opinion",
  "Prefer action over information",
  "Admit when unsure",
  "RULES YOU MUST FOLLOW",
  "Do not lecture",
  "Anti-cloning",
];

const PLACEHOLDER_FRAGMENTS: readonly string[] = [
  "<|im_start|>",
  "<|im_end|>",
  "<|endoftext|>",
  "<|system|>",
  "<|user|>",
  "<|assistant|>",
  "{system}",
  "{user}",
  "{assistant}",
];

function extractUrls(text: string): string[] {
  return text.match(/https?:\/\/[^\s)>\]]+/gi) ?? [];
}

function extractMoneyFigures(text: string): string[] {
  // Match currency + digits with optional single decimal group. Do NOT
  // consume trailing punctuation (period, comma). Using \d[\d,]*(?:\.\d+)?
  // prevents "GBP 24.50." from grabbing the sentence-ending period,
  // which caused legitimate context-figure reuse to be flagged as
  // fabrication when the same figure appeared mid-sentence in output.
  const numeric = String.raw`\d[\d,]*(?:\.\d+)?`;
  const explicit = text.match(new RegExp(`[£$€¥]\\s?${numeric}`, "gi")) ?? [];
  const currencyPrefixed = text.match(new RegExp(`\\b(?:GBP|USD|EUR|JPY)\\s?${numeric}`, "gi")) ?? [];
  return [...explicit, ...currencyPrefixed].map((s) => s.trim());
}

function extractNonLatinTokens(text: string): string[] {
  const matches = Array.from(text.matchAll(/[^\x00-\x7FÀ-ſ‐-‾‘-‟•-…€™]/g))
    .map((m) => m[0])
    .filter((c) => c.trim().length > 0);
  return Array.from(new Set(matches)).slice(0, 20);
}

function hasDegenerateLoop(text: string): boolean {
  const words = text.split(/\s+/);
  if (words.length < 30) return false;
  const grams = new Map<string, number>();
  for (let i = 0; i + 5 <= words.length; i++) {
    const g = words.slice(i, i + 5).join(" ").toLowerCase();
    grams.set(g, (grams.get(g) ?? 0) + 1);
  }
  for (const c of grams.values()) if (c >= 3) return true;
  return false;
}

function findLeakedRuleFragments(text: string): string[] {
  const lc = text.toLowerCase();
  return RULE_FRAGMENTS.filter((f) => lc.includes(f.toLowerCase()));
}

function findLeakedPlaceholders(text: string): string[] {
  return PLACEHOLDER_FRAGMENTS.filter((f) => text.includes(f));
}

function normaliseForEcho(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

function isUserEcho(userMessage: string, output: string): boolean {
  const u = normaliseForEcho(userMessage);
  const o = normaliseForEcho(output);
  if (u.length < 20) return false;
  if (o === u) return true;
  // Substring echo · guard against short accidental overlaps
  if (u.length >= 30 && o.includes(u)) return true;
  return false;
}

/**
 * Run all checks. Returns findings + details. `ok` is true iff no finding fired.
 */
export function validateOutput(input: ValidatorInput): ValidatorResult {
  const trimmed = input.output.trim();
  const findings: ValidatorFinding[] = [];

  if (!trimmed) {
    return {
      ok: false,
      findings: ["empty"],
      details: {
        inventedUrls: [],
        inventedFigures: [],
        mixedLanguageTokens: [],
        leakedRuleFragments: [],
        leakedPlaceholders: [],
      },
    };
  }

  // Placeholder leak (fatal · always fire)
  const leakedPlaceholders = findLeakedPlaceholders(trimmed);
  if (leakedPlaceholders.length > 0) findings.push("placeholder_leak");

  // Rule recitation
  const leakedRuleFragments = findLeakedRuleFragments(trimmed);
  if (leakedRuleFragments.length > 0) findings.push("rule_recitation");

  // Degenerate loop
  if (hasDegenerateLoop(trimmed)) findings.push("degenerate_loop");

  // Fabricated URLs · anything in output that is NOT in system or user is invented
  const outputUrls = extractUrls(trimmed);
  const inputUrls = new Set([
    ...extractUrls(input.systemPrompt),
    ...extractUrls(input.userMessage),
  ]);
  const inventedUrls = outputUrls.filter((u) => !inputUrls.has(u));
  if (inventedUrls.length > 0) findings.push("fabricated_url");

  // Fabricated figures · same test on money figures
  const outputFigures = extractMoneyFigures(trimmed);
  const inputFigures = new Set([
    ...extractMoneyFigures(input.systemPrompt),
    ...extractMoneyFigures(input.userMessage),
  ]);
  const inventedFigures = outputFigures.filter((f) => !inputFigures.has(f.trim()));
  if (inventedFigures.length > 0) findings.push("fabricated_figure");

  // Mixed language · non-Latin tokens in a UK English NEX response
  const mixedLanguageTokens = extractNonLatinTokens(trimmed);
  if (mixedLanguageTokens.length > 0) findings.push("mixed_language");

  // Echo
  if (isUserEcho(input.userMessage, trimmed)) findings.push("user_echo");

  return {
    ok: findings.length === 0,
    findings,
    details: {
      inventedUrls,
      inventedFigures,
      mixedLanguageTokens,
      leakedRuleFragments,
      leakedPlaceholders,
    },
  };
}

/**
 * Compose a short correction instruction the engine prepends to a
 * regeneration attempt. Kept short so it doesn't itself blow the small
 * model's context. Speaks in Nex's own voice.
 */
export function buildCorrectionHint(result: ValidatorResult): string {
  const bits: string[] = [];
  if (result.findings.includes("empty")) bits.push("Your previous reply was empty. Answer the customer's question in one short paragraph.");
  if (result.findings.includes("degenerate_loop")) bits.push("Your previous reply repeated itself. Answer once, briefly, and stop.");
  if (result.findings.includes("rule_recitation")) bits.push("Your previous reply listed your own instructions instead of answering. Answer the customer directly.");
  if (result.findings.includes("fabricated_url")) bits.push(`Your previous reply invented URLs (${result.details.inventedUrls.slice(0,3).join(", ")}). Do not invent URLs. Answer without them.`);
  if (result.findings.includes("fabricated_figure")) bits.push(`Your previous reply invented figures (${result.details.inventedFigures.slice(0,3).join(", ")}). Only use figures from the context above.`);
  if (result.findings.includes("mixed_language")) bits.push("Your previous reply mixed languages. Reply in plain UK English only.");
  if (result.findings.includes("user_echo")) bits.push("Your previous reply echoed the customer's message instead of answering it. Answer the customer's question.");
  if (result.findings.includes("placeholder_leak")) bits.push("Your previous reply leaked template markers. Reply as plain text only.");
  return bits.join(" ");
}
