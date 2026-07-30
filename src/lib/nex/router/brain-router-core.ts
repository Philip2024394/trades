// NEX Brain Router · CORE logic module
//
// Split from brain-router.ts on 2026-07-30 (Step 3 · testing) so that
// standalone test scripts can import the pure routing logic without
// pulling in the `import "server-only"` guard. The exported symbols here
// are identical to brain-router.ts · that file now re-exports from this
// one behind the server-only marker.
//
// Do NOT edit brain-router.ts to add logic. All logic lives here so the
// test corpus (scripts/nex-router-corpus-test.mts) always exercises the
// exact code path that ships to production.
//
// Deterministic keyword patterns · sub-10ms · zero LLM call · zero I/O.

// ─── Types ─────────────────────────────────────────────────────────────

export type BrainDestination = "reflex" | "emotion" | "expert" | "wisdom";

export interface RouteDecision {
  destination: BrainDestination;
  /** 0-100 · how confident the router is · ties break toward Wisdom (less risk of "too shallow"). */
  confidence: number;
  /** One-line human-readable rationale for the routing choice · used in observability + logs. */
  reason: string;
  /** Which specific signals matched · used for observability + future router accuracy analysis. */
  signals_matched: string[];
  /**
   * IMMUTABLE (Philip 2026-07-30): "WHEN UNSURE DO NOT GUESS THE BRAIN. DEFAULT TO WISDOM."
   * true = router could NOT confidently classify · destination is set to Wisdom as the safety
   * fallback · composer MUST use the clarifying opener (never a confident Wisdom answer).
   * false = router is confident in the destination.
   *
   * Philip's rule: "95% correct + 5% unknown" beats "99% correct + 1% wrong."
   * UNKNOWN is safe. Wrong is dangerous.
   */
  is_unknown_fallback: boolean;
}

// ─── Signal patterns ───────────────────────────────────────────────────
//
// Precedence rule (Philip 2026-07-30): emotion OVERRIDES all other signals.
// A message that includes ANY emotion pattern routes to Emotion regardless
// of technical or design content. Feeling comes BEFORE spec.

const EMOTION_PATTERNS: Array<{ pattern: RegExp; signal: string }> = [
  // Frustration / disappointment
  { pattern: /\b(hate|hated|hating|ruined|ruining|awful|terrible|nightmare|disaster)\b/i, signal: "frustration" },
  // "nobody listens" · "no one listens" · "not being heard" — homeowner frustration signal (Philip 2026-07-30)
  { pattern: /\b(nobody|no[- ]?one) (listens|is listening|hears|understands|will listen)\b/i, signal: "frustration" },
  { pattern: /\b(not being (heard|listened to)|no one (hears|listens to) me)\b/i, signal: "frustration" },

  { pattern: /\b(regret|regretting|second[- ]?guess|wish i (had|hadn'?t)|shouldn'?t have)\b/i, signal: "buyers_remorse" },

  // Expectation gap — broadened (Philip 2026-07-30 · added "nothing like I imagined/expected/wanted")
  { pattern: /\b(disappointed|let down|not what i (expected|wanted|imagined))\b/i, signal: "expectation_gap" },
  { pattern: /\b(looks?|looking) nothing like (i|what i) (expected|wanted|imagined|thought)\b/i, signal: "expectation_gap" },
  { pattern: /\bnothing like i (expected|wanted|imagined|thought|had in mind)\b/i, signal: "expectation_gap" },

  // Fear / safety
  { pattern: /\b(worried|worry|worrying|scared|afraid|frightened|fear|nervous)\b/i, signal: "fear" },
  { pattern: /\b(fell|falling|falls|dangerous|unsafe|not safe|feels? unsafe)\b/i, signal: "safety_concern" },

  // Trust / dispute
  // FIX (Philip 2026-07-30 corpus miss): "overcharg" boundary bug — added \w* so "overcharged" matches.
  { pattern: /\b(ripped off|rip[- ]?off|cheated|overcharg\w*|dishonest|scam|con(ned)?)\b/i, signal: "trust_concern" },
  // Trust question shape · "I don't know if my builder is right" (Philip 2026-07-30)
  { pattern: /\bi (don'?t know|am not sure) if (my |the |our )?(builder|installer|contractor|company|firm|quote|quotation|estimate|price) (is|was) (right|fair|correct|reasonable|ok|okay|honest)\b/i, signal: "trust_concern" },

  { pattern: /\b(builder|installer|contractor|company|firm)\b.{0,40}\b(mess|wrong|ruin|bad|awful|left me|isn'?t listening|won'?t)\b/i, signal: "trade_dispute" },
  // Trade dispute shape · "builder says X but I disagree" (Philip 2026-07-30)
  { pattern: /\b(builder|installer|contractor|company|firm) (says?|said|thinks?|reckons?)\b.{0,50}\b(but|however|though) (i|we) (disagree|don'?t agree|think otherwise|feel differently|are not sure|aren'?t sure|don'?t think so)\b/i, signal: "trade_dispute" },

  // Overwhelm / uncertainty
  // FIX (Philip 2026-07-30 corpus miss): "don't know what" was catching design discovery
  // ("I don't know what timber I like") — too greedy. Split into narrow overwhelm triggers
  // (action-paralysis) vs discovery (object-choice which now belongs to Wisdom).
  { pattern: /\bdon'?t know what to (do|think|choose|start|pick|say|begin|make of it)\b/i, signal: "overwhelm" },
  { pattern: /\bdon'?t know (which (way|to (start|begin))|where to (start|begin)|how to (start|begin|choose|decide))\b/i, signal: "overwhelm" },
  { pattern: /\b(no idea|confused|overwhelmed|too many (options|choices|decisions))\b/i, signal: "overwhelm" },

  { pattern: /\b(everyone|everybody) (gives|is giving|tells|is telling) me different\b/i, signal: "conflicting_advice" },

  // Family / life context
  { pattern: /\bmy (wife|husband|partner|kid|kids|child|children|son|daughter|dad|mum|father|mother|elderly parent|elderly (mum|mother|dad|father))\b/i, signal: "family_context" },
  { pattern: /\b(this is|it'?s) (our|my) forever home\b/i, signal: "emotional_investment" },

  // Urgency
  { pattern: /\b(urgent|urgently|before christmas|next week|by (next )?(monday|tuesday|wednesday|thursday|friday|weekend)|deadline|asap|need this (fixed|done|finished) (soon|quickly|today|tomorrow))\b/i, signal: "urgency" },
  // Broader urgency framing · "need X before/by Y"
  { pattern: /\b(need|want) (this|it|the (staircase|stairs)) (finished|done|fixed|ready|installed|sorted) (before|by|for) \w+\b/i, signal: "urgency" },

  // Money pressure / anxiety
  { pattern: /\b(cannot afford|can'?t afford|too expensive|out of budget|price is too|quote seems too high)\b/i, signal: "budget_pressure" },

  // Self / confidence
  { pattern: /\b(embarrass|embarrassed|ashamed|humiliat|feel stupid|feel silly)\b/i, signal: "confidence_issue" },

  // Stress · corpus fix 2026-07-30 · "the noise from the stairs stresses me out"
  // was routing to Expert (diagnosis_squeak) because "noise" hit first. Adding
  // stress family as an Emotion signal ensures emotion-overrides-all fires.
  { pattern: /\bstress(ed|ful|ing|es)?\b/i, signal: "stress" },
  { pattern: /\bstresses me (out|up)\b/i, signal: "stress" },
];

// Expert signals · technical judgement · diagnosis · specification
//
// Step 2 (Philip 2026-07-30 · Consciousness Layer): diagnostic symptom
// signals are broken out from the single "diagnosis_symptom" catch-all
// into six named symptom families. Router still classifies to Expert ·
// the finer signals feed observability + let the composer nudge the
// diagnosis frame ("this sounds like a movement issue" vs "this sounds
// like a fixing issue"). Rule B honoured: no CAUSE authored here · only
// the SHAPE of the customer's phrase.
const EXPERT_PATTERNS: Array<{ pattern: RegExp; signal: string }> = [
  // Diagnosis · "why does / why is"
  // Corpus fix 2026-07-30 · "what makes" was too greedy · caught aspiration
  // phrases like "what makes a staircase feel high end" (Wisdom) and routed
  // them to Expert. Now "what makes" only counts as diagnosis when a defect
  // symptom follows within 60 chars — otherwise it's likely an aspiration or
  // opinion shape and should fall through to Wisdom.
  { pattern: /\b(why (does|is|do|are)|what causes|what'?s causing)\b/i, signal: "diagnosis" },
  { pattern: /\bwhat makes\b.{0,60}\b(creak|creaks|creaking|squeak|squeaks|squeaking|noise|noisy|move|moving|wobble|wobbly|bounce|bouncy|flex|flexing|crack|cracks|cracking|split|splits|splitting|rot|rots|rotting|rotten|sag|sags|sagging|sunk|sink|sinks|sinking|gap|gaps|lift|lifts|lifting|separate|separates|separating|shake|shakes|shaky|fall|fails|failing|break|breaks|broken|damaged|worn|uneven|loose|come away|coming away|come apart|coming apart)\b/i, signal: "diagnosis" },

  // ─── Symptom families · Step 2 · Philip 2026-07-30 ────────────────

  // Sound · squeaks / creaks / noises when walking / at certain step
  { pattern: /\b(squeak|squeaks|squeaking|squeaky|creak|creaks|creaking|creaky|noisy|noise|noises|makes? (a )?(sound|noise|creak|squeak))\b/i, signal: "diagnosis_squeak" },

  // Movement · flex · bounce · wobble · shake · give way
  { pattern: /\b(bounces?|bouncy|flex(es|ing)?|gives? way|movement|moves|moving|shakes?|shaky|shaking|wobbl(y|es|ing|iness)|feels? (loose|unstable|unsteady)|is loose)\b/i, signal: "diagnosis_movement" },

  // Separation · gaps opening · pulling / coming away · lifting
  { pattern: /\b(gap|gaps|opening up|pulling away|pulled away|coming? away|came away|lifting|lifted|lift(s|ing)? off|separat(ing|ed)|coming? apart|split(ting)?)\b/i, signal: "diagnosis_separation" },

  // Damage / decay · cracks · rot · soft spot · sagging · sinking
  { pattern: /\b(crack|cracks|cracked|cracking|rot|rotted|rotting|rotten|soft (spot|wood|patch)|sagg(ed|ing|y)|sink(ing|s)?|sunken|worn through|damaged? (tread|riser|step|nosing|string))\b/i, signal: "diagnosis_damage" },

  // Uneven / inconsistent · one step different · not level
  { pattern: /\b(uneven|not level|one step (feels? |is )?(higher|lower|deeper|shallower|different|off)|steps? (are |feel )?different|inconsistent|out of (level|line)|slop(es|ing|ed))\b/i, signal: "diagnosis_uneven" },

  // Finish failure · paint peeling · varnish coming off · finish worn
  { pattern: /\b((paint|varnish|lacquer|finish|coating|stain) (peel(ing)?|flak(ing|es?)|crack(ing|ed|s)?|com(e|ing) off|wear(ing)? off|worn (off|through)?|chip(ping|ped)?))\b/i, signal: "diagnosis_finish_failure" },

  // Specification
  { pattern: /\b(how (thick|tall|wide|long|deep|high|big|small|many|much space))\b/i, signal: "specification" },
  { pattern: /\bwhat (size|thickness|width|depth|height|dimensions?)\b/i, signal: "specification" },

  // Regulations
  { pattern: /\b(regulation|regulations|regs|approved doc|compliance|compliant|legal|allowed|permitted|building control)\b/i, signal: "regulations" },
  { pattern: /\bpart k\b/i, signal: "regulations" },

  // Material suitability
  { pattern: /\b(mdf|plywood|chipboard|softwood|hardwood)\b.{0,30}\b(for|used?|use|suitable|okay|ok|works?|good)\b/i, signal: "material_suitability" },
  // "can X be painted / stained / carpeted / covered" — material treatment questions (Philip 2026-07-30)
  { pattern: /\bcan (mdf|plywood|chipboard|softwood|hardwood|oak|pine|beech|ash|walnut|(?:my |the |these |those )?(stairs?|staircase|treads?|risers?|steps?)) be (painted|stained|varnished|lacquered|oiled|waxed|carpeted|covered|clad|refinished|restored)\b/i, signal: "material_suitability" },

  // Capability / renovation — subject list broadened (Philip 2026-07-30 corpus fix)
  { pattern: /\bcan (i|we|this|it|my|the|these|those|stairs?|staircase|treads?|risers?|steps?|newels?|newel post|handrails?|balustrade|balusters?|spindles?|nosings?|strings?|carpet|mdf|plywood|chipboard) (be )?(use|used|remove|removed|replace|replaced|add|added|make|made|widen|narrow|repair|repaired|fix|fixed|move|moved|change|changed|paint|painted|clad|covered|converted|restored)\b/i, signal: "capability" },
  // "can X be made quieter / stronger / wider / safer" — capability shape
  { pattern: /\bcan (stairs?|staircase|steps?|treads?|risers?|it|this|my|the) be made (quieter|stronger|safer|wider|narrower|more secure|less noisy)\b/i, signal: "capability" },
  // "can X go over Y" — conversion / laying-over question
  { pattern: /\bcan (carpet|oak|treads?|stairs?|laminate|vinyl|wood|hardwood|softwood) go over\b/i, signal: "capability" },
  // "can I put X over/on Y" — same shape from user perspective (multi-word subject allowed)
  { pattern: /\bcan i (put|lay|fit|install|add) [\w ]{1,30}?(over|onto|on top of)\b/i, signal: "capability" },

  // "can <material> <part> be <verb>" — material treatment where the subject is two words
  // e.g., "can MDF stairs be painted" · "can oak treads be stained"
  { pattern: /\bcan (mdf|plywood|chipboard|oak|pine|beech|walnut|softwood|hardwood|solid wood|engineered wood) (stairs?|staircase|treads?|risers?|steps?|newels?|handrails?|balustrade|balusters?|spindles?) be (painted|stained|varnished|lacquered|oiled|waxed|carpeted|covered|clad|refinished|restored|used|painted over|repaired|fixed|replaced)\b/i, signal: "material_suitability" },

  // "what X should be used" — technical selection question (Philip 2026-07-30 corpus fix)
  { pattern: /\bwhat (screws?|nails?|adhesive|glue|paint|stain|varnish|finish|coating|timber|wood|material|sealant|filler|primer) should be used\b/i, signal: "install_detail" },

  // Survey / measurement / process
  { pattern: /\b(measure|measuring|measurement|survey|surveying|site check|site visit)\b/i, signal: "survey_process" },
  { pattern: /\b(installation|install|fitting|fitted|fit(s|ted)?)\b.{0,30}\b(problem|issue|going wrong|won'?t work|hasn'?t worked)\b/i, signal: "install_diagnosis" },
];

// Wisdom signals · choice · taste · recommendation · design intent · intent
//
// Priority 4 additions (Philip 2026-07-30 · Five-Priority Ordering):
// Intent family — Philip's explicit list: I want · I wish · could I ·
// would this · I'm trying to · what would you do. Homeowners rarely
// phrase design questions as "recommend me a staircase" — they phrase
// them as desires and possibilities.
const WISDOM_PATTERNS: Array<{ pattern: RegExp; signal: string }> = [
  // Direct recommendation seek (broadened subject list · Philip 2026-07-30)
  { pattern: /\bshould (i|we|my|the|this|it)\b/i, signal: "recommendation_seek" },
  { pattern: /\b(recommend|suggest|advise|help me (choose|decide|pick|figure out))\b/i, signal: "recommendation_seek" },
  { pattern: /\b(what would you (do|choose|pick|recommend)|what do you think|your opinion|your advice)\b/i, signal: "opinion_seek" },

  // Comparison
  { pattern: /\b(which (is|would be|one|option) (better|best|right))\b/i, signal: "comparison" },
  { pattern: /\b(vs\.?|versus|compare|comparison|difference between)\b/i, signal: "comparison" },
  { pattern: /\bor\b.{0,20}\bor\b/i, signal: "multi_option_choice" },

  // ─── Intent family · Priority 4 · Philip 2026-07-30 ────────────────

  // "I want ..." · direct desire · design intent shape
  // NOTE (Philip 2026-07-30): "I want" is a design intent signal even
  // without a follow-on taste word. The Wisdom brain handles the shape.
  { pattern: /\bi (want|wanted)\b/i, signal: "intent_desire" },

  // "I wish ..." · aspirational · often expresses gap between current + wanted
  { pattern: /\bi (wish|wished)\b/i, signal: "intent_wish" },

  // "could I ..." · possibility · design/renovation question shape
  // (Distinct from Expert "can I X" — this is softer, more speculative)
  { pattern: /\bcould (i|we|this|it|my|the) (be )?(have|get|make|do|use|try|change|add|include|fit|do it|do this)\b/i, signal: "intent_possibility" },

  // "would this ..." · exploring hypothetical
  { pattern: /\bwould (this|it|that|my|the) (be|look|feel|work|suit|match|fit|make)\b/i, signal: "intent_hypothetical" },

  // "I'm trying to ..." · goal-directed inquiry · often design/renovation intent
  { pattern: /\bi'?m trying to\b/i, signal: "intent_trying_to" },

  // "what would you ..." · opinion seek reframed
  { pattern: /\bwhat would you\b/i, signal: "intent_opinion_seek" },

  // Design intent · aspiration · taste
  { pattern: /\b(modern|traditional|contemporary|classic|luxury|premium|wow|feature|statement)\b/i, signal: "design_intent" },
  { pattern: /\b(expensive[- ]looking|look expensive|feel expensive|make it (look|feel) expensive)\b/i, signal: "aspiration_premium" },
  { pattern: /\b(cheap[- ]looking|look cheap|feel cheap)\b/i, signal: "aspiration_negative" },
  { pattern: /\b(wow staircase|centrepiece|centre piece|show[- ]stopping|statement piece)\b/i, signal: "aspiration_feature" },

  // Aspiration by reference · "like a hotel" · "like something out of X"
  // Homeowners often describe desired feel by pointing to a reference
  { pattern: /\blike a (hotel|show[- ]?home|showroom|magazine|catalogue|catalog)\b/i, signal: "aspiration_reference" },
  { pattern: /\b(stand out|standout|make (an|a) (entrance|impression|statement))\b/i, signal: "aspiration_feature" },

  // Perceived value / worth-it framing · Wisdom (judgement about investment)
  { pattern: /\b(worth it|worth (the )?(money|cost|price)|add(s|ing)? value|adds value)\b/i, signal: "aspiration_worth" },

  // Aesthetic disappointment · feeling-driven Wisdom question
  { pattern: /\b(feels? (boring|bland|plain|dated|old fashioned|old[- ]?fashioned))\b/i, signal: "aspiration_transformation" },

  // Timeless / classic · design intent
  { pattern: /\btimeless\b/i, signal: "design_intent" },

  // Context-fit recommendation
  { pattern: /\b(suits? my|for my (house|home|hallway|space|property))\b/i, signal: "context_recommendation" },
  { pattern: /\b(what (staircase|style|colour|wood|design)).{0,40}\b(for|suits?|would suit|would work|match)\b/i, signal: "context_recommendation" },

  // Colour / palette question · Wisdom
  { pattern: /\bwhat colou?r\b/i, signal: "design_choice" },

  // Design collaboration ("design my dream X" · "help me design")
  { pattern: /\b(design my|help me design|dream (staircase|stair))\b/i, signal: "creative_collaboration" },

  // Discovery / undecided
  { pattern: /\b(i don'?t know what|not sure what|help me figure out)\b.{0,40}\b(style|look|design|want|choose|timber|colou?r|wood)\b/i, signal: "discovery" },
];

// ─── The router ────────────────────────────────────────────────────────

/**
 * Classify a user message into a brain destination.
 *
 * Precedence (Philip 2026-07-30 · locked · UPDATED with IMMUTABLE UNKNOWN rule):
 *   1. Reflex (not handled here · Reflex has its own path in reflex-brain.ts)
 *   2. Emotion — if ANY emotion signal present, wins outright (feeling before spec)
 *   3. Expert dominant (E ≥ 1 and W = 0) → Expert
 *   4. Wisdom dominant (W ≥ 1 and E = 0) → Wisdom
 *   5. Weak dominance (|E − W| ≥ 2) → dominant brain
 *   6. Ambiguous (both nonzero and close, |E − W| < 2) → UNKNOWN → Wisdom (safety fallback)
 *   7. No signals at all → UNKNOWN → Wisdom (safety fallback)
 *
 * THE IMMUTABLE UNKNOWN RULE (Philip 2026-07-30):
 *   "WHEN UNSURE, DO NOT GUESS THE BRAIN. DEFAULT TO WISDOM."
 *   Wrong routing is dangerous. Unknown routing is safe.
 *   Prefer 95% correct + 5% unknown over 99% correct + 1% wrong.
 *
 * Sub-10ms · deterministic · no LLM · no I/O · safe to call before any DB or model call.
 */
export function routeToBrain(userMessage: string): RouteDecision {
  const message = userMessage.toLowerCase();

  // ─── Emotion check (OVERRIDES all other signals · Philip 2026-07-30) ──
  const emotionSignals = matchSignals(message, EMOTION_PATTERNS);
  if (emotionSignals.length > 0) {
    return {
      destination: "emotion",
      confidence: emotionSignals.length >= 2 ? 95 : 80,
      reason: `Emotion signals: ${emotionSignals.join(" · ")}. Feeling comes BEFORE spec.`,
      signals_matched: emotionSignals,
      is_unknown_fallback: false,
    };
  }

  // ─── Expert vs Wisdom ────────────────────────────────────────────────
  const expertSignals = matchSignals(message, EXPERT_PATTERNS);
  const wisdomSignals = matchSignals(message, WISDOM_PATTERNS);

  const eCount = expertSignals.length;
  const wCount = wisdomSignals.length;

  // Case: only Expert fires · clear Expert routing regardless of count
  if (eCount >= 1 && wCount === 0) {
    return {
      destination: "expert",
      confidence: eCount >= 2 ? 85 : 70,
      reason: `Expert signals only: ${expertSignals.join(" · ")}`,
      signals_matched: expertSignals,
      is_unknown_fallback: false,
    };
  }

  // Case: only Wisdom fires · clear Wisdom routing regardless of count
  if (wCount >= 1 && eCount === 0) {
    return {
      destination: "wisdom",
      confidence: wCount >= 2 ? 85 : 70,
      reason: `Wisdom signals only: ${wisdomSignals.join(" · ")}`,
      signals_matched: wisdomSignals,
      is_unknown_fallback: false,
    };
  }

  // Case: both fire, clear dominance (|E - W| >= 2) · dominant brain wins
  if (eCount >= 2 && eCount - wCount >= 2) {
    return {
      destination: "expert",
      confidence: 75,
      reason: `Expert dominant despite some Wisdom noise (E=${eCount} · W=${wCount}): ${expertSignals.join(" · ")}`,
      signals_matched: [...expertSignals, ...wisdomSignals.map((s) => `(w:${s})`)],
      is_unknown_fallback: false,
    };
  }

  if (wCount >= 2 && wCount - eCount >= 2) {
    return {
      destination: "wisdom",
      confidence: 75,
      reason: `Wisdom dominant despite some Expert noise (W=${wCount} · E=${eCount}): ${wisdomSignals.join(" · ")}`,
      signals_matched: [...wisdomSignals, ...expertSignals.map((s) => `(e:${s})`)],
      is_unknown_fallback: false,
    };
  }

  // Case: BOTH nonzero AND close (|E - W| < 2) · AMBIGUOUS · UNKNOWN → Wisdom
  if (eCount > 0 && wCount > 0) {
    return {
      destination: "wisdom",
      confidence: 40,
      reason: `UNKNOWN · Expert and Wisdom both fired and close (E=${eCount} · W=${wCount}) · defaulting to Wisdom safety path (Philip IMMUTABLE 2026-07-30)`,
      signals_matched: [...expertSignals.map((s) => `(e:${s})`), ...wisdomSignals.map((s) => `(w:${s})`)],
      is_unknown_fallback: true,
    };
  }

  // Case: NO signals at all · UNKNOWN → Wisdom safety fallback
  return {
    destination: "wisdom",
    confidence: 30,
    reason: "UNKNOWN · no brain signals matched · defaulting to Wisdom safety path (Philip IMMUTABLE 2026-07-30)",
    signals_matched: [],
    is_unknown_fallback: true,
  };
}

function matchSignals(
  message: string,
  patterns: Array<{ pattern: RegExp; signal: string }>,
): string[] {
  const matched: string[] = [];
  for (const p of patterns) {
    if (p.pattern.test(message) && !matched.includes(p.signal)) {
      matched.push(p.signal);
    }
  }
  return matched;
}

// ─── Composer prompt hint (used by the stream route) ───────────────────
//
// Formatted string appended to the composer's fresh system prompt as a
// single line, similar to the existing STAGE hint. Composer reads this
// and adjusts response tone accordingly.
//
// UNKNOWN case (Philip IMMUTABLE 2026-07-30): when is_unknown_fallback is
// true, the hint carries "BRAIN: unknown → wisdom safety path" so the
// composer knows to use the clarifying opener (never a confident answer).

export function brainHintForPrompt(decision: RouteDecision): string {
  if (decision.is_unknown_fallback) {
    return `BRAIN: unknown → wisdom safety path · confidence ${decision.confidence} · signals: ${decision.signals_matched.join(", ") || "none"} · REASON: ${decision.reason}`;
  }
  return `BRAIN: ${decision.destination} · confidence ${decision.confidence} · signals: ${decision.signals_matched.join(", ") || "none"}`;
}
