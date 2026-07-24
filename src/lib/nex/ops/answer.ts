// OPS answer router — routes "morning briefing" style asks.

import { buildMorningBriefing } from "./briefing";

export type OpsQuestion =
  | { kind: "morning_briefing" }
  | { kind: "none" };

export function classifyOpsQuestion(text: string): OpsQuestion {
  const t = text.toLowerCase().trim();
  if (!t) return { kind: "none" };

  if (/\bmorning\s+nex\b|\bgood\s+morning\s+nex\b/.test(t)
   || /\bwhat'?s\s+today\s+looking\s+like\b/.test(t)
   || /\bmorning\s+briefing\b/.test(t)
   || /\brun\s+my\s+business\b/.test(t)
   || /\bprepare\s+today'?s\s+work\b/.test(t)) {
    return { kind: "morning_briefing" };
  }
  return { kind: "none" };
}

export type AnswerOpsInput = {
  question:     OpsQuestion;
  merchantSlug: string;
};

export async function answerOps(input: AnswerOpsInput): Promise<string> {
  switch (input.question.kind) {
    case "morning_briefing": {
      const res = await buildMorningBriefing({ merchantSlug: input.merchantSlug });
      if (!res.ok) return "Your listing isn't set up yet — I can't build a morning briefing.";
      return res.briefing.speak;
    }
    case "none":
      return "";
  }
}
