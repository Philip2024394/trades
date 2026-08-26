// NEX GUIDANCE MEMORY · per-user UX guidance state.
//
// Doctrine (Philip 2026-08-26): NEX should remember which interface
// explanations THIS particular user has already experienced, so she never
// keeps introducing the same things. This is a NARROWLY SCOPED UX memory
// layer — not a personal information store.
//
// Storage: localStorage today (anonymous · single device). When user auth
// wires in, this same shape syncs to the server so guidance memory follows
// the account across devices.
//
// Never exposed in conversation. NEX behaves familiarly · she does not say
// "I remember you heard this" · that would break the illusion.

import type { NexTarget } from "./nexPersonality";

const STORAGE_KEY = "nex.guidance.memory.v1";
/** Ring-buffer size for recently-heard phrase ids per target · dedupe window. */
const RECENT_PHRASES_PER_TARGET = 12;

export interface TargetMemory {
  phrasesHeard:      string[];     // ring buffer of last N phrase ids used
  explanationsSeen:  number;       // total lifetime count for this target
  lastPhraseAt:      number | null;
  lastVisitedAt:     number | null;
}

export interface EyeConversationMemory {
  phrasesHeard: string[];          // ring buffer of last N eye-tap phrase ids
  totalTaps:    number;
  lastEyeTapAt: number | null;
}

export interface PersonalityExposure {
  wittyUsed:   number;
  playfulUsed: number;
  warmUsed:    number;
  coolUsed:    number;
  concUsed:    number;
  firmUsed:    number;
}

export interface NexGuidanceMemory {
  userId:           string;                          // "local" for anon
  targets:          Partial<Record<NexTarget, TargetMemory>>;
  eyeConversation:  EyeConversationMemory;
  personality:      PersonalityExposure;
  createdAt:        number;
}

function empty(userId = "local"): NexGuidanceMemory {
  return {
    userId,
    targets: {},
    eyeConversation: { phrasesHeard: [], totalTaps: 0, lastEyeTapAt: null },
    personality: { wittyUsed: 0, playfulUsed: 0, warmUsed: 0, coolUsed: 0, concUsed: 0, firmUsed: 0 },
    createdAt: Date.now(),
  };
}

function readRaw(): NexGuidanceMemory {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as NexGuidanceMemory;
    return parsed && typeof parsed === "object" ? parsed : empty();
  } catch {
    return empty();
  }
}

function write(mem: NexGuidanceMemory): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mem)); } catch { /* quota · noop */ }
}

/** Read the current memory (fresh copy · caller doesn't mutate). */
export function loadGuidanceMemory(): NexGuidanceMemory {
  return readRaw();
}

/** Ensure a target has an entry. Returns the mutated memory (in-place). */
function ensureTarget(mem: NexGuidanceMemory, target: NexTarget): TargetMemory {
  const t = mem.targets[target];
  if (t) return t;
  const fresh: TargetMemory = { phrasesHeard: [], explanationsSeen: 0, lastPhraseAt: null, lastVisitedAt: null };
  mem.targets[target] = fresh;
  return fresh;
}

/** Record that NEX just said a specific phrase for a specific target. */
export function recordPhraseHeard(target: NexTarget, phraseId: string, tone?: string): void {
  const mem = readRaw();
  const t   = ensureTarget(mem, target);
  const next = [...t.phrasesHeard, phraseId].slice(-RECENT_PHRASES_PER_TARGET);
  t.phrasesHeard     = next;
  t.explanationsSeen = t.explanationsSeen + 1;
  t.lastPhraseAt     = Date.now();
  if (target === "eye-tap") {
    const eye = mem.eyeConversation;
    eye.phrasesHeard = [...eye.phrasesHeard, phraseId].slice(-RECENT_PHRASES_PER_TARGET);
    eye.totalTaps    = eye.totalTaps + 1;
    eye.lastEyeTapAt = Date.now();
  }
  // Tone exposure counter.
  if (tone) {
    const p = mem.personality;
    if (tone === "witty")   p.wittyUsed++;
    if (tone === "warm")    p.warmUsed++;
    if (tone === "cool")    p.coolUsed++;
    if (tone === "concise") p.concUsed++;
    if (tone === "firm")    p.firmUsed++;
  }
  write(mem);
}

/** Record that the user visited a target (without NEX necessarily speaking). */
export function recordTargetVisited(target: NexTarget): void {
  const mem = readRaw();
  const t   = ensureTarget(mem, target);
  t.lastVisitedAt = Date.now();
  write(mem);
}

/** Get the target sub-memory (or a fresh empty one). */
export function getTargetMemory(target: NexTarget): TargetMemory {
  const mem = readRaw();
  return mem.targets[target] ?? { phrasesHeard: [], explanationsSeen: 0, lastPhraseAt: null, lastVisitedAt: null };
}

/** Wipe all guidance memory (privacy control · used by reset flow). */
export function clearGuidanceMemory(): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}
