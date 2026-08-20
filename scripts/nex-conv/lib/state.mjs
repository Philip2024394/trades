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

    // P2-Y1 (2026-08-20 natural-conversation batch): NEX's most recent
    // question so the response layer can resolve customer's "yes" / "no"
    // against it. Structure: { text, shape } where shape is 'binary'
    // ("do you want X?"), 'ab' ("straight or quarter-turn?"), or 'open'
    // ("what sort of look?"). Null on turn 1 / after non-question replies.
    last_nex_question: null,

    // P2-D1: counter of consecutive empty-state discovery responses NEX
    // has issued. Increments each turn NEX asks a generic discovery
    // question with zero facts captured. Resets to 0 when a fact lands.
    // Response layer uses this to break out of the loop after 2 rounds.
    empty_state_discovery_streak: 0,

    // Priority 3 (2026-08-20 · Indonesian language-neutral layer).
    // Language of the CURRENT customer turn. Re-detected per turn (no
    // session lock) — customer can switch languages mid-conversation and
    // NEX follows. Doctrine (Philip 2026-08-20): "conversation_language
    // is an additional state field, not a second conversation state."
    // State facts + reasoning stay language-neutral; only the response
    // language changes. Default 'en' so existing English behaviour is
    // never regressed by a mis-detection.
    conversation_language: 'en',
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
  //
  // Session 4b bug fix (2026-08-20) + P2-C2 multi-material fix (2026-08-20):
  //   Prior version picked material_primary from entities[0] which caused
  //   "walnut with glass balustrade" → material_primary=glass (entity-order
  //   lottery) because glass and walnut were both candidates. Fix:
  //   DISAMBIGUATE materials by CONTEXT. If a material appears alongside a
  //   balustrade/handrail/newel context slug, it belongs to that component,
  //   NOT to material_primary. The remaining materials are candidates for
  //   material_primary. This makes multi-component corrections deterministic
  //   regardless of entity extraction order.
  //   Also: component writers (balustrade / handrail_material / newel_material)
  //   now DO fire during correct intent — previously they skipped, so
  //   "walnut with glass balustrade" set primary=walnut but never wrote
  //   balustrade=glass. See writeComponentMaterial defaults below.
  if (intent.slug === 'correct') {
    const priorFact = state.established_facts.material_primary;
    const priorValue = priorFact?.value ?? null;
    const mentionedMaterials = entities.filter(e => isMaterial(e));

    // P2-C2: strip materials that are context-bound to a specific component.
    // "walnut with glass balustrade" · balustrade context is present ·
    // one material (glass) belongs to that context · exclude it from primary
    // candidates so walnut wins deterministically.
    //
    // TEXT-based detection (not entity-based). Pre-existing entity-alias
    // collisions ("glass balustrade" is an alias of `glass` slug, so the
    // `balustrade` slug never extracts from "walnut with glass balustrade")
    // would defeat entity-based context detection. Reading the raw message
    // text is more robust and doesn't depend on ontology quirks.
    // Picks the CLOSEST material to the context keyword (not just first in
    // a wider window) so "walnut with a metal handrail" correctly binds
    // metal to handrail (not walnut, which is closer to "want" than to
    // "handrail").
    const contextBound = detectContextBoundMaterials(text, mentionedMaterials);
    const primaryCandidates = mentionedMaterials.filter(m => !contextBound.has(m));

    const newCandidates = primaryCandidates.filter(m => m !== priorValue);
    // Deterministic pick: prefer a primary candidate distinct from prior.
    // If none, fall back to first primary candidate (may be same as prior
    // → logged as no-op). If NO primary candidates at all (e.g. correction
    // that only touches a component), material_primary stays as-is.
    const chosenNew = newCandidates[0] ?? primaryCandidates[0] ?? null;

    if (chosenNew) {
      if (priorValue && chosenNew !== priorValue) {
        state.corrections_log.push({
          field: 'material_primary',
          previous: priorValue,
          new: chosenNew,
          turn: state.turn_count,
          at: nowIso(),
        });
        delta.changes.push({ field: 'material_primary', previous: priorValue, new: chosenNew });
      } else if (priorValue && chosenNew === priorValue) {
        delta.noops.push({ field: 'material_primary', value: chosenNew, reason: 'already set to this value' });
      }
      state.established_facts.material_primary = {
        value: chosenNew,
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

  // P0-#2 defense (2026-08-20): even if the intent classifier misses, a
  // message that TEXTUALLY looks like an information-seeking question
  // ("what's the name of the metal bracket...") MUST NOT write specify facts.
  // Belt-and-braces with extract.mjs's classifier fix.
  const infoSeekingByText = looksInformationSeekingByText(text);

  // P0-#5 helper (2026-08-20): even when primary intent is specify_constraint
  // or discover, an explicit first-person material declaration in the message
  // ("I want oak", "make it oak", "in walnut", "oak staircase") should mark
  // the material as customer_stated rather than inferred. Prevents provenance
  // drift on multi-signal messages (S7 in the 2026-08-20 speaking-quality
  // audit). Per-material lookup rather than one greedy capture — a single
  // regex would only match the first cue ("I'd like a *straight*") and miss
  // a later cue ("*in walnut*"). Called with the materials extracted from
  // this turn; returns the set of materials the customer explicitly declared.
  const customerStatedMaterialsInText = detectCustomerStatedMaterials(text);

  // Specify material → establish or update fact.
  // Secondary capture: also fires when a material entity is present in any
  // specify/discover intent (so "I like oak" without a strong specify cue
  // still captures oak as the material fact). Mirrors the style rule below.
  //
  // M4-BUG-02 GUARD: PURE_QUESTION_INTENTS never write facts. And even for
  // non-question intents, generic material words ("timber", "wood") never
  // become customer facts — only specific choices (oak, walnut, ...).
  const materialEnts = entities.filter(e => isMaterial(e) && !['timber', 'wood', 'material', 'carpet'].includes(e));
  // P2-C2 companion (2026-08-20): strip context-bound materials from the
  // primary candidates. "I want an oak staircase with glass balustrade"
  // extracts entities [glass, oak] (alias order lottery). Without this,
  // glass wins as primary because it iterates first. With the strip,
  // glass is bound to balustrade context → excluded → oak wins as primary.
  const primaryContextBound = detectContextBoundMaterials(text, materialEnts);
  const primaryMaterialEnts = materialEnts.filter(m => !primaryContextBound.has(m));
  // If the customer explicitly cued a material ("I want oak" / "make it
  // walnut"), prefer THAT one first — deterministic regardless of entity
  // extraction order or context-strip results.
  const cuedFirst = [
    ...primaryMaterialEnts.filter(m => customerStatedMaterialsInText.has(m)),
    ...primaryMaterialEnts.filter(m => !customerStatedMaterialsInText.has(m)),
  ];
  if (!isPureQuestion && !infoSeekingByText && intent.slug !== 'correct' && cuedFirst.length && (intent.slug === 'specify_material' || intent.class === 'specify' || intent.class === 'discover')) {
    for (const mat of cuedFirst) {
      // P0-#5: promote to customer_stated when the message explicitly
      // declared this material via first-person / attribution cue.
      const promotedProvenance = customerStatedMaterialsInText.has(mat)
        ? 'customer_stated'
        : provenanceForIntent(intent.slug, 'specify_material');
      state.established_facts.material_primary = state.established_facts.material_primary ?? {
        value: mat,
        turn_established: state.turn_count,
        confidence: intent.confidence * (intent.slug === 'specify_material' ? 1 : 0.9),
        provenance: promotedProvenance,
      };
    }
  }
  // Style — set if either the intent is specify_style OR a style entity is
  // present in any specify/discover intent (secondary intent capture).
  const styleEnts = entities.filter(e => isStyle(e));
  if (!isPureQuestion && !infoSeekingByText && styleEnts.length && (intent.slug === 'specify_style' || intent.class === 'specify' || intent.class === 'discover')) {
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
  if (!isPureQuestion && !infoSeekingByText && constraintEnts.length && (intent.slug === 'specify_constraint' || intent.class === 'specify' || intent.class === 'discover')) {
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
  // P2-L1 · Location type (2026-08-20 natural-conversation audit).
  // "Hallway", "extension", "loft", "kitchen", "living room", "basement"
  // etc. are WHERE the staircase is installed — different from
  // construction_context (which is wall orientation). S1 T2 of the audit:
  // customer said "I'm renovating my hallway and I need advice on a
  // staircase" and NEX asked "where in the house is the staircase going —
  // hallway, extension, loft?" · not listening. Fix: capture location
  // whenever an install-location keyword is mentioned; prompt then
  // acknowledges it instead of re-asking.
  //
  // Entity + text detection combined. Pre-existing "renovating my
  // hallway" compound alias belongs to the `renovating_hallway` process
  // slug, which consumes the whole phrase → `hallway` slug never
  // extracts from that sentence. Text-regex fallback catches it.
  if (!isPureQuestion && !infoSeekingByText) {
    const entityLoc = entities.find(e => isInstallLocation(e));
    let detectedLoc = entityLoc ?? null;
    if (!detectedLoc) {
      const t = (text ?? '').toLowerCase();
      const LOCATION_TEXT_RX = [
        ['hallway',      /\bhallway|\bfoyer|\bentrance\s+hall|\bentry\s+hall\b/i],
        ['loft',         /\bloft|\battic\b/i],
        ['extension',    /\bextension\b/i],
        ['kitchen',      /\bkitchen\b/i],
        ['living_room',  /\bliving\s+room|\blounge\b/i],
        ['basement',     /\bbasement|\bcellar\b/i],
        ['garage',       /\bgarage\b/i],
        ['conservatory', /\bconservatory\b/i],
        ['mezzanine',    /\bmezzanine\b/i],
      ];
      for (const [slug, rx] of LOCATION_TEXT_RX) {
        if (rx.test(t)) { detectedLoc = slug; break; }
      }
    }
    if (detectedLoc) {
      state.established_facts.location_type = state.established_facts.location_type ?? {
        value: detectedLoc,
        turn_established: state.turn_count,
        confidence: intent.confidence * 0.9,
        provenance: 'customer_stated',
      };
    }
  }
  // ─── Balustrade / handrail / newel material writers ────────────────
  //
  // P0-#3 (2026-08-20 speaking-quality audit): split the previously-single
  // "balustrade context" writer into THREE separate writers. Previously
  // BALUSTRADE_CONTEXT_SLUGS = ['balustrade','baluster','handrail','base_rail','newel']
  // which meant "make the handrail walnut too" wrote balustrade=walnut
  // (silent state corruption · S11 in the audit). Handrail material and
  // newel material are distinct facts from balustrade infill material —
  // owners and specialists reason about them separately.
  //
  // Each writer's context set is strictly its own component; a material
  // named alongside the component becomes that component's material.
  const BALUSTRADE_INFILL_MATERIALS = new Set(['glass', 'metal', 'cable', 'oak', 'walnut', 'ash', 'pine', 'beech', 'maple', 'sapele', 'iroko']);
  const HANDRAIL_MATERIALS         = new Set(['glass', 'metal', 'stainless', 'cable', 'oak', 'walnut', 'ash', 'pine', 'beech', 'maple', 'sapele', 'iroko']);
  const NEWEL_MATERIALS            = new Set(['oak', 'walnut', 'ash', 'pine', 'beech', 'maple', 'sapele', 'iroko', 'metal']);

  writeComponentMaterial({
    state, delta, text, entities, intent,
    isPureQuestion, infoSeekingByText,
    factName: 'balustrade',
    contextSlugs: new Set(['balustrade', 'baluster', 'base_rail']),
    contextTextRx: /\bbalustrade|\bbaluster|\bbase[-\s]?rail\b/i,
    validMaterials: BALUSTRADE_INFILL_MATERIALS,
  });
  writeComponentMaterial({
    state, delta, text, entities, intent,
    isPureQuestion, infoSeekingByText,
    factName: 'handrail_material',
    contextSlugs: new Set(['handrail']),
    contextTextRx: /\bhandrail\b/i,
    validMaterials: HANDRAIL_MATERIALS,
  });
  writeComponentMaterial({
    state, delta, text, entities, intent,
    isPureQuestion, infoSeekingByText,
    factName: 'newel_material',
    contextSlugs: new Set(['newel']),
    contextTextRx: /\bnewel\b/i,
    validMaterials: NEWEL_MATERIALS,
  });

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

  // S4 Option A (Philip 2026-08-20 · greenlit). Empty-state discovery
  // streak · replaces the previous NEX-reply-based counter that caused
  // the sawtooth loop (differently-help replies didn't match the empty-
  // state whitelist regex → counter reset → discovery loop resumed).
  //
  // New semantic: consecutive turns where the CUSTOMER gave a vague
  // fallback message that captured zero customer-stated facts. Increment
  // only when intent === 'statement' (the true fallback for vague
  // fragments) AND no customer-stated fact was written this turn. Reset
  // as soon as a customer-stated fact lands. Leave unchanged on meta /
  // backchannel / close / ask_definition / etc. — those are conversational
  // lubricant, not a discovery loop, and should not sway the counter.
  //
  // Threshold in respond-local.mjs stays at ≥ 2 (unchanged per approval).
  // Result: differently-help mode stays active across sequential vague
  // turns instead of firing once and letting the discovery loop resume.
  const customerStatedFactCount = Object.values(state.established_facts ?? {})
    .filter(v => v?.provenance === 'customer_stated').length;
  if (customerStatedFactCount > 0) {
    state.empty_state_discovery_streak = 0;
  } else if (intent.slug === 'statement') {
    state.empty_state_discovery_streak = (state.empty_state_discovery_streak || 0) + 1;
  }
  // else (meta/backchannel/close/ask_definition/etc.): leave streak unchanged

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

  // P2-Y1 (2026-08-20): capture NEX's last question so a subsequent
  // "yes" / "no" / "ok" can resolve against it. Extract the last sentence
  // ending in '?' from the reply; classify its shape (binary vs A-or-B
  // vs open) so the response layer can guide interpretation.
  state.last_nex_question = extractLastQuestion(text);

  // P2-D1 streak logic REMOVED from updateStateFromNex 2026-08-20 (S4
  // Option A · Philip greenlit). It caused the sawtooth loop: NEX's
  // differently-help replies didn't match the empty-state whitelist
  // regex → streak reset to 0 → discovery loop resumed. Now handled in
  // updateStateFromCustomer where the actual signal (customer's intent
  // + fact capture) lives.
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
  if (state.last_nex_question === undefined) state.last_nex_question = null;              // P2-Y1
  if (typeof state.empty_state_discovery_streak !== 'number') state.empty_state_discovery_streak = 0; // P2-D1
  if (typeof state.conversation_language !== 'string') state.conversation_language = 'en'; // P3 Indonesian
  if (typeof state.turn_count !== 'number') state.turn_count = 0;
  if (typeof state.overall_confidence !== 'number') state.overall_confidence = 0.5;
  if (typeof state.stage !== 'string') state.stage = 'discover';
}

/**
 * P2-Y1 (2026-08-20). Extract NEX's last question from a reply text.
 * Returns { text, shape } or null if no question found.
 *   shape === 'ab'     · "X or Y?" · customer's "yes" means "keep going,
 *                        help me choose"
 *   shape === 'binary' · yes/no shape ("do/does/is/can/would you...?")
 *                        customer's "yes" is a clear agreement
 *   shape === 'open'   · open-ended ("what/how/which/why...?") · "yes"
 *                        should be treated as "please continue"
 */
function extractLastQuestion(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;
  // Split into sentences · pick the last one ending in ?
  const parts = trimmed.split(/(?<=[.!?])\s+/).filter(Boolean);
  const question = [...parts].reverse().find(p => /\?\s*$/.test(p));
  if (!question) return null;
  const q = question.slice(0, 200);
  const lower = q.toLowerCase();
  let shape = 'open';
  if (/\b(or)\b.*\?/i.test(lower) && !/^(what|how|which|why|when|where|who)\b/i.test(lower)) {
    shape = 'ab';
  } else if (/^(do|does|did|is|are|was|were|can|could|would|will|should|shall|have|has|had)\b/i.test(lower)
             || /^(would you|do you|are you|is that|does that|can you)\b/i.test(lower)) {
    shape = 'binary';
  }
  return { text: q, shape };
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

/**
 * P2-L1 (2026-08-20). Install-location entities · WHERE the staircase
 * physically lives in the customer's home. Distinct from construction_context
 * (wall orientation). Extends the "listening" the customer expects — if
 * they say "hallway" once, NEX must not ask again. Extends over time as
 * new locations are added to the corpus.
 */
function isInstallLocation(slug) {
  return ['hallway','extension','loft','kitchen','living_room','basement','garage','conservatory','entrance','landing_area','mezzanine'].includes(slug);
}

/**
 * P2-C2 helper (2026-08-20). Bind materials to component contexts by
 * TEXTUAL PROXIMITY. Picks the CLOSEST material to each context keyword
 * (balustrade / handrail / newel) so "walnut with a metal handrail"
 * binds metal to handrail (metal at position 14, handrail at 21 → dist 7)
 * not walnut (walnut at position 0 → dist 21). Text-based rather than
 * entity-based because pre-existing alias collisions ("glass balustrade"
 * being an alias of `glass`) can eat the component slug during entity
 * extraction. Returns a Set of material slugs that are context-bound and
 * should NOT be candidates for material_primary.
 */
function detectContextBoundMaterials(text, candidateMaterials) {
  const contextBound = new Set();
  if (!text) return contextBound;
  const lowerText = text.toLowerCase();
  const CONTEXTS = [
    { rx: /\bbalustrade|\bbaluster|\bbase[-\s]?rail\b/i, valid: new Set(['glass','metal','cable','oak','walnut','ash','pine','beech','maple','sapele','iroko']) },
    { rx: /\bhandrail\b/i,                                valid: new Set(['glass','metal','stainless','cable','oak','walnut','ash','pine','beech','maple','sapele','iroko']) },
    { rx: /\bnewel\b/i,                                   valid: new Set(['oak','walnut','ash','pine','beech','maple','sapele','iroko','metal']) },
  ];
  for (const { rx, valid } of CONTEXTS) {
    const ctxMatch = rx.exec(lowerText);
    if (!ctxMatch) continue;
    const ctxIdx = ctxMatch.index;
    let best = null;
    let bestDist = Infinity;
    for (const mat of candidateMaterials) {
      if (contextBound.has(mat)) continue;
      if (!valid.has(mat)) continue;
      const matRx = new RegExp(`\\b${mat}\\b`, 'i');
      const matMatch = matRx.exec(lowerText);
      if (!matMatch) continue;
      const dist = Math.abs(matMatch.index - ctxIdx);
      if (dist < bestDist) { bestDist = dist; best = mat; }
    }
    if (best !== null) contextBound.add(best);
  }
  return contextBound;
}

/**
 * P0-#5 helper (2026-08-20). Return the set of specific material slugs
 * the customer explicitly declared in this message via first-person or
 * attribution cue ("I want oak", "in walnut", "make it ash", "please use
 * pine"). Per-material lookup — a single greedy regex would only capture
 * the first cue's next word and miss later declarations ("I'd like a
 * straight staircase in walnut" → 'straight' captured, 'walnut' missed).
 * When the returned set includes a material, downstream writers upgrade
 * its provenance from 'inferred' to 'customer_stated' regardless of the
 * primary intent classification.
 */
function detectCustomerStatedMaterials(text) {
  const result = new Set();
  if (!text || typeof text !== 'string') return result;
  const MATERIALS = ['oak','walnut','ash','pine','beech','maple','sapele','iroko','glass','metal','concrete'];
  // English cues (existing) + Indonesian cues (P3 · 2026-08-20).
  // Indonesian first-person material declaration: "saya (ingin|mau|suka|pilih)
  // [material]" / "pakai [material]" / "gunakan [material]" — same
  // customer_stated provenance semantics.
  const CUES = [
    // English
    'i\\s*want','i\'?d\\s+like','i\'?ll\\s+have','please\\s+use','make\\s+it','make\\s+one','use','in',
    // Indonesian
    'saya\\s+(ingin|mau|suka|pilih|butuh)','pakai','gunakan','pilih','memilih',
    'ganti\\s+(ke|jadi|menjadi)','ubah\\s+(ke|jadi|menjadi)','jadikan',
  ];
  for (const mat of MATERIALS) {
    for (const cue of CUES) {
      const rx = new RegExp(`\\b${cue}\\b\\s+(?:an?\\s+)?\\b${mat}\\b`, 'i');
      if (rx.test(text)) { result.add(mat); break; }
    }
  }
  return result;
}

/**
 * P0-#2 defense (2026-08-20). Belt-and-braces text-level check that a
 * message is fundamentally an information-seeking question. Any message
 * starting with a question word / "what's the X" / "tell me" is asking
 * ABOUT something, not choosing it. Writers skip specify facts when this
 * is true, so "what's the name of the metal bracket..." never writes
 * material_primary=metal even if the intent classifier mis-labels it.
 */
function looksInformationSeekingByText(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.toLowerCase().trim();
  if (/^(what|which|how|why|when|where|who|tell\s+me|show\s+me|explain|is\s+there|are\s+there|can\s+you|do\s+you\s+have)\b/i.test(t)) return true;
  if (/\bwhat'?s\s+(the|a|an)\b/i.test(t)) return true;
  // P3 · Indonesian question-word starts
  if (/^(apa|bagaimana|mengapa|kenapa|di\s*mana|kapan|siapa|berapa|jelaskan|tolong\s+jelaskan)\b/i.test(t)) return true;
  if (/\bapa\s+(itu|arti|maksud|artinya|maksudnya)\b/i.test(t)) return true;
  return false;
}

/**
 * P0-#3 (2026-08-20). Shared writer for balustrade / handrail_material /
 * newel_material component facts. Each call fires only when the message
 * mentions BOTH a valid component-context slug AND a material valid for
 * that component. First-write-wins (?? semantics preserved from the
 * previous single balustrade writer). Correction path not yet supported
 * per-component (matches previous behaviour · additive change only).
 */
function writeComponentMaterial({ state, delta, text, entities, intent, isPureQuestion, infoSeekingByText, factName, contextSlugs, contextTextRx, validMaterials }) {
  if (isPureQuestion || infoSeekingByText) return;
  // P2-C2 (2026-08-20): component writers now DO fire during 'correct'
  // intent. Previous behaviour skipped, so "walnut with glass balustrade"
  // set primary=walnut but never wrote balustrade=glass. During correct,
  // component writers OVERWRITE the existing component fact (customer is
  // actively re-specifying, so `??` semantics are wrong here).
  const eligibleIntent =
    intent.slug === 'specify_material' ||
    intent.slug === 'correct' ||
    intent.class === 'specify' ||
    intent.class === 'discover';
  if (!eligibleIntent) return;
  // TEXT-based context detection (fallback) alongside entity-based.
  // Pre-existing alias collisions can eat the component slug — e.g.
  // "glass balustrade" is an alias of `glass` so `balustrade` slug never
  // extracts. Text regex catches these robustly.
  const hasContextByEntity = entities.some(e => contextSlugs.has(e));
  const hasContextByText   = contextTextRx ? contextTextRx.test(text ?? '') : false;
  if (!hasContextByEntity && !hasContextByText) return;
  // Materials from entities (may miss some due to alias collisions) +
  // also scan raw text for any valid material word to catch cases the
  // entity extractor missed.
  const materialCandidates = [...new Set([
    ...entities.filter(e => validMaterials.has(e)),
    ...[...validMaterials].filter(m => new RegExp(`\\b${m}\\b`, 'i').test(text ?? '')),
  ])];
  if (materialCandidates.length === 0) return;
  // Pick the material CLOSEST to the context keyword (proximity-based).
  // "walnut with a metal handrail" → handrail context at pos 32, metal
  // at pos 26 (dist 6), walnut at pos 14 (dist 18) → metal wins.
  // Falls back to first candidate if no proximity signal (no context
  // text regex or context regex didn't match this call).
  let chosen = null;
  if (contextTextRx) {
    const ctxM = contextTextRx.exec(text ?? '');
    if (ctxM) {
      let bestDist = Infinity;
      for (const mat of materialCandidates) {
        const matM = new RegExp(`\\b${mat}\\b`, 'i').exec(text ?? '');
        if (matM) {
          const dist = Math.abs(matM.index - ctxM.index);
          if (dist < bestDist) { bestDist = dist; chosen = mat; }
        }
      }
    }
  }
  chosen = chosen ?? materialCandidates[0];
  const prior = state.established_facts[factName];
  const isCorrection = intent.slug === 'correct';
  if (!prior) {
    state.established_facts[factName] = {
      value: chosen,
      turn_established: state.turn_count,
      confidence: intent.confidence * (intent.slug === 'specify_material' || isCorrection ? 1 : 0.9),
      provenance: 'customer_stated',
    };
    delta.changes.push({ field: factName, previous: null, new: chosen });
  } else if (prior.value !== chosen) {
    if (isCorrection) {
      // Overwrite on correction — customer is actively re-specifying.
      // Log the swap so the response layer can acknowledge it.
      state.corrections_log.push({
        field: factName,
        previous: prior.value,
        new: chosen,
        turn: state.turn_count,
        at: nowIso(),
      });
      state.established_facts[factName] = {
        value: chosen,
        turn_established: state.turn_count,
        confidence: intent.confidence,
        via: 'correction',
        provenance: 'customer_stated',
      };
      delta.changes.push({ field: factName, previous: prior.value, new: chosen });
    } else {
      delta.noops.push({ field: factName, proposed: chosen, existing: prior.value, reason: 'already set · use correct intent to change' });
    }
  }
}
