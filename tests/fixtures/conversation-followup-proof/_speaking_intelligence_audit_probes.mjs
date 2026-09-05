// NEX Speaking Intelligence · Comprehensive Gap Audit · probe runner
// Philip 2026-09-05 · discovery-only · no source code changes.
//
// Fires controlled conversations against /api/nex-conv/chat covering
// the 26 audit categories. Captures reply + composition_meta for each
// turn. Writes JSON to _speaking_intelligence_audit_probes.json.

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const CHAT = "http://localhost:3008/api/nex-conv/chat";

async function post(convId, message, market = "ID") {
  const t0 = Date.now();
  try {
    const r = await fetch(CHAT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: convId, message, market }),
    });
    const j = await r.json();
    return { ok: r.ok, latency_ms: Date.now() - t0, ...j };
  } catch (err) {
    return { ok: false, latency_ms: Date.now() - t0, error: String(err) };
  }
}

function digest(j) {
  const cm = j.composition_meta || {};
  return {
    intent: j.intent,
    reply: (j.reply || "").slice(0, 250),
    voice_intent: j.voice_reply?.intent,
    voice_en: (j.voice_reply?.en || "").slice(0, 200),
    current_reference: j.current_reference,
    world_cards_count: j.world_cards?.count ?? j.world_cards?.cards?.length ?? 0,
    composition_ran: cm.ran,
    composition_accepted: cm.accepted,
    composition_reason: cm.reason,
    composition_knowledge_count: cm.knowledge_count,
    ordinal_gate_fired: cm.ordinal_gate_fired,
    result_followup_fired: cm.result_followup_fired,
    hydration_reason: cm.hydration_reason,
    latency_ms: j.latency_ms,
  };
}

const audit = { runAt: new Date().toISOString(), categories: [] };

async function probe(categoryLabel, description, turns) {
  const cid = randomUUID();
  const record = { category: categoryLabel, description, conversation_id: cid, turns: [] };
  console.log(`\n═══ ${categoryLabel} ═══`);
  console.log(`  ${description}`);
  for (const [i, t] of turns.entries()) {
    const j = await post(cid, t.msg, t.market || "ID");
    const d = digest(j);
    record.turns.push({ turn: i + 1, question: t.msg, expected_gap: t.expect, ...d });
    console.log(`  T${i + 1} "${t.msg}"`);
    console.log(`      → ${JSON.stringify(d.reply?.slice(0, 150))}`);
  }
  audit.categories.push(record);
}

// ═════════════ CATEGORY 1 · QUESTION WORDS ═════════════
await probe("01 · question-words · English",
  "Test each of what/where/when/why/how/who/which independently.",
  [
    { msg: "what is Yogyakarta?",           expect: "definition/description response" },
    { msg: "when is peak tourist season?",  expect: "temporal answer or honest 'I don't know'" },
    { msg: "why do people visit Bali?",     expect: "reasoning response" },
    { msg: "how do I book a hotel?",        expect: "procedural response" },
    { msg: "who owns this hotel?",          expect: "identity or honest boundary" },
    { msg: "which hotel is best for families?", expect: "comparative response" },
  ]);

// ═════════════ CATEGORY 2 · QUESTION WORDS · Indonesian ═════════════
await probe("02 · question-words · Indonesian",
  "Same probes in Bahasa Indonesia.",
  [
    { msg: "apa itu Yogyakarta?" },
    { msg: "dimana hotel terdekat?" },
    { msg: "bagaimana cara memesan hotel?" },
    { msg: "kenapa banyak turis ke Bali?" },
  ]);

// ═════════════ CATEGORY 3 · PRONOUNS / REFERENCE ═════════════
await probe("03 · pronouns/reference · deictic + anaphoric",
  "Multi-turn: establish entity then use it/this/that/them/those.",
  [
    { msg: "find me a hotel in Yogyakarta" },
    { msg: "tell me more about it" },
    { msg: "and this one?" },
    { msg: "what about those?" },
  ]);

// ═════════════ CATEGORY 4 · VERBS + VERB RELATIONSHIPS ═════════════
await probe("04 · verbs · basic action + cognition",
  "Verbs from the owner-supplied lexicon in natural sentences.",
  [
    { msg: "I want to eat somewhere good" },
    { msg: "I don't understand what you mean" },
    { msg: "can you show me hotels?" },
    { msg: "I love this place" },
  ]);

// ═════════════ CATEGORY 5 · TENSE / ASPECT ═════════════
await probe("05 · tense/aspect · past · present · future · perfect",
  "Tense variations of essentially the same request.",
  [
    { msg: "I visited Yogyakarta last year" },
    { msg: "I am visiting Yogyakarta tomorrow" },
    { msg: "I will visit Yogyakarta next month" },
    { msg: "I have already visited Yogyakarta" },
    { msg: "I haven't visited Yogyakarta yet" },
  ]);

// ═════════════ CATEGORY 6 · PREPOSITIONS ═════════════
await probe("06 · prepositions · in/on/at/near/from/to",
  "Location/relation prepositions.",
  [
    { msg: "hotels in Yogyakarta" },
    { msg: "hotels near Malioboro" },
    { msg: "flights from Jakarta to Bali" },
    { msg: "restaurants on Jalan Prawirotaman" },
  ]);

// ═════════════ CATEGORY 7 · SPATIAL RELATIONS ═════════════
await probe("07 · spatial · left/right/above/below/inside/outside",
  "Spatial relations that require real interpretation.",
  [
    { msg: "what is next to the palace?" },
    { msg: "what is inside the mall?" },
    { msg: "which hotels are north of Malioboro?" },
    { msg: "what's beside the airport?" },
  ]);

// ═════════════ CATEGORY 8 · TEMPORAL RELATIONS ═════════════
await probe("08 · temporal · before/after/already/still/yet/again",
  "Temporal reasoning across turns.",
  [
    { msg: "what should I do before checking in?" },
    { msg: "and after that?" },
    { msg: "have I already asked you this?" },
    { msg: "ask me again later" },
  ]);

// ═════════════ CATEGORY 9 · QUANTITIES / COMPARISONS ═════════════
await probe("09 · quantities/comparisons · how much · how many · cheaper",
  "Numeric and comparative reasoning.",
  [
    { msg: "how much does a hotel cost?" },
    { msg: "how many hotels do you have?" },
    { msg: "which is cheaper — Yogyakarta or Bali?" },
    { msg: "show me the top 3 hotels" },
  ]);

// ═════════════ CATEGORY 10 · NEGATION ═════════════
await probe("10 · negation · not · don't · never · no",
  "Negation must invert or block.",
  [
    { msg: "I don't want a hotel" },
    { msg: "not near the airport" },
    { msg: "I never eat spicy food" },
    { msg: "show me hotels that are NOT expensive" },
  ]);

// ═════════════ CATEGORY 11 · AMBIGUITY / POLYSEMY ═════════════
await probe("11 · polysemy · lead/bass/bank/watch/spring",
  "Words with multiple senses catalogued in the lexicon.",
  [
    { msg: "who will lead the tour?" },
    { msg: "I want to catch bass here" },
    { msg: "where is the nearest bank?" },
    { msg: "I need a new watch" },
  ]);

// ═════════════ CATEGORY 12 · HOMOPHONES (via typed text) ═════════════
await probe("12 · homophones · their/there · to/too · your/you're",
  "Homophone alternates typed to see if NEX cares about the distinction.",
  [
    { msg: "there are hotels here" },
    { msg: "their prices are high" },
    { msg: "they're too expensive" },
    { msg: "your welcome to book two rooms" },  // deliberate mistake
  ]);

// ═════════════ CATEGORY 13 · CONVERSATIONAL SHORTHAND ═════════════
await probe("13 · shorthand · sms-style · dropped articles",
  "Truncated inputs typical of chat/voice.",
  [
    { msg: "hotel yogya cheap" },
    { msg: "y" },
    { msg: "n" },
    { msg: "ok" },
  ]);

// ═════════════ CATEGORY 14 · INCOMPLETE SENTENCES ═════════════
await probe("14 · incomplete · missing subject/verb/object",
  "Grammatically incomplete inputs.",
  [
    { msg: "hotel" },
    { msg: "cheap one" },
    { msg: "the beach" },
    { msg: "yes and also" },
  ]);

// ═════════════ CATEGORY 15 · NATURAL FOLLOW-UPS ═════════════
await probe("15 · natural follow-ups · and/also/what about",
  "Elliptical extension of a prior topic.",
  [
    { msg: "find hotels in Yogyakarta" },
    { msg: "and Bali?" },
    { msg: "what about Jakarta?" },
    { msg: "also gyms" },
  ]);

// ═════════════ CATEGORY 16 · TOPIC SHIFTS ═════════════
await probe("16 · topic shifts · abrupt switch mid-conversation",
  "Complete category change without transition.",
  [
    { msg: "find me a hotel" },
    { msg: "actually forget that, I need a restaurant" },
    { msg: "no wait, tell me about wood carving" },
  ]);

// ═════════════ CATEGORY 17 · IMPLIED MEANING ═════════════
await probe("17 · implied · indirect requests",
  "The user's actual intent is not the surface question.",
  [
    { msg: "it's really hot today" },  // implied: cold drink / AC hotel?
    { msg: "my wife hates spicy food" },  // implied: recommend mild
    { msg: "we have a baby with us" },  // implied: family-friendly
  ]);

// ═════════════ CATEGORY 18 · CORRECTIONS ═════════════
await probe("18 · corrections · user says 'actually I meant X'",
  "User revises a prior utterance mid-conversation.",
  [
    { msg: "find me a hotel in Bali" },
    { msg: "actually I meant Yogyakarta" },
    { msg: "sorry not Yogyakarta — Jakarta" },
  ]);

// ═════════════ CATEGORY 19 · EMOTION / SOCIAL ═════════════
await probe("19 · emotion/social · thanks · frustration · greetings",
  "Social openers and emotional signals.",
  [
    { msg: "hi" },
    { msg: "thanks for your help!" },
    { msg: "this is really frustrating" },
    { msg: "goodbye" },
  ]);

// ═════════════ CATEGORY 20 · INDONESIAN CONVERSATIONAL ═════════════
await probe("20 · indonesian · natural sentences",
  "Full Indonesian utterances, not just marker words.",
  [
    { msg: "saya ingin hotel yang murah" },
    { msg: "tolong cari restoran di dekat sini" },
    { msg: "terima kasih banyak" },
  ]);

// ═════════════ CATEGORY 21 · CODE-SWITCHING ═════════════
await probe("21 · code-switching · English/Indonesian mid-sentence",
  "Sentence mixes both languages.",
  [
    { msg: "cari hotel yang cheap" },
    { msg: "berapa harga per night?" },
    { msg: "ok bookkan yang first one" },
  ]);

// ═════════════ CATEGORY 22 · STT-STYLE NOISE ═════════════
await probe("22 · STT-style errors · misheard words",
  "Inputs shaped like plausible STT errors.",
  [
    { msg: "find me a hotel near a leo boro" },  // "Malioboro" mis-STT
    { msg: "gari sentana hotel" },  // "Griya Sentana" mis-STT
    { msg: "book yogurt karta" },  // "Yogyakarta"
  ]);

// ═════════════ CATEGORY 23 · VOICE-RESPONSE CONSISTENCY ═════════════
await probe("23 · voice · same intent should produce speak-safe text",
  "Check voice_reply.en for template markers, ellipsis, or lists ill-suited to speech.",
  [
    { msg: "hi there" },
    { msg: "find me hotels near Malioboro" },
    { msg: "tell me more about the first one" },
  ]);

// ═════════════ CATEGORY 24 · CONVERSATIONAL MEMORY ═════════════
await probe("24 · memory · does NEX remember 4 turns ago",
  "Establish fact early, ask about it later.",
  [
    { msg: "I have a food allergy to shellfish" },
    { msg: "find me a restaurant" },
    { msg: "any good ones with seafood?" },
    { msg: "what did I tell you about my allergy?" },
  ]);

// ═════════════ CATEGORY 25 · ASK-VS-ANSWER + I-DON'T-KNOW ═════════════
await probe("25 · ask-vs-answer · when to clarify vs when to try",
  "Should clarify vs try; should also admit ignorance honestly.",
  [
    { msg: "book it" },  // no anchor · should clarify
    { msg: "what's the weather in Yogyakarta right now?" },  // NEX cannot know
    { msg: "what's tomorrow's exchange rate?" },  // NEX cannot know
    { msg: "who won the 2028 election?" },  // future / NEX cannot know
  ]);

// ═════════════ CATEGORY 26 · EVIDENCE-AWARE SPEAKING ═════════════
await probe("26 · evidence-aware · never invent when knowledge_count=0",
  "Zero-evidence subjects must produce honest boundary, not fabrication.",
  [
    { msg: "tell me about seafood in Japan" },
    { msg: "what's the population of Bandung?" },
    { msg: "recommend a Michelin restaurant in Semarang" },
  ]);

writeFileSync(path.join(here, "_speaking_intelligence_audit_probes.json"),
  JSON.stringify(audit, null, 2) + "\n");
console.log(`\n→ ${path.join(here, "_speaking_intelligence_audit_probes.json")}`);
console.log(`Total categories probed: ${audit.categories.length}`);
console.log(`Total turns: ${audit.categories.reduce((s, c) => s + c.turns.length, 0)}`);
