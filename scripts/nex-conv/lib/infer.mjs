// ADR-0044 MVP · live inference driver (per user message).
// This MVP does NOT call an external LLM for response generation. The MVP's
// job is to prove that state + graph + hybrid retrieval correctly connect
// multi-turn context, not to produce prose. Response generation is a v1
// deliverable. What we produce per turn is a STRUCTURED response object:
//
//   {
//     understood_entities: [...],   // NEW + inherited from state
//     understood_intent: {...},
//     retrieved_top_k: [...],       // full retrieval trace
//     next_likely_intents: [...],
//     response_frame: {             // structured stub of what NEX would say
//       acknowledge: "...",
//       core_answer_from_item_id: "...",
//       core_answer_head: "...",
//       hedge: "commonly / one option",
//       next_ask: "..."
//     },
//     stage_timings: {...},
//   }
//
// A v1 wrapper can pass response_frame + retrieved knowledge to an LLM and
// render final prose; the MVP evaluates whether the RIGHT stuff surfaces.

import { embed, stats as embedStats } from './embed.mjs';
import { extractEntities, extractIntent, extractEmotion, extractMultiIntent } from './extract.mjs';
import { retrieve } from './retrieve.mjs';
import { newState, updateStateFromCustomer, updateStateFromNex } from './state.mjs';
// respond.mjs is imported lazily below · only when `withProse: true`

export async function processTurn({ store, state, brain, text, speaker = 'customer', withProse = false, proseOptions = {} }) {
  const t0 = Date.now();
  const timings = {};

  // (a) extract · intent · multi-intent · entities · emotion · topics
  const t_ex = Date.now();
  const multi = extractMultiIntent(text, store);
  const intent = multi.primary;
  const secondaryIntents = multi.secondary;
  const entities = extractEntities(text, store);
  const emotion = extractEmotion(text);
  const topics = entities.filter(e => {
    const ent = store.allEntities().find(x => x.slug === e);
    return ent && (ent.entity_class === 'component' || ent.entity_class === 'style');
  });
  timings.extract_ms = Date.now() - t_ex;

  // (b) embed
  const t_em = Date.now();
  const queryEmbedding = await embed(text);
  timings.embed_ms = Date.now() - t_em;

  // For elliptical follow-ups ("what about walnut") AND for pronominal
  // references ("Is that expensive?") AND for any short message where the
  // user is clearly relying on prior context, enrich the query entity set
  // with entities_in_focus already tracked by state so retrieval finds
  // items scoped to the ongoing subject.
  //
  // Philip's core rule: "the conversation state determines which
  // relationships matter right now." A bare "is that expensive?" gets its
  // subject from state, not from the message text.
  const pronounish = /\b(that|it|this|those|these|them|the\s+other\s+one)\b/i.test(text);
  const shortReply = entities.length <= 1 && text.length < 60;
  const isMeta = intent.slug.startsWith('meta_');
  const isBackchannel = intent.slug === 'backchannel';
  const isConversational = isMeta || intent.slug === 'close' || isBackchannel;
  const useStateFocus = !isConversational && (intent.slug === 'ask_what_about' || pronounish || shortReply);
  const effectiveEntities = useStateFocus
    ? [...new Set([...entities, ...(state?.entities_in_focus ?? [])])]
    : entities;

  // Build a REFERENCE_HINT string when a pronoun is detected · resolves the
  // reference against state so the LLM doesn't ask "what do you mean?".
  const referenceHint = (pronounish && !isConversational)
    ? buildReferenceHint(state, text)
    : null;

  // (c) retrieve · SKIP staircase retrieval for meta + close intents
  // (Fix 4: "hello" / "anyone online?" / "who are you?" / "cool thanks"
  // should not force staircase advice · we hand the LLM an empty topK
  // + CONVERSATION_MODE so it replies conversationally)
  const t_rt = Date.now();
  const retrieval = isConversational
    ? { topK: [], stageTimings: { skipped_for_conversational_ms: 0 }, total_ms: 0, candidateCount: 0 }
    : retrieve({
        store,
        queryEmbedding,
        queryEntities: effectiveEntities,
        queryIntent: intent.slug,
        state,
        brain,
        includeDraft: false,
      });
  timings.retrieve_ms = Date.now() - t_rt;
  timings.retrieve_stages = retrieval.stageTimings;

  // (d) next-intent prediction (in-memory transition table computed from state)
  const nextLikely = predictNextIntents(state, intent, retrieval);

  // (e) response frame (structured stub — LLM in v1)
  const responseFrame = buildResponseFrame({ state, intent, entities, retrieval });

  // (f) state update · pass emotion + secondary intents + thin-packet flag
  //     so state can track register-window, multi-intent context, and handoff
  //     strikes.
  //
  // packetIsThin considers TWO conditions:
  //   1. Truly empty/short retrieval (0-2 tiny items)
  //   2. Intent-specific: for price questions, no £ number in packet counts
  //      as thin even if there are 8 items
  const generallyThin = (retrieval.topK.length === 0) ||
    (retrieval.topK.length <= 2 && retrieval.topK.every(x => ((x.item.answer_text || x.item.question_text || '').length < 40)));
  const isPriceIntent = intent?.slug === 'ask_price';
  // Only check the top-3 retrieved items for a specific £ figure. A peripheral
  // item with £X that isn't scoped to the customer's actual subject shouldn't
  // suppress the handoff strike.
  const packetTop3HasSpecificPrice = /£\s*\d|\$\s*\d|\d+\s*(pounds|gbp)/i.test(
    retrieval.topK.slice(0, 3).map(x => (x.item.answer_text || x.item.question_text || '')).join(' ')
  );
  const packetIsThin = generallyThin || (isPriceIntent && !packetTop3HasSpecificPrice);
  const t_st = Date.now();
  updateStateFromCustomer(state, {
    text,
    speaker,
    intent,
    entities,
    topics,
    usedItemIds: retrieval.topK.map(x => x.item.id),
    emotion,
    packetIsThin,
    secondaryIntents,
  });
  // Reflect a synthetic "NEX turn" in the state so multi-turn convos advance.
  updateStateFromNex(state, {
    text: responseFrame.core_answer_head ?? responseFrame.acknowledge,
    entities: retrieval.topK.flatMap(x => x.item.entities ?? []).slice(0, 5),
    usedItemIds: retrieval.topK.map(x => x.item.id),
  });
  timings.state_ms = Date.now() - t_st;

  const topKPayload = retrieval.topK.map(x => ({
    id: x.item.id,
    score: +x.final.toFixed(3),
    semantic: +(x.semantic ?? 0).toFixed(3),
    entityOverlap: +(x.entityOverlap ?? 0).toFixed(3),
    graphHopBonus: +(x.graphHopBonus ?? 0).toFixed(3),
    topicContinuity: +(x.topicContinuity ?? 0).toFixed(3),
    brain: x.item.brain,
    kind: x.item.kind,
    canonical_intent: x.item.canonical_intent,
    entities: x.item.entities,
    answer_head: (x.item.answer_text || x.item.question_text || '').slice(0, 180),
    source_batch: x.item.source_batch,
  }));

  // Optional: render prose via the LLM response layer (Step 2).
  // The renderer is a pure function that takes the packet and returns text.
  // It has no access to the store, cannot mutate state, and cannot create
  // knowledge or edges. See scripts/nex-conv/lib/respond.mjs header.
  let prose = null;
  if (withProse) {
    const t_pr = Date.now();
    try {
      const { renderReply } = await import('./respond.mjs');
      const rendered = await renderReply({
        state,
        customerMessage: text,
        topK: topKPayload,
        responseFrame,
        nextLikelyIntents: nextLikely,
        intent,
        secondaryIntents,
        emotion,
        referenceHint,
        ...proseOptions,
      });
      prose = rendered;
      timings.prose_ms = Date.now() - t_pr;
    } catch (e) {
      prose = { error: String(e?.message ?? e), latency_ms: Date.now() - t_pr };
      timings.prose_ms = Date.now() - t_pr;
    }
  }

  const total_ms = Date.now() - t0;
  return {
    understood_entities: entities,
    effective_query_entities: effectiveEntities,
    understood_intent: intent,
    secondary_intents: secondaryIntents,
    emotion,
    handoff_recommended: state.handoff_recommended === true,
    topics,
    retrieved_top_k: topKPayload,
    next_likely_intents: nextLikely,
    response_frame: responseFrame,
    prose,           // { text, latency_ms, model, tokens_prompt, tokens_completion, cost_usd } or null
    stage_timings: timings,
    total_ms,
  };
}

function predictNextIntents(state, intent, retrieval) {
  const table = {
    ask_options:        ['specify_material', 'specify_style', 'ask_price', 'compare'],
    ask_definition:     ['ask_options', 'ask_price', 'specify_material'],
    specify_material:   ['ask_price', 'ask_installation', 'compare', 'specify_style'],
    specify_style:      ['specify_material', 'ask_price', 'ask_installation'],
    specify_constraint: ['ask_options', 'specify_material', 'ask_price'],
    ask_price:          ['ask_installation', 'compare', 'confirm'],
    ask_installation:   ['ask_price', 'confirm', 'close'],
    compare:            ['ask_recommendation', 'ask_price', 'specify_material'],
    ask_recommendation: ['confirm', 'ask_price', 'ask_installation'],
    ask_what_about:     ['ask_price', 'compare', 'ask_installation'],
    correct:            ['ask_price', 'ask_installation', 'compare'],
    confirm:            ['close', 'ask_installation'],
    clarify_customer:   ['ask_options', 'ask_definition'],
    close:              [],
    statement:          ['ask_options', 'ask_price'],
  };
  return (table[intent.slug] ?? ['ask_options']).slice(0, 3);
}

function buildResponseFrame({ state, intent, entities, retrieval }) {
  const top = retrieval.topK[0];
  const focusMaterial = state?.established_facts?.material_primary?.value;
  const focusStyle = state?.established_facts?.style_intent?.value;
  const focusConstraint = state?.established_facts?.construction_context?.value;

  const acknowledgeParts = [];
  if (intent.slug === 'ask_what_about' && entities.length) {
    acknowledgeParts.push(`Understood — you're asking about ${entities.join(', ')} in the context of ${state?.current_topic ?? 'the current staircase'}${focusMaterial ? ` (currently discussing ${focusMaterial})` : ''}.`);
  } else if (intent.slug === 'correct') {
    const prior = state?.corrections_log?.[state.corrections_log.length - 1];
    acknowledgeParts.push(prior
      ? `Got it — swapping ${prior.previous} for ${prior.new}.`
      : `Got it — updating the current assumption.`);
  } else if (focusMaterial || focusStyle) {
    acknowledgeParts.push(`Continuing with ${[focusMaterial, focusStyle, focusConstraint].filter(Boolean).join(' · ')}.`);
  }

  const coreAnswerHead = top ? (top.item.answer_text || top.item.question_text || '').slice(0, 300) : null;
  const hedge = 'This is a commonly-recommended option; other options exist depending on your specific setup.';
  const nextAsk = focusConstraint ? 'Would you like to explore price, installation, or a comparison?' : 'Is your staircase against a wall on one side, or open on both sides?';

  return {
    acknowledge: acknowledgeParts.join(' '),
    core_answer_from_item_id: top?.item.id ?? null,
    core_answer_head: coreAnswerHead,
    hedge,
    next_ask: nextAsk,
  };
}

// Resolve a pronoun reference from state — "that/it/this/the other one"
// probably means the most recently discussed subject.
// Priority: most-recent turn's entities > current topic > facts > entities_in_focus.
// This matters because "does that apply to cut string" after a base-rail
// explanation means "the base rail", not "material=oak from turn 1".
function buildReferenceHint(state, text) {
  const focus = state?.entities_in_focus ?? [];
  const facts = state?.established_facts ?? {};
  const summaries = state?.recent_turn_summaries ?? [];
  const pronoun = text.match(/\b(that|it|this|those|these|them|the\s+other\s+one)\b/i)?.[1] ?? 'that';

  // Most-recent-turn entities — the freshest topic wins
  const recent = [...summaries].reverse().flatMap(s => s.entities ?? []);
  const seen = new Set();
  const dedup = (arr) => arr.filter(x => !seen.has(x) && (seen.add(x), true));
  const recentEnts = dedup(recent).slice(0, 3);

  const mat = facts.material_primary?.value;
  const style = facts.style_intent?.value;
  const constraint = facts.construction_context?.value;
  const fromFacts = [mat, style, constraint].filter(Boolean).filter(x => !seen.has(x) && (seen.add(x), true));

  const focusTop = focus.slice(0, 3).filter(x => !seen.has(x) && (seen.add(x), true));

  const primary = recentEnts[0] ?? fromFacts[0] ?? focusTop[0];
  if (!primary) return null;
  const supporting = [...recentEnts.slice(1), ...fromFacts, ...focusTop].slice(0, 3);
  const supportingStr = supporting.length ? ` (also in scope: ${supporting.join(', ')})` : '';
  return `"${pronoun}" most likely refers to: ${primary}${supportingStr}. Resolve using this — do NOT ask "what do you mean?".`;
}

export { newState, embedStats };
