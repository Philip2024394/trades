// The Yard reactions — shared metadata + helpers. Order here drives the
// order the reaction buttons appear inside YardReactionBar.

import type { YardReactionKind } from "@/lib/supabase";

export const YARD_REACTION_KINDS: readonly YardReactionKind[] = [
  "like",
  "fire",
  "strong",
  "lol",
  "wow",
  "dislike"
] as const;

export const YARD_REACTION_EMOJI: Record<YardReactionKind, string> = {
  like: "👍",
  fire: "🔥",
  strong: "💪",
  lol: "😂",
  wow: "😮",
  dislike: "👎"
};

export const YARD_REACTION_LABEL: Record<YardReactionKind, string> = {
  like: "Like",
  fire: "Fire",
  strong: "Strong",
  lol: "Lol",
  wow: "Wow",
  dislike: "Dislike"
};

export type ReactionCounts = Partial<Record<YardReactionKind, number>>;
