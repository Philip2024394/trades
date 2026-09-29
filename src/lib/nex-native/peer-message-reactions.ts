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
