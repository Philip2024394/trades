# Suite Gap Report · Design-Ideas Queries · 2026-08-01

**Context:** authored the Staircase Design Ideas & Inspiration article from three Philip-authored sources (per Option A decision 2026-08-01). Ran the 5 target queries at L3 through the live chat. Article exists and is retrieved · but 0 of 5 queries now serve it to customers.

This report documents the runtime gaps that authoring alone cannot fix. Every gap requires a separate evidence-backed engineering cycle per Philip's constraint (no router / gallery / recommendation changes without a dedicated cycle).

---

## Test results after authoring

| # | Query | Router intent · info · domain | Runtime Core outcome | Bridge outcome | Customer sees |
|---|---|---|---|---|---|
| 1 | "I want inspiration for stairs" | Buy · Inquiry · Sales · conf 0.81 | customer-faq strategy · status ok · **2 citations** (gateway + design-ideas · tied match_score) | HANDLED · returns citation[0] = **gateway article** | Gateway welcome text · NOT design-ideas content |
| 2 | "staircase designs" | Learn · Definition · Components · conf 0.66 | definition strategy · **status clarify** (conf 0.66 < 0.70) · 0 citations | FALLTHROUGH | Pipeline C composer output (existing "manufacturing joints" pattern) |
| 3 | "modern staircase ideas" | Learn · Definition · Components · conf 0.66 | same as #2 | FALLTHROUGH | Pipeline C composer |
| 4 | "traditional staircase ideas" | Learn · Definition · Components · conf 0.66 | same as #2 | FALLTHROUGH | Pipeline C composer |
| 5 | "what staircase styles are popular" | Learn · Definition · Components · conf 0.66 | same as #2 | FALLTHROUGH | Pipeline C composer |

**Net customer impact of the authoring cycle: 0 queries improved.**

---

## Gap #1 · Bridge citation-selection tie-break

**Symptom:** query 1 above · both the gateway article and the new design-ideas article match at `match_score = 1` (both match the single Router-extracted subject token "staircase"). The gateway article wins the alphabetical tie-break and appears first in `plan.citations`. Bridge takes `citations[0]` and serves gateway content, leaving the more topically relevant design-ideas article as citation[1] · never rendered.

**Evidence level:** L3 (proven end-to-end through live chat).

**Where the problem lives:**
- Knowledge Provider / FAQ Provider `retrieve()` sort: `results.sort((a, b) => b.match_score - a.match_score)` — no tie-break beyond match_score
- Bridge `tryStaircaseRuntimeBridge` in `src/lib/nex/staircase-bridge.ts:98`: takes `plan.citations[0]` unconditionally

**Fix candidates (do NOT implement without dedicated cycle):**
- Bridge tries `citations[0]`, if body length below threshold or exact-match miss tries `citations[1]`
- Knowledge Provider secondary sort by subject-token-count (more specific subject wins tie)
- Composer-level scoring that penalises articles matching only on generic tokens ("staircase")
- Router extracts richer subjects (e.g. "inspiration") when query implies design intent

**Not an authoring problem:** could not be resolved by rewording the article. Both articles legitimately contain "staircase" in their subject, and Router only extracts "staircase" from this class of query.

---

## Gap #2 · Definition strategy confidence threshold

**Symptom:** queries 2–5 above · Router classifies as Learn/Definition/Components at confidence 0.66. Definition strategy rejects at status=clarify because 0.66 < 0.70 threshold. Article is never even retrieved.

**Evidence level:** L3.

**Where the problem lives:**
- Router: consistently emits 0.66 for the pattern `<style-adjective> + staircase + <plural-noun>` (design, ideas, styles)
- Definition strategy: threshold hardcoded at 0.70 (established earlier · gates on Router confidence)

**Fix candidates (do NOT implement without dedicated cycle):**
- Router: recognise "design/ideas/styles/inspiration" as strengthening subjects → boost confidence
- Router: add subject aliases so "modern/traditional/oak/walnut/pine + staircase" scores above 0.70
- Definition strategy: lower threshold from 0.70 to 0.65 (would affect many other queries · not a targeted fix)
- New strategy that claims Learn/Definition/Components AT any confidence and defers to Router-quality separately

**Not an authoring problem:** confirmed by adding the article and observing it is never retrieved for these queries because the strategy short-circuits at status=clarify before retrieval.

---

## Gap #3 · Gallery bridge · image-URL citations unrenderable

**Symptom (from earlier audit · not retested here):** queries "show me staircase ideas" and "show me pictures of oak staircases" route to Gallery strategy with 77 image URL citations. Bridge attempts `readArticleBody(image_url)` and fails (image URLs are not .md file paths). Bridge falls through to Pipeline C composer.

**Evidence level:** L2 (audit inference, not L3-retested after this cycle).

**Fix candidates (do NOT implement without dedicated cycle):**
- Bridge extends response shape to include `images: EvidenceRef[]` alongside `answer`
- Gallery strategy returns image URLs as `wood_cards`-shaped payload consumable by Pipeline C UI
- Wait for the "actual images in chat" capability Philip described (separate future feature)

---

## Gap #4 · No Recommendation strategy for Consult intent

**Symptom (from earlier audit):** "help me choose a staircase design" routes to Consult · Recommendation · Recommendation. No content-bearing strategy claims this shape. Falls to Unknown strategy · bridge falls through.

**Evidence level:** L2 (audit inference).

**Fix candidates (do NOT implement without dedicated cycle):**
- New Recommendation strategy that claims intent=Consult OR info=Recommendation OR domain=Recommendation
- Would need its own article corpus focused on decision-guidance content

---

## Gap #5 (NEW · discovered by this cycle) · Retrieval scoring blind to subject specificity

**Symptom:** the tie-break issue in Gap #1 is a symptom of a broader pattern: retrieval scores articles purely by token intersection count. An article whose subject is "Staircase" would match every staircase query at score 1 regardless of query specificity. There is no penalty for over-broad articles or bonus for narrowly-focused ones.

**Evidence level:** L2 (design-level analysis · not L3 stress-tested).

**Fix candidates (do NOT implement without dedicated cycle):**
- Subject specificity score: score = intersection / max(article_tokens, request_tokens) rather than raw intersection
- Boost for exact-phrase matches
- Router extracts multiple candidate subjects and providers score against best match

---

## What authoring successfully proved

The article was retrieved for the target query. The retrieval pipeline works. The Runtime Core Router correctly identifies the customer intent (Buy · Inquiry · Sales). The Customer FAQ strategy correctly claims the request. Only the tie-break and confidence-threshold gaps prevent customer-visible improvement.

**Rule-compliance of the authored article:**

- ✓ No invention (every fact traceable to `staircase-design-principles.md`, `customer-faq-staircase.md`, or `customer-buying-guide-principles.md`)
- ✓ No image claims (explicit disclaimer near end of article: "We do not currently return live inspiration images inside chat")
- ✓ Sources cited by absolute file path
- ✓ Extraction method labelled `verbatim_selected`

**File created:** `data/nex-reference-brains/staircase-preparation/expert-notes-philip-ofarrell/staircase-instances/nex-knowledge-base-staircase-design-ideas-and-inspiration.md` (~180 lines)

**Knowledge index:** 18 → 19 complete articles.

---

## Recommendation

The four separate problems identified by the pre-authoring audit are real and remain unfixed. Add this cycle's Gap #5 (retrieval tie-break) to the runtime backlog.

Under the mission's discipline ("no runtime changes without evidence-backed cycles"), each gap earns its own cycle when Philip's cost/benefit judgement chooses to open one. Ranked by number of target queries the fix would unlock:

| Gap | Queries fixed | Cycle type |
|---|---|---|
| #2 · Definition threshold or Router aliases | 4 of 5 (queries 2–5) | Router or strategy · Router v1 freeze consideration |
| #1 or #5 · Bridge citation selection / retrieval scoring | 1 of 5 (query 1 · gateway vs design-ideas) | Bridge or Knowledge Provider · pure additive |
| #3 · Gallery bridge · images in chat | Different query set (image-shape queries) | Bridge extension + response shape · Pipeline C UI already handles wood_cards |
| #4 · Recommendation strategy | Different query set (Consult intent) | New strategy · same pattern as previous strategy builds |

No cycle initiated. No routing, gallery behaviour, threshold, or Recommendation strategy touched.
