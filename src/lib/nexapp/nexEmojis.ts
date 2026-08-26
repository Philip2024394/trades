// NEX Reaction Palette · owned emoji vocabulary for chat bubble reactions.
//
// Doctrine (Philip 2026-08-25):
//   · NEX has its OWN reaction language · not the WhatsApp / Telegram / iMessage
//     generic keyboard. This palette is intentionally limited (~40 emojis).
//   · Every emoji here is expressive · reads at 20px · and maps to a discrete
//     emotional signal NEX can interpret when aggregating reactions.
//   · One reaction type per person per message · aggregated into chip + count
//     (e.g. `🔥 7`) · never a stack of duplicate emojis.
//   · Adding to this palette = deliberate identity decision · not "throw more
//     emojis in". If a category is missing, discuss before extending.
//
// Ordering matters: the tray renders top-to-bottom so the most common signals
// (approval / love / laughter / fire) sit at the top for one-tap access. The
// deeper, more specific emotions (skeptical / worried / celebrating) sit below.

export type NexEmoji = {
  emoji: string;         // stable key · also the fallback glyph if no imageUrl
  label: string;         // ARIA label · never displayed
  category: NexEmojiCategory;
  /** Optional custom image URL. When present, the tray + reaction chip render
   *  this image instead of the unicode glyph. Reserved for NEX mascot
   *  reactions (signature identity · not generic replacements). */
  imageUrl?: string;
  /** Bubble-only landing animation · fires on the reaction chip when the
   *  user posts this emoji. Defaults to "pop" if omitted. */
  animation?: NexBubbleAnimation;
  /** Full-screen milestone animation · reserved for milestone-flavour
   *  reactions (birthday · wedding · anniversary · celebration). Fires ONCE
   *  on post · never gated to a bubble. If omitted, no full-screen effect. */
  fullScreen?: NexFullScreenEffect;
};

export type NexEmojiCategory = "nex";

// 8 bubble-only animations · runs on the reaction chip on the bubble only.
// Never hijacks the chat window. Assign one per emoji.
export type NexBubbleAnimation =
  | "pop"       // scale from 0 with soft overshoot (universal default)
  | "drop"      // falls in from above with gravity bounce (weight)
  | "ripple"    // fades in with orange ring pulsing outward (energy)
  | "flyin"     // sails in from tray direction (continuity)
  | "sparkle"   // pop + 6 orange sparkles bursting outward (playful/rewarding)
  | "wobble"    // pops in then wobbles like jelly (playful)
  | "glow"      // fades in with warm halo pulse (elegant · approval)
  | "flip";     // 3D Y-axis flip landing (dramatic · authoritative)

// 3 full-screen milestone effects · reserved for congratulations moments.
// Never fired on every reaction. Attach only to emojis whose meaning is a
// milestone (celebration · birthday · anniversary).
export type NexFullScreenEffect =
  | "confetti"  // 60 colored pieces cascade for 2.4s (celebration)
  | "fireworks" // 3 firework bursts at random screen points (birthday)
  | "hearts";   // 20 hearts float up-screen (anniversary · love-milestone)

// Default animation when an emoji doesn't declare one · used as fallback so
// every reaction always has SOME landing animation (matches Philip's spec).
export const DEFAULT_ANIMATION: NexBubbleAnimation = "pop";

export const NEX_REACTIONS: readonly NexEmoji[] = [
  // ── NEX signature mascot reactions · always render first ──────────────
  // Same yellow spiky-hair character · different states · Philip 2026-08-25.
  // The `emoji` field carries a stable code (nex-*) so reactions persist even
  // if the imageUrl rotates. `label` describes the state for screen readers.
  // Animation guide for future additions (Philip 2026-08-25 · pending 70-emoji upload):
  //   celebration / party / cheers        → animation: "sparkle"  + fullScreen: "confetti"
  //   birthday / cake                     → animation: "wobble"   + fullScreen: "fireworks"
  //   love / anniversary / heart-mascot   → animation: "glow"     + fullScreen: "hearts"
  //   approval / thumbs / respect         → animation: "pop"      (no full-screen)
  //   laughter / mischief / cheeky        → animation: "sparkle"  (no full-screen)
  //   thinking / examining / listening    → animation: "ripple"   (no full-screen)
  //   authority / boss / crown            → animation: "flip"     (no full-screen)
  //   sad / crying                        → animation: "drop"     (gravity feels right)
  //   surprised / shocked / mind-blown    → animation: "flyin"    (dramatic entry)
  //   general default                     → animation: "pop"

  { emoji: "nex-laugh",   label: "laughing NEX",  category: "nex",
    animation: "sparkle",
    imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdf-removebg-preview.png" },
  { emoji: "nex-approve", label: "thumbs up NEX", category: "nex",
    animation: "pop",
    imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfd-removebg-preview.png" },
  { emoji: "nex-boss",    label: "boss NEX",      category: "nex",
    animation: "flip",
    imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsf-removebg-preview.png" },
] as const;

// Lookup by emoji key · used by chip renderers to find imageUrl / label /
// animation / fullScreen. Sources from the NEX_ACTIONS registry (single
// source of truth · F1 doctrine) with fallback to the legacy NEX_REACTIONS
// list for the three original mascots that predate F1.
import { NEX_ACTIONS } from "@/lib/nex-actions/registry";

const LEGACY_INDEX = new Map<string, NexEmoji>();
for (const r of NEX_REACTIONS) LEGACY_INDEX.set(r.emoji, r);

export function getReactionByKey(key: string): NexEmoji | undefined {
  const fromRegistry = NEX_ACTIONS.find((a) => a.id === key);
  if (fromRegistry) {
    return {
      emoji: fromRegistry.id,
      label: fromRegistry.mascot.label,
      category: "nex",
      imageUrl: fromRegistry.mascot.imageUrl,
      animation: fromRegistry.animation,
      fullScreen: fromRegistry.fullScreen,
    };
  }
  return LEGACY_INDEX.get(key);
}

// Aggregated reaction state per message. One entry per emoji.
export type MessageReaction = {
  emoji: string;
  count: number;      // total across all users
  iReacted: boolean;  // did the current user contribute?
};
export type MessageReactions = Record<string, MessageReaction>;

// Toggle logic · one reaction of each type per user per message.
//   · If the user already reacted → remove them (decrement · delete if 0)
//   · If not → add them (increment · create if missing)
// Pure function · deterministic · easy to test.
export function toggleReaction(
  current: MessageReactions,
  emoji: string,
): MessageReactions {
  const existing = current[emoji];
  const next = { ...current };
  if (existing?.iReacted) {
    const newCount = existing.count - 1;
    if (newCount <= 0) {
      delete next[emoji];
    } else {
      next[emoji] = { emoji, count: newCount, iReacted: false };
    }
  } else {
    const newCount = (existing?.count ?? 0) + 1;
    next[emoji] = { emoji, count: newCount, iReacted: true };
  }
  return next;
}
