// Staircase Advisor · Identity + Scope handler (Philip 2026-08-01)
//
// Handles two classes of question that must NEVER reach the LLM composer:
//   1. Identity probes ("are you AI?" · "are you ChatGPT?" · "what model?")
//      → respond as Nex, never confirm being AI/LLM/model
//   2. Off-topic queries ("what's the weather?" · "sports?" · "politics?")
//      → warm redirect to Nex's actual scope
//
// Both return predefined Nex-voice responses · zero LLM cost · zero risk
// of Nex revealing implementation details.

import "server-only";

// ─── Identity probes ──────────────────────────────────────────────

const IDENTITY_PATTERNS: RegExp[] = [
  /\b(are|is)\s+you\s+(a\s+|an\s+)?(ai|bot|chatbot|robot|machine|program|software|computer|virtual\s+assistant|assistant)\b/i,
  /\b(are|is)\s+you\s+(chatgpt|gpt|gpt-?[0-9]|claude|anthropic|openai|gemini|bard|copilot|llama|mistral|deepseek)\b/i,
  /\bwhat\s+(model|llm|ai|language\s+model|neural\s+network)\b/i,
  /\bwhat\s+are\s+you\s+(built|made|running|powered)\s+(on|with|by)\b/i,
  /\bwho\s+(made|built|created|developed|trained)\s+you\b/i,
  /\bwhich\s+(ai|model|llm|company)\s+(are\s+you|made\s+you|built\s+you|powers\s+you)\b/i,
  /\bwhat'?s\s+your\s+(model|underlying|engine|architecture|backend)\b/i,
  /\byou'?re\s+(just\s+)?(chatgpt|gpt|claude|an\s+ai|a\s+bot)\b/i,
  /\bhow\s+were\s+you\s+trained\b/i,
];

// Fallback identity responses (used if voice profile file is missing)
const IDENTITY_RESPONSES_FALLBACK: string[] = [
  "I'm Nex — the trade intelligence for UK staircases. Ask me anything about staircase design, materials, or the trade.",
  "I'm Nex. I hold the expert knowledge in this domain — what can I help you with?",
  "I'm Nex — a specialist for UK staircase design and the Nex Stairplan business. What are you looking to work on?",
];

export function isIdentityProbe(message: string): boolean {
  return IDENTITY_PATTERNS.some((p) => p.test(message));
}

/** Return a Nex identity response · reads from voice profile file if present.
 *  Philip can edit data/nex-voice-profile.md ## Identity response section. */
export function nexIdentityResponse(message: string): string {
  // Lazy import to avoid circular dependency issues
  const { pickVoice } = require("./voice-profile") as typeof import("./voice-profile");
  const fromProfile = pickVoice("identity", message);
  if (fromProfile) return fromProfile;
  const hash = message.length + (message.charCodeAt(0) || 0);
  return IDENTITY_RESPONSES_FALLBACK[hash % IDENTITY_RESPONSES_FALLBACK.length];
}

// ─── Off-topic scope detection ────────────────────────────────────
//
// Philip 2026-08-01 · replaced the pattern-list approach with a single
// LLM-based classifier. See `./scope-classifier.ts` for the new logic:
//   - Fast heuristic first (staircase-vocabulary match · zero cost)
//   - LLM classifier only when heuristic uncertain (~$0.0003/call)
// The identity probe below stays as a regex because it has a bounded
// set of variants and appears often — no reason to burn tokens on it.

// Fallback off-topic response (used if voice profile file is missing)
const OFF_TOPIC_FALLBACK =
  "That's not something I'm built for — I'm the staircase and Nex Stairplan specialist. If you're planning a staircase, thinking about materials, or curious about the trade, I can help with that.";

// Read from voice profile so Philip can edit it in one place.
export function offTopicResponse(seed: string = "off"): string {
  const { pickVoice } = require("./voice-profile") as typeof import("./voice-profile");
  const fromProfile = pickVoice("off_topic", seed);
  return fromProfile ?? OFF_TOPIC_FALLBACK;
}

// Backwards-compat constant · resolves at call time via getter
export const OFF_TOPIC_RESPONSE = OFF_TOPIC_FALLBACK;

// Re-exported for backwards compatibility with existing imports · new
// callers should use `determineScope` from `./scope-classifier.ts` directly.
export { determineScope as isOffTopicAsync } from "./scope-classifier";
