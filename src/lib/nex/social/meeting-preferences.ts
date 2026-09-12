// src/lib/nex/social/meeting-preferences.ts
//
// NEX Social · meeting-preference enum + display metadata
// Philip 2026-09-07 · Phase Social §13
//
// A meeting preference is "what kind of first meeting this person is
// open to." Distinct from general interests. Kept as a pure module so
// UI, tests and future server code can share the same list.

export type MeetingPreferenceId =
  | "meal"
  | "drink"
  | "coffee"
  | "walk"
  | "office"
  | "club"
  | "fishing"
  | "golf"
  | "other";

export type MeetingPreference = {
  id: MeetingPreferenceId;
  label: string;
  emoji: string;
};

/** Ordered catalogue · never remove or reorder without an authorised
 *  slice · the order maps to display sequence + saved-state keys. */
export const MEETING_PREFERENCES: ReadonlyArray<MeetingPreference> = [
  { id: "meal",    label: "Meal",    emoji: "🍜" },
  { id: "drink",   label: "Drink",   emoji: "🍸" },
  { id: "coffee",  label: "Coffee",  emoji: "☕" },
  { id: "walk",    label: "Walk",    emoji: "🚶" },
  { id: "office",  label: "Office",  emoji: "🏢" },
  { id: "club",    label: "Club",    emoji: "🎵" },
  { id: "fishing", label: "Fishing", emoji: "🎣" },
  { id: "golf",    label: "Golf",    emoji: "⛳" },
  { id: "other",   label: "Other",   emoji: "✨" },
];

const MAP = new Map(MEETING_PREFERENCES.map((m) => [m.id, m]));

export function findMeetingPreference(id: MeetingPreferenceId): MeetingPreference | null {
  return MAP.get(id) ?? null;
}

/** Filter a mixed-string array to only valid ids. Never throws. */
export function normaliseMeetingPreferences(input: readonly string[] | undefined): MeetingPreferenceId[] {
  if (!input) return [];
  const out: MeetingPreferenceId[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const key = raw.toLowerCase() as MeetingPreferenceId;
    if (MAP.has(key) && !seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}
