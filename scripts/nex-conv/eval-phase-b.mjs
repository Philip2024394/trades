// Phase B regression runner · asserts on emotion, secondary_intents,
// handoff_recommended, condensed_history and entity capture.

import { readFile, writeFile } from 'node:fs/promises';
import { createStore } from './lib/store-factory.mjs';
import { newState, processTurn } from './lib/infer.mjs';
import { clearCallLog } from './lib/respond.mjs';
import { STAIRCASE_ENTITIES, STAIRCASE_INTENTS } from './lib/entities.mjs';

const FIXTURE = 'C:/Users/Victus/trades/scripts/nex-conv/eval/regression-phase-b.json';
const OUT_MD = 'C:/Users/Victus/trades/data/nex-conv/mvp/phase-b-regression-2026-08-15.md';
const OUT_JSON = 'C:/Users/Victus/trades/data/nex-conv/mvp/phase-b-regression-2026-08-15.json';

async function main() {
  const fx = JSON.parse(await readFile(FIXTURE, 'utf8'));
  const backend = process.argv.find(a => a.startsWith('--backend='))?.slice('--backend='.length) ?? 'postgres';
  console.log(`[phase-b] backend=${backend}`);
  clearCallLog();
  const store = await createStore({ backend });
  // Idempotent seed of ontology · picks up any entities/intents added since
  // the last ingest (Phase B added renovation, terrace_house, hallway, etc.)
  for (const intent of STAIRCASE_INTENTS) await store.upsertIntent(intent);
  for (const ent of STAIRCASE_ENTITIES) await store.upsertEntity({ ...ent, brain: fx.brain });
  const results = [];
  for (const conv of fx.conversations) {
    const state = newState({ brain: fx.brain });
    const perTurn = [];
    for (const t of conv.turns) {
      const out = await processTurn({ store, state, brain: fx.brain, text: t.customer, withProse: true });
      const failures = [];
      if (t.expect_intent && out.understood_intent.slug !== t.expect_intent) {
        failures.push(`intent expected ${t.expect_intent} got ${out.understood_intent.slug}`);
      }
      if (t.expect_secondary_intent_slug) {
        const gotSec = (out.secondary_intents ?? []).map(s => s.slug);
        if (!gotSec.includes(t.expect_secondary_intent_slug)) {
          failures.push(`secondary intent ${t.expect_secondary_intent_slug} missing · got [${gotSec.join(',')}]`);
        }
      }
      if (t.expect_emotion && out.emotion?.register !== t.expect_emotion) {
        failures.push(`emotion expected ${t.expect_emotion} got ${out.emotion?.register}`);
      }
      if (t.expect_entities_after_contains) {
        const focus = state.entities_in_focus ?? [];
        const missing = t.expect_entities_after_contains.filter(e => !focus.includes(e));
        if (missing.length) failures.push(`entities missing from focus: ${missing.join(',')} (got: ${focus.join(',')})`);
      }
      if (t.expect_reply_no_phrase) {
        const reply = (out.prose?.text || '').toLowerCase();
        for (const p of t.expect_reply_no_phrase) {
          if (new RegExp('\\b' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(reply)) {
            failures.push(`reply MUST NOT contain "${p}"`);
          }
        }
      }
      if (t.expect_handoff_recommended && out.handoff_recommended !== true) {
        failures.push(`handoff_recommended expected true got ${out.handoff_recommended}`);
      }
      if (t.expect_condensed_history_populated && !state.condensed_history) {
        failures.push(`condensed_history expected to be populated`);
      }
      perTurn.push({
        customer: t.customer,
        intent: out.understood_intent.slug,
        secondary: (out.secondary_intents ?? []).map(s => s.slug),
        emotion: out.emotion?.register,
        entities_in_focus: [...state.entities_in_focus],
        handoff: out.handoff_recommended,
        condensed_summary: state.condensed_history?.summary?.slice(0, 100) ?? null,
        reply: (out.prose?.text || '').slice(0, 220),
        failures,
      });
      console.log(`  ${failures.length ? '✗' : '✓'} ${conv.id} · "${t.customer.slice(0, 60)}" · [${out.understood_intent.slug} · sec=${(out.secondary_intents ?? []).map(s => s.slug).join(',') || '-'} · emo=${out.emotion?.register}]${failures.length ? ' · ' + failures.join('; ') : ''}`);
    }
    const passed = perTurn.reduce((n, p) => n + (p.failures.length === 0 ? 1 : 0), 0);
    results.push({ id: conv.id, purpose: conv.purpose, passed, total: perTurn.length, turns: perTurn });
  }
  const totals = results.reduce((s, r) => ({ passed: s.passed + r.passed, total: s.total + r.total }), { passed: 0, total: 0 });
  const summary = { fixture: fx.id, totals, per_conversation: results };
  await writeFile(OUT_JSON, JSON.stringify(summary, null, 2));
  await writeFile(OUT_MD, renderMd(summary));
  if (typeof store.close === 'function') await store.close();
  console.log(`\n[PHASE-B SUMMARY] ${totals.passed}/${totals.total} probes passed`);
  console.log(`report: ${OUT_MD}`);
}

function renderMd(s) {
  const out = [];
  out.push(`# Phase B regression · ${s.totals.passed}/${s.totals.total} probes passed`);
  out.push('');
  for (const c of s.per_conversation) {
    out.push(`## ${c.id} · ${c.passed}/${c.total}`);
    out.push(`_${c.purpose}_`);
    out.push('');
    for (const t of c.turns) {
      out.push(`- ${t.failures.length ? '✗' : '✓'} Customer: *${esc(t.customer)}*`);
      out.push(`  intent=\`${t.intent}\` · secondary=[${t.secondary.join(',')}] · emotion=\`${t.emotion}\` · focus=[${(t.entities_in_focus || []).slice(0, 5).join(',')}] · handoff=${t.handoff}`);
      if (t.condensed_summary) out.push(`  condensed: _${esc(t.condensed_summary)}_`);
      out.push(`  NEX: ${esc(t.reply)}`);
      if (t.failures.length) for (const f of t.failures) out.push(`    · ✗ ${esc(f)}`);
      out.push('');
    }
  }
  return out.join('\n');
}
function esc(s) { return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' '); }

await main();
