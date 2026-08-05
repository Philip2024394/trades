// Fact extractor for the Living Demonstration prototype.
//
// Selective memory (Philip 2026-08-05): NEX must NOT remember every
// message. Universal memory teaches "NEX stores everything" — feels
// mechanical. Selective memory teaches "NEX understands what is worth
// remembering" — feels intelligent. When a message is not a fact,
// this returns null and no Living Memory expression forms. That is
// the "aha" moment — the user realises NEX kept only useful things.

export type ExtractedFact = {
  key: string;
  value: string;
};

const PATTERNS: Array<{ re: RegExp; toFact: (m: RegExpMatchArray) => ExtractedFact }> = [
  {
    re: /^my favourite\s+([\w\s-]+?)\s+(?:is|are)\s+(.+?)[.!?]?$/i,
    toFact: (m) => ({ key: `Favourite ${m[1].trim().toLowerCase()}`, value: m[2].trim() })
  },
  {
    re: /^my favorite\s+([\w\s-]+?)\s+(?:is|are)\s+(.+?)[.!?]?$/i,
    toFact: (m) => ({ key: `Favorite ${m[1].trim().toLowerCase()}`, value: m[2].trim() })
  },
  {
    re: /^i (?:really\s+)?(?:like|love|enjoy)\s+(.+?)[.!?]?$/i,
    toFact: (m) => ({ key: "Likes", value: m[1].trim() })
  },
  {
    re: /^i prefer\s+(.+?)[.!?]?$/i,
    toFact: (m) => ({ key: "Prefers", value: m[1].trim() })
  },
  {
    re: /^my name is\s+(.+?)[.!?]?$/i,
    toFact: (m) => ({ key: "Name", value: m[1].trim() })
  },
  {
    re: /^i(?:'m| am)\s+(?:a|an)\s+(.+?)[.!?]?$/i,
    toFact: (m) => ({ key: "Role", value: m[1].trim() })
  },
  {
    re: /^i work (?:as|in)\s+(.+?)[.!?]?$/i,
    toFact: (m) => ({ key: "Work", value: m[1].trim() })
  },
  {
    re: /^i(?:'m| am) working on\s+(.+?)[.!?]?$/i,
    toFact: (m) => ({ key: "Working on", value: m[1].trim() })
  },
  {
    re: /^i live in\s+(.+?)[.!?]?$/i,
    toFact: (m) => ({ key: "Lives in", value: m[1].trim() })
  },
  {
    re: /^i(?:'m| am)\s+(.+?)[.!?]?$/i,
    toFact: (m) => ({ key: "Is", value: m[1].trim() })
  }
];

export function extractFact(text: string): ExtractedFact | null {
  const trimmed = text.trim();
  for (const { re, toFact } of PATTERNS) {
    const m = trimmed.match(re);
    if (m) return toFact(m);
  }
  return null;
}
