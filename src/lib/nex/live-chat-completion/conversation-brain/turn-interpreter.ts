// src/lib/nex/live-chat-completion/conversation-brain/turn-interpreter.ts
//
// Founder BEGIN Phase 3.1 · Turn Interpreter (deterministic pre-adapter layer).
//
// Reads (state, message) → returns a TurnPlan the adapter uses instead of
// its raw message. Zero LLM. Zero fabrication. When ambiguity is real,
// the interpreter refuses to guess — the adapter then honestly clarifies.
//
// Classifications:
//   new_topic          · fresh request, no prior context matters
//   follow_up_on_entity · asking a question about the currently focused entity
//   follow_up_on_list  · asking a question that filters the currently surfaced list
//   fragment           · very short message ("rooms?" "wifi?" "and pool?")
//                        resolved against active_entity_ref OR current_result_set_id
//   clarification      · user responding to NEX's prior clarification question
//   topic_switch       · explicit "what about villas" style pivot

import type { ConversationState, DialogueTurn } from "./state-store";

// ═══════════════════════════════════════════════════════════════════
// Fragment patterns · exhaustive but deterministic.
// A fragment: <5 tokens · no full sentence structure · no verb OR only
// interrogative marker. Matches the "rooms?" "wifi?" "and pool?" chat feel.
// ═══════════════════════════════════════════════════════════════════

const FRAGMENT_MAX_TOKENS = 5;

// Explicit token → intent map for common fragments.
const FRAGMENT_INTENT_MAP: Record<string, string> = {
  // amenities
  wifi:                    "wifi_available",
  "wi-fi":                 "wifi_available",
  internet:                "wifi_available",
  pool:                    "pool_available",
  "swimming pool":         "pool_available",
  parking:                 "parking_available",
  breakfast:               "breakfast_available",
  brekky:                  "breakfast_available",
  gym:                     "gym_available",
  spa:                     "spa_available",
  laundry:                 "laundry_available",
  elevator:                "elevator_available",
  lift:                    "elevator_available",
  balcony:                 "balcony_available",
  ac:                      "air_conditioning_available",
  "air conditioning":      "air_conditioning_available",
  restaurant:              "restaurant_available",
  bar:                     "bar_available",
  // rooms / price / location
  rooms:                   "room_count",
  room:                    "room_count",
  kamar:                   "room_count",
  beds:                    "beds_configuration",
  price:                   "price_indicative",
  cost:                    "price_indicative",
  cheap:                   "price_indicative",
  cheapest:                "price_indicative",
  harga:                   "price_indicative",
  murah:                   "price_indicative",
  mahal:                   "price_indicative",
  // Founder BEGIN Phase 3.2 · temporal fragments → availability_query.
  // Composer emits honest availability_unknown because NEX does not have
  // live inventory yet; separation is architectural.
  tonight:                 "availability_query",
  tomorrow:                "availability_query",
  today:                   "availability_query",
  "this weekend":          "availability_query",
  "next week":             "availability_query",
  "next weekend":          "availability_query",
  friday:                  "availability_query",
  saturday:                "availability_query",
  sunday:                  "availability_query",
  monday:                  "availability_query",
  tuesday:                 "availability_query",
  wednesday:               "availability_query",
  thursday:                "availability_query",
  // Indonesian temporal
  besok:                   "availability_query",  // tomorrow
  hariini:                 "availability_query",  // today
  "malam ini":             "availability_query",  // tonight
  "akhir pekan":           "availability_query",  // weekend
  address:                 "location_address",
  alamat:                  "location_address",
  where:                   "location_city",
  location:                "location_city",
  phone:                   "property_phone",
  telepon:                 "property_phone",
  website:                 "property_website",
  stars:                   "property_star_rating",
  bintang:                 "property_star_rating",
  rating:                  "property_rating",
  photos:                  "hero_image",
  photo:                   "hero_image",
  picture:                 "hero_image",
  // policies
  checkin:                 "check_in_time",
  "check in":              "check_in_time",
  "check-in":              "check_in_time",
  checkout:                "check_out_time",
  "check out":             "check_out_time",
  "check-out":             "check_out_time",
  pets:                    "pet_policy",
  cancellation:            "cancellation_policy",
  // Indonesian informal
  wifinya:                 "wifi_available",
};

// Ordinal patterns for list_reference: "the first one" "second one" "yang pertama"
const ORDINAL_MAP: Record<string, number> = {
  first:    1, "1st": 1, one:  1, pertama: 1,
  second:   2, "2nd": 2, two:  2, kedua:   2,
  third:    3, "3rd": 3, three:3, ketiga:  3,
  fourth:   4, "4th": 4, four: 4, keempat: 4,
  fifth:    5, "5th": 5, five: 5, kelima:  5,
};

// Filter patterns for follow_up_on_list.
// "which has X" · "any with X" · "yang ada X" · "yang murah" · "the cheap one"
const FILTER_PATTERNS = [
  /\b(which|what|any|which one|which ones)\b.+\b(has|have|with|got)\b/i,
  /\byang\s+ada\s+/i,
  /\byang\s+punya\s+/i,
  // Indonesian "yang <adjective>" — cheap / expensive / near
  /\byang\s+(murah|mahal|dekat|besar|kecil)\b/i,
  // English "the cheap/nearest one" style
  /\bthe\s+(cheap|cheapest|nearest|closest|biggest|smallest)\b/i,
];

// Explicit topic-switch phrases (mirrors intent-parser's tightened rule).
const TOPIC_SWITCH_PATTERNS = [
  /\bwhat about\b/i,
  /\bhow about\b/i,
];

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export type TurnClassification =
  | "new_topic"
  | "follow_up_on_entity"
  | "follow_up_on_list"
  | "fragment"
  | "clarification"
  | "topic_switch";

export interface TurnPlan {
  classification: TurnClassification;
  /** Intent slug the interpreter inferred (may be null when adapter should re-parse). */
  inferred_intent_slug: string | null;
  /** Entity ref the message is about, if the interpreter resolved one. */
  resolved_entity_ref: string | null;
  /**
   * Optional filter to apply to the current_result_set. Only set for
   * follow_up_on_list. The adapter treats this as: from the result_set,
   * keep only entities whose bundle satisfies (fact_slug, expected_value).
   */
  list_filter?: {
    fact_slug: string;
    expected: unknown;
  };
  /** Was the input a fragment we couldn't resolve? Force clarify. */
  ambiguous: boolean;
  ambiguity_reason?: string;
  /** Machine-readable trace lines for observability. */
  reasoning: readonly string[];
}

// ═══════════════════════════════════════════════════════════════════
// Interpreter
// ═══════════════════════════════════════════════════════════════════

function tokenise(msg: string): string[] {
  return msg.toLowerCase().replace(/[!.?]+$/g, "").split(/\s+/).filter(Boolean);
}

function containsAny(msg: string, needles: readonly string[]): string | null {
  const lower = msg.toLowerCase();
  for (const n of needles) if (lower.includes(n)) return n;
  return null;
}

function extractFragmentIntent(tokens: readonly string[], rawLower: string): string | null {
  // Multi-word matches first ("swimming pool", "wi-fi").
  for (const [kw, intent] of Object.entries(FRAGMENT_INTENT_MAP)) {
    if (kw.includes(" ") || kw.includes("-")) {
      if (rawLower.includes(kw)) return intent;
    }
  }
  for (const t of tokens) {
    const intent = FRAGMENT_INTENT_MAP[t];
    if (intent) return intent;
  }
  return null;
}

function extractOrdinal(tokens: readonly string[]): number | null {
  for (const t of tokens) if (ORDINAL_MAP[t] !== undefined) return ORDINAL_MAP[t];
  return null;
}

export function interpretTurn(input: {
  message: string;
  state: ConversationState;
}): TurnPlan {
  const raw = String(input.message ?? "").trim();
  const rawLower = raw.toLowerCase();
  const tokens = tokenise(raw);
  const reasoning: string[] = [];

  const hasResultSet = !!input.state.current_result_set_id;
  const hasActiveEntity = !!input.state.active_entity_ref;

  // ── 1. Ordinal reference against a prior list ─────────────────────
  const ordinal = extractOrdinal(tokens);
  if (ordinal && hasResultSet) {
    reasoning.push(`ordinal ${ordinal} against current_result_set`);
    // Adapter uses this to look up entity_refs[ordinal-1] on the result_set.
    return {
      classification: "follow_up_on_list",
      inferred_intent_slug: null,
      resolved_entity_ref: null,
      list_filter: undefined,
      ambiguous: false,
      reasoning: [...reasoning, `ordinal_index=${ordinal}`],
    };
  }

  // ── 2. Explicit topic-switch phrasing ─────────────────────────────
  if (TOPIC_SWITCH_PATTERNS.some((r) => r.test(rawLower))) {
    // Adapter re-parses as a fresh request in the new topic.
    reasoning.push("topic_switch phrasing detected");
    return {
      classification: "topic_switch",
      inferred_intent_slug: null,
      resolved_entity_ref: null,
      ambiguous: false,
      reasoning,
    };
  }

  // ── 3. Filter-follow-up over the current result_set ───────────────
  if (hasResultSet && FILTER_PATTERNS.some((r) => r.test(rawLower))) {
    // Extract the fact slug from the phrase after "with"/"has"/"have".
    const fragmentIntent = extractFragmentIntent(tokens, rawLower);
    if (fragmentIntent) {
      reasoning.push(`follow_up_on_list · filter fact=${fragmentIntent}`);
      return {
        classification: "follow_up_on_list",
        inferred_intent_slug: fragmentIntent,
        resolved_entity_ref: null,
        list_filter: { fact_slug: fragmentIntent, expected: true },
        ambiguous: false,
        reasoning,
      };
    }
  }

  // ── 4. Fragment (very short question) ─────────────────────────────
  const isShort = tokens.length <= FRAGMENT_MAX_TOKENS;
  const fragmentIntent = extractFragmentIntent(tokens, rawLower);
  if (isShort && fragmentIntent) {
    if (hasActiveEntity) {
      reasoning.push(`fragment · applying intent=${fragmentIntent} to active_entity_ref=${input.state.active_entity_ref}`);
      return {
        classification: "fragment",
        inferred_intent_slug: fragmentIntent,
        resolved_entity_ref: input.state.active_entity_ref,
        ambiguous: false,
        reasoning,
      };
    }
    if (hasResultSet) {
      // Fragment against a list, no ordinal, no filter phrasing → apply as
      // filter (equivalent to "which has X").
      reasoning.push(`fragment · applying as list filter on current_result_set (fact=${fragmentIntent})`);
      return {
        classification: "follow_up_on_list",
        inferred_intent_slug: fragmentIntent,
        resolved_entity_ref: null,
        list_filter: { fact_slug: fragmentIntent, expected: true },
        ambiguous: false,
        reasoning,
      };
    }
    // Truly ambiguous fragment (no state to resolve against).
    reasoning.push("fragment · no active entity or result_set to resolve against");
    return {
      classification: "fragment",
      inferred_intent_slug: fragmentIntent,
      resolved_entity_ref: null,
      ambiguous: true,
      ambiguity_reason: "no_context_to_resolve_fragment",
      reasoning,
    };
  }

  // ── 5. Follow-up on entity when a named property is not in the message
  //     but active_entity_ref is set AND message references a fact intent
  //     without a full sentence around it. Handled inside fragment path
  //     above · nothing extra here.

  // ── 6. Default · new topic. Adapter re-parses raw. ────────────────
  reasoning.push("default classification · new_topic");
  return {
    classification: "new_topic",
    inferred_intent_slug: null,
    resolved_entity_ref: null,
    ambiguous: false,
    reasoning,
  };
}

// ═══════════════════════════════════════════════════════════════════
// State mutations after a turn compose
// ═══════════════════════════════════════════════════════════════════

/**
 * Update state after the adapter has composed a reply. Called at end of
 * turn. Idempotent within a single call.
 */
export function applyTurnResultToState(input: {
  state: ConversationState;
  message: string;
  reply_text: string;
  intent_slug: string | null;
  entity_ref: string | null;
  reply_kind: string;
  registered_result_set_id: string | null;
}): ConversationState {
  const s = { ...input.state };
  const nowIso = new Date().toISOString();
  s.dialogue_turns = [
    ...s.dialogue_turns,
    { role: "user", text: input.message, intent: input.intent_slug ?? null, entity_ref: input.entity_ref ?? null, at: nowIso },
    { role: "nex", text: input.reply_text, intent: input.intent_slug ?? null, entity_ref: input.entity_ref ?? null, at: nowIso },
  ].slice(-40); // bounded

  if (input.intent_slug) s.previous_intents = [...s.previous_intents, input.intent_slug].slice(-20);
  if (input.entity_ref) s.active_entity_ref = input.entity_ref;
  if (input.registered_result_set_id) s.current_result_set_id = input.registered_result_set_id;

  s.updated_at = nowIso;
  return s;
}
