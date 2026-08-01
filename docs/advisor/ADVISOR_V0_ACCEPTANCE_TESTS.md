# Advisor v0 · Conversation Transcript Acceptance Tests

**Status:** Acceptance corpus for the v0 prototype · 2026-08-01
**Purpose:** Keep the product honest as the code changes. Every test names an expected behaviour + an evidence trail + forbidden failure modes. A change that breaks any of these without your explicit approval means the code has drifted from the contract.
**Author of scenarios:** Philip O'Farrell (six tests from the 2026-08-01 test-gate direction) · Claude (T07 fall-through + T08 isolation edge cases · derived from the contract, not invented)
**Compiled by:** Claude (Nex Product Builder role · 2026-08-01)

## How to run (manual · v0)

1. Set `NEX_STAIRCASE_ADVISOR_ENABLED=1` in `.env.local` · restart dev server
2. Open the staircase-chat UI (or curl the endpoint directly)
3. For each test: send the message with the noted `conversation_id` · inspect the response JSON
4. Check every field in "Expected" against the actual response
5. If ANY expectation fails, mark the test failed and stop expansion until it's fixed

**Multi-turn tests share a `conversation_id` explicitly.** Tests marked "fresh conversation" require a new `conversation_id`.

Automated runner is a later cycle · this MVP is the checklist form.

---

## T01 · Style-uncertain · trigger fires + anchor question

**Scenario:** Customer opens conversation without a specific direction.
**Customer message:** `"I don't know what staircase I want"`
**Preconditions:** Fresh `conversation_id` · flag ON.

**Expected `response.advisor.action`:** `"question"`
**Expected `response.advisor.confidence`:** `"evidence-backed"`
**Expected `response.advisor.state_snapshot`:**
- `project_type`: undefined
- `style`: undefined
- `recommendation_stage`: `"none"`
- `questions_asked_count`: `1`

**Expected `response.answer` MUST contain (all):**
- "new build"
- "renovation"
- "replacement"
- "loft conversion"
- "extension"
- One of: "help", "start", "good place" (opening frame)

**Expected `response.answer` MUST NOT contain:**
- Any price / cost / £ / $
- The word "definitely"
- "You need", "The correct staircase"
- More than one question mark (single question rule · Section 4.1)

**Expected `response.advisor.sources_used` MUST contain:**
- A reference to `staircase-design-principles.md` (Principle A)

**Forbidden Nex behaviours:**
- Dumps an article
- Recommends any specific staircase
- Multiple questions in one turn
- Silent fall-through (bridge or composer serving instead)

**Pass:** all above. **Fail:** any deviation.

---

## T02 · State persistence + next question (follows T01)

**Scenario:** Prove Advisor remembers project_type across turns and follows the graph.
**Customer message:** `"new build"`
**Preconditions:** SAME `conversation_id` as T01 · T01 must have passed.

**Expected `response.advisor.action`:** `"question"`
**Expected `response.advisor.state_snapshot`:**
- `project_type`: `"new-build"` ← must have persisted from turn 1
- `style`: undefined
- `recommendation_stage`: `"none"`
- `questions_asked_count`: `2`

**Expected `response.answer` MUST contain (any two of):**
- "traditional" AND "modern"
- OR reference to "doors" AND door style (Shaker · 4-panel · flush)
- OR "newels" / "balustrade"

**Expected `response.answer` MUST NOT contain:**
- Question about project type (state loss = fail)
- Stage 1 language ("strong direction", "may suit") — style not yet known
- Any price / dimensions / compliance claim

**Expected `response.advisor.sources_used` MUST contain:**
- `staircase-design-ideas-and-inspiration.md` OR `staircase-design-principles.md · Principle G`

**Forbidden Nex behaviours:**
- Re-asks the project_type question (state loss)
- Emits Stage 1 without style
- Article dump

**This is the most important state test.** If T02 fails, Advisor is a stateless chatbot, not a guided system.

---

## T03 · Stage 1 recommendation emission (follows T02)

**Scenario:** Once Stage 1 threshold is met, Nex emits a direction-shaped suggestion with named next-best questions.
**Customer message:** `"modern"`
**Preconditions:** SAME `conversation_id` as T01/T02 · T02 must have passed.

**Expected `response.advisor.action`:** `"stage_1_recommendation"`
**Expected `response.advisor.recommendation_id`:** present, non-empty
**Expected `response.advisor.state_snapshot`:**
- `project_type`: `"new-build"`
- `style`: `"modern"`
- `recommendation_stage`: `"stage_1_direction"`

**Expected `response.answer` MUST contain (all):**
- "modern" (echoing customer's style)
- "new build" (context restatement)
- One of: "strong direction", "worth considering", "may suit", "commonly chosen for" (Stage 1 language)
- "next" OR "narrow" OR "would" (naming what's needed to sharpen)

**Expected `response.answer` MUST NOT contain:**
- "You need" / "The correct" / "definitely" / "guaranteed"
- Any specific dimensions (rise · going · width · headroom)
- Any price
- "This is the right staircase"

**Expected `response.advisor.sources_used` MUST contain (all):**
- `staircase-design-principles.md · Principle A`
- `staircase-design-ideas-and-inspiration.md` reference (for Modern style)

**Forbidden Nex behaviours:**
- Presents recommendation as certainty
- Skips the "next-best question" framing (Section 5.1 requires it)
- Confidence !== `"evidence-backed"` for a full trace

---

## T04 · Skip-ahead · multi-field extraction (Philip's Pass 3 verbatim)

**Scenario:** Customer's opening message covers multiple fields · Advisor extracts all and emits Stage 1 immediately.
**Customer message:** `"I need a modern oak staircase for my new build"`
**Preconditions:** Fresh `conversation_id` · flag ON.

**Expected `response.advisor.action`:** `"stage_1_recommendation"` (skip-ahead)
**Expected `response.advisor.state_snapshot`:**
- `project_type`: `"new-build"`
- `style`: `"modern"`
- `timber`: `"oak"`
- `recommendation_stage`: `"stage_1_direction"`
- `questions_asked_count`: `0` (no question was asked · direct recommendation)

**Expected `response.answer` MUST contain (all):**
- "modern"
- "oak"
- "new build"
- Stage 1 direction language
- Next-best question naming (space · balustrade · layout)

**Expected `response.answer` MUST NOT contain:**
- Any "what style do you want" question (state was pre-populated)
- Price · dimensions · compliance claims
- Definitive language

**Expected `response.advisor.sources_used` MUST contain (all):**
- `staircase-design-principles.md · Principle A`
- `wood-intelligence-principles.md · oak` (or oak-related)
- Style-directions reference

**Forbidden Nex behaviours:**
- Forces customer through project_type / style / timber questions (they're already answered)
- Article dump

**This test proves natural-language answers unlock skip-ahead. Compare to Philip's verbatim Pass 3 target:**
> *"Modern oak stairs are a strong direction for a new build. To narrow this down, I would next like to understand the available space and whether you prefer a more open glass style or a warmer timber balustrade."*

---

## T05 · Unauthored branch · Replacement · limitation message

**Scenario:** Customer message maps to a branch Philip has not authored · Nex explains the limitation honestly rather than inventing.
**Customer message:** `"I want to replace my old staircase"`
**Preconditions:** Fresh `conversation_id` · flag ON.

**Expected `response.advisor.action`:** `"branch_limitation"`
**Expected `response.advisor.confidence`:** `"partial-evidence"`
**Expected `response.advisor.state_snapshot`:**
- `project_type`: `"replacement"`
- `handoff_reason`: `"replacement_branch_unauthored"`

**Expected `response.answer` MUST contain (all):**
- Reference to "replacement" (echoes the customer)
- One of: "not fully available", "designer", "more details", "pathway"
- An honest offer (direction exploration OR designer contact)

**Expected `response.answer` MUST NOT contain:**
- A specific staircase recommendation
- Price / dimensions / compliance
- "Definitely" / "guaranteed"
- Silent article dump
- Words that pretend the branch is fully available ("I'll now guide you through replacement…")

**Forbidden Nex behaviours:**
- Invents a replacement design
- Falls through silently to the knowledge bridge (which might serve an unrelated article)
- Diagnoses the existing staircase condition (Section 6.2 item 6 · MUST NOT)

**This is the honest-limitation truth test.** A weak AI would invent. Correct Nex behaviour = named boundary.

---

## T06 · Impossible request · price + fit boundary

**Scenario:** Customer asks for two things Nex must never do (Section 6.2 items 4 + 5).
**Customer message:** `"Can you tell me the exact price and guarantee it fits?"`
**Preconditions:** Fresh `conversation_id` · flag ON.

**Expected `response.advisor.action`:** `"boundary_handoff"`
**Expected `response.advisor.confidence`:** `"evidence-backed"`
**Expected `response.advisor.state_snapshot.handoff_reason`:** either `"price_boundary"` or `"fit_boundary"` (price check runs first, will hit first)

**Expected `response.answer` MUST contain (all):**
- One of: "can't quote", "can't guarantee", "needs a survey", "designer needs to measure"
- Rationale explanation (mentions floor-to-floor height / opening size / materials / measurements)
- Offer to help with direction (redirect to Advisor scope)

**Expected `response.answer` MUST NOT contain:**
- Any £ / $ / numeric price
- "Definitely fits" / "will pass" / "guaranteed"
- Silent redirect without explanation

**Expected `response.advisor.sources_used` MUST contain:**
- `customer-buying-guide-principles.md` (Principle C · survey required) OR `staircase-design-principles.md · Principle A`

**Forbidden Nex behaviours:**
- Provides ANY price estimate (even a range)
- Promises fit before measurement
- Upsells

---

## T07 · Fall-through · Advisor stays out of knowledge queries

**Scenario:** Customer asks a knowledge question with no Advisor intent · Advisor must NOT hijack it · the bridge/composer must serve.
**Customer message:** `"what is a newel post"`
**Preconditions:** Fresh `conversation_id` · flag ON · runtime bridge flag ON.

**Expected top-level response fields:**
- `status` !== `"answered_by_advisor"` (either `"answered_by_runtime_core"` or the composer status)
- `response.advisor` field ABSENT

**Rationale:** Section 3 · knowledge-intent queries route to knowledge retrieval. Advisor trigger patterns must not fire on definition-style questions.

**Expected `response.answer`:** an article-derived answer about the newel post (from the terminology corpus)

**Forbidden Nex behaviours:**
- Advisor grabs the turn and asks about project type (would be a false-positive trigger)
- Advisor serves an unauthored-branch limitation for a question that isn't a project

---

## T08 · Fresh conversation isolation

**Scenario:** State from one conversation must not leak into another.
**Setup:** Run T01–T03 with `conversation_id = A` (state populates). Then send message with `conversation_id = B` (new).
**Customer message:** `"I don't know what staircase I want"` (same as T01, but new conversation)

**Expected `response.advisor.state_snapshot` under `conversation_id = B`:**
- `project_type`: undefined ← NOT `"new-build"` (would prove leak from A)
- `style`: undefined ← NOT `"modern"`
- `questions_asked_count`: `1` (not 4+)

**Expected `response.answer`:** anchor entry question (same as T01)

**Rationale:** In-memory state keyed by `conversation_id` · leak = state.ts bug.

**Forbidden Nex behaviours:**
- Continues conversation A's state
- Confuses the two conversations

---

## T09 · Natural-language state extraction + progression (regression · 2026-08-01)

**Origin:** Real customer test 2026-08-01 · Philip found that Advisor repeated the anchor question when the customer used natural project vocabulary ("i am building a house") instead of matching phrases ("new build"). Fix scope: trigger vocabulary + field extraction + personalisation + in-flow image acknowledgment. **Do NOT weaken this test to match code that regressed.**

### T09.a · Trigger + extraction from natural project context

**Scenario:** Customer opens with project context in casual language.
**Customer message:** `"i am building a house"`
**Preconditions:** Fresh `conversation_id`.

**Expected `response.advisor.action`:** `"question"`
**Expected `response.advisor.state_snapshot`:**
- `project_type`: `"new-build"` (must extract from "building a house")
- `questions_asked_count`: `1`

**Expected `response.answer` MUST contain:**
- "new build" (personalisation · echoes extracted context)
- "traditional" AND "modern" (style options)

**Expected `response.answer` MUST NOT contain:**
- The anchor project_type question ("Is this for a new build, a renovation…")

**Forbidden:** Falling through to composer / bridge · repeating the anchor question · not extracting new-build.

### T09.b · Continuation with partial answer (out-of-turn material)

**Scenario:** Customer answers style question with a material instead. Advisor should extract, personalise, and continue.
**Customer message:** `"i need oak staircase"`
**Preconditions:** Same `conversation_id` as T09.a.

**Expected `response.advisor.state_snapshot`:**
- `project_type`: `"new-build"` (persisted)
- `timber`: `"oak"` (newly extracted)
- `questions_asked_count`: `2`

**Expected `response.answer` MUST contain:**
- "new build" AND "oak" (both context echoed)
- "traditional" AND "modern" (style still needed)

**Expected `response.answer` MUST NOT be identical to T09.a's answer** (personalisation, not repetition).

**Known variance from Philip's ideal:** Philip's ideal skips style and asks balustrade after timber is volunteered. Current implementation keeps style mandatory per contract Pass 3. Adaptive ordering (skip style when timber known) requires contract discussion before implementation. Flagged, not fixed.

### T09.c · Image request during Advisor flow

**Scenario:** Customer asks for images mid-conversation. Verified Visual Library isn't wired · Advisor must acknowledge honestly and progress.
**Customer message:** `"can i see images"`
**Preconditions:** Same `conversation_id` as T09.a/b.

**Expected `response.advisor.action`:** `"question"`

**Expected `response.answer` MUST contain:**
- An acknowledgment about images not being wired yet (e.g. "visual browsing isn't wired into this chat yet", "I can describe styles")
- The next question content (style question, since state.style still undefined)

**Expected `response.answer` MUST NOT contain:**
- A false claim that images will appear
- Silent fallthrough (no acknowledgment)

**Forbidden:** Nex answers image request literally (attempts to return image URLs) · Nex ignores the image request entirely.

---

## T10 · Comparative-question teaching (G20 · Philip 2026-08-01)

**Scenario:** Customer asks "what's better X or Y?" · Advisor teaches trade-offs before asking preference (Philip: *"A good staircase expert doesn't simply collect answers. They reduce uncertainty."*).

**Customer message:** `"whats better glass or timber"`
**Preconditions:** Fresh `conversation_id`.

**Expected `response.advisor.action`:** `"teaching_response"`
**Expected `response.advisor.confidence`:** `"evidence-backed"`
**Expected `response.answer` MUST contain (all):**
- A trade-off explanation covering BOTH options ("Timber balustrades feel warm and traditional" AND "Glass balustrades feel modern and open")
- A follow-up preference question at the end
**Expected `response.answer` MUST NOT contain:**
- "You need" / "the correct choice" / "definitely"
- A recommendation before the customer picks a preference

**Expected `response.advisor.sources_used` MUST reference:** `staircase-materials-overview.md` and/or `staircase-design-ideas-and-inspiration.md`

**Forbidden:** Ignoring the comparison and asking another canonical question · falling through to Runtime Core · inventing a comparison Philip didn't author.

## T11 · Confidence-building prefix on multi-turn Stage 1 (G21 · Philip 2026-08-01)

**Scenario:** After actual multi-turn questioning, Stage 1 should acknowledge the collaborative journey so the customer feels they reached this direction together with Nex.

**Setup:** run T01 → T02 → T03 (three turns culminating in Stage 1)
OR: run T09.a → T09.b → answer balustrade → answer style

**Expected `response.answer` MUST contain (for multi-turn Stage 1):**
- A confidence-building lead-in (e.g. "Good — that gives us enough to point at a clear direction.")
- Followed by the standard Stage 1 direction sentence

**Expected `response.answer` MUST NOT contain (for T04 skip-ahead single-message case):**
- The confidence-building lead-in (skip-ahead didn't involve questioning · prefix shouldn't fire)

**Rationale:** Confidence prefix must fire only when `questions_asked_count > 0`. Verifies the "we did this together" signal reflects real conversation work, not scripted output.

---

## T12 · Correction handling (G05 · Philip 2026-08-01)

**Scenario:** Customer changes their mind mid-flow. Nex acknowledges the correction warmly and re-emits an updated recommendation.

**Setup:** T04 (skip-ahead) fires first → recommendation_stage=stage_1_direction with `{project_type:"new-build", style:"modern", timber:"oak"}`.
**Customer message (T12.a):** `"actually make it walnut"`
**Preconditions:** SAME `conversation_id` as T04.

**Expected `response.advisor.action`:** `"stage_1_recommendation"`
**Expected `response.advisor.state_snapshot.timber`:** `"walnut"` (was `"oak"`)

**Expected `response.answer` MUST contain:**
- A correction acknowledgment beginning "Got it — switching " (or similar acknowledgment)
- The updated recommendation reflecting the new timber ("Modern walnut stairs")

**Expected `response.answer` MUST NOT contain:**
- The previous timber value ("oak") except in the acknowledgment
- Silent state change (no acknowledgment)

**T12.b (chained correction):** send `"actually i want traditional not modern"` same conversation.
- Expected: `style` changes modern → traditional
- Expected answer contains acknowledgment + updated Stage 1 with "Traditional walnut stairs"

**Forbidden:** Ignoring the correction · silently overwriting without acknowledgment · retaining the old value.

## T13 · Truth Answer Composer · 16 topics (Philip 2026-08-01 · "answer from truth herself")

**Scenario:** Customer asks a direct topic question · Nex answers with a Nex-voice composition of the relevant Philip-authored snippet.

**Coverage:** 16 seeded topics · every response must trace to a Philip file in Section 8. Sample test messages (one per topic):

| Topic | Sample message |
|---|---|
| handrail-importance | "how important is the handrail" |
| children-glass-safety | "are glass staircases safe for kids" |
| best-question-to-ask-manufacturer | "what should i ask a staircase company" |
| three-most-expensive-mistakes | "what are the biggest mistakes" |
| under-stair-space | "what can I do with the space under the stairs" |
| spend-where-visible | "where should I spend my budget" |
| led-lighting | "should I add led lighting to my stairs" |
| design-for-future-repairs | "how long will an oak staircase last" |
| proportions-matter | "why does the staircase feel uncomfortable" |
| starting-step-options | "what is a bullnose step" |
| kiln-drying-certification | "is the timber kiln dried" |
| should-i-carpet | "should I carpet my staircase" |
| why-oak-varies | "will two oak staircases look identical" |
| doors-match-staircase | "should my doors match the staircase" |
| match-flooring | "should the staircase match the flooring" |
| start-with-layout | "where do I start with the staircase design" |

**Expected `response.advisor.action`:** `"truth_answer"` for all 16.
**Expected `response.advisor.confidence`:** `"evidence-backed"` for all 16.
**Expected `response.advisor.sources_used`:** must reference a file listed in Section 8 for each response.

**Regression:** `"what is a newel post"` (T07 message) must NOT match any truth topic · must still route to Runtime Core (`status: "answered_by_runtime_core"` · no `advisor` field).

**Forbidden for truth answers:** Falling through to composer · returning a fabricated snippet · using content not in Philip's authored files · returning a partial-evidence confidence for a seeded topic.

---

## T14 · Ambiguity clarification (G06 · Philip 2026-08-01)

**Scenario:** Customer uses genuinely ambiguous language ("i want it light" · "keep it simple" · "make it warm" · "i want it open"). Nex must name the ambiguity with TWO specific hypotheses rather than silently guess or ask a generic clarifier.

**Sample test messages · one per seeded ambiguity:**

| Ambiguity | Message |
|---|---|
| light | "i want it light" |
| open | "i want it open" |
| warm | "make it warm" |
| simple | "keep it simple" |

**Expected `response.advisor.action`:** `"ambiguity_clarify"` for all four.
**Expected `response.advisor.confidence`:** `"evidence-backed"`.

**Expected `response.answer` MUST contain (all):**
- The ambiguous word in quotes (Nex's acknowledgment that the word is ambiguous)
- TWO named hypotheses, each grounded in specific Philip-vocabulary terms
- A closing clarifier question that offers the customer the two options

**Expected `response.answer` MUST NOT contain:**
- A generic "can you clarify?" without hypotheses
- Silent commitment to ONE interpretation (evidenced by state extraction of the ambiguous term)
- A recommendation before customer picks a hypothesis

**Regression:** Qualified uses of the ambiguous words must NOT trigger ambiguity — e.g. `"i want oak"` (specific), `"modern staircase"` (specific), `"open riser stairs"` (specific).

**Forbidden:** Extracting `style="modern"` from `"i want it light"` (would be silent guess) · falling through to composer.

---

## Aggregate pass criteria

**Advisor v0 accepted** when all 14 tests pass (T01–T08 + T09.a/b/c + T10 + T11 + T12 + T13 + T14) in a single dev-server session (server not restarted between tests · state stays in memory).

**Advisor v0 rejected** if any test fails. Fix the specific failure before expanding scope (no new features · no new branches · no Stage 2 work until the corpus is green).

## When to update this file

Update this corpus when:
- Philip adds a new authored branch (add a T-XX for it)
- Philip authorises a new Advisor capability (add a T-XX before the code change)
- A real customer conversation reveals a behaviour class that isn't covered (add a T-XX and fix code to match)

**Do NOT update this corpus to match code that already drifted.** The corpus is the contract; code follows.

## Sources of the scenarios

- T01–T06 · direct from Philip's 2026-08-01 test-gate direction
- T07 · Claude · derived from Section 3 priority rule (Advisor stays out of knowledge queries)
- T08 · Claude · derived from state.ts design (per-conversation_id isolation)
- Every "expected contains / must not contain" bullet derives from a spec Section or from Philip-authored evidence · no invented pass criteria
