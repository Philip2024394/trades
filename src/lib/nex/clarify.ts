// Nex clarification helper.
//
// When the merchant's prompt is too short or too vague for Nex to act
// on accurately, Nex asks for more information instead of guessing.
// Aligned with the Verified Knowledge policy — accuracy over speed.
//
// Pattern:
//   "To give you accurate information, could you tell me a bit more?
//    <one specific question>
//    This lets me give you a real answer instead of a guess."

const MIN_WORDS_FOR_ANSWER   = 3;   // "what is VAT" = 3 words → OK
const MIN_WORDS_FOR_RESEARCH = 4;   // "research UK VAT" = 3 words → too vague; "research UK VAT threshold 2026" = 5 → OK

/** Returns null when the prompt is clear enough, or a Clarification
 *  reply the caller can hand straight back to the merchant. */
export type ClarifyReply = {
  speak:        string;
  suggestions?: string[];
};

export function assessAnswerPrompt(topic: string): ClarifyReply | null {
  const t = topic.trim();
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= MIN_WORDS_FOR_ANSWER && t.length >= 8) return null;
  return {
    speak: [
      "To give you accurate information, could you tell me a bit more?",
      "",
      `What specifically do you want to know about "${t || "this"}"? For example, a trade, a size, a location, or a time period.`,
      "",
      "This lets me give you a real answer instead of a guess."
    ].join("\n"),
    suggestions: exampleAnswerPrompts(t)
  };
}

export function assessResearchPrompt(topic: string): ClarifyReply | null {
  const t = topic.trim();
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= MIN_WORDS_FOR_RESEARCH && t.length >= 12) return null;
  return {
    speak: [
      "To research this properly, I need a bit more to go on.",
      "",
      `Could you narrow "${t || "this"}" down? A trade, a country, a topic area, or a time period usually does it.`,
      "",
      "That way I can search official government sources for the right answer, not a rough one."
    ].join("\n"),
    suggestions: exampleResearchPrompts(t)
  };
}

/** Generic unknown-intent clarification. */
export function assessUnknownPrompt(original: string): ClarifyReply {
  const t = original.trim();
  return {
    speak: [
      "I'm not sure I understood that. Could you tell me a bit more so I can give you an accurate answer?",
      "",
      t.length > 0
        ? `You said: "${t}". Do you want me to design something, research a topic, or answer a trade question?`
        : "Tell me what you're trying to get done in one line.",
      "",
      "The more you tell me, the more accurate my answer will be."
    ].join("\n"),
    suggestions: ["Design my van", "Create a Facebook post", "Research UK staircase guidance", "Change my brand colour"]
  };
}

// ─── Example scaffolds ─────────────────────────────────────────

function exampleAnswerPrompts(topic: string): string[] {
  const t = topic.trim();
  if (t.length === 0) return ["What's the VAT threshold?", "How thick should skirting be?"];
  return [`What's the VAT threshold in ${t.length > 0 ? "the UK" : ""}?`.trim(), `How is ${t} regulated?`];
}

function exampleResearchPrompts(topic: string): string[] {
  const t = topic.trim();
  if (t.length === 0) {
    return ["Research UK staircase guidance", "Research CIS rules 2026"];
  }
  return [
    `Research UK ${t} regulations`,
    `Research ${t} best practice`
  ];
}
