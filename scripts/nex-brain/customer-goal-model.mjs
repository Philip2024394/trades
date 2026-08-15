// NEX Customer Goal Model · Layer 3 of the Speaking architecture (Philip 2026-08-14).
// Persistent state model that maintains customer goal, subject, constraints, preferences
// (explicit vs inferred), exclusions, decisions, questions, corrections, references, latest instruction.
//
// Merge rules:
//   · New turn → interpret → compare against state → merge/override/correct → validate
//   · Corrections override (with explicit change signal like "actually" / "sorry, I mean")
//   · Additions accumulate
//   · Explicit exclusions block silent additions
//   · Inferred preferences never promoted to explicit without confirmation
//   · Reference resolution ("that", "it", "the other one") against recent state

import { decomposeUtterance, CONCEPT_FAMILIES } from "./compound-intent-engine.mjs";

// ---------- Correction / override signals ----------
const CORRECTION_SIGNALS = [
  "actually", "sorry, i mean", "sorry — i mean", "i mean", "on second thought",
  "let's change", "let me change", "change that", "scratch that", "forget that",
  "no wait", "wait,", "not X — Y", "instead of", "rather than", "not that,",
  "actually, let's", "actually let's", "second thoughts", "on reflection",
];

// ---------- Exclusion signals ----------
const EXCLUSION_SIGNALS = [
  "no ", "not ", "don't ", "do not ", "without ", "never ",
  "avoid ", "skip ", "leave out", "not going to", "no need for",
];

// ---------- Reference / pronoun patterns ----------
const REFERENCE_PATTERNS = [
  { re: /\bit\b/i, ref_type: "generic" },
  { re: /\bthat\b/i, ref_type: "generic" },
  { re: /\bthis\b/i, ref_type: "generic" },
  { re: /\bthe (?:same|other) (?:one|thing|style|material|colour)/i, ref_type: "comparative" },
  { re: /\bthe (?:first|second|third|other|previous|last) (?:one|option|picture|image|example)/i, ref_type: "ordinal" },
  { re: /\bupstairs\b/i, ref_type: "location:landing" },
  { re: /\bdownstairs\b/i, ref_type: "location:flight" },
  { re: /\bat the top\b/i, ref_type: "location:landing_or_top_newel" },
  { re: /\bat the bottom\b/i, ref_type: "location:starting_step_or_bottom_newel" },
];

// ---------- Explicit-preference detection (from decomposition) ----------
// Preferences are EXPLICIT when named directly ("oak", "modern", "glass").
// Preferences are INFERRED when signalled by cascade language ("warm and traditional" → possibly oak).
const INFERRED_SIGNALS = {
  timber_species: [
    { signal: /warm/i, inferred: "oak_or_pine", reason: "warmth typically points to oak/pine" },
    { signal: /pale/i, inferred: "maple_or_ash", reason: "pale timber points to maple or ash" },
    { signal: /dark/i, inferred: "walnut_or_mahogany", reason: "dark timber points to walnut or mahogany" },
    { signal: /rich reddish/i, inferred: "cherry_or_mahogany", reason: "reddish tone points to cherry or mahogany" },
  ],
  style: [
    { signal: /warm and traditional/i, inferred: "traditional", reason: "warm+traditional cascade" },
    { signal: /cottage/i, inferred: "rustic", reason: "cottage → rustic language" },
    { signal: /country house/i, inferred: "grand_traditional", reason: "country house → grand traditional" },
  ],
  scope: [
    { signal: /keep what/i, inferred: "refacing", reason: "'keep what' implies retention/refacing" },
    { signal: /existing/i, inferred: "refacing", reason: "'existing' implies retention/refacing" },
    { signal: /don't rip|don't replace|without replacing/i, inferred: "refacing", reason: "explicit retention" },
    { signal: /update it|update the/i, inferred: "refacing", reason: "'update' typically means refresh scope" },
    { signal: /freshen up|freshen it/i, inferred: "refacing", reason: "'freshen' = refacing" },
    { signal: /current staircase/i, inferred: "refacing", reason: "'current staircase' implies retention" },
    { signal: /the current/i, inferred: "refacing", reason: "'the current' implies retention" },
    { signal: /everything else has been updated/i, inferred: "refacing", reason: "surrounding updates imply refacing scope only for stairs" },
    { signal: /just update|only update/i, inferred: "refacing", reason: "'just update' = refacing" },
    { signal: /not looking to replace/i, inferred: "refacing", reason: "explicit non-replacement" },
    { signal: /we're keeping/i, inferred: "refacing", reason: "'we're keeping' = retention" },
    { signal: /keep the (?:structure|treads|newels|handrail)/i, inferred: "refacing", reason: "keeping structural component = retention" },
    { signal: /refurb job|refurb (?:my|the)/i, inferred: "refacing", reason: "'refurb' = refacing" },
    { signal: /fine structurally/i, inferred: "refacing", reason: "'fine structurally' = keeping structure" },
    { signal: /change (?:the |just the )?(?:spindles|balustrade|caps|handrail)/i, inferred: "refacing", reason: "swap individual components = refacing" },
    { signal: /modernise .*without/i, inferred: "refacing", reason: "'modernise without X' = refacing" },
    { signal: /modernise the /i, inferred: "refacing", reason: "'modernise the balustrade/handrail' = refacing" },
    { signal: /old (?:pine|oak|walnut|mahogany|staircase)/i, inferred: "refacing", reason: "'old X' typically references existing staircase" },
    { signal: /repaint/i, inferred: "refacing", reason: "repainting = refacing" },
    { signal: /swap the/i, inferred: "refacing", reason: "swapping components = refacing" },
    { signal: /new spindles|new caps|new handrail/i, inferred: "refacing", reason: "new component swap = refacing" },
    { signal: /same staircase/i, inferred: "refacing", reason: "same staircase = keeping structure" },
    { signal: /change (?:that|it)/i, inferred: "refacing", reason: "'change that/it' typically points at component swap not full replacement" },
  ],
};

// ---------- Create an empty state ----------
export function createGoalModel() {
  return {
    turns: [],                       // full turn history for reference resolution
    customer_goal: null,             // best inference of overall goal
    current_subject: null,           // the concept currently being discussed
    explicit_constraints: {},        // {construction: "wall_fixed", dimensions_given: true, ...}
    explicit_preferences: {},        // {timber_species: "oak", style: "modern", ...}
    inferred_preferences: {},        // {timber_species: {value: "oak_or_pine", reason: "warm+traditional cascade"}, ...}
    explicit_exclusions: {},         // {balustrade_material: ["glass"], newel_caps: ["remove"]}
    confirmed_decisions: [],         // ["going with bullnose starting step", ...]
    unresolved_questions: [],        // ["style: modern or traditional?", "carpet or exposed timber?"]
    corrections: [],                 // [{field: "timber_species", from: "walnut", to: "oak", turn: 2}]
    conversation_references: [],     // [{ref_type, referring_to, turn}]
    latest_instruction: null,        // most recent explicit command (used for priority)
    concepts_visited: new Set(),     // all concept families ever mentioned
    contradictions: [],              // detected conflicts NEX should raise
  };
}

// ---------- Merge a new turn into the model ----------
export function mergeTurn(model, utteranceText) {
  const d = decomposeUtterance(utteranceText);
  const lower = utteranceText.toLowerCase();

  // 1. Detect correction signal
  const isCorrection = CORRECTION_SIGNALS.some((s) => lower.includes(s));

  // 2. Detect exclusion signals — extract what's being excluded
  const exclusions = extractExclusions(utteranceText);

  // 3. Extract explicit preferences (from decomposition)
  const explicitPrefs = d.preferences;

  // 4. Extract inferred preferences (cascade language)
  const inferredPrefs = extractInferredPreferences(utteranceText);

  // 5. Detect references
  const refs = detectReferences(utteranceText, model);

  // 6a. Style-vs-detail contradiction detection
  //     If new turn declares a style like "modern minimalist" AND a detail like "volute" (traditional decorative element),
  //     that's a contradiction — surface it, don't silently accept.
  const styleDetailContradiction = detectStyleDetailContradiction(utteranceText, model);
  if (styleDetailContradiction) {
    model.contradictions.push({
      turn: model.turns.length + 1,
      type: "style_vs_detail",
      style: styleDetailContradiction.style,
      detail: styleDetailContradiction.detail,
      note: `Style '${styleDetailContradiction.style}' conflicts with detail '${styleDetailContradiction.detail}'`,
    });
    model.unresolved_questions.push(`Style-detail conflict: '${styleDetailContradiction.style}' + '${styleDetailContradiction.detail}'. Which takes priority?`);
  }

  // 6b. Long-conversation compound accumulation — always run compound decomposition,
  //     write each concept-family preference even in short/compound turns.
  //     (already handled below via explicitPrefs merge)

  // 6. Merge into state
  //    Corrections OVERRIDE explicit preferences (and record the correction)
  //    Additions accumulate
  //    Exclusions BLOCK future silent additions of the excluded item
  for (const [k, v] of Object.entries(explicitPrefs)) {
    if (!v) continue;
    // Check if this contradicts an exclusion
    if (model.explicit_exclusions[k] && model.explicit_exclusions[k].includes(v)) {
      model.contradictions.push({
        turn: model.turns.length + 1,
        field: k,
        conflict: `Preference ${k}=${v} contradicts earlier exclusion`,
      });
      // Don't silently accept — mark as unresolved
      model.unresolved_questions.push(`Contradiction: earlier excluded ${k}=${v}, now stated as preference. Confirm?`);
      continue;
    }
    // Correction path
    if (isCorrection && model.explicit_preferences[k] && model.explicit_preferences[k] !== v) {
      model.corrections.push({
        turn: model.turns.length + 1,
        field: k,
        from: model.explicit_preferences[k],
        to: v,
      });
      model.explicit_preferences[k] = v;
      // A correction on field k resolves any prior contradictions on that field —
      // the customer has now stated the current intent.
      model.contradictions = model.contradictions.filter((c) => c.field !== k);
      model.unresolved_questions = model.unresolved_questions.filter((q) => !q.includes(k));
    }
    // Normal add / override on same field with different value
    else if (!model.explicit_preferences[k]) {
      model.explicit_preferences[k] = v;
    } else if (model.explicit_preferences[k] !== v) {
      // Same field, different value, no correction signal.
      // Only treat as a real contradiction if the utterance is a DECLARATIVE preference statement
      // ("modern" / "traditional balustrade") — not descriptive language ("traditional oak on the treads").
      // Style words appearing alongside a timber word are treated as descriptive.
      const isDescriptive = k === "style" && (
        explicitPrefs.timber_species ||
        /\b(?:oak|pine|walnut|mahogany|maple|beech|ash|cherry)\s+(?:on|treads|handrail|for|steps)\b/i.test(utteranceText) ||
        /\b(?:traditional|modern|contemporary|classical)\s+(?:oak|pine|walnut|mahogany|maple|beech|ash|cherry)\b/i.test(utteranceText)
      );
      const isDeclarativePref = ["preference_statement", "refinement_correction"].includes(d.utterance_function);
      if (!isDescriptive && isDeclarativePref) {
        model.contradictions.push({
          turn: model.turns.length + 1,
          field: k,
          previous: model.explicit_preferences[k],
          new: v,
          note: "no correction signal — ambiguous whether change or addition",
        });
        model.unresolved_questions.push(`Change or addition? ${k} was ${model.explicit_preferences[k]}, now ${v}?`);
      }
      // Descriptive or non-declarative — keep the prior value silently.
    }
  }

  // 7. Merge inferred preferences (never override explicit)
  for (const [k, info] of Object.entries(inferredPrefs)) {
    if (!model.explicit_preferences[k]) {
      model.inferred_preferences[k] = info;
    }
  }

  // 8. Merge exclusions
  for (const [k, values] of Object.entries(exclusions)) {
    model.explicit_exclusions[k] = model.explicit_exclusions[k] || [];
    for (const v of values) {
      if (!model.explicit_exclusions[k].includes(v)) model.explicit_exclusions[k].push(v);
    }
    // If an existing preference matches the exclusion, correct/remove it
    if (model.explicit_preferences[k] && values.includes(model.explicit_preferences[k])) {
      model.corrections.push({
        turn: model.turns.length + 1,
        field: k,
        from: model.explicit_preferences[k],
        to: null,
        note: "explicitly excluded",
      });
      delete model.explicit_preferences[k];
      // Explicit exclusion also resolves prior contradictions on this field.
      model.contradictions = model.contradictions.filter((c) => c.field !== k);
    }
  }

  // 9. Merge constraints (from decomposition — construction is a constraint)
  if (d.preferences.construction) {
    model.explicit_constraints.construction = d.preferences.construction;
  }
  if (d.retention_constraint) {
    model.explicit_constraints.scope = "refacing";
  }
  // 9b. Promote inferred scope=refacing to a CONSTRAINT.
  //     Reasoning: when a customer says "keep the existing X" / "update the look" / "modernise the balustrade" /
  //     "old pine spindles" — these are high-confidence retention signals that come from INFERRED_SIGNALS.scope.
  //     Refacing scope is a critical constraint (it changes what NEX offers), so promoting inferred→constraint
  //     is the right behaviour rather than leaving it in inferred_preferences.
  //     (Weak style/timber inferences stay in inferred_preferences per constitutional rule.)
  if (inferredPrefs.scope && inferredPrefs.scope.value === "refacing") {
    if (model.explicit_constraints.scope !== "refacing") {
      model.explicit_constraints.scope = "refacing";
    }
  }

  // 10. Concepts visited
  for (const c of d.all_concepts) model.concepts_visited.add(c);

  // 11. Current subject (from primary concept)
  if (d.primary_concept && d.primary_concept !== "unclassified") {
    model.current_subject = d.primary_concept;
  }

  // 12. Latest instruction
  model.latest_instruction = utteranceText;

  // 13. References
  for (const r of refs) model.conversation_references.push({ ...r, turn: model.turns.length + 1 });

  // 14. Record turn
  model.turns.push({
    text: utteranceText,
    decomp: d,
    was_correction: isCorrection,
    exclusions_added: Object.keys(exclusions),
    references_used: refs.map((r) => r.ref_type),
  });

  // 15. If the customer signalled a correction ("actually", "sorry, I mean", "not X — Y")
  //     but no tracked field flipped, still record it — the correction happened even if the
  //     specific target ("bare metal" / "newel cap type") isn't a first-class state field.
  //     This keeps NEX honest that "the customer just corrected themselves" is a real event.
  const priorCorrectionsThisTurn = model.corrections.filter((c) => c.turn === model.turns.length).length;
  if (isCorrection && priorCorrectionsThisTurn === 0) {
    model.corrections.push({
      turn: model.turns.length,
      field: "acknowledged_correction",
      note: `Correction signal detected in: "${utteranceText}"`,
    });
  }

  return model;
}

// ---------- Extract exclusions ----------
// Recognises rejection language across balusters / finishes / timber / style / newel-cap details.
// Every phrase must be a REAL customer rejection — not an ambient use of the word "no".
function extractExclusions(text) {
  const out = {};
  const noMatchers = [
    // Balustrade materials
    { pattern: /\bno\s+glass\b/i, field: "balustrade_material", value: "glass" },
    { pattern: /\bdon.?t\s+want\s+glass\b/i, field: "balustrade_material", value: "glass" },
    { pattern: /\bnot glass\b/i, field: "balustrade_material", value: "glass" },
    { pattern: /\brather (?:have|do|use) (?:than )?glass\b/i, field: "balustrade_material", value: "glass" },
    { pattern: /\bhad glass.*rather\b/i, field: "balustrade_material", value: "glass" },
    { pattern: /\bglass.*i.?d rather (?:have )?metal\b/i, field: "balustrade_material", value: "glass" },
    { pattern: /\bi.?d rather (?:have )?metal\b/i, field: "balustrade_material", value: "glass" },
    { pattern: /\brather metal\b/i, field: "balustrade_material", value: "glass" },
    { pattern: /\bno\s+metal\b/i, field: "balustrade_material", value: "metal" },
    { pattern: /\bnot\s+metal\b/i, field: "balustrade_material", value: "metal" },
    { pattern: /\bforget\s+(?:the\s+)?metal\b/i, field: "balustrade_material", value: "metal" },
    { pattern: /\bdon.?t\s+(?:want|like)\s+(?:the\s+)?metal\b/i, field: "balustrade_material", value: "metal" },
    { pattern: /\bno\s+matt[- ]?black\b/i, field: "balustrade_material", value: "matt_black_metal" },
    { pattern: /\bnot\s+matt[- ]?black\b/i, field: "balustrade_material", value: "matt_black_metal" },
    { pattern: /\bno\s+brushed\s+stainless\b/i, field: "balustrade_material", value: "brushed_stainless" },
    { pattern: /\bno\s+turned\s+spindles?\b/i, field: "balustrade_material", value: "turned_timber" },
    // Finishes
    { pattern: /\bno\s+carpet\b/i, field: "finish", value: "carpet" },
    { pattern: /\bdon.?t\s+want\s+carpet\b/i, field: "finish", value: "carpet" },
    { pattern: /\bnot carpet\b/i, field: "finish", value: "carpet" },
    { pattern: /\bno\s+runner\b/i, field: "finish", value: "runner" },
    // Timber species
    { pattern: /\bno\s+oak\b/i, field: "timber_species", value: "oak" },
    { pattern: /\bno\s+walnut\b/i, field: "timber_species", value: "walnut" },
    { pattern: /\bno\s+pine\b/i, field: "timber_species", value: "pine" },
    // Scope
    { pattern: /\bdon.?t\s+replace\b/i, field: "scope", value: "full_replacement" },
    { pattern: /\bdon.?t\s+rip\b/i, field: "scope", value: "full_replacement" },
    { pattern: /\bwithout\s+replacing\b/i, field: "scope", value: "full_replacement" },
    { pattern: /\bwithout\s+a\s+full\s+replacement\b/i, field: "scope", value: "full_replacement" },
    { pattern: /\bnot\s+looking\s+to\s+replace\b/i, field: "scope", value: "full_replacement" },
    // Style rejections
    { pattern: /\bno\s+modern\b/i, field: "style", value: "modern" },
    { pattern: /\bnot\s+modern\b/i, field: "style", value: "modern" },
    { pattern: /\bpure\s+victorian\b/i, field: "style", value: "modern" },
    { pattern: /\bno\s+modern\s+touches?\b/i, field: "style", value: "modern" },
    { pattern: /\bpure\s+traditional\b/i, field: "style", value: "modern" },
    { pattern: /\btoo\s+traditional\b/i, field: "style", value: "traditional" },
    { pattern: /\btoo\s+victorian\b/i, field: "style", value: "traditional" },
    { pattern: /\btoo\s+modern\b/i, field: "style", value: "modern" },
    { pattern: /\btoo\s+minimalist\b/i, field: "style", value: "modern" },
    { pattern: /\btoo\s+architect(?:y)?\b/i, field: "construction", value: "cantilever" },
    // Preserve intent (newel / structure retention)
    { pattern: /\bdon.?t\s+remove\s+the (?:existing )?newel/i, field: "newel_caps", value: "remove" },
    { pattern: /\bkeep the (?:existing )?newels?\b/i, field: "newel_caps_action", value: "remove" },
    { pattern: /\bkeep\s+the\s+(?:existing\s+)?volute\b/i, field: "starting_step_action", value: "remove" },
    // Construction rejections
    { pattern: /\bcantilever\s+(?:is\s+)?too\s+/i, field: "construction", value: "cantilever" },
    { pattern: /\bmight\s+be\s+too\s+architect/i, field: "construction", value: "cantilever" },
  ];
  for (const m of noMatchers) {
    if (m.pattern.test(text)) {
      out[m.field] = out[m.field] || [];
      if (!out[m.field].includes(m.value)) out[m.field].push(m.value);
    }
  }
  return out;
}

// ---------- Style-vs-detail contradiction ----------
// Detects when a customer states a style that conflicts with a specific detail preference.
// E.g. "modern minimalist" + "volute" · "modern" + "turned spindles" · "traditional" + "cable rail".
const STYLE_DETAIL_CONFLICTS = [
  { style_re: /\b(?:modern|minimalist|contemporary|architect)\b/i, detail_re: /\bvolute\b/i, note: "modern styles don't typically use volute (traditional scroll)" },
  { style_re: /\b(?:modern|minimalist|contemporary)\b/i, detail_re: /\bturned spindles?\b/i, note: "modern styles don't typically use turned spindles" },
  { style_re: /\bminimalist\b/i, detail_re: /\bcurtail\b/i, note: "minimalist doesn't fit with curtail (traditional decorative starting step)" },
  { style_re: /\bminimalist\b/i, detail_re: /\bornament\b/i, note: "minimalist excludes ornament by definition" },
  { style_re: /\btraditional\b/i, detail_re: /\bcable rail\b/i, note: "cable rail is modern-industrial, not traditional" },
  { style_re: /\btraditional\b/i, detail_re: /\bcantilever\b/i, note: "cantilever is modern-architectural, not traditional" },
  { style_re: /\bindustrial\b/i, detail_re: /\bturned spindles?\b/i, note: "industrial style doesn't use turned spindles" },
  { style_re: /\bcottage\b/i, detail_re: /\bcantilever\b/i, note: "cottage doesn't fit cantilever/floating construction" },
  { style_re: /\bscandi(?:navian)?\b/i, detail_re: /\bvolute\b/i, note: "Scandinavian is minimal, doesn't use volute" },
];
function detectStyleDetailContradiction(text, model) {
  // Only flag a real style-vs-detail conflict when BOTH sides are actual established state,
  // not word-mentions from questions or comparisons. Word-scanning the whole conversation
  // history produced false positives (e.g. "Traditional bullnose?" polluting a modern staircase).
  const establishedStyle = (model.explicit_preferences.style || "").toLowerCase();
  if (!establishedStyle) return null;
  const currentTextLower = text.toLowerCase();
  for (const c of STYLE_DETAIL_CONFLICTS) {
    // The established style must match the conflict's style regex.
    if (!c.style_re.test(establishedStyle)) continue;
    // The detail must appear in the CURRENT turn (or be an established construction/detail).
    const detailInText = c.detail_re.test(currentTextLower);
    const detailInEstablished =
      c.detail_re.test((model.explicit_preferences.balustrade_material || "").toLowerCase()) ||
      c.detail_re.test((model.explicit_constraints.construction || "").toLowerCase()) ||
      c.detail_re.test((model.explicit_preferences.starting_step_type || "").toLowerCase());
    if (!detailInText && !detailInEstablished) continue;
    const already = model.contradictions.some((k) => k.type === "style_vs_detail" && k.style === establishedStyle && c.detail_re.test(k.detail || ""));
    if (!already) {
      const detailMatch = c.detail_re.exec(currentTextLower) || c.detail_re.exec((model.explicit_constraints.construction || "").toLowerCase()) || ["(established)"];
      return { style: establishedStyle, detail: detailMatch[0], note: c.note };
    }
  }
  return null;
}

// ---------- Extract inferred preferences ----------
function extractInferredPreferences(text) {
  const out = {};
  for (const [field, signals] of Object.entries(INFERRED_SIGNALS)) {
    for (const s of signals) {
      if (s.signal.test(text)) {
        out[field] = { value: s.inferred, reason: s.reason, source_text: text };
        break;
      }
    }
  }
  return out;
}

// ---------- Detect references ----------
function detectReferences(text, model) {
  const refs = [];
  for (const p of REFERENCE_PATTERNS) {
    if (p.re.test(text)) {
      // Try to resolve — heuristic: pick the most-recent turn's primary concept
      const resolveAgainst = model.turns.length ? model.turns[model.turns.length - 1].decomp.primary_concept : null;
      refs.push({ ref_type: p.ref_type, referring_to: resolveAgainst || "unresolved" });
    }
  }
  return refs;
}

// ---------- Query the state ----------
export function summariseState(model) {
  return {
    goal: model.customer_goal || "not_yet_established",
    current_subject: model.current_subject,
    constraints: model.explicit_constraints,
    explicit_preferences: model.explicit_preferences,
    inferred_preferences: model.inferred_preferences,
    exclusions: model.explicit_exclusions,
    confirmed_decisions: model.confirmed_decisions,
    unresolved_questions: model.unresolved_questions,
    corrections: model.corrections,
    references: model.conversation_references,
    latest_instruction: model.latest_instruction,
    concepts_visited: [...model.concepts_visited],
    contradictions: model.contradictions,
  };
}

// ---------- Check whether NEX should ask for clarification vs answer ----------
export function shouldClarify(model, utterance) {
  // 1. If the current turn contradicts state, ASK
  if (model.contradictions.length > 0) return { clarify: true, reason: "contradiction_detected", detail: model.contradictions[model.contradictions.length - 1] };
  // 2. If there are unresolved questions, ASK
  if (model.unresolved_questions.length > 0) return { clarify: true, reason: "unresolved_question", detail: model.unresolved_questions[model.unresolved_questions.length - 1] };
  // 3. If the utterance uses a reference we couldn't resolve, ASK
  const lastTurn = model.turns[model.turns.length - 1];
  if (lastTurn && lastTurn.references_used.length && !model.turns.slice(0, -1).length) {
    return { clarify: true, reason: "unresolvable_reference", detail: lastTurn.references_used[0] };
  }
  // 4. If the LAST turn's decomposition returned Ambiguous tier + no established state that resolves it, ASK
  if (lastTurn && lastTurn.decomp.tier === "Ambiguous") {
    // Check whether existing state already resolves what makes it ambiguous
    // Heuristic: if we have zero explicit preferences AND the utterance is Ambiguous, we definitely need to ask
    const hasEstablishedState = Object.keys(model.explicit_preferences).length > 0 ||
                                 Object.keys(model.explicit_constraints).length > 0;
    if (!hasEstablishedState) {
      return { clarify: true, reason: "ambiguous_utterance_no_state", detail: lastTurn.text };
    }
    // If state exists but the ambiguous phrase is a broad style/scope word, still ask
    const broadAmbiguity = /\b(fancy|nice|nicer|open|less crowded|make it feel|feel more open|update the look)\b/i.test(lastTurn.text);
    if (broadAmbiguity) return { clarify: true, reason: "ambiguous_broad_signal", detail: lastTurn.text };
  }
  return { clarify: false };
}
