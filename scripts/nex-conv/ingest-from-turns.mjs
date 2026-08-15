// M3-1 · Ingest-from-turns · closes the feedback loop.
//
// Reads nex.conv_turns (populated on every real customer interaction),
// pairs customer + immediately-following NEX turn into candidate qa_pair
// items, and runs them through the same extract → embed → link → score →
// validate → store pipeline that the batch ingester uses.
//
// Idempotent · content-hash UUIDs mean the same turn pair produces the
// same knowledge_items.id on every run.
// Default: writes as draft_only=true so an admin can review before
// promoting to live retrieval (--auto-promote to bypass for pilot only).
//
// Usage:
//   node --env-file=.env.local scripts/nex-conv/ingest-from-turns.mjs
//   node --env-file=.env.local scripts/nex-conv/ingest-from-turns.mjs --since=2026-08-14
//   node --env-file=.env.local scripts/nex-conv/ingest-from-turns.mjs --dry-run

import { createHash } from 'node:crypto';
import { createStore } from './lib/store-factory.mjs';
import { STAIRCASE_ENTITIES, STAIRCASE_INTENTS } from './lib/entities.mjs';
import { extractEntities, extractIntent } from './lib/extract.mjs';
import { embedBatch, toArray, stats as embedStats } from './lib/embed.mjs';
import { proposeEdgesForItem } from './lib/link.mjs';
import { assertKnowledgeItem, assertEdge } from './lib/schema.mjs';
import pg from 'pg';

const HASH_KEYS = ['brain', 'source_ref', 'kind', 'question_text', 'answer_text'];

function contentHash(row) {
  const h = createHash('sha256');
  for (const k of HASH_KEYS) h.update(String(row[k] ?? ''));
  return h.digest('hex').slice(0, 32);
}

function hashToUuid(hex32) {
  const h = hex32.padEnd(32, '0').slice(0, 32);
  const v = '4' + h.slice(13);
  const vr = (parseInt(h[16], 16) & 0x3 | 0x8).toString(16);
  const p = h.slice(0, 12) + v.slice(0, 4) + vr + h.slice(17);
  return `${p.slice(0,8)}-${p.slice(8,12)}-${p.slice(12,16)}-${p.slice(16,20)}-${p.slice(20,32)}`;
}

async function main() {
  const args = process.argv.slice(2);
  const since = args.find(a => a.startsWith('--since='))?.slice('--since='.length) ?? '2000-01-01';
  const dryRun = args.includes('--dry-run');
  const autoPromote = args.includes('--auto-promote');
  const conversationIdFilter = args.find(a => a.startsWith('--conversation='))?.slice('--conversation='.length);

  console.log(`[ingest-from-turns] since=${since} · dry-run=${dryRun} · auto-promote=${autoPromote}${conversationIdFilter ? ` · conversation=${conversationIdFilter}` : ''}`);

  const store = await createStore({ backend: 'postgres' });
  for (const intent of STAIRCASE_INTENTS) await store.upsertIntent(intent);
  for (const ent of STAIRCASE_ENTITIES) await store.upsertEntity({ ...ent, brain: 'staircase_brain' });

  // Read raw turn rows directly from Postgres (in-memory store is per-process)
  const client = new pg.Client({ connectionString: process.env.NEX_POSTGRES_URL });
  await client.connect();
  const params = [since];
  let filter = 'WHERE created_at >= $1';
  if (conversationIdFilter) { params.push(conversationIdFilter); filter += ` AND conversation_id = $${params.length}`; }
  const { rows } = await client.query(
    `SELECT id, conversation_id, turn_index, speaker, text, detected_intent, detected_entities, created_at
     FROM nex.conv_turns ${filter}
     ORDER BY conversation_id, turn_index`,
    params
  );
  await client.end();
  console.log(`[ingest-from-turns] loaded ${rows.length} raw turns from nex.conv_turns`);

  // Group by conversation_id, then pair consecutive customer→nex
  const byConv = new Map();
  for (const r of rows) {
    if (!byConv.has(r.conversation_id)) byConv.set(r.conversation_id, []);
    byConv.get(r.conversation_id).push(r);
  }
  console.log(`[ingest-from-turns] spans ${byConv.size} conversations`);

  const candidates = [];
  let skippedNoNext = 0, skippedError = 0;
  for (const [conv_id, turns] of byConv) {
    turns.sort((a, b) => a.turn_index - b.turn_index);
    for (let i = 0; i < turns.length - 1; i++) {
      const c = turns[i], n = turns[i + 1];
      if (c.speaker !== 'customer' || n.speaker !== 'nex') continue;
      const q = (c.text || '').trim();
      const a = (n.text || '').trim();
      if (!q || !a) { skippedError++; continue; }
      if (a === '(no prose)' || a.startsWith('Give me a moment') || a.startsWith('Hmm — conversation engine failed')) {
        skippedError++; continue; // skip warm-up/error placeholders
      }
      candidates.push({
        conv_id,
        turn_index: c.turn_index,
        customer_text: q,
        nex_text: a,
        detected_intent: c.detected_intent,
        detected_entities: c.detected_entities || [],
        source_ref: `live-conv/${conv_id}#pair${c.turn_index}`,
      });
    }
    // Track dangling customer turns (no NEX response yet)
    for (let i = 0; i < turns.length; i++) {
      if (turns[i].speaker !== 'customer') continue;
      if (i === turns.length - 1 || turns[i + 1].speaker !== 'nex') skippedNoNext++;
    }
  }
  console.log(`[ingest-from-turns] ${candidates.length} customer→NEX pairs · skipped ${skippedNoNext} unanswered · ${skippedError} errored/placeholder`);

  // Turn each pair into a candidate knowledge_items row
  const t_build = Date.now();
  const items = [];
  for (const c of candidates) {
    const combined = `${c.customer_text} ${c.nex_text}`;
    const ents = extractEntities(combined, store);
    const intent = c.detected_intent ? { slug: c.detected_intent, confidence: 0.85 } : extractIntent(c.customer_text, store);
    const topics = ents.filter(e => {
      const ent = store.allEntities().find(x => x.slug === e);
      return ent && (ent.entity_class === 'component' || ent.entity_class === 'style');
    });
    const cls = intent.confidence ?? 0.75;
    const ext = ents.length ? 0.85 : 0.6;
    const base = Math.min(cls, ext);
    const row = {
      brain: 'staircase_brain',
      source_batch: 'live-conversations-2026-08-15',
      source_ref: c.source_ref,
      kind: 'qa_pair',
      question_text: c.customer_text,
      answer_text: c.nex_text,
      canonical_intent: intent.slug,
      entities: ents,
      topics,
      confidence: +base.toFixed(3),
      // Live-ingested items ALWAYS default to draft_only=true unless auto-promote
      // is set. Human review before they enter live retrieval.
      draft_only: autoPromote ? (base < 0.70) : true,
      _meta: { source: 'live-turn-ingest', conv_id: c.conv_id, turn_index: c.turn_index },
    };
    const h = contentHash(row);
    row.id = hashToUuid(h);
    items.push(row);
  }
  const buildMs = Date.now() - t_build;

  // Dedupe against store's existing knowledge_items by id
  const existing = new Set(store.allItems().map(x => x.id));
  const fresh = items.filter(it => !existing.has(it.id));
  const dupes = items.length - fresh.length;
  console.log(`[ingest-from-turns] ${items.length} candidates · ${dupes} already present · ${fresh.length} new`);

  if (!fresh.length) {
    console.log(`[ingest-from-turns] no new items · exit clean`);
    if (typeof store.close === 'function') await store.close();
    return;
  }

  if (dryRun) {
    console.log(`[ingest-from-turns] --dry-run · showing what WOULD be inserted:`);
    for (const it of fresh.slice(0, 5)) {
      console.log(`  [${it.canonical_intent}] Q: "${it.question_text.slice(0, 70)}" · A: "${it.answer_text.slice(0, 90)}" · draft=${it.draft_only} · conf=${it.confidence} · entities=${it.entities.join(',')}`);
    }
    if (fresh.length > 5) console.log(`  ... and ${fresh.length - 5} more`);
    if (typeof store.close === 'function') await store.close();
    return;
  }

  // Embed + validate + write items
  const t_embed = Date.now();
  const texts = fresh.map(f => `${f.question_text} ${f.answer_text}`);
  const vectors = await embedBatch(texts, {
    batchSize: 8,
    onProgress: ({ done, total }) => (done % 20 === 0 || done === total) && console.log(`  embed ${done}/${total}`),
  });
  for (let i = 0; i < fresh.length; i++) fresh[i].embedding = toArray(vectors[i]);
  console.log(`[ingest-from-turns] embedded ${fresh.length} in ${Date.now() - t_embed}ms · ${JSON.stringify(embedStats())}`);

  // Validate + write
  const t_write = Date.now();
  let writeOk = 0, writeSkip = 0;
  for (const it of fresh) {
    try {
      assertKnowledgeItem(it);
      const { _meta, ...clean } = it;
      await store.writeKnowledgeItem(clean);
      writeOk++;
    } catch (e) {
      writeSkip++;
      console.warn(`  reject: ${e.message} · ${it.source_ref}`);
    }
  }
  console.log(`[ingest-from-turns] wrote ${writeOk} items · skipped ${writeSkip} · in ${Date.now() - t_write}ms`);

  // Link · propose edges from new items to existing
  const t_link = Date.now();
  const allItems = store.allItems();
  const allItemsTyped = allItems.map(it => ({ ...it, embedding: it.embedding ? Float32Array.from(it.embedding) : null }));
  let edgesProposed = 0, edgesWritten = 0;
  for (const it of fresh) {
    const edges = proposeEdgesForItem(
      { ...it, embedding: Float32Array.from(it.embedding) },
      allItemsTyped,
      { conversationSequence: null }
    );
    for (const edge of edges) {
      edgesProposed++;
      try {
        assertEdge(edge);
        await store.writeEdge(edge);
        edgesWritten++;
      } catch { /* soft-reject below floor */ }
    }
  }
  console.log(`[ingest-from-turns] linked · proposed ${edgesProposed} · written ${edgesWritten} · in ${Date.now() - t_link}ms`);

  console.log(`\n=== SUMMARY ===`);
  console.log(`Turns loaded:         ${rows.length}`);
  console.log(`Conversations:        ${byConv.size}`);
  console.log(`Candidate pairs:      ${candidates.length}`);
  console.log(`Build ms:             ${buildMs}`);
  console.log(`Already present:      ${dupes}`);
  console.log(`New items written:    ${writeOk}`);
  console.log(`New edges written:    ${edgesWritten}`);
  console.log(`Store now holds:      ${store.counts().knowledge_items} items · ${store.counts().knowledge_items_live} live · ${store.counts().knowledge_items_draft} draft · ${store.counts().edges} edges`);

  if (typeof store.close === 'function') await store.close();
}

await main();
