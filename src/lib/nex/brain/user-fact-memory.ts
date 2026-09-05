// src/lib/nex/brain/user-fact-memory.ts
//
// G23 · User-Fact Memory & Persistence
// Philip 2026-09-06 · AUTHORIZE · G23
//
// PROBLEM
//   NEX could understand a user statement during the current turn but
//   had no persistent user-fact layer allowing later turns to reliably
//   use that fact. The Speaking Intelligence Audit demonstrated this
//   with T1 "I have a food allergy to shellfish" → T4 "what did I tell
//   you about my allergy?" → hotel-list re-emit (no recall).
//
// GOVERNING PRINCIPLE (locked · AUTHORIZE §1)
//   When the user explicitly tells NEX something about themselves that
//   is appropriate to remember, NEX must be able to retain that fact,
//   retrieve it later, distinguish it from general knowledge, and use
//   it only within its proven scope.
//
//   Never silently convert inference into fact. NEX owns the memory
//   abstraction; the LLM never sees raw memory and never writes it.
//
// SCOPE OF THIS MODULE
//   Detector + store + retrieval + memory-question responder.
//   Consumes G12 polarity (negated statements do not create positive
//   facts) and L4 dialogue-act (only ASSERTION-family creates
//   candidates). Backing store is append-only JSONL for independent
//   persistence verification (§29).
//
// PRESERVATION (§20 §25)
//   · L4 dialogue-act classification · untouched (this module consumes it)
//   · G12 polarity · untouched (this module consumes it)
//   · G24 scope validation · untouched (memory ≠ retrieval scope)
//   · P0.3 · P0.4 · result-followup · language-intelligence · lexicon ·
//     claim-verification · voice inheritance · all untouched

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

// ─── Types ──────────────────────────────────────────────────────

export type UserFactType =
  | "USER_FACT"                     // general facts about the user
  | "USER_PREFERENCE"               // preferences (language, communication, food)
  | "USER_CONSTRAINT"               // allergies, dietary restrictions, exclusions
  | "USER_CONTEXT"                  // temporary situational context
  | "USER_PROFILE_INFORMATION";     // profile-level: role, business, residence

export type ExplicitnessLevel = "EXPLICIT" | "DERIVED" | "UNCERTAIN";

export type FactScope = "TEMPORARY" | "CURRENT" | "DURABLE" | "UNKNOWN";

export type FactStatus = "current" | "superseded" | "historical";

export type FactProvenance = {
  source_type: "user_assertion" | "user_stated_correction" | "user_retracted";
  source_turn_text: string;
  created_at: string;   // ISO
};

export type UserFact = {
  id: string;
  conversation_id: string;
  fact_type: UserFactType;
  subject: string;      // "role" · "residence" · "allergy" · "preferred_language"
  value: string;        // "restaurant_operator" · "Yogyakarta" · "shellfish"
  scope: FactScope;
  confidence: ExplicitnessLevel;
  provenance: FactProvenance;
  status: FactStatus;
  superseded_at?: string;
  superseded_by?: string;
  supersedes?: string;
};

export type UserFactCandidate = {
  fact_type: UserFactType;
  subject: string;
  value: string;
  scope: FactScope;
  confidence: ExplicitnessLevel;
  raw_clause: string;
  detection_reason: string;
};

export type MemoryRetrievalRequest = {
  conversation_id: string;
  fact_types?: UserFactType[];
  subjects?: string[];
  include_superseded?: boolean;
  include_historical?: boolean;
};

// ─── Store (JSONL-backed · append-only · provider-independent) ──

type StoreState = { factsByConversation: Map<string, UserFact[]> };

let store: StoreState = { factsByConversation: new Map() };
let storePath = defaultStorePath();
let storeInitialized = false;

function defaultStorePath(): string {
  const dir = process.env.NEX_USER_FACT_STORE_DIR
    ?? join(process.cwd(), "data", "nex-memory");
  return join(dir, "user-facts.jsonl");
}

/** Idempotent load from disk. Called lazily on first read/write. */
function ensureLoaded(): void {
  if (storeInitialized) return;
  storeInitialized = true;
  try {
    if (!existsSync(storePath)) return;
    const raw = readFileSync(storePath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const fact = JSON.parse(trimmed) as UserFact;
        const arr = store.factsByConversation.get(fact.conversation_id) ?? [];
        arr.push(fact);
        store.factsByConversation.set(fact.conversation_id, arr);
      } catch { /* skip malformed line · JSONL is best-effort */ }
    }
  } catch { /* store missing or unreadable · treat as empty */ }
}

function appendToDisk(fact: UserFact): void {
  try {
    mkdirSync(dirname(storePath), { recursive: true });
    appendFileSync(storePath, JSON.stringify(fact) + "\n", "utf8");
  } catch { /* disk unavailable · in-memory cache still authoritative */ }
}

/** For tests only. Resets both in-memory and reloads-on-next-read
 *  discipline. Does NOT delete the on-disk store; tests must control
 *  the store path via NEX_USER_FACT_STORE_DIR. */
export function _resetUserFactStoreForTests(nextPath?: string): void {
  store = { factsByConversation: new Map() };
  storeInitialized = false;
  if (nextPath) storePath = nextPath;
}

// ─── Safety filter (§16 · sensitive info) ───────────────────────

const SENSITIVE_SUBJECT_MARKERS = new Set([
  "password", "pin", "ssn", "passport",
  "credit_card", "bank_account", "credit-card", "bank-account",
  "hiv", "aids", "cancer", "diagnosis",
]);

const SENSITIVE_VALUE_MARKERS = new Set([
  "password", "pin", "ssn",
]);

function isSensitiveFact(candidate: UserFactCandidate): boolean {
  const s = candidate.subject.toLowerCase();
  const v = candidate.value.toLowerCase();
  for (const m of SENSITIVE_SUBJECT_MARKERS) if (s.includes(m)) return true;
  for (const m of SENSITIVE_VALUE_MARKERS) if (v.includes(m)) return true;
  return false;
}

// ─── Vocabulary primitives (detector) ───────────────────────────

function tokens(message: string): string[] {
  return (message || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[?.!,;:"“”()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const FIRST_PERSON_EN = new Set(["i", "im", "we"]);
const FIRST_PERSON_ID = new Set(["saya", "aku", "kami", "kita"]);

const ROLE_VERBS = new Set([
  "run", "own", "manage", "operate",
  "menjalankan", "punya", "mengelola",
]);

const WORK_VERBS = new Set(["work"]);

const LIVE_VERBS = new Set(["live", "living", "tinggal"]);

const FROM_VERBS = new Set(["from", "dari"]);

const PREFER_VERBS = new Set([
  "prefer", "preferred", "lebih_suka", "lebih",
]);

const LIKE_VERBS = new Set(["like", "likes", "suka"]);

const ALLERGY_MARKERS = new Set([
  "allergy", "allergic", "alergi",
]);

const CANNOT_EAT_MARKERS = new Set([
  "cant", "cannot", "tidak_bisa", "tidak_boleh",
]);

const EAT_VERBS = new Set(["eat", "eats", "makan"]);

const KNOWN_LANGUAGES = new Set([
  "english", "indonesian", "bahasa", "spanish", "french",
  "chinese", "japanese", "korean",
  "inggris", "indonesia",
]);

const COMMUNICATION_CHANNELS = new Set([
  "whatsapp", "telegram", "signal", "wechat", "line", "email", "sms", "call",
]);

const TEMPORAL_MARKERS = new Set([
  "today", "tomorrow", "yesterday", "tonight",
  "week", "month", "year",
  "hari", "besok", "kemarin", "minggu", "bulan",
]);

const PAST_MARKERS = new Set(["used", "was", "were", "had", "dulu"]);

// Rejection markers · these must NOT become user facts.

const THIRD_PARTY_SUBJECTS_EN = new Set([
  "friend", "friends", "wife", "husband", "father", "mother", "parents",
  "brother", "sister", "family", "someone", "everyone", "anyone", "people",
  "they",
]);

const THIRD_PARTY_SUBJECTS_ID = new Set([
  "teman", "istri", "suami", "ayah", "ibu", "orangtua", "kakak", "adik",
  "keluarga", "seseorang", "orang",
]);

const ATTRIBUTION_PAIRS: ReadonlyArray<ReadonlyArray<string>> = [
  ["people", "say"],
  ["people", "think"],
  ["they", "say"],
  ["they", "think"],
  ["everyone", "thinks"],
  ["everyone", "says"],
  ["orang", "bilang"],
];

const INTENTION_PREFIXES: ReadonlyArray<ReadonlyArray<string>> = [
  ["i", "want", "to"],
  ["i", "wanted", "to"],
  ["im", "thinking", "about"],
  ["im", "planning", "to"],
  ["im", "going", "to"],
  ["id", "like", "to"],
  ["saya", "ingin"],
  ["saya", "mau"],
  ["saya", "berencana"],
];

// ─── Detector primitives ────────────────────────────────────────

function isThirdPartyStatement(t: string[]): boolean {
  // Look at the subject slot: first-person markers rule out third-party
  // (mostly). If the sentence STARTS with "my <third-party>" or
  // "someone/people/they …", reject.
  if (t[0] === "my" && t.length > 1 && THIRD_PARTY_SUBJECTS_EN.has(t[1])) return true;
  if (t[0] === "someone" || t[0] === "people" || t[0] === "they") return true;
  if (t[0] === "he" || t[0] === "she") return true;
  if (t[0] === "seseorang" || t[0] === "orang") return true;
  return false;
}

function isAttribution(t: string[]): boolean {
  for (const pair of ATTRIBUTION_PAIRS) {
    for (let i = 0; i <= t.length - pair.length; i++) {
      let ok = true;
      for (let j = 0; j < pair.length; j++) {
        if (t[i + j] !== pair[j]) { ok = false; break; }
      }
      if (ok) return true;
    }
  }
  return false;
}

function isIntention(t: string[]): boolean {
  for (const prefix of INTENTION_PREFIXES) {
    if (prefix.length > t.length) continue;
    let match = true;
    for (let i = 0; i < prefix.length; i++) {
      if (t[i] !== prefix[i]) { match = false; break; }
    }
    if (match) return true;
  }
  return false;
}

function containsPastMarker(t: string[]): boolean {
  for (const tok of t) if (PAST_MARKERS.has(tok)) return true;
  return false;
}

function containsTemporalMarker(t: string[]): boolean {
  for (const tok of t) if (TEMPORAL_MARKERS.has(tok)) return true;
  return false;
}

// ─── Clause splitter (atomicity) ────────────────────────────────

function splitClauses(message: string): string[] {
  return message
    .split(/\band\b|;|,\s*(?:and|dan)?\s*|·|—|--/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─── Clause-level detectors ─────────────────────────────────────

function detectClauseFacts(clause: string): UserFactCandidate[] {
  const t = tokens(clause);
  if (t.length === 0) return [];

  // Reject non-facts.
  if (isThirdPartyStatement(t)) return [];
  if (isAttribution(t)) return [];
  if (isIntention(t)) return [];

  // Must start with first-person marker (English or Indonesian).
  const first = t[0];
  const firstEn = FIRST_PERSON_EN.has(first);
  const firstId = FIRST_PERSON_ID.has(first);
  if (!firstEn && !firstId) return [];

  const out: UserFactCandidate[] = [];
  const isPast = containsPastMarker(t);
  const isTemp = containsTemporalMarker(t);

  // Role: "I run/own/manage a <noun>"
  // Also handle Indonesian: "saya menjalankan/punya <noun>"
  for (let i = 1; i < t.length - 1; i++) {
    if (ROLE_VERBS.has(t[i])) {
      const nounIdx = t[i + 1] === "a" || t[i + 1] === "an" ? i + 2 : i + 1;
      const noun = t[nounIdx];
      if (noun && noun.length > 2) {
        out.push({
          fact_type: "USER_PROFILE_INFORMATION",
          subject: "role",
          value: `${noun}_operator`,
          scope: isPast ? "UNKNOWN" : "DURABLE",
          confidence: "EXPLICIT",
          raw_clause: clause,
          detection_reason: `role_verb:${t[i]}:${noun}`,
        });
      }
      break;
    }
  }

  // "I am a X" · role assertion
  if (firstEn && t[1] === "am" && t[2] === "a" && t[3] && t[3].length > 2) {
    out.push({
      fact_type: "USER_PROFILE_INFORMATION",
      subject: "role",
      value: t[3],
      scope: "DURABLE",
      confidence: "EXPLICIT",
      raw_clause: clause,
      detection_reason: `am_a:${t[3]}`,
    });
  }

  // "I work as a X"
  for (let i = 1; i < t.length - 2; i++) {
    if (WORK_VERBS.has(t[i]) && t[i + 1] === "as" && (t[i + 2] === "a" || t[i + 2] === "an")) {
      const noun = t[i + 3];
      if (noun && noun.length > 2) {
        out.push({
          fact_type: "USER_PROFILE_INFORMATION",
          subject: "role",
          value: noun,
          scope: "DURABLE",
          confidence: "EXPLICIT",
          raw_clause: clause,
          detection_reason: `work_as_a:${noun}`,
        });
      }
    }
  }

  // Residence: "I live in X" · "saya tinggal di X"
  for (let i = 1; i < t.length - 2; i++) {
    if (LIVE_VERBS.has(t[i]) && (t[i + 1] === "in" || t[i + 1] === "di")) {
      const place = t[i + 2];
      if (place && place.length > 1) {
        out.push({
          fact_type: "USER_PROFILE_INFORMATION",
          subject: "residence",
          value: place,
          scope: isPast ? "UNKNOWN" : "CURRENT",
          confidence: "EXPLICIT",
          raw_clause: clause,
          detection_reason: `live_in:${place}`,
        });
      }
    }
  }

  // Preferences: "I prefer X" · "saya lebih suka X"
  for (let i = 1; i < t.length - 1; i++) {
    if (PREFER_VERBS.has(t[i])) {
      const next = t[i + 1];
      if (KNOWN_LANGUAGES.has(next)) {
        out.push({
          fact_type: "USER_PREFERENCE",
          subject: "preferred_language",
          value: next,
          scope: "DURABLE",
          confidence: "EXPLICIT",
          raw_clause: clause,
          detection_reason: `prefer_language:${next}`,
        });
      } else if (COMMUNICATION_CHANNELS.has(next)) {
        out.push({
          fact_type: "USER_PREFERENCE",
          subject: "communication_channel",
          value: next,
          scope: "DURABLE",
          confidence: "EXPLICIT",
          raw_clause: clause,
          detection_reason: `prefer_channel:${next}`,
        });
      } else if (next && next.length > 2) {
        out.push({
          fact_type: "USER_PREFERENCE",
          subject: "general_preference",
          value: next,
          scope: "DURABLE",
          confidence: "EXPLICIT",
          raw_clause: clause,
          detection_reason: `prefer:${next}`,
        });
      }
    }
  }

  // Allergy / dietary constraint: "I have an allergy to X" · "I can't eat X"
  for (let i = 1; i < t.length; i++) {
    if (ALLERGY_MARKERS.has(t[i])) {
      const toIdx = t.indexOf("to", i);
      if (toIdx >= 0 && t[toIdx + 1]) {
        out.push({
          fact_type: "USER_CONSTRAINT",
          subject: "allergy",
          value: t[toIdx + 1],
          scope: "DURABLE",
          confidence: "EXPLICIT",
          raw_clause: clause,
          detection_reason: `allergy_to:${t[toIdx + 1]}`,
        });
      }
    }
  }
  for (let i = 1; i < t.length - 1; i++) {
    if (CANNOT_EAT_MARKERS.has(t[i]) && EAT_VERBS.has(t[i + 1])) {
      const item = t[i + 2];
      if (item && item.length > 2) {
        out.push({
          fact_type: "USER_CONSTRAINT",
          subject: "dietary_exclusion",
          value: item,
          scope: "DURABLE",
          confidence: "EXPLICIT",
          raw_clause: clause,
          detection_reason: `cant_eat:${item}`,
        });
      }
    }
  }

  // Temporary context: "I'm travelling with X" (with time markers)
  if (firstEn && (t[1] === "traveling" || t[1] === "travelling")
      && t[2] === "with" && t[3] && isTemp) {
    out.push({
      fact_type: "USER_CONTEXT",
      subject: "travel_companions",
      value: t[3],
      scope: "TEMPORARY",
      confidence: "EXPLICIT",
      raw_clause: clause,
      detection_reason: `travelling_with:${t[3]}`,
    });
  }

  return out;
}

// ─── Public detector ────────────────────────────────────────────

export type DetectorInput = {
  message: string;
  /** L4 dialogue-act classification. Only ASSERTION-family creates
   *  fact candidates. Questions / offers / task requests never do. */
  dialogueFunction?: string;
  /** G12 polarity. Negated statements do NOT create positive facts. */
  polarity?: string;
};

/** Which L4 dialogue-act functions may produce fact candidates.
 *  ASSERTION and PERSONAL_CONTEXT_STATEMENT explicitly. Others
 *  (question, offer, task) are excluded. UNCLASSIFIED is allowed
 *  because many valid assertions (`"I run a restaurant"`) currently
 *  classify as UNCLASSIFIED at L4 level; the detector rules below
 *  provide their own precision. */
const ASSERTION_LIKE_FUNCTIONS: ReadonlySet<string> = new Set([
  "ASSERTION",
  "PERSONAL_CONTEXT_STATEMENT",
  "UNCLASSIFIED",
  // TOPIC_SHIFT and CORRECTION shapes ("Actually, I live in Jakarta
  // now") often carry legitimate fact updates. The detector's
  // first-person + shape requirements provide the discrimination.
  "TOPIC_SHIFT",
  "CORRECTION",
]);

/** For G12 retraction handling: given a NEGATED user statement about
 *  themselves, return the (fact_type, subject) tuples that would have
 *  been CREATED if the polarity were AFFIRMATIVE. Route.ts uses these
 *  to explicitly supersede matching prior facts. */
export function detectRetractionSubjects(message: string): Array<{ fact_type: UserFactType; subject: string }> {
  const clauses = splitClauses(message);
  const out: Array<{ fact_type: UserFactType; subject: string }> = [];
  for (const c of clauses) {
    for (const cand of detectClauseFacts(c)) {
      if (!isSensitiveFact(cand)) out.push({ fact_type: cand.fact_type, subject: cand.subject });
    }
  }
  return out;
}

export function detectUserFactCandidates(input: DetectorInput): UserFactCandidate[] {
  const { message, dialogueFunction, polarity } = input;

  // L4 preservation: only ASSERTION-family generates fact candidates.
  if (dialogueFunction && !ASSERTION_LIKE_FUNCTIONS.has(dialogueFunction)) {
    return [];
  }

  // G12 preservation: negated statements do not create positive facts.
  if (polarity && polarity !== "AFFIRMATIVE") {
    return [];
  }

  const clauses = splitClauses(message);
  const out: UserFactCandidate[] = [];
  for (const c of clauses) {
    for (const cand of detectClauseFacts(c)) {
      if (!isSensitiveFact(cand)) out.push(cand);
    }
  }
  return out;
}

// ─── Write / retrieve ───────────────────────────────────────────

export type WriteResult = {
  written: UserFact[];
  superseded: UserFact[];
};

export function writeUserFacts(
  candidates: readonly UserFactCandidate[],
  conversation_id: string,
  source_turn_text: string,
): WriteResult {
  ensureLoaded();
  const now = new Date().toISOString();
  const arr = store.factsByConversation.get(conversation_id) ?? [];
  const written: UserFact[] = [];
  const superseded: UserFact[] = [];

  for (const c of candidates) {
    // Supersession: replace an existing "current" fact of the same
    // (fact_type, subject). Keep the old fact readable as "superseded".
    const existing = arr.find(
      (f) => f.status === "current"
             && f.fact_type === c.fact_type
             && f.subject === c.subject,
    );
    const fact: UserFact = {
      id: `fact_${randomUUID().slice(0, 12)}`,
      conversation_id,
      fact_type: c.fact_type,
      subject: c.subject,
      value: c.value,
      scope: c.scope,
      confidence: c.confidence,
      provenance: {
        source_type: existing ? "user_stated_correction" : "user_assertion",
        source_turn_text,
        created_at: now,
      },
      status: "current",
      supersedes: existing?.id,
    };
    if (existing) {
      existing.status = "superseded";
      existing.superseded_at = now;
      existing.superseded_by = fact.id;
      superseded.push(existing);
      // Append the supersession-event record too, for on-disk faithfulness.
      appendToDisk({ ...existing });
    }
    arr.push(fact);
    appendToDisk(fact);
    written.push(fact);
  }
  store.factsByConversation.set(conversation_id, arr);
  return { written, superseded };
}

/** Explicitly supersede any current fact matching a (type, subject).
 *  Used when a G12-NEGATED statement retracts a prior positive fact. */
export function supersedeMatchingFacts(input: {
  conversation_id: string;
  fact_type: UserFactType;
  subject: string;
  source_turn_text: string;
}): UserFact[] {
  ensureLoaded();
  const arr = store.factsByConversation.get(input.conversation_id) ?? [];
  const now = new Date().toISOString();
  const retracted: UserFact[] = [];
  for (const f of arr) {
    if (f.status === "current"
        && f.fact_type === input.fact_type
        && f.subject === input.subject) {
      f.status = "superseded";
      f.superseded_at = now;
      f.superseded_by = `retracted:${input.source_turn_text.slice(0, 60)}`;
      retracted.push(f);
      appendToDisk({ ...f });
    }
  }
  return retracted;
}

export function retrieveUserFacts(request: MemoryRetrievalRequest): UserFact[] {
  ensureLoaded();
  const arr = store.factsByConversation.get(request.conversation_id) ?? [];
  return arr.filter((f) => {
    if (!request.include_superseded && f.status === "superseded") return false;
    if (!request.include_historical && f.status === "historical") return false;
    if (request.fact_types && !request.fact_types.includes(f.fact_type)) return false;
    if (request.subjects && !request.subjects.includes(f.subject)) return false;
    return true;
  });
}

export function listAllUserFacts(conversation_id: string): UserFact[] {
  ensureLoaded();
  return (store.factsByConversation.get(conversation_id) ?? []).slice();
}

// ─── Memory-question detector + deterministic responder ─────────
//
// Recognises: "what do you know about me/my X" · "what did I tell you
// about X" · "do you remember X" · "why do you think Y" (provenance).

const MEM_TOPICS: Record<string, ReadonlyArray<UserFactType>> = {
  "business":  ["USER_PROFILE_INFORMATION"],
  "role":      ["USER_PROFILE_INFORMATION"],
  "job":       ["USER_PROFILE_INFORMATION"],
  "work":      ["USER_PROFILE_INFORMATION"],
  "allergy":   ["USER_CONSTRAINT"],
  "allergies": ["USER_CONSTRAINT"],
  "diet":      ["USER_CONSTRAINT"],
  "trip":      ["USER_CONTEXT"],
  "travel":    ["USER_CONTEXT"],
  "language":  ["USER_PREFERENCE"],
  "preference": ["USER_PREFERENCE"],
  "location":  ["USER_PROFILE_INFORMATION"],
  "residence": ["USER_PROFILE_INFORMATION"],
  "home":      ["USER_PROFILE_INFORMATION"],
};

export type MemoryReplyDecision =
  | { shouldReply: false; reason: string }
  | {
      shouldReply: true;
      reason: string;
      reply: string;
      retrieved: UserFact[];
      kind: "list_all" | "topic" | "provenance";
    };

export function decideMemoryReply(input: {
  userMessage: string;
  conversation_id: string;
}): MemoryReplyDecision {
  const m = input.userMessage.toLowerCase();
  const t = tokens(input.userMessage);

  // "why do you think/say/know X" → provenance answer for the topic
  if (/why (do|does|would) you (think|say|know|believe)/.test(m)) {
    const topic = findMemoryTopic(t);
    const facts = topic
      ? retrieveUserFacts({ conversation_id: input.conversation_id, fact_types: MEM_TOPICS[topic] })
      : listAllUserFacts(input.conversation_id).filter((f) => f.status === "current");
    if (facts.length === 0) {
      return {
        shouldReply: true,
        reason: "provenance_no_facts",
        kind: "provenance",
        reply: "I don't have any explicit facts about that from this conversation.",
        retrieved: [],
      };
    }
    const f = facts[0];
    return {
      shouldReply: true,
      reason: "provenance_reply",
      kind: "provenance",
      retrieved: facts,
      reply: `You told me on this turn: "${f.provenance.source_turn_text}" — recorded ${new Date(f.provenance.created_at).toISOString().slice(0, 19).replace("T", " ")}.`,
    };
  }

  // "what do you know about me" · "what do you remember about me"
  if (/(what (do|did) you (know|remember))|(do you remember)/.test(m)) {
    const topic = findMemoryTopic(t);
    const facts = topic
      ? retrieveUserFacts({ conversation_id: input.conversation_id, fact_types: MEM_TOPICS[topic] })
      : listAllUserFacts(input.conversation_id).filter((f) => f.status === "current");
    if (facts.length === 0) {
      return {
        shouldReply: true,
        reason: "memory_empty",
        kind: topic ? "topic" : "list_all",
        reply: topic
          ? `I don't have any recorded ${topic} information from this conversation yet.`
          : "I don't have any explicit facts recorded from this conversation yet.",
        retrieved: [],
      };
    }
    const lines = facts.map(formatFact);
    return {
      shouldReply: true,
      reason: topic ? `topic_reply:${topic}` : "list_all_reply",
      kind: topic ? "topic" : "list_all",
      retrieved: facts,
      reply: (topic ? `Here's what you've told me about ${topic}: ` : "Here's what you've told me in this conversation: ")
             + lines.join(" · "),
    };
  }

  // "what did I tell you about X"
  if (/what did i tell you about/.test(m)) {
    const topic = findMemoryTopic(t);
    const facts = topic
      ? retrieveUserFacts({ conversation_id: input.conversation_id, fact_types: MEM_TOPICS[topic] })
      : listAllUserFacts(input.conversation_id).filter((f) => f.status === "current");
    if (facts.length === 0) {
      return {
        shouldReply: true,
        reason: "recall_empty",
        kind: "topic",
        reply: topic
          ? `You haven't told me anything about ${topic} yet in this conversation.`
          : "You haven't told me anything specific yet in this conversation.",
        retrieved: [],
      };
    }
    return {
      shouldReply: true,
      reason: `recall:${topic ?? "any"}`,
      kind: "topic",
      retrieved: facts,
      reply: `You told me: ${facts.map(formatFact).join(" · ")}.`,
    };
  }

  return { shouldReply: false, reason: "no_memory_question_pattern" };
}

function findMemoryTopic(t: string[]): string | null {
  for (const tok of t) {
    if (Object.prototype.hasOwnProperty.call(MEM_TOPICS, tok)) return tok;
  }
  return null;
}

function formatFact(f: UserFact): string {
  const scopeSuffix = f.scope === "TEMPORARY" ? " (temporary)" : "";
  return `${f.subject} = ${f.value}${scopeSuffix}`;
}
