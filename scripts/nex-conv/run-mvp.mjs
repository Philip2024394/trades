// ADR-0044 MVP · top-level orchestrator.
// Runs the full pipeline against the closed dataset and produces a report
// with actual observed numbers for the deliverable.
//
// USAGE:
//   node scripts/nex-conv/run-mvp.mjs [--fresh]
//
// --fresh clears data/nex-conv/mvp/ before running (idempotency-friendly).

import { rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { Store } from './lib/store.mjs';
import { createStore } from './lib/store-factory.mjs';
import { runIngestion } from './ingest.mjs';
import { runEvaluation } from './evaluate.mjs';

const DATA_ROOT = 'C:/Users/Victus/trades/data/nex-conv/mvp';
// Report paths take a suffix per backend so we can compare runs.
function reportPaths(backend) {
  const suffix = backend === 'postgres' ? '-postgres' : '';
  return {
    json: `C:/Users/Victus/trades/data/nex-conv/mvp/run-report-2026-08-15${suffix}.json`,
    md:   `C:/Users/Victus/trades/data/nex-conv/mvp/run-report-2026-08-15${suffix}.md`,
    eval: `C:/Users/Victus/trades/data/nex-conv/mvp/eval-results-2026-08-15${suffix}.json`,
  };
}

async function main() {
  const fresh = process.argv.includes('--fresh');
  const evalOnly = process.argv.includes('--eval-only');
  const backendArg = process.argv.find(a => a.startsWith('--backend='));
  const backend = backendArg ? backendArg.slice('--backend='.length) : 'jsonl';
  if (!['jsonl', 'postgres'].includes(backend)) throw new Error(`unknown backend: ${backend}`);

  const paths = reportPaths(backend);
  const { json: REPORT_PATH, md: REPORT_MD_PATH, eval: EVAL_OUT } = paths;

  if (fresh) {
    if (backend === 'jsonl' && existsSync(DATA_ROOT)) {
      console.log(`[mvp] --fresh (jsonl) · clearing ${DATA_ROOT}`);
      await rm(DATA_ROOT, { recursive: true, force: true });
    }
    if (backend === 'postgres') {
      console.log('[mvp] --fresh (postgres) · TRUNCATE nex.conv_* tables');
      const pg = await import('pg');
      const c = new pg.Client({ connectionString: process.env.NEX_POSTGRES_URL });
      await c.connect();
      await c.query(`TRUNCATE
        nex.conv_feedback, nex.conv_outcomes, nex.conv_turns, nex.conv_states,
        nex.conv_edges, nex.conv_knowledge_items, nex.conv_entities, nex.conv_intents
        RESTART IDENTITY CASCADE`);
      await c.end();
    }
  }

  const started_at = new Date().toISOString();
  const wall_t0 = Date.now();

  console.log(`[mvp] initialising ${backend} store...`);
  const store = await createStore({ backend });

  let ingestReport;
  if (evalOnly && store.counts().knowledge_items > 0) {
    console.log(`[mvp] --eval-only · reusing ${store.counts().knowledge_items} existing items · skipping ingestion`);
    ingestReport = {
      per_source: { 'REUSED_EXISTING_INGEST': { parsed: store.counts().knowledge_items } },
      counts_before: store.counts(),
      counts_after: store.counts(),
      stages: { reused_ms: 0 },
      embed: { model: 'reused', dim: 384, warmup_ms: 0, embed_calls: 0, embed_total_ms: 0, embed_avg_ms: 0 },
      validation: { live: store.counts().knowledge_items_live, drafted: store.counts().knowledge_items_draft, rejected: 0 },
      edges: { proposed: store.counts().edges, accepted: store.counts().edges, rejected: 0, by_type: {} },
    };
    // Reconstruct by_type from actual edges
    for (const e of store.allEdges()) ingestReport.edges.by_type[e.edge_type] = (ingestReport.edges.by_type[e.edge_type] ?? 0) + 1;
  } else {
    console.log('[mvp] running ingestion...');
    const { report } = await runIngestion({ store });
    ingestReport = report;
  }

  console.log('[mvp] running evaluation...');
  const evalReport = await runEvaluation({ store, outFile: EVAL_OUT });

  const wall_total_ms = Date.now() - wall_t0;

  const runReport = {
    adr: 'ADR-0044',
    version: 'MVP',
    started_at,
    finished_at: new Date().toISOString(),
    wall_total_ms,
    dataset: {
      per_source: ingestReport.per_source,
      brain: 'staircase_brain',
    },
    counts: {
      before: ingestReport.counts_before,
      after: ingestReport.counts_after,
    },
    ingest_stage_ms: ingestReport.stages,
    embed: ingestReport.embed,
    validation: ingestReport.validation,
    edges: ingestReport.edges,
    evaluation: evalReport.aggregate,
    evaluation_per_conversation: evalReport.per_conversation.map(c => ({
      id: c.id, purpose: c.purpose, passed: c.passed, total: c.total, pass_rate: c.pass_rate,
      turns: c.turns.map(t => ({
        turn_index: t.turn_index,
        customer: t.customer,
        latency_ms: t.latency_ms,
        understood_intent: t.understood_intent.slug,
        entities: t.understood_entities,
        state_entities_in_focus: t.state_entities_in_focus,
        state_material: t.state_facts?.material_primary?.value ?? null,
        state_style: t.state_facts?.style_intent?.value ?? null,
        top_k_top_score: t.top_k_scores[0] ?? null,
        top_k_top_answer_head: t.top_k_top?.answer_head ?? null,
        top_k_top_source: t.top_k_top?.source_batch ?? null,
        assertions: t.assertions,
      })),
    })),
  };

  runReport.backend = backend;
  await writeFile(REPORT_PATH, JSON.stringify(runReport, null, 2));
  await writeFile(REPORT_MD_PATH, renderMarkdown(runReport));
  console.log(`\n[mvp] report written to ${REPORT_PATH}\n[mvp] markdown written to ${REPORT_MD_PATH}\n`);
  console.log(`=== HEADLINE (backend=${backend}) ===`);
  console.log(`Ingested items: ${runReport.counts.after.knowledge_items} (live ${runReport.counts.after.knowledge_items_live} · draft ${runReport.counts.after.knowledge_items_draft})`);
  console.log(`Entities: ${runReport.counts.after.entities}, Intents: ${runReport.counts.after.intents}, Edges: ${runReport.counts.after.edges}`);
  console.log(`Eval: ${runReport.evaluation.passed_assertions}/${runReport.evaluation.total_assertions} passed (${runReport.evaluation.overall_pass_rate}%)`);
  console.log(`Eval full-pass conversations: ${runReport.evaluation.conversations_full_pass}/${runReport.evaluation.conversations}`);
  console.log(`Avg turn latency: ${runReport.evaluation.avg_turn_latency_ms}ms · P95: ${runReport.evaluation.p95_turn_latency_ms}ms`);
  console.log(`Total wall time: ${wall_total_ms}ms`);
  if (typeof store.close === 'function') await store.close();
}

function renderMarkdown(r) {
  const out = [];
  out.push(`# NEX Conversation Learning MVP · Run Report`);
  out.push(``);
  out.push(`- ADR: **ADR-0044** · pilot brain: **${r.dataset.brain}**`);
  out.push(`- Started: \`${r.started_at}\``);
  out.push(`- Finished: \`${r.finished_at}\``);
  out.push(`- Total wall time: **${r.wall_total_ms}ms**`);
  out.push(``);
  out.push(`## Dataset`);
  out.push(``);
  out.push('| Source | Parsed |');
  out.push('|---|---|');
  for (const [k, v] of Object.entries(r.dataset.per_source)) out.push(`| ${k} | ${v.parsed}${v.conversations ? ` (${v.conversations} conversations)` : ''} |`);
  out.push(``);
  out.push(`## Storage counts (after ingestion)`);
  out.push(``);
  out.push('| Table | Count |');
  out.push('|---|---|');
  for (const [k, v] of Object.entries(r.counts.after)) out.push(`| ${k} | ${v} |`);
  out.push(``);
  out.push(`## Ingestion validation`);
  out.push(``);
  out.push('| Result | Count |');
  out.push('|---|---|');
  out.push(`| Live | ${r.validation.live} |`);
  out.push(`| Draft (0.50 ≤ confidence < 0.70) | ${r.validation.drafted} |`);
  out.push(`| Rejected (< 0.50 or schema fail) | ${r.validation.rejected} |`);
  out.push(``);
  out.push(`## Edges`);
  out.push(``);
  out.push(`- Proposed: **${r.edges.proposed}** · Accepted: **${r.edges.accepted}** · Rejected: **${r.edges.rejected}**`);
  out.push(``);
  out.push('| edge_type | count |');
  out.push('|---|---|');
  for (const [k, v] of Object.entries(r.edges.by_type).sort((a, b) => b[1] - a[1])) out.push(`| ${k} | ${v} |`);
  out.push(``);
  out.push(`## Embedding (bge-small-en-v1.5 · local · Xenova/@xenova/transformers)`);
  out.push(``);
  out.push('| Metric | Value |');
  out.push('|---|---|');
  out.push(`| Model | ${r.embed.model} |`);
  out.push(`| Dim | ${r.embed.dim} |`);
  out.push(`| Warm-up ms | ${r.embed.warmup_ms} |`);
  out.push(`| Total embed calls | ${r.embed.embed_calls} |`);
  out.push(`| Total embed ms | ${r.embed.embed_total_ms} |`);
  out.push(`| Avg embed ms/call | ${r.embed.embed_avg_ms} |`);
  out.push(``);
  out.push(`## Ingestion stage timings (ms)`);
  out.push(``);
  out.push('| Stage | ms |');
  out.push('|---|---|');
  for (const [k, v] of Object.entries(r.ingest_stage_ms)) if (typeof v === 'number') out.push(`| ${k} | ${v} |`);
  out.push(``);
  out.push(`## Evaluation`);
  out.push(``);
  out.push(`- Conversations: **${r.evaluation.conversations}** · Total turns: **${r.evaluation.total_turns}**`);
  out.push(`- Assertions: **${r.evaluation.passed_assertions}/${r.evaluation.total_assertions}** passed (**${r.evaluation.overall_pass_rate}%**)`);
  out.push(`- Full-pass conversations: **${r.evaluation.conversations_full_pass}/${r.evaluation.conversations}**`);
  out.push(`- Avg turn latency: **${r.evaluation.avg_turn_latency_ms}ms** · P95: **${r.evaluation.p95_turn_latency_ms}ms**`);
  out.push(``);
  out.push(`### Per-conversation results`);
  out.push(``);
  out.push('| ID | Purpose | Pass rate |');
  out.push('|---|---|---|');
  for (const c of r.evaluation_per_conversation) out.push(`| \`${c.id}\` | ${c.purpose} | ${c.passed}/${c.total} (${c.pass_rate}%) |`);
  out.push(``);
  out.push(`### Per-turn detail (each conversation)`);
  out.push(``);
  for (const c of r.evaluation_per_conversation) {
    out.push(`#### ${c.id} — ${c.passed}/${c.total}`);
    out.push('');
    out.push('| # | Customer | Intent | Entities | State-mat | State-focus | topK[0] score | topK[0] answer head | Assertions |');
    out.push('|---|---|---|---|---|---|---|---|---|');
    for (const t of c.turns) {
      const asrt = t.assertions.map(a => `${a.pass ? '✓' : '✗'} ${a.name}`).join(' · ');
      out.push(`| ${t.turn_index} | ${escape(t.customer)} | ${t.understood_intent} | ${(t.entities || []).join(',')} | ${t.state_material || '—'} | ${(t.state_entities_in_focus || []).slice(0, 6).join(',')} | ${t.top_k_top_score ?? '—'} | ${escape((t.top_k_top_answer_head || '').slice(0, 80))} | ${escape(asrt)} |`);
    }
    out.push('');
  }
  return out.join('\n');
}
function escape(s) { return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' '); }

await main();
