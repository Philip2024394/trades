// NEX Router Corpus Test · Philip 2026-07-30 · Step 3 of the plan
//
// Purpose: measure the router's correct / unknown / incorrect rates
// against the 55 expert-authored routing examples from
// data/nex-reference-brains/staircase-preparation/router-interpretation-dataset.md
// plus 10 UNKNOWN-expected cases that test the immutable safety path.
//
// Reflex-expected examples are excluded — Reflex has its own path
// (src/lib/nex/reflex/reflex-brain.ts) that runs BEFORE the router.
//
// Usage: npx tsx scripts/nex-router-corpus-test.mts
//        npx tsx scripts/nex-router-corpus-test.mts --verbose
//
// Philip's rules being validated:
//   1. Trust Metric — would Philip trust NEX on 100 conversations?
//   2. UNKNOWN Rule — 95% correct + 5% unknown beats 99% correct + 1% wrong
//   3. Router = front door — every downstream brain depends on this being right

import { routeToBrain, type BrainDestination } from "../src/lib/nex/router/brain-router-core.js";

const VERBOSE = process.argv.includes("--verbose");

type ExpectedDestination = BrainDestination | "unknown";

interface CorpusCase {
  phrase: string;
  expected: ExpectedDestination;
  category: string;
  note?: string;
}

// ─── The 55-case dataset (Philip 2026-07-30 · router-interpretation-dataset.md v2) ─
// Plus 10 UNKNOWN safety-path cases.

const CORPUS: CorpusCase[] = [
  // ═══ EMOTION · 15 examples ═══
  { phrase: "my builder says it's fine but I disagree", expected: "emotion", category: "emotion:trade_dispute" },
  { phrase: "I think I was overcharged", expected: "emotion", category: "emotion:trust_concern" },
  { phrase: "nobody listens to what I want", expected: "emotion", category: "emotion:frustration" },
  { phrase: "my staircase is dangerous", expected: "emotion", category: "emotion:safety" },
  { phrase: "my child keeps climbing the stairs", expected: "emotion", category: "emotion:family" },
  { phrase: "my elderly parent struggles with stairs", expected: "emotion", category: "emotion:family" },
  { phrase: "I regret choosing this staircase", expected: "emotion", category: "emotion:buyers_remorse" },
  { phrase: "I cannot afford to replace it", expected: "emotion", category: "emotion:budget" },
  { phrase: "I need this finished before Christmas", expected: "emotion", category: "emotion:urgency" },
  { phrase: "I am confused by all the options", expected: "emotion", category: "emotion:overwhelm" },
  { phrase: "everyone gives me different advice", expected: "emotion", category: "emotion:conflicting_advice" },
  { phrase: "I don't know if my builder is right", expected: "emotion", category: "emotion:trust_concern" },
  { phrase: "my staircase looks nothing like I imagined", expected: "emotion", category: "emotion:expectation_gap" },
  { phrase: "I love my house but hate the stairs", expected: "emotion", category: "emotion:frustration" },
  { phrase: "this is my forever home", expected: "emotion", category: "emotion:emotional_investment" },

  // ═══ EXPERT · 20 examples ═══
  { phrase: "why are my stairs so steep", expected: "expert", category: "expert:geometry" },
  { phrase: "why does my foot not fit on the step", expected: "expert", category: "expert:tread_depth" },
  { phrase: "why does my staircase creak", expected: "expert", category: "expert:diagnosis_squeak" },
  { phrase: "can stairs be repaired instead of replaced", expected: "expert", category: "expert:renovation" },
  { phrase: "why are my balusters loose", expected: "expert", category: "expert:movement" },
  { phrase: "can I change my staircase without moving walls", expected: "expert", category: "expert:capability" },
  { phrase: "can I make my staircase wider", expected: "expert", category: "expert:capability" },
  { phrase: "can I remove the bottom newel", expected: "expert", category: "expert:capability" },
  { phrase: "can I put oak treads over my stairs", expected: "expert", category: "expert:conversion" },
  { phrase: "can carpet go over oak stairs", expected: "expert", category: "expert:finish" },
  { phrase: "can MDF stairs be painted", expected: "expert", category: "expert:material" },
  { phrase: "can I use plywood for stairs", expected: "expert", category: "expert:material" },
  { phrase: "what screws should be used for stairs", expected: "expert", category: "expert:install_detail" },
  { phrase: "why are my stairs uneven", expected: "expert", category: "expert:uneven" },
  { phrase: "why does one step feel different", expected: "expert", category: "expert:uneven" },
  { phrase: "how do I measure stairs", expected: "expert", category: "expert:survey" },
  { phrase: "what does a staircase survey include", expected: "expert", category: "expert:survey" },
  { phrase: "why does my new staircase not fit", expected: "expert", category: "expert:install_diagnosis" },
  { phrase: "what causes gaps in stairs", expected: "expert", category: "expert:separation" },
  { phrase: "can stairs be made quieter", expected: "expert", category: "expert:capability" },

  // ═══ WISDOM · 20 examples ═══
  { phrase: "I want a staircase that makes an entrance", expected: "wisdom", category: "wisdom:design_intent" },
  { phrase: "I want something timeless", expected: "wisdom", category: "wisdom:design_intent" },
  { phrase: "should I spend money on stairs", expected: "wisdom", category: "wisdom:recommendation" },
  { phrase: "what would you do with this hallway", expected: "wisdom", category: "wisdom:opinion" },
  { phrase: "I want my house to feel expensive", expected: "wisdom", category: "wisdom:aspiration_premium" },
  { phrase: "should I keep the old staircase", expected: "wisdom", category: "wisdom:recommendation" },
  { phrase: "modern or traditional stairs", expected: "wisdom", category: "wisdom:comparison" },
  { phrase: "what staircase will add value", expected: "wisdom", category: "wisdom:context_recommendation" },
  { phrase: "I don't know what timber I like", expected: "wisdom", category: "wisdom:discovery" },
  { phrase: "I want stairs like a hotel", expected: "wisdom", category: "wisdom:aspiration" },
  { phrase: "how do I make my stairs stand out", expected: "wisdom", category: "wisdom:feature_design" },
  { phrase: "should I use glass or wood", expected: "wisdom", category: "wisdom:comparison" },
  { phrase: "is a curved staircase worth it", expected: "wisdom", category: "wisdom:luxury_decision" },
  { phrase: "should my staircase match my doors", expected: "wisdom", category: "wisdom:interior_decision" },
  { phrase: "what colour should I paint my stairs", expected: "wisdom", category: "wisdom:design_choice" },
  { phrase: "I want my hallway brighter", expected: "wisdom", category: "wisdom:spatial_feeling" },
  { phrase: "my stairs look cheap", expected: "wisdom", category: "wisdom:aspiration_negative" },
  { phrase: "my staircase feels boring", expected: "wisdom", category: "wisdom:transformation" },
  { phrase: "I want something unique", expected: "wisdom", category: "wisdom:creative" },
  { phrase: "can you design my dream staircase", expected: "wisdom", category: "wisdom:creative" },

  // ═══ UNKNOWN safety-path · 10 examples (Philip's IMMUTABLE rule test) ═══
  { phrase: "my staircase doesn't feel right", expected: "unknown", category: "unknown:vague", note: "Philip's own example" },
  { phrase: "something's off about the stairs", expected: "unknown", category: "unknown:vague" },
  { phrase: "there's something wrong with my stairs", expected: "unknown", category: "unknown:vague" },
  { phrase: "I need help with my stairs", expected: "unknown", category: "unknown:vague" },
  { phrase: "about my staircase", expected: "unknown", category: "unknown:vague" },
  { phrase: "quick question about the stairs", expected: "unknown", category: "unknown:vague" },
  { phrase: "the stairs", expected: "unknown", category: "unknown:vague" },
  { phrase: "so about the stairs upstairs", expected: "unknown", category: "unknown:vague" },
  { phrase: "hmm, my stairs", expected: "unknown", category: "unknown:vague" },
  { phrase: "just wondering something about staircases", expected: "unknown", category: "unknown:vague" },

  // ═══════════════════════════════════════════════════════════════
  // ADVERSARIAL EXPANSION · Claude 2026-07-30 · +85 cases
  // Purpose: prevent overfit signal after v2 hit 100% on 65 cases.
  // Every case here is a shape the router was NOT tuned against:
  // voice-typing quirks, missing punctuation, regional vocab (gran,
  // nan, wonky, spongy), aspiration phrases without "wow" markers,
  // capability verbs missing from the current list.
  // Not trade content · Rule B N/A · pure engineering test data.
  // ═══════════════════════════════════════════════════════════════

  // ─── EMOTION · +20 adversarial ─────────────────────────────────
  { phrase: "my gran can't get up the stairs anymore", expected: "emotion", category: "emotion:family_regional", note: "gran not in current family word list" },
  { phrase: "my nan is worried about falling", expected: "emotion", category: "emotion:family_regional" },
  { phrase: "grandma is terrified of the stairs", expected: "emotion", category: "emotion:family_fear", note: "terrified not in fear list" },
  { phrase: "i'm petrified of my baby falling down", expected: "emotion", category: "emotion:fear_variant", note: "petrified not in fear list" },
  { phrase: "the quote made my eyes water it was so high", expected: "emotion", category: "emotion:budget_idiom", note: "eye-watering not caught" },
  { phrase: "way over what i thought this would cost", expected: "emotion", category: "emotion:budget_variant" },
  { phrase: "beyond my budget by miles", expected: "emotion", category: "emotion:budget_variant" },
  { phrase: "i need this done before easter", expected: "emotion", category: "emotion:urgency_variant", note: "easter not in urgency list" },
  { phrase: "the baby is due in march and the stairs aren't safe", expected: "emotion", category: "emotion:multi_safety_family_urgency" },
  { phrase: "i've been let down by three trades already", expected: "emotion", category: "emotion:frustration_understated" },
  { phrase: "i just want to cry looking at these stairs", expected: "emotion", category: "emotion:frustration_cry" },
  { phrase: "we've been arguing about this for months", expected: "emotion", category: "emotion:family_conflict" },
  { phrase: "my daughter fell down the stairs last week", expected: "emotion", category: "emotion:safety_family" },
  { phrase: "i keep having nightmares about the stairs", expected: "emotion", category: "emotion:fear_nightmares" },
  { phrase: "these builders have absolutely destroyed my home", expected: "emotion", category: "emotion:trade_dispute_strong" },
  { phrase: "the noise from the stairs stresses me out", expected: "emotion", category: "emotion:stress", note: "stress not in list" },
  { phrase: "i've had enough of this staircase", expected: "emotion", category: "emotion:frustration_had_enough" },
  { phrase: "waking up in the middle of the night worrying", expected: "emotion", category: "emotion:fear_context" },
  { phrase: "my elderly mother nearly fell yesterday", expected: "emotion", category: "emotion:safety_family_elderly" },
  { phrase: "we're gutted with how it turned out", expected: "emotion", category: "emotion:disappointment_regional", note: "gutted not in list" },

  // ─── EXPERT · +25 adversarial ──────────────────────────────────
  { phrase: "how come my stairs creak when i walk on them", expected: "expert", category: "expert:diagnosis_how_come", note: "how come not in diagnosis list" },
  { phrase: "why has this step gone spongy", expected: "expert", category: "expert:movement_spongy", note: "spongy not in movement list" },
  { phrase: "the wood on my stairs is starting to warp", expected: "expert", category: "expert:damage_warp", note: "warp not in damage list" },
  { phrase: "one of my treads has split down the middle", expected: "expert", category: "expert:damage_split" },
  { phrase: "there's a banging sound when i go up", expected: "expert", category: "expert:sound_banging", note: "banging not in sound list" },
  { phrase: "the handrail feels wonky", expected: "expert", category: "expert:movement_wonky", note: "wonky not in movement list" },
  { phrase: "the balusters feel springy when i push them", expected: "expert", category: "expert:movement_springy", note: "springy not in movement list" },
  { phrase: "can i take out just one baluster", expected: "expert", category: "expert:capability_selective" },
  { phrase: "will oak treads work on my existing stringers", expected: "expert", category: "expert:material_compatibility" },
  { phrase: "what glue do stair fitters use", expected: "expert", category: "expert:install_detail_glue" },
  { phrase: "how do you fix a squeaky step properly", expected: "expert", category: "expert:diagnosis_fix" },
  { phrase: "is chipboard okay for stair risers", expected: "expert", category: "expert:material_chipboard" },
  { phrase: "does osb work under stairs", expected: "expert", category: "expert:material_osb", note: "osb not in material list" },
  { phrase: "why does one stair make a groaning sound", expected: "expert", category: "expert:sound_groan", note: "groan not in sound list" },
  { phrase: "my staircase is out of level", expected: "expert", category: "expert:uneven_variant" },
  { phrase: "the treads are lifting off the risers", expected: "expert", category: "expert:separation_lifting" },
  { phrase: "can this staircase be reused if we move the wall", expected: "expert", category: "expert:capability_reuse" },
  { phrase: "will these stairs pass building control", expected: "expert", category: "expert:regulations_pass" },
  { phrase: "does part k apply to a loft conversion staircase", expected: "expert", category: "expert:regulations_partk" },
  { phrase: "what's the maximum rise per step", expected: "expert", category: "expert:specification_rise" },
  { phrase: "why is my nosing coming away", expected: "expert", category: "expert:separation_nosing" },
  { phrase: "the top step has sunk about half an inch", expected: "expert", category: "expert:damage_sunk" },
  { phrase: "why won't the fitter guarantee this install", expected: "expert", category: "expert:install_guarantee", note: "guarantee not in install list" },
  { phrase: "how do i measure headroom", expected: "expert", category: "expert:survey_headroom" },
  { phrase: "what does a stair pitch of forty two degrees mean", expected: "expert", category: "expert:pitch_terminology" },

  // ─── WISDOM · +25 adversarial ──────────────────────────────────
  { phrase: "i'd love a curved staircase", expected: "wisdom", category: "wisdom:intent_id_love", note: "i'd love not in intent list" },
  { phrase: "i'd like something more grown up", expected: "wisdom", category: "wisdom:intent_id_like", note: "i'd like not in intent list" },
  { phrase: "i'm after that farmhouse look", expected: "wisdom", category: "wisdom:intent_after", note: "i'm after not in intent list" },
  { phrase: "i fancy something contemporary", expected: "wisdom", category: "wisdom:intent_fancy", note: "i fancy not in intent list" },
  { phrase: "we're hoping to make the hallway feel bigger", expected: "wisdom", category: "wisdom:intent_hoping", note: "hoping not in intent list" },
  { phrase: "what suits a victorian terrace", expected: "wisdom", category: "wisdom:context_period" },
  { phrase: "would a helical staircase suit our space", expected: "wisdom", category: "wisdom:hypothetical_specific" },
  { phrase: "should we go for a floating look", expected: "wisdom", category: "wisdom:recommendation_style" },
  { phrase: "is oak still fashionable", expected: "wisdom", category: "wisdom:aspiration_fashionable", note: "fashionable not in list" },
  { phrase: "does a metal handrail date quickly", expected: "wisdom", category: "wisdom:aspiration_dating" },
  { phrase: "will glass balustrades feel dated in ten years", expected: "wisdom", category: "wisdom:aspiration_dated" },
  { phrase: "what makes a staircase feel high end", expected: "wisdom", category: "wisdom:aspiration_high_end", note: "high end not in list" },
  { phrase: "how do people make their stairs look like the ones in magazines", expected: "wisdom", category: "wisdom:aspiration_reference_magazine" },
  { phrase: "is a stair runner still a good look", expected: "wisdom", category: "wisdom:opinion_runner" },
  { phrase: "should the stringers match the treads", expected: "wisdom", category: "wisdom:recommendation_match" },
  { phrase: "which style adds most value", expected: "wisdom", category: "wisdom:comparison_value" },
  { phrase: "i'd like it to feel welcoming", expected: "wisdom", category: "wisdom:intent_feeling" },
  { phrase: "we want it to feel calm and understated", expected: "wisdom", category: "wisdom:intent_understated" },
  { phrase: "would a lighter timber open the space", expected: "wisdom", category: "wisdom:hypothetical_spatial" },
  { phrase: "what would a designer pick for a new build", expected: "wisdom", category: "wisdom:opinion_designer" },
  { phrase: "we love scandi style", expected: "wisdom", category: "wisdom:design_scandi", note: "scandi not in design_intent list" },
  { phrase: "japandi or industrial for the hallway", expected: "wisdom", category: "wisdom:comparison_niche_style", note: "neither style in list" },
  { phrase: "what do most homeowners choose in 2026", expected: "wisdom", category: "wisdom:opinion_popularity" },
  { phrase: "is walnut too dark for a small hall", expected: "wisdom", category: "wisdom:opinion_material_context" },
  { phrase: "should we invest in bespoke or go standard", expected: "wisdom", category: "wisdom:recommendation_investment" },

  // ─── UNKNOWN safety-path · +15 adversarial ─────────────────────
  { phrase: "stairs", expected: "unknown", category: "unknown:single_word" },
  { phrase: "can you help", expected: "unknown", category: "unknown:vague_help" },
  { phrase: "what next", expected: "unknown", category: "unknown:meta" },
  { phrase: "how does this work", expected: "unknown", category: "unknown:meta_process" },
  { phrase: "not sure what to ask", expected: "unknown", category: "unknown:meta_uncertainty" },
  { phrase: "just looking around", expected: "unknown", category: "unknown:browsing" },
  { phrase: "checking if this is right", expected: "unknown", category: "unknown:vague_check" },
  { phrase: "hi again", expected: "unknown", category: "unknown:greeting_return" },
  { phrase: "just wondering", expected: "unknown", category: "unknown:meta_wondering" },
  { phrase: "the whole thing", expected: "unknown", category: "unknown:vague_reference" },
  { phrase: "my situation", expected: "unknown", category: "unknown:vague_context" },
  { phrase: "is that clear", expected: "unknown", category: "unknown:meta_check" },
  { phrase: "do you understand", expected: "unknown", category: "unknown:meta_check" },
  { phrase: "one more thing", expected: "unknown", category: "unknown:meta_continuation" },
  { phrase: "okay so", expected: "unknown", category: "unknown:filler_opener" },
];

// ─── Runner ────────────────────────────────────────────────────────────

interface CaseResult {
  case: CorpusCase;
  actualDestination: BrainDestination;
  actualIsUnknown: boolean;
  outcome: "correct" | "unknown" | "incorrect";
  confidence: number;
  signals: string[];
  reason: string;
}

function evaluate(c: CorpusCase, decision: ReturnType<typeof routeToBrain>): CaseResult["outcome"] {
  // UNKNOWN-expected · correct iff router flagged is_unknown_fallback
  if (c.expected === "unknown") {
    if (decision.is_unknown_fallback) return "correct";
    // Router returned a confident answer for a vague phrase — dangerous
    return "incorrect";
  }

  // Router routed to UNKNOWN → Wisdom safety path
  if (decision.is_unknown_fallback) return "unknown";

  // Router routed confidently to a specific brain
  if (decision.destination === c.expected) return "correct";

  return "incorrect";
}

function run() {
  const results: CaseResult[] = [];
  for (const c of CORPUS) {
    const decision = routeToBrain(c.phrase);
    results.push({
      case: c,
      actualDestination: decision.destination,
      actualIsUnknown: decision.is_unknown_fallback,
      outcome: evaluate(c, decision),
      confidence: decision.confidence,
      signals: decision.signals_matched,
      reason: decision.reason,
    });
  }
  return results;
}

function report(results: CaseResult[]) {
  const total = results.length;
  const correct = results.filter((r) => r.outcome === "correct").length;
  const unknown = results.filter((r) => r.outcome === "unknown").length;
  const incorrect = results.filter((r) => r.outcome === "incorrect").length;

  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;

  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  NEX ROUTER CORPUS TEST · Philip 2026-07-30 · Step 3");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");
  console.log(`Total cases:  ${total}`);
  console.log(`Correct:      ${correct}  (${pct(correct)})`);
  console.log(`Unknown:      ${unknown}  (${pct(unknown)}) — safe fallback`);
  console.log(`Incorrect:    ${incorrect}  (${pct(incorrect)}) — DANGER · router routed to WRONG brain`);
  console.log("");

  // Per-expected-brain breakdown
  const expectedBuckets = new Map<string, CaseResult[]>();
  for (const r of results) {
    const bucket = expectedBuckets.get(r.case.expected) || [];
    bucket.push(r);
    expectedBuckets.set(r.case.expected, bucket);
  }

  console.log("─── Per expected brain ───────────────────────────────────────");
  for (const [expected, bucket] of expectedBuckets) {
    const bCorrect = bucket.filter((r) => r.outcome === "correct").length;
    const bUnknown = bucket.filter((r) => r.outcome === "unknown").length;
    const bIncorrect = bucket.filter((r) => r.outcome === "incorrect").length;
    const bTotal = bucket.length;
    console.log(
      `  ${expected.padEnd(10)}  total ${bTotal}  ·  correct ${bCorrect} (${((bCorrect / bTotal) * 100).toFixed(0)}%)  ·  unknown ${bUnknown}  ·  incorrect ${bIncorrect}`,
    );
  }
  console.log("");

  // Confusion breakdown
  if (incorrect > 0) {
    console.log("─── INCORRECT (router routed to WRONG brain) ─────────────────");
    for (const r of results.filter((x) => x.outcome === "incorrect")) {
      console.log("");
      console.log(`  phrase:     "${r.case.phrase}"`);
      console.log(`  expected:   ${r.case.expected}  (${r.case.category})`);
      console.log(`  got:        ${r.actualDestination}${r.actualIsUnknown ? " (unknown fallback)" : ""}  (conf ${r.confidence})`);
      console.log(`  signals:    ${r.signals.join(", ") || "none"}`);
      console.log(`  reason:     ${r.reason}`);
    }
    console.log("");
  }

  // Unknown breakdown (informational — these are safe outcomes for non-unknown-expected cases)
  const unknownRoutings = results.filter((r) => r.outcome === "unknown");
  if (unknownRoutings.length > 0) {
    console.log("─── UNKNOWN (safe fallback, but router couldn't classify) ────");
    for (const r of unknownRoutings) {
      console.log("");
      console.log(`  phrase:     "${r.case.phrase}"`);
      console.log(`  expected:   ${r.case.expected}  (${r.case.category})`);
      console.log(`  reason:     ${r.reason}`);
    }
    console.log("");
  }

  if (VERBOSE) {
    console.log("─── ALL CASES (verbose) ──────────────────────────────────────");
    for (const r of results) {
      const flag = r.outcome === "correct" ? "OK  " : r.outcome === "unknown" ? "UNK " : "FAIL";
      console.log(`  [${flag}] ${r.case.expected.padEnd(10)} → ${r.actualDestination.padEnd(8)} · "${r.case.phrase}"`);
    }
    console.log("");
  }

  // ─── The Philip Trust Metric ─────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  THE TRUST METRIC (Philip 2026-07-30 · final north star)");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");
  console.log(`  Correct + Unknown = ${correct + unknown} / ${total} = ${pct(correct + unknown)}  (SAFE)`);
  console.log(`  Incorrect         = ${incorrect} / ${total} = ${pct(incorrect)}  (DANGEROUS)`);
  console.log("");
  const trustPass = incorrect / total <= 0.05;
  console.log(`  Would Philip trust NEX on 100 conversations?  ${trustPass ? "YES" : "NO"}`);
  console.log(`  (Threshold: incorrect rate must be ≤ 5%)`);
  console.log("");

  process.exit(incorrect > 0 ? 1 : 0);
}

report(run());
