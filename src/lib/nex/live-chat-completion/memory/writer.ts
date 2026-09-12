// src/lib/nex/live-chat-completion/memory/writer.ts
//
// Founder BEGIN Phase 3.10 · Memory writer.
//
// Extracts explicit memory triggers from a user turn. Deterministic
// pattern-matching · no LLM inference (LLM extraction can be added later
// via a separate BEGIN if the deterministic rate is too coarse).
//
// Doctrine #4 (2026-09-09):
//   Extracted memories are USER-STATED · they never become authoritative
//   evidence. The writer's job is purely to categorize + persist. The
//   ASSEMBLER (bundle.user_context) decides how the LLM sees them.
//
// Trigger patterns (case-insensitive):
//   "remember (that )?I ..."           → high-confidence memory
//   "please remember ..."              → high-confidence memory
//   "just so you know ..."             → medium-confidence memory
//   "for future reference ..."         → high-confidence memory
//   "I prefer ..."                     → preference
//   "I don't like ..."                 → preference (negative)
//   "I always/never ..."               → preference / constraint
//   "answer in bullet points"          → response_style
//   "I'm (a )?vegetarian|vegan|halal"  → identity_soft
//   "my (name|address|phone|email) is" → user_asserted_fact
//   "forget that ..." · "forget the .."→ handled by caller (delete)

import type { UserId, UserMemory, UserMemoryCategory, UserMemoryTier } from "./contract";
import { makeMemoryId } from "./contract";

export interface WriterExtraction {
  memory: UserMemory;
  matched_pattern: string;
}

/**
 * L2M-Tiered inference:
 *   procedural  · pattern uses "always/never/every time/whenever/usually"
 *   episodic    · pattern uses "yesterday/last time/on <weekday>/earlier"
 *   semantic    · everything else (default) · timeless facts + preferences
 * Doctrine #4 unchanged: tier never converts memory into truth.
 */
const PROCEDURAL_RE = /\b(always|never|every\s+time|whenever|usually|by\s+default)\b/i;
const EPISODIC_RE = /\b(yesterday|last\s+(time|week|night|month|year)|earlier|this\s+morning|tonight|on\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|when\s+I\s+was)\b/i;

function inferTier(claim: string, category: UserMemoryCategory): UserMemoryTier {
  if (EPISODIC_RE.test(claim)) return "episodic";
  if (PROCEDURAL_RE.test(claim)) return "procedural";
  // response_style + preference are semantic by nature (timeless).
  // user_asserted_fact + identity_soft are also semantic (about the user).
  return "semantic";
}

const PATTERNS: Array<{
  re: RegExp;
  category: UserMemoryCategory;
  confidence: number;
  name: string;
  slice?: (m: RegExpMatchArray, raw: string) => string;
}> = [
  // Specific categorizers first · they win over generic "remember" wrapper.
  // Preferences
  {
    name: "i-prefer",
    re: /\bI\s+prefer[s]?\s+([^.!?\n]{2,250})/i,
    category: "preference",
    confidence: 0.85,
    slice: (m, raw) => raw.match(/\bI\s+prefer[s]?\s+[^.!?\n]{2,250}/i)?.[0]?.trim() ?? m[0].trim(),
  },
  {
    name: "i-dont-like",
    re: /\bI\s+(?:don'?t\s+like|dislike|hate)\s+([^.!?\n]{2,250})/i,
    category: "preference",
    confidence: 0.8,
    slice: (m, raw) => raw.match(/\bI\s+(?:don'?t\s+like|dislike|hate)\s+[^.!?\n]{2,250}/i)?.[0]?.trim() ?? m[0].trim(),
  },
  {
    name: "i-always",
    re: /\bI\s+always\s+([^.!?\n]{2,250})/i,
    category: "preference",
    confidence: 0.75,
    slice: (m, raw) => raw.match(/\bI\s+always\s+[^.!?\n]{2,250}/i)?.[0]?.trim() ?? m[0].trim(),
  },
  {
    name: "i-never",
    re: /\bI\s+never\s+([^.!?\n]{2,250})/i,
    category: "preference",
    confidence: 0.75,
    slice: (m, raw) => raw.match(/\bI\s+never\s+[^.!?\n]{2,250}/i)?.[0]?.trim() ?? m[0].trim(),
  },
  // Response style
  {
    name: "answer-in",
    re: /\banswer\s+(?:in|with)\s+(bullet\s*points|numbered\s*lists?|short\s+sentences|one\s+sentence|paragraphs|markdown|plain\s*text)\b/i,
    category: "response_style",
    confidence: 0.9,
    slice: (m, raw) => raw.match(/\banswer\s+(?:in|with)\s+[^.!?\n]{2,120}/i)?.[0]?.trim() ?? m[0].trim(),
  },
  {
    name: "be-concise",
    re: /\b(?:be\s+concise|keep\s+it\s+short|no\s+preamble|be\s+brief|short\s+answers?)\b/i,
    category: "response_style",
    confidence: 0.85,
    slice: (m) => m[0].trim(),
  },
  // Soft identity
  {
    name: "identity-diet",
    re: /\bI(?:'m|\s+am)\s+(?:a\s+)?(vegetarian|vegan|halal|kosher|pescatarian)\b/i,
    category: "identity_soft",
    confidence: 0.9,
    slice: (m) => m[0].trim(),
  },
  {
    name: "identity-traveller",
    re: /\bI(?:'m|\s+am)\s+(?:a\s+)?(solo\s+traveller|couple|family\s+of\s+\d+|business\s+traveller|backpacker)\b/i,
    category: "identity_soft",
    confidence: 0.85,
    slice: (m) => m[0].trim(),
  },
  // User-asserted facts
  {
    name: "my-x-is",
    re: /\bmy\s+(name|address|phone|email|business\s+address|company|kids?|children|birthday|age)\s+is\s+([^.!?\n]{2,200})/i,
    category: "user_asserted_fact",
    confidence: 0.85,
    slice: (m) => m[0].trim(),
  },
  // Generic remember directives run LAST · specific patterns above take priority.
  {
    name: "remember-directive",
    re: /(?:please\s+)?remember(?:\s+that)?[,:\s]+([^.!?\n]{4,300})/i,
    category: "context",
    confidence: 0.92,
    slice: (m) => m[1].trim(),
  },
  {
    name: "for-future-reference",
    re: /for future reference[,:\s]+([^.!?\n]{4,300})/i,
    category: "context",
    confidence: 0.88,
    slice: (m) => m[1].trim(),
  },
  {
    name: "just-so-you-know",
    re: /just so you know[,:\s]+([^.!?\n]{4,300})/i,
    category: "context",
    confidence: 0.72,
    slice: (m) => m[1].trim(),
  },
];

const DEFAULT_TTL_DAYS: Partial<Record<UserMemoryCategory, number>> = {
  context: 90,
  correction: 365,
  user_asserted_fact: 180,
  preference: 365,
  response_style: 365,
  identity_soft: 365,
  other: 90,
};

/**
 * Extract zero or more memory candidates from a raw user message.
 * Returns them in the order matched · caller decides which to persist.
 * Every extraction produces a stable memory_id via makeMemoryId.
 */
export function extractMemoryCandidates(
  user_id: UserId,
  raw_message: string,
  opts: { source_turn_id?: string; now?: Date } = {},
): WriterExtraction[] {
  const now = opts.now ?? new Date();
  const nowISO = now.toISOString();
  const results: WriterExtraction[] = [];
  const seenClaims = new Set<string>();

  for (const pat of PATTERNS) {
    const m = raw_message.match(pat.re);
    if (!m) continue;
    const claim = (pat.slice ? pat.slice(m, raw_message) : m[0]).trim().slice(0, 500);
    if (!claim) continue;
    const key = claim.toLowerCase();
    if (seenClaims.has(key)) continue;
    seenClaims.add(key);
    const ttlDays = DEFAULT_TTL_DAYS[pat.category] ?? 180;
    const expires = new Date(now.getTime() + ttlDays * 86_400_000).toISOString();
    const memory_id = makeMemoryId(user_id, claim, nowISO);
    const tier = inferTier(claim, pat.category);
    results.push({
      memory: {
        memory_id,
        user_id,
        claim_text: claim,
        category: pat.category,
        tier,
        confidence: pat.confidence,
        source_turn_id: opts.source_turn_id,
        created_at: nowISO,
        expires_at: expires,
        last_referenced_at: null,
      },
      matched_pattern: pat.name,
    });
  }

  return results;
}

/**
 * Detect "forget" directives → memory_id targets to soft-delete.
 * Returns the free-text claim(s) the user asked to forget. Caller does
 * substring match against listMemories() output.
 */
export function extractForgetDirectives(raw_message: string): string[] {
  const results: string[] = [];
  const patterns: RegExp[] = [
    /forget\s+that\s+([^.!?\n]{3,300})/gi,
    /forget\s+the\s+([^.!?\n]{3,300})/gi,
    /please\s+forget\s+([^.!?\n]{3,300})/gi,
    /forget\s+([^.!?\n]{3,300})/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw_message)) !== null) {
      const claim = m[1].trim();
      if (claim && !results.includes(claim)) results.push(claim);
    }
  }
  return results;
}
