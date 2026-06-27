// The Yard reactions — shared metadata + helpers. Order here drives the
// order the reaction buttons appear inside YardReactionBar.

import type { YardReactionKind } from "@/lib/supabase";

// Public reaction set shown on cards. Kept to like / dislike only —
// the simpler model maps cleanly to the trade audience's intent
// ("yes, useful" vs "no, not for me") and stops the bar reading as a
// social-media reaction strip. Old fire / strong / lol / wow reactions
// already in the DB still count toward totals but no new ones can be
// added — the maps below keep their labels so historical counts
// render correctly if any surface them.
export const YARD_REACTION_KINDS: readonly YardReactionKind[] = [
  "like",
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
