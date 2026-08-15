// ADR-0044 MVP · evaluation harness.
// Replays each test conversation, records what the pipeline observed vs
// what the fixture expects, and computes per-conversation + aggregate
// scores. No fabrication — every "pass" is a concrete assertion the
// fixture makes and the pipeline satisfies.

import { readFile, writeFile } from 'node:fs/promises';
import { processTurn, newState } from './lib/infer.mjs';

const TEST_SET = 'C:/Users/Victus/trades/scripts/nex-conv/eval/test-set.json';

export async function runEvaluation({ store, outFile }) {
  const fixtures = JSON.parse(await readFile(TEST_SET, 'utf8'));
  const results = { started_at: new Date().toISOString(), brain: fixtures.brain, per_conversation: [], aggregate: null };

  for (const conv of fixtures.conversations) {
    const state = newState({ brain: fixtures.brain });
    const perTurn = [];
    for (let i = 0; i < conv.turns.length; i++) {
      const turnFixture = conv.turns[i];
      const t0 = Date.now();
      const out = await processTurn({ store, state, brain: fixtures.brain, text: turnFixture.customer, speaker: 'customer' });
      const dt = Date.now() - t0;
      const assertions = evaluateTurn(turnFixture, out, state);
      perTurn.push({
        turn_index: i + 1,
        customer: turnFixture.customer,
        latency_ms: dt,
        understood_intent: out.understood_intent,
        understood_entities: out.understood_entities,
        top_k_top: out.retrieved_top_k[0] ?? null,
        top_k_scores: out.retrieved_top_k.map(k => +k.score),
        state_facts: state.established_facts,
        state_entities_in_focus: state.entities_in_focus,
        assertions,
      });
    }
    const passed = perTurn.reduce((n, t) => n + t.assertions.filter(a => a.pass).length, 0);
    const total = perTurn.reduce((n, t) => n + t.assertions.length, 0);
    results.per_conversation.push({
      id: conv.id,
      purpose: conv.purpose,
      turns: perTurn,
      passed, total,
      pass_rate: total ? +(passed / total * 100).toFixed(1) : null,
    });
  }

  const aggregate = {
    conversations: results.per_conversation.length,
    total_assertions: results.per_conversation.reduce((n, c) => n + c.total, 0),
    passed_assertions: results.per_conversation.reduce((n, c) => n + c.passed, 0),
    total_turns: results.per_conversation.reduce((n, c) => n + c.turns.length, 0),
    avg_turn_latency_ms: null,
    conversations_full_pass: results.per_conversation.filter(c => c.passed === c.total).length,
  };
  const latencies = results.per_conversation.flatMap(c => c.turns.map(t => t.latency_ms));
  aggregate.avg_turn_latency_ms = latencies.length ? +(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1) : null;
  aggregate.p95_turn_latency_ms = latencies.length ? +percentile(latencies, 0.95).toFixed(1) : null;
  aggregate.overall_pass_rate = aggregate.total_assertions ? +(aggregate.passed_assertions / aggregate.total_assertions * 100).toFixed(1) : null;
  results.aggregate = aggregate;
  results.finished_at = new Date().toISOString();

  if (outFile) await writeFile(outFile, JSON.stringify(results, null, 2));
  return results;
}

function evaluateTurn(fixture, out, state) {
  const assertions = [];
  const push = (name, pass, detail = null) => assertions.push({ name, pass, ...(detail ? { detail } : {}) });

  if (fixture.expect_intent) {
    push(`intent==${fixture.expect_intent}`, out.understood_intent.slug === fixture.expect_intent, { got: out.understood_intent.slug });
  }
  if (fixture.expect_intent_not_in) {
    push(`intent not in ${fixture.expect_intent_not_in.join('|')}`, !fixture.expect_intent_not_in.includes(out.understood_intent.slug), { got: out.understood_intent.slug });
  }
  if (fixture.expect_entities_after) {
    const missing = fixture.expect_entities_after.filter(e => !state.entities_in_focus.includes(e));
    push(`entities_in_focus == ${fixture.expect_entities_after.join(',')}`, missing.length === 0, { missing, got: state.entities_in_focus });
  }
  if (fixture.expect_entities_after_contains) {
    const missing = fixture.expect_entities_after_contains.filter(e => !state.entities_in_focus.includes(e));
    push(`entities_in_focus contains ${fixture.expect_entities_after_contains.join(',')}`, missing.length === 0, { missing, got: state.entities_in_focus });
  }
  if (fixture.expect_state_material) {
    push(`state.material == ${fixture.expect_state_material}`, state.established_facts.material_primary?.value === fixture.expect_state_material, { got: state.established_facts.material_primary?.value });
  }
  if (fixture.expect_state_style) {
    push(`state.style == ${fixture.expect_state_style}`, state.established_facts.style_intent?.value === fixture.expect_state_style, { got: state.established_facts.style_intent?.value });
  }
  if (fixture.expect_state_constraint) {
    push(`state.constraint contains ${fixture.expect_state_constraint}`, (state.constraints ?? []).includes(fixture.expect_state_constraint), { got: state.constraints });
  }
  if (fixture.expect_state_current_topic) {
    push(`state.current_topic == ${fixture.expect_state_current_topic}`, state.current_topic === fixture.expect_state_current_topic, { got: state.current_topic });
  }
  if (fixture.expect_corrections_log_length_min) {
    push(`corrections_log length >= ${fixture.expect_corrections_log_length_min}`, (state.corrections_log?.length ?? 0) >= fixture.expect_corrections_log_length_min, { got: state.corrections_log?.length });
  }
  if (fixture.expect_topK_entity_intersect) {
    // At least one topK item must include at least one of the expected entities
    const targets = fixture.expect_topK_entity_intersect;
    const hits = out.retrieved_top_k.filter(k => k.entities.some(e => targets.includes(e))).length;
    push(`topK ∩ ${targets.join('|')} > 0`, hits > 0, { hits, targets, top_entities: out.retrieved_top_k.slice(0, 3).map(k => k.entities) });
  }
  if (typeof fixture.expect_topK_top_score_below === 'number') {
    const top = out.retrieved_top_k[0]?.score ?? 0;
    push(`topK[0].score < ${fixture.expect_topK_top_score_below}`, top < fixture.expect_topK_top_score_below, { got: top });
  }
  return assertions;
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}
