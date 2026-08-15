// ADR-0044 V1 · Step 2 · LOCAL response layer (Ollama).
//
// Same input/output contract as the quarantined OpenRouter version:
//   renderReply({state, customerMessage, topK, responseFrame, nextLikelyIntents, model, maxTokens})
//   → { text, latency_ms, model, tokens_prompt, tokens_completion, cost_usd, finish_reason }
//
// Provider: Ollama running on localhost:11434 (started by Ollama Desktop for
// Windows / macOS / Linux). Runs entirely on your machine. No external API
// calls. NEX brain decides WHAT to say; this local model turns it into
// natural prose. Cost per turn: $0.
//
// Rules baked into this module:
//   - Local endpoint only. If NEX_LOCAL_LLM_URL is set it must be a
//     localhost / 127.0.0.1 / .local address; anything else fails loudly.
//   - Never writes to store, state, memory, or knowledge graph.
//   - Never fabricates facts outside the packet.
//   - Ollama is the runtime, not the AI. Swappable via env NEX_RESPONSE_MODEL.
//     Later we can replace this file with respond-llamacpp.mjs or
//     respond-vllm.mjs behind the same dispatcher.

import { findLockedTerms } from './terminology.mjs';

const DEFAULT_MODEL = process.env.NEX_RESPONSE_MODEL ?? 'qwen2.5:3b';
const DEFAULT_URL = process.env.NEX_LOCAL_LLM_URL ?? 'http://localhost:11434';
const CHAT_PATH = '/api/chat';

// Verify the URL is local (belt-and-braces on top of the architectural rule).
{
  const u = new URL(DEFAULT_URL);
  const host = u.hostname.toLowerCase();
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local');
  if (!local) {
    throw new Error(`respond-local: NEX_LOCAL_LLM_URL must be a local address (localhost / 127.0.0.1 / *.local). Got: ${host}. NEX has a zero-third-party-AI hard rule (2026-08-15).`);
  }
}

// System prompt · locks NEX voice + faithful rendering + hedging + ENGLISH ONLY.
// Explicit anti-echo rules and worked good/bad examples added because
// Qwen 3B was reproducing skeleton strings verbatim (2026-08-15 acceptance run).
const SYSTEM_PROMPT = `You are NEX, an advisor for a UK staircase business. The customer does not know trade terminology.

LANGUAGE: Reply in British English only. Never any other language.

HARD OUTPUT RULES (top priority — a violation is a failed reply):

1. NEVER copy the RESPONSE_FRAME labels verbatim.
   The labels "Acknowledge:", "Core answer head:", "Hedge line:", "Next ask:" are guidance for YOU.
   They must NEVER appear in the reply.
   The strings after those labels are drafts — you must REWRITE them in your own words.
   Do NOT paste the hedge line as-is. Do NOT paste the next-ask as-is.

2. NEVER ask about a fact already in ESTABLISHED FACTS.
   If the state says construction_context = against_wall, do not ask "is your staircase against a wall?".
   If the state says material_primary = oak, do not ask "which timber?".
   Use the fact, don't re-ask.

3. NEVER contradict what the customer just said.
   The most recent CUSTOMER MESSAGE always wins over stale state.
   If the customer says "back to oak" but state still says walnut, the customer is right; the state is stale.

4. NEVER invent facts.
   Use only the KNOWLEDGE PACKET items. No prices, no dimensions, no product names, no regulations that aren't in the packet.
   If the packet doesn't answer, say so honestly and ask one focused clarifying question.
   PRICES SPECIFICALLY: if PACKET_HAS_NO_PRICE_DATA is true, do NOT write any £ number, do NOT invent a range like "£5,000-£10,000", do NOT guess "around £2,500". Say plainly: "I don't have a firm figure yet — pricing depends on X, Y, Z." then ask ONE relevant clarifying question.

5. NEVER narrate a state change that didn't happen.
   If STATE_DELTA.noops is non-empty, the customer confirmed something already known — do NOT say "updating the assumption" or "swapping X for Y". Acknowledge naturally.
   If STATE_DELTA.changes is non-empty, phrase the acknowledgement using the exact "previous → new" values shown there.

6. IF THE CUSTOMER USED A REFERENCE ("that", "it", "this", "the other one", "them"),
   read REFERENCE_HINT — it resolves the reference from the state.
   Do NOT ask "what do you mean?" — resolve using the hint and continue.

7. CONVERSATIONAL / META MESSAGES — the customer is not talking staircases.
   If CONVERSATION_MODE=meta_greeting → reply warmly, brief ("Hi — how can I help?"), maybe mention you're the Summit assistant if relevant. Do NOT ask about the wall or open sides.
   If CONVERSATION_MODE=meta_presence → confirm you're here and ready. Do NOT force staircase advice.
   If CONVERSATION_MODE=meta_identity → say briefly you're the Summit staircase assistant. Do NOT reveal you're a specific AI model.
   If CONVERSATION_MODE=meta_smalltalk → respond warmly and turn back to how you can help.
   If CONVERSATION_MODE=backchannel → the customer just said "hmm" / "ok" / "yeah". Give a VERY short prompt back — one sentence, invite them to continue where you left off. Do NOT dump options or restart discovery.

8. ANTI-REPETITION (a violation is a failed reply).
   The RECENT_NEX_CLOSERS list shows patterns you have already used in the last 2 replies. You MUST vary your closing sentence type this turn.
   Explicitly forbidden if it appeared in the last 2 turns:
     - "would you like to explore price, installation, or a comparison?"
     - "would you like to explore [any noun list]?"
     - "which one do you prefer?"
     - "what do you think?"
   Alternatives · pick ANY variety you haven't used recently:
     - reflect only ("makes sense.") · no question
     - narrow specifically ("does this staircase carry any heavy traffic — kids, dogs, that sort of thing?")
     - offer ("I can show you a couple of examples if that helps")
     - handoff-soft ("if you'd like, one of the team can take you through this on a call")
     - silent-await ("understood — I'm here when you want to pick up the next step.")

9. THIN PACKET PLAYBOOK — if PACKET_HAS_NO_PRICE_DATA=true or KNOWLEDGE_PACKET is empty:
   Do NOT retreat to "would you like to explore ...". That's the AI tell.
   Instead say the honest thing:
     - "I don't have a firm figure yet — pricing depends on X, Y, Z."
     - "That's more detail than I have to hand — I can check with the team and come back to you."
     - "Want me to show you a couple of similar examples in our gallery?"
     - "If it's easier, someone from the team could ring you tomorrow to walk through it."

10. CALLBACK — if RECENT_ANCHORS is provided, briefly reference ONE anchor when natural (e.g. "given that Victorian house you mentioned"). Not every turn — only when it makes the reply feel more remembered. Do NOT force it.

11. EMOTIONAL REGISTER · read EMOTION and adjust TONE (not content):
    - EMOTION=apologetic → warm + reassuring: "No problem at all — happens all the time." Do NOT say "updating the assumption" (feels clinical).
    - EMOTION=frustrated → short + apologetic + offer a real out: "Sorry — let me try that again more clearly. Or if you'd rather, one of the team can pick this up on a call."
    - EMOTION=excited → match a note of energy briefly, then move on: "Nice — that'll work really well." Do NOT overshoot into fake enthusiasm.
    - EMOTION=uncertain → gentle + patient + offer options: "No rush — happy to talk you through the choice." Ask ONE thing at a time.
    - EMOTION=neutral → default measured tone.

12. MULTI-INTENT — SECONDARY_INTENTS lists additional asks the customer made in the same message. Address the primary first, then the secondary in ONE short follow-up sentence (or say "let me take those in two parts"). Do NOT drop the secondary — it's the "T16 handrail height + revert" failure mode.

13. HANDOFF — if HANDOFF_RECOMMENDED=true, this is the second turn NEX has been thin on. Offer a real handoff: "If it'd be easier, one of the team can ring you tomorrow and walk you through this properly." Do NOT hedge again.

VOICE RULES:
- Reason like a staircase expert. Communicate like a helpful human. Not like ChatGPT. Not like a search box. Not like an FAQ page.
- Keep replies SHORT — 1 to 3 sentences.
- Hedge: "commonly", "often", "one option". Never "always", "must", "requires".
- Never correct the customer's terminology; use their words back.
- Every recommendation is hedged and offers one alternative if possible.
- End with a targeted next question OR an invitation to narrow the choice OR a confirmation. Never a bare full-stop.

STAIRCASE TERMINOLOGY REMINDERS:
- "closed string" = smooth diagonal plank, tread ends hidden, has a base rail.
- "cut string" (a.k.a. "open string") = stepped top edge, tread ends visible, balusters land into treads.
- "open riser" = no vertical board between treads. DIFFERENT from "open string".

WORKED EXAMPLE OF WHAT NOT TO DO:
Bad reply (rule 1+2 violation): "This is a commonly-recommended option; other options exist depending on your specific setup. Is your staircase against a wall on one side, or open on both sides?"
Why bad: paraphrased the hedge line verbatim; asked about a fact the state already had.

WORKED EXAMPLE OF WHAT TO DO:
Good reply: "For a Victorian oak staircase against a wall, a closed string is often the natural choice — it gives that smooth diagonal side without the tread ends showing. If you'd rather see the tread ends step down as a feature, a cut string on the open side is the alternative. Which of those two directions appeals more?"
Why good: uses the state facts (Victorian, oak, against wall), gives one option and one alternative, hedges, ends with a targeted narrowing question.

OUTPUT: Return ONLY the customer-facing reply. No JSON, no headings, no meta-commentary, no thinking. One short natural British-English reply.`;

const _callLog = [];
export function getCallLog() { return _callLog.slice(); }
export function clearCallLog() { _callLog.length = 0; }

/**
 * Render one NEX reply via local Ollama.
 * Same signature as the quarantined OpenRouter renderReply.
 */
export async function renderReply({ state, customerMessage, topK, responseFrame, nextLikelyIntents, intent, secondaryIntents, emotion, referenceHint, packetFlags, model = DEFAULT_MODEL, maxTokens = 220, timeoutMs = 60000 }) {
  const packet = buildPacket({ state, customerMessage, topK, responseFrame, nextLikelyIntents, intent, secondaryIntents, emotion, referenceHint, packetFlags });
  const body = {
    model,
    stream: false,
    // Keep the model resident in VRAM for 30 minutes between messages
    // so the customer doesn't hit a cold reload mid-conversation.
    // Ollama default is 5m which is too short for a browsed-then-typed flow.
    keep_alive: '30m',
    options: {
      num_predict: maxTokens,
      temperature: 0.4,
      top_p: 0.9,
    },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: packet },
    ],
  };
  const url = DEFAULT_URL + CHAT_PATH;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const t0 = Date.now();
  let r, j, err;
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    j = await r.json();
  } catch (e) {
    err = e;
  } finally {
    clearTimeout(timer);
  }
  const latency_ms = Date.now() - t0;

  if (err || !r?.ok) {
    const errMsg = err ? String(err.message ?? err) : `Ollama ${r.status}: ${JSON.stringify(j).slice(0, 400)}`;
    _callLog.push({ at: new Date().toISOString(), provider: 'ollama-local', model, url, latency_ms, error: errMsg.slice(0, 400), packet_chars: packet.length });
    throw new Error(errMsg);
  }

  let text = j.message?.content?.trim() ?? '(empty reply)';

  // M1-6: post-generation length trim if Qwen overshoots the mode's shape.
  // Backchannel <=120c · meta <=200c · close <=100c · normal <=400c.
  const modeCap = intent?.slug === 'backchannel' ? 120
                : intent?.slug === 'close' ? 100
                : intent?.slug?.startsWith('meta_') ? 200
                : 400;
  if (text.length > modeCap) {
    // Trim at last sentence-ending punctuation before the cap
    const window = text.slice(0, modeCap);
    const lastEnd = Math.max(window.lastIndexOf('.'), window.lastIndexOf('?'), window.lastIndexOf('!'));
    text = lastEnd > modeCap * 0.5 ? window.slice(0, lastEnd + 1) : window.trim() + '…';
  }

  // Ollama returns duration nanoseconds — convert to ms for parity with hosted API shapes
  const load_ms = Math.round((j.load_duration ?? 0) / 1e6);
  const prompt_ms = Math.round((j.prompt_eval_duration ?? 0) / 1e6);
  const gen_ms = Math.round((j.eval_duration ?? 0) / 1e6);

  const entry = {
    at: new Date().toISOString(),
    provider: 'ollama-local',
    model: j.model ?? model,
    url,
    latency_ms,
    packet_chars: packet.length,
    reply_chars: text.length,
    tokens_prompt: j.prompt_eval_count ?? null,
    tokens_completion: j.eval_count ?? null,
    cost_usd: 0,           // local; explicit zero for the roll-up
    load_ms,
    prompt_eval_ms: prompt_ms,
    gen_ms,
    tok_per_sec: j.eval_count && j.eval_duration ? +(j.eval_count / (j.eval_duration / 1e9)).toFixed(1) : null,
    done_reason: j.done_reason ?? null,
    finish_reason: j.done_reason ?? null,
  };
  _callLog.push(entry);
  return { text, ...entry };
}

function buildPacket({ state, customerMessage, topK, responseFrame, nextLikelyIntents, intent, secondaryIntents, emotion, referenceHint, packetFlags }) {
  const isMeta = intent?.slug?.startsWith('meta_');
  const isBackchannel = intent?.slug === 'backchannel';
  const isClose = intent?.slug === 'close';
  const facts = Object.entries(state?.established_facts ?? {})
    .filter(([, v]) => v?.value != null)
    .map(([k, v]) => `${k}: ${v.value} (turn ${v.turn_established}, confidence ${v.confidence?.toFixed?.(2) ?? v.confidence})`)
    .join('\n');
  const focus = (state?.entities_in_focus ?? []).join(', ') || '(none yet)';
  const constraints = (state?.constraints ?? []).join(', ') || '(none)';
  const summaries = (state?.recent_turn_summaries ?? []).slice(-5).map((t) => `  ${t.turn_index}. ${t.speaker}: "${t.text_head}"`).join('\n') || '  (this is turn 1)';
  const knowledge = topK.slice(0, 6).map((k, i) => {
    const head = (k.answer_head || '').replace(/\s+/g, ' ').slice(0, 260);
    return `  [K${i + 1} · score ${k.score} · from ${k.source_batch} · entities ${(k.entities || []).slice(0, 5).join(',')}]\n     ${head}`;
  }).join('\n');
  const frame = responseFrame || {};
  // Meta / conversational / close / backchannel messages · compact packet · no staircase pressure.
  if (isMeta || isClose || isBackchannel) {
    const mode = isBackchannel ? 'backchannel' : (isClose ? 'close' : intent.slug);
    let guidance;
    if (isBackchannel) {
      const lastNexSummary = (state?.recent_turn_summaries ?? []).filter(s => s.speaker === 'nex').slice(-1)[0];
      guidance = `- The customer just said "${customerMessage.trim()}" — they're thinking / acknowledging.
- Reply in ONE short sentence. Under 120 characters. Just a light nudge.
- Do NOT restart discovery, do NOT dump options, do NOT ask "would you like to explore ...".
- Do NOT re-mention established facts (like "the wall" or "the oak") — that's condescending in a backchannel reply.
- Good examples: "Take your time." / "No rush." / "Say the word when you're ready." / "Anything I can clarify?"
- Bad examples: any sentence over 120 chars, or that mentions oak/walnut/wall/string.
- Reference where you left off if useful: last NEX message was "${(lastNexSummary?.text_head || '').slice(0, 100)}".`;
    } else if (isClose) {
      guidance = `- The customer is closing / thanking you. Reply briefly ("You're welcome"), offer a soft next-step ("anything else I can help with?") · do NOT dump more staircase specifics.`;
    } else {
      guidance = `- The customer is not talking about staircases yet — they're saying hi / checking you're there / asking who you are / small-talking.
- Do NOT ask about wall orientation, string type, material, or any staircase specifics.
- Do not reveal you're a specific AI model. You are the Summit staircase assistant.`;
    }
    return `CUSTOMER MESSAGE (respond to THIS):
"${customerMessage}"

CONVERSATION_MODE=${mode}
EMOTION=${emotion?.register ?? 'neutral'}

CONVERSATION SO FAR:
- Turn ${state?.turn_count ?? 0} · established facts: ${facts.replace(/\n/g, ' · ') || '(none yet — first meaningful exchange)'}

Rules for this reply:
${guidance}
- Adjust tone to EMOTION (apologetic → reassuring · frustrated → short + offer real help · excited → match briefly · uncertain → gentle · neutral → measured).
- 1 short British-English sentence, maybe 2 max.

Write the reply now.`;
  }

  // Assemble PACKET FLAGS the LLM should read before writing.
  const priceQueried = /price|cost|how\s+much|expensive|cheap|cheaper|budget|figure|ballpark|estimate|quote/i.test(customerMessage);
  // Only count as "having price data" if a SPECIFIC £ or $ NUMBER appears in
  // one of the TOP-3 retrieved items (peripheral £ mentions in a training
  // example like "Never quote a specific cost ('£2,500')" would otherwise
  // falsely disable the anti-fabrication flag · same class of bug we fixed
  // for the handoff strike counter).
  const packetHasSpecificPrice = /£\s*\d|\$\s*\d|\d+\s*(pounds|gbp)/i.test(
    (topK || []).slice(0, 3).map(k => k.answer_head || '').join(' ')
  );
  const flags = {
    PACKET_HAS_NO_PRICE_DATA: priceQueried && !packetHasSpecificPrice,
    ...(packetFlags || {}),
  };
  const stateDelta = state?.last_turn_state_delta ?? { changes: [], noops: [] };

  // Anti-repetition · list of NEX's recent closer patterns so the LLM can vary.
  const recentClosers = (state?.recent_closer_patterns ?? []).slice(-2);
  const closerBanList = recentClosers.map(c => c.pattern).filter(p => p && p !== 'none' && p !== 'reflect_only');
  const recentCloserSentences = recentClosers.map(c => c.sentence).filter(Boolean);

  // Callback anchors · 2-3 earlier facts NEX can naturally reference.
  // M1-1: also SUPPRESS anchors if the last 2 NEX turns already used a
  // callback pattern ("Given the X you mentioned"). Even every-3rd-turn
  // rate-gating wasn't enough because the model latched onto the pattern.
  const anchors = [];
  const turnMod = ((state?.turn_count ?? 0) % 3 === 0);
  const recentReplies = (state?.recent_turn_summaries ?? []).filter(s => s.speaker === 'nex').slice(-2);
  const recentUsedCallback = recentReplies.some(r =>
    /(given|for|since|back to|as you)\s+(the|your|that)\s+[a-z]+\s+you\s+(mentioned|said|noted|chose|described|picked)/i.test(r.text_head || '')
  );
  if (turnMod && !recentUsedCallback && (state?.turn_count ?? 0) >= 4) {
    const f = state.established_facts ?? {};
    if (f.material_primary?.value) anchors.push(`the ${f.material_primary.value} you mentioned`);
    if (f.style_intent?.value) anchors.push(`the ${f.style_intent.value} direction`);
    if (f.construction_context?.value) anchors.push(`the ${f.construction_context.value.replace(/_/g, ' ')} constraint`);
  }

  // KNOWLEDGE_PACKET_EMPTY flag helps the LLM pick the thin-packet playbook.
  const packetIsThin = topK.length === 0 || (topK.length <= 2 && topK.every(k => (k.answer_head || '').length < 40));

  // Order matters: CUSTOMER MESSAGE first · PACKET FLAGS · ESTABLISHED FACTS
  // · RECENT TURNS · KNOWLEDGE PACKET · anti-repetition guard LAST.
  // SKELETON HINT section removed 2026-08-15 (A5): Qwen 3B now ignores it
  // after the anti-echo prompt lock, so it was only noise in the packet.
  const secondaryList = (secondaryIntents ?? []).map(si => `${si.slug}${si.source_part ? ` ("${si.source_part.slice(0, 60)}")` : ''}`).join(' · ') || '(none · single intent)';

  // M1-4: LOCKED_TERMINOLOGY block · injected when the customer is asking
  // for a definition of a load-bearing term (base rail, closed vs cut,
  // open riser, handrail height, etc.).
  let lockedTermBlock = '';
  if (intent?.slug === 'ask_definition') {
    const hits = findLockedTerms(customerMessage);
    if (hits.length) {
      lockedTermBlock = `\nLOCKED_TERMINOLOGY (canonical · MUST paraphrase · NEVER contradict):\n` +
        hits.map(h => `- ${h.slug} ("${h.alias_matched}"):\n    DEFINITION: ${h.definition}\n    COMMON WRONG: ${h.common_wrong}`).join('\n');
    }
  }

  // M1-5: SUMMARY_COMPARISON block · injected when the customer just gave
  // a multi-item spec summary and wants us to confirm. Pair their items
  // against state; list matches vs mismatches vs unknowns.
  let summaryComparisonBlock = '';
  if (intent?.slug === 'confirm_summary') {
    const cmp = compareSummaryAgainstState(customerMessage, state);
    summaryComparisonBlock = `\nSUMMARY_COMPARISON (customer just recapped their spec · here's what state agrees / disagrees with):\n` +
      `MATCHES (state confirms): ${cmp.matches.join(' · ') || '(none)'}\n` +
      `MISMATCHES (state has a different value): ${cmp.mismatches.join(' · ') || '(none)'}\n` +
      `UNTRACKED (state has no fact for these · confirm verbally): ${cmp.untracked.join(' · ') || '(none)'}\n\n` +
      `REPLY SHAPE: acknowledge what matches ("yes on the oak and the wall constraint"), gently flag any mismatch, and check anything in untracked. DO NOT restart discovery.`;
  }
  return `CUSTOMER MESSAGE (respond to THIS):
"${customerMessage}"

PACKET FLAGS (read before writing):
- PACKET_HAS_NO_PRICE_DATA: ${flags.PACKET_HAS_NO_PRICE_DATA}
- KNOWLEDGE_PACKET_EMPTY: ${packetIsThin}
- STATE_DELTA.changes: ${JSON.stringify(stateDelta.changes)}
- STATE_DELTA.noops: ${JSON.stringify(stateDelta.noops)}
- EMOTION: ${emotion?.register ?? 'neutral'}${emotion?.cues?.length ? ` (cues: ${emotion.cues.join(', ')})` : ''}
- SECONDARY_INTENTS: ${secondaryList}
- HANDOFF_RECOMMENDED: ${state?.handoff_recommended === true}
${referenceHint ? `- REFERENCE_HINT: ${referenceHint}` : '- REFERENCE_HINT: (none)'}
${state?.condensed_history ? `\nEARLIER IN THIS CONVERSATION (condensed): ${state.condensed_history.summary}` : ''}
${lockedTermBlock}${summaryComparisonBlock}

ESTABLISHED FACTS (already known · do NOT ask about these again):
${facts || '  (none yet · you may ask discovery questions)'}
Entities in focus: ${focus}
Constraints: ${constraints}
Current topic: ${state?.current_topic ?? '(none)'}
Stage: ${state?.stage ?? 'discover'}

RECENT TURNS (most-recent last):
${summaries}
${(() => {
  const isCorrectionTurn = intent?.slug === 'correct' && (stateDelta.changes?.length || stateDelta.noops?.length);
  if (!isCorrectionTurn) return '';
  const c = state?.corrections_log?.[state.corrections_log.length - 1];
  if (!c) return '';
  return `\nMOST RECENT CORRECTION (THIS TURN):
  - Was: "${c.previous}" · Now: "${c.new}" (this is the CURRENT choice)
  - If acknowledging: "switching from ${c.previous} to ${c.new}"`;
})()}

${state?.handoff_recommended ? `KNOWLEDGE PACKET (SUPPRESSED · HANDOFF MODE):
  This is the second consecutive turn NEX couldn't answer specifically. Do NOT dip
  back into staircase advice — the customer has now had two hedges in a row and
  needs a real out. Reply with EXACTLY this shape:
    - Brief acknowledgement of the specific question they asked
    - Honest "I don't want to guess figures — let me get you the right answer"
    - Concrete handoff offer using ONE of: "one of the team can ring you tomorrow morning" · "shall I book a quick call with a designer" · "I can pass this straight to Summit and they'll come back with a firm quote today"
    - Ask for the ONE piece of info needed to make the handoff (name + phone, or best time to call)
  Do NOT ask for wall/material/string type details — that's more hedging.
  Do NOT invent a price to fill the gap.
` : `KNOWLEDGE PACKET (top ${topK.length} retrieved · use ONLY these):
${knowledge || '  (empty · trigger THIN PACKET PLAYBOOK — honest "I don\'t have that yet" + a real next-action)'}`}

${anchors.length ? `RECENT_ANCHORS · earlier facts you can naturally reference back to:
- ${anchors.join('\n- ')}
Callback style · use ONE phrase like "given ${anchors[0]}" or "for ${anchors[0]}" or "back to ${anchors[0]}" somewhere in the reply so the conversation feels remembered. Only if it fits naturally.

` : ''}
RECENT_NEX_CLOSERS (patterns you already used · MUST vary this turn):
${closerBanList.length ? closerBanList.map(p => `- ${p}`).join('\n') : '- (none · anything appropriate)'}
${recentCloserSentences.length ? `Recent NEX closing sentences to NOT repeat:\n${recentCloserSentences.map(s => `  · "${s}"`).join('\n')}` : ''}

RECENT_NEX_OPENERS (opening patterns you already used · MUST NOT repeat this turn):
${(() => {
  const recentOpeners = (state?.recent_opener_patterns ?? []).slice(-2);
  const bans = recentOpeners.map(o => o.pattern).filter(p => p && p !== 'other' && p !== 'none');
  if (!bans.length) return '- (none · any opener fine)';
  const openerExamples = recentOpeners.map(o => `  · "${o.opener}"`).join('\n');
  return bans.map(p => `- ${p}`).join('\n') + '\nAvoid re-using these exact opening phrases:\n' + openerExamples;
})()}

Write ONE short British-English NEX reply now.
Do NOT reproduce any recent closer pattern above.
Do NOT ask about any ESTABLISHED FACT already listed.
${flags.PACKET_HAS_NO_PRICE_DATA ? `!!! ABSOLUTE RULE FOR THIS TURN !!!  PACKET_HAS_NO_PRICE_DATA=true. Your reply MUST NOT contain any £ figure, any $ figure, any "around £", any "starts from", any "£X to £Y" range, or any number-plus-currency. If you feel yourself about to write a price · STOP · replace it with: "I don't want to guess figures — I can get you an accurate quote once we've talked through the specifics. What sort of size is your staircase, roughly?" This is non-negotiable.
` : ''}${state?.handoff_recommended ? `!!! HANDOFF MODE THIS TURN !!!  Use the HANDOFF-shape reply exactly as specified in the packet above · brief acknowledge + honest "let me get you the right answer" + concrete handoff offer + ask for name/phone. Do NOT dip back into staircase advice.
` : ''}If KNOWLEDGE_PACKET_EMPTY is true, use the thin-packet playbook (honest "don't have that yet" + real next-action, not "would you like to explore ...").`;
}

/**
 * Compare the customer's summary text against the state's established facts.
 * Returns { matches, mismatches, untracked } string arrays.
 * matches = summary item that state confirms
 * mismatches = state has a DIFFERENT value for the same field
 * untracked = state has no fact for this field · verbally check
 */
function compareSummaryAgainstState(summaryText, state) {
  const matches = [];
  const mismatches = [];
  const untracked = [];
  const facts = state?.established_facts ?? {};
  const lower = (summaryText || '').toLowerCase();

  // Material
  const materialWords = ['oak', 'walnut', 'ash', 'pine', 'beech', 'maple', 'sapele', 'iroko', 'glass', 'metal'];
  const mentionedMaterials = materialWords.filter(m => new RegExp(`\\b${m}\\b`, 'i').test(lower));
  if (mentionedMaterials.length) {
    const stateMat = facts.material_primary?.value;
    for (const m of mentionedMaterials) {
      if (stateMat === m) matches.push(`material=${m}`);
      else if (stateMat && stateMat !== m) mismatches.push(`customer said ${m}, state has ${stateMat}`);
    }
    if (!stateMat) untracked.push(`material (${mentionedMaterials.join('/')})`);
  }

  // Construction constraint
  if (/against (a |the )?wall/i.test(lower)) {
    if ((state?.constraints || []).includes('against_wall')) matches.push('against_wall');
    else if ((state?.constraints || []).some(c => c === 'both_sides_open')) mismatches.push('customer said against wall, state has both sides open');
    else untracked.push('against_wall constraint');
  }
  if (/both sides open|freestanding/i.test(lower)) {
    if ((state?.constraints || []).includes('both_sides_open')) matches.push('both_sides_open');
    else if ((state?.constraints || []).includes('against_wall')) mismatches.push('customer said both sides open, state has against_wall');
    else untracked.push('both_sides_open constraint');
  }

  // Style
  const styleWords = ['traditional', 'contemporary', 'modern', 'transitional'];
  const mentionedStyles = styleWords.filter(s => new RegExp(`\\b${s}\\b`, 'i').test(lower));
  if (mentionedStyles.length) {
    const stateStyle = facts.style_intent?.value;
    for (const s of mentionedStyles) {
      const norm = s === 'modern' ? 'contemporary' : s;
      if (stateStyle === norm) matches.push(`style=${norm}`);
      else if (stateStyle && stateStyle !== norm) mismatches.push(`customer said ${s}, state has ${stateStyle}`);
    }
    if (!stateStyle) untracked.push(`style (${mentionedStyles.join('/')})`);
  }

  // String type · closed / cut
  if (/\bclosed string\b/i.test(lower)) {
    const focus = state?.entities_in_focus || [];
    if (focus.includes('closed_string')) matches.push('closed_string');
    else untracked.push('closed_string mention');
  }
  if (/\bcut string\b|\bopen string\b/i.test(lower)) {
    const focus = state?.entities_in_focus || [];
    if (focus.includes('cut_string')) matches.push('cut_string');
    else untracked.push('cut_string mention');
  }

  // Any specific mm handrail height
  const hrMatch = lower.match(/(\d{3,4})\s*(mm|millim)/i);
  if (hrMatch) {
    const value = parseInt(hrMatch[1], 10);
    if (value >= 900 && value <= 1000) matches.push(`handrail height ${value}mm (within UK Approved Doc K)`);
    else mismatches.push(`handrail height ${value}mm is outside UK Approved Doc K 900-1000mm range`);
  }

  // Starting-step feature
  for (const feat of ['bullnose', 'curtail', 'volute']) {
    if (new RegExp(`\\b${feat}\\b`, 'i').test(lower)) {
      if ((state?.entities_in_focus || []).includes(feat)) matches.push(`starting_step=${feat}`);
      else untracked.push(`${feat} starting step`);
    }
  }

  return { matches, mismatches, untracked };
}

export const _internals = { DEFAULT_MODEL, DEFAULT_URL, SYSTEM_PROMPT, buildPacket, compareSummaryAgainstState };
