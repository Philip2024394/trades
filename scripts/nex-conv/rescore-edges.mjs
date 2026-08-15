// Nightly re-scoring · ADR-0044 §9.
//
// For every edge in nex.conv_edges, compute outcome_lift from the outcomes
// of conversations whose turns traversed that edge, then update:
//   new_weight = old_weight * 0.9 + 0.1 * outcome_lift
//
// outcome_lift = (positives - negatives) / total_traversals · clipped to [-1, +1]
//   positives  = 'resolved' | 'clarification_completed' outcomes
//   negatives  = 'user_abandoned' | 'repeated_question' | 'correction_received' | 'escalated'
//   neutral    = 'pending'
//
// Also considers per-turn feedback signals if any exist for turns that
// used the edge (nex.conv_feedback rows joined via turn_id).
//
// Usage:
//   node --env-file=.env.local scripts/nex-conv/rescore-edges.mjs
//   node --env-file=.env.local scripts/nex-conv/rescore-edges.mjs --dry-run

import pg from 'pg';

const POSITIVE_OUTCOMES = new Set(['resolved', 'clarification_completed']);
const NEGATIVE_OUTCOMES = new Set(['user_abandoned', 'repeated_question', 'correction_received', 'escalated']);
const POSITIVE_FEEDBACK = new Set(['helpful', 'followed_recommendation', 'clarified']);
const NEGATIVE_FEEDBACK = new Set(['not_helpful', 'wrong', 'irrelevant', 'corrected', 'gave_up', 'asked_same_again']);

const DECAY = 0.9;
const LIFT_WEIGHT = 0.1;

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`[rescore-edges] dry-run=${dryRun}`);
  const c = new pg.Client({ connectionString: process.env.NEX_POSTGRES_URL });
  await c.connect();

  const { rows: edges } = await c.query(
    `SELECT id, from_item, to_item, edge_type, weight, evidence_count FROM nex.conv_edges`
  );
  console.log(`[rescore-edges] loaded ${edges.length} edges`);

  // Pull outcomes joined to turns that used each item as either endpoint.
  // Simplistic first pass: an edge (A -> B) gets credited with every
  // conversation whose turn.used_item_ids contains BOTH A and B.
  const { rows: turnItemJoin } = await c.query(`
    SELECT t.id AS turn_id, t.conversation_id, t.used_item_ids
    FROM nex.conv_turns t
    WHERE array_length(t.used_item_ids, 1) > 0
  `);
  const { rows: outcomeRows } = await c.query(`SELECT conversation_id, outcome FROM nex.conv_outcomes`);
  const { rows: feedbackRows } = await c.query(`SELECT turn_id, signal FROM nex.conv_feedback`);

  const outcomeByConv = new Map(outcomeRows.map(r => [r.conversation_id, r.outcome]));
  const feedbackByTurn = new Map();
  for (const f of feedbackRows) {
    if (!feedbackByTurn.has(f.turn_id)) feedbackByTurn.set(f.turn_id, []);
    feedbackByTurn.get(f.turn_id).push(f.signal);
  }
  console.log(`[rescore-edges] outcome rows: ${outcomeRows.length} · feedback rows: ${feedbackRows.length} · turn rows w/ items: ${turnItemJoin.length}`);

  // Build a quick lookup: edge "from-to" → list of conversations that traversed it
  const traversalByEdge = new Map(); // key `${from}::${to}` → [{conversation_id, turn_id}]
  for (const t of turnItemJoin) {
    const ids = t.used_item_ids ?? [];
    // For each ordered pair inside the same turn's used_item_ids, count as a potential traversal
    for (let i = 0; i < ids.length; i++) {
      for (let j = 0; j < ids.length; j++) {
        if (i === j) continue;
        const key = `${ids[i]}::${ids[j]}`;
        if (!traversalByEdge.has(key)) traversalByEdge.set(key, []);
        traversalByEdge.get(key).push({ conversation_id: t.conversation_id, turn_id: t.turn_id });
      }
    }
  }

  // Now score each edge
  let updated = 0, unchanged = 0, noSignal = 0;
  const t0 = Date.now();
  const updates = [];
  for (const edge of edges) {
    const key = `${edge.from_item}::${edge.to_item}`;
    const traversals = traversalByEdge.get(key) ?? [];
    if (traversals.length === 0) {
      noSignal++;
      continue;
    }
    let pos = 0, neg = 0;
    for (const t of traversals) {
      const outcome = outcomeByConv.get(t.conversation_id);
      if (POSITIVE_OUTCOMES.has(outcome)) pos++;
      else if (NEGATIVE_OUTCOMES.has(outcome)) neg++;
      const feedback = feedbackByTurn.get(t.turn_id) ?? [];
      for (const sig of feedback) {
        if (POSITIVE_FEEDBACK.has(sig)) pos++;
        else if (NEGATIVE_FEEDBACK.has(sig)) neg++;
      }
    }
    const total = pos + neg;
    if (total === 0) { noSignal++; continue; }
    const outcomeLift = (pos - neg) / total; // -1 to +1
    const oldW = Number(edge.weight);
    const newW = Math.max(0, Math.min(1, oldW * DECAY + LIFT_WEIGHT * outcomeLift));
    if (Math.abs(newW - oldW) < 0.001) { unchanged++; continue; }
    updates.push({ id: edge.id, old: oldW, new: +newW.toFixed(4), lift: +outcomeLift.toFixed(3), traversals: traversals.length });
  }

  console.log(`[rescore-edges] ${updates.length} edges need weight update · ${unchanged} unchanged · ${noSignal} no signal`);

  if (updates.length && !dryRun) {
    // Batch update in one transaction · fewer round-trips
    await c.query('BEGIN');
    try {
      for (const u of updates) {
        await c.query(`UPDATE nex.conv_edges SET weight = $1 WHERE id = $2`, [u.new, u.id]);
      }
      await c.query('COMMIT');
      updated = updates.length;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Edges scanned:    ${edges.length}`);
  console.log(`Traversals found: ${[...traversalByEdge.values()].reduce((a, b) => a + b.length, 0)}`);
  console.log(`Updated:          ${updated} ${dryRun ? '(DRY-RUN · not written)' : ''}`);
  console.log(`Unchanged:        ${unchanged}`);
  console.log(`No signal:        ${noSignal}`);
  console.log(`Wall time:        ${Date.now() - t0}ms`);

  if (updates.length && dryRun) {
    console.log(`\nSample updates (first 5):`);
    for (const u of updates.slice(0, 5)) {
      console.log(`  ${u.id.slice(0, 8)}… weight ${u.old} → ${u.new} · lift ${u.lift} · from ${u.traversals} traversals`);
    }
  }

  await c.end();
}

await main();
