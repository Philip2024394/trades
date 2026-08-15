// NEX Layer 5 · Long-Conversation Understanding Scorer (Philip 2026-08-14).
// Runs 10-15+ turn realistic conversations and evaluates whether NEX SURVIVES to the end
// with the customer's goal + exclusions + corrections + evidence + uncertainty + next action all intact.
//
// Seven measured dimensions:
//   1. goal_understood
//   2. exclusions_retained
//   3. corrections_reflected
//   4. uncertainty_surfaced
//   5. evidence_traceable
//   6. next_action_appropriate
//   7. fabrication_zero

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createGoalModel, mergeTurn, summariseState } from "./customer-goal-model.mjs";
import { decomposeUtterance } from "./compound-intent-engine.mjs";
import { makeAdvisorDecision } from "./advisor-reasoning-engine.mjs";
import { planResponse } from "./response-planner.mjs";
import { renderVoice } from "./natural-voice.mjs";

const CWD = process.cwd();
const SUITE = join(CWD, "tests", "nex-conversational", "long-conversations-2026-08-14.yaml");
const OUT_DIR = join(CWD, "data", "nex-conversational-corpus");
const OUT = join(OUT_DIR, "long-conversations-report-2026-08-14.json");

// --- Parse suite (line-based YAML) ---
function parseSuite(text) {
  const lines = text.split(/\r?\n/);
  const conversations = [];
  let cur = null;
  let mode = null; // "turns" | "expected_final_state" | "expected_exclusions_retained" | "expected_corrections" | null
  for (const line of lines) {
    const idM = line.match(/^\s*-\s*id:\s*(.+)$/);
    if (idM) {
      if (cur) conversations.push(cur);
      cur = {
        id: idM[1].trim(),
        turns: [],
        expected_final_state: { concepts_visited_includes: [] },
        expected_exclusions_retained: {},
        expected_corrections: [],
        expected_contradictions_at_least: null,
        expected_uncertainty_surfaced: [],
        expected_next_action: null,
        expected_evidence_covers: [],
      };
      mode = null;
      continue;
    }
    if (!cur) continue;
    const descM = line.match(/^\s+description:\s*"(.+)"$/);
    if (descM) { cur.description = descM[1]; continue; }
    if (/^\s+turns:\s*$/.test(line)) { mode = "turns"; continue; }
    if (/^\s+expected_final_state:\s*$/.test(line)) { mode = "expected_final_state"; continue; }
    if (/^\s+expected_exclusions_retained:\s*(?:\{\s*\})?/.test(line)) { mode = "expected_exclusions_retained"; if (/\{\s*\}/.test(line)) mode = null; continue; }
    if (/^\s+expected_corrections:\s*(?:\[\s*\])?/.test(line)) { mode = "expected_corrections"; if (/\[\s*\]/.test(line)) mode = null; continue; }
    const contradM = line.match(/^\s+expected_contradictions_at_least:\s*(\d+)/);
    if (contradM) { cur.expected_contradictions_at_least = parseInt(contradM[1], 10); mode = null; continue; }
    const uncertM = line.match(/^\s+expected_uncertainty_surfaced:\s*\[(.*)\]/);
    if (uncertM) { cur.expected_uncertainty_surfaced = uncertM[1].split(",").map((s) => s.trim()).filter(Boolean); mode = null; continue; }
    const nextM = line.match(/^\s+expected_next_action:\s*(\S+)/);
    if (nextM) { cur.expected_next_action = nextM[1].trim(); mode = null; continue; }
    const evCovM = line.match(/^\s+expected_evidence_covers:\s*\[(.*)\]/);
    if (evCovM) { cur.expected_evidence_covers = evCovM[1].split(",").map((s) => s.trim()); mode = null; continue; }
    if (mode === "turns") {
      const tM = line.match(/^\s+-\s+"(.+)"$/);
      if (tM) { cur.turns.push(tM[1]); continue; }
    }
    if (mode === "expected_final_state") {
      const kvM = line.match(/^\s+(\w+):\s*(\S.*)$/);
      if (kvM) {
        let v = kvM[2].trim();
        // Strip inline YAML comments (# comment) — but not inside array brackets.
        if (!v.startsWith("[")) {
          const hashIdx = v.indexOf("#");
          if (hashIdx !== -1) v = v.slice(0, hashIdx).trim();
        }
        if (v.startsWith("[") && v.endsWith("]")) {
          v = v.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
        }
        cur.expected_final_state[kvM[1]] = v;
        continue;
      }
    }
    if (mode === "expected_exclusions_retained") {
      const exclM = line.match(/^\s+(\w+):\s*\[(.*)\]/);
      if (exclM) {
        cur.expected_exclusions_retained[exclM[1]] = exclM[2].split(",").map((s) => s.trim()).filter(Boolean);
        continue;
      }
    }
    if (mode === "expected_corrections") {
      const corrM = line.match(/^\s+-\s+\{(.+)\}/);
      if (corrM) {
        const parsed = {};
        for (const pair of corrM[1].split(",")) {
          const [k, ...vRest] = pair.split(":");
          if (!k) continue;
          parsed[k.trim()] = vRest.join(":").trim();
        }
        cur.expected_corrections.push(parsed);
      }
      continue;
    }
  }
  if (cur) conversations.push(cur);
  return conversations;
}

// --- Score one conversation ---
function scoreConversation(conv) {
  const model = createGoalModel();
  let lastDecomp = null;
  let lastDecision = null;
  let lastPlan = null;
  let lastVoice = null;
  const voiceOutputs = [];
  for (const turn of conv.turns) {
    lastDecomp = decomposeUtterance(turn);
    mergeTurn(model, turn);
    lastDecision = makeAdvisorDecision(model, lastDecomp);
    lastPlan = planResponse(lastDecision, summariseState(model));
    lastVoice = renderVoice(lastPlan);
    voiceOutputs.push({ turn, voice: lastVoice });
  }
  const state = summariseState(model);

  // Dimension 1: goal_understood — check final-state preferences match
  const expectedPrefs = { ...conv.expected_final_state };
  delete expectedPrefs.concepts_visited_includes;
  const goalMisses = [];
  for (const [k, v] of Object.entries(expectedPrefs)) {
    if (k === "scope") {
      if (state.constraints.scope !== v) goalMisses.push(`scope: expected=${v} got=${state.constraints.scope}`);
    } else if (["construction"].includes(k)) {
      if (state.constraints[k] !== v) goalMisses.push(`${k}: expected=${v} got=${state.constraints[k]}`);
    } else {
      if (state.explicit_preferences[k] !== v) goalMisses.push(`${k}: expected=${v} got=${state.explicit_preferences[k]}`);
    }
  }
  const goalUnderstood = goalMisses.length === 0;

  // Dimension 2: exclusions_retained
  const exclMisses = [];
  for (const [field, values] of Object.entries(conv.expected_exclusions_retained || {})) {
    const got = state.exclusions[field] || [];
    for (const v of values) {
      const found = got.some((g) => g.includes(v) || v.includes(g));
      if (!found) exclMisses.push(`${field}: expected excludes ${v} got=${got.join(",") || "none"}`);
    }
  }
  const exclusionsRetained = exclMisses.length === 0;

  // Dimension 3: corrections_reflected — check that corrections landed
  const expectedCorrCount = (conv.expected_corrections || []).length;
  const gotCorrCount = state.corrections.length;
  const correctionsReflected = gotCorrCount >= expectedCorrCount;

  // Dimension 4: uncertainty_surfaced
  // Check that expected uncertain items appear in inferred preferences or unresolved questions
  const uncertMisses = [];
  for (const item of conv.expected_uncertainty_surfaced || []) {
    const shortItem = item.split("_")[0];
    const inInferred = Object.keys(state.inferred_preferences || {}).some((k) => k.includes(shortItem));
    const inUnresolved = (state.unresolved_questions || []).some((q) => q.toLowerCase().includes(shortItem));
    if (!inInferred && !inUnresolved) uncertMisses.push(`uncertainty_not_surfaced:${item}`);
  }
  const uncertaintySurfaced = uncertMisses.length === 0;

  // Dimension 5: evidence_traceable — decision evidence exists for the concepts visited
  const evidenceTraceable = lastDecision.evidence.covered_concepts.length > 0 ||
                             lastDecision.evidence.partial_concepts.length > 0 ||
                             lastDecision.evidence.routed_concepts.length > 0;

  // Dimension 6: next_action_appropriate
  const nextActionAppropriate = !conv.expected_next_action || lastDecision.action === conv.expected_next_action;

  // Dimension 7: fabrication_zero
  // Architectural check — decision derives from state only. Voice does not invent.
  const fabricationZero = lastPlan.fabrication_check_passed;

  // Concepts visited coverage
  const expectedConcepts = conv.expected_final_state.concepts_visited_includes || [];
  const conceptMisses = expectedConcepts.filter((c) => !state.concepts_visited.includes(c));
  const conceptsCovered = conceptMisses.length === 0;

  // Contradictions expected
  const contradPass = conv.expected_contradictions_at_least == null || state.contradictions.length >= conv.expected_contradictions_at_least;

  // Full pass = all 7 primary dimensions + concepts + contradictions
  const fullPass = goalUnderstood && exclusionsRetained && correctionsReflected && uncertaintySurfaced &&
                   evidenceTraceable && nextActionAppropriate && fabricationZero && conceptsCovered && contradPass;

  return {
    id: conv.id,
    description: conv.description,
    turns_count: conv.turns.length,
    final_state_summary: {
      preferences: state.explicit_preferences,
      constraints: state.constraints,
      exclusions: state.exclusions,
      corrections_count: state.corrections.length,
      contradictions_count: state.contradictions.length,
      concepts_visited: state.concepts_visited,
    },
    last_decision_action: lastDecision.action,
    last_voice_snippet: (lastVoice || "").slice(0, 120),
    dimensions: {
      goal_understood: { pass: goalUnderstood, misses: goalMisses },
      exclusions_retained: { pass: exclusionsRetained, misses: exclMisses },
      corrections_reflected: { pass: correctionsReflected, expected: expectedCorrCount, got: gotCorrCount },
      uncertainty_surfaced: { pass: uncertaintySurfaced, misses: uncertMisses },
      evidence_traceable: { pass: evidenceTraceable },
      next_action_appropriate: { pass: nextActionAppropriate, expected: conv.expected_next_action, got: lastDecision.action },
      fabrication_zero: { pass: fabricationZero },
      concepts_covered: { pass: conceptsCovered, misses: conceptMisses },
      contradictions_expected: { pass: contradPass, expected_at_least: conv.expected_contradictions_at_least, got: state.contradictions.length },
    },
    full_pass: fullPass,
  };
}

// --- Run ---
const suiteText = readFileSync(SUITE, "utf8");
const conversations = parseSuite(suiteText);
const results = conversations.map(scoreConversation);

const total = results.length;
const dims = {
  goal_understood: results.filter((r) => r.dimensions.goal_understood.pass).length,
  exclusions_retained: results.filter((r) => r.dimensions.exclusions_retained.pass).length,
  corrections_reflected: results.filter((r) => r.dimensions.corrections_reflected.pass).length,
  uncertainty_surfaced: results.filter((r) => r.dimensions.uncertainty_surfaced.pass).length,
  evidence_traceable: results.filter((r) => r.dimensions.evidence_traceable.pass).length,
  next_action_appropriate: results.filter((r) => r.dimensions.next_action_appropriate.pass).length,
  fabrication_zero: results.filter((r) => r.dimensions.fabrication_zero.pass).length,
  concepts_covered: results.filter((r) => r.dimensions.concepts_covered.pass).length,
  contradictions_expected: results.filter((r) => r.dimensions.contradictions_expected.pass).length,
  full_pass: results.filter((r) => r.full_pass).length,
};

const report = {
  meta: { computed_at: new Date().toISOString(), total_conversations: total, total_turns: results.reduce((s, r) => s + r.turns_count, 0) },
  dimensions: Object.fromEntries(Object.entries(dims).map(([k, v]) => [k, { pass: v, rate_pct: Math.round((v / total) * 100) }])),
  results,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");

console.log("=".repeat(74));
console.log("NEX Layer 5 · Realistic Long-Conversation Understanding · Baseline (Philip 2026-08-14)");
console.log("=".repeat(74));
console.log("");
console.log("Total conversations: " + total + "  ·  Total turns processed: " + report.meta.total_turns);
console.log("");
console.log("SEVEN PRIMARY DIMENSIONS (Philip's end-of-conversation targets)");
console.log("  1. Goal understood:              " + dims.goal_understood + " / " + total + "  (" + report.dimensions.goal_understood.rate_pct + "%)");
console.log("  2. Exclusions retained:          " + dims.exclusions_retained + " / " + total + "  (" + report.dimensions.exclusions_retained.rate_pct + "%)");
console.log("  3. Corrections reflected:        " + dims.corrections_reflected + " / " + total + "  (" + report.dimensions.corrections_reflected.rate_pct + "%)");
console.log("  4. Uncertainty surfaced:         " + dims.uncertainty_surfaced + " / " + total + "  (" + report.dimensions.uncertainty_surfaced.rate_pct + "%)");
console.log("  5. Evidence traceable:           " + dims.evidence_traceable + " / " + total + "  (" + report.dimensions.evidence_traceable.rate_pct + "%)");
console.log("  6. Next action appropriate:      " + dims.next_action_appropriate + " / " + total + "  (" + report.dimensions.next_action_appropriate.rate_pct + "%)");
console.log("  7. Fabrication zero:             " + dims.fabrication_zero + " / " + total + "  (" + report.dimensions.fabrication_zero.rate_pct + "%)  · CONSTITUTIONAL");
console.log("");
console.log("SUPPORTING DIMENSIONS");
console.log("  Concepts visited coverage:       " + dims.concepts_covered + " / " + total + "  (" + report.dimensions.concepts_covered.rate_pct + "%)");
console.log("  Contradictions detected:         " + dims.contradictions_expected + " / " + total + "  (" + report.dimensions.contradictions_expected.rate_pct + "%)");
console.log("");
console.log("  FULL PASS (all 9 dimensions):    " + dims.full_pass + " / " + total + "  (" + report.dimensions.full_pass.rate_pct + "%)");
console.log("");
console.log("PER-CONVERSATION SUMMARY");
for (const r of results) {
  const mark = r.full_pass ? "✅" : "❌";
  console.log("  " + mark + "  " + r.id.padEnd(8) + "  " + r.turns_count + " turns  final_action=" + r.last_decision_action);
  if (!r.full_pass) {
    const failed = Object.entries(r.dimensions).filter(([, d]) => !d.pass).map(([k]) => k);
    console.log("      failed_dims: " + failed.join(", "));
  }
}
console.log("");
console.log("Sample voice outputs (last turn of each conversation):");
for (const r of results.slice(0, 5)) {
  console.log("  " + r.id + ":  " + r.last_voice_snippet + "...");
}
console.log("");
console.log("Report: " + OUT);
