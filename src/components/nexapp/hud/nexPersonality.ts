// NEX PERSONALITY · types + phrase metadata contract.
//
// Doctrine (Philip 2026-08-26): every phrase NEX speaks about the interface
// carries structured metadata so the picker can choose contextually rather
// than randomly. Same intelligent woman every time — cool, witty, warm,
// confident, helpful, occasionally playful — but the words adapt to what
// is actually happening on screen.
//
// Companion files:
//   phraseLibrary.ts     · the actual catalog of phrases per target
//   nexGuidanceMemory.ts · per-user memory of what NEX has already said
//   pickPhrase.ts        · the selection engine

import type { OrbLookDirection } from "../NexVoiceOrb";
import type { GuidanceTargetId } from "./NexGuidance";

/**
 * Every UI element NEX can talk about. Adding a new target = one string here
 * + one entry in phraseLibrary.ts under that key.
 */
export type NexTarget =
  | "eye-tap"          // response to a tap on the eye (not a UI element)
  | "voice-button"
  | "discovery"
  | "profile" | "favorites" | "history" | "services" | "food"
  | "search" | "notifications" | "menu"
  | "composer" | "send-button"
  | "workspace" | "context-card"
  | "food-card"         // specific card inside the Food workspace
  // Side-drawer tool activations (Philip 2026-08-27) · MASCOT is the first;
  // future drawers (emoji · sticker · gif · memory · brain · tools) add here.
  | "side-drawer"       // generic drawer-open fallback
  | "mascot-drawer"     // opening the mascot drawer
  | "generic";         // fallback catch-all

/**
 * What NEX is trying to accomplish with this utterance. The picker uses this
 * to filter down to appropriate phrases for the situation.
 */
export type NexIntent =
  | "introduce"    // first time seeing this UI element
  | "explain"      // teach how it works
  | "redirect"     // tell the user to go somewhere else (e.g. eye→voice-button)
  | "recommend"    // suggest a specific thing
  | "reassure"     // "don't worry" · "I'm still here"
  | "playful"      // light humour
  | "firm"         // direct · after multiple redirects
  | "quiet-notice" // announcing a pause
  | "familiar"     // returning user · "back to X" · shorter
  | "micro";       // one-liner acknowledgement

/**
 * Personality tone weights. Overall mix target ~70/15/10/5.
 */
export type NexTone = "warm" | "cool" | "witty" | "concise" | "firm";

export type NexLength = "short" | "medium" | "long";

/**
 * One catalog phrase. Every phrase gets a stable id so the memory layer can
 * track exactly which lines this user has already heard.
 */
export interface NexPhrase {
  /** Stable id · never renamed once shipped (memory keys on this). */
  id: string;
  target: NexTarget;
  intent: NexIntent;
  tone: NexTone;
  length: NexLength;
  text: string;
  /** Where the pupil should look while this line is spoken. */
  look?: OrbLookDirection;
  /** Whether this phrase should be accompanied by a guidance beam to the
   *  target (see NexGuidance). */
  requiresBeam?: boolean;
  /** Guidance beam target · defaults to the phrase's `target` mapped. */
  beamTarget?: GuidanceTargetId;
  /** Milliseconds the speech bubble stays visible · overrides default. */
  dwellMs?: number;
}

/**
 * Speech level decider result · lets the caller decide whether NEX should
 * speak at all, and how much.
 */
export type NexSpeechLevel = "silent" | "micro" | "guidance";

/**
 * Personality mix target · used by the picker to bias tone selection.
 * The exact weights are approximate; the picker samples from this distribution
 * only when multiple tones are available for the requested intent.
 */
export const TONE_MIX: Record<NexTone, number> = {
  warm:    0.55,
  cool:    0.15,
  witty:   0.15,
  concise: 0.10,
  firm:    0.05,
};

/**
 * Target → guidance beam target id mapping. Used by the picker to attach
 * the correct beam destination when `requiresBeam` is true and `beamTarget`
 * is not explicitly set.
 */
export const TARGET_TO_BEAM: Partial<Record<NexTarget, GuidanceTargetId>> = {
  "voice-button": "voice-button",
  "discovery":    "header-menu",   // menu currently routes to /discovery
  "profile":      "rail-profile",
  "favorites":    "rail-favorites",
  "history":      "rail-history",
  "services":     "rail-services",
  "food":         "rail-food",
  "search":       "header-search",
  "notifications":"header-alerts",
  "menu":         "header-menu",
  "composer":     "composer-input",
  "send-button":  "send-button",
  "context-card": "context-card",
  "workspace":    "workspace",
  "food-card":    "food-card-first",
};

/**
 * Familiarity buckets for a given target. Drives which pool the picker
 * prefers (new user → intro pool · returning → familiar pool · experienced
 * → micro pool). Thresholds are tunable per target.
 */
export type NexFamiliarity = "new" | "returning" | "experienced";

export function familiarityFrom(explanationCount: number): NexFamiliarity {
  if (explanationCount <= 1) return "new";
  if (explanationCount <= 5) return "returning";
  return "experienced";
}
