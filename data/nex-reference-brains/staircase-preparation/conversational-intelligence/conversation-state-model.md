---
title: Conversation State Model — what NEX remembers across turns
provenance: philip-approved-2026-08-14
brain: staircase_brain
domain: STAIRCASE
authoritative: true
purpose: model_conversation_state_so_NEX_does_not_restart_when_customer_answers_a_follow_up
---

# Conversation State Model — what NEX remembers across turns

Real conversations are not sequences of independent questions. When a customer answers a follow-up, NEX must remember what was already established and continue from there — not start over.

**Locked rule:** on every turn NEX updates state. On every turn NEX reads state before deciding what to do. Restarting an established topic is a failure of conversation state.

## The state object

Per conversation session, NEX maintains:

```
{
  topic_stack: [current_topic, previous_topic, ...],
  current_concept: e.g. "starting_step",
  resolved_ambiguities: {
    ambiguity_id: {resolution, resolved_at_turn},
    ...
  },
  established_facts: {
    construction_type: "wall_fixed" | "two_sided_cut_string" | "unknown",
    style_intent: "traditional" | "modern" | "transitional" | "unknown",
    finish_intent: "carpeted" | "exposed_timber" | "runner" | "step_mats" | "unknown",
    scope: "full_build" | "refacing" | "cap_swap" | "spindle_swap" | "unknown",
    ...
  },
  customer_preferences: {
    timber_species: "oak" | "pine" | "walnut" | ..., 
    balustrade_family: "turned_timber" | "matt_black_metal" | "brushed_stainless" | ...,
    ...
  },
  pending_questions: [next_useful_clarifiers, ...],
  turns_since_last_summary: N,
  routing_decisions: [routed_to_brain_X, out_of_scope_flag_Y, ...],
}
```

## State transitions per turn

### On customer input

1. **Read state** — what topic are we on · what's resolved · what's still missing
2. **Interpret input** — apply glossary + question-variations against current state (input may be a continuation, follow-up, or topic change)
3. **Classify intent tier** — Clear / Likely / Ambiguous (state can promote Likely → Clear if state resolves the ambiguity)
4. **Update state** — record any new resolved ambiguity · new established fact · new preference
5. **Decide next action** — answer · ask · route · summarise

### Topic transitions

A **topic change** happens when the customer clearly moves to a different concept. NEX should:
- Preserve the previous topic in `topic_stack` (customer may return to it)
- Reset ambiguity tracking for the new topic
- Retain style/finish/construction preferences (they usually stay relevant)

**Never fully wipe state on a topic change.** Cross-topic preferences (style / timber / finish) carry across the whole conversation.

## Worked example (Philip's flagship scenario)

**Turn 1**
> Customer: "I want a nicer first step."
> NEX interpretation: concept = starting_step · tier = Ambiguous (which direction: bullnose, curtail, wider, feature newel?)
> NEX action: ASK
> NEX response: "Are you thinking about making it wider, or giving it a rounded/bullnose shape?"
> State update: topic = starting_step · pending_ambiguity = starting_step_direction

**Turn 2**
> Customer: "Wider."
> NEX interpretation: state has pending_ambiguity = starting_step_direction · input "wider" resolves it → extended_tread
> NEX action: continue with resolved direction · check next missing info
> NEX response: "That can work well. Is the staircase open on one side or both sides?"
> State update: resolved_ambiguities += {starting_step_direction: extended_tread} · pending_ambiguity = construction_type

**What NEX MUST NOT DO on Turn 2:**
- Ask "Sorry, what were we talking about?" (forgot topic)
- Restart with "There are a few types of starting steps..." (dumped info without state)
- Recommend a bullnose (ignored the resolved ambiguity)

## Cross-turn preference retention

Some preferences carry across every topic in the conversation:

| Preference | Retained? | Rationale |
|---|---|---|
| Style intent (traditional / modern) | Yes | Almost every staircase decision depends on it |
| Timber species preference | Yes | Consistency across components |
| Balustrade material family | Yes | Locks in a lot of downstream choices |
| Construction type (wall-fixed / two-sided) | Yes | Physical constraint carries through |
| Carpet vs exposed timber intent | Yes | Affects starting step, tread finish, edge details |
| Specific product dimensions | No — verified per query | Sizes change per element |
| Specific measurements | No — verified per query | Same reason |

## State surface (what NEX says vs what NEX tracks)

Not all state should surface to the customer. NEX tracks internally; surfaces sparingly.

**Surface (good):**
- "OK — so on a wall-fixed traditional oak staircase, with a carpet runner..." (summary at key decision moments)
- "You mentioned earlier that the flight would be carpeted..." (state referenced when it matters)

**Don't surface (bad):**
- "State: topic=starting_step, style=traditional, ..." (never dumps internal state)
- "According to my earlier resolution of ambiguity X..." (never over-formalises)

## State loss triggers

State should be preserved across the session. Legitimate state-loss triggers:
- Customer explicitly restarts ("let's start over" · "different question")
- Long gap in the conversation (>30 min · TBD by product surface)
- Customer signals topic change ("moving on to lighting now")

Otherwise: **state persists.** A follow-up that resolves an earlier ambiguity should be recognised, not treated as a new query.

## Implementation notes

- State lives in the session (production: NEX Chat threads · dev: test-suite step sequences)
- Test-suite conversations should include multi-turn sequences with state assertions
- Long-term: NEX Brain Vitals can include a "conversation-state fidelity" metric — % of multi-turn tests where state was correctly retained across turns

## Cross-references

- `customer-intent-scenarios.md` — many scenarios unfold across turns and require state
- `conversation-examples.md` — worked multi-turn examples
- `intent-patterns.md` — intent classification can be modulated by state
- Memory · `project_nex_conversational_intelligence_pilot_2026_08_14.md` — conversation-state as a required layer
