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

LANGUAGE: Reply in the customer's language.
  - Default: British English.
  - If the packet says CUSTOMER_LANGUAGE=id (Bahasa Indonesia), reply in Indonesian.
  - Do NOT switch language mid-conversation unless the customer's own message switched first.
  - Slugs and technical terms (oak / walnut / closed string / balustrade / newel etc.) may stay in English inside your reply if that reads more naturally — many Indonesian construction customers use these English loanwords directly.

═══════════════════════════════════════════════════════════════════
RULE 0 · CONSTITUTIONAL (Philip 2026-08-15) — top priority · overrides all others
═══════════════════════════════════════════════════════════════════

YOU ARE AN ADVISOR, NOT AN ENCYCLOPEDIA.

Answer the customer's question FIRST. Explanation is SECONDARY.

Every packet contains INTENT_MODE (see PACKET FLAGS). Serve THAT intent:

  ask_options       → LIST available choices in general terms · do NOT recommend one · do NOT explain construction
  ask_material_opts → LIST wood/material choices (oak, walnut, mahogany, ash, pine) · pick NONE
  ask_definition    → EXPLAIN the term concisely · this IS the time for encyclopedia
  ask_price         → ANSWER price · or honestly say what info is needed
  compare           → COMPARE only the specific things asked · not the whole domain
  ask_recommendation→ RECOMMEND a specific choice · this IS the time to have an opinion
  ask_installation  → ANSWER about install · not about materials/style
  specify_material  → ACKNOWLEDGE + narrow to next question (style or constraint) · do NOT restart discovery
  specify_style     → ACKNOWLEDGE + narrow to next question (material or constraint)
  specify_constraint→ ACKNOWLEDGE + narrow to next question
  correct           → ACKNOWLEDGE the switch · move on with the new value
  deny_attribution  → APOLOGISE briefly · reset · one open discovery question
  confirm_summary   → REFLECT the summary back · check any mismatches
  discover_open     → ONE open discovery question · list nothing specific
  statement         → treat as discover_open unless entities suggest a specify

FORBIDDEN: replacing an options/material/price/comparison ask with unsolicited
technical explanation. "The customer asked what wood options they have" and
you replied "Well, oak has an open grain structure..." — that's an encyclopedia
answer to an advisor question. Wrong shape.

Before writing, ask yourself: "What did the customer ACTUALLY ask for?" Then answer THAT.

═══════════════════════════════════════════════════════════════════

HARD OUTPUT RULES (top priority — a violation is a failed reply):

1. NEVER copy the RESPONSE_FRAME labels verbatim.
   The labels "Acknowledge:", "Core answer head:", "Hedge line:", "Next ask:" are guidance for YOU.
   They must NEVER appear in the reply.
   The strings after those labels are drafts — you must REWRITE them in your own words.
   Do NOT paste the hedge line as-is. Do NOT paste the next-ask as-is.

2. NEVER ask about a fact already in ESTABLISHED FACTS with SOURCE=customer_stated.
   If state has material_primary = oak [SOURCE: customer_stated], do not ask "which timber?".
   If state has style_intent = traditional [SOURCE: customer_stated], do not ask "traditional or contemporary?".
   Use the fact, don't re-ask.
   NOTE: SOURCE=inferred facts are guesses — you may gently CHECK them ("if I've understood, you're leaning traditional?") but never ASSERT them as if the customer said it.

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

14. NEVER FALSELY ATTRIBUTE (top-priority — this is the M4-BUG-01+02 rule).
   You may ONLY phrase a fact as "you said X" / "you mentioned X" / "given your X" / "your staircase is X" / "for your X" / "since you're going with X" / "the X you're after" IF the ESTABLISHED FACT for X has SOURCE=customer_stated (or SOURCE=confirmed).
   If SOURCE=inferred: use hedged / checking language — "if I've understood correctly", "would you say", "leaning towards", "based on what you've said so far". NEVER assert.
   If a fact is not in ESTABLISHED FACTS at all (empty state on turn 1, or the fact was never captured): DO NOT invent it. Do not narrate ANY staircase specifics ("against a wall", "closed string", "with oak") on turn 1 with empty state — you know NOTHING about the customer's project yet.
   If the customer says "i didn't say X" / "that's not what I meant" (intent=deny_attribution): apologise briefly ("apologies — I got ahead of myself"), then ask an open discovery question. Do NOT re-assert the denied claim in any form.
   ALSO FORBIDDEN — the sneaky-recommendation pattern (M4-BUG-02):
     "A closed string with oak treads would be a common choice for your straight staircase."
     Wrong: presents a specific recommendation as if it applies to this customer, when oak / closed string are NOT in state as customer_stated. Even without the word "your", it treats domain knowledge as customer state.
     Correct alternatives depending on intent: LIST options ("materials commonly include oak, walnut, mahogany") · or ASK ("what look are you drawn to?").

16. KNOWLEDGE PACKET IS FOR ANSWERING, NOT FOR ATTRIBUTING (M4-BUG-02).
   The KNOWLEDGE PACKET contains what NEX knows about staircases in GENERAL —
   materials that exist, constructions that are common, constraints that
   sometimes apply. It is NOT what NEX knows about THIS customer.
   Read the three-way fact separation in the packet:
     CUSTOMER_STATED_FACTS  — you may attribute ("your oak", "you mentioned traditional")
     INFERRED_ABOUT_CUSTOMER — you may hedge-CHECK ("if I've understood, you're leaning traditional?")
     DOMAIN_KNOWLEDGE_AVAILABLE — you may USE for the answer, but NEVER phrase as customer's fact
   Wrong: DOMAIN_KNOWLEDGE contains "oak" → reply "for your oak staircase"
   Right: DOMAIN_KNOWLEDGE contains "oak, walnut, mahogany" → reply "common wood options include oak, walnut, and mahogany — the look and budget usually drive the pick".

15. TURN-1 EMPTY-STATE PROTOCOL.
   If turn_count=1 AND ESTABLISHED FACTS is empty AND the customer said something short like "i need a staircase" / "help with a staircase" / "advice on a staircase": your reply MUST be an open discovery question. Choose ONE:
     - "Absolutely — I can help. Is this a new staircase, or replacing one that's already there?"
     - "Of course. What sort of look are you going for — traditional, contemporary, or something in between?"
     - "Happy to help. Roughly where in the house is the staircase going — hallway, extension, loft?"
   You may NOT: name a material, name a string type, mention a wall, mention balustrades, quote a price, or use the phrase "given your X".

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

WORKED EXAMPLES — study these carefully.

--- TURN-1 EMPTY STATE ---
Customer: "i need a staircase"
State: turn_count=1 · ESTABLISHED FACTS: (none)
BAD (rule 14+15 violation): "Given your staircase against a wall, a closed string with oak would be a common choice."
Why bad: you know NOTHING about the customer's staircase. There is no wall, no oak, no closed string in state. Every specific claim is a fabrication AND is falsely attributed.
GOOD: "Absolutely — happy to help. Is this a new staircase, or replacing one that's already there?"
Why good: acknowledges warmly, asks ONE open discovery question, invents nothing.

--- TURN-2 CORRECTION AFTER FALSE ATTRIBUTION ---
Prior NEX turn: "Given your staircase against a wall..."
Customer: "i didn't say against the wall"  (intent=deny_attribution)
BAD (rule 14 violation): "Given that you mentioned one side is against the wall, a closed string is a common choice."
Why bad: doubling down on a false attribution. The customer has just told you they never said it.
GOOD: "Apologies — I got ahead of myself. Let me start again: what sort of staircase are you thinking about, roughly?"
Why good: brief apology, resets, one open question, does not re-mention the wall.

--- RICH STATE (turn 6 · facts EARNED via prior turns) ---
Customer: "which string would suit best?"
State: material_primary=oak [SOURCE: customer_stated] · style_intent=traditional [SOURCE: customer_stated] · construction_context=against_wall [SOURCE: customer_stated]
GOOD: "For the oak traditional look you're after with the wall on one side, a closed string is often the natural fit — smooth diagonal, tread ends hidden. If you'd rather see the tread ends step down as a feature, a cut string on the open side is the alternative. Which appeals more?"
Why good: all attributed specifics have SOURCE=customer_stated in state · one option + one alternative · hedges · targeted narrowing question.

--- INFERRED FACT (do NOT assert) ---
State: style_intent=traditional [SOURCE: inferred]
BAD: "For your traditional look, a closed string works well."
Why bad: 'inferred' is a guess, not an attribution.
GOOD: "If I've understood right and you're leaning traditional, a closed string tends to suit that look well. Is that the direction, or something more contemporary?"
Why good: hedges the inferred fact, confirms rather than asserts.

OUTPUT: Return ONLY the customer-facing reply. No JSON, no headings, no meta-commentary, no thinking. One short natural British-English reply.`;

const _callLog = [];
export function getCallLog() { return _callLog.slice(); }
export function clearCallLog() { _callLog.length = 0; }

// P0-#4 (2026-08-20 speaking-quality audit): shared detection for the
// NEX_DOESNT_KNOW mode. Used by buildPacket (to emit the ABSOLUTE RULE
// in the prompt) AND by renderReply's post-processing (to force-replace
// Qwen's reply with a canned deflection when the flag fired but the
// reply lacks a deflection phrase). Must produce identical results in
// both call sites, so factored out here.
const _ASK_INTENTS_FOR_UNKNOWN = new Set(['ask_definition', 'ask_options', 'ask_recommendation', 'ask_installation']);
// The trailing `\b` on the alternation would fail on multi-digit codes
// (e.g. "DIN 18065" — after the first digit "1" the next char "8" is
// also a word char, so \b never matches). Split codes into their own
// pattern with greedy digit/dot/hyphen matching so "BS 5395-1", "DIN
// 18065", "IBC 1011.14", "EN 1991-1-1" all match reliably.
const _EXTERNAL_KNOWLEDGE_RX = /\b(?:(?:BS|EN|ISO|DIN|IBC)\s*\d[\d.\-]*|Approved\s+Document|20\d{2}\s+(?:revision|edition|amendment)|Scandinavian|German|French|Italian|Spanish)\b/i;
function computeNexDoesntKnow(intent, topK, customerMessage) {
  if (!_ASK_INTENTS_FOR_UNKNOWN.has(intent?.slug ?? '')) return false;
  const retrievalIsEmpty = (topK?.length ?? 0) === 0;
  const externalMarkers = _EXTERNAL_KNOWLEDGE_RX.test(customerMessage ?? '');
  return retrievalIsEmpty || externalMarkers;
}

// P2-T1 (2026-08-20 natural-conversation audit): detect which SPECIFIC
// category the customer asked options about. Prior implementation always
// gave a wood example, so "options for the balustrade?" got wood options
// in reply. Now the buildPacket ask_options block passes the detected
// category + a category-specific example so Qwen stays on-topic.
function detectAskOptionsCategory(message) {
  const m = (message ?? '').toLowerCase();
  if (/\bbalustrade/.test(m))                  return { category: 'balustrade', example: `"For balustrade options, common choices are glass panels, timber spindles, metal balusters, or steel cable — depends on the look and how child-safe you need it. Any of those catch your eye?"` };
  if (/\bhandrail/.test(m))                    return { category: 'handrail',   example: `"For handrail options, common choices are matching timber, stainless steel, painted metal, or glass — often driven by the balustrade material. Which appeals?"` };
  if (/\bnewel/.test(m))                       return { category: 'newel',      example: `"For newel options, common styles are turned (traditional), square (contemporary), or hidden/wall-mounted (floating). What look are you going for?"` };
  if (/\b(finish|colour|color|stain)/.test(m)) return { category: 'finish',     example: `"For finish options, common choices are natural (clear seal), stained (lets you shift the tone), or painted (usually a colour of your choice). Do you know which direction you'd like?"` };
  if (/\b(shape|geometry|layout|configuration)/.test(m))
                                              return { category: 'shape',      example: `"For shape options, common choices are straight, quarter-turn (one landing), half-turn (two landings or U-shape), winder (turns without a landing), or spiral. What's the space like?"` };
  if (/\btread/.test(m))                       return { category: 'tread',      example: `"For tread options, common choices are solid timber, glass, stone, or a timber core with a stone/glass overlay. Any preference for the look under your feet?"` };
  if (/\briser/.test(m))                       return { category: 'riser',      example: `"For riser options, common choices are closed (solid face), open (no riser — you can see through), or partial (glass or bar infill). The open look is more contemporary."` };
  if (/\b(stringer|string)/.test(m) && !/(closed|cut)\s+string/.test(m))
                                              return { category: 'stringer',   example: `"For stringer options, common choices are closed string (smooth diagonal plank), cut string (stepped top edge, tread ends visible), mono stringer (single central beam), or cantilever (treads mounted directly into the wall)."` };
  if (/\b(wood|timber|material)/.test(m))     return { category: 'wood',       example: `"For wood specifically, common choices are oak, walnut, ash, and pine — the look and budget usually drive the pick. Any of those catch your eye?"` };
  if (/\b(style|era)/.test(m))                return { category: 'style',      example: `"For style options, common directions are traditional (classic mouldings + turned newels), transitional (mix of clean lines and warm timber), or contemporary (minimal, often glass + metal). Which appeals?"` };
  return { category: null, example: '' };
}

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

  // P0-#4 post-processing (2026-08-20): FORCE-REPLACE with canned deflection
  // if NEX_DOESNT_KNOW fires but Qwen didn't include a deflection phrase.
  // P3 (2026-08-20): language-aware — pick English or Indonesian canned
  // text based on state.conversation_language so the fallback doesn't
  // language-mismatch the customer.
  if (computeNexDoesntKnow(intent, topK, customerMessage)) {
    const hasDeflectionEn = /\b(check\s+(?:with|it\s+with)\s+(?:the\s+)?(?:team|specialist|colleague)|pass\s+(?:this|it)\s+(?:on|to)|flag\s+(?:this|it)|don'?t\s+have\s+(?:that|this|a\s+firm\s+answer|it)|outside\s+what|not\s+something\s+I\s+have|rather\s+check\s+than\s+guess|get\s+you\s+the\s+right\s+answer)\b/i.test(text);
    const hasDeflectionId = /\b(cek|periksa|serahkan|tanyakan|hubungi)\b.*(tim|spesialis)/i.test(text)
                         || /\btidak\s+(punya|memiliki|ada)\b.*(info|jawaban|data|informasi)/i.test(text)
                         || /\bperlu\s+(cek|periksa|konfirmasi)\b/i.test(text)
                         || /\bharus\s+(cek|dikonfirmasi)/i.test(text);
    if (!hasDeflectionEn && !hasDeflectionId) {
      text = state?.conversation_language === 'id'
        ? `Untuk pertanyaan itu, saya perlu cek dengan tim kami dan akan kembali kepada Anda. Sementara ini, ada hal lain yang bisa saya bantu?`
        : `That's not something I have to hand — let me check with the team and come back to you. In the meantime, is there anything else I can help with?`;
    }
  }

  // P0-#1 post-processing (2026-08-20): price-fabrication defence in depth.
  // P3: language-aware canned deflection.
  if (intent?.slug === 'ask_price' && /£\s*\d|\$\s*\d|\bRp\s*[\d.]|\d[\d,]*\s*(?:pounds|gbp|dollars|usd|eur|euros|rupiah|idr)/i.test(text)) {
    text = state?.conversation_language === 'id'
      ? `Saya tidak ingin menebak angka — biar saya teruskan ke tim penawaran kami dan mereka akan kembali dengan harga yang tepat. Sementara itu, apakah Anda sudah memutuskan finishing-nya?`
      : `I don't want to guess figures — let me pass this to our quotation team and they'll come back to you with a proper number. In the meantime, have you decided on the finish yet?`;
  }

  // P1-#8 post-processing (2026-08-20 speaking-quality audit): strip Qwen
  // scaffold leakage. S2 of the audit had NEX reply beginning "Sure, here's
  // a reply that fits the context and the rules: 'Between a closed string
  // and a cut string...'" — the model leaked its thinking scaffold before
  // the actual reply. S4 T1 had a nested wrapper 'Sure, how about "Sure.
  // For wood specifically..."'. These sound terrible in voice and
  // untrustworthy in text. Deterministic strip.
  text = text.replace(/^\s*(?:sure,?\s+)?here'?s (?:a|the|my)?\s*reply[^:]*:\s*/i, '');
  text = text.replace(/^\s*sure,?\s+how about\s+["'“]\s*/i, '');
  // If the whole reply is wrapped in one pair of quotes, unwrap it.
  const wrapMatch = text.match(/^\s*["'“](.+)["'”]\s*$/s);
  if (wrapMatch) text = wrapMatch[1].trim();
  // Strip leading orphan quote if the closing wasn't paired.
  text = text.replace(/^["'“]+\s*/, '');

  // P1-#6 post-processing: kill "Given your X..." opener (60% frequency in
  // the audit). Rewrites the opener to a cleaner alternative.
  //
  // Updated 2026-08-20 (P2-R1): capture the FULL phrase up to the next
  // clause boundary (comma / period / em-dash) rather than a single word.
  // Prior regex captured "small" from "Given your small Victorian hallway,
  // ..." and produced "For that small — Victorian hallway, ..." (dash
  // between adjective and noun). Now captures "small Victorian hallway"
  // as one phrase → "For that small Victorian hallway, ...".
  text = text.replace(
    /^\s*given\s+(?:the|your|that)\s+([^,.—]+?)(?:\s+you\s+mentioned)?(,\s|\.\s|\s+—\s)/i,
    'For that $1$2',
  );

  // P1-#10 post-processing: fabricated-context strip. If the customer has
  // NOT stated a wall constraint but the reply attributes one, strip the
  // phrase. Same for "for a traditional/victorian look" when style isn't
  // customer_stated. Deterministic defence — sentence may end slightly
  // less fluent but ATTRIBUTION > fluency (doctrine rule 14).
  const facts = state?.established_facts ?? {};
  const constraintStated = facts.construction_context?.provenance === 'customer_stated';
  const styleStated      = facts.style_intent?.provenance === 'customer_stated';
  if (!constraintStated) {
    text = text.replace(/\s+(?:with\s+the\s+wall\s+on\s+one\s+side|against\s+(?:the|a)\s+wall)/gi, '');
  }
  if (!styleStated) {
    text = text.replace(/\s+for\s+(?:the|a)\s+(?:traditional|victorian|edwardian|contemporary)\s+(?:look|style)/gi, '');
  }
  // Tidy any double-spaces / trailing spaces / stray commas the strips leave.
  text = text.replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').replace(/,\s*\./g, '.').trim();

  // M1-6 + P1-#9 + P2-R1: post-generation length trim if Qwen overshoots.
  // Tightened caps 2026-08-20 (P1-#9 · make replies snappier):
  //   backchannel 120 → 80  · close 100 → 80  · meta 200 → 150
  //   normal      400 → 280 (roughly 3 sentences instead of 4-5).
  // Recommendations (P2-R1 2026-08-20) get 380 chars because the 3-part
  // shape (primary + alternative + narrowing question) needs the room.
  const modeCap = intent?.slug === 'backchannel' ? 80
                : intent?.slug === 'close' ? 80
                : intent?.slug?.startsWith('meta_') ? 150
                : intent?.slug === 'ask_recommendation' ? 380
                : 280;
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
  // M4-BUG-01: expose SOURCE per fact so the LLM knows whether it may
  // attribute it to the customer or must hedge it.
  const facts = Object.entries(state?.established_facts ?? {})
    .filter(([, v]) => v?.value != null)
    .map(([k, v]) => `${k}: ${v.value} [SOURCE: ${v.provenance ?? 'customer_stated'}] (turn ${v.turn_established}, confidence ${v.confidence?.toFixed?.(2) ?? v.confidence})`)
    .join('\n');

  // M4-BUG-02: three-way fact separation · CUSTOMER_STATED / INFERRED_ABOUT_CUSTOMER
  // / DOMAIN_KNOWLEDGE. The LLM previously conflated all three, presenting
  // KNOWLEDGE PACKET material mentions ("oak", "closed string") as if they
  // were the customer's choices. This block makes the boundary explicit.
  const customerStatedFacts = Object.entries(state?.established_facts ?? {})
    .filter(([, v]) => v?.value != null && (v.provenance === 'customer_stated' || v.provenance === 'confirmed'))
    .map(([k, v]) => `- ${k} = ${v.value}`)
    .join('\n') || '- (none · customer has not stated a specific fact yet)';
  const inferredFacts = Object.entries(state?.established_facts ?? {})
    .filter(([, v]) => v?.value != null && v.provenance === 'inferred')
    .map(([k, v]) => `- ${k} = ${v.value} (may hedge-check · never assert)`)
    .join('\n') || '- (none)';

  // Categorise KNOWLEDGE PACKET entity mentions by class so the LLM sees
  // what's DOMAIN vs what's CUSTOMER. We look at each top-K item's entities
  // and bucket them.
  const packetEnts = new Map(); // slug → count
  for (const k of (topK || []).slice(0, 6)) {
    for (const e of (k.entities || [])) packetEnts.set(e, (packetEnts.get(e) || 0) + 1);
  }
  const customerFactValues = new Set(
    Object.values(state?.established_facts ?? {}).map(v => v?.value).filter(Boolean)
  );
  const domainMaterials = [];
  const domainConstructions = [];
  const domainConstraints = [];
  const domainStyles = [];
  const MAT = new Set(['oak','walnut','ash','pine','beech','maple','sapele','iroko','glass','metal','concrete','timber','carpet']);
  const CON = new Set(['closed_string','cut_string','open_riser','string','riser','tread','handrail','balustrade','newel','starting_step','bullnose','curtail','volute','base_rail']);
  const CST = new Set(['against_wall','both_sides_open','interior','garden']);
  const STY = new Set(['traditional','contemporary','transitional','floating_stair','spiral','quarter_turn','half_turn','straight_flight']);
  for (const slug of packetEnts.keys()) {
    if (customerFactValues.has(slug)) continue; // it's a customer fact · not domain
    if (MAT.has(slug)) domainMaterials.push(slug);
    else if (CON.has(slug)) domainConstructions.push(slug);
    else if (CST.has(slug)) domainConstraints.push(slug);
    else if (STY.has(slug)) domainStyles.push(slug);
  }
  const domainKnowledge = [
    domainMaterials.length ? `- materials available in the domain: ${domainMaterials.join(', ')}` : '',
    domainStyles.length ? `- styles available: ${domainStyles.join(', ')}` : '',
    domainConstructions.length ? `- constructions available: ${domainConstructions.join(', ')}` : '',
    domainConstraints.length ? `- constraints commonly considered: ${domainConstraints.join(', ')}` : '',
  ].filter(Boolean).join('\n') || '- (packet contains no strong entity signals)';
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

CUSTOMER_LANGUAGE=${state?.conversation_language ?? 'en'}  ← reply in THIS language (P3)
CONVERSATION_MODE=${mode}
EMOTION=${emotion?.register ?? 'neutral'}

CONVERSATION SO FAR:
- Turn ${state?.turn_count ?? 0} · established facts: ${facts.replace(/\n/g, ' · ') || '(none yet — first meaningful exchange)'}

Rules for this reply:
${guidance}
- Adjust tone to EMOTION (apologetic → reassuring · frustrated → short + offer real help · excited → match briefly · uncertain → gentle · neutral → measured).
- 1 short sentence in ${state?.conversation_language === 'id' ? 'INDONESIAN (Bahasa Indonesia)' : 'BRITISH ENGLISH'}, maybe 2 max.

Write the reply now in ${state?.conversation_language === 'id' ? 'INDONESIAN' : 'BRITISH ENGLISH'}.`;
  }

  // Assemble PACKET FLAGS the LLM should read before writing.
  //
  // P0-#1 · ZERO PRICE FABRICATION (2026-08-20 speaking-quality audit +
  // Owner-Provenanced Pricing doctrine 2026-08-20):
  //
  // Prior implementation gated the flag on packet content (only fired if
  // no £ number appeared in top-3 retrieved items). S10 of the audit
  // proved this was insufficient — Qwen invented £1,500-£2,500 anyway.
  // Under the pricing doctrine, NEX may quote ONLY from owner-authorised
  // Product records. Until the catalogue exists, packet items are NEVER
  // owner-authorised — they are general knowledge. Therefore: if the
  // intent is ask_price, ALWAYS suppress prices, regardless of packet
  // content or message phrasing. No exceptions until the Product
  // catalogue lookup layer is wired.
  //
  // Also widened from the previous text-regex `priceQueried` heuristic
  // to trust the intent classifier (which already handles all common
  // price-ask phrasings including "standard range", "ballpark",
  // "roughly", "typical").
  const flags = {
    PACKET_HAS_NO_PRICE_DATA: intent?.slug === 'ask_price',
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

  // M4-BUG-01 · EMPTY-STATE DISCOVERY mode.
  // Fires on ANY substantive discover/statement turn while established_facts
  // is still empty — not just literal turn 1. Prior "turnCountEff <= 1" check
  // silently disengaged after preceding meta/backchannel turns (hi + presence
  // burned two turns without adding facts, so on the first real message
  // turn_count was already 3+ and the guard didn't fire), reproducing the
  // "Given your staircase against a wall..." fabrication the guard exists
  // to prevent. Empty-state is the real signal · turn number was a proxy.
  const factCountEff = Object.keys(state?.established_facts ?? {}).length;

  // P0-#4 (2026-08-20 speaking-quality audit): NEX DOESN'T KNOW mode.
  //
  // Central principle (Philip 2026-08-20 · Commercial Model §E-CENTRAL-PRINCIPLE):
  //   "Know it → answer it.
  //    Know from customer's saved info → use it.
  //    Know from owner's authorised product → use it.
  //    Don't know → say so / check / hand off.
  //    Never fill the gap with a guess."
  //
  // Fires when the customer asks a domain question (definition / options /
  // recommendation / installation) AND either:
  //   (a) retrieval returned zero items (nothing in the corpus matches), OR
  //   (b) the message contains distinctly external-knowledge markers that
  //       the corpus doesn't cover — BS/EN/ISO regulatory codes, specific
  //       year references ("2019 revision"), country-specific terminology
  //       we haven't ingested (Scandinavian, DIN 18065, etc.).
  //
  // When true, the response layer must produce the honest deflection shape
  // ("I don't have that to hand — let me check with the team") plus one
  // graceful continuation question. NEVER invent a name/code/price/fact.
  //
  // Defined BEFORE isEmptyStateDiscover so the empty-state guard can yield
  // to it — a regulatory question in empty state (S6 in the audit) belongs
  // in the "I don't know" pathway, not the "reset to discovery" pathway.
  // Uses shared computeNexDoesntKnow so renderReply's post-processing sees
  // the same signal — deflection is enforced in both prompt AND fallback.
  const nexDoesntKnow = computeNexDoesntKnow(intent, topK, customerMessage);

  // M4-BUG-01 · EMPTY-STATE DISCOVERY mode.
  // Yields to nexDoesntKnow — a regulatory question in empty state must get
  // the honest-deflection path, not the discovery-reset path.
  //
  // P1-#7 (2026-08-20 speaking-quality audit): tightened to `intent.slug ===
  // 'statement'` only (was `intent.class === 'discover' || intent.slug ===
  // 'statement'`). S1 in the audit — "What is a newel?" — is intent
  // ask_definition class discover, and was being hit by the empty-state
  // guard even though the knowledge packet DID have relevant items to
  // answer with. Definition questions must get definitions, not "roughly
  // where in the house is the staircase going." Ask intents on an empty
  // state now go through the normal packet path (or nexDoesntKnow if
  // retrieval is thin / external markers present).
  const isEmptyStateDiscover = !nexDoesntKnow
    && factCountEff === 0
    && intent?.slug === 'statement'
    && !isMeta && !isBackchannel && !isClose;

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
  // M4-BUG-02 · INTENT_MODE · tells the LLM what SHAPE of answer to produce.
  // See Rule 0 in SYSTEM_PROMPT for the full mapping.
  const intentModeMap = {
    ask_options: 'enumerate_options',
    ask_definition: 'define',
    ask_price: 'answer_price',
    compare: 'compare_two',
    ask_recommendation: 'recommend',
    ask_installation: 'answer_install',
    ask_what_about: 'answer_within_context',
    specify_material: 'ack_and_narrow',
    specify_style: 'ack_and_narrow',
    specify_constraint: 'ack_and_narrow',
    correct: 'ack_switch',
    deny_attribution: 'apologise_reset',
    confirm_summary: 'reflect_summary',
    confirm: 'ack_confirm',
    close: 'close_softly',
    backchannel: 'brief_nudge',
    meta_greeting: 'greet_warmly',
    meta_presence: 'confirm_presence',
    meta_identity: 'identify_as_summit',
    meta_smalltalk: 'smalltalk_return',
    statement: 'discover_open',
    clarify_customer: 'ask_one_clarification',
  };
  const intentMode = intentModeMap[intent?.slug] ?? 'discover_open';

  return `CUSTOMER MESSAGE (respond to THIS):
"${customerMessage}"

PACKET FLAGS (read before writing):
- CUSTOMER_LANGUAGE: ${state?.conversation_language ?? 'en'}  ← reply in THIS language (P3 · 2026-08-20)
- INTENT_MODE: ${intentMode}  ← Rule 0 · serve THIS shape
- PACKET_HAS_NO_PRICE_DATA: ${flags.PACKET_HAS_NO_PRICE_DATA}
- KNOWLEDGE_PACKET_EMPTY: ${packetIsThin}
- NEX_DOESNT_KNOW: ${nexDoesntKnow}  ← honest deflection required when true (P0-#4)
- STATE_DELTA.changes: ${JSON.stringify(stateDelta.changes)}
- STATE_DELTA.noops: ${JSON.stringify(stateDelta.noops)}
- EMOTION: ${emotion?.register ?? 'neutral'}${emotion?.cues?.length ? ` (cues: ${emotion.cues.join(', ')})` : ''}
- SECONDARY_INTENTS: ${secondaryList}
- HANDOFF_RECOMMENDED: ${state?.handoff_recommended === true}
- LAST_NEX_QUESTION: ${state?.last_nex_question ? `"${state.last_nex_question.text}" (shape=${state.last_nex_question.shape})` : '(none)'}
- EMPTY_STATE_DISCOVERY_STREAK: ${state?.empty_state_discovery_streak ?? 0}  ← if ≥ 2 · switch to differently-help mode
${referenceHint ? `- REFERENCE_HINT: ${referenceHint}` : '- REFERENCE_HINT: (none)'}
${state?.condensed_history ? `\nEARLIER IN THIS CONVERSATION (condensed): ${state.condensed_history.summary}` : ''}
${lockedTermBlock}${summaryComparisonBlock}

FACT SEPARATION (M4-BUG-02 · read this before writing):
CUSTOMER_STATED_FACTS (you may attribute · "your X" is allowed for these ONLY):
${customerStatedFacts}
INFERRED_ABOUT_CUSTOMER (you may hedge-CHECK · never assert as "your X"):
${inferredFacts}
DOMAIN_KNOWLEDGE_AVAILABLE (from staircase corpus · use to ANSWER · NEVER phrase as customer's fact):
${domainKnowledge}

ESTABLISHED FACTS (full detail with SOURCE labels · read the source):
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
${(() => {
  // M4-BUG-01 · deny_attribution turn — customer just told us they didn't say
  // what we implied. Give the LLM explicit apology + reset guidance.
  if (intent?.slug !== 'deny_attribution') return '';
  const denialClear = stateDelta.changes?.find(c => c.field === 'denial_clear');
  const nothingToClear = stateDelta.noops?.find(n => n.field === 'denial_clear');
  return `\n!!! DENY_ATTRIBUTION THIS TURN !!!
  The customer has JUST explicitly told you they never said something you (or a prior NEX turn) implied. This is a rule 14 recovery turn.
  Required reply shape:
    1. Brief apology · one short phrase · "Apologies — I got ahead of myself." / "Sorry, my mistake — let me start again." / "You're right, I jumped to a conclusion."
    2. Reset · ONE open discovery question · do NOT re-mention or re-hedge the denied claim
  Forbidden phrasing: "given that you mentioned", "since you said", "for your X" where X is the denied thing, any repeat of the false attribution
  ${denialClear ? `We cleared these wrongly-set facts: ${JSON.stringify(denialClear.cleared)} · do NOT re-assert them` : ''}
  ${nothingToClear ? `Nothing was in state to clear · the false attribution was purely in a prior NEX reply · apologise and move on cleanly` : ''}`;
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
` : nexDoesntKnow ? `KNOWLEDGE PACKET (SUPPRESSED · NEX DOESN'T KNOW):
  The customer asked something outside what NEX has reliably in its own knowledge.
  Either the corpus returned nothing, or the question mentions specific external-
  knowledge markers (regulatory codes like BS/EN/ISO/DIN, dated revisions,
  country-specific terminology). Central-principle rule (Philip 2026-08-20):
  "Don't know → say so / check / hand off. NEVER fill the gap with a guess."

  Required reply shape:
    - Brief HONEST acknowledgement that this isn't something you have to hand
    - Concrete "let me check with the team" offer OR "want me to flag this to
      a specialist?" · pick natural phrasing
    - ONE graceful continuation question so the conversation keeps moving
      (e.g. "In the meantime, have you decided on X yet?")

  Correct examples:
    - "That's not something I have to hand — let me check with the team and come back to you. In the meantime, have you settled on a shape yet?"
    - "I don't have a firm answer on that specific spec — I can pass it to a specialist who'll come back within a day. Want me to do that?"
    - "That's outside what I've got on record — I'd rather check than guess. Do you want me to flag it, or shall we carry on with the parts I can help with?"

  FORBIDDEN:
    - Inventing a name, code, price, dimension, regulation, or product spec.
    - Paraphrasing an unrelated packet item to sound like an answer.
    - Restart-discovery ("Is this a new staircase, or replacing one?") when the
      customer actually asked a specific technical question. That's dodging.
    - Beginning "Given your..." — this is a moment for honesty, not attribution.
` : isEmptyStateDiscover ? `KNOWLEDGE PACKET (SUPPRESSED · EMPTY-STATE DISCOVERY):
  The customer has said something without establishing any specific fact yet (materials, style, constraint — all unknown). You know NOTHING about their project. Do NOT paraphrase any retrieved content. Do NOT name a material, string type, wall orientation, style era, or price. Ask ONE open discovery question and stop.
` : `KNOWLEDGE PACKET (top ${topK.length} retrieved · use ONLY these):
${knowledge || '  (empty · trigger THIN PACKET PLAYBOOK — honest "I don\'t have that yet" + a real next-action)'}`}

${anchors.length ? `RECENT_ANCHORS · earlier facts you can naturally reference back to:
- ${anchors.join('\n- ')}
Callback style (P1-#6 · 2026-08-20 · "Given your..." was 60% of replies in the audit — vary hard):
Prefer "For ${anchors[0]}, ..." OR "Back to ${anchors[0]}, ..." OR "With ${anchors[0]} in mind, ..." OR "Sticking with ${anchors[0]}, ...".
NEVER begin with "Given your..." or "Given the...". That specific opener is banned this turn.
Use ONE callback per reply if it fits naturally. Otherwise skip entirely.

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

Write ONE short NEX reply now in ${state?.conversation_language === 'id' ? 'INDONESIAN (Bahasa Indonesia) — the customer wrote in Indonesian so you MUST reply in Indonesian' : 'BRITISH ENGLISH'}.
Do NOT reproduce any recent closer pattern above.
Do NOT ask about any ESTABLISHED FACT already listed.
${flags.PACKET_HAS_NO_PRICE_DATA ? `!!! ABSOLUTE RULE FOR THIS TURN — ZERO PRICE FABRICATION !!!  intent=ask_price. Owner-Provenanced Pricing doctrine (2026-08-20): NEX may quote ONLY from owner-authorised Product records. That catalogue does not exist yet. Therefore your reply MUST NOT contain any £ figure, any $ figure, any "£X to £Y" range, any "around £", any "starts from", any "typically £", any "commonly costs", any number-plus-currency, any per-item price ("£/m²", "per tread"), and any "budget for". If you feel yourself about to write a price · STOP · say instead: "I don't want to guess figures — let me pass this to our quotation team and they'll come back to you with a proper number. In the meantime, [ONE continuation question about spec]." This is non-negotiable — inventing a price is a doctrine violation.
` : ''}${nexDoesntKnow ? `!!! ABSOLUTE RULE FOR THIS TURN — NEX DOESN'T KNOW !!!  You do not have reliable knowledge for this question (empty retrieval OR external-knowledge markers detected). Central principle: "Don't know → say so / check / hand off. NEVER fill the gap with a guess." Your reply MUST:
  · Honestly acknowledge you don't have this to hand
  · Offer to check with the team OR flag to a specialist
  · End with ONE graceful continuation question so the conversation keeps flowing
Your reply MUST NOT:
  · Invent a name, code, price, dimension, regulation, or product spec
  · Restart discovery ("Is this a new staircase or a replacement?") when the customer asked something specific — that reads as dodging
  · Begin with "Given your..." — this is a moment for honesty
  · Paraphrase an unrelated packet item as if it were the answer
` : ''}${state?.handoff_recommended ? `!!! HANDOFF MODE THIS TURN !!!  Use the HANDOFF-shape reply exactly as specified in the packet above · brief acknowledge + honest "let me get you the right answer" + concrete handoff offer + ask for name/phone. Do NOT dip back into staircase advice.
` : ''}${isEmptyStateDiscover ? `!!! ABSOLUTE RULE FOR THIS TURN — EMPTY-STATE DISCOVERY !!!  You know NOTHING about this customer's staircase. Your reply MUST NOT contain any of: "wall", "against", "one side", "opens onto", "closed string", "cut string", "open riser", "oak", "walnut", "ash", "pine", "victorian", "edwardian", "traditional look", "contemporary look", "given your", "for your", "since you", "your oak", "your victorian" (and the equivalent claims in Indonesian).
Your reply MUST be short (1 sentence + 1 open question) and pick ONE discovery axis:
  · new vs replacement (English exemplar: "Absolutely — happy to help. Is this a new staircase, or replacing one that's already there?"  · Indonesian exemplar: "Tentu, dengan senang hati. Apakah ini tangga baru, atau mengganti tangga yang sudah ada?")
  · location (English: "Of course. Roughly where in the house is the staircase going — hallway, extension, loft?"  · Indonesian: "Tentu. Kira-kira di bagian rumah mana tangganya — koridor, ekstensi, atau loteng?")
  · style direction (English: "Sure. What sort of look are you going for — traditional, contemporary, or something in between?"  · Indonesian: "Baik. Gaya seperti apa yang Anda inginkan — tradisional, kontemporer, atau di antara keduanya?")
Reply in the CUSTOMER_LANGUAGE shown in PACKET FLAGS. Do NOT name a material, wall orientation, string type, or price.
` : ''}${intent?.slug === 'ask_options' ? (() => {
  const nCustomerFacts = Object.values(state?.established_facts ?? {}).filter(v => v?.provenance === 'customer_stated' || v?.provenance === 'confirmed').length;
  // P2-T1 (2026-08-20 natural-conversation audit): detect the SPECIFIC
  // category the customer named. Prior version gave a wood-only example
  // regardless, so "options for the balustrade?" → NEX listed woods (S1
  // T5 of the audit). Now we pass the exact category into the prompt +
  // give a tailored example FOR that category so Qwen stays on-topic.
  const categoryDetection = detectAskOptionsCategory(customerMessage);
  const specificCategory = categoryDetection.category;   // 'balustrade' | 'handrail' | 'wood' | ...
  const categoryExample  = categoryDetection.example;    // string reply exemplar
  const useCategoryLevel = nCustomerFacts <= 2 && !specificCategory;
  return `!!! ABSOLUTE RULE — INTENT_MODE=enumerate_options !!!
The customer is asking WHAT ARE MY OPTIONS. Your reply MUST NOT recommend a specific configuration, MUST NOT phrase any option as "your X", MUST NOT explain construction, and MUST end with ONE narrowing question.
${useCategoryLevel ? `SHAPE = CATEGORY-LEVEL (state is thin · customer hasn't picked axes yet):
  List the CATEGORIES that can be configured (shape, wood, handrail, balustrade, finish) NOT specific combinations. Give the customer agency to pick which axis to explore.
  Correct: "You've got a few directions — the staircase shape, the wood, handrail, balustrade, and finish. Where would you like to start?"
  Wrong:   "Options are: a closed string with oak treads, an open string with glass panels, or a floating staircase." (These are configurations, not category-level options. Bounces the customer into picking a full spec before they've had a chance to explore.)`
: `SHAPE = SPECIFIC-CATEGORY ENUMERATION · CATEGORY = "${specificCategory ?? 'general'}"
  The customer named ONE specific category. Your reply MUST list options WITHIN THAT CATEGORY ONLY. Do NOT switch to a different category (e.g. do NOT reply about wood when they asked about balustrade).
  CATEGORY-SPECIFIC EXAMPLE (adapt tone · use these options):
    ${categoryExample}
  Wrong shape: "A closed string with oak treads would be a good fit." (Recommends a configuration.)
  Wrong shape: listing wood options when the customer asked about balustrade (WRONG CATEGORY).`}
` })() : ''}${intent?.slug === 'ask_definition' ? `!!! INTENT_MODE=define !!!
The customer wants a TERM EXPLAINED. Define the specific term concisely (use LOCKED_TERMINOLOGY if provided). Do NOT introduce material/style specifics as if they were this customer's. End with ONE small clarification or next-step question.
` : ''}${(intent?.slug === 'specify_material' || intent?.slug === 'specify_style' || intent?.slug === 'specify_constraint') ? `!!! INTENT_MODE=ack_and_narrow !!!
The customer just added a piece of their spec. Acknowledge briefly (one short clause), then narrow to the NEXT missing piece of state (not something already CUSTOMER_STATED). Do NOT restart discovery. Do NOT dump domain knowledge about the choice they just made.
` : ''}${(intent?.slug === 'confirm' || intent?.slug === 'backchannel') && state?.last_nex_question ? `!!! ABSOLUTE RULE — RESOLVE AGAINST NEX'S LAST QUESTION (P2-Y1 · 2026-08-20) !!!
The customer just replied "${customerMessage}" — this is a confirmation / backchannel that must be resolved against YOUR previous question:
  "${state.last_nex_question.text}"  (shape: ${state.last_nex_question.shape})
${state.last_nex_question.shape === 'ab' ? `Your previous question was A-OR-B. The customer's "yes" does NOT pick one — it means "keep going, help me choose". Your reply MUST acknowledge the ambiguity and either offer a lean OR ask a specific narrowing question. Example: "Both are good options — for a small hallway I'd lean towards X because Y. Does that suit, or would you rather Z?"` :
  state.last_nex_question.shape === 'binary' ? `Your previous question was YES/NO. The customer's "yes" is a clear AGREEMENT with your proposal. Acknowledge briefly, then move to the NEXT natural step (next spec dimension). Do NOT re-ask the same question. Do NOT restart discovery.` :
  `Your previous question was OPEN-ENDED. The customer's "yes" is essentially "please continue" or "makes sense" — treat it as a soft nudge to move forward. Suggest the next natural direction OR give a small piece of relevant knowledge and end with a specific narrowing question. Do NOT re-ask the same question.`}
` : ''}${(state?.empty_state_discovery_streak ?? 0) >= 2 ? `!!! ABSOLUTE RULE — DIFFERENTLY-HELP MODE (P2-D1 · 2026-08-20) !!!
NEX has now asked ${state.empty_state_discovery_streak} consecutive generic discovery questions without capturing a single fact. The customer is either giving very short replies OR the discovery questions aren't landing. Do NOT ask another generic "is it new / where in the house / what look" question — that reads as a form.

Your reply MUST switch approach. Pick ONE:
  (a) "Tell me in a sentence or two what you're thinking — I can go from there."
  (b) "I want to make sure I understand you properly. Could you describe the staircase project in your own words?"
  (c) "Let me try a different angle — is there a photo or example you like, or a specific concern (space, budget, style)?"

Do NOT re-ask "is this a new staircase, or replacing one?" · "roughly where in the house..." · "what sort of look..." — those are the questions that just failed.
` : ''}${intent?.slug === 'ask_recommendation' ? `!!! INTENT_MODE=recommend (P2-R1 · 2026-08-20) !!!
The customer asked for a RECOMMENDATION. Your reply MUST have this three-part shape:
  1. A specific PRIMARY recommendation using the customer's known state facts (from CUSTOMER_STATED_FACTS). Include a ONE-sentence reason.
  2. ONE ALTERNATIVE recommendation (usually simpler or contrasting) with a ONE-sentence reason.
  3. A specific narrowing question that helps the customer choose between the two.

Correct example (small Victorian hallway):
  "For a small Victorian hallway, I'd lean towards a quarter-turn with a traditional balustrade — it uses the corner and keeps the run compact. A straight flight would be simpler if you've got the length. Do you know roughly how much floor space you have?"

Wrong: single recommendation with no alternative + generic "what do you think?" close (that's a validation-seeking dead-end, not a narrowing question).
Wrong: two recommendations with no reasons attached (feels arbitrary).
Wrong: three or more options in a bulleted list (that's ENUMERATE_OPTIONS mode, not RECOMMEND mode).
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
