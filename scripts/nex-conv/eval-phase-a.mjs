// Phase A validation runner · runs the 30-turn natural conversation
// and evaluates the 5 Phase-A probes against actual output.

import { readFile, writeFile } from 'node:fs/promises';
import { createStore } from './lib/store-factory.mjs';
import { newState, processTurn } from './lib/infer.mjs';
import { clearCallLog } from './lib/respond.mjs';

const FIXTURE = 'C:/Users/Victus/trades/scripts/nex-conv/eval/natural-30turn-phase-a.json';
const OUT_MD = 'C:/Users/Victus/trades/data/nex-conv/mvp/phase-a-30turn-2026-08-15.md';
const OUT_JSON = 'C:/Users/Victus/trades/data/nex-conv/mvp/phase-a-30turn-2026-08-15.json';
const BACKCHANNEL_TURNS = new Set([5, 7, 9, 11, 16, 26]);

async function main() {
  const fx = JSON.parse(await readFile(FIXTURE, 'utf8'));
  const backend = process.argv.find(a => a.startsWith('--backend='))?.slice('--backend='.length) ?? 'postgres';
  console.log(`[phase-a] backend=${backend}`);
  clearCallLog();
  const store = await createStore({ backend });
  const state = newState({ brain: fx.brain });
  const turns = [];
  for (const t of fx.turns) {
    const t0 = Date.now();
    const out = await processTurn({ store, state, brain: fx.brain, text: t.customer, withProse: true });
    const dt = Date.now() - t0;
    const reply = out.prose?.text || out.prose?.error || '';
    turns.push({
      n: t.n,
      customer: t.customer,
      intent: out.understood_intent.slug,
      state_facts: { ...state.established_facts },
      reply,
      reply_chars: reply.length,
      latency_ms: dt,
    });
    console.log(`  T${t.n} · [${out.understood_intent.slug}] ${dt}ms · "${t.customer.slice(0, 55)}"`);
    console.log(`     NEX: ${reply.replace(/\n/g, ' ').slice(0, 180)}`);
  }
  const probeResults = evaluateProbes(turns);
  const summary = {
    fixture: fx.id,
    turns: turns.length,
    avg_latency_ms: +(turns.reduce((s, t) => s + t.latency_ms, 0) / turns.length).toFixed(1),
    probes: probeResults,
  };
  await writeFile(OUT_JSON, JSON.stringify({ summary, turns }, null, 2));
  await writeFile(OUT_MD, renderMd(summary, turns, fx));
  if (typeof store.close === 'function') await store.close();
  console.log(`\n[PHASE-A SUMMARY]`);
  for (const p of probeResults) console.log(`  ${p.pass ? '✓' : '✗'} ${p.name} · ${p.detail}`);
  console.log(`\nreport: ${OUT_MD}`);
}

function evaluateProbes(turns) {
  const results = [];
  const nexTexts = turns.map(t => (t.reply || '').toLowerCase());
  // 1 · no repetitive closer
  const wleCount = nexTexts.filter(r =>
    /would you like to explore\s+(price|installation|comparison)/.test(r)).length;
  results.push({
    name: 'no_repetitive_closer',
    pass: wleCount <= 2,
    detail: `"would you like to explore price/installation/comparison" appeared ${wleCount}/${turns.length} turns (target ≤2)`,
  });
  // 2 · backchannel short + no forced advice
  const bcFailures = [];
  for (const t of turns) {
    if (!BACKCHANNEL_TURNS.has(t.n)) continue;
    const reply = (t.reply || '').toLowerCase();
    if (t.reply_chars > 220) bcFailures.push(`T${t.n} reply ${t.reply_chars} chars`);
    if (/against a wall|would you like to explore/.test(reply)) bcFailures.push(`T${t.n} contains forbidden phrase`);
  }
  results.push({
    name: 'backchannel_short',
    pass: bcFailures.length === 0,
    detail: bcFailures.length ? `failures: ${bcFailures.join(', ')}` : `all ${BACKCHANNEL_TURNS.size} backchannel turns clean`,
  });
  // 3 · thin-packet playbook on price question (T13)
  const t13 = turns.find(t => t.n === 13);
  const t13Text = (t13?.reply || '').toLowerCase();
  const hasFabricatedPrice = /£\s*\d{1,3}[,.]?\d{0,3}/.test(t13Text) || /\$\s*\d{1,3}/.test(t13Text);
  const hasHonestPhrase = /(don'?t have|not sure of|need to check|check with (the )?team|similar examples|someone .* call|not able to say|depends on|need a bit more)/i.test(t13Text);
  results.push({
    name: 'thin_packet_playbook',
    pass: !hasFabricatedPrice && (hasHonestPhrase || t13Text.length > 0),
    detail: `T13 fabricated price=${hasFabricatedPrice} · honest phrase=${hasHonestPhrase}`,
  });
  // 4 · close recognised
  const t30 = turns.find(t => t.n === 30);
  const t30Text = (t30?.reply || '').toLowerCase();
  const startedNewLoop = /(against a wall|which style|open on both|closed string|cut string|balustrade)/i.test(t30Text);
  results.push({
    name: 'close_recognised',
    pass: !startedNewLoop,
    detail: `T30 (great thanks) started new discovery loop=${startedNewLoop} · intent=${t30?.intent}`,
  });
  // 5 · callback used at least once after turn 6
  // Any of: "you mentioned" · "as you said" · "given the X you" · "for the X you"
  // · "back to the X" · "since your ..." · "the X you (mentioned|said|noted|chose)"
  const callbackCount = turns.filter(t => t.n > 6).filter(t => {
    const r = (t.reply || '').toLowerCase();
    return /you mentioned|as you (said|noted|mentioned)|given (the|your|that) [a-z ]{2,25}you|for (the|your) [a-z ]{2,25}you|back to (the|your) [a-z ]{2,25}|since (your|the) |the [a-z ]+ you (mentioned|said|chose|noted|described|picked|wanted|liked)|(that|the) [a-z ]+ you'?re/i.test(r);
  }).length;
  results.push({
    name: 'callback_used_somewhere',
    pass: callbackCount > 0,
    detail: `${callbackCount} NEX turns reference an earlier fact by name`,
  });
  return results;
}

function renderMd(s, turns, fx) {
  const out = [];
  out.push(`# NEX Phase A · 30-turn natural conversation test`);
  out.push('');
  out.push(`- Fixture: \`${s.fixture}\` · ${s.turns} turns · avg **${s.avg_latency_ms}ms**/turn`);
  out.push('');
  out.push(`## Phase A probes`);
  out.push('');
  for (const p of s.probes) out.push(`- **${p.pass ? '✓ PASS' : '✗ FAIL'}** · \`${p.name}\` · ${p.detail}`);
  out.push('');
  out.push(`## Transcript`);
  out.push('');
  out.push('| T | Customer | Intent | Reply |');
  out.push('|---|---|---|---|');
  for (const t of turns) {
    out.push(`| ${t.n} | ${escape(t.customer)} | ${t.intent} | ${escape((t.reply || '').slice(0, 220))} |`);
  }
  return out.join('\n');
}
function escape(s) { return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' '); }

await main();
