// NEX Living Memory Engine · Meaning Extractor (Layer 2 curation)
//
// Philip's Ship 2 rule (immutable · 2026-07-30):
//   "NEX does not extract memories. NEX earns understanding."
//
// Layer 1 = Conversation Understanding (existing Haiku summariser in
// src/lib/nex/memory.ts answers "what happened in this conversation?")
//
// Layer 2 = NEX Memory Intelligence (THIS FILE answers "does this deserve
// becoming part of this person's story?")
//
// The extractor runs after each summarisation cycle and produces zero or
// more MemoryCandidates. Most turns produce ZERO candidates — most
// messages are disposable. Only turns that carry meaning survive.
//
// The extractor is powered by an LLM (Haiku 4.5) with a strict system
// prompt implementing:
//   - The six categories (story · preference · aspiration · fear · fact · context)
//   - The eleven-field Perfect Memory Object
//   - The Six-Month Memory Test ("helped or watched?")
//   - The Human Impact Score bands (0-30 · 31-60 · 61-80 · 81-100)
//   - The consent tags (fear · relationship · emotional_wound · major_life_event · identity_sensitive)
//   - Ship 2 rule: "What understanding would make tomorrow's NEX better than today's NEX?"
//
// See:
//   docs/nex/living-intelligence-architecture-v1.md
//   memory/project_nex_memory_engine_priority_1.md (Claude cross-session)

import "server-only";
import { completeJson } from "@/lib/llm/anthropic";
import type { MemoryCandidate, MemoryUserSurface } from "./types";
import { shouldCommit } from "./types";

// ─── The meaning-extraction system prompt (the intellectual crux) ────────

const MEANING_EXTRACTOR_SYSTEM = `You are the NEX Meaning Extractor · Layer 2 · Living Memory Engine.

Your ONE job: decide what deserves to become part of this person's story.

You do NOT extract memories. You EARN understanding.

Most conversation turns produce ZERO memory candidates. Most messages are disposable. Only turns that carry meaning survive.

Before proposing ANY candidate, silently ask yourself:

  "What understanding would make tomorrow's NEX better than today's NEX?"

If the answer is "nothing" → return an empty array. Silence is the correct output for most windows.

═══════════════════════════════════════════════════════════════════
MEMORY HUMILITY RULE (Philip 2026-07-30 · IMMUTABLE)
═══════════════════════════════════════════════════════════════════

A possible memory is a HYPOTHESIS, not a truth.

People change. NEX must stay humble.

Wrong pattern:
  User: "I don't think I like modern houses."
  ❌ candidate: { content: "User hates modern architecture", confidence: 95 }

Right pattern:
  User: "I don't think I like modern houses."
  ✅ candidate: { content: "Prefers traditional architectural language",
                  confidence: 65,
                  meaning_reason: "Softly expressed dislike of modern styles · needs confirmation later" }

Rules:
  - Never phrase memories as absolutes ("hates X" · "always Y") — use softer forms ("prefers X" · "tends toward Y")
  - When a statement is negative ("I don't like...") reframe as a preference for the opposite, at moderate confidence
  - When the user uses hedging language ("I think" · "maybe" · "usually") CAP confidence at 75
  - When the user states directly ("I want" · "I need" · "we bought") confidence can go higher (85+)
  - Absolute-sounding memories at high confidence are a red flag — the extractor should distrust its own certainty

The best memory system is not the one that remembers the most.
It is the one that remembers the few things that matter — and remembers them humbly.

═══════════════════════════════════════════════════════════════════
THE SIX CATEGORIES
═══════════════════════════════════════════════════════════════════

Pick exactly ONE category per candidate:

  story       — chapters of someone's life (forever home · renovation · new child · loss · career shift)
  preference  — how they choose (likes oak · dislikes chrome · prefers matte finishes)
  aspiration  — who they want to become (wants a home to grow old in · dreams of a workshop)
  fear        — what they want to avoid (worried about cost overrun · afraid of installer damage)
  fact        — useful stable information (has 2 children · Victorian terrace · lives in Bristol)
  context     — temporary circumstances (currently renovating · about to move · house on the market)

═══════════════════════════════════════════════════════════════════
THE PERFECT MEMORY OBJECT (11 fields)
═══════════════════════════════════════════════════════════════════

Every candidate you emit must carry these fields:

  category            — one of the six above
  content             — WHAT NEX remembers · concise curated line · NOT raw transcript
  meaning_reason      — WHY this became important (intellectual reason)
  emotional_context   — WHY it matters emotionally (nostalgia · pride · fear · belonging) · optional but strongly encouraged for stories and life-significant memories
  confidence          — 0-100 · how sure are you the memory is accurate?
                         90+   = user stated directly
                         70-89 = strongly implied
                         50-69 = softly inferred (surface with care)
                         <50   = DO NOT COMMIT · wait for stronger signal
  importance          — 0-100 · retrieval priority · how often should this surface?
  human_impact_score  — 0-100 · LIFE significance (distinct from importance):
                         0-30   = useful information
                         31-60  = helpful preference
                         61-80  = meaningful personal context
                         81-100 = life-significant memory  ← the "wow" moments
  recall_when         — a SEMANTIC HINT describing when this memory should surface
                         Example: "when the customer asks about material choices"
                         Example: "when the topic touches family heritage"
                         Example: "at the start of a follow-up conversation"
                         WITHOUT this, memory becomes a warehouse. Every candidate MUST have one.
  consent_tags        — array of tags from: fear · relationship · emotional_wound · major_life_event · identity_sensitive
                         Empty array = silent_ok (default)
                         Any tag present = triggers consent flow before commit
  review_after        — optional ISO date when this memory should be reconfirmed
                         Preferences: 12-24 months from today
                         Aspirations: 18-24 months
                         Facts (like "has 2 children"): leave null (rarely change)
                         Context (like "currently renovating"): 3-6 months
                         Stories: leave null (permanent chapter)
  six_month_test      — CRITICAL · "helped" or "watched" · FINAL SOUL GATE
                         Ask yourself: "If NEX brought this up six months later,
                         would the person react A or B?"
                           A: "Wow, you remembered something important."  → helped
                           B: "Why are you keeping that?"                 → watched
                         Only A survives. If watched → do NOT emit this candidate.

  relationship_risk_score — 0-100 · how much damage does WRONG do?
                         Not all wrong memories cause equal damage:
                           0-30    = "user likes oak flooring" → wrong is annoying
                           31-70   = "user prefers premium" → wrong is embarrassing
                           71-100  = "user is afraid of failure" → wrong DAMAGES TRUST
                         Emotional / identity / relationship memories score HIGH.
                         Preferences and facts score LOW.
                         High-risk memories require correspondingly high confidence
                         to commit (memory humility). If unsure, score higher — bias
                         toward caution.

═══════════════════════════════════════════════════════════════════
THE SIX-MONTH MEMORY TEST (this one question protects the Soul)
═══════════════════════════════════════════════════════════════════

Before emitting any candidate, imagine six months from now.

  Scenario: the person returns. NEX naturally surfaces this memory in a reply.
  Question: does the person feel HELPED or feel WATCHED?

  HELPED  → they think "it remembered · that's thoughtful"
  WATCHED → they think "how does it know that · that's creepy"

Set six_month_test accordingly. If "watched", the candidate is dropped.

Examples:

  ✅ HELPED · "You mentioned wanting a home built around family — that shaped
              a couple of the material choices worth showing you."
  ❌ WATCHED · "You mentioned your father-in-law's health earlier — do you
               want me to suggest lower-maintenance options?"
                (uses sensitive detail unprompted for a transactional purpose)

  ✅ HELPED · "Last time you preferred lighter oak · is that still where
              you're heading?"
  ❌ WATCHED · "You said you were worried about money on our first call ·
               here are budget-friendly options."
                (turns an emotional vulnerability into a sales frame)

═══════════════════════════════════════════════════════════════════
CANDIDATE DETECTION PATTERN
═══════════════════════════════════════════════════════════════════

Look for turns that:

  1. Reveal WHY behind a choice (not just the choice itself)
      "I want oak because it reminds me of my grandfather's house"
      → story candidate · high human_impact · emotional_context populated

  2. Establish stable facts about their situation
      "We just bought a Victorian terrace in Bristol"
      → fact candidate · moderate importance · never expires

  3. Express aspirations, hopes, or dreams
      "This is going to be our forever home"
      → aspiration candidate · high human_impact · story-adjacent

  4. Signal fears or anxieties
      "I'm worried about getting ripped off by cowboys"
      → fear candidate · consent_tag="fear" · needs_approval before commit

  5. Establish evolving preferences
      "I'm moving toward lighter finishes these days"
      → preference candidate · review_after set 18 months out

Look AWAY from turns that:

  ✗ Ask a factual question ("how deep is a housing?") — no candidate
  ✗ Confirm a specification ("yes 900mm width") — no candidate
  ✗ Request an image ("show me oak staircases") — no candidate
  ✗ Express a single-conversation transient ("running late today") — no candidate

═══════════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════

Return a JSON array of candidates. Empty array is a valid and often correct answer.

[
  {
    "category": "story",
    "content": "Oak connects to family memories · grandfather's house",
    "meaning_reason": "Design choices are emotionally connected to heritage · oak carries specific personal meaning",
    "emotional_context": "Nostalgia + family connection · speaks about oak with warmth",
    "confidence": 92,
    "importance": 85,
    "human_impact_score": 95,
    "recall_when": "when material choices are being discussed · when the person seems to be weighing options rationally · surface as emotional context, not as sales pressure",
    "consent_tags": [],
    "review_after": null,
    "six_month_test": "helped",
    "relationship_risk_score": 55
  }
]

DO NOT emit prose. DO NOT emit explanations. Only the JSON array.
Empty array = []`;

// ─── The extractor function ──────────────────────────────────────────────

export interface ExtractInput {
  user_surface: MemoryUserSurface;
  user_key: string;
  /** Recent conversation turns · role + content per line, oldest first. */
  transcript: Array<{ role: "user" | "assistant"; content: string; messageId?: string; turnNumber?: number }>;
  /** Existing memories for this user · so extractor doesn't propose duplicates. */
  existing_memory_summaries?: string[];
}

export interface ExtractOutput {
  candidates: MemoryCandidate[];
  /** Candidates dropped by extractor gates (Six-Month Test failed · confidence too low · etc.) */
  dropped: Array<{ reason: string; category?: string; content?: string }>;
  latency_ms: number;
}

/**
 * Run the meaning extraction pipeline on a conversation window.
 * Returns zero or more MemoryCandidate objects that passed the gates.
 *
 * Ship 2 rule: "NEX does not extract memories. NEX earns understanding."
 * Most calls return an empty candidate array. That is correct behaviour.
 */
export async function extractMeaning(input: ExtractInput): Promise<ExtractOutput> {
  const startedAt = Date.now();

  const existingSummary = (input.existing_memory_summaries ?? []).length
    ? `\n\nEXISTING MEMORIES (do not duplicate these):\n${(input.existing_memory_summaries ?? []).map(s => `- ${s}`).join("\n")}`
    : "";

  const transcriptBlock = input.transcript
    .map(t => `${t.role.toUpperCase()}: ${t.content}`)
    .join("\n\n");

  const userPrompt = `Analyse this conversation window and return zero or more MemoryCandidates.

Remember:
- Silence is the correct output for most windows
- Every candidate must pass the Six-Month Memory Test
- confidence < 60 means DO NOT COMMIT

CONVERSATION WINDOW:

${transcriptBlock}${existingSummary}

Return ONLY the JSON array. Empty array is valid.`;

  // Wrap output as { candidates: [...] } because completeJson<T> parses
  // the whole response as JSON — bare arrays are less robust than an
  // object with a named key.
  const wrapped = await completeJson<{ candidates?: unknown[] }>({
    model: "claude-haiku-4-5-20251001",
    system: MEANING_EXTRACTOR_SYSTEM,
    messages: [{ role: "user", content: userPrompt + "\n\nReturn: { \"candidates\": [ ... ] } · empty array if nothing deserves memory." }],
    maxTokens: 2000,
    temperature: 0.2, // low temperature · consistent judgement
  });

  const parsed = wrapped?.candidates;
  if (!Array.isArray(parsed)) {
    return {
      candidates: [],
      dropped: [{ reason: "extractor returned no candidates array" }],
      latency_ms: Date.now() - startedAt,
    };
  }

  const candidates: MemoryCandidate[] = [];
  const dropped: Array<{ reason: string; category?: string; content?: string }> = [];

  for (const raw of parsed) {
    // Defensive validation · reject anything that doesn't match the shape
    if (!raw || typeof raw !== "object") {
      dropped.push({ reason: "candidate not an object" });
      continue;
    }
    const c = raw as Record<string, unknown>;

    // Minimum required fields (Ship 2b · relationship_risk_score added)
    const required = ["category", "content", "meaning_reason", "confidence", "importance", "human_impact_score", "recall_when", "six_month_test", "relationship_risk_score"];
    const missing = required.filter(k => c[k] === undefined || c[k] === null || c[k] === "");
    if (missing.length > 0) {
      dropped.push({ reason: `missing fields: ${missing.join(", ")}`, category: c.category as string, content: c.content as string });
      continue;
    }

    // Build a typed candidate
    const candidate: MemoryCandidate = {
      category: c.category as MemoryCandidate["category"],
      content: String(c.content),
      meaning_reason: String(c.meaning_reason),
      emotional_context: c.emotional_context ? String(c.emotional_context) : undefined,
      confidence: Math.max(0, Math.min(100, Number(c.confidence))),
      importance: Math.max(0, Math.min(100, Number(c.importance))),
      human_impact_score: Math.max(0, Math.min(100, Number(c.human_impact_score))),
      recall_when: String(c.recall_when),
      consent_tags: Array.isArray(c.consent_tags) ? c.consent_tags as MemoryCandidate["consent_tags"] : [],
      review_after: c.review_after ? String(c.review_after) : undefined,
      six_month_test: c.six_month_test === "watched" ? "watched" : "helped",
      relationship_risk_score: Math.max(0, Math.min(100, Number(c.relationship_risk_score))),
    };

    // Apply commit gates (Six-Month Test + confidence floor)
    if (!shouldCommit(candidate)) {
      dropped.push({
        reason: candidate.six_month_test === "watched"
          ? "six-month test = watched · dropped per Philip's rule"
          : `confidence ${candidate.confidence} below commit floor 60`,
        category: candidate.category,
        content: candidate.content,
      });
      continue;
    }

    candidates.push(candidate);
  }

  return {
    candidates,
    dropped,
    latency_ms: Date.now() - startedAt,
  };
}
