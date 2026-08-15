// Parse the two staircase image batches into knowledge items.
// Each entry has: id · description · question/answer pairs · entities we
// can map onto the ontology · surface-gating hints.

import { readFile } from 'node:fs/promises';
import { newId } from '../lib/schema.mjs';
import { extractEntities, extractIntent } from '../lib/extract.mjs';

const BATCH_FILES = [
  {
    path: 'C:/Users/Victus/trades/data/nex-brain-image-batches/staircase-string-types-2026-08-15.json',
    tag: 'string-types',
  },
  {
    path: 'C:/Users/Victus/trades/data/nex-brain-image-batches/staircase-multi-2026-08-15.json',
    tag: 'staircase-multi',
  },
];

export async function parseImageBatches(store) {
  const items = [];
  for (const bf of BATCH_FILES) {
    const raw = await readFile(bf.path, 'utf8');
    const doc = JSON.parse(raw);
    const source_batch = doc.batch_id;
    const entriesArray = doc.entries ?? [];
    for (const entry of entriesArray) {
      if (!entry.id || !entry.analysis) continue;
      // 1) One "statement" per entry from the description
      const descText = entry.analysis.description ?? '';
      if (descText) {
        const ents = extractEntities(descText, store);
        const intent = { slug: 'ask_definition', class: 'discover', confidence: 0.85 };
        items.push(buildItem({
          brain: 'staircase_brain',
          source_batch,
          source_ref: `${bf.tag}#${entry.id}`,
          kind: 'statement',
          answer_text: descText,
          intent, entities: ents, topics: filterTopics(ents, store),
          classification_confidence: 0.85, extraction_confidence: ents.length ? 0.85 : 0.6,
        }));
      }
      // 2) Each QA pair → its own knowledge item
      for (const qa of entry.qa ?? []) {
        if (!qa.q || !qa.a) continue;
        const combined = `${qa.q} ${qa.a}`;
        const ents = extractEntities(combined, store);
        const intent = extractIntent(qa.q, store);
        items.push(buildItem({
          brain: 'staircase_brain',
          source_batch,
          source_ref: `${bf.tag}#${entry.id}#qa`,
          kind: 'qa_pair',
          question_text: qa.q,
          answer_text: qa.a,
          intent, entities: ents, topics: filterTopics(ents, store),
          classification_confidence: intent.confidence,
          extraction_confidence: ents.length ? 0.85 : 0.65,
        }));
      }
    }
  }
  return items;
}

function buildItem({ brain, source_batch, source_ref, kind, question_text, answer_text, intent, entities, topics, classification_confidence, extraction_confidence }) {
  const base = Math.min(classification_confidence, extraction_confidence);
  return {
    id: newId(),
    brain,
    source_batch,
    source_ref,
    kind,
    question_text,
    answer_text,
    canonical_intent: intent.slug,
    entities,
    topics,
    confidence: +base.toFixed(3),
    draft_only: base < 0.70,
    _meta: { classification_confidence, extraction_confidence },
  };
}

function filterTopics(ents, store) {
  const store_entities = store.allEntities();
  return ents.filter(slug => {
    const ent = store_entities.find(x => x.slug === slug);
    return ent && (ent.entity_class === 'component' || ent.entity_class === 'style');
  });
}
