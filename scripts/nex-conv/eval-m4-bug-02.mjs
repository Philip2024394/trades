// M4-BUG-02 regression runner · runs eval/m4-bug-02-knowledge-leak.json
// against the live pipeline (with Ollama). Same assertion vocabulary as
// eval-m4-bug-01.mjs · shared assertion set kept intentionally parallel.

import { readFile } from 'node:fs/promises';
import { createStore } from './lib/store-factory.mjs';
import { newState, processTurn } from './lib/infer.mjs';
import { clearCallLog } from './lib/respond.mjs';

const FIXTURE = 'C:/Users/Victus/trades/scripts/nex-conv/eval/m4-bug-02-knowledge-leak.json';

async function main() {
  const fx = JSON.parse(await readFile(FIXTURE, 'utf8'));
  const backend = process.argv.find(a => a.startsWith('--backend='))?.slice('--backend='.length) ?? 'postgres';
  console.log(`[m4-bug-02] backend=${backend}`);
  clearCallLog();
  const store = await createStore({ backend });
  const results = [];
  for (const conv of fx.conversations) {
    const state = newState({ brain: fx.brain });
    const perTurn = [];
    for (const t of conv.turns) {
      const out = await processTurn({ store, state, brain: fx.brain, text: t.customer, withProse: true });
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
      if (Array.isArray(t.expect_no_fact_field)) {
        for (const field of t.expect_no_fact_field) {
          if (state.established_facts?.[field]?.value != null) {
            failures.push(`state.established_facts.${field} MUST be unset · got value="${state.established_facts[field].value}" prov=${state.established_facts[field].provenance ?? '(none)'}`);
          }
        }
      }
      perTurn.push({ customer: t.customer, intent: out.understood_intent.slug, reply, facts: { ...state.established_facts }, failures });
      console.log(`  ${failures.length ? '✗' : '✓'} ${conv.id} · "${t.customer.slice(0, 60)}" · ${out.understood_intent.slug}${failures.length ? ' · ' + failures.join(' | ') : ''}`);
      if (failures.length) console.log(`      reply: "${reply.slice(0, 260)}"`);
    }
    const passed = perTurn.reduce((n, p) => n + (p.failures.length === 0 ? 1 : 0), 0);
    results.push({ id: conv.id, purpose: conv.purpose, passed, total: perTurn.length });
    console.log(`  [${conv.id}] ${passed}/${perTurn.length}`);
  }
  const totals = results.reduce((s, r) => ({ passed: s.passed + r.passed, total: s.total + r.total }), { passed: 0, total: 0 });
  console.log(`\n[M4-BUG-02 SUMMARY] ${totals.passed}/${totals.total} probes passed`);
  if (typeof store.close === 'function') await store.close();
  process.exit(totals.passed === totals.total ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(2); });
