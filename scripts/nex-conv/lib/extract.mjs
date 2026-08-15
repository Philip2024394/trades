// ADR-0044 MVP · entity + intent extraction · rule-based, evidence-only.
// No LLM in the pipeline path (Core Dependency Rule). Aliases from
// entities.mjs are matched with word-boundary regex. Intent is matched
// against example_phrases + a small set of shape rules (question marks,
// negation cues for corrections, "what about" ellipsis, etc.).

const _entityRegexCache = new Map();

function aliasesForStore(store) {
  // Build a compact word-boundary alias index from the store's entities.
  // Longest aliases first so "cut string" wins over "string".
  const items = [...store.allEntities()];
  const pairs = [];
  for (const e of items) {
    for (const a of e.aliases ?? []) pairs.push({ alias: a, slug: e.slug });
    pairs.push({ alias: e.slug.replace(/_/g, ' '), slug: e.slug });
    pairs.push({ alias: e.display_name, slug: e.slug });
  }
  pairs.sort((a, b) => b.alias.length - a.alias.length);
  return pairs;
}

function makeRegex(alias) {
  const key = alias.toLowerCase();
  if (_entityRegexCache.has(key)) return _entityRegexCache.get(key);
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const rx = new RegExp(`\\b${escaped}\\b`, 'i');
  _entityRegexCache.set(key, rx);
  return rx;
}

// Ontology implication: a specific-child slug implies its parent slug.
// Non-fabrication: only expresses the relationships explicitly present in
// the reference brain (bullnose IS a starting_step; handrail_height IS a
// handrail regulation; etc).
const IMPLIED_PARENTS = {
  bullnose: 'starting_step',
  curtail: 'starting_step',
  volute: 'starting_step',
  handrail_height: 'handrail',
  closed_string: 'string',
  cut_string: 'string',
  open_riser: 'riser',
  tread_return: 'tread',
  newel_cap: 'newel',
  base_rail: 'string',
};

/** Extract entity slugs mentioned in a text. Returns unique slug array. */
export function extractEntities(text, store) {
  if (!text || typeof text !== 'string') return [];
  const pairs = aliasesForStore(store);
  const found = new Set();
  const consumed = []; // char ranges to skip after longer-match wins
  // Normalise hyphens between word chars to spaces so "starting-step" matches "starting step"
  const lower = text.toLowerCase().replace(/(\w)-(\w)/g, '$1 $2');
  for (const { alias, slug } of pairs) {
    const rx = makeRegex(alias);
    let m; const searchable = lower;
    while ((m = rx.exec(searchable)) !== null) {
      const start = m.index, end = m.index + m[0].length;
      // Skip if this range overlaps a previously-consumed range (longer alias won)
      if (consumed.some(([s, e]) => start < e && end > s)) { rx.lastIndex = end; if (!rx.global) break; continue; }
      consumed.push([start, end]);
      found.add(slug);
      if (!rx.global) break;
    }
  }
  // Apply ontology implications (parent entity present whenever a specific child is)
  for (const slug of [...found]) {
    const parent = IMPLIED_PARENTS[slug];
    if (parent) found.add(parent);
  }
  return [...found];
}

/** Classify intent for a text. Returns { slug, class, confidence, reason }. */
export function extractIntent(text, store) {
  if (!text) return { slug: 'statement', class: 'discover', confidence: 0.5, reason: 'empty' };
  const lower = text.toLowerCase().trim();

  // Meta / conversational intents (highest priority · short-circuit staircase retrieval)
  // These must fire BEFORE staircase-domain rules so "hello" doesn't get treated
  // as a definition question that forces a wall-orientation reply.
  if (/^(hi|hello|hey|hiya|yo|howdy|greetings|good\s+(morning|afternoon|evening|night))\b/i.test(lower) && lower.length < 60) {
    return { slug: 'meta_greeting', class: 'discover', confidence: 0.95, reason: 'greeting cue' };
  }
  if (/\b(is\s+)?any(one|body)\s+(online|here|around|there|about)\b|\b(are\s+you|u|you)\s+(there|online|here|around|about)\b|^u\s+there\b/i.test(lower)) {
    return { slug: 'meta_presence', class: 'discover', confidence: 0.9, reason: 'presence check cue' };
  }
  if (/\b(who|what)\s+(are|is)\s+you\b|\bwho\s+am\s+i\s+(\w+\s+){0,3}?(talking|speaking|chatting)\s+(to|with)\b|\bare\s+you\s+(human|a\s+bot|a\s+robot|ai|an\s+ai)\b|\bwhat\s+can\s+you\s+(do|help)\b/i.test(lower)) {
    return { slug: 'meta_identity', class: 'discover', confidence: 0.9, reason: 'identity question cue' };
  }
  if (/\bhow\s+(are|is|do)\s+(you|it|things)\b|\bhow'?s\s+it\s+going\b/i.test(lower)) {
    return { slug: 'meta_smalltalk', class: 'discover', confidence: 0.85, reason: 'small-talk cue' };
  }

  // Backchannel · thinking / acknowledging noises. Three shapes ≤40 chars:
  //   1. Pure form  : "hmm" / "ok" / "yeah"
  //   2. + hedge    : "hmm not sure" / "ok maybe"
  //   3. + reaction : "ok cool" / "yeah nice" / "right cool"  (thinking noises · not commitments)
  if (lower.length <= 40 && (
       /^(hmm+|hm+|mhm+|ok(ay)?|yeah|yep|yup|right|sure|i\s+see|got\s+it|ah+|oh+|huh|well|go\s+on|alright)[.!?\s]*$/i.test(lower)
    || /^(hmm+|hm+|mhm+|ok(ay)?|yeah|yep|yup|right|sure|well|oh+|ah+|alright)[\s,]+(not\s+sure|maybe|dunno|don'?t\s+know|possibly|kind\s+of|sort\s+of|i\s+think|yeah|nah|yes|no)[.!?\s]*$/i.test(lower)
    || /^(ok(ay)?|yeah|yep|right|alright|hmm+|hm+|sure)[\s,]+(cool|nice|great|sweet|brilliant|good|ok(ay)?)[.!?\s]*$/i.test(lower)
  )) {
    return { slug: 'backchannel', class: 'discover', confidence: 0.9, reason: 'backchannel cue' };
  }

  // A question-shaped message ("wait sorry, what does X mean?") should NOT be
  // classified as correction just because it opens with "wait" / "sorry".
  // Yields correction detection to explicit definition/how questions.
  const looksLikeDefinitionQuestion = /\b(what|how|which)\s+(is|are|does|do|means?|mean)\b|\bwhat'?s\b|\bmean\b.*\?/i.test(lower);

  // Correction cues (high priority · but yield to explicit questions)
  if (!looksLikeDefinitionQuestion && /^(no,?\s|actually,?\s|wait,?\s|sorry,?\s|i meant\s|i mean\s|scratch that)/i.test(lower)) {
    return { slug: 'correct', class: 'correct', confidence: 0.95, reason: 'negation cue at start' };
  }
  if (!looksLikeDefinitionQuestion && /\b(let'?s |can we |please )?(switch|change|swap|go back|revert)\s+(back\s+)?to\b/i.test(lower)) {
    return { slug: 'correct', class: 'correct', confidence: 0.90, reason: 'switch/back-to cue' };
  }
  if (!looksLikeDefinitionQuestion && /\bback to\b/i.test(lower) && lower.length < 100) {
    return { slug: 'correct', class: 'correct', confidence: 0.85, reason: 'short back-to cue' };
  }
  // Price cue takes priority over elliptical prefix (e.g., "And installation cost?" is a price ask)
  if (/\b(how much|price[s]?|cost[s]?|expensive|cheap|cheaper|budget|rough (figure|number|estimate|price|idea)|ballpark|estimate|quote[s]?)\b/i.test(lower)
      || (/\bfigure\b/i.test(lower) && lower.length < 40)) {
    return { slug: 'ask_price', class: 'price', confidence: 0.9, reason: 'price cue (priority over ellipsis)' };
  }
  // "What about X" → elliptical revisit
  if (/^(what about|how about|and\s|and if)\b/i.test(lower)) {
    return { slug: 'ask_what_about', class: 'revisit', confidence: 0.92, reason: 'elliptical follow-up cue' };
  }
  // Recommendation ask takes priority when "which is better for X" is asking NEX to advise
  if (/\bwhich\s+(is\s+)?(better|best|recommend)\s+for\b/i.test(lower)) {
    return { slug: 'ask_recommendation', class: 'decide', confidence: 0.88, reason: 'recommendation cue (better for ...)' };
  }
  // Comparison cues
  if (/\b(versus|vs\.?|compared to|difference between|or\b.*\bor\b|which is better)\b/i.test(lower)) {
    return { slug: 'compare', class: 'compare', confidence: 0.9, reason: 'comparison cue' };
  }
  // Installation cues
  if (/\b(installation|install|fitting|fitted|delivery)\b/i.test(lower)) {
    return { slug: 'ask_installation', class: 'discover', confidence: 0.85, reason: 'install cue' };
  }
  // Definition / discovery
  if (/^(what is|what are|what does|define|meaning of|whats)\b/i.test(lower)) {
    return { slug: 'ask_definition', class: 'discover', confidence: 0.88, reason: 'definition cue' };
  }
  // Options / discovery
  if (/^(what|which|show me|tell me)\b.*(options|choices|types|kinds|styles)/i.test(lower)) {
    return { slug: 'ask_options', class: 'discover', confidence: 0.88, reason: 'options cue' };
  }
  // Recommendation ask
  if (/\b(which .* (better|best|recommend)|what do you (think|recommend))\b/i.test(lower)) {
    return { slug: 'ask_recommendation', class: 'decide', confidence: 0.85, reason: 'recommendation cue' };
  }
  // Close · check BEFORE confirm so "great thanks" isn't captured as confirm.
  // Matches "thanks" anywhere in a short polite closer (leading adjective allowed).
  if (/\b(thanks|thank you|cheers|thanx)\b/i.test(lower) && lower.length < 80) {
    return { slug: 'close', class: 'close', confidence: 0.88, reason: 'close (thanks) cue' };
  }
  if (/^(bye|goodbye|thats all|that'?s all|catch you later|talk later)\b/i.test(lower)) {
    return { slug: 'close', class: 'close', confidence: 0.85, reason: 'close (farewell) cue' };
  }
  // Confirmation
  if (/^(yes|yeah|yep|ok|okay|sounds good|that sounds right|great|perfect)\b/i.test(lower)) {
    return { slug: 'confirm', class: 'confirm', confidence: 0.85, reason: 'confirmation cue' };
  }
  // Specify constraint — a location/context entity in a possessive / short frame
  const ents = extractEntities(text, store);
  const locations = ents.filter(e => {
    const ent = store.allEntities().find(x => x.slug === e);
    return ent && ent.entity_class === 'location';
  });
  if (locations.length && /\b(my|our|the|current) (staircase|stair|stairs|flight|one)\b/i.test(lower)) {
    return { slug: 'specify_constraint', class: 'specify', confidence: 0.85, reason: 'location entity + staircase referent' };
  }
  if (locations.length && !/[?]$/.test(lower)) {
    // Any declarative sentence mentioning a location entity (against_wall, both_sides_open, etc.)
    return { slug: 'specify_constraint', class: 'specify', confidence: 0.78, reason: 'declarative with location entity' };
  }
  // Specify material (has a material entity + short-ish text + first-person)
  const materials = ents.filter(e => {
    const ent = store.allEntities().find(x => x.slug === e);
    return ent && ent.entity_class === 'material';
  });
  if (materials.length && /\b(i want|i'd like|in\s|make it|make one|use)\b/i.test(lower)) {
    return { slug: 'specify_material', class: 'specify', confidence: 0.85, reason: 'material + specify cue' };
  }
  if (materials.length && lower.length < 40) {
    // Bare material name in short reply → specify (with lower confidence)
    return { slug: 'specify_material', class: 'specify', confidence: 0.72, reason: 'bare material short reply' };
  }
  // Question mark generic
  if (lower.endsWith('?')) {
    return { slug: 'ask_definition', class: 'discover', confidence: 0.6, reason: 'trailing question mark' };
  }
  return { slug: 'statement', class: 'discover', confidence: 0.55, reason: 'fallback statement' };
}

/**
 * Detect emotional register from a message.
 * Returns one of: neutral | apologetic | frustrated | excited | uncertain.
 * Rule-based (no LLM). Cues drawn from surface phrases + punctuation shape.
 * State keeps a rolling window of the last 3 emotions to catch sustained
 * frustration/uncertainty patterns.
 */
export function extractEmotion(text) {
  if (!text || typeof text !== 'string') return { register: 'neutral', confidence: 0.5, cues: [] };
  const lower = text.toLowerCase();
  const cues = [];
  // Apologetic — most specific first so it wins over neutral
  if (/\b(sorry|apolog(y|ise|ies)|my bad|oops|whoops|forgive)\b/i.test(lower)
      || /\bflip[\s-]?flopping\b/i.test(lower)
      || /\bmy (fault|mistake)\b/i.test(lower)) {
    cues.push('apologetic-cue');
    return { register: 'apologetic', confidence: 0.9, cues };
  }
  // Frustrated — profanity light + multi-punctuation + emphatic
  const punchy = (text.match(/[?!]{2,}/g) || []).length;
  const shoutyWords = text.split(/\s+/).filter(w => w.length >= 4 && w === w.toUpperCase()).length;
  if (/\b(ugh|argh|annoying|frustrating|for god'?s sake|come on|seriously|already told you|as i said|i said)\b/i.test(lower)
      || punchy > 0 || shoutyWords >= 2) {
    if (punchy > 0) cues.push('multi-punctuation');
    if (shoutyWords >= 2) cues.push('shouty-words');
    return { register: 'frustrated', confidence: 0.85, cues };
  }
  // Excited — enthusiasm words + single exclamation
  if (/\b(love|amazing|brilliant|fantastic|perfect|awesome|excellent|wow)\b/i.test(lower)
      || /!$|!\s/.test(text)) {
    cues.push('enthusiasm-cue');
    return { register: 'excited', confidence: 0.75, cues };
  }
  // Uncertain — hedging, "not sure", ellipses, question stubs
  if (/\b(not sure|dunno|don'?t know|no idea|maybe|might|possibly|kind of|sort of|i think|hmm|err|erm)\b/i.test(lower)
      || /\?$/.test(text.trim()) && text.trim().length < 20) {
    cues.push('hedge-cue');
    return { register: 'uncertain', confidence: 0.75, cues };
  }
  return { register: 'neutral', confidence: 0.6, cues };
}

/**
 * Decompose a message into multiple sub-intents.
 * Splits on sentence boundaries + coordinating conjunctions (and/but/also/plus/then).
 * Runs extractIntent on each part. Returns primary + secondary list.
 * When the message is a single clean sentence, secondary is empty and this is
 * equivalent to extractIntent alone.
 */
export function extractMultiIntent(text, store) {
  const raw = (text || '').trim();
  if (!raw) return { primary: extractIntent(raw, store), secondary: [], parts: [] };
  // Split on sentence terminators OR coordinating conjunctions that likely
  // separate intents. Preserve minimum length so we don't split noise.
  const parts = raw
    .split(/(?<=[.!?])\s+|\s+(?:and|but|also|plus|then|,\s*then)\s+/i)
    .map(p => p.trim())
    .filter(p => p.length >= 3);
  if (parts.length <= 1) {
    return { primary: extractIntent(raw, store), secondary: [], parts: [raw] };
  }
  const perPart = parts.map(p => ({ text: p, intent: extractIntent(p, store) }));
  const primary = perPart[0].intent;
  // secondary intents = distinct-slug remainder
  const secondary = perPart.slice(1)
    .filter(p => p.intent.slug !== 'statement' || p.intent.confidence > 0.7)
    .filter(p => p.intent.slug !== primary.slug)
    .map(p => ({ ...p.intent, source_part: p.text }));
  return { primary, secondary, parts };
}

/** Extract topic slugs (broad clusters). MVP: reuse entity slugs of class
    component or style. Real ontology would separate these. */
export function extractTopics(text, store) {
  const ents = extractEntities(text, store);
  const store_entities = store.allEntities();
  return ents.filter(slug => {
    const ent = store_entities.find(x => x.slug === slug);
    return ent && (ent.entity_class === 'component' || ent.entity_class === 'style');
  });
}
