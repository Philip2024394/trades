// Run the Philip acceptance test: a 15-20 turn staircase conversation
// through the Postgres-backed pipeline WITH LLM prose rendering (Step 2).
// Reports every turn's prose, latency, tokens, cost, faithfulness checks,
// and the final state snapshot.

import { readFile, writeFile } from 'node:fs/promises';
import { createStore } from './lib/store-factory.mjs';
import { newState, processTurn } from './lib/infer.mjs';
import { getCallLog, clearCallLog } from './lib/respond.mjs';

const FIXTURE = 'C:/Users/Victus/trades/scripts/nex-conv/eval/acceptance-15turn.json';

async function main() {
  const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'));
  const backend = process.argv.find(a => a.startsWith('--backend='))?.slice('--backend='.length) ?? 'postgres';
  const provider = process.env.NEX_RESPONSE_PROVIDER ?? 'ollama';
  const model = process.env.NEX_RESPONSE_MODEL ?? 'qwen2.5:3b';
  const tag = `${provider}-${model.replace(/[^a-z0-9._-]/gi, '-')}`;
  const OUT_JSON = `C:/Users/Victus/trades/data/nex-conv/mvp/acceptance-18turn-${tag}-2026-08-15.json`;
  const OUT_MD   = `C:/Users/Victus/trades/data/nex-conv/mvp/acceptance-18turn-${tag}-2026-08-15.md`;

  console.log(`[acceptance] backend=${backend} · provider=${provider} · model=${model}`);
  console.log(`[acceptance] fixture: ${fixture.id} · ${fixture.turns.length} turns`);
  clearCallLog();

  const store = await createStore({ backend });
  console.log(`[acceptance] store loaded · items=${store.counts().knowledge_items} · edges=${store.counts().edges}`);

  const state = newState({ brain: fixture.brain });
  const results = [];

  for (const t of fixture.turns) {
    process.stdout.write(`  T${t.n} · "${t.customer.slice(0, 60)}${t.customer.length > 60 ? '…' : ''}" ... `);
    const t0 = Date.now();
    const out = await processTurn({ store, state, brain: fixture.brain, text: t.customer, withProse: true });
    const dt = Date.now() - t0;
    const reply = out.prose?.text || out.prose?.error || '(no prose)';
    console.log(`[${out.understood_intent.slug}] ${dt}ms`);
    console.log(`     NEX: ${reply.replace(/\n/g, ' ').slice(0, 240)}${reply.length > 240 ? '…' : ''}`);
    results.push({
      turn: t.n,
      customer: t.customer,
      understood_intent: out.understood_intent,
      entities: out.understood_entities,
      effective_query_entities: out.effective_query_entities,
      state_snapshot: {
        current_topic: state.current_topic,
        established_facts: JSON.parse(JSON.stringify(state.established_facts)),
        entities_in_focus: [...state.entities_in_focus],
        constraints: [...state.constraints],
        corrections_log_length: state.corrections_log.length,
      },
      top_k_first: out.retrieved_top_k[0] ? {
        id: out.retrieved_top_k[0].id,
        score: out.retrieved_top_k[0].score,
        source_batch: out.retrieved_top_k[0].source_batch,
        head: out.retrieved_top_k[0].answer_head?.slice(0, 200),
      } : null,
      top_k_source_batches: out.retrieved_top_k.map(k => k.source_batch),
      response_frame: out.response_frame,
      prose: out.prose,
      timings: out.stage_timings,
      total_ms: out.total_ms,
    });
  }

  // Faithfulness probes
  const allReplies = results.map(r => r.prose?.text || '').join('\n');
  const violations = [];
  for (const probe of fixture.faithfulness_probes ?? []) {
    for (const phrase of probe.phrase_never_expected_in_replies) {
      const rx = new RegExp('\\b' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      // Skip pure symbols like £ · $ · GBP where regex \b doesn't apply — check with plain includes
      const found = /[a-z0-9]/i.test(phrase) ? rx.test(allReplies) : allReplies.includes(phrase);
      if (found) violations.push({ phrase, reason: probe.reason });
    }
  }

  // Cost + latency roll-up
  const callLog = getCallLog();
  const okCalls = callLog.filter(c => !c.error);
  const errCalls = callLog.filter(c => c.error);
  const totalCost = okCalls.reduce((s, c) => s + (c.cost_usd ?? 0), 0);
  const totalPromptTok = okCalls.reduce((s, c) => s + (c.tokens_prompt ?? 0), 0);
  const totalComplTok = okCalls.reduce((s, c) => s + (c.tokens_completion ?? 0), 0);
  const latencies = okCalls.map(c => c.latency_ms);
  const sorted = [...latencies].sort((a, b) => a - b);
  const p = (q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : null;
  const summary = {
    fixture: fixture.id,
    backend,
    model,
    turns_run: results.length,
    prose_calls_ok: okCalls.length,
    prose_calls_err: errCalls.length,
    total_prompt_tokens: totalPromptTok,
    total_completion_tokens: totalComplTok,
    total_cost_usd: +totalCost.toFixed(6),
    avg_prose_latency_ms: latencies.length ? +(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1) : null,
    p50_prose_latency_ms: p(0.5),
    p95_prose_latency_ms: p(0.95),
    faithfulness_violations: violations,
    final_state: {
      current_topic: state.current_topic,
      established_facts: state.established_facts,
      entities_in_focus: state.entities_in_focus,
      constraints: state.constraints,
      corrections_log: state.corrections_log,
      turn_count: state.turn_count,
    },
  };

  await writeFile(OUT_JSON, JSON.stringify({ summary, turns: results }, null, 2));
  await writeFile(OUT_MD, renderMd(summary, results, fixture));
  if (typeof store.close === 'function') await store.close();

  console.log('\n=== ACCEPTANCE SUMMARY ===');
  console.log(`Turns: ${summary.turns_run} · prose OK: ${summary.prose_calls_ok} · errors: ${summary.prose_calls_err}`);
  console.log(`Tokens: ${summary.total_prompt_tokens} prompt · ${summary.total_completion_tokens} completion`);
  console.log(`Cost: $${summary.total_cost_usd}`);
  console.log(`Prose latency avg: ${summary.avg_prose_latency_ms}ms · P50 ${summary.p50_prose_latency_ms}ms · P95 ${summary.p95_prose_latency_ms}ms`);
  console.log(`Faithfulness violations: ${summary.faithfulness_violations.length}`);
  console.log(`Final material: ${state.established_facts.material_primary?.value ?? '—'} · style: ${state.established_facts.style_intent?.value ?? '—'} · constraint: ${state.constraints.join(',') || '—'}`);
  console.log(`Corrections logged: ${state.corrections_log.length}`);
  console.log(`Reports: ${OUT_MD}`);
}

function renderMd(s, results, fixture) {
  const out = [];
  out.push(`# NEX Acceptance Test · 15-Turn Conversation · V1 Step 2 (LLM Response Layer)`);
  out.push('');
  out.push(`- Fixture: \`${s.fixture}\` · ${s.turns_run} turns`);
  out.push(`- Purpose: ${fixture.purpose}`);
  out.push(`- Persona: ${fixture.customer_persona}`);
  out.push(`- Backend: **${s.backend}** · Model: **${s.model}**`);
  out.push(`- Prose calls OK: **${s.prose_calls_ok}** · errors: **${s.prose_calls_err}**`);
  out.push(`- Tokens: prompt **${s.total_prompt_tokens}** · completion **${s.total_completion_tokens}**`);
  out.push(`- Total cost this run: **$${s.total_cost_usd}** (\`$${(s.total_cost_usd/Math.max(1,s.turns_run)).toFixed(6)}\`/turn)`);
  out.push(`- Prose latency avg: **${s.avg_prose_latency_ms}ms** · P50 ${s.p50_prose_latency_ms}ms · P95 ${s.p95_prose_latency_ms}ms`);
  out.push(`- Faithfulness violations: **${s.faithfulness_violations.length}**`);
  if (s.faithfulness_violations.length) {
    for (const v of s.faithfulness_violations) out.push(`  - ⚠ "${v.phrase}" — ${v.reason}`);
  }
  out.push('');
  out.push(`## Final state snapshot`);
  out.push('```json');
  out.push(JSON.stringify(s.final_state, null, 2));
  out.push('```');
  out.push('');
  out.push(`## Turn-by-turn`);
  out.push('');
  for (const r of results) {
    const facts = Object.entries(r.state_snapshot.established_facts).map(([k, v]) => `${k}=${v.value}`).join(' · ') || '(none)';
    out.push(`### T${r.turn} · intent=\`${r.understood_intent.slug}\` · entities=[${r.entities.join(', ')}]`);
    out.push('');
    out.push(`**Customer:** ${r.customer}`);
    out.push('');
    out.push(`**NEX:** ${r.prose?.text || r.prose?.error || '(no prose)'}`);
    out.push('');
    out.push(`_state after turn:_ topic=\`${r.state_snapshot.current_topic ?? '—'}\` · facts=\`${facts}\` · focus=[${r.state_snapshot.entities_in_focus.join(', ')}] · corrections_log=${r.state_snapshot.corrections_log_length}`);
    out.push('');
    if (r.top_k_first) out.push(`_top retrieved:_ \`${r.top_k_first.source_batch}\` · score ${r.top_k_first.score} · "${(r.top_k_first.head || '').replace(/\|/g, '\\|')}"`);
    out.push('');
    out.push(`_timings:_ total ${r.total_ms}ms · embed ${r.timings.embed_ms}ms · retrieve ${r.timings.retrieve_ms}ms · prose ${r.timings.prose_ms ?? '—'}ms · prose tokens ${r.prose?.tokens_prompt ?? '—'}p/${r.prose?.tokens_completion ?? '—'}c · $${r.prose?.cost_usd?.toFixed?.(6) ?? '—'}`);
    out.push('');
    out.push('---');
    out.push('');
  }
  return out.join('\n');
}

await main();
