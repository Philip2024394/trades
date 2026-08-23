// NEX CLE · Step 2 · IDENTIFY WEAK CONVERSATIONS.
//
// Reads conv_turns / conv_outcomes / conv_feedback for the last N days and
// emits weakness signals. Flag-only · never auto-fix. Every detector is a
// pure SQL read · no writes to Brain state.
//
// Detectors that WORK on turn data alone (usable today):
//   1. unknown_intent           — turn.detected_intent IS NULL
//   2. empty_retrieval          — turn.used_item_ids is empty (retrieval failed)
//   3. high_latency             — turn.latency_ms > config threshold
//   4. repeated_text_in_session — same customer text within 5min same convo
//
// Detectors that need feedback capture (currently ZERO rows · will fire once wired):
//   5. negative_outcome_cluster — reads conv_outcomes
//   6. explicit_negative_feedback — reads conv_feedback (thumbs down · gave up)
//
// Doctrine: Observation ≠ auto-teach. This module ONLY reads. Never modifies.

export const WEAKNESS_KINDS = [
  "unknown_intent",
  "empty_retrieval",
  "high_latency",
  "repeated_text_in_session",
  "negative_outcome_cluster",     // FEEDBACK-DEPENDENT
  "explicit_negative_feedback",   // FEEDBACK-DEPENDENT
];

export async function detectWeaknesses(pool, config) {
  const brain = config.brain;
  const daysBack = config.detectors.daysBack;
  const minEvidence = config.detectors.minSignalEvidence;
  const highLatencyMs = config.detectors.highLatencyMs;

  const signals = [];
  const stats = { by_detector: {}, feedback_dependent_zero: [] };

  // ── 1. Unknown intent ────────────────────────────────────────────────────
  {
    const r = await pool.query(`
      SELECT t.id AS turn_id, t.conversation_id, t.text, t.turn_index, t.created_at, t.latency_ms
      FROM nex.conv_turns t
      WHERE t.speaker = 'customer'
        AND t.detected_intent IS NULL
        AND t.created_at > now() - ($1 || ' days')::interval
      ORDER BY t.created_at DESC
      LIMIT 200
    `, [String(daysBack)]);
    if (r.rowCount >= minEvidence) {
      signals.push({
        detector: "unknown_intent",
        severity: r.rowCount >= 10 ? "high" : "medium",
        evidence_turn_count: r.rowCount,
        sample_turns: r.rows.slice(0, 5).map(row => ({
          turn_id: row.turn_id,
          text: row.text,
          created_at: row.created_at,
        })),
        summary: `${r.rowCount} customer turns had no detected intent · extraction pipeline missed them`,
      });
    }
    stats.by_detector["unknown_intent"] = r.rowCount;
  }

  // ── 2. Empty retrieval ───────────────────────────────────────────────────
  {
    const r = await pool.query(`
      SELECT t.id AS turn_id, t.conversation_id, t.text, t.detected_intent, t.detected_entities
      FROM nex.conv_turns t
      WHERE t.speaker = 'customer'
        AND (t.used_item_ids IS NULL OR array_length(t.used_item_ids, 1) IS NULL)
        AND t.detected_intent IS NOT NULL
        AND t.created_at > now() - ($1 || ' days')::interval
      ORDER BY t.created_at DESC
      LIMIT 200
    `, [String(daysBack)]);
    if (r.rowCount >= minEvidence) {
      signals.push({
        detector: "empty_retrieval",
        severity: r.rowCount >= 10 ? "high" : "medium",
        evidence_turn_count: r.rowCount,
        sample_turns: r.rows.slice(0, 5).map(row => ({
          turn_id: row.turn_id,
          text: row.text,
          intent: row.detected_intent,
          entities: row.detected_entities,
        })),
        summary: `${r.rowCount} turns had a detected intent but retrieval returned nothing · knowledge gap for that intent+entity combo`,
      });
    }
    stats.by_detector["empty_retrieval"] = r.rowCount;
  }

  // ── 3. High latency ─────────────────────────────────────────────────────
  {
    const r = await pool.query(`
      SELECT t.id AS turn_id, t.conversation_id, t.text, t.latency_ms, t.detected_intent
      FROM nex.conv_turns t
      WHERE t.speaker = 'nex'
        AND t.latency_ms IS NOT NULL
        AND t.latency_ms > $2
        AND t.created_at > now() - ($1 || ' days')::interval
      ORDER BY t.latency_ms DESC
      LIMIT 200
    `, [String(daysBack), highLatencyMs]);
    if (r.rowCount >= minEvidence) {
      signals.push({
        detector: "high_latency",
        severity: r.rowCount >= 10 ? "high" : "medium",
        evidence_turn_count: r.rowCount,
        sample_turns: r.rows.slice(0, 5).map(row => ({
          turn_id: row.turn_id,
          latency_ms: row.latency_ms,
          intent: row.detected_intent,
        })),
        summary: `${r.rowCount} nex-response turns exceeded ${highLatencyMs}ms · performance weakness (infra, not knowledge)`,
      });
    }
    stats.by_detector["high_latency"] = r.rowCount;
  }

  // ── 4. Repeated text in session ─────────────────────────────────────────
  {
    const r = await pool.query(`
      SELECT a.conversation_id, a.text, count(*)::int AS repeats,
             min(a.created_at) AS first_at, max(a.created_at) AS last_at
      FROM nex.conv_turns a
      WHERE a.speaker = 'customer'
        AND a.created_at > now() - ($1 || ' days')::interval
      GROUP BY a.conversation_id, a.text
      HAVING count(*) >= 2
      ORDER BY count(*) DESC, min(a.created_at) DESC
      LIMIT 100
    `, [String(daysBack)]);
    // Filter to within-window (5min default)
    const windowSec = config.detectors.repeatedTextWindowSec;
    const withinWindow = r.rows.filter(row =>
      (new Date(row.last_at).getTime() - new Date(row.first_at).getTime()) / 1000 <= windowSec
    );
    if (withinWindow.length >= minEvidence) {
      signals.push({
        detector: "repeated_text_in_session",
        severity: withinWindow.length >= 5 ? "high" : "medium",
        evidence_turn_count: withinWindow.reduce((s, r) => s + r.repeats, 0),
        sample_turns: withinWindow.slice(0, 5).map(row => ({
          conversation_id: row.conversation_id,
          text: row.text,
          repeats: row.repeats,
          gap_sec: Math.round((new Date(row.last_at).getTime() - new Date(row.first_at).getTime()) / 1000),
        })),
        summary: `${withinWindow.length} distinct customer texts were repeated within same session · NEX response did not resolve · knowledge/flow gap`,
      });
    }
    stats.by_detector["repeated_text_in_session"] = withinWindow.length;
  }

  // ── 5. Negative outcome cluster (FEEDBACK-DEPENDENT · likely zero today) ─
  {
    const r = await pool.query(`
      SELECT o.outcome, count(*)::int AS n
      FROM nex.conv_outcomes o
      WHERE o.labelled_at > now() - ($1 || ' days')::interval
        AND o.outcome IN ('user_abandoned','repeated_question','correction_received','escalated')
      GROUP BY o.outcome
    `, [String(daysBack)]);
    if (r.rowCount === 0) {
      stats.feedback_dependent_zero.push("negative_outcome_cluster");
    } else {
      const total = r.rows.reduce((s, row) => s + row.n, 0);
      if (total >= minEvidence) {
        signals.push({
          detector: "negative_outcome_cluster",
          severity: total >= 10 ? "high" : "medium",
          evidence_turn_count: total,
          by_outcome: Object.fromEntries(r.rows.map(row => [row.outcome, row.n])),
          summary: `${total} conversations ended in negative outcomes over last ${daysBack}d`,
        });
      }
    }
    stats.by_detector["negative_outcome_cluster"] = r.rowCount === 0 ? 0 : r.rows.reduce((s, r) => s + r.n, 0);
  }

  // ── 6. Explicit negative feedback (FEEDBACK-DEPENDENT · likely zero today)
  {
    const r = await pool.query(`
      SELECT signal, count(*)::int AS n
      FROM nex.conv_feedback
      WHERE created_at > now() - ($1 || ' days')::interval
        AND signal IN ('not_helpful','wrong','irrelevant','corrected','gave_up','asked_same_again')
      GROUP BY signal
    `, [String(daysBack)]);
    if (r.rowCount === 0) {
      stats.feedback_dependent_zero.push("explicit_negative_feedback");
    } else {
      const total = r.rows.reduce((s, row) => s + row.n, 0);
      if (total >= minEvidence) {
        signals.push({
          detector: "explicit_negative_feedback",
          severity: total >= 10 ? "high" : "medium",
          evidence_turn_count: total,
          by_signal: Object.fromEntries(r.rows.map(row => [row.signal, row.n])),
          summary: `${total} explicit negative feedback signals over last ${daysBack}d`,
        });
      }
    }
    stats.by_detector["explicit_negative_feedback"] = r.rowCount === 0 ? 0 : r.rows.reduce((s, r) => s + r.n, 0);
  }

  return { signals, stats };
}
