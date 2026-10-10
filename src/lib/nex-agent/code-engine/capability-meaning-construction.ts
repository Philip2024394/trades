// src/lib/nex-agent/code-engine/capability-meaning-construction.ts
//
// NEX · Phase 6 · Meaning Construction · 2026-09-21.
// Founder-authorised.
//
// PURPOSE
//
//   Deterministic parser: given (message, head, timeframe_extraction,
//   constraint_extraction), produce a NexMeaning object.
//
//   This is NOT a synonym expander. It uses linguistic markers, subject
//   detection, and conversation-state context to CONSTRUCT structured
//   meaning. Weather is not identified by "hot appearing in a sentence"
//   — it is identified by "a temperature/precipitation concept + a
//   place (or resolvable place from state) + an information-seeking
//   question type + non-ambiguous domain".
//
//   Two utterances with different wording that map to the same
//   underlying meaning must produce equivalent NexMeaning objects.
//   That is the generalisation test.
//
// ANTI-CHEATING
//
//   · One meaning path. No side-effects. Pure function.
//   · If confidence < 0.5, the caller MUST NOT fire a capability from
//     this meaning alone.
//   · Never emits a meaning with a specific `goal` if the utterance
//     lacks the linguistic markers for that goal — even if a keyword
//     for the associated domain is present. (e.g. "warmer house" has
//     no place + no travel-verb, so it's NOT travel goal.)

import type { ConversationHead } from "./capability-conversation-context";
import {
  emptyMeaning,
  type ConstraintKind,
  type InformationNeed,
  type MeaningConstraint,
  type MeaningCorrection,
  type MeaningDomain,
  type MeaningGoal,
  type MeaningReferent,
  type MeaningSubject,
  type MeaningTimeframe,
  type NexMeaning,
  type QuestionType,
} from "./capability-meaning-object";
import { extractTimeframe, type TimeframeExtraction } from "./capability-timeframe-extraction";
import { extractConstraints } from "./capability-constraint-extraction";

// ── Linguistic markers · bounded, structural ────────────────────────

// GOAL markers · every goal requires a marker AND a compatible domain
const TRAVEL_MARKERS = /\b(?:going\s+(?:to|somewhere)|thinking\s+(?:of|about)\s+(?:going|taking|visiting|travelling|traveling)|take\s+(?:the\s+)?(?:family|kids|us)\s+(?:somewhere|to|for)|get\s+away|getting\s+away|want\s+to\s+go\s+(?:somewhere|to)|planning\s+(?:a\s+)?(?:trip|holiday|weekend|vacation)|escape\s+to|escape\s+the\s+(?:cold|city|heat)|somewhere\s+(?:warm|warmer|cool|cooler|quiet|quieter|nice|nicer|peaceful|near|nearby|far|cheap|expensive)|nicer\s+(?:option|place|destination)|would\s+be\s+nice|holiday|vacation|getaway|trip)\b/i;
const RECOMMENDATION_MARKERS = /\b(?:would\s+you\s+(?:recommend|go|visit|choose|suggest)|should\s+i\s+(?:go|visit|stay|choose)|is\s+it\s+(?:worth\s+it|worth\s+visiting|any\s+good|nice)|worth\s+(?:it|visiting|the\s+trip)|which\s+would\s+you\s+choose|do\s+you\s+recommend|any\s+thoughts|any\s+advice|is\s+that\s+a\s+good\s+idea|is\s+it\s+a\s+good\s+idea|good\s+idea\??$|good\s+choice\??$)\b/i;
const COMPARISON_MARKERS = /\b(?:compar(?:ing|e)|which\s+(?:of|one|is|has|would|looks|city|place|option)|which\s+is\s+(?:warmer|cooler|hotter|colder|drier|wetter|better|worse|closer|further|cheaper|nearer)|between\s+([a-z][\w\s]+)\s+and\s+([a-z][\w\s]+)|what(?:'s|\s+is)\s+the\s+difference|difference\s+between|versus|\bvs\b)\b/i;
const CORRECTION_MARKERS = /\b(?:actually,?\s+(?:i\s+meant|forget|scratch\s+that)|no,?\s+i\s+mean(?:t)?|i\s+meant|forget\s+(?:that|about)?\s*([a-z][\w\s]*)|not\s+that,?\s+(?:i\s+mean|actually)|change\s+that\s+to|instead\s+of\s+([a-z][\w\s]+))\b/i;
const CANCEL_MARKERS = /\b(?:cancel(?:\s+that)?|never\s*mind|nevermind|stop|abort|forget\s+it|scratch\s+that|leave\s+it|undo)\b/i;
const RECALL_MARKERS = /\bwhat\s+did\s+(?:you|we|i)\s+(?:find|say|decide|change|talk|discuss)|what\s+was\s+(?:the\s+)?(?:first|original)|which\s+(?:file|function|method)/i;
const EXPLANATION_MARKERS = /\b(?:why\s+did\s+you|how\s+did\s+you|explain\s+your|what\s+led\s+you\s+to|on\s+what\s+basis)\b/i;
const INVESTIGATE_CODE_MARKERS = /\b(?:where\s+is\s+([a-z][\w]*)\s+defined|find\s+(?:the\s+)?(?:function|method|class|module|file)|show\s+me\s+the\s+code\s+for|investigate\s+(?:the\s+)?(?:file|function|module|route|handler))\b/i;

// DOMAIN concept markers · each concept requires an appropriate subject
// context to actually map to the domain. These are STRUCTURAL not synonym.
const WEATHER_CONCEPT_MARKERS = /\b(?:weather|forecast|temperature|climate|rain|raining|shower|showers|sunny|storm|stormy|snow|humid|humidity|conditions|hot|hotter|hottest|warm|warmer|warmest|cool|cooler|coolest|cold|colder|coldest|dry|drier|driest|wet|wetter|wettest|umbrella)\b/i;
const GEOGRAPHY_CONCEPT_MARKERS = /\b(?:coordinates?|latitude|longitude|location|lat\/lon|where\s+is|geolocation|geographic)\b/i;
const TRAVEL_CONCEPT_MARKERS = /\b(?:travel|visit|visiting|trip|holiday|vacation|destination|getaway|tourism)\b/i;
const COST_CONCEPT_MARKERS = /\b(?:cost|price|prices|how\s+much|expensive|cheap|budget|afford|affordable)\b/i;
const DISTANCE_CONCEPT_MARKERS = /\b(?:how\s+far|distance|nearby|near|close\s+by|far\s+from|kilometers?|km\b|miles?)\b/i;

// SUBJECT extractors
const KNOWN_INDONESIAN_CITIES: ReadonlySet<string> = new Set([
  "jakarta", "bandung", "surabaya", "yogyakarta", "jogja", "denpasar", "bali",
  "semarang", "medan", "makassar", "malang", "padang", "palembang", "solo",
  "batam", "bogor", "banda aceh", "manado", "pekanbaru", "balikpapan",
]);
const CITY_ALIAS: ReadonlyMap<string, string> = new Map([["jogja", "yogyakarta"]]);

// QUESTION TYPE markers
const WH_OPENERS = /^\s*(what|when|where|which|who|why|how)\b/i;
const YES_NO_OPENERS = /^\s*(is|are|does|do|did|will|would|should|could|can|may|might)\b/i;
const GREETING_MARKERS = /^\s*(hi|hello|hey|hiya|greetings)\b/i;

// STOPWORDS for token cleanup
const STOP = new Set([
  "the", "a", "an", "and", "or", "but", "with", "for", "of", "in", "on", "at",
  "to", "from", "by", "about", "as", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would", "should",
  "could", "can", "may", "might", "must", "shall", "you", "we", "i", "me",
  "us", "them", "my", "our", "your", "this", "that", "these", "those",
]);

// ── Public: constructMeaning ─────────────────────────────────────────

export interface ConstructMeaningInputs {
  readonly message: string;
  readonly head: ConversationHead;
  readonly turn_id: number;
}

export function constructMeaning(inputs: ConstructMeaningInputs): NexMeaning {
  const msg = inputs.message.trim();
  const lowerMsg = msg.toLowerCase();
  if (msg.length === 0) return emptyMeaning();

  // ── 1 · Question type ────────────────────────────────────────────
  const questionType: QuestionType = detectQuestionType(msg);

  // ── 2 · Correction / cancellation ────────────────────────────────
  const correction = detectCorrection(msg);
  if (correction.kind === "cancellation") {
    return { ...emptyMeaning(), goal: "cancel_intent", question_type: "cancel", correction, confidence: 0.95, evidence_basis: ["cancellation marker matched"] };
  }

  // ── 3 · Timeframe (independent of domain) ────────────────────────
  const timeframeExtraction: TimeframeExtraction = extractTimeframe({ message: msg, head_timeframe: inputs.head.active_timeframe ?? null });
  const timeframe: MeaningTimeframe | null = timeframeExtraction.timeframe;

  // ── 4 · Constraints (accumulated with head + new) ────────────────
  const newConstraints = extractConstraints({ message: msg, turn_id: inputs.turn_id });
  const accumulatedConstraints = mergeConstraints(inputs.head as any, newConstraints, correction);

  // ── 5 · Subjects ─────────────────────────────────────────────────
  let subjects = extractSubjects(msg, inputs.head);
  // Phase 6 · when the message is a comparison referent ("which is
  // warmer" / "which one is drier") and head carries a prior
  // multi-subject retrieval, replace subjects with that list. This
  // rule OVERRIDES the same-topic single-subject inheritance so the
  // comparison composition rebuilds with the full subject set.
  if (/\bwhich\s+(?:is|has|would|one|city|place)\s+(?:warmer|hotter|cooler|colder|drier|wetter|nearer|closer|farther|further|better)\b/i.test(msg) &&
      inputs.head.last_retrieval?.subjects_list &&
      inputs.head.last_retrieval.subjects_list.length >= 2 &&
      subjects.length < inputs.head.last_retrieval.subjects_list.length) {
    subjects = inputs.head.last_retrieval.subjects_list.map((v) => ({ kind: "place" as const, value: v, evidence: "resolved_from_state" as const }));
  }
  const primarySubject = subjects[0] ?? null;

  // ── 6 · Domain and goal ──────────────────────────────────────────
  // Domain is derived from concept markers + subject context.
  // Goal is derived from linguistic markers + question type.
  const { domain, goal, informationNeed, confidence, basis } = classifyGoalAndDomain({
    lowerMsg,
    msg,
    subjects,
    correction,
    questionType,
    head: inputs.head,
    hasTimeframe: !!timeframe,
    hasConstraints: accumulatedConstraints.length > 0,
  });

  // ── 7 · Referents / deictic bindings ─────────────────────────────
  const referents = extractReferents(msg, inputs.head);

  // ── 8 · Topic (Phase-5 bridge) ───────────────────────────────────
  const topic: string | null = domain === "weather" ? "weather"
    : domain === "geography" ? "coordinates"
    : domain === "travel" ? "travel"
    : inputs.head.active_topic ?? null;

  const basisAcc: string[] = [...basis];
  if (timeframe) basisAcc.push(`timeframe · ${timeframe.anchor}+${timeframe.offset_days}d · surface='${timeframe.surface}'`);
  if (accumulatedConstraints.length > 0) basisAcc.push(`constraints · ${accumulatedConstraints.map((c) => c.kind).join(",")}`);
  if (primarySubject) basisAcc.push(`subject · ${primarySubject.kind}='${primarySubject.value}' · via ${primarySubject.evidence}`);
  if (referents.length > 0) basisAcc.push(`referents · ${referents.map((r) => `${r.surface}→${r.resolved_value ?? "unresolvable"}`).join(",")}`);

  return {
    goal,
    subject: primarySubject,
    subjects_all: subjects,
    domain,
    topic,
    timeframe,
    constraints: accumulatedConstraints,
    referents,
    correction,
    information_need: informationNeed,
    question_type: questionType,
    confidence,
    evidence_basis: basisAcc.slice(0, 8),
  };
}

// ── Sub-functions ────────────────────────────────────────────────────

function detectQuestionType(msg: string): QuestionType {
  if (CANCEL_MARKERS.test(msg)) return "cancel";
  if (CORRECTION_MARKERS.test(msg)) return "correction";
  if (GREETING_MARKERS.test(msg)) return "greeting";
  if (/^\s*(?:and\s+)?what\s+about\b/i.test(msg) || /^\s*(?:and\s+)?how\s+about\b/i.test(msg)) return "continuation";
  const wh = WH_OPENERS.exec(msg);
  if (wh) {
    // "what would you" is open_wh, "which is warmer" is closed_wh
    if (/^\s*how\s+(?:do|can|would|could|should|much|far|old|hot|warm|long)\b/i.test(msg)) return /how\s+much|how\s+far/i.test(msg) ? "closed_wh" : "open_wh";
    if (/^\s*what\s+(?:if|would|could|should)\b/i.test(msg)) return "open_wh";
    return "closed_wh";
  }
  if (YES_NO_OPENERS.test(msg)) return "yes_no";
  if (/[?]$/.test(msg)) return "yes_no";
  return "statement";
}

function detectCorrection(msg: string): MeaningCorrection {
  if (CANCEL_MARKERS.test(msg)) return { kind: "cancellation", from_value: null, to_value: null, surface: msg.slice(0, 80) };
  const forgetMatch = /\bforget\s+(?:that\s+)?(?:about\s+)?([a-z][\w\s]{1,40}?)(?:\.|,|$|\s+(?:somewhere|instead|and|but))/i.exec(msg);
  if (forgetMatch) {
    // Distinguish subject correction from goal correction · if the following
    // clause introduces a different constraint, it's a goal_correction/constraint_add.
    const rest = msg.slice(forgetMatch.index + forgetMatch[0].length);
    const hasGoalShift = /\bwant\s+something|somewhere\s+quieter|somewhere\s+warmer|different|instead/i.test(rest);
    return {
      kind: hasGoalShift ? "goal_correction" : "subject_correction",
      from_value: forgetMatch[1]?.trim() ?? null,
      to_value: null,
      surface: msg.slice(0, 100),
    };
  }
  const meantMatch = /\b(?:actually,?\s+)?i\s+meant\s+([a-z][\w\s]{1,40})/i.exec(msg);
  if (meantMatch) return { kind: "subject_correction", from_value: null, to_value: meantMatch[1]?.trim() ?? null, surface: msg.slice(0, 100) };
  const insteadMatch = /\binstead\s+of\s+([a-z][\w\s]+?)(?:,|\.|\s+use|\s+i)/i.exec(msg);
  if (insteadMatch) return { kind: "subject_correction", from_value: insteadMatch[1]?.trim() ?? null, to_value: null, surface: msg.slice(0, 100) };
  // Constraint add e.g. "and it needs to be quiet" — light detection · full
  // extraction happens in capability-constraint-extraction.
  const addMatch = /\b(?:and\s+)?(?:it\s+needs\s+to\s+be|should\s+be|and)\s+(quiet|warm|cool|cheap|near|far)/i.exec(msg);
  if (addMatch) return { kind: "constraint_add", from_value: null, to_value: addMatch[1] ?? null, surface: msg.slice(0, 100) };
  const removeMatch = /\bdoesn'?t\s+need\s+to\s+be\s+([a-z]+)|no\s+longer\s+([a-z]+)/i.exec(msg);
  if (removeMatch) return { kind: "constraint_remove", from_value: (removeMatch[1] ?? removeMatch[2]) ?? null, to_value: null, surface: msg.slice(0, 100) };
  return { kind: "none", from_value: null, to_value: null, surface: "" };
}

function mergeConstraints(head: { constraints?: readonly MeaningConstraint[] }, newOnes: readonly MeaningConstraint[], correction: MeaningCorrection): readonly MeaningConstraint[] {
  const existing = Array.isArray(head.constraints) ? [...head.constraints] : [];
  let merged: MeaningConstraint[] = [...existing];
  // Remove on constraint_remove
  if (correction.kind === "constraint_remove" && correction.from_value) {
    const removeKind = keyToConstraintKind(correction.from_value);
    if (removeKind) merged = merged.filter((c) => c.kind !== removeKind);
  }
  // Add new (deduped by kind, latest wins)
  for (const nc of newOnes) {
    merged = merged.filter((c) => c.kind !== nc.kind);
    merged.push(nc);
  }
  return merged;
}

function keyToConstraintKind(key: string): ConstraintKind | null {
  const k = key.toLowerCase();
  if (/warm/.test(k)) return "temperature_warmer";
  if (/cool|cold/.test(k)) return "temperature_cooler";
  if (/quiet|peace/.test(k)) return "atmosphere_quiet";
  if (/near|close/.test(k)) return "distance_near";
  if (/far/.test(k)) return "distance_far";
  if (/cheap|budget/.test(k)) return "budget_cheap";
  return null;
}

function extractSubjects(msg: string, head: ConversationHead): readonly MeaningSubject[] {
  const out: MeaningSubject[] = [];
  const seen = new Set<string>();
  const lower = msg.toLowerCase();
  // 1 · Known Indonesian city hits
  for (const city of KNOWN_INDONESIAN_CITIES) {
    // word-boundary match on the full city name (multi-word supported by explicit `\b`s)
    const re = new RegExp(`\\b${city.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (re.test(msg)) {
      const canonical = CITY_ALIAS.get(city) ?? city;
      if (!seen.has(canonical)) {
        seen.add(canonical);
        out.push({ kind: "place", value: canonical, evidence: "explicit_named" });
      }
    }
  }
  // 2 · "somewhere X" · unresolved place holder for travel intent
  if (/\bsomewhere\b/i.test(msg) && out.length === 0) {
    out.push({ kind: "place", value: "unresolved", evidence: "hypothetical" });
  }
  // 3 · Fallback: if head has active_subject and this looks like a
  //     continuation ("what about", "and", "there", pronoun-only), inherit.
  if (out.length === 0 && head.active_subject) {
    const isContinuation = /^\s*(?:and\s+)?(?:what|how)\s+about\b|^\s*there\b|^\s*it\b|^\s*that\b/i.test(msg);
    if (isContinuation) {
      out.push({ kind: head.active_subject.kind as any, value: head.active_subject.value, evidence: "resolved_from_state" });
    }
  }
  // 4 · Same-topic implicit inheritance: when the message has a
  //     weather / geography concept AND the head carries an
  //     active_subject of place kind AND we haven't found an explicit
  //     place, inherit the active_subject silently. Handles "Any rain
  //     expected?" style follow-ups where the place is implicit.
  if (out.length === 0 && head.active_subject?.kind === "place" && head.active_topic) {
    const hasWeatherConcept = /\b(?:weather|forecast|temperature|climate|rain|shower|sunny|storm|humid|hot|warm|cool|cold|dry|wet|umbrella)\w*\b/i.test(msg);
    const hasGeoConcept = /\b(?:coordinates?|latitude|longitude|location)\b/i.test(msg);
    if (hasWeatherConcept || hasGeoConcept) {
      out.push({ kind: "place", value: head.active_subject.value, evidence: "resolved_from_state" });
    }
  }
  return out;
}

function extractReferents(msg: string, head: ConversationHead): readonly MeaningReferent[] {
  const out: MeaningReferent[] = [];
  const push = (surface: string, resolved: string | null, bound: MeaningReferent["bound_via"]): void => {
    out.push({ surface, resolved_kind: resolved ? "place" : "unresolved", resolved_value: resolved, bound_via: bound });
  };
  if (/\bthere\b/i.test(msg) && head.active_subject) push("there", head.active_subject.value, "active_subject");
  if (/\bit\b/i.test(msg) && head.active_subject) push("it", head.active_subject.value, "active_subject");
  if (/\bthat\s+(?:one|place|city)\b/i.test(msg) && head.active_subject) push("that_one", head.active_subject.value, "active_subject");
  if (/\bthem\b/i.test(msg) && head.active_subject) push("them", head.active_subject.value, "active_subject");
  if (/\bnearby\b|\bsomewhere\s+nearby\b|\bclose\s+by\b/i.test(msg)) push("nearby", null, "unresolvable");
  return out;
}

interface GoalDomainInputs {
  readonly lowerMsg: string;
  readonly msg: string;
  readonly subjects: readonly MeaningSubject[];
  readonly correction: MeaningCorrection;
  readonly questionType: QuestionType;
  readonly head: ConversationHead;
  readonly hasTimeframe: boolean;
  readonly hasConstraints: boolean;
}

function classifyGoalAndDomain(i: GoalDomainInputs): { domain: MeaningDomain; goal: MeaningGoal; informationNeed: InformationNeed; confidence: number; basis: string[] } {
  const basis: string[] = [];
  // 1 · Correction / cancellation
  if (i.correction.kind === "cancellation") return { domain: "unknown", goal: "cancel_intent", informationNeed: "acknowledgement", confidence: 0.95, basis: ["cancellation marker"] };
  if (i.correction.kind !== "none") {
    // Correction inherits domain from head active_topic
    const domain = domainFromTopic(i.head.active_topic);
    // Phase 6 · goal_correction on an active travel topic must NOT
    // collapse to "correct_state" (which fallthroughs). It preserves
    // the travel goal, clears the subject (user said "forget X"), and
    // carries the new constraints forward. Handler: travel_plan_reply.
    if (i.correction.kind === "goal_correction" && i.head.active_topic === "travel") {
      return {
        domain: "travel",
        goal: "find_place",
        informationNeed: "listing",
        confidence: 0.85,
        basis: [`goal_correction · preserving travel goal · subject cleared · constraints=${i.hasConstraints}`],
      };
    }
    // Subject correction on active weather / coordinates topic is already
    // handled by the Phase-5 semantic correction router. For any other
    // correction, mark as correct_state so upstream handlers process it.
    return { domain, goal: "correct_state", informationNeed: "acknowledgement", confidence: 0.85, basis: [`correction · from head domain=${domain}`] };
  }

  // 2 · Recall + explanation markers
  if (RECALL_MARKERS.test(i.msg)) return { domain: "code_investigation", goal: "recall_prior", informationNeed: "listing", confidence: 0.8, basis: ["recall markers matched"] };
  if (EXPLANATION_MARKERS.test(i.msg)) return { domain: i.head.active_topic ? domainFromTopic(i.head.active_topic) : "unknown", goal: "get_explanation", informationNeed: "explanation", confidence: 0.85, basis: ["explanation markers matched"] };

  // 3 · Code investigation (explicit)
  if (INVESTIGATE_CODE_MARKERS.test(i.msg)) return { domain: "code_investigation", goal: "investigate_code", informationNeed: "factual_lookup", confidence: 0.9, basis: ["code-investigation marker"] };

  // 4 · Comparison
  if (COMPARISON_MARKERS.test(i.msg)) {
    // Comparison requires ≥2 subjects OR a concept-with-plural (which is warmer?)
    const hasWeather = WEATHER_CONCEPT_MARKERS.test(i.msg);
    const hasGeo = GEOGRAPHY_CONCEPT_MARKERS.test(i.msg);
    const domain: MeaningDomain = hasWeather ? "weather" : hasGeo ? "geography" : i.subjects.length >= 2 ? "travel" : "unknown";
    basis.push(`comparison marker · domain=${domain} · subjects=${i.subjects.length}`);
    return { domain, goal: "compare", informationNeed: "comparison", confidence: (i.subjects.length >= 2 ? 0.85 : 0.6), basis };
  }

  // 5 · Recommendation
  if (RECOMMENDATION_MARKERS.test(i.msg)) {
    const domain: MeaningDomain = i.head.active_topic ? domainFromTopic(i.head.active_topic) : (TRAVEL_CONCEPT_MARKERS.test(i.msg) ? "travel" : "unknown");
    return { domain, goal: "get_recommendation", informationNeed: "recommendation", confidence: 0.75, basis: [`recommendation marker · domain=${domain}`] };
  }

  // 6 · Travel plan
  if (TRAVEL_MARKERS.test(i.msg) || (TRAVEL_CONCEPT_MARKERS.test(i.msg) && i.subjects.some((s) => s.kind === "place"))) {
    basis.push("travel markers or (travel concept + place subject)");
    return { domain: "travel", goal: "plan_travel", informationNeed: i.questionType === "yes_no" ? "recommendation" : "listing", confidence: 0.8, basis };
  }

  // 7 · Weather
  //     Weather requires (weather concept) AND (a place subject OR a
  //     deictic referent that binds to a place). "warmer house" alone
  //     does NOT qualify because there's no place subject.
  if (WEATHER_CONCEPT_MARKERS.test(i.msg)) {
    const hasPlace = i.subjects.some((s) => s.kind === "place");
    const hasDeicticPlace = /\b(there|it|that\s+(?:one|place|city))\b/i.test(i.msg) && i.head.active_subject?.kind === "place";
    if (hasPlace || hasDeicticPlace) {
      basis.push(`weather concept + ${hasPlace ? "explicit place" : "deictic-place from state"}`);
      return { domain: "weather", goal: "get_current_fact", informationNeed: "factual_lookup", confidence: 0.85, basis };
    }
    // Weather concept without place subject:
    //   · if active_topic=travel AND we have constraints, this is a
    //     travel-constraint continuation ("warm" = a preference, not
    //     a weather question). Let rule 13 handle it.
    //   · otherwise, low-confidence unknown.
    if (i.head.active_topic === "travel" && i.hasConstraints) {
      basis.push("weather-adjacent tokens present but active_topic=travel + constraints → constraint continuation");
      // fall through to rule 13
    } else {
      basis.push("weather concept present but no place · low confidence");
      return { domain: "unknown", goal: "unknown", informationNeed: "unknown", confidence: 0.3, basis };
    }
  }

  // 8 · Geography (coordinates)
  if (GEOGRAPHY_CONCEPT_MARKERS.test(i.msg)) {
    const hasPlace = i.subjects.some((s) => s.kind === "place");
    if (hasPlace) return { domain: "geography", goal: "get_current_fact", informationNeed: "factual_lookup", confidence: 0.9, basis: ["geography concept + place subject"] };
  }

  // 9 · Cost / distance concepts within an active topic → adopt topic domain.
  //     BUT only when the message is an actual QUESTION shape ("how much
  //     would that cost", "how far is it"). "Not too expensive" or "not
  //     too far" appearing inside a constraint statement is a preference,
  //     not a cost/distance query — those flow through rule 13.
  if ((COST_CONCEPT_MARKERS.test(i.msg) || DISTANCE_CONCEPT_MARKERS.test(i.msg)) && i.head.active_topic
      && (i.questionType === "closed_wh" || i.questionType === "yes_no" || i.questionType === "open_wh")) {
    const domain = domainFromTopic(i.head.active_topic);
    const info: InformationNeed = COST_CONCEPT_MARKERS.test(i.msg) ? "cost" : "distance";
    return { domain, goal: "get_current_fact", informationNeed: info, confidence: 0.7, basis: [`${info} concept + active topic=${i.head.active_topic} + question shape=${i.questionType}`] };
  }

  // 10 · Continuation with active state ("what about X", "and Y") → inherit
  if (i.questionType === "continuation" && i.head.active_topic) {
    const domain = domainFromTopic(i.head.active_topic);
    return { domain, goal: "get_current_fact", informationNeed: "factual_lookup", confidence: 0.65, basis: [`continuation with active topic=${i.head.active_topic}`] };
  }

  // 11 · "What if X" continuation with active state · constraint addition
  //      Recognises "what if I took the kids" / "what if it rains" as a
  //      constraint-add on an active travel/weather goal, rather than an
  //      unknown investigation. Requires head to have active_topic set.
  if (/^\s*what\s+if\b/i.test(i.msg) && i.head.active_topic) {
    const domain = domainFromTopic(i.head.active_topic);
    const priorGoal: MeaningGoal =
      i.head.active_topic === "travel" ? "plan_travel" :
      i.head.active_topic === "weather" ? "get_current_fact" :
      i.head.active_topic === "coordinates" ? "get_current_fact" :
      "unknown";
    return {
      domain,
      goal: priorGoal,
      informationNeed: i.hasConstraints ? "listing" : "recommendation",
      confidence: 0.65,
      basis: [`"what if" continuation · active topic=${i.head.active_topic} · goal inherited=${priorGoal}`],
    };
  }

  // 12 · "Somewhere <adj>" with active travel topic · treats as
  //      constraint-add + subject clearing (destination TBD).
  if (/\bsomewhere\b/i.test(i.msg) && i.head.active_topic === "travel") {
    return {
      domain: "travel",
      goal: "find_place",
      informationNeed: "listing",
      confidence: 0.7,
      basis: [`"somewhere X" continuation · active topic=travel · constraint update`],
    };
  }

  // 13 · Pure-constraint continuation on an active travel topic.
  //      Messages like "Not too far. Warm. Quiet. Not crazy expensive."
  //      have no goal verb but ARE unmistakable constraint additions
  //      when there's an active travel plan on head. Requires at least
  //      one constraint extracted. Weather-adjacent tokens like "warm"
  //      or "hot" are legitimate CONSTRAINTS in a travel context —
  //      "warm" here means "I want a warm destination", not "tell me
  //      the weather" — so we only exclude when there's a full weather
  //      question shape (a place subject + a wh-question) which rule 7
  //      would have already caught.
  if (i.hasConstraints && i.head.active_topic === "travel" && i.subjects.length === 0) {
    return {
      domain: "travel",
      goal: "find_place",
      informationNeed: "listing",
      confidence: 0.65,
      basis: [`constraint-only continuation · active topic=travel · ${i.subjects.length === 0 ? "no explicit subject" : "subject present"}`],
    };
  }

  // 14 · Comparison referent · "which is warmer" without new subjects
  //      but with a prior comparison result on head. Rerun the previous
  //      comparison for the concept the user just named.
  if (/\bwhich\s+(?:is|has|would|one|city|place)\s+(?:warmer|hotter|cooler|colder|drier|wetter|nearer|closer|farther|further|better)\b/i.test(i.msg) &&
      i.head.last_retrieval?.kind === "compare_places_weather") {
    return {
      domain: "weather",
      goal: "compare",
      informationNeed: "comparison",
      confidence: 0.7,
      basis: [`"which is X" referent · rerun previous compare_places_weather`],
    };
  }

  // 15 · Weather concept on same-topic continuation · "any rain"
  //      "how about the temperature" · rebind to active_subject.
  if (WEATHER_CONCEPT_MARKERS.test(i.msg) && i.head.active_topic === "weather" && i.head.active_subject?.kind === "place") {
    return {
      domain: "weather",
      goal: "get_current_fact",
      informationNeed: "factual_lookup",
      confidence: 0.7,
      basis: [`weather concept · same-topic continuation · subject inherited from head`],
    };
  }

  // 16 · Fallback
  return { domain: "unknown", goal: "unknown", informationNeed: "unknown", confidence: 0.2, basis: ["no goal/domain markers"] };
}

function domainFromTopic(topic: string | null | undefined): MeaningDomain {
  if (!topic) return "unknown";
  if (topic === "weather") return "weather";
  if (topic === "coordinates") return "geography";
  if (topic === "travel") return "travel";
  return "unknown";
}
