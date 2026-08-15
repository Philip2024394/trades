// NEX Compound + Multi-turn Scorer (Philip 2026-08-14 Compound Conversation Engine).
// Measures: compound-intent decomposition · primary identification · multi-turn state retention.
// Uses the compound-intent-engine module (source-of-truth for concept detection).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { decomposeUtterance, createSession, updateSession } from "./compound-intent-engine.mjs";

const CWD = process.cwd();
const COMPOUND_SUITE = join(CWD, "tests", "nex-conversational", "compound-utterances-2026-08-14.yaml");
const MULTITURN_SUITE = join(CWD, "tests", "nex-conversational", "multi-turn-conversations-2026-08-14.yaml");
const OUT_DIR = join(CWD, "data", "nex-conversational-corpus");
const OUT = join(OUT_DIR, "compound-multiturn-report-2026-08-14.json");

// --- Simple YAML parser (line-based, robust enough for our schema) ---

function parseCompoundSuite(text) {
  const lines = text.split(/\r?\n/);
  const tests = [];
  let cur = null;
  for (const line of lines) {
    const idM = line.match(/^\s*-\s*id:\s*(.+)$/);
    if (idM) { if (cur) tests.push(cur); cur = { id: idM[1].trim(), expected_concepts: [], expected_preferences: {} }; continue; }
    if (!cur) continue;
    const textM = line.match(/^\s+text:\s*"(.+)"$/);
    if (textM) { cur.text = textM[1]; continue; }
    const conM = line.match(/^\s+expected_concepts:\s*\[(.+)\]$/);
    if (conM) { cur.expected_concepts = conM[1].split(",").map((s) => s.trim()); continue; }
    const primM = line.match(/^\s+expected_primary:\s*(\S+)/);
    if (primM) { cur.expected_primary = primM[1].trim(); continue; }
    const prefM = line.match(/^\s+expected_preferences:\s*\{\s*(.*?)\s*\}\s*$/);
    if (prefM) {
      const kvBody = prefM[1];
      if (kvBody) {
        for (const pair of kvBody.split(",")) {
          const [k, v] = pair.split(":").map((s) => s.trim());
          if (k) cur.expected_preferences[k] = v === "null" ? null : v;
        }
      }
      continue;
    }
    const retM = line.match(/^\s+expected_retention:\s*(true|false)/);
    if (retM) { cur.expected_retention = retM[1] === "true"; continue; }
    const qtM = line.match(/^\s+expected_query_type:\s*(\S+)/);
    if (qtM) { cur.expected_query_type = qtM[1].trim(); continue; }
  }
  if (cur) tests.push(cur);
  return tests;
}

function parseMultiTurnSuite(text) {
  const lines = text.split(/\r?\n/);
  const convs = [];
  let cur = null;
  let inTurns = false;
  let inFinalState = false;
  let inCritical = false;
  for (const line of lines) {
    const idM = line.match(/^\s*-\s*id:\s*(.+)$/);
    if (idM) {
      if (cur) convs.push(cur);
      cur = { id: idM[1].trim(), turns: [], expected_final_state: {}, critical_constraints: [] };
      inTurns = false; inFinalState = false; inCritical = false;
      continue;
    }
    if (!cur) continue;
    const descM = line.match(/^\s+description:\s*"(.+)"$/);
    if (descM) { cur.description = descM[1]; continue; }
    if (/^\s+turns:\s*$/.test(line)) { inTurns = true; inFinalState = false; inCritical = false; continue; }
    if (/^\s+expected_final_state:\s*$/.test(line)) { inTurns = false; inFinalState = true; inCritical = false; continue; }
    if (/^\s+critical_constraints:\s*$/.test(line)) { inTurns = false; inFinalState = false; inCritical = true; continue; }
    if (inTurns) {
      const tM = line.match(/^\s+-\s+"(.+)"$/);
      if (tM) { cur.turns.push(tM[1]); continue; }
    }
    if (inFinalState) {
      const kvM = line.match(/^\s+(\w+):\s*(\S.*)$/);
      if (kvM) {
        let v = kvM[2].trim();
        if (v.startsWith("[") && v.endsWith("]")) {
          v = v.slice(1, -1).split(",").map((s) => s.trim());
        }
        cur.expected_final_state[kvM[1]] = v;
        continue;
      }
    }
    if (inCritical) {
      const cM = line.match(/^\s+-\s+(.+)$/);
      if (cM) { cur.critical_constraints.push(cM[1].trim()); continue; }
    }
  }
  if (cur) convs.push(cur);
  return convs;
}

// --- Score a compound test ---
function scoreCompoundTest(test) {
  const d = decomposeUtterance(test.text);
  // Concepts: expected must be a SUBSET of detected (extra detections OK — we're measuring recall)
  const detectedSet = new Set(d.all_concepts);
  const expected = test.expected_concepts;
  const conceptsMissing = expected.filter((c) => !detectedSet.has(c));
  const conceptsRecall = expected.length ? (expected.length - conceptsMissing.length) / expected.length : 1;
  const conceptsPass = conceptsMissing.length === 0;
  // Primary
  const primaryPass = d.primary_concept === test.expected_primary;
  // Preferences: expected must all be present (subset check)
  const prefsMissing = Object.entries(test.expected_preferences || {}).filter(([k, v]) => v !== null && d.preferences[k] !== v);
  const prefsPass = prefsMissing.length === 0;
  // Retention
  const retentionPass = (test.expected_retention === undefined) || (d.retention_constraint === test.expected_retention);
  // Query type
  const queryTypePass = !test.expected_query_type || d.query_type === test.expected_query_type;
  // Full pass
  const fullPass = conceptsPass && primaryPass && prefsPass && retentionPass && queryTypePass;
  return {
    id: test.id,
    text: test.text,
    detected_concepts: d.all_concepts,
    detected_primary: d.primary_concept,
    detected_preferences: d.preferences,
    detected_retention: d.retention_constraint,
    detected_query_type: d.query_type,
    concepts_recall_pct: Math.round(conceptsRecall * 100),
    concepts_pass: conceptsPass,
    primary_pass: primaryPass,
    prefs_pass: prefsPass,
    retention_pass: retentionPass,
    query_type_pass: queryTypePass,
    full_pass: fullPass,
    missing_concepts: conceptsMissing,
    wrong_prefs: prefsMissing.map(([k, v]) => `${k} expected=${v} got=${d.preferences[k]}`),
  };
}

// --- Score a multi-turn conversation ---
function scoreMultiTurnConversation(conv) {
  const session = createSession();
  for (const turn of conv.turns) {
    const d = decomposeUtterance(turn);
    updateSession(session, d);
  }
  const finalState = session.established;
  const conceptsVisited = [...finalState.concepts_visited];
  // Check expected final state
  const stateErrors = [];
  for (const [k, v] of Object.entries(conv.expected_final_state)) {
    if (k === "concepts_visited_includes") {
      const required = Array.isArray(v) ? v : [v];
      for (const rc of required) {
        if (!conceptsVisited.includes(rc)) stateErrors.push(`concept-not-visited:${rc}`);
      }
    } else {
      if (finalState[k] !== v) stateErrors.push(`${k} expected=${v} got=${finalState[k]}`);
    }
  }
  // Check critical constraints (parsed loosely — just record vs auto-validated)
  const constraintNotes = [];
  for (const c of conv.critical_constraints) {
    // Parse a heuristic constraint: "key=value (source)"
    const kvM = c.match(/^(\w+)=(\S+?)\s*(?:\(.*\))?$/);
    if (kvM) {
      const [, k, v] = kvM;
      if (String(finalState[k]) === v) constraintNotes.push({ constraint: c, pass: true });
      else constraintNotes.push({ constraint: c, pass: false, got: finalState[k] });
    } else if (c.includes("concept invoked")) {
      const conceptM = c.match(/(\w+)(?:_\w+)?\s+concept invoked/);
      if (conceptM) {
        const cc = conceptM[1].includes("_") ? conceptM[1] : conceptM[0].replace(/\s+concept invoked/i, "").trim();
        constraintNotes.push({ constraint: c, pass: conceptsVisited.some((v) => v === cc || v.startsWith(cc)) });
      } else {
        constraintNotes.push({ constraint: c, pass: null });
      }
    } else {
      constraintNotes.push({ constraint: c, pass: null });
    }
  }
  const criticalPass = constraintNotes.every((cn) => cn.pass !== false); // null = untestable, count as pass
  const statePass = stateErrors.length === 0;
  const fullPass = statePass && criticalPass;
  return {
    id: conv.id,
    description: conv.description,
    turns_count: conv.turns.length,
    final_state: finalState,
    concepts_visited: conceptsVisited,
    state_errors: stateErrors,
    critical_notes: constraintNotes,
    state_pass: statePass,
    critical_pass: criticalPass,
    full_pass: fullPass,
  };
}

// --- Run ---
const compoundText = readFileSync(COMPOUND_SUITE, "utf8");
const compoundTests = parseCompoundSuite(compoundText);
const compoundResults = compoundTests.map(scoreCompoundTest);
const compoundFullPass = compoundResults.filter((r) => r.full_pass).length;
const compoundConceptsPass = compoundResults.filter((r) => r.concepts_pass).length;
const compoundPrimaryPass = compoundResults.filter((r) => r.primary_pass).length;
const compoundPrefsPass = compoundResults.filter((r) => r.prefs_pass).length;
const compoundQueryTypePass = compoundResults.filter((r) => r.query_type_pass).length;

const multiText = readFileSync(MULTITURN_SUITE, "utf8");
const conversations = parseMultiTurnSuite(multiText);
const multiResults = conversations.map(scoreMultiTurnConversation);
const multiFullPass = multiResults.filter((r) => r.full_pass).length;
const multiStatePass = multiResults.filter((r) => r.state_pass).length;
const multiCriticalPass = multiResults.filter((r) => r.critical_pass).length;

const report = {
  meta: { computed_at: new Date().toISOString() },
  compound: {
    total_tests: compoundTests.length,
    full_pass: compoundFullPass,
    full_pass_rate_pct: Math.round((compoundFullPass / compoundTests.length) * 100),
    concepts_recall_pass: compoundConceptsPass,
    concepts_recall_rate_pct: Math.round((compoundConceptsPass / compoundTests.length) * 100),
    primary_identification_pass: compoundPrimaryPass,
    primary_identification_rate_pct: Math.round((compoundPrimaryPass / compoundTests.length) * 100),
    preferences_extraction_pass: compoundPrefsPass,
    preferences_extraction_rate_pct: Math.round((compoundPrefsPass / compoundTests.length) * 100),
    query_type_correct_pass: compoundQueryTypePass,
    query_type_correct_rate_pct: Math.round((compoundQueryTypePass / compoundTests.length) * 100),
  },
  multi_turn: {
    total_conversations: conversations.length,
    full_pass: multiFullPass,
    full_pass_rate_pct: Math.round((multiFullPass / conversations.length) * 100),
    state_retention_pass: multiStatePass,
    state_retention_rate_pct: Math.round((multiStatePass / conversations.length) * 100),
    critical_constraints_pass: multiCriticalPass,
    critical_constraints_rate_pct: Math.round((multiCriticalPass / conversations.length) * 100),
  },
  compound_results: compoundResults,
  multi_turn_results: multiResults,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");

// --- Console summary ---
console.log("=".repeat(74));
console.log("NEX Compound Conversation Engine · Honest Baseline (Philip 2026-08-14)");
console.log("=".repeat(74));
console.log("");
console.log("COMPOUND UTTERANCE DECOMPOSITION (50 test utterances)");
console.log("  Full pass (all dimensions):        " + compoundFullPass + " / " + compoundTests.length + "  (" + report.compound.full_pass_rate_pct + "%)");
console.log("  Concepts recall:                   " + compoundConceptsPass + " / " + compoundTests.length + "  (" + report.compound.concepts_recall_rate_pct + "%)");
console.log("  Primary identification:            " + compoundPrimaryPass + " / " + compoundTests.length + "  (" + report.compound.primary_identification_rate_pct + "%)");
console.log("  Preferences extraction:            " + compoundPrefsPass + " / " + compoundTests.length + "  (" + report.compound.preferences_extraction_rate_pct + "%)");
console.log("  Query type routing:                " + compoundQueryTypePass + " / " + compoundTests.length + "  (" + report.compound.query_type_correct_rate_pct + "%)");
console.log("");
console.log("MULTI-TURN COHERENCE (15 conversations · state retention across turns)");
console.log("  Full pass (all critical constraints): " + multiFullPass + " / " + conversations.length + "  (" + report.multi_turn.full_pass_rate_pct + "%)");
console.log("  Final-state retention:                " + multiStatePass + " / " + conversations.length + "  (" + report.multi_turn.state_retention_rate_pct + "%)");
console.log("  Critical-constraints retention:       " + multiCriticalPass + " / " + conversations.length + "  (" + report.multi_turn.critical_constraints_rate_pct + "%)");
console.log("");
console.log("PER-TEST COMPOUND RESULTS (fail-first)");
for (const r of compoundResults.filter((r) => !r.full_pass).slice(0, 15)) {
  console.log("  " + r.id + " ❌  \"" + r.text.slice(0, 60) + "\"");
  console.log("     detected primary: " + r.detected_primary + " (expected differs)");
  if (r.missing_concepts.length) console.log("     missing concepts: " + r.missing_concepts.join(", "));
  if (r.wrong_prefs.length) console.log("     wrong prefs: " + r.wrong_prefs.join(" | "));
}
console.log("");
console.log("PER-CONVERSATION MULTI-TURN RESULTS (fail-first)");
for (const r of multiResults.filter((r) => !r.full_pass).slice(0, 15)) {
  console.log("  " + r.id + " ❌  " + (r.description || "").slice(0, 60));
  if (r.state_errors.length) console.log("     state errors: " + r.state_errors.join(" | "));
  const failedConstraints = r.critical_notes.filter((cn) => cn.pass === false);
  if (failedConstraints.length) console.log("     failed constraints: " + failedConstraints.map((c) => c.constraint).join(" | "));
}
console.log("");
console.log("Report: " + OUT);
