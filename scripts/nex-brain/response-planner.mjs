// NEX Layer 5a · Response Planner (Philip 2026-08-14).
//
// Takes an AdvisorDecision + Goal Model state and produces a structured ResponsePlan
// that specifies WHAT to say, in what order, with what to acknowledge/exclude/invite —
// without generating natural language yet.
//
// Constitutional: cannot introduce content that isn't in the state or the decision.
// The Response Planner is a translator, not a source of new facts.

/**
 * @param {object} decision  - AdvisorDecision from advisor-reasoning-engine.mjs
 * @param {object} state     - summariseState(model) output
 * @returns {object} ResponsePlan
 */
export function planResponse(decision, state) {
  const plan = {
    action: decision.action,
    response_shape: decision.response_shape,
    // Structural elements (assembled by the natural voice layer)
    opening: null,
    main_content: null,
    alternatives_offered: [],
    question_asked: null,
    // Content awareness
    acknowledge_state: [],
    avoid_mentioning: [],
    reasoning_chain: [],
    evidence_cited: [],
    // Constitutional
    fabrication_check_passed: true,
    honest_limits_needed: [],
  };

  // ------- Compute acknowledge_state -------
  // What state elements should the response reference to prove NEX is listening?
  for (const [k, v] of Object.entries(state.explicit_preferences || {})) {
    if (v) plan.acknowledge_state.push({ type: "preference", field: k, value: v });
  }
  for (const [k, v] of Object.entries(state.constraints || {})) {
    if (v) plan.acknowledge_state.push({ type: "constraint", field: k, value: v });
  }

  // ------- Compute avoid_mentioning -------
  // What must NEX NOT bring up? Exclusions block silent suggestions.
  for (const [field, values] of Object.entries(state.exclusions || {})) {
    for (const v of values) {
      plan.avoid_mentioning.push({ type: "exclusion", field, value: v });
    }
  }

  // ------- Evidence citation -------
  plan.evidence_cited = decision.evidence?.covered_concepts || [];

  // ------- Reasoning chain (per LOCKED reasoning order) -------
  // Only include steps that have relevant state or evidence
  for (const step of decision.reasoning_order || []) {
    if (step === "construction" && state.constraints?.construction) {
      plan.reasoning_chain.push({ step: "construction", note: `Construction constraint: ${state.constraints.construction}` });
    } else if (step === "design" && state.explicit_preferences?.style) {
      plan.reasoning_chain.push({ step: "design", note: `Style preference: ${state.explicit_preferences.style}` });
    } else if (step === "material" && state.explicit_preferences?.timber_species) {
      plan.reasoning_chain.push({ step: "material", note: `Material: ${state.explicit_preferences.timber_species}` });
    } else if (step === "finish" && state.explicit_preferences?.finish) {
      plan.reasoning_chain.push({ step: "finish", note: `Finish: ${state.explicit_preferences.finish}` });
    }
  }

  // ------- Honest limits -------
  // If evidence is partial or absent for a concept referenced, flag for the voice layer
  for (const partial of decision.evidence?.partial_concepts || []) {
    plan.honest_limits_needed.push({ concept: partial, note: "partial evidence · will acknowledge limits" });
  }
  for (const routed of decision.evidence?.routed_concepts || []) {
    plan.honest_limits_needed.push({ concept: routed.concept, note: `routes to future brain: ${routed.gap_note}` });
  }

  // ------- Action-specific structural elements -------
  switch (decision.action) {
    case "Ask": {
      plan.opening = {
        type: "acknowledge_if_state",
        include_state_summary: plan.acknowledge_state.length > 0,
      };
      // The specific clarifying question comes from the decision.reason + missing
      plan.question_asked = {
        source: "missing_or_ambiguity",
        specific_question: buildClarifyingQuestion(decision, state),
      };
      plan.main_content = null;
      break;
    }
    case "Answer": {
      plan.opening = { type: "direct_answer_lead", tone: "informative" };
      plan.main_content = {
        type: "explanation",
        concept: decision._meta?.primary_concept,
        based_on: plan.evidence_cited,
      };
      break;
    }
    case "Recommend": {
      plan.opening = {
        type: "acknowledge_state_first",
        state_summary: summariseAcknowledgment(plan.acknowledge_state),
      };
      plan.main_content = {
        type: "leaning_recommendation",
        concept: decision._meta?.primary_concept,
        reasoning: plan.reasoning_chain,
      };
      plan.alternatives_offered = buildAlternatives(decision, state);
      plan.question_asked = { source: "invite_next_direction" };
      break;
    }
    case "Compare": {
      plan.opening = { type: "compare_lead", tone: "balanced" };
      plan.main_content = {
        type: "comparison",
        concept: decision._meta?.primary_concept,
        based_on: plan.evidence_cited,
      };
      break;
    }
    case "RetrieveImages": {
      plan.opening = { type: "image_lead", tone: "visual_first" };
      plan.main_content = {
        type: "image_grid_with_context",
        concept: decision._meta?.primary_concept,
        filter_by_state: plan.acknowledge_state,
      };
      plan.question_asked = { source: "narrow_visual_direction" };
      break;
    }
    case "Route": {
      plan.opening = { type: "honest_scope_acknowledgement" };
      plan.main_content = {
        type: "route_to_future_brain",
        routed_concepts: decision.evidence?.routed_concepts || [],
      };
      // Offer adjacent staircase help if any
      if (plan.evidence_cited.length > 0) {
        plan.main_content.adjacent_help_available = true;
      }
      break;
    }
    case "Refuse": {
      plan.opening = { type: "honest_out_of_scope" };
      plan.main_content = {
        type: "refuse_with_offer",
        offer: plan.evidence_cited.length > 0 ? "adjacent_help" : "none",
      };
      break;
    }
  }

  // ------- Fabrication safeguard -------
  // If the plan would reference a concept that isn't in evidence, mark it
  if (["Recommend", "Answer", "Compare"].includes(decision.action) &&
      plan.evidence_cited.length === 0 &&
      decision._meta?.primary_concept) {
    plan.fabrication_check_passed = false;
    plan.honest_limits_needed.push({ concept: decision._meta.primary_concept, note: "PLAN FLAGGED: action would reference concept without evidence" });
  }

  return plan;
}

function buildClarifyingQuestion(decision, state) {
  // Build one useful clarifying question based on what's missing
  if (decision.missing && decision.missing.length > 0) {
    return { style: "missing_info", topics: decision.missing.slice(0, 2) };
  }
  if (decision._meta?.contradictions && decision._meta.contradictions.length > 0) {
    const c = decision._meta.contradictions[decision._meta.contradictions.length - 1];
    return { style: "contradiction", detail: c };
  }
  if (decision._meta?.unresolved_questions && decision._meta.unresolved_questions.length > 0) {
    return { style: "unresolved", detail: decision._meta.unresolved_questions[decision._meta.unresolved_questions.length - 1] };
  }
  // Default: which-axis question for the primary concept
  return { style: "which_axis", concept: decision._meta?.primary_concept };
}

function summariseAcknowledgment(states) {
  // Compact acknowledgment: "modern oak with matt-black spindles"
  if (!states || states.length === 0) return null;
  return states.map((s) => `${s.field}=${s.value}`).join(" · ");
}

function buildAlternatives(decision, state) {
  // Offer 1-2 alternatives max — never dump all options
  const alternatives = [];
  const primary = decision._meta?.primary_concept;
  if (primary === "starting_steps") {
    if (state.explicit_preferences?.style === "modern") {
      alternatives.push({ direction: "extended_square_platform", reason: "modern-fitting" });
      alternatives.push({ direction: "flush_no_projection", reason: "most minimal" });
    } else if (state.explicit_preferences?.style === "traditional") {
      alternatives.push({ direction: "bullnose", reason: "subtle traditional" });
      alternatives.push({ direction: "curtail_with_volute", reason: "statement traditional" });
    } else {
      alternatives.push({ direction: "bullnose", reason: "common middle-ground" });
    }
  } else if (primary === "balusters") {
    if (state.explicit_preferences?.style === "modern") {
      alternatives.push({ direction: "matt_black_metal", reason: "architectural-modern" });
      alternatives.push({ direction: "brushed_stainless", reason: "warm-modern" });
    } else if (state.explicit_preferences?.style === "traditional") {
      alternatives.push({ direction: "turned_timber", reason: "classical" });
    }
  }
  // Filter out any alternative that matches an exclusion
  const filtered = alternatives.filter((alt) => {
    for (const [field, values] of Object.entries(state.exclusions || {})) {
      if (values.some((v) => alt.direction.includes(v))) return false;
    }
    return true;
  });
  return filtered.slice(0, 2);
}
