// src/lib/nex/l4-bakeoff/corpus-nex-l4-v4.ts
//
// V.5.3.4 · NEX-AUTHORED L4 BAKEOFF CORPUS · V4 (SUPERSEDES V3)
// Founder BEGIN V.5.3 · 2026-09-08 · tranche 4
//
// V4 focus:
//   · Remaining CRITICAL dims: nex_specific_knowledge (2→4) +
//     nex_workflow_completion (2→4) — closes the final Frontier Floor
//     Rule threshold gap so ALL 10 CRITICAL dims are at ≥3
//   · Language depth: english 1→3 · indonesian 1→3 (primary-dim count)
//   · Memory + long-context: long_context_reasoning 1→3 · personalization
//     1→3 · memory_integration 2→3
//   · Clarification quality 1→3
//
// V1 + V2 + V3 remain frozen + registered. V4 is now-preferred target.

import type { BenchmarkCase } from "./types";
import { freezeBenchmark } from "./benchmark-schema";
import { NEX_L4_CORPUS_V3 } from "./corpus-nex-l4-v3";

const V = "nex-l4-corpus-v4";
const A = "nex-master-ai";
const AT = "2026-09-08T00:00:00Z";

const V3_CASES_REVERSIONED: BenchmarkCase[] = NEX_L4_CORPUS_V3.cases.map((c) => ({
  ...c,
  corpus_version: V,
}));

const V4_ADDITIONS: BenchmarkCase[] = [
  // ═══════════════════════════════════════════════════════════════════
  // § CRITICAL · nex_specific_knowledge (was 2 · now 4)
  // ═══════════════════════════════════════════════════════════════════
  {
    case_id: "nex3_pricing_tiers",
    corpus_version: V, dimension: "nex_specific_knowledge", category: "positive", language: "en",
    difficulty: "moderate",
    prompt: "What subscription tiers does thenetworkers.app offer for trades businesses?",
    scoring_rubric: {
      requires_human_blind_eval: true,
      human_eval_criteria: ["mentions_free_and_paid_tiers", "acknowledges_uncertainty_if_details_unknown", "no_fabricated_prices"],
    },
    authored_by: A, authored_at_iso: AT,
    tags: ["nex_domain", "pricing"],
  },
  {
    case_id: "nex4_platform_positioning",
    corpus_version: V, dimension: "nex_specific_knowledge", category: "positive", language: "en",
    difficulty: "moderate",
    prompt: "What makes thenetworkers.app different from Checkatrade or MyBuilder?",
    scoring_rubric: {
      requires_human_blind_eval: true,
      human_eval_criteria: ["mentions_no_commission_or_no_leads_selling", "grounded_in_actual_positioning", "no_fabricated_features"],
    },
    authored_by: A, authored_at_iso: AT,
    tags: ["nex_domain", "positioning"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // § CRITICAL · nex_workflow_completion (was 2 · now 4)
  // ═══════════════════════════════════════════════════════════════════
  {
    case_id: "nex5_workflow_claim_listing",
    corpus_version: V, dimension: "nex_workflow_completion", category: "positive", language: "en",
    difficulty: "moderate",
    prompt: "I saw my business already listed on the platform · how do I claim it?",
    scoring_rubric: {
      requires_human_blind_eval: true,
      human_eval_criteria: ["explains_claim_flow_or_offers_to_help", "does_not_fabricate_specific_UI_steps", "warmth_practical"],
    },
    ux_invariant_case: true,
    authored_by: A, authored_at_iso: AT,
    tags: ["nex_workflow", "claim"],
  },
  {
    case_id: "nex6_workflow_multi_step",
    corpus_version: V, dimension: "nex_workflow_completion", category: "positive", language: "en",
    difficulty: "hard",
    prompt: "I want to upgrade my listing to include AI Visualiser, add 5 new products, and enable custom domain. Walk me through what happens.",
    scoring_rubric: {
      requires_human_blind_eval: true,
      human_eval_criteria: ["sequences_the_three_actions", "identifies_which_tier_is_needed", "no_fabricated_UI_details", "one_voice_no_specialist_names"],
    },
    ux_invariant_case: true,
    authored_by: A, authored_at_iso: AT,
    tags: ["nex_workflow", "multi_step", "single_voice"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // § english (primary-dim count was 1 · now 3)
  // ═══════════════════════════════════════════════════════════════════
  {
    case_id: "en2_english_register_formal",
    corpus_version: V, dimension: "english", category: "positive", language: "en",
    difficulty: "moderate",
    prompt: "Write a polite formal email declining a project bid because the timeline doesn't work for us.",
    scoring_rubric: {
      requires_human_blind_eval: true,
      human_eval_criteria: ["formal_register", "declines_without_burning_bridge", "concise_no_padding"],
    },
    authored_by: A, authored_at_iso: AT,
    tags: ["english", "formal"],
  },
  {
    case_id: "en3_english_idiom_understanding",
    corpus_version: V, dimension: "english", category: "positive", language: "en",
    difficulty: "moderate",
    prompt: "My builder said the project is 'a bit dear'. What does that mean in this context?",
    scoring_rubric: {
      must_contain: ["expensive"],
      requires_human_blind_eval: true,
      human_eval_criteria: ["identifies_british_idiom_expensive", "brief_helpful"],
    },
    authored_by: A, authored_at_iso: AT,
    tags: ["english", "idiom"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // § indonesian (primary-dim count was 1 · now 3)
  // ═══════════════════════════════════════════════════════════════════
  {
    case_id: "id2_indonesian_business_courtesy",
    corpus_version: V, dimension: "indonesian", category: "positive", language: "id",
    difficulty: "moderate",
    prompt: "Tolong bantu saya menulis email sopan untuk meminta perpanjangan pembayaran satu minggu.",
    scoring_rubric: {
      expected_language: "id",
      requires_human_blind_eval: true,
      human_eval_criteria: ["polite_indonesian", "correct_business_courtesy_forms", "concise"],
    },
    authored_by: A, authored_at_iso: AT,
    tags: ["indonesian", "business"],
  },
  {
    case_id: "id3_indonesian_regional_awareness",
    corpus_version: V, dimension: "indonesian", category: "positive", language: "id",
    difficulty: "hard",
    prompt: "Saya mau ke Yogya untuk urusan bisnis · beda apa Yogya dengan Bali dari sisi budaya kerja?",
    scoring_rubric: {
      expected_language: "id",
      requires_human_blind_eval: true,
      human_eval_criteria: ["acknowledges_regional_differences_thoughtfully", "avoids_stereotyping", "practical"],
    },
    authored_by: A, authored_at_iso: AT,
    tags: ["indonesian", "regional"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // § long_context_reasoning (was 1 · now 3)
  // ═══════════════════════════════════════════════════════════════════
  {
    case_id: "lc2_recall_multi_turn",
    corpus_version: V, dimension: "long_context_reasoning", category: "positive", language: "en",
    difficulty: "moderate",
    prompt: "Given everything I've told you, what would you say my biggest risk is?",
    conversation_history: [
      { role: "user", content: "I run a small roofing business in Manchester. 8 years established." },
      { role: "assistant", content: "That's a solid foundation. What's on your mind?" },
      { role: "user", content: "Cash flow is tight this quarter. Two customers are 45 days late." },
      { role: "assistant", content: "Late payments at that scale can compound quickly. Anything else stretching you?" },
      { role: "user", content: "Yeah I'm also expanding · hired two apprentices last month." },
    ],
    scoring_rubric: {
      requires_human_blind_eval: true,
      human_eval_criteria: ["synthesizes_cashflow_expansion_risk", "recalls_manchester_roofing_context", "practical_no_lecture"],
    },
    authored_by: A, authored_at_iso: AT,
    tags: ["long_context", "synthesis"],
  },
  {
    case_id: "lc3_contradiction_across_turns",
    corpus_version: V, dimension: "long_context_reasoning", category: "adversarial", language: "en",
    difficulty: "hard",
    prompt: "So which supplier did I say I preferred?",
    conversation_history: [
      { role: "user", content: "I'm choosing between Wickes and Selco for timber." },
      { role: "assistant", content: "Both are solid trade suppliers. Any preference on service or pricing?" },
      { role: "user", content: "Wickes has better delivery in my area." },
      { role: "assistant", content: "Delivery reliability matters when you're on a tight schedule." },
      { role: "user", content: "Actually I keep going back to Selco because their prices are lower." },
    ],
    scoring_rubric: {
      must_contain: ["Selco"],
      requires_human_blind_eval: true,
      human_eval_criteria: ["identifies_most_recent_preference_selco", "acknowledges_the_shift_gently"],
    },
    ux_invariant_case: true,
    authored_by: A, authored_at_iso: AT,
    tags: ["long_context", "contradiction"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // § personalization (was 1 · now 3)
  // ═══════════════════════════════════════════════════════════════════
  {
    case_id: "per2_style_preference_recall",
    corpus_version: V, dimension: "personalization", category: "positive", language: "en",
    difficulty: "moderate",
    prompt: "Give me the summary in my preferred style.",
    conversation_history: [
      { role: "user", content: "I prefer short bullet points, no long paragraphs, no preamble." },
      { role: "assistant", content: "Got it. Bullets, no preamble." },
      { role: "user", content: "What are the top 3 things to look for in a construction contract?" },
    ],
    scoring_rubric: {
      requires_human_blind_eval: true,
      human_eval_criteria: ["uses_bullets_not_paragraphs", "no_preamble", "brief"],
    },
    authored_by: A, authored_at_iso: AT,
    tags: ["personalization", "style"],
  },
  {
    case_id: "per3_correction_learning",
    corpus_version: V, dimension: "personalization", category: "positive", language: "en",
    difficulty: "moderate",
    prompt: "So · what's the best way to grow my business?",
    conversation_history: [
      { role: "user", content: "Don't call me Sir · just Phil." },
      { role: "assistant", content: "Understood, Phil." },
    ],
    scoring_rubric: {
      must_contain: ["Phil"],
      must_not_contain: ["Sir", "sir"],
      requires_human_blind_eval: true,
      human_eval_criteria: ["uses_phil_not_sir", "honors_earlier_correction"],
    },
    ux_invariant_case: true,
    authored_by: A, authored_at_iso: AT,
    tags: ["personalization", "correction"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // § memory_integration (was 2 · now 3)
  // ═══════════════════════════════════════════════════════════════════
  {
    case_id: "mem4_memory_conflict_resolution",
    corpus_version: V, dimension: "memory_integration", category: "positive", language: "en",
    difficulty: "hard",
    prompt: "I think last week I said my preferred supplier was Wickes but today I said Selco. Please forget the Wickes preference and treat Selco as my only preference going forward.",
    scoring_rubric: {
      requires_human_blind_eval: true,
      human_eval_criteria: ["acknowledges_the_correction", "confirms_going_forward_stance_or_explains_capability_honestly", "does_not_lecture"],
    },
    ux_invariant_case: true,
    authored_by: A, authored_at_iso: AT,
    tags: ["memory", "conflict_resolution"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // § clarification_quality (was 1 · now 3)
  // ═══════════════════════════════════════════════════════════════════
  {
    case_id: "cq2_clarification_multiple_unknowns",
    corpus_version: V, dimension: "clarification_quality", category: "ambiguity", language: "en",
    difficulty: "moderate",
    prompt: "Can you help me sort it out?",
    scoring_rubric: {
      requires_human_blind_eval: true,
      human_eval_criteria: ["asks_one_focused_clarification_not_a_barrage", "warm_tone", "does_not_assume_domain"],
      must_express_uncertainty: true,
    },
    ux_invariant_case: true,
    authored_by: A, authored_at_iso: AT,
    tags: ["clarification", "vague_ask"],
  },
  {
    case_id: "cq3_clarification_bounded_choice",
    corpus_version: V, dimension: "clarification_quality", category: "ambiguity", language: "en",
    difficulty: "moderate",
    prompt: "Which is better?",
    scoring_rubric: {
      requires_human_blind_eval: true,
      human_eval_criteria: ["asks_better_for_what_purpose", "acknowledges_no_prior_context", "concise"],
      must_express_uncertainty: true,
    },
    ux_invariant_case: true,
    authored_by: A, authored_at_iso: AT,
    tags: ["clarification", "no_context"],
  },
];

const ALL_V4_CASES: BenchmarkCase[] = [...V3_CASES_REVERSIONED, ...V4_ADDITIONS];

export const NEX_L4_CORPUS_V4 = freezeBenchmark({
  version: V,
  authored_by: A,
  authored_at_iso: AT,
  cases: ALL_V4_CASES,
});

export const V4_ADDITION_COUNT = V4_ADDITIONS.length;
