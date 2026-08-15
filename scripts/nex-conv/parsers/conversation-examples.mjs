// Parse conversation-examples.md into multi-turn ground-truth conversations.
// This file is the closest thing we have to "real staircase conversations"
// per Philip's MVP data list. Each ## Conversation N heading starts a
// separate conversation. Every **Customer:** / **NEX:** pair becomes an
// ordered turn. Result feeds two consumers:
//   1) Ingestion — pairs become qa_pair knowledge_items with source_ref
//      set to the conversation id, enabling `follows_from` edge inference.
//   2) Evaluation — the conversations become fixture inputs the eval
//      harness can replay to check state + retrieval behaviour.

import { readFile } from 'node:fs/promises';
import { newId } from '../lib/schema.mjs';
import { extractEntities, extractIntent } from '../lib/extract.mjs';

const PATH = 'C:/Users/Victus/trades/data/nex-reference-brains/staircase-preparation/conversational-intelligence/conversation-examples.md';

export async function parseConversationExamples(store) {
  const raw = await readFile(PATH, 'utf8');
  const body = raw.replace(/^---[\s\S]*?---\n?/, '');
  const sections = body.split(/^##\s+/m).slice(1); // first split is the file preamble

  const conversations = [];
  const items = [];

  for (const section of sections) {
    const lines = section.split('\n');
    const heading = lines[0].trim();
    if (!/conversation\s*\d/i.test(heading)) continue;
    const conv_id = 'conv-example-' + heading.match(/^conversation\s*(\d+)/i)?.[1];
    const source_ref = `conversation-examples#${conv_id}`;
    const source_batch = 'conversation-examples-2026-08-14';

    // Split section body into blocks
    const blocks = section.split(/\n\s*\n+/).map(b => b.trim()).filter(Boolean);
    const turns = [];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const custMatch = b.match(/^\*\*Customer:\*\*\s*(.+)/s);
      if (custMatch) {
        const custText = strip(custMatch[1]);
        const next = blocks[i + 1] ?? '';
        const nexMatch = next.match(/^\*\*NEX:\*\*\s*(.+)/s);
        if (nexMatch) {
          const nexText = strip(nexMatch[1]);
          turns.push({ speaker: 'customer', text: custText });
          turns.push({ speaker: 'nex', text: nexText });
        }
      }
    }
    if (!turns.length) continue;
    conversations.push({ conversation_id: conv_id, heading, turns });

    // Emit knowledge items per Customer→NEX pair
    const sequence = [];
    for (let i = 0; i < turns.length - 1; i += 2) {
      const c = turns[i], n = turns[i + 1];
      const combined = `${c.text} ${n.text}`;
      const ents = extractEntities(combined, store);
      const intent = extractIntent(c.text, store);
      const topics = filterTopics(ents, store);
      const cls = intent.confidence;
      const ext = ents.length ? 0.88 : 0.65;
      const base = Math.min(cls, ext);
      const item = {
        id: newId(),
        brain: 'staircase_brain',
        source_batch,
        source_ref,
        kind: 'qa_pair',
        question_text: c.text,
        answer_text: n.text,
        canonical_intent: intent.slug,
        entities: ents, topics,
        confidence: +base.toFixed(3),
        draft_only: base < 0.70,
        _meta: { classification_confidence: cls, extraction_confidence: ext, conv_id, turn_pair_index: i / 2 },
      };
      items.push(item);
      sequence.push(item.id);
    }
    // Persist the sequence so link.mjs can build follows_from edges
    conversations[conversations.length - 1].sequence = sequence;
  }
  return { conversations, items };
}

function strip(s) {
  return s
    .split('\n')
    .filter(l => !/^\*\*Source/i.test(l))
    .join(' ')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function filterTopics(ents, store) {
  const store_entities = store.allEntities();
  return ents.filter(slug => {
    const ent = store_entities.find(x => x.slug === slug);
    return ent && (ent.entity_class === 'component' || ent.entity_class === 'style');
  });
}
