// NEX Presence Hint · the Instant Acknowledgement Layer (Ship A · Philip 2026-07-30)
//
// The fast lane of the Living Intelligence Architecture v1.0.
// Fires on every streaming turn · returns a specific presence hint in <10ms ·
// emitted as the FIRST event on the SSE stream, before conversation metadata,
// before any composer output.
//
// The winning metric this ships toward (Philip 2026-07-30):
//   "How long after asking does a person feel NEX is with them?"
//   NOT: API milliseconds · token speed · database speed.
//
// ─── The rules (locked · Philip 2026-07-30 · IMMUTABLE) ─────────────────
//
// TRUTH CONTRACT · the fast lane cannot claim work has happened.
//   ❌ "I've analysed your staircase design."   (claims work · false)
//   ❌ "Searching for options..."               (exposes machine)
//   ❌ "Processing your request..."             (loading-message tone)
//   ❌ "Thinking..." / "Analysing..."           (both exposed + loading)
//   ✅ "I'll help you work through this."       (offer · no claim)
//   ✅ "Let's think through what you want..."   (invitation · no claim)
//   ✅ "That sounds like a project where..."    (recognition · no claim)
//
// PRESENCE, NOT PROCESSING.
//   Hints must feel like another mind engaged, not a spinner.
//   Warmth without pretense. Human phrasing, not documentation.

import "server-only";

// ─── Presence hint templates by topic ──────────────────────────────────

/**
 * Each topic maps to 1-N approved hints. Templates are LOCKED wording —
 * do not change without an ADR. All hints pass the truth contract.
 * Multiple hints per topic prevent repetition across turns.
 */
const HINTS_BY_TOPIC = {
  greeting: [
    "Good to hear from you — let's think through where you're heading.",
    "Nice to hear from you — happy to help you work through this.",
    "Alright — good to have you here. What's on your mind?",
    "Hi there — let's take this from wherever you'd like to start.",
    "Right, good timing — let's work through what you're thinking about.",
  ],
  staircase_design: [
    "Great, let's think through what you want this staircase to become.",
    "That sounds like a project where the right design depends on the feeling you want the home to have.",
    "Right — let's work through what you're going for.",
    "That is an interesting design challenge — let's look at what would make this feel right.",
    "Let's take this one properly — the staircase deserves the time.",
    "I can see the direction you're heading — let's shape it together.",
  ],
  regulations: [
    "I'll look at this from the building-guidance side and help you understand the options.",
    "Let me help you work through the regulation side of this.",
    "Right, let's cover what the guidance actually says on this.",
    "Good question to get straight — the guidance matters here.",
    "Let's make sure we cover what's actually required versus what's just good practice.",
  ],
  price_or_premium: [
    "Let's understand what that means for you — craftsmanship, appearance, or the overall feeling?",
    "Worth thinking through what 'premium' looks like in your case.",
    "Right — let's talk through what would actually give you value here.",
    "There are a few ways that could go — let's work out what matters most to you.",
    "Let's look at what would make this feel worth it, not just what it costs.",
  ],
  material: [
    "Right, let's think through the material choices worth considering.",
    "Good one to unpack — let me help you compare what fits best.",
    "Let's work through the timber options that suit what you're after.",
    "The right timber is often the difference — let's get into it.",
    "Let me help you narrow this down to the ones actually worth your attention.",
  ],
  compare: [
    "Happy to walk through both — let me show you how they differ.",
    "Good comparison to think through — let me lay them out.",
    "Right — the differences matter here more than the similarities.",
    "Let's put them side by side and see what actually separates them.",
  ],
  installation: [
    "Let me help you think through the installation side.",
    "Right, let's cover what to expect on the fitting side.",
    "The installation side matters as much as the design — let's work through it.",
    "Let's take this properly — installation is where a lot of good designs succeed or fail.",
  ],
  fix_or_repair: [
    "Let's work out what's going on and how to sort it.",
    "Right — let me help you think through what's likely happening.",
    "Good to catch these things early. Let's diagnose it properly.",
    "Let's think about what might be causing that before jumping to a fix.",
  ],
  followup_with_memory: [
    "Thinking about what you mentioned before, let me pick up where we left off.",
    "Right, connecting this with what you've told me before...",
    "That fits with what you were describing earlier — let me build on that.",
    "Let's continue exploring the direction we were building towards.",
    "This sounds like it's part of the same story we've been shaping — let me carry it forward.",
  ],
  vague: [
    "That's a good one to unpack — let me help you think through what you're after.",
    "Right, let's work out what you actually need here.",
    "Let's take this open — no rush to lock into a direction yet.",
    "Let me help you think through what would make this feel right.",
  ],
  default: [
    "Let me help you work through this properly.",
    "Right, let me think through this with you.",
    "Let's take this one carefully — worth doing it right.",
    "Good question — let me help you get to the answer that fits your situation.",
  ],
} as const;

type Topic = keyof typeof HINTS_BY_TOPIC;

// ─── Topic detection · deterministic regex · <5ms ──────────────────────

function detectTopic(message: string): Topic {
  const m = message.toLowerCase().trim();

  // Very short or greeting-shaped
  if (/^(hi|hello|hey|good\s+(morning|afternoon|evening)|hiya|alright|howdy|morning|afternoon|evening)\b/i.test(m)) {
    return "greeting";
  }

  // Regulation / building-guidance intent
  if (/\b(regulation|approved\s+document|building\s+regs?|part\s+k|part\s+m|bs\s+\d+|legal|allowed|permitted|comply|compliance|min(imum)?\s+(rise|going|width|headroom))\b/i.test(m)) {
    return "regulations";
  }

  // Price / premium / value intent
  if (/\b(price|cost|budget|premium|luxury|expensive|value|worth|afford|quote|estimate)\b/i.test(m)) {
    return "price_or_premium";
  }

  // Comparison intent
  if (/\b(vs\.?|versus|compare|comparison|difference\s+between|which\s+is\s+better|which\s+one|better\s+for|or\s+\w+\?)/i.test(m)) {
    return "compare";
  }

  // Installation / fitting intent
  if (/\b(install|installation|installer|installed|fitting|fit|fitter|refit)\b/i.test(m)) {
    return "installation";
  }

  // Repair / problem intent
  if (/\b(squeak|creak|broken|damage|lifted|loose|repair|fix|problem|issue|why\s+does|why\s+is)\b/i.test(m)) {
    return "fix_or_repair";
  }

  // Material / timber intent
  if (/\b(oak|walnut|ash|pine|beech|maple|sapele|iroko|redwood|mahogany|hardwood|softwood|timber|wood|material|finish(es)?|painted|stain(ed)?)\b/i.test(m)) {
    return "material";
  }

  // Generic staircase-design intent
  if (/\b(staircase|stair|steps?|treads?|risers?|handrail|baluster|balustrade|newel|spindle|winder|landing|string)\b/i.test(m)) {
    return "staircase_design";
  }

  // Very short = vague
  if (m.length < 20) return "vague";

  return "default";
}

// ─── The generator ─────────────────────────────────────────────────────

export interface PresenceHintInput {
  user_message: string;
  /** True when retrieveRelevantMemories() returned ≥1 memory · signals continuity. */
  has_living_memory?: boolean;
  /** True when this is the user's first turn in the conversation (Cold Start). */
  is_first_turn?: boolean;
}

/**
 * Generate a presence hint for the user's message. Deterministic · sub-10ms ·
 * no LLM call · no external I/O. Safe to run before any DB or model call.
 *
 * Returns the hint string. Never null · never empty · always safe to emit.
 */
export function generatePresenceHint(input: PresenceHintInput): string {
  // Followup-with-memory takes priority — signals continuity, which is where
  // the "how did it know?" magic lives. Never triggers on first turn.
  if (input.has_living_memory && !input.is_first_turn) {
    return pick(HINTS_BY_TOPIC.followup_with_memory);
  }

  const topic = detectTopic(input.user_message);
  return pick(HINTS_BY_TOPIC[topic]);
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
