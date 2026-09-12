// src/lib/nex/language/stopwords-en-gb.ts
//
// Common English stopwords · UK bias. Not exhaustive · Wiktionary import will
// widen this. Purpose: strip filler before intent scoring so "add a thingy for
// the search" isn't out-weighed by "a" · "for" · "the".

export const STOPWORDS_EN_GB: ReadonlySet<string> = new Set([
  "a", "an", "the", "and", "or", "but", "so", "then", "yet",
  "of", "at", "by", "for", "from", "in", "into", "on", "onto", "to", "with", "without", "as",
  "is", "are", "was", "were", "be", "been", "being", "am",
  "do", "does", "did", "doing", "done",
  "have", "has", "had", "having",
  "i", "you", "he", "she", "we", "they", "it", "me", "him", "her", "us", "them",
  "my", "your", "his", "our", "their", "its",
  "this", "that", "these", "those",
  "just", "only", "also", "even", "very", "quite", "rather", "really", "actually",
  "please", "thanks", "thank",
  "ok", "okay", "yeah", "yep", "nope", "nah",
  // Greetings deliberately excluded · they signal small_talk intent when
  // used alone. In longer utterances they add negligible noise.
]);
