# NEX Human Language Observatory · design spec

**Established:** 2026-07-30 · Philip O'Farrell
**Status:** DESIGN ONLY · not yet implemented · phased build plan below
**Position:** growth engine for the Reflex Brain and Trade Terminology library
**Companion:** `docs/nex/expert-voice-standard.md` · `src/lib/nex/reflex/trade-terminology.ts`

---

## The gap this exists to close

Staircase language has a huge gap between trade vocabulary and homeowner vocabulary. That gap is where an expert assistant can feel genuinely different.

**Normal AI learns:** *"What is the definition of a newel post?"*
**NEX must learn:** *"How do people who don't build stairs describe a newel post?"*

The second one is much harder — and much more valuable. Generic AI has the definitions. Only NEX has the translation map.

Philip 2026-07-30:

> *"The best places [to find customer language] are where people ask questions naturally: search queries, forums, reviews, sales conversations. The wording is much more valuable than the answer."*

---

## The five immutable rules (Philip 2026-07-30 · LOCKED)

**Rule 1 · Anti-scrape:**

> *"NEX does NOT scrape the internet. NEX observes its own conversations and lets an expert approve what enters the trade knowledge library."*

**Rule 2 · Phrases are bridges, never answers:**

> *"Do not allow customer phrases to become answers. A phrase is only a bridge."*

The moment a customer phrase becomes a canned answer, NEX starts to become a search engine. The observatory captures HOW people describe things · it never becomes a database of what to say back. Every match still hands off to a real expert-authored answer (Reflex trade_insight · Composer response · Wisdom synthesis).

**Rule 3 · Research vs knowledge:**

> *"Every conversation is research, but not every conversation becomes knowledge."*

Observation ≠ ingestion. Ingestion requires expert judgement. Most conversations teach nothing new (customer used a phrase already in the map · or asked a fully-answered question). A few conversations reveal a genuine gap. Only the gaps become new library entries · and only after expert approval.

**Rule 4 · Discover gaps, never author answers:**

> *"Do not learn answers from conversations. Learn where human language does not match expert language. Surface those gaps for expert approval."*

The Observatory's ONLY job is to identify where a customer's phrasing didn't match anything in the current map. It never generates a candidate answer · never proposes a definition · never fills a trade_insight. It says "this phrase appeared 22 times and no map entry caught it — should this be a new translation to concept X?" The expert then decides yes/no/new-concept.

**Rule 5 · Claude can discover · cannot create the expert:**

> *"Claude can discover gaps. Claude cannot create the expert."*

Philip 2026-07-30: *"If Claude writes 10,000 staircase answers from the internet, you have another chatbot. If NEX watches 10,000 real homeowner conversations and a staircase expert approves the interpretations, you have something much harder to copy. That keeps the moat exactly where you want it: interpretation, not information."*

**Rule B applies at every stage.** AI extracts candidates. Expert approves. Only expert-approved translations enter production.

---

## The three-map architecture (Philip 2026-07-30 · target design)

The Observatory eventually produces THREE separate maps, each answering a different question about what the customer meant. All three feed different tiers of the Consciousness Layer.

### Map 1 · Language → Trade Term (Reflex tier)

**Question:** *"What people call things."*

| Human phrase | Trade term |
|---|---|
| *"wood bit you walk on"* | tread |
| *"big post holding the rail"* | newel post |
| *"side wood holding the steps"* | string |
| *"spiral bit at bottom of the handrail"* | volute |
| *"triangle steps around the corner"* | winders |

**Current status:** V1 · 7 concepts authored in `data/nex/human-language-map.json` · this is the map already shipping.

**Runtime:** Reflex Brain uses it to serve sub-100ms terminology answers.

### Map 2 · Language → Intent (Wisdom tier · not templates)

**Question:** *"What is the customer actually trying to do?"*

| Human phrase | Not asking about | Actually asking for |
|---|---|---|
| *"Can I make my stairs look more modern?"* | definition of "modern staircase" | design advice · inspiration · material options · maybe replacing balustrade only |
| *"Would this look better with lighter wood?"* | wood definitions | help visualising the trade-off · confidence in a decision |
| *"Is this staircase worth keeping?"* | market value | reassurance · restoration vs replacement recommendation |

**Current status:** NOT YET SHIPPED. Design captured here for future authoring.

**Runtime:** intent map routes the message to WISDOM (composer with full context + memory) · never to Reflex templates. Getting this wrong is a *"too shallow"* router failure — the customer feels dismissed if their design question gets a definition answer.

### Map 3 · Language → Emotion / Context (Wisdom tier · Soul-critical)

**Question:** *"What is the customer FEELING, and what do they need before advice?"*

| Human phrase | Normal AI sees | Staircase expert sees |
|---|---|---|
| *"My builder has left me with this staircase and it looks wrong"* | "staircase problem" | customer is unhappy · probably wants reassurance · needs diagnosis before advice |
| *"We just moved in and I hate the stairs"* | "staircase question" | new-home anxiety · overwhelmed · not ready for spec-shaped answers |
| *"My father-in-law fell on the stairs last week"* | "safety question" | urgency · fear · needs empathy before any technical response |

**Current status:** NOT YET SHIPPED. Design captured here for future authoring.

**Runtime:** emotion/context map signals the composer (or Wisdom) to slow down · lead with acknowledgement · fold Principle 0004 (Safety First) into the response shape · never lead with a spec.

---

## The Learning Observatory · signals per Anthropic answer (Philip 2026-07-30 · design locked · V2+ build)

Every conversation that falls through to Wisdom (the composer + Anthropic call) generates observation signals BEFORE expert approval decides what enters production. The signals per answer:

| Signal | Meaning |
|--------|---------|
| **phrase_observed** | The exact customer phrasing that missed the current map · verbatim |
| **concept_suspected** | The map concept the phrase most likely maps to (nearest-neighbour guess · not committed) |
| **answer_quality** | Post-hoc: did the composer answer well? (proxy signals: user thumbs up/down · session continued · user asked follow-up implying the answer landed) |
| **repeat_count** | How many times this phrasing (or a near-duplicate) has appeared across all users |
| **confidence** | 0-100 · nearest-neighbour similarity to an existing map entry |
| **expert_review_status** | unreviewed \| clustered \| approved \| rejected \| duplicate |

### The queue an expert sees

```
1. "wood bit you walk on"
   → suspected concept: tread
   Seen: 22 times · Confidence: 99%
   Approve as new customer_phrase on tread entry?  [Y/N/Merge]

2. "side wood holding steps"
   → suspected concept: string
   Seen: 8 times · Confidence: 94%
   Approve as new customer_phrase on string entry?  [Y/N/Merge]

3. "can I make stairs modern"
   → suspected map: Map 2 (Intent · not term)
   Seen: 6 times · Confidence: 87%
   Route to Wisdom (design-advice intent) rather than adding as phrase?  [Y/N]
```

### Split by map at surface time

The queue reviewer picks not just approve/reject but which of the three maps the candidate belongs to:

- **Map 1 candidate** — phrase describes a THING · gets a target_concept · goes on trade-terminology-adjacent people_say list
- **Map 2 candidate** — phrase describes an INTENT · doesn't get a term · marks the intent-signalling pattern for Wisdom routing
- **Map 3 candidate** — phrase carries EMOTION · signals the composer to slow down · lead with acknowledgement

This split IS the intelligence — the reviewer decides which of the three maps a candidate belongs to. A generic system would only have Map 1 · that's the failure mode.

### The critical guardrail (Rule 4 · restated)

The Learning Observatory NEVER proposes:
- Definitions
- Trade insights
- Answer templates
- Response wording

It ONLY proposes: *"this phrase appeared N times · nearest concept looks like X · confidence Y% · route to which map?"* Everything else is the expert's decision. This is the difference between an observatory and a scraper.

---

## Provenance shape for map entries (V2+ observatory)

Every phrase-to-concept mapping should eventually carry:

```
phrase: "wood bit you walk on"
observed_count: 34            (how many times NEX has seen this phrasing)
confidence: 98               (100 = unambiguous · 70 = probably · 40 = ambiguous)
approved_by: "Philip O'Farrell"
approved_at: "2026-07-30"
map: "trade_term"            (Map 1 · Map 2 · Map 3)
target_concept: "tread"
```

**Confidence rules:**
- **≥95%** — unambiguous · fire without correction
- **70-94%** — probably · fire with soft caveat ("*I think you mean...*")
- **40-69%** — ambiguous · do NOT auto-serve · surface to composer for judgement
- **<40%** — noise · reject

**Not yet in the JSON schema** — deferred until V2 miss-detection cron is built (per phased plan below). Provenance shape captured here so it's ready when the cron ships.

---

## The pipeline

```
   Real user conversations (hammerex_mate_messages · existing)
                          │
                          ▼
   Layer A · Miss Detection
   (identify messages where user asked a definition-shaped
    question BUT no Reflex terminology entry fired)
                          │
                          ▼
   Layer B · Candidate Grouping
   (cluster misses by likely intent using semantic similarity
    · surfaces "we saw 12 different phrasings this month
    that all seem to be asking about the same thing")
                          │
                          ▼
   Layer C · Expert Review
   (admin surface · Philip / Junior Francis reviews each cluster
    · one-click promote to a specific existing entry's
    customer_phrases[] OR mark as a new term needing authoring)
                          │
                          ▼
   Layer D · Promotion
   (approved phrases append to trade-terminology.ts entries ·
    Rule C provenance recorded · new term entries added to
    the authoring queue if the cluster represents an unmet term)
                          │
                          ▼
   Layer E · Feedback Loop
   (once promoted, the Reflex Brain starts serving those
    customer phrases · miss detection reduces · library grows
    with observation, not with imagination)
```

---

## What each layer looks like

### Layer A · Miss Detection

**Runs against:** `hammerex_mate_messages` · scheduled cron · e.g. daily

**Detects:** messages that (a) triggered the composer rather than Reflex AND (b) match a definition-question shape (starts with *"what is"* · *"define"* · *"explain"* · contains *"called"* / *"the name for"*)

**Output:** rows in a new `hammerex_nex_language_candidates` table with:

```
{
  candidate_id (uuid),
  user_surface (merchant | homeowner | visitor),
  user_message (text),
  message_id (fk to hammerex_mate_messages),
  detected_at,
  status: "unreviewed" | "clustered" | "approved" | "rejected" | "duplicate",
  cluster_id (nullable),
  proposed_target_term (nullable · set at Layer B),
  proposed_customer_phrase (nullable · the noun-phrase inside the message),
  rule_b_status: "AI_extracted" (locked at insert),
  approved_by (nullable),
  approved_at (nullable)
}
```

**Rule B:** the extracted phrase is a HYPOTHESIS. Never promoted without expert review.

### Layer B · Candidate Grouping

**Runs against:** unreviewed candidates from Layer A

**Method (V1):** simple text embedding similarity + clustering (e.g. all messages containing similar noun phrases group together). One cluster = one likely target term.

**Output:** cluster_id populated on candidates + `proposed_target_term` guessed from nearest entry in TERMINOLOGY (nullable · admin can override)

**No LLM authorship:** grouping is mechanical similarity, not semantic invention.

### Layer C · Expert Review (admin surface)

**Route:** `/admin/nex/language-observatory` (future)

**Displays:** one row per cluster with:
- Sample user messages (5 verbatim)
- Detected count (how often this cluster appears)
- Proposed target term (with confidence)
- Suggested new customer_phrase (extracted noun phrase)
- Admin actions:
  - **Approve** → append to target entry's `customer_phrases[]`
  - **Approve as new term** → open the terminology-authoring form
  - **Reject** → mark cluster as noise
  - **Merge** → combine with another cluster

**Every action** logs to `hammerex_nex_events` with the reviewer's identity per Rule C.

### Layer D · Promotion

**Approved clusters:**
- Append the extracted phrase to the target entry's `customer_phrases[]` in `src/lib/nex/reflex/trade-terminology.ts`
- Record `authored_by` (the approving expert) and `verified_at` (approval timestamp) at the entry level (not per-phrase for V1)
- Commit + deploy per normal release cycle

**Approved-as-new-term:**
- Opens the terminology authoring form (Philip fills definition + trade_insight)
- Entry starts with `authored_by: <expert>` · `verification_status: verified` · `reflex_appropriate: true`
- Deploys as a new Reflex entry

### Layer E · Feedback Loop

Once promoted, the Reflex Brain serves those customer phrases at sub-100ms with the expert-voice answer. Future misses on the same phrasing don't reach the miss-detection layer. The library grows in the exact directions real users push it.

---

## Storage

**One new table:** `hammerex_nex_language_candidates`

Migration deferred until Layer A + B are ready to ship. Design captured here so the shape is stable when it lands.

**Retention:** approved and rejected candidates retained for the audit trail (never destroyed · differs from user GDPR erasure which cascades to memories, per Decision 1 of the Living Memory Engine). Language candidates are META-data about phrasing patterns, not user-content proper.

---

## Data sources (Philip 2026-07-30 · ranked)

1. **Own conversations** (highest value · always available · properly consented via NEX's own privacy policy · full context on user surface + tier + prior turns)
2. **Search queries** (external · would require ingesting search-console data if NEX has SEO surface · lower priority for V1)
3. **Forums** (external · requires curation · easily contaminated with irrelevant chatter · use only as a manual authoring aid, never automated ingest)
4. **Reviews** (external · homeowners write "the big wooden pole at the bottom looks amazing" · manual authoring aid only for V1)

**V1 uses only source #1** — own conversations. External sources are optional manual authoring aids for Philip, never automated pipelines.

---

## What NEX does NOT do (locked)

- ❌ Scrape the internet
- ❌ Auto-promote candidates without expert review
- ❌ Author new definitions or trade insights (Rule B · that's Philip's or a named expert's pen)
- ❌ Modify the trade-terminology.ts file without a human approval action
- ❌ Learn from feedback signals alone (thumbs-down doesn't teach the Observatory — expert review does)
- ❌ Cross-contaminate user surfaces (homeowner-phrased miss doesn't populate merchant vocabulary or vice versa · phrasing patterns are surface-scoped)

Every "does NOT" above is a place other AI systems fail. Enforcing them is what makes NEX different.

---

## Phased implementation

**V1 · Manual harvest** (current turn's baseline):
- No infrastructure needed
- When a real user misses the router (like the *"wood bit you walk on"* case this turn), Philip surfaces the miss to Claude in-session, Claude adds the phrases directly to the entry, deploys.
- This turn's tread expansion is a V1 harvest ship.

**V2 · Miss Detection cron + candidate table**:
- Ship the `hammerex_nex_language_candidates` migration
- Ship the daily miss-detection cron reading `hammerex_mate_messages`
- Ship a simple admin route listing unreviewed candidates as raw messages (no clustering yet)
- Effort: ~2 days
- Ship when V1 harvest volume exceeds ~5 misses/week (i.e. worth the tooling)

**V3 · Clustering + Review UI**:
- Add similarity grouping to Layer B
- Ship the review UI with approve/reject/merge actions
- Add automated commit-generation (Layer D emits a diff Philip approves rather than manually edits the file)
- Effort: ~1 week
- Ship when V2 candidate volume exceeds ~20/week

**V4 · Continuous discovery**:
- Real-time miss capture (not just batch cron)
- Weekly summary email to Philip: "5 new candidate clusters awaiting review"
- Trend reporting: which trade terms are getting the most homeowner-language variants
- Effort: ~1 week
- Ship only if V3 review load stays sustainable

**Do NOT skip phases.** Each phase's utility justifies the next. Building V4 before V2 is exactly the kind of premature architecture Philip's 2026-07-30 warning was about.

---

## The value asset this creates

> *"How do people who don't build stairs describe a newel post?"*

That map — expert-approved, growing with observation, private to NEX — is a moat that a generic AI cannot replicate by scraping. Every conversation NEX has can teach the Observatory. Every approval by Philip or Junior Francis makes NEX a slightly better staircase professional in the next conversation.

Google has definitions. NEX has translations.

## The Interpretation Layer (Philip 2026-07-30 · LOCKED · post-200-example dataset)

The point of the Observatory is NOT to give NEX more answers · it is to give NEX better routing.

```
                Human words
                     │
                     ▼
           Interpretation Layer
                     │
       ──────────────┼──────────────────────────
       │             │             │           │
       ▼             ▼             ▼           ▼
    Reflex        Expert        Wisdom     Wisdom + context
   (What is       (How should   (What      (I have a problem
    this part      this be       should     or an emotion)
    called?)       built?)       I choose?)
```

**The one-line rule (IMMUTABLE):**

> *"The question is not 'does NEX know the answer?' — it is 'does NEX know what kind of answer the human needs?'"*

**Training dataset for the interpretation layer:** `data/nex-reference-brains/staircase-preparation/router-interpretation-dataset.md` (Philip 2026-07-30 · 5-row-per-brain seed dataset · extendable · every row is expert-authored classification data, never an answer template).

The failure mode the interpretation layer prevents: NEX becoming a giant FAQ machine that answers every question with the same energy. The intelligence is NOT knowing more answers — it is knowing which of four brains a human signal belongs to.

## The positioning line (Philip 2026-07-30 · LOCKED)

> *"Google has billions of questions. But Google does not know: when a homeowner says this phrase, what does a staircase expert understand? That is the gap. NEX should not compete with Google on information. It should compete on interpretation."*

Every future Observatory decision passes this test: **does this deepen NEX's interpretation of what people mean, or does it just add information NEX regurgitates?** If the latter, the ship makes NEX more like Google. Reject.

## The Core 100 milestone (Philip 2026-07-30 · next real milestone)

**Not this sprint. Named as the next-real-milestone after the current shipping cadence stabilises.**

**Target:**
- 100 trade concepts covered in the map
- 500+ homeowner phrases expert-approved
- Concept coverage spans: stair anatomy · materials · installation · repair · configuration · design terms

**Why 100 concepts + 500 phrases:** a staircase professional operates with roughly 100 core concepts they don't have to think about. If NEX covers those 100 and understands ~5 homeowner phrasings per concept, real conversations start feeling meaningfully different at that threshold.

**Authoring approach:** never AI-invented. Each concept + phrase list carried by Philip (or nominated named expert). Batches of 10-20 per session are plausible. Full Core 100 map is ~5-10 sessions of expert authoring, not code work.

**Do NOT ship Core 100 as an infrastructure project.** It ships as concept-by-concept authoring in the JSON file. When 100 concepts are in the file, the milestone is met · nothing else needed.

---

## Sign-off

Philip O'Farrell · 2026-07-30 · Observatory design spec locked. V1 (manual harvest) is the current operating mode. V2+ builds only when the volume of misses justifies the infrastructure — not before.

*"That is the asset."* — Philip O'Farrell, 2026-07-30
