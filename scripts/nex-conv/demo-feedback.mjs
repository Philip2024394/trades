// Demonstrate the feedback loop end-to-end:
//   1. Reuse ingested store
//   2. Run a short conversation, logging turns
//   3. Attach explicit feedback signals to specific turns
//   4. Label the conversation outcome
//   5. Show that all three persist to JSONL and reload correctly

import { Store } from './lib/store.mjs';
import { newState, processTurn } from './lib/infer.mjs';

const CONV_ID = 'demo-feedback-2026-08-15';

async function main() {
  const store = await new Store().init();
  const state = newState({ conversation_id: CONV_ID, brain: 'staircase_brain' });
  await store.upsertState(state);

  const script = [
    { speaker: 'customer', text: 'What does an oak staircase cost?', explicit_feedback: null },
    { speaker: 'customer', text: 'What about walnut?', explicit_feedback: 'helpful' },
    { speaker: 'customer', text: 'And installation?', explicit_feedback: 'helpful' },
  ];

  const turnIds = [];
  for (let i = 0; i < script.length; i++) {
    const s = script[i];
    const t0 = Date.now();
    const out = await processTurn({ store, state, brain: 'staircase_brain', text: s.text, speaker: s.speaker });
    const dt = Date.now() - t0;

    // Persist the customer turn
    const customerTurn = await store.writeTurn({
      conversation_id: CONV_ID,
      turn_index: state.turn_count - 1,
      speaker: 'customer',
      text: s.text,
      detected_intent: out.understood_intent.slug,
      detected_entities: out.understood_entities,
      used_item_ids: out.retrieved_top_k.map(k => k.id),
      walked_edge_ids: [],
      latency_ms: dt,
    });
    turnIds.push(customerTurn.id);

    // Persist the (synthetic) NEX response summary
    await store.writeTurn({
      conversation_id: CONV_ID,
      turn_index: state.turn_count,
      speaker: 'nex',
      text: out.response_frame.core_answer_head ?? out.response_frame.acknowledge ?? '(no core answer)',
      detected_intent: null,
      detected_entities: [],
      used_item_ids: out.retrieved_top_k.map(k => k.id),
      walked_edge_ids: [],
      latency_ms: dt,
    });

    // Attach explicit feedback signal if any
    if (s.explicit_feedback) {
      await store.writeFeedback({
        turn_id: customerTurn.id,
        signal: s.explicit_feedback,
        source: 'explicit',
        note: 'demo · Philip approved MVP',
      });
    }

    // Persist updated state
    await store.upsertState(state);
  }

  // End-of-conversation outcome
  await store.writeOutcome({
    conversation_id: CONV_ID,
    outcome: 'resolved',
    outcome_note: 'demo · scripted three-turn oak→walnut→installation chain',
    labelled_by: 'auto',
  });

  console.log('[demo-feedback] persisted turns, feedback, outcome, and state to JSONL.');

  // Reload from disk to prove persistence + idempotency
  const store2 = await new Store().init();
  const turns = [...store2.mem.turns.values()].filter(t => t.conversation_id === CONV_ID);
  const feedback = [...store2.mem.feedback.values()].filter(f => turnIds.includes(f.turn_id));
  const outcome = [...store2.mem.outcomes.values()].find(o => o.conversation_id === CONV_ID);
  const reloadedState = store2.getState(CONV_ID);

  const summary = {
    turns_reloaded: turns.length,
    feedback_signals_reloaded: feedback.length,
    outcome_reloaded: outcome?.outcome ?? null,
    state_reloaded_turn_count: reloadedState?.turn_count ?? null,
    state_reloaded_entities_in_focus: reloadedState?.entities_in_focus ?? null,
    state_reloaded_material: reloadedState?.established_facts?.material_primary?.value ?? null,
  };
  console.log(JSON.stringify(summary, null, 2));
}

await main();
