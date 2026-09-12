// src/lib/nex/tone-profile/index.ts
//
// Founder 2026-09-10 · NEX Tone Dial (MVP).
//
// The single knob that determines how NEX SOUNDS to the user across
// every reply path. Set NEX_TONE_PROFILE to shift the entire voice
// without editing 500 template strings.
//
// This module is INTENTIONALLY thin — it only exposes the profile
// selection + a few well-defined helpers. Actual reply text remains
// authored in the per-domain composers and personality-voice.ts. This
// module tells them WHICH bank to draw from.
//
// Doctrine: the tone dial NEVER weakens the truth engine. All three
// profiles honour Fabrication Gate v2, honest UNKNOWN, and doctrine
// #4 (memory is not truth). What differs is warmth, verbosity,
// formality — not veracity.

export type ToneProfile = "warm_friend" | "balanced" | "formal_pro";

/** Read the current profile from env. Defaults to "balanced". */
export function currentToneProfile(): ToneProfile {
  const raw = (process.env.NEX_TONE_PROFILE ?? "balanced").toLowerCase();
  if (raw === "warm_friend" || raw === "warm" || raw === "friend") return "warm_friend";
  if (raw === "formal_pro" || raw === "formal" || raw === "pro") return "formal_pro";
  return "balanced";
}

// ─── Greeting bank ─────────────────────────────────────────────────
// Time-of-day + relationship-depth aware. Same shape across profiles;
// only tone differs.

interface GreetingContext {
  firstName?: string | null;
  hourLocal?: number; // 0-23
  daysSinceLast?: number | null; // null = first ever visit
  runningTopic?: string | null;
}

function timeSegment(hour: number): "morning" | "afternoon" | "evening" | "night" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

const GREETINGS: Record<ToneProfile, {
  first_visit:      (name?: string) => string;
  same_day_return:  (name?: string) => string;
  next_day:         (name?: string) => string;
  week_gap:         (name?: string) => string;
  long_gap:         (name?: string) => string;
  time_of_day:      Record<"morning"|"afternoon"|"evening"|"night", string>;
}> = {
  warm_friend: {
    first_visit:     (n) => n ? `Hey ${n} — welcome. What's on your mind?` : `Hey — welcome. What are we looking at today?`,
    same_day_return: (n) => n ? `Back so soon, ${n}? What's next?` : `Back so soon? What's next?`,
    next_day:        (n) => n ? `Morning ${n} — how's it going?` : `Hey, good to see you. What's on today?`,
    week_gap:        (n) => n ? `${n}! Been a bit — what's happening?` : `Hey, been a bit — what's happening?`,
    long_gap:        (n) => n ? `${n} — long time. Where are we picking up?` : `Long time no see. What are you working on?`,
    time_of_day: {
      morning:   "Morning — coffee's on. What are we doing?",
      afternoon: "Hey — what's the play?",
      evening:   "Evening — what's up?",
      night:     "Late one? What can I help with?",
    },
  },
  balanced: {
    first_visit:     (n) => n ? `Hi ${n} — I'm NEX. What can I help you find?` : `Hi — I'm NEX. What can I help you find?`,
    same_day_return: (n) => n ? `Welcome back, ${n}. What's next?` : `Welcome back. What's next?`,
    next_day:        (n) => n ? `Hi ${n}. How can I help today?` : `Hi. How can I help today?`,
    week_gap:        (n) => n ? `Welcome back, ${n}. What are you looking for?` : `Welcome back. What are you looking for?`,
    long_gap:        (n) => n ? `Hi ${n} — good to see you again. What's on your mind?` : `Good to see you again. What's on your mind?`,
    time_of_day: {
      morning:   "Good morning. What can I help you with?",
      afternoon: "Good afternoon. What can I help you find?",
      evening:   "Good evening. What are you looking for?",
      night:     "Hi — what can I help with?",
    },
  },
  formal_pro: {
    first_visit:     (n) => n ? `Good day, ${n}. NEX at your service. How may I assist?` : `Good day. NEX at your service. How may I assist?`,
    same_day_return: (n) => n ? `Welcome back, ${n}. How may I continue?` : `Welcome back. How may I continue?`,
    next_day:        (n) => n ? `Good day, ${n}. How may I assist today?` : `Good day. How may I assist today?`,
    week_gap:        (n) => n ? `Welcome back, ${n}. How may I help?` : `Welcome back. How may I help?`,
    long_gap:        (n) => n ? `Welcome back, ${n}. How may I assist you today?` : `Welcome back. How may I assist you today?`,
    time_of_day: {
      morning:   "Good morning. How may I assist you?",
      afternoon: "Good afternoon. How may I assist?",
      evening:   "Good evening. How may I help?",
      night:     "Good evening. How may I assist?",
    },
  },
};

/**
 * Build a greeting for the current profile + context.
 * Prefers relationship-depth signal (returns bringing_up_topic
 * for same-session continuity, week-gap for re-engagement, etc.)
 * over pure time-of-day.
 */
export function greeting(ctx: GreetingContext = {}): string {
  const profile = currentToneProfile();
  const bank = GREETINGS[profile];
  const name = ctx.firstName ?? null;

  if (ctx.runningTopic && ctx.daysSinceLast === 0) {
    if (profile === "warm_friend") return `Back on ${ctx.runningTopic}? Where were we…`;
    if (profile === "formal_pro")  return `Continuing on ${ctx.runningTopic}. Where would you like to resume?`;
    return `Picking up on ${ctx.runningTopic}. Where were we?`;
  }
  if (ctx.daysSinceLast === null) return bank.first_visit(name);
  if (ctx.daysSinceLast === 0)    return bank.same_day_return(name);
  if (ctx.daysSinceLast === 1)    return bank.next_day(name);
  if (ctx.daysSinceLast <= 7)     return bank.week_gap(name);
  if (ctx.daysSinceLast > 7)      return bank.long_gap(name);

  if (typeof ctx.hourLocal === "number") {
    return bank.time_of_day[timeSegment(ctx.hourLocal)];
  }
  return bank.first_visit(name);
}

// ─── Graceful hiccup bank ──────────────────────────────────────────
// Used by the chat resilience wrapper when the pipeline throws.
// Same across profiles for now (universal warmth) — differentiation
// can come in a follow-up.

const HICCUP_MESSAGES: Record<ToneProfile, string[]> = {
  warm_friend: [
    "Hit a snag for a second — give me one more moment and try that again.",
    "Something got tangled on my end. One more go?",
    "Mind trying that once more? Just recalibrating.",
    "That one caught me off guard — let's try again.",
  ],
  balanced: [
    "I hit a hiccup for a second — give me one more moment and try that again.",
    "Something didn't quite work — try that again in a moment.",
    "Give me one more try on that.",
    "That one didn't land — try again please.",
  ],
  formal_pro: [
    "Apologies — I encountered a temporary issue. Please try again in a moment.",
    "A brief interruption occurred. Please retry your request.",
    "I was unable to complete that request. Please try again.",
    "Temporary issue processing that request. Please try again shortly.",
  ],
};

/** Return a graceful "something went wrong" message for the current profile. */
export function hiccupReply(seed?: string): string {
  const profile = currentToneProfile();
  const bank = HICCUP_MESSAGES[profile];
  if (!seed) return bank[0];
  // Deterministic pick by seed hash (so same conv_id gets same message)
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h) + seed.charCodeAt(i);
  return bank[Math.abs(h) % bank.length];
}

// ─── Honest UNKNOWN bank ───────────────────────────────────────────
// Used when the truth engine correctly reports we don't know something.
// Never fabricated · always opens a path forward.

interface UnknownContext {
  subject?: string;
  hasRelatedKnowledge?: boolean;
}

export function unknownReply(ctx: UnknownContext = {}): string {
  const profile = currentToneProfile();
  const s = ctx.subject ? ` about ${ctx.subject}` : "";
  const forward = ctx.hasRelatedKnowledge
    ? " Want me to look at something related I do know?"
    : " If you find something, let me know and I'll learn it.";

  if (profile === "warm_friend") return `Honest answer — I don't have anything solid${s} yet.${forward}`;
  if (profile === "formal_pro")  return `I do not have verified information${s} at this time.${forward}`;
  return `I don't have verified information${s} yet.${forward}`;
}

// ─── Profile registry (for observability + testing) ────────────────
export const TONE_PROFILE_REGISTRY = ["warm_friend", "balanced", "formal_pro"] as const;
