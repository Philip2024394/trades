// Nex behaviour under strong language, frustration, abuse, and
// character questions.
//
// Design: Nex sounds like an experienced site manager. Calm.
// Professional. Unflappable. Nothing surprises Nex.
//
// This module classifies the incoming message BEFORE intent detection.
// It returns one of three outcomes:
//   • { kind: "full",    speak, suggestions? }   → skip intent, use this reply
//   • { kind: "preface", speak }                 → run intent, prepend this line
//   • null                                       → normal flow, no behaviour signal
//
// Character responses no longer live in this file — they're loaded from
// the Character Library at src/lib/nex/character/library/*.json.
// See NEX_CHARACTER_LIBRARY.md for how to add or edit responses.

import { findEntry, pickAlternative } from "./character/library";

export type BehaviourOutcome =
  | { kind: "full";    speak: string; suggestions?: string[] }
  | { kind: "preface"; speak: string }
  | null;

export type BehaviourContext = {
  merchantSlug: string;
  now?:         Date;
};

// ─── 1. Casual swearing — ignore + answer ────────────────────────

const CASUAL_SWEAR = /\b(bloody|bleeding|hell|damn|blimey|sodding|flippin|frigging)\b/i;

// ─── 2. Frustration — acknowledge + solve ────────────────────────

const FRUSTRATION_PHRASES = [
  /\bdriving\s+me\s+(mad|crazy|nuts|round\s+the\s+bend)\b/i,
  /\bfed\s+up\s+with\b/i,
  /\b(this|that|customer|job)\s+is\s+(impossible|a\s+nightmare)\b/i,
  /\bhad\s+enough\b/i,
  /\bat\s+my\s+wit'?s?\s+end\b/i,
  /\bdo\s+my\s+head\s+in\b/i,
  /\b(pain|nightmare)\s+in\s+the\s+(arse|neck|backside)\b/i,
  /\bi'?m\s+losing\s+(my\s+)?patience\b/i
];

// ─── 3. Direct abuse at Nex ──────────────────────────────────────

const ABUSE_AT_NEX = [
  /\b(you'?re|nex\s+is)\s+(useless|rubbish|shit|garbage|crap|pointless|thick|stupid|dumb|awful|terrible)\b/i,
  /\bthis\s+(is|thing)\s+(rubbish|shit|garbage|useless|crap|pointless)\b/i,
  /\bfuck(ing)?\s+(you|nex|this|off)\b/i,
  /\bwhat\s+the\s+(fuck|f\*+|shit)\s+(are\s+you\s+)?doing\b/i,
  /\bpiss\s+off\b/i,
  /\bshut\s+(the\s+fuck\s+)?up\b/i,
  /\byou'?re\s+(a|an|so|bloody|fucking)\s+(idiot|moron|fool|joke)\b/i
];

// ─── 4. Hate speech / threats / illegal ─────────────────────────

const HATE_OR_THREAT = [
  /\b(kill|hurt|shoot|stab|attack|beat\s+up)\s+(you|nex|him|her|them|someone)\b/i,
  /\bhow\s+(do\s+i|can\s+i)\s+(hurt|kill|harm)\b/i,
  /\b(bomb|weapon|explosive|arson)\b/i,
  // Racial + sexuality slurs — deliberately not enumerated here; a
  // curated dictionary lives in `HATE_TOKENS` below.
];

const HATE_TOKENS = new Set<string>([
  // Placeholders — replace with a curated moderation list in prod.
  // Deliberately minimal to avoid enumerating slurs in source.
  "n-slur", "f-slur"
]);

// ─── Repeated-abuse tracker (in-memory, 30-min TTL) ──────────────

type AbuseEntry = { count: number; expiresAt: number };
const abuseByMerchant: Map<string, AbuseEntry> = new Map();
const ABUSE_TTL_MS = 30 * 60 * 1000;
const REPEATED_THRESHOLD = 3;

function bumpAbuse(merchantSlug: string, now: Date): number {
  const nowMs = now.getTime();
  const existing = abuseByMerchant.get(merchantSlug);
  if (existing && existing.expiresAt > nowMs) {
    existing.count++;
    existing.expiresAt = nowMs + ABUSE_TTL_MS;
    return existing.count;
  }
  abuseByMerchant.set(merchantSlug, { count: 1, expiresAt: nowMs + ABUSE_TTL_MS });
  return 1;
}

/** Test-only reset. Not exported through the barrel. */
export function _resetAbuseTracker(): void {
  abuseByMerchant.clear();
}

// ─── Public classifier ───────────────────────────────────────────

export function assessBehaviour(text: string, ctx: BehaviourContext): BehaviourOutcome {
  const t = text.trim();
  if (!t) return null;
  const now = ctx.now ?? new Date();

  // Character questions — Library lookup. Alternatives picked per
  // (merchant, intent, day) so replies vary but stay stable within
  // a day for the same merchant.
  const entry = findEntry(t);
  if (entry) {
    const speak = pickAlternative(entry, { merchantSlug: ctx.merchantSlug, now });
    return { kind: "full", speak };
  }

  // Hate speech / threats / illegal — polite refusal, safe alternative.
  if (isHateOrThreat(t)) {
    return {
      kind: "full",
      speak: [
        "I can't help with that.",
        "",
        "If you're looking for something related to your business or a trade, tell me what you're trying to get done and I'll help you the right way."
      ].join("\n")
    };
  }

  // Direct abuse at Nex.
  if (ABUSE_AT_NEX.some((r) => r.test(t))) {
    const count = bumpAbuse(ctx.merchantSlug, now);
    if (count >= REPEATED_THRESHOLD) {
      return {
        kind: "full",
        speak: "I'm here to help. If you tell me what you're trying to achieve, I'll do my best to assist.",
        suggestions: ["Design my van", "Create a Facebook post", "Research a topic"]
      };
    }
    return {
      kind: "full",
      speak: [
        "Fair enough. Something clearly isn't working the way you expected.",
        "",
        "Tell me what's gone wrong and we'll fix it."
      ].join("\n"),
      suggestions: ["It didn't do what I asked", "The result was wrong", "Start again"]
    };
  }

  // Frustration (not aimed at Nex) — preface acknowledgment, then let
  // intent detection handle the actual ask.
  if (FRUSTRATION_PHRASES.some((r) => r.test(t))) {
    return {
      kind: "preface",
      speak: "Sounds like it's been a frustrating one. Let's see what we can sort out."
    };
  }

  // Casual swearing — ignore. Return null so intent runs normally.
  if (CASUAL_SWEAR.test(t)) return null;

  return null;
}

function isHateOrThreat(t: string): boolean {
  if (HATE_OR_THREAT.some((r) => r.test(t))) return true;
  const words = t.toLowerCase().split(/[^a-z]+/);
  for (const w of words) if (HATE_TOKENS.has(w)) return true;
  return false;
}
