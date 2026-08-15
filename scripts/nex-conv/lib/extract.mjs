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

// M4-BUG-01 · negated-attribution mask.
// The M4 test surfaced this failure: customer says "i didient say against
// the wall" · extractEntities used to find "wall" and write against_wall
// into state as an established fact, then the LLM would double down
// claiming the customer said it.
//
// This helper masks the character range from an explicit denial-of-attribution
// cue ("i didn't say", "i never mentioned", "that's not what I said", etc.)
// through the end of that clause. Only these targeted patterns — a general
// "not X" mask would clobber corrections like "no I meant oak" which are
// legitimate specify_material turns.
const NEGATED_ATTRIBUTION_PATTERNS = [
  /\bi\s+didn'?t\s+(say|mention|mean|state|tell\s+you)\b/gi,
  /\bi\s+did\s*ient\s+(say|mention|mean|state|tell\s+you)\b/gi,   // common misspell
  /\bi\s+did\s+not\s+(say|mention|mean|state|tell\s+you)\b/gi,
  /\bi\s+never\s+(said|mentioned|meant|stated|told\s+you)\b/gi,
  /\bi\s+haven'?t\s+(said|mentioned|meant|stated|told\s+you)\b/gi,
  /\bi\s+wasn'?t\s+(saying|mentioning|meaning|stating|telling\s+you)\b/gi,
  /\bthat'?s\s+not\s+what\s+i\s+(said|meant|mentioned)\b/gi,
  /\byou\s+(just\s+)?assumed\b/gi,
  /\byou'?re\s+putting\s+words\b/gi,
];
export function maskNegatedAttributions(text) {
  if (!text) return text;
  let out = text;
  for (const rx of NEGATED_ATTRIBUTION_PATTERNS) {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(text)) !== null) {
      const start = m.index;
      const restStart = start + m[0].length;
      const rest = text.slice(restStart);
      const punct = rest.match(/[.,;!?]/);
      const end = punct ? restStart + punct.index : text.length;
      out = out.slice(0, start) + ' '.repeat(end - start) + out.slice(end);
    }
  }
  return out;
}

/** Extract entity slugs mentioned in a text. Returns unique slug array. */
export function extractEntities(text, store) {
  if (!text || typeof text !== 'string') return [];
  const pairs = aliasesForStore(store);
  const found = new Set();
  const consumed = []; // char ranges to skip after longer-match wins
  // M4-BUG-01: strip the payload of "i didn't say X" style denials before
  // scanning, so we don't extract X as a positive entity from a denial.
  const masked = maskNegatedAttributions(text);
  // Normalise hyphens between word chars to spaces so "starting-step" matches "starting step"
  const lower = masked.toLowerCase().replace(/(\w)-(\w)/g, '$1 $2');
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

  // M4-BUG-01 · deny_attribution intent — the customer is explicitly rejecting
  // something NEX (or the packet) implied they'd said. Fires BEFORE correct so
  // "i didn't say against the wall" isn't misread as a positive correction.
  // Handler in state.mjs uses this to clear any wrongly-set fact.
  if (/\b(i\s+didn'?t|i\s+did\s*ient|i\s+did\s+not|i\s+never|i\s+haven'?t|i\s+wasn'?t)\s+(say|said|mean|meant|mention|mentioned|state|stated|tell\s+you|told\s+you|saying|meaning|mentioning|stating|telling\s+you)\b/i.test(lower)
      || /\bthat'?s\s+not\s+what\s+i\s+(said|meant|mentioned)\b/i.test(lower)
      || /\byou\s+(just\s+)?assumed\b/i.test(lower)
      || /\byou'?re\s+putting\s+words\b/i.test(lower)) {
    return { slug: 'deny_attribution', class: 'correct', confidence: 0.92, reason: 'explicit denial of attribution' };
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
  // Options / discovery · expanded for M4-BUG-02
  // Catches: "what options have i" · "what options do i have" · "what have i got" ·
  // "what can i choose from" · "what are my options" · "what wood" · "what timber"
  // · "what material(s)" · "show/tell me [options|choices|types|kinds|styles]"
  if (/^(what|which|show me|tell me)\b.*(options|choices|types|kinds|styles)/i.test(lower)
      || /\bwhat\s+(options|choices|styles|materials?|woods?|timbers?|finishes?|colours?|handrails?|balustrades?|prices?)\s+(have|do|are)\s+(i|we|you)\b/i.test(lower)
      || /\bwhat\s+(have|do)\s+i\s+(got|have)\b/i.test(lower)
      || /\bwhat\s+(are|is)\s+(my|the)\s+(options|choices|possibilities)\b/i.test(lower)
      || /\bwhat\s+can\s+i\s+(choose|pick|have|get|do)\b/i.test(lower)
      || /^what\s+(wood|timber|material)\b/i.test(lower)) {
    return { slug: 'ask_options', class: 'discover', confidence: 0.9, reason: 'options cue (expanded)' };
  }
  // M4-BUG-02 · bare-noun-plural category queries — "wood materials" · "materials"
  // · "prices" · "types" · "styles" · "handrails" · "balustrades" · "finishes"
  // Short 1-3 word plural noun that names a category is a category-listing ask,
  // NOT a specify. This runs BEFORE the bare-material-specify rule below so
  // "wood" alone or "wood materials" doesn't get mis-labelled as specify_material.
  const wordCount = lower.split(/\s+/).length;
  if (wordCount <= 3 && /\b(materials?|options?|choices?|types?|kinds?|styles?|prices?|costs?|handrails?|balustrades?|finishes?|colours?|woods?|timbers?|constructions?)\b/i.test(lower)) {
    // Only fire if there's no specific material choice being made (e.g. "walnut please")
    const hasSpecificMaterial = /\b(oak|walnut|ash|pine|beech|maple|sapele|iroko|glass|metal|concrete)\b/i.test(lower);
    if (!hasSpecificMaterial) {
      return { slug: 'ask_options', class: 'discover', confidence: 0.85, reason: 'bare category-plural query' };
    }
  }
  // Recommendation ask
  if (/\b(which .* (better|best|recommend)|what do you (think|recommend))\b/i.test(lower)) {
    return { slug: 'ask_recommendation', class: 'decide', confidence: 0.85, reason: 'recommendation cue' };
  }
  // Summary-confirmation (multi-item recap · check BEFORE plain confirm)
  // Fires when the message contains BOTH a summary opener AND multiple
  // comma-separated items (indicating a real recap, not a bare "ok").
  const looksLikeMultiItem = (lower.match(/[,·]/g) || []).length >= 3 || (lower.split(/\s+/).length >= 15);
  if (/\b(to (summarise|summarize|recap)|summary:|so we have|let me (summarise|summarize|recap)|(does this|sound about right|sound right|am i on the right track|is that all (correct|right)))\b/i.test(lower) && looksLikeMultiItem) {
    return { slug: 'confirm_summary', class: 'confirm', confidence: 0.9, reason: 'multi-item summary confirmation cue' };
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
  // M4-BUG-02 · Specify STYLE — has a style entity + short-ish text.
  // Fires on "straight staircase" / "traditional" / "contemporary look".
  const styles = ents.filter(e => {
    const ent = store.allEntities().find(x => x.slug === e);
    return ent && ent.entity_class === 'style';
  });
  if (styles.length && lower.length < 60) {
    return { slug: 'specify_style', class: 'specify', confidence: 0.82, reason: 'style entity + short reply' };
  }
  // Specify material (has a material entity + short-ish text + first-person)
  const materials = ents.filter(e => {
    const ent = store.allEntities().find(x => x.slug === e);
    return ent && ent.entity_class === 'material';
  });
  if (materials.length && /\b(i want|i'd like|in\s|make it|make one|use)\b/i.test(lower)) {
    return { slug: 'specify_material', class: 'specify', confidence: 0.85, reason: 'material + specify cue' };
  }
  // M4-BUG-02 · Bare material name in a SHORT reply → specify, but ONLY if
  // the material is SPECIFIC (oak, walnut...), NOT a generic category word
  // like "wood" or "timber". "wood" alone should be ask_options (handled by
  // the bare-plural rule above).
  const GENERIC_MATERIALS = new Set(['timber', 'wood', 'material', 'carpet']);
  const specificMaterials = materials.filter(m => !GENERIC_MATERIALS.has(m));
  if (specificMaterials.length && lower.length < 40) {
    return { slug: 'specify_material', class: 'specify', confidence: 0.72, reason: 'bare specific-material short reply' };
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
