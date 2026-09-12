// src/lib/nex/brain/interest/interest-intent.ts
//
// NEX Entity → Interest → Owner Conversation Slice
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE
//
// PURPOSE (§6 · §8 · §21)
//   Semantic classifier for the user's "I want to talk to the people
//   behind this" dialogue act. Distinguishes:
//     INTEREST_TO_CONTACT · user wants to open a conversation
//     INTEREST_EXPLICITLY_NEGATED · G12 negation on interest
//     NONE · no interest signal
//
//   Never a phrase list. Composes:
//     · interest / contact / enquiry / message vocabulary (EN + ID)
//     · self-reference (I / me / us / saya / kami)
//     · possible negation (G12 preserved)
//     · optional entity reference (first / second / that one / etc.)
//
// STRICTLY REUSES G12
//   Negation detection defers to explicit token check compatible with
//   the existing negation intelligence. When the user says "I'm not
//   interested", we return INTEREST_EXPLICITLY_NEGATED · the interest
//   gate NEVER activates the owner-contact flow from a negated turn.

// ─── Types ──────────────────────────────────────────────────────

export type InterestIntentKind =
  | "INTEREST_TO_CONTACT"
  | "INTEREST_EXPLICITLY_NEGATED"
  | "NONE";

export type InterestIntentDetection = {
  kind: InterestIntentKind;
  markers: string[];
  language: "EN" | "ID" | "MIXED";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
};

// ─── Tokenizer ──────────────────────────────────────────────────

function tokens(message: string): string[] {
  return (message || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[?.!,;:"“”()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// ─── Vocabulary (EN + ID) ───────────────────────────────────────

// Core interest lemmas
const INTEREST_TOKENS = new Set([
  "interested", "interest",
  "tertarik",
]);

// Contact / message / enquire vocabulary
const CONTACT_TOKENS = new Set([
  "contact", "message", "reach",
  "enquire", "inquire", "enquiry", "inquiry",
  "ask", "talk", "speak",
  "hubungi", "kontak", "pesan", "tanya", "bicara", "menghubungi",
  "ngobrol",
]);

// Owner / them / person-behind vocabulary
const OWNER_TOKENS = new Set([
  "owner", "them", "him", "her", "they",
  "pemilik", "mereka", "beliau", "dia",
]);

// Self-reference (subject of interest)
const SELF_TOKENS = new Set([
  "i", "im", "me", "my", "us", "we", "our",
  "saya", "aku", "kami", "kita",
]);

// Modal / desiderative shapes
const DESIDERATIVE_TOKENS = new Set([
  "want", "would", "like", "wish", "need",
  "ingin", "mau", "pengen", "suka",
]);

// Negation markers (G12 · authoritative)
const NEGATION_TOKENS = new Set([
  "not", "dont", "cant", "wont", "no", "never", "neither",
  "tidak", "nggak", "gak", "bukan", "jangan",
]);

// Indonesian strong tokens for language detection
const ID_STRONG_TOKENS = new Set([
  "saya", "aku", "kami", "kita", "tertarik", "hubungi", "kontak", "pesan",
  "mereka", "pemilik", "ingin", "mau", "tanya",
  "tidak", "nggak", "gak", "bukan", "jangan",
  "pertama", "kedua", "ketiga", "yang",
  "menghubungi", "bisa", "boleh", "bicara", "ngobrol",
  "beliau", "dia",
  "tapi", "juga", "dengan", "dari",
]);

// ─── Detectors ──────────────────────────────────────────────────

function detectLanguage(t: string[]): "EN" | "ID" | "MIXED" {
  let id = 0, en = 0;
  for (const tok of t) {
    if (ID_STRONG_TOKENS.has(tok)) id++;
    else if (/^[a-z]+$/.test(tok)) en++;
  }
  if (id > 0 && en > 0) return "MIXED";
  if (id > 0) return "ID";
  return "EN";
}

function contains(t: string[], set: Set<string>): boolean {
  for (const tok of t) if (set.has(tok)) return true;
  return false;
}

function containsMatchingIndices(t: string[], set: Set<string>): number[] {
  const out: number[] = [];
  for (let i = 0; i < t.length; i++) if (set.has(t[i])) out.push(i);
  return out;
}

// Is the interest token in scope of a negation? (G12-compatible)
function isNegated(t: string[], interestIdx: number): boolean {
  // Look for negation up to 3 tokens BEFORE the interest lemma.
  const start = Math.max(0, interestIdx - 3);
  for (let i = start; i < interestIdx; i++) {
    if (NEGATION_TOKENS.has(t[i])) return true;
  }
  return false;
}

// "I'm interested" · "I am interested" · "saya tertarik"
function hasInterestClaim(t: string[]): { yes: boolean; idx: number; negated: boolean; markers: string[] } {
  const idxList = containsMatchingIndices(t, INTEREST_TOKENS);
  for (const idx of idxList) {
    const negated = isNegated(t, idx);
    return { yes: true, idx, negated, markers: [`interest:${t[idx]}`, ...(negated ? ["negated"] : [])] };
  }
  return { yes: false, idx: -1, negated: false, markers: [] };
}

// "I want to contact them" · "I'd like to message them" · "saya ingin
// menghubungi mereka" · "contact the first one"
function hasContactClaim(t: string[]): { yes: boolean; idx: number; negated: boolean; markers: string[] } {
  const idxList = containsMatchingIndices(t, CONTACT_TOKENS);
  for (const idx of idxList) {
    // Contact verb alone isn't enough · need a target (owner / them /
    // ordinal). Otherwise "ask me" or "message you" gets misclassified.
    const hasTarget = contains(t, OWNER_TOKENS);
    // Or an explicit imperative shape like "contact the first one" ·
    // "message them" where the contact token is verb-position (first
    // or second word).
    const isImperative = idx <= 1 && contains(t, OWNER_TOKENS);
    // "I'd like to message them" · desiderative + contact + target
    const hasDesiderative = contains(t, DESIDERATIVE_TOKENS);
    if (!hasTarget && !isImperative) continue;
    if (!hasDesiderative && !isImperative && !contains(t, OWNER_TOKENS)) continue;
    const negated = isNegated(t, idx);
    return {
      yes: true, idx, negated,
      markers: [`contact:${t[idx]}`, ...(hasTarget ? ["target"] : []), ...(negated ? ["negated"] : [])],
    };
  }
  return { yes: false, idx: -1, negated: false, markers: [] };
}

// "I'd like to ask them something" · "can I talk to the owner?"
function hasQuestionShape(t: string[]): boolean {
  // "can I contact them" / "can we message them" — modal + self + contact + owner
  const modalIdx = t.findIndex((x) => x === "can" || x === "bisa" || x === "boleh");
  if (modalIdx < 0) return false;
  const hasSelf = contains(t, SELF_TOKENS);
  const hasContact = contains(t, CONTACT_TOKENS);
  const hasOwner = contains(t, OWNER_TOKENS);
  return hasSelf && hasContact && hasOwner;
}

// ─── Main classifier ────────────────────────────────────────────

export function classifyInterestIntent(message: string): InterestIntentDetection {
  const t = tokens(message);
  const language = detectLanguage(t);
  const markers: string[] = [];
  const none = (reason: string): InterestIntentDetection => ({
    kind: "NONE", markers, language, confidence: "LOW", reason,
  });
  if (t.length === 0) return none("empty");

  // 1 · explicit "I'm interested" (or "saya tertarik")
  const interest = hasInterestClaim(t);
  if (interest.yes) {
    markers.push(...interest.markers);
    if (interest.negated) {
      return {
        kind: "INTEREST_EXPLICITLY_NEGATED", markers, language,
        confidence: "HIGH", reason: `interest_negated`,
      };
    }
    return {
      kind: "INTEREST_TO_CONTACT", markers, language,
      confidence: "HIGH", reason: `interest_claim`,
    };
  }

  // 2 · "I want to contact them" / "message them" / "hubungi mereka"
  const contact = hasContactClaim(t);
  if (contact.yes) {
    markers.push(...contact.markers);
    if (contact.negated) {
      return {
        kind: "INTEREST_EXPLICITLY_NEGATED", markers, language,
        confidence: "HIGH", reason: `contact_negated`,
      };
    }
    return {
      kind: "INTEREST_TO_CONTACT", markers, language,
      confidence: "HIGH", reason: `contact_claim`,
    };
  }

  // 3 · "can I contact them?" / "bisa hubungi mereka?"
  if (hasQuestionShape(t)) {
    markers.push("question_shape_contact_owner");
    return {
      kind: "INTEREST_TO_CONTACT", markers, language,
      confidence: "MEDIUM", reason: `question_contact_owner`,
    };
  }

  return none("no_interest_signal");
}
