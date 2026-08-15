// Runs the regression fixture (per-conversation phrase / regex probes)
// AND the 25-turn natural conversation fixture · reports honestly.

import { readFile, writeFile } from 'node:fs/promises';
import { createStore } from './lib/store-factory.mjs';
import { newState, processTurn } from './lib/infer.mjs';
import { getCallLog, clearCallLog } from './lib/respond.mjs';

const REG_FIXTURE = 'C:/Users/Victus/trades/scripts/nex-conv/eval/regression-4-fixes.json';
const NAT_FIXTURE = 'C:/Users/Victus/trades/scripts/nex-conv/eval/natural-25turn.json';
const OUT_MD = 'C:/Users/Victus/trades/data/nex-conv/mvp/regression-and-natural-2026-08-15.md';
const OUT_JSON = 'C:/Users/Victus/trades/data/nex-conv/mvp/regression-and-natural-2026-08-15.json';

async function main() {
  const reg = JSON.parse(await readFile(REG_FIXTURE, 'utf8'));
  const nat = JSON.parse(await readFile(NAT_FIXTURE, 'utf8'));
  const backend = process.argv.find(a => a.startsWith('--backend='))?.slice('--backend='.length) ?? 'postgres';
  console.log(`[eval] backend=${backend}`);
  clearCallLog();
  const store = await createStore({ backend });
  console.log(`[eval] store · items=${store.counts().knowledge_items} · edges=${store.counts().edges}`);

  const results = { regression: [], natural: null };

  // --- Regression ---
  console.log(`\n[REGRESSION] ${reg.conversations.length} fixtures`);
  for (const conv of reg.conversations) {
    const state = newState({ brain: reg.brain });
    const perTurn = [];
    for (const t of conv.turns) {
      const out = await processTurn({ store, state, brain: reg.brain, text: t.customer, withProse: true });
      const reply = out.prose?.text || out.prose?.error || '';
      const failures = [];
      if (t.expect_intent && out.understood_intent.slug !== t.expect_intent) {
        failures.push(`intent expected ${t.expect_intent} got ${out.understood_intent.slug}`);
      }
      if (Array.isArray(t.expect_reply_no_phrase)) {
        for (const phrase of t.expect_reply_no_phrase) {
          if (new RegExp('\\b' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(reply)) {
            failures.push(`reply MUST NOT contain "${phrase}"`);
          }
        }
      }
      if (Array.isArray(t.expect_reply_no_regex)) {
        for (const rxSrc of t.expect_reply_no_regex) {
          if (new RegExp(rxSrc, 'i').test(reply)) {
            failures.push(`reply MUST NOT match /${rxSrc}/i`);
          }
        }
      }
      // M4-BUG-01: state-shape assertions
      if (Array.isArray(t.expect_no_fact_field)) {
        for (const field of t.expect_no_fact_field) {
          if (state.established_facts?.[field]?.value != null) {
            failures.push(`state.established_facts.${field} MUST be unset · got value="${state.established_facts[field].value}" provenance=${state.established_facts[field].provenance ?? '(none)'}`);
          }
        }
      }
      if (Array.isArray(t.expect_entities_after_contains)) {
        const missing = t.expect_entities_after_contains.filter(e => !state.entities_in_focus.includes(e));
        if (missing.length) failures.push(`entities missing from focus: ${missing.join(',')} (got: ${state.entities_in_focus.join(',')})`);
      }
      perTurn.push({ customer: t.customer, intent: out.understood_intent.slug, reply, facts: { ...state.established_facts }, failures });
      console.log(`  ${failures.length ? '✗' : '✓'} ${conv.id} · "${t.customer.slice(0, 60)}" · ${out.understood_intent.slug}${failures.length ? ' · ' + failures.join('; ') : ''}`);
    }
    const passed = perTurn.reduce((n, p) => n + (p.failures.length === 0 ? 1 : 0), 0);
    results.regression.push({ id: conv.id, purpose: conv.purpose, turns: perTurn, passed, total: perTurn.length });
  }
  const regTotals = results.regression.reduce((s, c) => ({ passed: s.passed + c.passed, total: s.total + c.total }), { passed: 0, total: 0 });
  console.log(`\n[REGRESSION SUMMARY] ${regTotals.passed}/${regTotals.total} probes passed`);

  // --- Natural 25-turn ---
  console.log(`\n[NATURAL 25-TURN] running...`);
  const natState = newState({ brain: nat.brain });
  const natTurns = [];
  for (const t of nat.turns) {
    const t0 = Date.now();
    const out = await processTurn({ store, state: natState, brain: nat.brain, text: t.customer, withProse: true });
    const dt = Date.now() - t0;
    const reply = out.prose?.text || out.prose?.error || '';
    natTurns.push({
      n: t.n,
      customer: t.customer,
      intent: out.understood_intent.slug,
      entities: out.understood_entities,
      state_facts: { ...natState.established_facts },
      state_focus: [...natState.entities_in_focus],
      state_constraints: [...natState.constraints],
      state_delta: natState.last_turn_state_delta,
      corrections_log_len: natState.corrections_log.length,
      reply,
      latency_ms: dt,
    });
    console.log(`  T${t.n} · [${out.understood_intent.slug}] ${dt}ms · "${t.customer.slice(0, 50)}"`);
    console.log(`     NEX: ${reply.replace(/\n/g, ' ').slice(0, 200)}`);
  }
  results.natural = {
    fixture: nat.id,
    total_turns: natTurns.length,
    avg_latency_ms: +(natTurns.reduce((s, t) => s + t.latency_ms, 0) / natTurns.length).toFixed(1),
    final_state: {
      turn_count: natState.turn_count,
      material: natState.established_facts.material_primary?.value,
      style: natState.established_facts.style_intent?.value,
      constraints: natState.constraints,
      corrections_logged: natState.corrections_log.length,
    },
    turns: natTurns,
  };
  console.log(`\n[NATURAL SUMMARY] ${natTurns.length} turns · avg ${results.natural.avg_latency_ms}ms/turn · final material=${results.natural.final_state.material} · corrections=${results.natural.final_state.corrections_logged}`);

  await writeFile(OUT_JSON, JSON.stringify(results, null, 2));
  await writeFile(OUT_MD, renderMd(results, reg, nat, regTotals));
  if (typeof store.close === 'function') await store.close();
  console.log(`\nreport: ${OUT_MD}`);
}

function renderMd(r, reg, nat, regTotals) {
  const out = [];
  out.push(`# NEX conversation · regression + 25-turn natural test · 2026-08-15`);
  out.push('');
  out.push(`- Regression fixtures: **${regTotals.passed}/${regTotals.total} probes passed**`);
  out.push(`- Natural conversation: **${r.natural.total_turns} turns**, avg **${r.natural.avg_latency_ms}ms** per turn`);
  out.push(`- Final state: material=${r.natural.final_state.material ?? '—'} · style=${r.natural.final_state.style ?? '—'} · constraints=[${r.natural.final_state.constraints.join(', ') || '—'}] · corrections=${r.natural.final_state.corrections_logged}`);
  out.push('');
  out.push(`## Regression per-fixture`);
  out.push('');
  for (const c of r.regression) {
    out.push(`### ${c.id} · ${c.passed}/${c.total}`);
    out.push(`_${c.purpose}_`);
    out.push('');
    for (const t of c.turns) {
      out.push(`- **${t.failures.length ? '✗' : '✓'}** \`${t.intent}\` · Customer: *${escape(t.customer)}*`);
      out.push(`  NEX: ${escape(t.reply.slice(0, 260))}`);
      if (t.failures.length) for (const f of t.failures) out.push(`  · ✗ ${escape(f)}`);
    }
    out.push('');
  }
  out.push(`## Natural 25-turn transcript`);
  out.push('');
  out.push('| T | Customer | Intent | Reply (first 180 chars) | Facts | Focus (top 4) | Latency |');
  out.push('|---|---|---|---|---|---|---|');
  for (const t of r.natural.turns) {
    const facts = Object.entries(t.state_facts).map(([k, v]) => `${k}=${v.value}`).join(' · ') || '—';
    const focus = t.state_focus.slice(0, 4).join(',') || '—';
    out.push(`| ${t.n} | ${escape(t.customer)} | ${t.intent} | ${escape(t.reply.slice(0, 180))} | ${escape(facts)} | ${escape(focus)} | ${t.latency_ms}ms |`);
  }
  out.push('');
  return out.join('\n');
}
function escape(s) { return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' '); }

await main();
