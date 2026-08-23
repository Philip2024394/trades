// NEX CLE · Step 3 · GENERATE CANDIDATE IMPROVEMENTS.
//
// For each flagged weakness, produce N candidate improvement payloads.
// Multiple candidates per weakness (Philip: "never a single 'right answer'").
//
// Candidate payloads are STRUCTURED · never free-text · never rewrite live
// state directly. Every candidate is a proposal to be scored + stored + then
// human-promoted.
//
// Strategies enabled per config.candidateStrategies:
//   · add_clarification_ki   — for unknown_intent weakness · propose new
//                              draft conv_knowledge_item that would catch
//                              the pattern next time
//   · add_intent_example     — for empty_retrieval weakness · propose a new
//                              example_phrases entry on an existing intent
//
// Doctrine: candidate payloads NEVER contain PII (customer names · phone
// numbers · specific business refs) · scoring gate rejects any that do.

const CANDIDATES_PER_WEAKNESS = 2;

// ── Strategy: add_clarification_ki ──────────────────────────────────────
// Given a batch of unknown-intent turns, propose 1-2 draft KIs whose
// question_text would match the pattern. Uses a simple heuristic: cluster
// texts by shared bigrams, pick top-2 clusters, propose one KI each.

function stripPii(text) {
  return String(text ?? "")
    .replace(/\+?\d[\d\s\-()]{6,}/g, "[phone]")
    .replace(/[\w.-]+@[\w.-]+\.\w+/gi, "[email]")
    .replace(/#FL-\d{4}-[A-Z0-9]{5}/gi, "[business-ref]")
    .trim();
}

function normaliseText(s) {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function extractBigrams(s) {
  const words = normaliseText(s).split(" ").filter(w => w.length >= 3);
  const bigrams = [];
  for (let i = 0; i < words.length - 1; i++) bigrams.push(words[i] + " " + words[i+1]);
  return bigrams;
}

function clusterByBigrams(turns) {
  const clusters = new Map();
  for (const t of turns) {
    const bigrams = new Set(extractBigrams(t.text));
    let best = { key: null, score: 0 };
    for (const [key, cluster] of clusters.entries()) {
      const inter = [...bigrams].filter(b => cluster.bigrams.has(b)).length;
      if (inter > best.score) best = { key, score: inter };
    }
    if (best.score >= 2) {
      clusters.get(best.key).turns.push(t);
    } else {
      const key = t.turn_id;
      clusters.set(key, { turns: [t], bigrams });
    }
  }
  return [...clusters.values()].sort((a, b) => b.turns.length - a.turns.length);
}

function candidatesForUnknownIntent(weakness) {
  const clusters = clusterByBigrams(weakness.sample_turns);
  const proposals = [];
  for (const cluster of clusters.slice(0, CANDIDATES_PER_WEAKNESS)) {
    if (cluster.turns.length < 1) continue;
    const rep = cluster.turns[0];
    const questionText = stripPii(rep.text);
    proposals.push({
      strategy: "add_clarification_ki",
      target: "conv_knowledge_items",
      operation: "insert",
      payload: {
        kind: "clarification",
        question_text: questionText,
        answer_text: null,   // draft only · needs owner/admin to author the answer
        canonical_intent: "clarify",
        entities: [],
        topics: [],
        confidence: 0.55,    // draft-tier (ADR-0033: < 0.70 forces draft_only=true)
        draft_only: true,
        source_batch: "cle_auto_" + new Date().toISOString().split("T")[0],
        source_ref: "cle_weakness_" + weakness.detector,
      },
      addresses_weakness: weakness.detector,
      evidence_turn_ids: cluster.turns.map(t => t.turn_id),
      cluster_size: cluster.turns.length,
      rationale: `Cluster of ${cluster.turns.length} similar unknown-intent turns · draft clarification KI would give the extractor a canonical pattern to match against next time`,
    });
  }
  return proposals;
}

// ── Strategy: add_intent_example ────────────────────────────────────────
// Given a batch of empty-retrieval turns (had intent but nothing retrieved),
// propose new example_phrases entries to strengthen the intent's example set.

async function candidatesForEmptyRetrieval(weakness, pool) {
  const proposals = [];
  const byIntent = new Map();
  for (const t of weakness.sample_turns) {
    if (!t.intent) continue;
    if (!byIntent.has(t.intent)) byIntent.set(t.intent, []);
    byIntent.get(t.intent).push(t);
  }
  const intentBatches = [...byIntent.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, CANDIDATES_PER_WEAKNESS);
  for (const [intent, turns] of intentBatches) {
    const intentRow = await pool.query(
      `SELECT slug, display_name, class, example_phrases
       FROM nex.conv_intents WHERE slug = $1`,
      [intent]
    );
    if (intentRow.rowCount === 0) continue;
    const existing = new Set((intentRow.rows[0].example_phrases ?? []).map(s => normaliseText(s)));
    const newExamples = turns
      .map(t => stripPii(t.text))
      .filter(t => t.length >= 5 && t.length <= 200)
      .filter(t => !existing.has(normaliseText(t)))
      .slice(0, 3);
    if (newExamples.length === 0) continue;
    proposals.push({
      strategy: "add_intent_example",
      target: "conv_intents",
      operation: "update",
      payload: {
        slug: intent,
        add_example_phrases: newExamples,
      },
      addresses_weakness: weakness.detector,
      evidence_turn_ids: turns.map(t => t.turn_id),
      existing_example_count: (intentRow.rows[0].example_phrases ?? []).length,
      proposed_new_count: newExamples.length,
      rationale: `Intent "${intent}" fired but retrieval returned nothing · adding these examples strengthens the intent's coverage without changing intent class`,
    });
  }
  return proposals;
}

// ── Generator entry point ────────────────────────────────────────────────

export async function generateCandidates(pool, weaknesses, config) {
  const enabled = new Set(config.candidateStrategies);
  const candidates = [];
  for (const w of weaknesses) {
    if (w.detector === "unknown_intent" && enabled.has("add_clarification_ki")) {
      candidates.push(...candidatesForUnknownIntent(w));
    }
    if (w.detector === "empty_retrieval" && enabled.has("add_intent_example")) {
      const list = await candidatesForEmptyRetrieval(w, pool);
      candidates.push(...list);
    }
    // Other weaknesses have no candidate generator in v1 · they're flagged for
    // admin awareness only. Adding new strategies = extend this file · never
    // fork per weakness kind.
  }
  return candidates;
}
