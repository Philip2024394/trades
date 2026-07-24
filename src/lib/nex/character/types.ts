// Nex Character Library — types.
//
// The library holds thousands of Nex's canonical replies. Each entry
// is a single intent (e.g. "count_to_million") with one or more
// interchangeable alternatives so Nex doesn't repeat itself. Runtime
// picks an alternative deterministically per (merchant, intent, day)
// so the same merchant sees the same reply within a day but variety
// across days.
//
// Volumes are separate JSON files under ./library/ so we can add
// categories in bulk without touching code.

import { z } from "zod";

// ─── Canonical category + tag vocabularies ─────────────────────

export const CATEGORIES = [
  "greeting", "goodbye", "thanks", "compliment", "personal",
  "identity", "humour", "love", "business", "security",
  "privacy", "credits", "plans", "marketing", "sales",
  "customer_service", "construction", "regulations", "legal",
  "motivation", "philosophy", "random", "easter_egg", "shopping",
  "safety", "relationships"
] as const;
export type Category = typeof CATEGORIES[number];

export const TONES = [
  "calm", "witty", "warm", "matter_of_fact", "encouraging",
  "reassuring", "advisor", "playful", "firm"
] as const;
export type Tone = typeof TONES[number];

export const TAGS = [
  "greeting", "goodbye", "humour", "construction", "privacy",
  "legal", "marketing", "pricing", "plans", "credits",
  "relationships", "philosophy", "motivation", "random",
  "easter_egg", "business", "customer_service", "regulations",
  "shopping", "safety", "identity", "trust", "learning"
] as const;
export type Tag = typeof TAGS[number];

// ─── The entry ─────────────────────────────────────────────────

export const CharacterEntrySchema = z.object({
  /** URL-safe stable id, e.g. "count_to_million". Two entries with the
   *  same intent are a bug. Loader throws on collision. */
  intent:       z.string().regex(/^[a-z0-9_]+$/),

  /** Match against inbound message. Multiple regex sources OR-ed. */
  patterns:     z.array(z.string()).min(1),

  /** Interchangeable replies. Runtime picks one per (merchant, day). */
  alternatives: z.array(z.string()).min(1),

  category:     z.enum(CATEGORIES),
  tone:         z.enum(TONES),
  tags:         z.array(z.enum(TAGS)).default([]),

  /** Higher priority beats lower when two patterns match. Default 1. */
  priority:     z.number().int().min(0).max(100).default(1),

  /** Bump when the entry's alternatives change so we can audit drift. */
  version:      z.number().int().min(1).default(1),

  /** Optional short note for reviewers. */
  notes:        z.string().optional()
});
export type CharacterEntry = z.infer<typeof CharacterEntrySchema>;

/** A single volume file's shape. */
export const VolumeSchema = z.object({
  volume_id:    z.string(),                  // "volume_00_core"
  title:        z.string(),
  description:  z.string().optional(),
  version:      z.number().int().min(1),
  entries:      z.array(CharacterEntrySchema)
});
export type Volume = z.infer<typeof VolumeSchema>;

/** Compiled runtime entry — patterns pre-parsed into RegExp. */
export type CompiledEntry = Omit<CharacterEntry, "patterns"> & {
  patterns:     RegExp[];
  volume_id:    string;
};
