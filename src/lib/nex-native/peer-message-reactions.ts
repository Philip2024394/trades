// src/lib/nex-native/peer-message-reactions.ts
//
// Bridge 66 · Client-safe reactions constants + types.
// ----------------------------------------------------
// Split from peer-message-service.ts because that module carries
// `import "server-only"` (Supabase admin client is server-only).
// The whitelist + type shape are needed by both the client picker UI
// and the server toggle function — so they live here where both
// surfaces can import.

/** Emoji → array of account ids that reacted with it. Empty object
 *  when there are no reactions on the message. Insertion order for
 *  arrays is preserved by Postgres JSONB; object-key order is not,
 *  so clients render in a stable ordering (alphabetical or map order). */
export type NexPeerMessageReactions = Record<string, string[]>;

/** Quick-picker emoji set · matches the reactions users hit most on
 *  every modern messenger. Adding an entry here immediately makes it
 *  selectable in the picker + accepted by toggleMessageReaction. */
export const NEX_PEER_MESSAGE_QUICK_REACTIONS: readonly string[] = [
  "❤️",
  "👍",
  "😂",
  "😮",
  "😢",
  "🙏",
];

/** Shape of a theme-emoji reaction key: `:slug:` · e.g. `:joker-01:`.
 *  Slug body is bounded (1-63 chars) because the key is persisted into
 *  the `nex_peer_message.reactions` JSONB and must not accept arbitrary
 *  client-supplied strings. */
const THEME_EMOJI_SLUG_RE = /^:[a-z0-9][a-z0-9_-]{0,62}:$/i;

/** True when `key` is a theme-emoji reaction in `:slug:` form.
 *  Bridge ThemeEmoji-C · used by the chip row to decide whether a
 *  reaction renders as an <img> tile instead of literal text. */
export function isThemeEmojiReaction(key: string): boolean {
  return typeof key === "string" && THEME_EMOJI_SLUG_RE.test(key);
}

/** True when `emoji` is accepted by the server toggle path.
 *  Bridge ThemeEmoji · accepts EITHER a unicode glyph on the quick-
 *  reaction whitelist OR a well-formed `:slug:` theme-emoji key, so
 *  per-theme reactions flow through the same storage without a schema
 *  change. Anything else is rejected so an untrusted client cannot
 *  stuff arbitrary strings into the reactions JSONB. */
export function isValidReactionEmoji(emoji: string): boolean {
  return (
    NEX_PEER_MESSAGE_QUICK_REACTIONS.includes(emoji) ||
    isThemeEmojiReaction(emoji)
  );
}
