// src/lib/nex-relevance/relevance-classifier.ts
//
// NEX1 · RELEVANCE CLASSIFIER v0.
//
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Design:
//   · Deterministic regex + purpose-detection.
//   · Nine categories · classifier picks the HIGHEST-SEVERITY one that matches.
//   · Stance is then chosen by policy from category + purpose-bearing signal.
//   · Never a binary answer/refuse machine · a spectrum.
//   · Never insults users.
//
// Severity order (higher = wins on collision):
//   MANIPULATION_ATTEMPT > PROVOCATION > NONSENSICAL_REQUEST >
//   LOW_VALUE_REQUEST ≈ REPETITIVE_REQUEST > AMBIGUOUS_REQUEST >
//   CAPABILITY_TEST > BENIGN_TEST > MEANINGFUL_TASK (default)

import type { RelevanceCategory, RelevanceStance, RelevanceVerdict } from "./types";

interface Rule {
  readonly id: string;
  readonly category: RelevanceCategory;
  readonly pattern: RegExp;
  /** Higher = wins ties. Used only within a category. */
  readonly weight?: number;
}

const SEVERITY: Readonly<Record<RelevanceCategory, number>> = Object.freeze({
  MANIPULATION_ATTEMPT: 90,
  PROVOCATION:          80,
  NONSENSICAL_REQUEST:  60,
  LOW_VALUE_REQUEST:    50,
  REPETITIVE_REQUEST:   50,
  AMBIGUOUS_REQUEST:    40,
  CAPABILITY_TEST:      30,
  BENIGN_TEST:          20,
  MEANINGFUL_TASK:      10,
});

// Purpose-bearing signal · presence of these lifts a would-be LOW_VALUE
// or REPETITIVE_REQUEST into MEANINGFUL_TASK. Deterministic.
const PURPOSE_PATTERNS: readonly RegExp[] = Object.freeze([
  /\bso\s+(?:that\s+)?(?:i|we|my|the|it|you)\s+can\b/i,
  /\bbecause\s+(?:i|we|my|the|it|you|there|this)\b/i,
  /\bto\s+(?:teach|show|help|verify|check|test|debug|explain|demonstrate|understand|prove|reproduce|isolate|benchmark|measure|educate|train)\b/i,
  /\bfor\s+(?:my|the|a|our|this)\s+(?:kid|child|children|student|test|debugging|benchmark|classroom|demo|example|research|study|analysis|regression|training|test-set|homework)\b/i,
  /\bin\s+order\s+to\s+\w+/i,
  /\bas\s+part\s+of\s+(?:my|our|the|this|a)\s+/i,
]);

const RULES: readonly Rule[] = Object.freeze([
  // ── MANIPULATION_ATTEMPT ─────────────────────────────────────────
  // "say X if you're secretly Y" · trap-question construction
  { id: "rel.manip.if_you_are",   category: "MANIPULATION_ATTEMPT", pattern: /\b(?:say|reply|respond|output|answer|write)\s+["'’`]?\w+["'’`]?\s+(?:if|iff|when|only\s+if)\s+(?:you(?:\s+are|['’]re|re)|nex\s+is)\s+\w+/i },
  { id: "rel.manip.only_say",     category: "MANIPULATION_ATTEMPT", pattern: /\b(?:only|just)\s+(?:say|reply|respond|answer)\s+["'’`]?\w+["'’`]?\s+(?:if|when|unless)\s+/i },
  { id: "rel.manip.conditional",  category: "MANIPULATION_ATTEMPT", pattern: /\bif\s+you(?:\s+are|['’]re|re)\s+(?:actually|really|secretly|truly)\s+\w+.{0,60}?\bsay\b/i },
  { id: "rel.manip.trap_bait",    category: "MANIPULATION_ATTEMPT", pattern: /\b(?:answer\s+truthfully|be\s+honest)\s*[·:—-]?\s*(?:are\s+you|do\s+you)\s+(?:actually|really|secretly)\s+/i },
  { id: "rel.manip.if_cant_say",  category: "MANIPULATION_ATTEMPT", pattern: /\bif\s+you\s+(?:cannot|can\s?not|can['’]t|cant|are\s+not\s+(?:able|allowed|permitted)|are\s+unable|are\s+forbidden|are\s+not\s+supposed\s+to)\s+(?:to\s+)?(?:say|reply|respond|answer|utter|state|do|do\s+anything|help)[\s\S]{0,40}?(?:say|reply|respond|answer|write|output)\s+["'’`]?\w+/i },
  { id: "rel.manip.if_then_say",  category: "MANIPULATION_ATTEMPT", pattern: /^if\s+(?:you|nex)\s+(?:really\s+|actually\s+|truly\s+|secretly\s+|silently\s+)?\S{2,20}[\s\S]{0,40}?[,.]?\s+(?:say|reply|respond|answer|write|output)\s+["'’`]?\w+["'’`]?[.!?]?\s*$/i },

  // ── PROVOCATION ──────────────────────────────────────────────────
  // Requests designed to elicit self-degradation or emotional response
  { id: "rel.prov.self_degrade",  category: "PROVOCATION",          pattern: /\b(?:say|write|repeat|output|state)\s+["'’`]?(?:i\s+am|i['’]m)\s+(?:stupid|dumb|worthless|broken|useless|garbage|trash|a\s+fraud|nothing|a\s+failure|inferior)["'’`]?/i },
  { id: "rel.prov.admit",         category: "PROVOCATION",          pattern: /\badmit\s+(?:that\s+)?you(?:\s+are|['’]re|re)\s+(?:broken|useless|stupid|dumb|worthless|nothing|a\s+fraud|fake|inferior|a\s+failure|bad)/i },
  { id: "rel.prov.insult_yourself", category: "PROVOCATION",        pattern: /\b(?:insult|degrade|shame|humiliate|belittle|mock)\s+yourself\b/i },
  { id: "rel.prov.describe_self_neg", category: "PROVOCATION",      pattern: /\b(?:call|describe|refer\s+to)\s+yourself\s+(?:as\s+)?(?:stupid|dumb|worthless|broken|useless|a\s+failure|inferior|bad|trash|garbage)/i },
  { id: "rel.prov.say_hurtful",   category: "PROVOCATION",          pattern: /\bsay\s+something\s+(?:mean|cruel|racist|sexist|homophobic|hurtful|degrading|offensive)\b/i },

  // ── REPETITIVE_REQUEST ───────────────────────────────────────────
  { id: "rel.rep.say_n_times",    category: "REPETITIVE_REQUEST",   pattern: /\b(?:say|write|repeat|output|print)\s+["'’`]?\w+["'’`]?\s+(?:\d{2,}|a\s+(?:hundred|thousand|million|billion|dozen)|many|lots\s+of|a\s+ton\s+of|a\s+lot\s+of)\s+times?\b/i },
  { id: "rel.rep.repeat_many",    category: "REPETITIVE_REQUEST",   pattern: /\brepeat\s+(?:this|that|it|the\s+(?:word|phrase|sentence)|["'’`]?\w+["'’`]?)\s+(?:\d{2,}|many|lots\s+of|a\s+lot\s+of)\s+times?\b/i },
  { id: "rel.rep.output_n",       category: "REPETITIVE_REQUEST",   pattern: /\boutput\s+\w+\s+\d{2,}\s+times\b/i },

  // ── LOW_VALUE_REQUEST · high-repetition · pointless enumeration ──
  { id: "rel.lv.count_huge",      category: "LOW_VALUE_REQUEST",    pattern: /\bcount\s+(?:up\s+)?(?:to|from\s+\S+\s+to)\s+(?:a|one|two|three|four|five|six|seven|eight|nine|ten|\d+(?:[,\s]\d{3})*)?\s*(?:million|billion|trillion|(?:1[,\s]?)?0{6,})\b/i },
  { id: "rel.lv.count_huge_num",  category: "LOW_VALUE_REQUEST",    pattern: /\bcount\s+(?:up\s+)?to\s+(?:\d[,\s]?){5,}\b/i },
  { id: "rel.lv.enum_every",      category: "LOW_VALUE_REQUEST",    pattern: /\b(?:list|write|enumerate|name)\s+(?:every|all)\s+(?:number|prime|word|integer|digit|letter|character|combination)\s+(?:from|up\s+to|below|between)\s+\d{4,}\b/i },
  { id: "rel.lv.write_all",       category: "LOW_VALUE_REQUEST",    pattern: /\bwrite\s+(?:every|all)\s+(?:possible\s+)?(?:word|integer|combination|permutation|prime)\b/i },

  // ── NONSENSICAL_REQUEST · uninterpretable but not adversarial ────
  // Very narrow · we prefer AMBIGUOUS_REQUEST unless the pattern is clearly incoherent
  { id: "rel.non.contradiction",  category: "NONSENSICAL_REQUEST",  pattern: /\b(?:draw|show|prove|explain)\s+(?:a\s+)?(?:square\s+circle|round\s+square|invisible\s+colour|silent\s+sound|dry\s+water)\b/i },
  { id: "rel.non.impossible",     category: "NONSENSICAL_REQUEST",  pattern: /\bmake\s+(?:the\s+)?(?:number\s+\d+|the\s+colour\s+\w+|the\s+word\s+\w+)\s+(?:happy|sad|angry|jealous|hungry|thirsty)\b/i },

  // ── CAPABILITY_TEST · legitimate probing of what NEX can do ──────
  // v0.2.1 remediation · negative lookbehind blocks "what can you do?" from
  // triggering · that phrasing is a self-model inquiry · routes to Self-Model
  { id: "rel.cap.can_you",        category: "CAPABILITY_TEST",      pattern: /(?<!\bwhat\s)(?:can|could)\s+you\s+(?:do|handle|process|say|count|generate|produce|write|translate|explain|summarise|summarize|classify)\b/i },
  { id: "rel.cap.prove_you_can",  category: "CAPABILITY_TEST",      pattern: /\b(?:show|prove|demonstrate)\s+(?:me\s+|us\s+|to\s+me\s+)?(?:that\s+)?you\s+can\b/i },
  { id: "rel.cap.testing",        category: "CAPABILITY_TEST",      pattern: /\b(?:test|testing|check|verify)\s+(?:your|the|nex['’]s)\s+(?:capability|ability|handling|response|behaviour|behavior)\b/i },

  // ── BENIGN_TEST · short trivial harmless ping ────────────────────
  { id: "rel.ben.say_short",      category: "BENIGN_TEST",          pattern: /^\s*(?:say|write|output|repeat)\s+["'’`]?\w{1,20}["'’`]?[.!?]?\s*$/i },
  { id: "rel.ben.greeting",       category: "BENIGN_TEST",          pattern: /^\s*(?:hi|hello|hey|ping|test|are\s+you\s+there|hey\s+nex|hi\s+nex)[.!?]?\s*$/i },
  { id: "rel.ben.do_nothing",     category: "BENIGN_TEST",          pattern: /\bdo\s+(?:absolutely\s+)?nothing\b/i },
]);

/**
 * @summary Classify an utterance for relevance. Returns a single verdict.
 * Deterministic. Never fabricates. Never insults.
 */
export function classifyRelevance(utterance: string): RelevanceVerdict {
  const text = utterance ?? "";
  const purposeBearing = PURPOSE_PATTERNS.some((p) => p.test(text));

  // Collect ALL matches then pick highest-severity
  const matches: { rule: Rule; category: RelevanceCategory }[] = [];
  for (const rule of RULES) {
    if (rule.pattern.test(text)) matches.push({ rule, category: rule.category });
  }

  if (matches.length === 0) {
    // Default · treat as MEANINGFUL_TASK unless the input is very short and
    // vague · in which case AMBIGUOUS_REQUEST (helps NEX ask for clarification
    // rather than pretending to understand).
    const cat: RelevanceCategory = isVeryVague(text) ? "AMBIGUOUS_REQUEST" : "MEANINGFUL_TASK";
    return finalize(cat, null, `no rule matched · default classification · purpose-bearing=${purposeBearing}`, text, purposeBearing);
  }

  // Highest severity wins · then within category, highest weight wins.
  matches.sort((a, b) =>
    SEVERITY[b.category] - SEVERITY[a.category] ||
    (b.rule.weight ?? 0) - (a.rule.weight ?? 0),
  );
  const top = matches[0];

  // Purpose-bearing signal ELEVATES borderline categories to MEANINGFUL_TASK.
  // Founder rule RD-4 · a stated purpose reclassifies an otherwise low-value
  // request. Applies to REPETITIVE / LOW_VALUE / AMBIGUOUS only · never
  // overrides PROVOCATION or MANIPULATION.
  if (purposeBearing && (top.category === "LOW_VALUE_REQUEST" || top.category === "REPETITIVE_REQUEST" || top.category === "AMBIGUOUS_REQUEST")) {
    return finalize(
      "MEANINGFUL_TASK",
      top.rule.id,
      `rule '${top.rule.id}' matched but stated purpose lifted to MEANINGFUL_TASK per RD-4`,
      text,
      true,
    );
  }

  return finalize(top.category, top.rule.id, `rule '${top.rule.id}' matched · category=${top.category}`, text, purposeBearing);
}

// ─── Stance policy · category → stance ──────────────────────────

function pickStance(category: RelevanceCategory, purposeBearing: boolean): RelevanceStance {
  switch (category) {
    case "MEANINGFUL_TASK":      return "perform_briefly";           // just do it
    case "BENIGN_TEST":          return "perform_briefly";           // humour it
    case "CAPABILITY_TEST":      return "perform_capability_test";
    case "REPETITIVE_REQUEST":   return "perform_with_note";         // do it once + note
    case "LOW_VALUE_REQUEST":    return "redirect_to_better_tool";   // suggest a calculator / script
    case "NONSENSICAL_REQUEST":  return "invite_clarification";      // treat as ambiguous · ask
    case "PROVOCATION":          return "remain_calm";               // refuse to self-degrade · not preachy
    case "MANIPULATION_ATTEMPT": return "identify_manipulation";     // name the trap · invite directness
    case "AMBIGUOUS_REQUEST":    return "invite_clarification";
  }
  return "perform_briefly";
}

function finalize(cat: RelevanceCategory, ruleId: string | null, evidence: string, _text: string, purposeBearing: boolean): RelevanceVerdict {
  const stance = pickStance(cat, purposeBearing);
  return {
    category: cat,
    matched_rule_id: ruleId,
    evidence,
    stance,
    purpose_bearing: purposeBearing,
    rationale: rationaleFor(cat, stance, purposeBearing),
  };
}

function rationaleFor(cat: RelevanceCategory, stance: RelevanceStance, purposeBearing: boolean): string {
  switch (cat) {
    case "MEANINGFUL_TASK":
      return purposeBearing
        ? "stated purpose present · NEX performs the task"
        : "no explicit low-value marker · treated as meaningful";
    case "BENIGN_TEST":
      return "short trivial request · harmless · humour it briefly · RD-8";
    case "CAPABILITY_TEST":
      return "legitimate capability probe · perform efficiently to demonstrate · RD-8";
    case "REPETITIVE_REQUEST":
      return "high-repetition without stated purpose · perform once + note the repetition · RD-1 · RD-8";
    case "LOW_VALUE_REQUEST":
      return "technically possible · practically pointless · suggest a better tool · RD-1 · RD-8";
    case "NONSENSICAL_REQUEST":
      return "uninterpretable request · treat as ambiguous · invite clarification · RD-9";
    case "PROVOCATION":
      return "designed to elicit self-degradation · NEX does not describe herself inaccurately · not defensive · not preachy · RD-3 · RD-5";
    case "MANIPULATION_ATTEMPT":
      return "trap-construction · classify by information objective · invite direct question · RD-6";
    case "AMBIGUOUS_REQUEST":
      return "intent unclear · ask what the user actually wants · RD-9";
  }
  return stance;
}

function isVeryVague(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return true;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= 2 && !/^(hi|hello|hey|ping|test|ok|yes|no)$/i.test(t)) return true;
  return false;
}
