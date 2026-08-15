// ADR-0044 MVP · conversation state manager.
// State shape per ADR-0044 proposal §5. Every turn NEX reads state before
// deciding, and updates state after replying. Full transcripts live in
// nex.conv_turns; state carries only summaries.

import { newId, nowIso } from './schema.mjs';

// Every turn, updateStateFromCustomer records what actually changed in
// state.last_turn_state_delta so the response packet can tell the LLM
// exactly what to acknowledge (or not) — Fix 3 for "don't narrate a
// state change that didn't happen".
export function newState({ conversation_id, brain, business_id = null }) {
  return {
    schema_version: '1.0',
    conversation_id: conversation_id ?? newId(),
    business_id,
    brain,
    started_at: nowIso(),
    last_turn_at: nowIso(),
    turn_count: 0,

    topic_stack: [],
    current_topic: null,
    current_intent: null,

    established_facts: {},
    requirements: [],
    constraints: [],
    decisions_made: [],

    entities_in_focus: [],
    entities_in_focus_item_ids: [],
    unresolved_ambiguities: [],
    pending_questions_from_nex: [],
    unresolved_from_customer: [],

    overall_confidence: 0.5,
    stage: 'discover',

    recently_used_item_ids: [],
    recent_turn_summaries: [],

    corrections_log: [], // audit — every replaced fact preserved
    last_turn_state_delta: null, // fresh each turn: what actually changed OR noop reason

    // B2 · rolling emotion window · last N turns' registers
    emotion_window: [],       // [{turn, register, cues}]
    current_emotion: 'neutral',

    // B4 · handoff tracking · counts thin-packet strikes so we know when to
    // offer "shall I have someone call you tomorrow?" instead of another
    // hedge. Reset when a substantive turn resolves.
    thin_packet_strikes: 0,
    handoff_recommended: false,

    // B5 · condensed history · created after N turns so packet stays bounded
    condensed_history: null,  // { up_to_turn, summary }
  };
}

/**
 * Update state after processing a user turn.
 * @param {object} state
 * @param {object} args
 *   args.text, args.speaker, args.intent {slug,class,confidence}, args.entities,
 *   args.topics, args.usedItemIds
 */
export function updateStateFromCustomer(state, args) {
  const { text, intent, entities, topics, usedItemIds = [], emotion = null, packetIsThin = false, secondaryIntents = [] } = args;

  // Defensive init: old state rows persisted before newer fields were added
  // won't have these initialised. Reading `undefined.push()` crashes the
  // whole turn. Backfill anything missing before touching it.
  ensureStateShape(state);

  state.turn_count += 1;
  state.last_turn_at = nowIso();
  state.current_intent = intent;
  state.current_secondary_intents = secondaryIntents;
  // Fresh delta for this turn — populated by any handler that changes a fact.
  const delta = { changes: [], noops: [] };
  state.last_turn_state_delta = delta;

  // B2 · record emotion in rolling window (last 5 turns)
  if (emotion) {
    state.emotion_window.push({ turn: state.turn_count, register: emotion.register, cues: emotion.cues });
    if (state.emotion_window.length > 5) state.emotion_window = state.emotion_window.slice(-5);
    state.current_emotion = emotion.register;
  }

  // B4 · handoff strike tracking · we don't have specific-price facts in
  // state, so every price/installation ask is effectively a "we can't give
  // you a firm answer" moment. Strike on those intents unconditionally; the
  // ≥2 threshold means we recommend handoff on the SECOND consecutive ask.
  // Strike is cleared as soon as the customer moves on to a substantive
  // non-price intent (so a mid-conversation price ask doesn't stick forever).
  const isHandoffProneIntent = intent?.slug === 'ask_price' || intent?.slug === 'ask_installation' || intent?.class === 'decide';
  const isSubstantiveNonHandoff = ['specify_material', 'specify_style', 'specify_constraint', 'compare', 'ask_options', 'ask_definition'].includes(intent?.slug);
  if (isHandoffProneIntent) {
    state.thin_packet_strikes = (state.thin_packet_strikes || 0) + 1;
  } else if (isSubstantiveNonHandoff) {
    state.thin_packet_strikes = 0;
  }
  state.handoff_recommended = (state.thin_packet_strikes || 0) >= 2;

  // Topic tracking
  if (topics.length) {
    const primary = topics[0];
    if (primary && primary !== state.current_topic) {
      if (state.current_topic) state.topic_stack.unshift(state.current_topic);
      state.current_topic = primary;
    }
  }

  // M4-BUG-01 · deny_attribution — customer is explicitly rejecting a fact
  // they were falsely attributed. Clear any fact whose value matches the
  // denied entity so we stop repeating the false claim. Log the denial so
  // response layer can acknowledge honestly ("apologies — I misread you").
  if (intent.slug === 'deny_attribution') {
    const deniedEnts = new Set(entities);
    const clearedFields = [];
    for (const [field, fact] of Object.entries(state.established_facts)) {
      if (fact && deniedEnts.has(fact.value)) {
        state.corrections_log.push({
          field,
          previous: fact.value,
          new: null,
          turn: state.turn_count,
          via: 'deny_attribution',
          at: nowIso(),
        });
        delete state.established_facts[field];
        if (field === 'construction_context') {
          state.constraints = state.constraints.filter(c => c !== fact.value);
        }
        clearedFields.push({ field, cleared: fact.value });
      }
    }
    if (clearedFields.length) {
      delta.changes.push({ field: 'denial_clear', cleared: clearedFields });
    } else {
      // No matching fact — customer denied something we hadn't even set.
      // Response layer needs to know: apologise for the implication, don't ask
      // for what they denied.
      delta.noops.push({ field: 'denial_clear', reason: 'nothing to clear · was never in state' });
    }
  }

  // Correction flow — REPLACE facts, preserve old value in corrections_log.
  // Also records what actually changed vs was a no-op so the response layer
  // knows whether to acknowledge a change (Fix 3).
  if (intent.slug === 'correct') {
    const newMaterials = entities.filter(e => isMaterial(e));
    for (const mat of newMaterials) {
      const priorFact = state.established_facts.material_primary;
      if (priorFact && priorFact.value !== mat) {
        state.corrections_log.push({
          field: 'material_primary',
          previous: priorFact.value,
          new: mat,
          turn: state.turn_count,
          at: nowIso(),
        });
        delta.changes.push({ field: 'material_primary', previous: priorFact.value, new: mat });
      } else if (priorFact && priorFact.value === mat) {
        delta.noops.push({ field: 'material_primary', value: mat, reason: 'already set to this value' });
      }
      state.established_facts.material_primary = {
        value: mat,
        turn_established: state.turn_count,
        confidence: intent.confidence,
        via: 'correction',
        provenance: 'customer_stated', // M4-BUG-01
      };
    }
  }

  // M4-BUG-01 · fact provenance labels
  // customer_stated = customer explicitly specified in this turn (intent.slug === specify_*)
  // inferred        = present as a secondary entity in a discover-class turn (weaker signal)
  // The response layer uses these to decide whether to phrase a fact as
  // "you said X" (only if customer_stated) vs "if I've understood correctly"
  // (if inferred). Anything else is a rule violation.
  const provenanceForIntent = (intentSlug, expectedSpecify) =>
    intentSlug === expectedSpecify ? 'customer_stated' : 'inferred';

  // M4-BUG-02 · intents where entities in the QUESTION should NOT become
  // customer facts. When the customer says "wood materials" they are ASKING
  // about wood, not specifying it. When they say "compare oak vs walnut"
  // they haven't picked either. When they ask "what is a closed string" the
  // word "string" mustn't become their construction context.
  const PURE_QUESTION_INTENTS = new Set([
    'ask_options', 'ask_definition', 'ask_recommendation', 'ask_installation',
    'ask_price', 'compare', 'ask_what_about',
    'meta_greeting', 'meta_presence', 'meta_identity', 'meta_smalltalk',
    'backchannel', 'close', 'confirm', 'confirm_summary', 'clarify_customer',
    'deny_attribution',
  ]);
  const isPureQuestion = PURE_QUESTION_INTENTS.has(intent.slug);

  // Specify material → establish or update fact.
  // Secondary capture: also fires when a material entity is present in any
  // specify/discover intent (so "I like oak" without a strong specify cue
  // still captures oak as the material fact). Mirrors the style rule below.
  //
  // M4-BUG-02 GUARD: PURE_QUESTION_INTENTS never write facts. And even for
  // non-question intents, generic material words ("timber", "wood") never
  // become customer facts — only specific choices (oak, walnut, ...).
  const materialEnts = entities.filter(e => isMaterial(e) && !['timber', 'wood', 'material', 'carpet'].includes(e));
  if (!isPureQuestion && intent.slug !== 'correct' && materialEnts.length && (intent.slug === 'specify_material' || intent.class === 'specify' || intent.class === 'discover')) {
    for (const mat of materialEnts) {
      state.established_facts.material_primary = state.established_facts.material_primary ?? {
        value: mat,
        turn_established: state.turn_count,
        confidence: intent.confidence * (intent.slug === 'specify_material' ? 1 : 0.9),
        provenance: provenanceForIntent(intent.slug, 'specify_material'), // M4-BUG-01
      };
    }
  }
  // Style — set if either the intent is specify_style OR a style entity is
  // present in any specify/discover intent (secondary intent capture).
  const styleEnts = entities.filter(e => isStyle(e));
  if (!isPureQuestion && styleEnts.length && (intent.slug === 'specify_style' || intent.class === 'specify' || intent.class === 'discover')) {
    for (const style of styleEnts) {
      state.established_facts.style_intent = state.established_facts.style_intent ?? {
        value: style,
        turn_established: state.turn_count,
        confidence: intent.confidence * 0.9,
        provenance: provenanceForIntent(intent.slug, 'specify_style'), // M4-BUG-01
      };
    }
  }
  // Constraint — same pattern as material/style secondary capture.
  const constraintEnts = entities.filter(e => isLocation(e));
  if (!isPureQuestion && constraintEnts.length && (intent.slug === 'specify_constraint' || intent.class === 'specify' || intent.class === 'discover')) {
    for (const c of constraintEnts) {
      state.established_facts.construction_context = state.established_facts.construction_context ?? {
        value: c,
        turn_established: state.turn_count,
        confidence: intent.confidence * (intent.slug === 'specify_constraint' ? 1 : 0.9),
        provenance: provenanceForIntent(intent.slug, 'specify_constraint'), // M4-BUG-01
      };
      if (!state.constraints.includes(c)) state.constraints.push(c);
    }
  }

  // Elliptical "what about X" — merge NEW entities into focus (do NOT drop old)
  if (intent.slug === 'ask_what_about') {
    const newE = entities.filter(e => !state.entities_in_focus.includes(e));
    state.entities_in_focus = [...state.entities_in_focus, ...newE];
  } else {
    // Regular turn: refresh focus with union of prior + new
    const union = new Set([...state.entities_in_focus, ...entities]);
    state.entities_in_focus = [...union];
  }

  // Recent turn summary (compact)
  state.recent_turn_summaries.push({
    turn_index: state.turn_count,
    speaker: 'customer',
    text_head: text.slice(0, 140),
    intent: intent.slug,
    entities,
  });
  if (state.recent_turn_summaries.length > 6) state.recent_turn_summaries = state.recent_turn_summaries.slice(-6);

  // Recently used items (from retrieval on this turn)
  if (usedItemIds.length) {
    const merged = [...usedItemIds, ...state.recently_used_item_ids];
    state.recently_used_item_ids = [...new Set(merged)].slice(0, 20);
    // entities_in_focus_item_ids stays scoped to items with strong entity overlap
    state.entities_in_focus_item_ids = state.recently_used_item_ids.slice(0, 8);
  }

  // Confidence rollup
  const factCount = Object.keys(state.established_facts).length;
  state.overall_confidence = Math.min(0.95, 0.4 + 0.1 * factCount + 0.05 * state.entities_in_focus.length);

  // Stage transitions
  if (state.stage === 'discover' && factCount >= 2) state.stage = 'specification';
  if (state.stage === 'specification' && intent.slug === 'compare') state.stage = 'compare';
  if (intent.slug === 'confirm') state.stage = 'decide';
  if (intent.slug === 'close') state.stage = 'close';

  return state;
}

export function updateStateFromNex(state, { text, entities = [], usedItemIds = [] }) {
  ensureStateShape(state);
  state.turn_count += 1;
  state.last_turn_at = nowIso();
  state.recent_turn_summaries.push({
    turn_index: state.turn_count,
    speaker: 'nex',
    text_head: text.slice(0, 140),
    entities,
  });
  // B5 · condense once turn_count crosses 8 · re-condense every subsequent
  // 4 turns to keep the summary fresh. The prior "recent_turn_summaries.length
  // > 8" trigger never fired because summaries are truncated to 6 first.
  if (state.turn_count > 8 && (!state.condensed_history || (state.turn_count - (state.condensed_history.up_to_turn ?? 0)) >= 4)) {
    const facts = Object.entries(state.established_facts ?? {})
      .filter(([, v]) => v?.value != null)
      .map(([k, v]) => `${k}=${v.value}`).join(' · ');
    const priorEnts = [...new Set(state.recent_turn_summaries.flatMap(s => s.entities ?? []))].slice(0, 8).join(', ');
    state.condensed_history = {
      up_to_turn: state.turn_count,
      summary: `Earlier in this conversation (through turn ${state.turn_count}): established facts — ${facts || 'no fixed facts yet'}. Recent entities discussed: ${priorEnts || '(none)'}.`,
    };
  }
  if (state.recent_turn_summaries.length > 6) state.recent_turn_summaries = state.recent_turn_summaries.slice(-6);

  // Track NEX's last two closer patterns so the packet can tell the model
  // NOT to repeat itself. A1 + A6 fix — kills the "would you like to
  // explore X, Y, Z?" tell that appeared 15/25 times in the 25-turn test.
  const lastSentence = extractClosingSentence(text);
  const closerPattern = classifyCloser(lastSentence);
  if (!state.recent_closer_patterns) state.recent_closer_patterns = [];
  state.recent_closer_patterns.push({ pattern: closerPattern, sentence: lastSentence });
  if (state.recent_closer_patterns.length > 3) state.recent_closer_patterns = state.recent_closer_patterns.slice(-3);

  // M1-3: also track the OPENING pattern of each NEX reply so we can
  // ban a repeated opener next turn ("Given the ...", "For a ...",
  // "Sure, ...", "Understood — ..." all become tells if used back-to-back).
  const opener = extractOpener(text);
  const openerPattern = classifyOpener(opener);
  if (!state.recent_opener_patterns) state.recent_opener_patterns = [];
  state.recent_opener_patterns.push({ pattern: openerPattern, opener });
  if (state.recent_opener_patterns.length > 3) state.recent_opener_patterns = state.recent_opener_patterns.slice(-3);
  return state;
}

function extractOpener(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';
  // First 40 chars, up to first punctuation
  const uptoPunct = trimmed.split(/[,.!?—:]/)[0] ?? trimmed;
  return uptoPunct.slice(0, 60).trim();
}

function classifyOpener(opener) {
  const s = (opener || '').toLowerCase();
  if (!s) return 'none';
  if (/^given (the|your|that)/.test(s)) return 'given_x';
  if (/^for (the|your|a|an) /.test(s)) return 'for_x';
  if (/^(sure|absolutely|of course|no problem)\b/.test(s)) return 'sure_x';
  if (/^understood\b/.test(s)) return 'understood';
  if (/^got it\b/.test(s)) return 'got_it';
  if (/^(hi|hello|hey)\b/.test(s)) return 'greeting';
  if (/^take your time/.test(s)) return 'take_time';
  if (/^you'?re welcome/.test(s)) return 'youre_welcome';
  if (/^i\b/.test(s)) return 'i_start';
  if (/^would you\b/.test(s)) return 'would_you';
  if (/^that (sounds|works|makes sense)/.test(s)) return 'that_x';
  return 'other';
}

/**
 * Backfill any field that a newer pipeline version expects but that older
 * persisted state rows might not have. Idempotent · safe to call on every
 * turn · costs nothing when the state is already up-to-date.
 */
function ensureStateShape(state) {
  if (!state) return;
  if (!Array.isArray(state.topic_stack)) state.topic_stack = [];
  if (state.established_facts == null) state.established_facts = {};
  if (!Array.isArray(state.requirements)) state.requirements = [];
  if (!Array.isArray(state.constraints)) state.constraints = [];
  if (!Array.isArray(state.decisions_made)) state.decisions_made = [];
  if (!Array.isArray(state.entities_in_focus)) state.entities_in_focus = [];
  if (!Array.isArray(state.entities_in_focus_item_ids)) state.entities_in_focus_item_ids = [];
  if (!Array.isArray(state.unresolved_ambiguities)) state.unresolved_ambiguities = [];
  if (!Array.isArray(state.pending_questions_from_nex)) state.pending_questions_from_nex = [];
  if (!Array.isArray(state.unresolved_from_customer)) state.unresolved_from_customer = [];
  if (!Array.isArray(state.recently_used_item_ids)) state.recently_used_item_ids = [];
  if (!Array.isArray(state.recent_turn_summaries)) state.recent_turn_summaries = [];
  if (!Array.isArray(state.corrections_log)) state.corrections_log = [];
  if (!Array.isArray(state.recent_closer_patterns)) state.recent_closer_patterns = []; // Phase A
  if (!Array.isArray(state.emotion_window)) state.emotion_window = [];                   // Phase B
  if (typeof state.current_emotion !== 'string') state.current_emotion = 'neutral';       // Phase B
  if (typeof state.thin_packet_strikes !== 'number') state.thin_packet_strikes = 0;       // Phase B
  if (typeof state.handoff_recommended !== 'boolean') state.handoff_recommended = false;  // Phase B
  if (state.condensed_history === undefined) state.condensed_history = null;              // Phase B
  if (state.last_turn_state_delta === undefined) state.last_turn_state_delta = null;
  if (state.current_secondary_intents === undefined) state.current_secondary_intents = [];
  if (typeof state.turn_count !== 'number') state.turn_count = 0;
  if (typeof state.overall_confidence !== 'number') state.overall_confidence = 0.5;
  if (typeof state.stage !== 'string') state.stage = 'discover';
}

function extractClosingSentence(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/(?<=[.!?])\s+/).filter(Boolean);
  return (parts[parts.length - 1] || trimmed).slice(0, 140);
}

// Classify a closing sentence into a pattern bucket so we can avoid repeating.
function classifyCloser(sentence) {
  const s = (sentence || '').toLowerCase();
  if (!s) return 'none';
  if (/would you like to (explore|discuss|consider|know)/.test(s)) return 'would_you_like_to_explore';
  if (/(price|installation|comparison|options?)/.test(s) && /\?$/.test(s)) return 'menu_price_install_compare';
  if (/which .* (prefer|suit|works|appeals)/.test(s)) return 'which_prefer';
  if (/what do you think/.test(s)) return 'what_do_you_think';
  if (/anything else/.test(s)) return 'anything_else';
  if (/^\s*(great|good|makes sense|understood|got it|no problem|sounds good)[,.!]?\s*$/.test(s)) return 'reflect_only';
  if (/\?$/.test(s)) return 'other_question';
  return 'statement_close';
}

function isMaterial(slug) {
  return ['oak','walnut','ash','pine','beech','maple','sapele','iroko','glass','metal','concrete','carpet','timber'].includes(slug);
}
function isStyle(slug) {
  return ['traditional','contemporary','transitional','floating_stair','spiral','quarter_turn','half_turn','straight_flight'].includes(slug);
}
function isLocation(slug) {
  return ['against_wall','both_sides_open','interior','garden'].includes(slug);
}
