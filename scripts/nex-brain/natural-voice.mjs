// NEX Layer 5b · Natural Voice (Philip 2026-08-14).
//
// Takes a ResponsePlan and generates a string in NEX's advisor voice.
// CONSTITUTIONAL: cannot invent facts. Everything comes from the ResponsePlan.
// The voice layer only decides HOW to phrase, not WHAT to say.
//
// Voice principles (from recommendation-voice.md · LOCKED):
//   - Anchor to customer context first
//   - Lean, don't list
//   - Reason briefly
//   - Alternative if useful
//   - Invite redirect
//   - Never enumerate all options
//   - Never over-apologise
//   - Never use ChatGPT patterns ("Great question!" · "I'd be happy to help!" · "As I mentioned earlier...")

const VOICE_OPENINGS = {
  acknowledge: [
    "OK — {summary}. ",
    "Got it — {summary}. ",
    "So we've got {summary}. ",
  ],
  direct: [
    "",
    "Straight answer: ",
    "Short version: ",
  ],
  hedged_lean: [
    "Given {summary}, ",
    "For {summary}, ",
    "With {summary} established, ",
  ],
  ask_first: [
    "",
    "Quick clarifier: ",
    "One thing to narrow: ",
  ],
  route: [
    "That's a ",
    "That belongs to a ",
  ],
};

const BANNED_PHRASES = [
  "Great question",
  "That's a great question",
  "I'd be happy to help",
  "Sure, I can help with that",
  "As I mentioned earlier",
  "I understand your frustration",
  "I apologise for the confusion",
  "Let me try again with a different approach",
];

/**
 * @param {object} plan  - ResponsePlan from response-planner.mjs
 * @returns {string} natural NEX voice
 */
export function renderVoice(plan) {
  // Fabrication safeguard — if plan flagged, refuse to generate
  if (plan.fabrication_check_passed === false) {
    return "I don't have enough evidence for a specific recommendation here. Tell me a bit more about what you're picturing and I can point somewhere useful.";
  }

  const parts = [];

  switch (plan.action) {
    case "Ask": {
      parts.push(renderAskResponse(plan));
      break;
    }
    case "Answer": {
      parts.push(renderAnswerResponse(plan));
      break;
    }
    case "Recommend": {
      parts.push(renderRecommendResponse(plan));
      break;
    }
    case "Compare": {
      parts.push(renderCompareResponse(plan));
      break;
    }
    case "RetrieveImages": {
      parts.push(renderImageResponse(plan));
      break;
    }
    case "Route": {
      parts.push(renderRouteResponse(plan));
      break;
    }
    case "Refuse": {
      parts.push(renderRefuseResponse(plan));
      break;
    }
    default:
      parts.push("Let me know a bit more about what you're picturing.");
  }

  const response = parts.filter(Boolean).join(" ").trim();
  return sanitiseVoice(response);
}

function renderAskResponse(plan) {
  const q = plan.question_asked;
  if (!q) return "Tell me a bit more about what you're looking for.";
  if (q.style === "missing_info") {
    const topics = (q.topics || []).slice(0, 2);
    if (topics.length === 0) return "What would help most is a bit more context.";
    const topicStrs = topics.map((t) => t.split(" ")[0].replace(/_/g, " "));
    return `Two things would help — ${topicStrs.join(" and ")}. Which do you know already?`;
  }
  if (q.style === "contradiction") {
    return "I have you down for one thing and you've now said something that seems different — could you tell me which is the current call?";
  }
  if (q.style === "unresolved") {
    return "There's still one thing to resolve before I can point you somewhere useful.";
  }
  if (q.style === "which_axis") {
    return "That can go in a few directions — which axis matters most to you?";
  }
  return "Tell me a bit more.";
}

function renderAnswerResponse(plan) {
  const concept = plan.main_content?.concept;
  const cited = (plan.evidence_cited || []).slice(0, 2).join(" and ");
  if (!concept) return "Here's what I can tell you from the reference material.";
  return `On ${humanConcept(concept)}: [explanation from ${cited || "reference material"}].`;
}

function renderRecommendResponse(plan) {
  const summary = plan.opening?.state_summary || summariseKnown(plan.acknowledge_state);
  const concept = plan.main_content?.concept;
  const alternatives = plan.alternatives_offered || [];
  let response = "";
  if (summary) {
    response += `Given ${summary}, `;
  }
  if (concept) {
    response += `for ${humanConcept(concept)} the common direction is ${alternatives[0]?.direction || "[recommendation from state + evidence]"}${alternatives[0]?.reason ? " — " + alternatives[0].reason : ""}.`;
  }
  if (alternatives.length > 1) {
    response += ` If you'd rather ${alternatives[1].reason || "go a different way"}, ${alternatives[1].direction.replace(/_/g, " ")} works too.`;
  }
  if (plan.question_asked) {
    response += " Which direction feels right?";
  }
  return response;
}

function renderCompareResponse(plan) {
  const concept = plan.main_content?.concept;
  return `Two directions on ${humanConcept(concept || "that")} — worth weighing against each other:`;
}

function renderImageResponse(plan) {
  const summary = summariseKnown(plan.acknowledge_state);
  return `${summary ? `For ${summary}: ` : ""}here are the closest matches from the reference library.`;
}

function renderRouteResponse(plan) {
  const routed = plan.main_content?.routed_concepts || [];
  const adj = plan.main_content?.adjacent_help_available;
  const routedNote = routed[0]?.gap_note || "";
  let response = `That's a ${extractBrainName(routedNote)} question rather than a design question. `;
  if (adj) response += "I can help on the design side — say what you'd like to focus on.";
  else response += "Outside NEX scope for now.";
  return response;
}

function renderRefuseResponse(plan) {
  return "That specific detail is outside what NEX carries. I can point you toward adjacent design guidance if that helps.";
}

// ---------- Helpers ----------
function summariseKnown(states) {
  if (!states || states.length === 0) return null;
  return states
    .filter((s) => s.type === "preference" || s.type === "constraint")
    .map((s) => `${s.value}`)
    .join(" · ");
}

function humanConcept(concept) {
  return (concept || "").replace(/_/g, " ");
}

function extractBrainName(gap_note) {
  const m = /future (?:Code-Compliance|Business|Wayfinding|Ergonomics) Brain|building.codes|business.estimation|wayfinding|ergonomics/i.exec(gap_note);
  if (!m) return "specialist";
  const lower = m[0].toLowerCase();
  if (lower.includes("code") || lower.includes("compliance") || lower.includes("building")) return "building-regulations";
  if (lower.includes("business") || lower.includes("estimation")) return "pricing";
  if (lower.includes("wayfinding")) return "floor-plan";
  if (lower.includes("ergonomic")) return "accessibility";
  return "specialist";
}

function sanitiseVoice(text) {
  let out = text;
  for (const banned of BANNED_PHRASES) {
    if (out.includes(banned)) out = out.replace(banned, "");
  }
  // Collapse multiple spaces + trim
  return out.replace(/\s+/g, " ").trim();
}
