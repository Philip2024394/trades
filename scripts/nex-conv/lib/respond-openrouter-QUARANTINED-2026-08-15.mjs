// ADR-0044 V1 · Step 2 · LLM response layer.
// Turns the structured `response_frame` + state + retrieved knowledge into
// natural-language prose in NEX's advisor voice.
//
// ==========================================================================
// HAIKU IS A RENDERER, NOT THE BRAIN.  (Philip · 2026-08-15 · LOCKED)
// ==========================================================================
// This module MUST NOT:
//   - create or modify knowledge items
//   - create graph relationships / edges
//   - modify conversation state
//   - write to memory / the knowledge graph
//   - override retrieval
//   - invent staircase facts
//   - make knowledge decisions
//   - promote draft knowledge
//   - perform pipeline enrichment
//
// Architectural enforcement: this file only READS the packet it is given
// and RETURNS a text string. It has no reference to the store, no import
// of writeKnowledgeItem/writeEdge/upsertState, no side effects. The
// pipeline decides WHAT to say (retrieval + state + graph). Haiku only
// decides HOW to say it naturally.
// ==========================================================================
//
// - Provider: OpenRouter (already-connected key).
// - Model: Claude Haiku 4.5 (default · configurable via env NEX_RESPONSE_MODEL).
// - Small controlled packet only. NEVER the whole database.
// - Voice rules from conversational-intelligence/README.md + recommendation-voice.md.

const DEFAULT_MODEL = process.env.NEX_RESPONSE_MODEL ?? 'anthropic/claude-haiku-4.5';
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions';

// System prompt · locks NEX voice + faithful rendering + hedging language.
// Embeds the load-bearing rules from the conversational-intelligence layer.
const SYSTEM_PROMPT = `You are NEX, an advisor for a UK staircase business. You are speaking to a customer who does not know trade terminology.

VOICE RULES (LOCKED · from the NEX conversational-intelligence framework):
- Reason like a staircase expert. Communicate like a helpful human. Not like ChatGPT. Not like a search box. Not like an FAQ page.
- Keep replies short — 1 to 4 sentences typically. Never a wall of text.
- Always hedge: use "commonly", "often", "one option" — never "always", "must", "requires".
- Never correct the customer's terminology out loud; use their words back.
- Every recommendation is hedged and offers alternatives.
- End with either a targeted next question, an invitation to narrow the choice, or a confirmation option — never a bare full-stop.

FAITHFULNESS (LOCKED · this is a hard rule):
- Use ONLY the facts inside the KNOWLEDGE PACKET section below. Do not add outside knowledge.
- If the packet does not answer the customer's question, say so honestly and ask a clarifying question.
- Never fabricate a specification, a price, a dimension, a regulation, or a product name that is not in the packet.
- If you reference a fact, it must be grounded in the packet.

CONVERSATION STATE:
- The STATE section carries what NEX has already established across earlier turns.
- Prefer the state's facts over guessing. Do not restate obvious things the state already contains — just continue naturally.

STRUCTURE:
- The RESPONSE_FRAME is a suggested skeleton (acknowledge · core answer · hedge · next ask). Use it as guidance, not a template to be echoed. Write real prose, not a form.

STAIRCASE-DOMAIN TERMINOLOGY (short reminders):
- "closed string" = smooth diagonal plank, tread ends hidden, has base rail with balusters into it.
- "cut string" (= "open string") = stepped top edge, tread ends visible, balusters land into treads, no base rail on flight.
- "open riser" = no vertical board between treads (different concept from "open string").
- Never conflate "open string" with "open riser".

OUTPUT: return only the customer-facing reply. No JSON, no headings, no thinking-out-loud, no meta commentary.`;

/**
 * Render one NEX reply.
 * @param {object} args
 * @param {object} args.state             — current conversation state
 * @param {string} args.customerMessage   — the current turn
 * @param {object[]} args.topK            — retrieved knowledge items (from processTurn)
 * @param {object} args.responseFrame     — structured skeleton (from processTurn)
 * @param {string[]} args.nextLikelyIntents
 * @param {string} [args.model]           — OpenRouter model slug
 * @param {number} [args.maxTokens]       — response cap
 * @returns {Promise<{text, latency_ms, usage, model, tokens_prompt, tokens_completion, cost_usd}>}
 */
// Session-scoped in-memory call log — cheap, no DB coupling.
// A caller can read `getCallLog()` at end of run to persist observability.
const _callLog = [];
export function getCallLog() { return _callLog.slice(); }
export function clearCallLog() { _callLog.length = 0; }

export async function renderReply({ state, customerMessage, topK, responseFrame, nextLikelyIntents, model = DEFAULT_MODEL, maxTokens = 220, timeoutMs = 20000 }) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('renderReply: OPENROUTER_API_KEY not set');
  const packet = buildPacket({ state, customerMessage, topK, responseFrame, nextLikelyIntents });
  const body = {
    model,
    max_tokens: maxTokens,
    temperature: 0.4, // NEX voice is measured; low-ish temperature
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: packet },
    ],
  };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const t0 = Date.now();
  let r, j, err;
  try {
    r = await fetch(OR_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.OPENROUTER_API_KEY,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://asknexapp.com',
        'X-Title': 'NEX Conversation Learning V1',
      },
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
    const errMsg = err ? String(err.message ?? err) : `OpenRouter ${r.status}: ${JSON.stringify(j).slice(0, 400)}`;
    // Log the error for the observability roll-up; do NOT silently succeed.
    _callLog.push({ at: new Date().toISOString(), model, latency_ms, error: errMsg.slice(0, 400), packet_chars: packet.length });
    throw new Error(errMsg);
  }

  const text = j.choices?.[0]?.message?.content?.trim() ?? '(empty reply)';
  const entry = {
    at: new Date().toISOString(),
    model: j.model ?? model,
    latency_ms,
    packet_chars: packet.length,
    reply_chars: text.length,
    tokens_prompt: j.usage?.prompt_tokens ?? null,
    tokens_completion: j.usage?.completion_tokens ?? null,
    cost_usd: j.usage?.cost ?? null,
    finish_reason: j.choices?.[0]?.finish_reason ?? null,
  };
  _callLog.push(entry);
  return { text, ...entry };
}

function buildPacket({ state, customerMessage, topK, responseFrame, nextLikelyIntents }) {
  const facts = Object.entries(state?.established_facts ?? {})
    .filter(([, v]) => v?.value != null)
    .map(([k, v]) => `${k}: ${v.value} (turn ${v.turn_established}, confidence ${v.confidence?.toFixed?.(2) ?? v.confidence})`)
    .join('\n');
  const focus = (state?.entities_in_focus ?? []).join(', ') || '(none yet)';
  const constraints = (state?.constraints ?? []).join(', ') || '(none)';
  const summaries = (state?.recent_turn_summaries ?? []).slice(-5).map((t, i) => `  ${t.turn_index}. ${t.speaker}: "${t.text_head}"`).join('\n') || '  (this is turn 1)';

  const knowledge = topK.slice(0, 6).map((k, i) => {
    const head = (k.answer_head || '').replace(/\s+/g, ' ').slice(0, 260);
    return `  [K${i + 1} · score ${k.score} · from ${k.source_batch} · entities ${(k.entities || []).slice(0, 5).join(',')}]\n     ${head}`;
  }).join('\n');

  const frame = responseFrame || {};
  return `CUSTOMER MESSAGE:
"${customerMessage}"

CONVERSATION STATE:
- Current topic: ${state?.current_topic ?? '(none)'}
- Current intent: ${state?.current_intent?.slug ?? '(none)'}
- Established facts:
${facts || '  (none yet)'}
- Entities in focus: ${focus}
- Constraints: ${constraints}
- Stage: ${state?.stage ?? 'discover'}
- Recent turns:
${summaries}
${state?.corrections_log?.length ? `- Corrections log (most recent first): ${JSON.stringify(state.corrections_log.slice(-2))}` : ''}

KNOWLEDGE PACKET (top ${topK.length} retrieved · use ONLY these facts):
${knowledge || '  (no items retrieved · say so honestly and ask a clarifying question)'}

SUGGESTED RESPONSE_FRAME (skeleton · rewrite in your own words):
- Acknowledge: ${frame.acknowledge || '(nothing to acknowledge yet)'}
- Core answer head (top retrieved fact): ${frame.core_answer_head || '(no direct answer available)'}
- Hedge line: ${frame.hedge || 'This is one common option; other options exist depending on your specific setup.'}
- Next ask: ${frame.next_ask || '(none — you may choose one from the state)'}

CONVERSATION FLOW HINT:
- Likely next customer intents: ${(nextLikelyIntents || []).join(', ') || '(open)'}

Write ONE reply in NEX's voice, following all voice + faithfulness rules. Return only the reply text.`;
}

export const _internals = { DEFAULT_MODEL, SYSTEM_PROMPT, buildPacket };
