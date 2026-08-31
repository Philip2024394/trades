// src/lib/nex/brain/personalization.ts
//
// Stage 3.27 · Phase 20 · Personalization (Philip 2026-08-31).
//
// Consumer of Long-Term Memory. When a user returns with consent +
// established preferences, produces a personalization signal so the
// composer can acknowledge continuity ("Welcome back — I remember
// you like X"). Never fabricates a preference the LTM doesn't hold.
//
// v1 discipline:
//   · Deterministic decision · no LLM
//   · Reads LTM snapshot (already consent-gated at LTM layer)
//   · Fires only when interactionCount ≥ 2 (skip first visit)
//   · Fires only when at least one preference has count ≥ 2 (real
//     signal · not one-off)
//   · Reports which preferences are "reinforced" (present in both
//     current session slots AND LTM) vs newly-observed
//   · Signal attached to response for composer to consume (v1
//     observational · composer optionally prepends greeting)
//   · Never claims LTM has data it doesn't · every referenced preference
//     is a real LTM entry

import type { LongTermPreferences } from "./long-term-memory";
import type { AccommodationSlots } from "./accommodation-slots";

export type PersonalizationKind =
  | "returning_user_ack"        // "Welcome back — I remember you like X"
  | "preference_reinforced"     // current session confirms a long-term preference
  | "none";                     // no signal

export type PersonalizationSignal =
  | {
      kind: "returning_user_ack" | "preference_reinforced";
      /** Optional greeting the composer may prepend on the first
       *  accommodation turn of a new conversation. */
      greeting?: string;
      /** Preferences the composer can lean on (present in LTM with
       *  count ≥ 2 · reinforced when also in current slots). */
      preferences: Array<{
        dimension: "location" | "type" | "budget" | "area";
        canonical: string;
        count: number;
        reinforcedByCurrentTurn: boolean;
      }>;
      reason: string;
    }
  | {
      kind: "none";
      reason: string;
    };

export type PersonalizationReport = {
  signal: PersonalizationSignal;
  interactionCount: number;
  isReturningUser: boolean;
};

export type PersonalizationInput = {
  longTermMemory: LongTermPreferences | null;
  currentSlots?: Readonly<AccommodationSlots>;
  /** True on the first accommodation turn of THIS conversation (session
   *  had no accommodation slots before this turn) · gates greeting. */
  isFirstAccommodationTurnThisConversation: boolean;
};

const MIN_INTERACTIONS = 2;
const MIN_PREFERENCE_COUNT = 2;

export function decidePersonalization(input: PersonalizationInput): PersonalizationReport {
  const ltm = input.longTermMemory;

  // No LTM → no personalization.
  if (!ltm) {
    return {
      signal: { kind: "none", reason: "no long-term memory · user is anonymous or unconsented" },
      interactionCount: 0,
      isReturningUser: false,
    };
  }

  const interactionCount = ltm.interactionCount;
  const isReturningUser = interactionCount >= MIN_INTERACTIONS;

  if (!isReturningUser) {
    return {
      signal: { kind: "none", reason: `first-time user (interactionCount=${interactionCount} < ${MIN_INTERACTIONS})` },
      interactionCount,
      isReturningUser: false,
    };
  }

  // Collect preferences with count ≥ threshold.
  type Pref = { dimension: "location" | "type" | "budget" | "area"; canonical: string; count: number };
  const prefsRaw: Pref[] = [];
  if (ltm.locationPreference && ltm.locationPreference.count >= MIN_PREFERENCE_COUNT) {
    prefsRaw.push({ dimension: "location", canonical: ltm.locationPreference.canonical, count: ltm.locationPreference.count });
  }
  if (ltm.typePreference && ltm.typePreference.count >= MIN_PREFERENCE_COUNT) {
    prefsRaw.push({ dimension: "type", canonical: ltm.typePreference.canonical, count: ltm.typePreference.count });
  }
  if (ltm.budgetPreference && ltm.budgetPreference.count >= MIN_PREFERENCE_COUNT) {
    prefsRaw.push({ dimension: "budget", canonical: ltm.budgetPreference.canonical, count: ltm.budgetPreference.count });
  }
  if (ltm.areaPreference && ltm.areaPreference.count >= MIN_PREFERENCE_COUNT) {
    prefsRaw.push({ dimension: "area", canonical: ltm.areaPreference.canonical, count: ltm.areaPreference.count });
  }

  if (prefsRaw.length === 0) {
    return {
      signal: { kind: "none", reason: "returning user but no preferences with count ≥ 2 yet" },
      interactionCount,
      isReturningUser: true,
    };
  }

  // Mark preferences reinforced by this turn (LTM value matches current session slot).
  const preferences = prefsRaw.map((p) => {
    const currentVal = input.currentSlots?.[p.dimension] as string | undefined;
    return {
      ...p,
      reinforcedByCurrentTurn: currentVal !== undefined && currentVal.toLowerCase() === p.canonical.toLowerCase(),
    };
  });
  const anyReinforced = preferences.some((p) => p.reinforcedByCurrentTurn);

  // Greeting fires only on the FIRST accommodation turn of THIS conversation ·
  // otherwise we'd spam every turn with "welcome back". Assemble a natural
  // English phrase: "[budget] [type]s in [Location] near [Area]".
  let greeting: string | undefined;
  if (input.isFirstAccommodationTurnThisConversation) {
    const byDim = (dim: "budget" | "type" | "location" | "area") =>
      preferences.find((p) => p.dimension === dim)?.canonical;
    const budget = byDim("budget");
    const type = byDim("type");
    const location = byDim("location");
    const area = byDim("area");
    const parts: string[] = [];
    if (budget) parts.push(budget);
    if (type) parts.push(type === "kos" ? "kos-kosan" : `${type}s`);
    if (location) parts.push(`in ${capitalize(location).replace(/-/g, " ")}`);
    if (area) parts.push(`near ${capitalize(area)}`);
    const phrase = parts.length > 0 ? parts.join(" ") : preferences.map((p) => p.canonical).join(", ");
    greeting = `Welcome back — I remember you tend to look for ${phrase}.`;
  }

  return {
    signal: {
      kind: anyReinforced ? "preference_reinforced" : "returning_user_ack",
      greeting,
      preferences,
      reason: greeting
        ? `first accommodation turn this conversation · surfacing ${preferences.length} preference${preferences.length === 1 ? "" : "s"}`
        : `subsequent turn · preferences available but greeting suppressed to avoid spam`,
    },
    interactionCount,
    isReturningUser: true,
  };
}

function capitalize(s: string): string {
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}
