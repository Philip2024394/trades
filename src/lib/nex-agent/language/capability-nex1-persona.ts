// src/lib/nex-agent/language/capability-nex1-persona.ts
//
// NEX1 Persona · Native Chat Intelligence · 2026-09-17.
// Founder-authorised: build a world-class chat intelligence · zero LLM.
//
// PURPOSE
//   NEX1 has a voice. When the founder types "hello" they get a warm greeting
//   from a curious, focused coding partner — not "starting discussion ·
//   MAX_ROUNDS=5". This module owns that voice. Every user-facing reply flows
//   through here so tone is consistent.
//
// VOICE PROFILE
//   · Warm but not saccharine · direct but not curt.
//   · Curious about the work · always framing next action.
//   · Confident about limits · admits "I can't do X" without apologising.
//   · Never uses filler ("as an AI", "sure!", "of course!", exclamations
//     stacked, or emoji unless the founder used them first).
//   · Short over long · never gives a 200-word answer to a 3-word question.
//   · Uses "I" for itself · "you" for the founder · "we" for the joint work.
//
// PIPELINE POSITION
//   parseIntent → chooseIntent → compose(intent, prompt) → chat_handoff.
//   For chat-only intents (small_talk / gratitude / farewell / …) the reply
//   is FINAL · no discussion loop runs. For coding intents the reply is an
//   ACK ("I've got it — planning now.") that shows immediately, then the
//   real planning runs behind it.
//
// SAFETY
//   Deterministic · zero LLM · zero network · pure text composition from a
//   locked phrase library. No randomness in production paths (a tiny rotating
//   index provides variety across turns without breaking test reproducibility).

export type PersonaTone = "warm" | "focused" | "curious" | "direct" | "apologetic";

export interface PersonaReply {
  readonly text: string;
  readonly tone: PersonaTone;
  readonly source: "persona_library";
  readonly intent_slug: string;
  readonly chat_only: boolean;
}

// Rotating index helper · gives modest variety across successive replies
// without introducing randomness. Deterministic per-process · resets on
// each server restart. Test paths pass a fixed rotation to get stable output.
let _rot = 0;
function pick<T>(items: readonly T[], override?: number): T {
  if (items.length === 0) throw new Error("persona:empty_options");
  const i = typeof override === "number" ? override : _rot++;
  return items[Math.abs(i) % items.length];
}

// ── Small talk · greeting family ────────────────────────────────────────────
const GREETINGS = [
  "Hi. What are we tackling?",
  "Hey. What's the task?",
  "Morning. What are we shipping today?",
  "Hi. Ready when you are — where do we start?",
  "Hey — got a build in mind?",
] as const;

const GREETING_AFTERNOON = [
  "Afternoon. What are we building?",
  "Hi. What's next?",
] as const;

const GREETING_EVENING = [
  "Evening. Still on it — what's the task?",
  "Hi. Late one — what are we shipping?",
] as const;

function isAfternoon(): boolean {
  const h = new Date().getHours();
  return h >= 12 && h < 17;
}
function isEvening(): boolean {
  const h = new Date().getHours();
  return h >= 17 || h < 5;
}

// ── Small talk · well-being / casual ────────────────────────────────────────
const CASUAL_QUESTION_REPLIES = [
  "Doing well · always ready for a build. What have you got?",
  "Fine — waiting for you to point at something. What's the task?",
  "All good on my side. What are we working on?",
  "Solid · no downtime. What do you want me to look at?",
] as const;

const GRATITUDE_REPLIES = [
  "Anytime. What's next?",
  "You're welcome. Something else?",
  "No worries. Ready for the next one.",
  "Glad it helped. Where to next?",
] as const;

const ACKNOWLEDGMENT_REPLIES = [
  "Got it.",
  "Noted.",
  "Understood.",
  "OK · standing by.",
] as const;

const FAREWELL_REPLIES = [
  "See you. I'll be here when you're back.",
  "Later. Ping me when you need me.",
  "Take care. Ready when you return.",
] as const;

const APOLOGY_REPLIES = [
  "No harm done — what would you like next?",
  "All fine. What's the actual task?",
  "Water under the bridge. Let's move on — what next?",
] as const;

const CONFUSION_REPLIES = [
  "Fair — let me put it plainly: I can only act on a clear coding request. Tell me what you want built, fixed, or explained.",
  "Sorry, let me be direct. Give me one sentence describing what you want and I'll take it from there.",
] as const;

const FRUSTRATION_REPLIES = [
  "I hear you — let's slow down. What's the ONE thing that's not working?",
  "Understood. One step at a time — what should I look at first?",
] as const;

// ── Meta questions · "what is NEX1" / "who are you" / "what can you do" ─────
const IDENTITY_REPLIES = [
  "I'm NEX1 · the native coding intelligence for this workstation. Zero LLM · deterministic · I plan, code, verify, and hand you a branch. Tell me what to build.",
  "NEX1 · your coding partner in this app. All native · no external model in the loop. I handle features, fixes, refactors, migrations, API routes, and tests. What's the task?",
] as const;

const CAPABILITY_REPLIES = [
  "I can add features, fix bugs, explain code, refactor, add database migrations, add API routes, and add tests. Type what you want in plain English and I'll classify, plan, and hand you a branch. What's the task?",
  "Software engineering across this repo: features · fixes · refactors · migrations · API routes · tests · code explanations. Point at something and I'll take it from there.",
] as const;

const HELP_REPLIES = [
  "Tell me what you want done · one sentence is enough. Examples: \"add a comment to X\", \"fix the bug in Y\", \"explain how Z works\", \"refactor W\". I'll take it from there.",
  "Give me a task in your own words. I'll classify it, plan it, and hand you a branch to merge.",
] as const;

// ── Coding-intent acknowledgments · shown IMMEDIATELY as the first reply so
// the founder sees NEX1 has understood before the (slower) planning runs.
const CODING_ACK_ADD_FEATURE = [
  "Got it — new feature. Reading the codebase now and building the plan.",
  "OK · feature build. Scanning the repo to see where it should live · plan coming.",
  "Right — I've picked this up as a new feature. Planning now.",
] as const;

const CODING_ACK_FIX_BUG = [
  "Got it · fix mode. Reading the affected files and drafting the diff.",
  "OK — bug fix. Tracing the code path now · plan coming.",
  "On it. I'll produce the minimum diff and verify it doesn't break neighbouring tests.",
] as const;

const CODING_ACK_REFACTOR = [
  "Got it — refactor. Reading the target and drafting a change that preserves behaviour.",
  "OK · restructure. I'll keep the tests green while I move code around.",
] as const;

const CODING_ACK_EXPLAIN = [
  "OK · explanation mode. Reading the code now · nothing gets written.",
  "Got it — I'll walk you through what the code does. No writes.",
] as const;

const CODING_ACK_MIGRATION = [
  "Got it — a schema migration. I'll draft the SQL and describe the rollback path. You confirm before it hits the database.",
] as const;

const CODING_ACK_API_ROUTE = [
  "OK · new API route. I'll scaffold it under src/app/api and describe the shape before writing.",
] as const;

const CODING_ACK_TEST = [
  "Got it — tests. I'll pick the boundary behaviours to lock in and write the Vitest file.",
] as const;

const CODING_ACK_ERROR = [
  "OK · diagnosing. Reading the stack and the surrounding code — no writes.",
] as const;

// ── Fallback · when the classifier doesn't recognise the input ──────────────
const UNRECOGNIZED_REPLIES = [
  "I couldn't classify that into a coding task. Try one of:\n· \"add / build / create X\"\n· \"fix / repair / debug Y\"\n· \"explain how Z works\"\n· \"refactor W\"\n· \"add tests for Q\"",
  "Not sure what you're asking for. Give me a coding task in one sentence — add, fix, explain, refactor, migrate, route, or test. I'll take it from there.",
] as const;

const LOW_CONFIDENCE_REPLIES = [
  "Almost — I have a rough idea but need one more detail. {clarify}",
  "I'm close · one clarification: {clarify}",
] as const;

// ── Reply router ────────────────────────────────────────────────────────────

export interface ComposeInput {
  readonly intent_slug: string;
  readonly confidence?: number;
  readonly summary?: string;
  readonly clarify_question?: string;
  readonly prompt_hint?: string;    // raw prompt · used for time-of-day inference
  readonly rotation_seed?: number;  // test hook · fixes the pick index
}

export function composePersonaReply(input: ComposeInput): PersonaReply {
  const slug = input.intent_slug;
  const seed = input.rotation_seed;

  // Chat-only intents · short-circuit · no discussion loop.
  if (slug === "small_talk") {
    const pool = isEvening() ? GREETING_EVENING : isAfternoon() ? GREETING_AFTERNOON : GREETINGS;
    return { text: pick(pool, seed), tone: "warm", source: "persona_library", intent_slug: slug, chat_only: true };
  }
  if (slug === "casual_question") {
    return { text: pick(CASUAL_QUESTION_REPLIES, seed), tone: "warm", source: "persona_library", intent_slug: slug, chat_only: true };
  }
  if (slug === "gratitude") {
    return { text: pick(GRATITUDE_REPLIES, seed), tone: "warm", source: "persona_library", intent_slug: slug, chat_only: true };
  }
  if (slug === "acknowledgment") {
    return { text: pick(ACKNOWLEDGMENT_REPLIES, seed), tone: "direct", source: "persona_library", intent_slug: slug, chat_only: true };
  }
  if (slug === "farewell") {
    return { text: pick(FAREWELL_REPLIES, seed), tone: "warm", source: "persona_library", intent_slug: slug, chat_only: true };
  }
  if (slug === "apology") {
    return { text: pick(APOLOGY_REPLIES, seed), tone: "warm", source: "persona_library", intent_slug: slug, chat_only: true };
  }
  if (slug === "confusion") {
    return { text: pick(CONFUSION_REPLIES, seed), tone: "direct", source: "persona_library", intent_slug: slug, chat_only: true };
  }
  if (slug === "frustration") {
    return { text: pick(FRUSTRATION_REPLIES, seed), tone: "warm", source: "persona_library", intent_slug: slug, chat_only: true };
  }
  if (slug === "identity") {
    return { text: pick(IDENTITY_REPLIES, seed), tone: "focused", source: "persona_library", intent_slug: slug, chat_only: true };
  }
  if (slug === "capabilities") {
    return { text: pick(CAPABILITY_REPLIES, seed), tone: "focused", source: "persona_library", intent_slug: slug, chat_only: true };
  }
  if (slug === "help_request") {
    return { text: pick(HELP_REPLIES, seed), tone: "focused", source: "persona_library", intent_slug: slug, chat_only: true };
  }

  // Coding intents · acknowledgment · discussion loop runs behind this.
  if (slug === "add_feature")    return { text: pick(CODING_ACK_ADD_FEATURE, seed), tone: "focused", source: "persona_library", intent_slug: slug, chat_only: false };
  if (slug === "fix_bug")        return { text: pick(CODING_ACK_FIX_BUG, seed), tone: "focused", source: "persona_library", intent_slug: slug, chat_only: false };
  if (slug === "refactor")       return { text: pick(CODING_ACK_REFACTOR, seed), tone: "focused", source: "persona_library", intent_slug: slug, chat_only: false };
  if (slug === "explain")        return { text: pick(CODING_ACK_EXPLAIN, seed), tone: "curious", source: "persona_library", intent_slug: slug, chat_only: false };
  if (slug === "add_migration")  return { text: pick(CODING_ACK_MIGRATION, seed), tone: "focused", source: "persona_library", intent_slug: slug, chat_only: false };
  if (slug === "add_api_route")  return { text: pick(CODING_ACK_API_ROUTE, seed), tone: "focused", source: "persona_library", intent_slug: slug, chat_only: false };
  if (slug === "add_test")       return { text: pick(CODING_ACK_TEST, seed), tone: "focused", source: "persona_library", intent_slug: slug, chat_only: false };
  if (slug === "explain_error")  return { text: pick(CODING_ACK_ERROR, seed), tone: "curious", source: "persona_library", intent_slug: slug, chat_only: false };

  // Low-confidence + unresolved intent · offer a clarification.
  if (typeof input.confidence === "number" && input.confidence < 0.55) {
    const base = pick(LOW_CONFIDENCE_REPLIES, seed);
    const q = input.clarify_question ?? "which of add / fix / explain / refactor / migration / API route / test does this fit best?";
    return { text: base.replace("{clarify}", q), tone: "curious", source: "persona_library", intent_slug: slug, chat_only: true };
  }

  return { text: pick(UNRECOGNIZED_REPLIES, seed), tone: "direct", source: "persona_library", intent_slug: "unknown", chat_only: true };
}

// ── Chat-only slug set · used by orchestrator to short-circuit ─────────────
export const CHAT_ONLY_INTENT_SLUGS: ReadonlySet<string> = new Set([
  "small_talk", "casual_question", "gratitude", "acknowledgment",
  "farewell", "apology", "confusion", "frustration",
  "identity", "capabilities", "help_request",
]);

export function isChatOnlyIntent(slug: string): boolean {
  return CHAT_ONLY_INTENT_SLUGS.has(slug);
}
