// ADR-0044 MVP · ingestion orchestrator.
// RAW → NORMALISE → DEDUPE → CLASSIFY → EXTRACT → CREATE ITEMS → EMBED
//     → LINK → SCORE → VALIDATE → STORE (draft or live per gates)
//
// Idempotent: content hash → row id. Re-running against the same source
// does not create duplicates.

import { createHash } from 'node:crypto';
import { Store } from './lib/store.mjs';
import { createStore } from './lib/store-factory.mjs';
import { STAIRCASE_ENTITIES, STAIRCASE_INTENTS } from './lib/entities.mjs';
import { embed, embedBatch, toArray, stats as embedStats } from './lib/embed.mjs';
import { proposeEdgesForItem } from './lib/link.mjs';
import { assertKnowledgeItem, assertEdge } from './lib/schema.mjs';
import { parseImageBatches } from './parsers/image-batches.mjs';
import { parseConvIntelDocs } from './parsers/conv-intel-docs.mjs';
import { parseConversationExamples } from './parsers/conversation-examples.mjs';

const HASH_KEYS = ['brain', 'source_ref', 'kind', 'question_text', 'answer_text'];
function contentHash(row) {
  const h = createHash('sha256');
  for (const k of HASH_KEYS) h.update(String(row[k] ?? ''));
  return h.digest('hex').slice(0, 32);
}
/** Format 32 hex chars as a canonical UUID (version=4-like, variant bits set).
 *  Deterministic — same content hash → same UUID → idempotent inserts. */
function hashToUuid(hex32) {
  const h = hex32.padEnd(32, '0').slice(0, 32);
  // Set version nibble (13th hex → '4') and variant nibble (17th hex → 8/9/a/b)
  const v = '4' + h.slice(13);
  const vr = (parseInt(h[16], 16) & 0x3 | 0x8).toString(16);
  const p = h.slice(0, 12) + v.slice(0, 4) + vr + h.slice(17);
  return `${p.slice(0,8)}-${p.slice(8,12)}-${p.slice(12,16)}-${p.slice(16,20)}-${p.slice(20,32)}`;
}

export async function runIngestion({ store, verbose = true } = {}) {
  const report = {
    started_at: new Date().toISOString(),
    stages: {},
    counts_before: null,
    counts_after: null,
    per_source: {},
    validation: { rejected: 0, drafted: 0, live: 0 },
    edges: { proposed: 0, rejected: 0, accepted: 0, by_type: {} },
    embed: null,
  };
  // Caller usually passes a store; if not, default to JSONL (backwards-compatible).
  store ??= await new Store().init();
  report.counts_before = store.counts();
  report.backend = store.constructor?.name ?? 'unknown';

  // (a) Seed intents + entities (idempotent — upsert)
  const t_seed = Date.now();
  for (const intent of STAIRCASE_INTENTS) {
    await store.upsertIntent(intent);
  }
  for (const ent of STAIRCASE_ENTITIES) {
    await store.upsertEntity({ ...ent, brain: 'staircase_brain' });
  }
  report.stages.seed_ms = Date.now() - t_seed;
  if (verbose) console.log(`[ingest] seeded ${STAIRCASE_INTENTS.length} intents + ${STAIRCASE_ENTITIES.length} entities in ${report.stages.seed_ms}ms`);

  // (b) Parse all sources → candidate items
  const t_parse = Date.now();
  const imageItems = await parseImageBatches(store);
  report.per_source['image-batches'] = { parsed: imageItems.length };
  const convIntelItems = await parseConvIntelDocs(store);
  report.per_source['conv-intel-docs'] = { parsed: convIntelItems.length };
  const { conversations, items: convExItems } = await parseConversationExamples(store);
  report.per_source['conversation-examples'] = { parsed: convExItems.length, conversations: conversations.length };
  const candidates = [...imageItems, ...convIntelItems, ...convExItems];
  report.stages.parse_ms = Date.now() - t_parse;
  if (verbose) console.log(`[ingest] parsed ${candidates.length} candidates in ${report.stages.parse_ms}ms`);

  // (c) Dedupe by content hash
  const t_dedupe = Date.now();
  const seen = new Set();
  const deduped = [];
  let dupes = 0;
  for (const item of candidates) {
    const h = contentHash(item);
    if (seen.has(h)) { dupes++; continue; }
    seen.add(h);
    item.id = hashToUuid(h); // stable UUID → idempotent across both stores
    deduped.push(item);
  }
  report.stages.dedupe_ms = Date.now() - t_dedupe;
  report.stages.dupes_dropped = dupes;
  if (verbose) console.log(`[ingest] deduped ${candidates.length} → ${deduped.length} (${dupes} dupes dropped) in ${report.stages.dedupe_ms}ms`);

  // (d) Validate + gate — items already have confidence from parsers
  const t_val = Date.now();
  const valid = [];
  for (const item of deduped) {
    try {
      assertKnowledgeItem(item);
      valid.push(item);
      if (item.draft_only) report.validation.drafted++; else report.validation.live++;
    } catch (e) {
      report.validation.rejected++;
      if (verbose && report.validation.rejected < 5) console.warn(`[ingest] REJECTED: ${e.message} · ${item.source_ref}`);
    }
  }
  report.stages.validate_ms = Date.now() - t_val;
  if (verbose) console.log(`[ingest] validated ${valid.length}/${deduped.length} · live=${report.validation.live} · draft=${report.validation.drafted} · rejected=${report.validation.rejected} in ${report.stages.validate_ms}ms`);

  // (e) Embed (batched)
  const t_embed = Date.now();
  const texts = valid.map(v => v.question_text ? `${v.question_text} ${v.answer_text ?? ''}` : (v.answer_text ?? ''));
  if (verbose) console.log(`[ingest] embedding ${texts.length} items (first call downloads model if needed)...`);
  const vectors = await embedBatch(texts, {
    batchSize: 8,
    onProgress: ({ done, total, batch_ms }) => {
      if (verbose && (done % 40 === 0 || done === total)) {
        console.log(`[ingest]   embed ${done}/${total} · last batch ${batch_ms}ms`);
      }
    },
  });
  for (let i = 0; i < valid.length; i++) valid[i].embedding = toArray(vectors[i]);
  report.stages.embed_ms = Date.now() - t_embed;
  report.embed = embedStats();
  if (verbose) console.log(`[ingest] embedded ${valid.length} items in ${report.stages.embed_ms}ms · warmup=${report.embed.warmup_ms}ms · avg=${report.embed.embed_avg_ms}ms/call`);

  // (f) Persist items
  const t_write = Date.now();
  for (const item of valid) {
    // Strip _meta before persistence (it was ingest-only bookkeeping)
    const { _meta, ...clean } = item;
    await store.writeKnowledgeItem(clean);
  }
  report.stages.write_items_ms = Date.now() - t_write;

  // (g) Link — build edges
  const t_link = Date.now();
  const allItems = store.allItems();
  const convSequences = new Map();
  for (const conv of conversations) convSequences.set(conv.conversation_id, conv.sequence);
  let proposed = 0, accepted = 0, rejected = 0;
  for (const item of valid) {
    // Find the conversation sequence for this item if any
    const conv_id = item._meta?.conv_id;
    const sequence = conv_id ? convSequences.get(conv_id) : null;
    const edges = proposeEdgesForItem(
      { ...item, embedding: Float32Array.from(item.embedding) },
      allItems.map(it => ({ ...it, embedding: it.embedding ? Float32Array.from(it.embedding) : null })),
      { conversationSequence: sequence },
    );
    for (const edge of edges) {
      proposed++;
      try {
        assertEdge(edge);
        await store.writeEdge(edge);
        accepted++;
        report.edges.by_type[edge.edge_type] = (report.edges.by_type[edge.edge_type] ?? 0) + 1;
      } catch (e) {
        rejected++;
      }
    }
  }
  report.edges.proposed = proposed;
  report.edges.accepted = accepted;
  report.edges.rejected = rejected;
  report.stages.link_ms = Date.now() - t_link;
  if (verbose) console.log(`[ingest] linked · proposed=${proposed} · accepted=${accepted} · rejected=${rejected} · in ${report.stages.link_ms}ms`);

  report.counts_after = store.counts();
  report.total_ms = Object.values(report.stages).filter(v => typeof v === 'number').reduce((a, b) => a + b, 0);
  report.finished_at = new Date().toISOString();
  return { report, store, conversations };
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const { report } = await runIngestion();
  console.log(JSON.stringify(report, null, 2));
}
