// Staircase Advisor · Social & Meta intents (Philip 2026-08-01)
//
// A staircase specialist doesn't respond to "I love you" with a mandatory
// project_type gate, doesn't refuse "can I speak to your boss" as off-topic,
// and doesn't tell a customer "that's not something I'm built for" when they
// ask "why can't you show images?"
//
// These intents are handled BEFORE the staircase advisor pipeline so they
// never enter retrieval / composition. Each returns a Nex-voice deterministic
// response that acknowledges the intent honestly and offers a natural next step.
//
// Ordering (highest specificity first):
//   1. CAPABILITY_QUESTION  — asks about Nex's abilities · answer directly
//   2. ESCALATION_REQUEST   — asks for a human / boss · offer available paths
//   3. SOCIAL_AFFECTION     — thanks / love you / brilliant · acknowledge warmly
//   4. GREETING             — hi / hello / good morning · greet + offer help

import "server-only";

export type SocialIntent =
  | "capability_question"
  | "escalation_request"
  | "social_affection"
  | "greeting";

export type SocialMatch = {
  intent:      SocialIntent;
  response:    string;
  sources:     string[];
};

// ─── CAPABILITY_QUESTION ─────────────────────────────────────────
// User asks about Nex's abilities · what she can/can't do · features · limits.

const CAPABILITY_PATTERNS: RegExp[] = [
  // Image / display capability · contracted AND expanded forms
  /\bwhy\s+(can'?t|cannot|can\s+not|do\s+i\s+not\s+see|don'?t\s+i\s+see|do\s+not\s+i\s+see)\s+.{0,20}(images?|pictures?|photos?|gallery)/i,
  /\bwhy\s+(aren'?t|are\s+not|isn'?t|is\s+not)\s+.{0,20}(images?|pictures?|photos?|gallery)\s+(showing|visible|appearing|there|here)/i,
  /\b(can|do|are)\s+you\s+(show|display|render|upload|send|share)\s+(images?|pictures?|photos?|photograph|gallery)/i,
  /\b(can|are)\s+you\s+able\s+to\s+(show|display|render|upload|send)\s+(images?|pictures?|photos?)/i,
  /\bwhy\s+.{0,10}not\s+show(ing)?\s+.{0,10}(images?|pictures?|photos?|gallery)/i,
  /\bwhy\s+(can'?t|cannot|can\s+not)\s+you\s+show/i,
  /\bwhy\s+you\s+can\s+not\s+show/i,
  /\bwhere\s+(are|is)\s+(the\s+)?(images?|pictures?|photos?|gallery)/i,
  /\bwhy\s+(don'?t|do\s+not)\s+i\s+see\s+(the\s+)?(images?|pictures?|photos?|gallery)/i,
  // General capability probes
  /\bwhat\s+(can|do)\s+you\s+(do|help\s+with|handle|offer)/i,
  /\bwhat\s+are\s+you\s+(able|good)\s+(to|at)/i,
];

// ─── ESCALATION_REQUEST ──────────────────────────────────────────
// User asks for a human, manager, boss, complaint route.
//
// Philip 2026-08-01 · keyword-based rule (not full phrase regex) so natural
// variations like "speak your boss" · "manager please" · "put me through to
// someone" all match. Full-phrase patterns kept for high-confidence cases.

const ESCALATION_VERBS = /\b(speak|talk|contact|see|reach|put\s+me\s+through|connect(\s+me)?)\b/i;
const ESCALATION_TARGETS = /\b(boss|manager|supervisor|human|person|somebody|someone|real\s+person|owner|team|founder|philip)\b/i;

// Bare-word variants a customer might type alone · matches "real person" as a standalone message
const ESCALATION_BARE_TARGETS = /^(real\s+person|human\s+being)[\s.,!?]*$/i;

const ESCALATION_FULL_PATTERNS: RegExp[] = [
  /\bis\s+there\s+a\s+(manager|boss|human|supervisor)/i,
  /\b(want|need)\s+to\s+(make\s+a\s+)?complain/i,
  /\bcomplaint\b/i,
  /\bcan\s+someone\s+else\s+help/i,
  // Bare target-word with optional "please" · matches "manager" · "manager please" · "boss please" · "human please"
  /^(manager|boss|supervisor|human|owner|founder)(\s+please)?[\s.,!?]*$/i,
];

function matchesEscalation(msg: string): boolean {
  // Bare-word rejection ("no") should never fire escalation
  if (msg.trim().length < 3) return false;
  // Full-phrase high-confidence patterns
  if (ESCALATION_FULL_PATTERNS.some((p) => p.test(msg))) return true;
  // Bare "real person" · "human being" style standalone messages
  if (ESCALATION_BARE_TARGETS.test(msg.trim())) return true;
  // Keyword AND check · handles "speak your boss" · "talk to a manager" · "contact your team" · "reach someone" · etc.
  return ESCALATION_VERBS.test(msg) && ESCALATION_TARGETS.test(msg);
}

// ─── SOCIAL_AFFECTION ────────────────────────────────────────────
// Warmth · thanks · love · compliments. Acknowledge, don't refuse.

// Philip 2026-08-01 · Contracted AND expanded forms so "you are amazing" fires
// the same as "you're amazing" (regression sweep found the gap).
const AFFECTION_PATTERNS: RegExp[] = [
  /\bi\s+(love|adore|really\s+like|really\s+appreciate)\s+you\b/i,
  /\b(you'?re|you\s+are)\s+(amazing|brilliant|great|the\s+best|awesome|fantastic|excellent|wonderful|lovely|helpful|smart|clever)/i,
  /\bthanks?(\s+(a\s+lot|so\s+much|very\s+much))?[\s.,!?]*$/i,
  /\bthank\s+you(\s+(so\s+much|very\s+much))?[\s.,!?]*$/i,
  /\b(great|excellent|perfect|nice|good)\s+(job|work|answer|response)/i,
  /\bappreciate\s+(it|your\s+help)/i,
];

// ─── GREETING ────────────────────────────────────────────────────

const GREETING_PATTERNS: RegExp[] = [
  /^(hi|hello|hey|hiya|howdy|greetings)[\s.,!?]*$/i,
  /^(good\s+(morning|afternoon|evening|day))[\s.,!?]*$/i,
  /^(what'?s\s+up|how\s+(are\s+you|you\s+doing))[\s.,!?]*$/i,
];

// ─── Detection ───────────────────────────────────────────────────

export function matchSocialIntent(message: string): SocialMatch | null {
  const trimmed = message.trim();

  // CAPABILITY_QUESTION (most specific · check first · often includes "images")
  if (CAPABILITY_PATTERNS.some((p) => p.test(trimmed))) {
    return {
      intent:   "capability_question",
      response: buildCapabilityResponse(trimmed),
      sources:  ["Nex capability rule · honest answer about UI abilities"],
    };
  }

  // ESCALATION_REQUEST
  if (matchesEscalation(trimmed)) {
    return {
      intent:   "escalation_request",
      response:
        "I don't have a boss you can speak to — I'm Nex, the staircase specialist. If something I said wasn't right, tell me what went wrong and I'll try again. If you'd rather speak with a person about your staircase project, the Nex Stairplan team can connect you with a designer or installer directly.",
      sources:  ["Nex escalation rule · offers Stairplan team as escalation path"],
    };
  }

  // SOCIAL_AFFECTION
  if (AFFECTION_PATTERNS.some((p) => p.test(trimmed))) {
    return {
      intent:   "social_affection",
      response:
        "Thanks — that's kind of you to say. My job is to help you design the right staircase and make the process easier. Whenever you're ready, let's keep working on your project.",
      sources:  ["Nex social-warmth rule · acknowledge · steer back to staircase help"],
    };
  }

  // GREETING (least specific · check last)
  if (GREETING_PATTERNS.some((p) => p.test(trimmed))) {
    return {
      intent:   "greeting",
      response:
        "Hi — I'm Nex, your staircase specialist. What can I help you with today? Design ideas, materials, layouts, or something more specific?",
      sources:  ["Nex greeting rule"],
    };
  }

  return null;
}

// Tailor the capability response by the specific question shape.
function buildCapabilityResponse(message: string): string {
  const asksImages = /\b(images?|pictures?|photos?|photograph|display|show|render|upload)/i.test(message);
  if (asksImages) {
    return (
      "The chat can show images when a matching staircase design exists in my confirmed Visual Brain library. If no images appeared after a request, it usually means one of two things: I couldn't find a design that matched what you asked about, or the topic doesn't have images in the library yet. Tell me the design attributes you're most interested in (staircase type · timber · balustrade · style) and I'll retrieve the closest matches."
    );
  }
  // Generic "what can you do"
  return (
    "I'm Nex — a staircase specialist. I can help with staircase design and inspiration, materials (timber species · glass · metal), layouts (straight · quarter-turn · spiral · floating), building regulations basics, installation guidance, and directing you to the right suppliers or designers through the Nex Stairplan network. Where would you like to start?"
  );
}
