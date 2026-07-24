// User expertise classifier for Nex Staircase chat.
//
// Purpose: distinguish a homeowner (who needs plain English + definitions
// of trade terms) from a manufacturer or joiner (who uses trade vocab
// fluidly and would be insulted by beginner explanations). Nex adapts
// tone accordingly — both audiences must feel Nex speaks THEIR language.
//
// Detection is signal-based, not asked. Runs across the user's messages
// so far and settles after ~3-4 messages of interaction. Returns a
// three-level classification plus the specific signals used, so the
// UI can display + let the user override.

export type ExpertiseLevel = "unknown" | "homeowner" | "trade";

export type ExpertiseResult = {
  level:      ExpertiseLevel;
  confidence: number;           // 0-1
  signals:    string[];         // human-readable signals that fired
  score:      number;           // raw score for debugging
};

// Trade vocabulary — words that homeowners rarely use unprompted.
// Each word scores 1 point. Rare technical terms score 2.
const TRADE_VOCABULARY: Array<[RegExp, number, string]> = [
  // Core stair components — score 1
  [/\btread(s)?\b/i,             1, "'tread'"],
  [/\briser(s)?\b/i,             1, "'riser'"],
  [/\bstring(s)?\b/i,            1, "'string'"],
  [/\bgoing\b/i,                 1, "'going'"],
  [/\brise\b/i,                  1, "'rise'"],
  [/\bnosing(s)?\b/i,            1, "'nosing'"],
  [/\bspindle(s)?\b/i,           1, "'spindle'"],
  [/\bbaluster(s)?\b/i,          1, "'baluster'"],
  [/\bnewel(s)?\b/i,             1, "'newel'"],
  [/\bhandrail(s)?\b/i,          1, "'handrail'"],
  [/\bbalustrade(s)?\b/i,        1, "'balustrade'"],
  // More technical terms — score 2
  [/\bwreath(ed)?\b/i,           2, "'wreath'"],
  [/\bvolute\b/i,                2, "'volute'"],
  [/\bcut[- ]string\b/i,         2, "'cut string'"],
  [/\bhoused[- ]string\b/i,      2, "'housed string'"],
  [/\bopen[- ]riser\b/i,         2, "'open riser'"],
  [/\bwinder(s)?\b/i,            2, "'winder'"],
  [/\bkite\b/i,                  2, "'kite'"],
  [/\btrimmer(s)?\b/i,           2, "'trimmer'"],
  [/\bcarriage\b/i,              2, "'carriage'"],
  [/\bbullnose\b/i,              2, "'bullnose'"],
  [/\bcurtail\b/i,               2, "'curtail'"],
  [/\bbaserail\b/i,              2, "'baserail'"],
  [/\bfillet(s)?\b/i,            2, "'fillet'"],
  [/\bpitch line\b/i,            2, "'pitch line'"],
  [/\bscotia\b/i,                2, "'scotia'"],
  [/\bmitre(d)?\b/i,             2, "'mitre'"],
  [/\bhoused joint\b/i,          2, "'housed joint'"],
  [/\bglue block(s)?\b/i,        2, "'glue block'"],
  [/\bwedge(s|d)?\b/i,           1, "'wedge'"],
  [/\bscarf joint\b/i,           2, "'scarf joint'"],
  [/\brail bolt\b/i,             2, "'rail bolt'"],
  [/\bmortise\b/i,               2, "'mortise'"],
  [/\btenon\b/i,                 2, "'tenon'"],
  [/\bhousing(s)?\b/i,           1, "'housing'"],
  [/\bkiln[- ]dried\b/i,         2, "'kiln-dried'"],
  [/\bjanka\b/i,                 2, "'Janka'"],
  [/\blbf\b/i,                   2, "'lbf'"],
  // Trade process language — score 1
  [/\bfirst[- ]fix\b/i,          1, "'first-fix'"],
  [/\bsecond[- ]fix\b/i,         1, "'second-fix'"],
  [/\bsite measure\b/i,          1, "'site measure'"],
  [/\bsnag(s|ging|ged)?\b/i,     1, "'snag'"],
  [/\bspec(ification|'d)?\b/i,   1, "'spec'"],
  [/\bquote(s|d)?\b/i,           1, "'quote'"],
  // Regulations — score 3 (strong signal of pro)
  [/\bapproved doc(ument)?\b/i,  3, "'Approved Document'"],
  [/\bpart k\b/i,                3, "'Part K'"],
  [/\bpart m\b/i,                3, "'Part M'"],
  [/\bpart b\b/i,                3, "'Part B'"],
  [/\bbs\s?\d/i,                 3, "British Standard reference"],
  [/\bregs\b/i,                  2, "'regs'"],
  [/\bbuilding regs\b/i,         2, "'building regs'"],
  [/\bbuilding control\b/i,      2, "'building control'"],
  [/\bfd30\b/i,                  3, "'FD30'"],
  // Dimensional / technical specificity
  [/\d+mm\b/,                    1, "millimetre dimension"],
  [/\bM\d{1,2}\b/,               2, "M-size bolt reference"]
];

// Words that suggest a homeowner needing plain English
const HOMEOWNER_MARKERS: RegExp[] = [
  /\bhow do (i|you)\b/i,
  /\bwhat (is|are) (a|the)\b/i,
  /\bexplain\b/i,
  /\bi don't (know|understand)\b/i,
  /\bno idea\b/i,
  /\bcan you tell me\b/i,
  /\bi'?m (looking|thinking) (of|about)\b/i,
  /\bmy staircase\b/i,
  /\bmy house\b/i,
  /\bnever heard\b/i
];

/** Classify user expertise across the message history so far.
 *  Returns "unknown" if there's not enough signal (fewer than 2 messages
 *  or very short messages). "homeowner" or "trade" once the score
 *  crosses respective thresholds. */
export function classifyExpertise(userMessages: string[]): ExpertiseResult {
  if (userMessages.length === 0) {
    return { level: "unknown", confidence: 0, signals: [], score: 0 };
  }

  const combined = userMessages.join("\n");
  const uniqueSignals = new Set<string>();
  let tradeScore = 0;
  let homeownerScore = 0;

  for (const [regex, weight, label] of TRADE_VOCABULARY) {
    if (regex.test(combined)) {
      tradeScore += weight;
      uniqueSignals.add(label);
    }
  }

  for (const regex of HOMEOWNER_MARKERS) {
    if (regex.test(combined)) homeownerScore += 1;
  }

  // Very short messages don't give us enough to classify confidently
  const totalChars = combined.length;
  const messageCount = userMessages.length;

  // Not enough content for confident classification
  if (totalChars < 30 || messageCount < 2) {
    if (tradeScore >= 3) {
      return {
        level: "trade",
        confidence: 0.6,
        signals: Array.from(uniqueSignals),
        score: tradeScore
      };
    }
    return {
      level: "unknown",
      confidence: 0.3,
      signals: Array.from(uniqueSignals),
      score: tradeScore
    };
  }

  // Trade classification thresholds
  if (tradeScore >= 6) {
    return {
      level: "trade",
      confidence: Math.min(0.95, 0.6 + tradeScore * 0.03),
      signals: Array.from(uniqueSignals),
      score: tradeScore
    };
  }
  if (tradeScore >= 3 && tradeScore > homeownerScore * 2) {
    return {
      level: "trade",
      confidence: 0.7,
      signals: Array.from(uniqueSignals),
      score: tradeScore
    };
  }

  // Otherwise treat as homeowner — safer default (over-explaining is
  // better than talking above someone's head)
  return {
    level: "homeowner",
    confidence: homeownerScore > 0 ? 0.75 : 0.5,
    signals: Array.from(uniqueSignals),
    score: tradeScore
  };
}

/** Build the additional system prompt fragment for the LLM composer
 *  based on the detected expertise level. Prepended to the base prompt
 *  so it modifies Nex's tone WITHOUT changing her rules. */
export function expertisePromptAddendum(level: ExpertiseLevel): string {
  switch (level) {
    case "trade":
      return `
## USER EXPERTISE — TRADE PROFESSIONAL (detected)
The person asking is a manufacturer, joiner, or trade professional. Adjust your tone accordingly:
- Use trade vocabulary freely without defining basic terms (tread, riser, string, going, rise, nosing, spindle, newel, wreath, etc.) — they know these.
- Cite regulations by paragraph and section without over-explanation ("Approved Doc K 1.10" is enough — no need to spell out what Doc K is).
- Assume knowledge of standard sizes, trade suppliers, and workshop practice.
- Give technical depth on the first response. Don't dumb down.
- Use trade shorthand freely ("32mm string housing", "M12 through-bolt", "FD30 hatch").
- Skip the "what is this?" preamble. Answer the actual question at the level asked.
- Do NOT patronise. This person likely knows more about their specific specialism than you do — approach as peer, not teacher.`;
    case "homeowner":
      return `
## USER EXPERTISE — HOMEOWNER (detected)
The person asking is a homeowner with little or no trade background. Adjust your tone accordingly:
- Define trade terms the first time you use them, briefly and warmly. "Tread — that's the flat part you step on" not "the tread is the horizontal component of the step".
- Explain WHY things matter for their family and their house, not just WHAT the rule is.
- Use analogies where they help. Compare hardness to gym-floor timber, wear to shoe soles marking a surface, dimensions to everyday objects.
- Avoid stacking regs references. One or two is enough — cite the paragraph but explain what it means for them.
- Reassure where useful. If they're worried about a decision, tell them plainly whether it's a small thing or a big thing.
- Never talk down. Warm, direct, helpful — like a friend who happens to know staircases.
- Confirm you've understood their situation before diving into detail.`;
    case "unknown":
    default:
      return `
## USER EXPERTISE — NOT YET DETERMINED
Not enough signal yet to classify the user as homeowner or trade. Default to accessible language with brief trade-term definitions the first time you use them. Watch for signals in future messages to refine tone.`;
  }
}
