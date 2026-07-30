# NEX Knowledge Placement Audit

**Prepared for:** Philip O'Farrell · Founder
**Report date:** 2026-07-30
**Scope:** Representative sample across ~55 files · `docs/nex/`, `docs/brains/`, `data/nex-reference-brains/`, `src/lib/nex/`
**Rule respected:** ZERO content rewritten. Read-only classification. Every quote verbatim.

---

## Section 1 · Sample Classification Table (representative · 28 rows)

| Existing knowledge (file:line) | Destination brain | Reason | Category | Action |
|---|---|---|---|---|
| Winder definition + space-saving insight (trade-terminology.ts:180-185) | Reflex | Instant term answer · customer-phrase bridge ready | Valuable NEX | Live · this is the model for all Reflex entries |
| Newel post definition + "gives the staircase its character" (trade-terminology.ts:120-124) | Reflex | Trade reflex · carries expert insight in trade_insight field | Valuable NEX | Live · moat-building |
| Hidden Question Engine · "How much is a bespoke stair?" means "can I afford this?" (_composer.ts:142-149) | Wisdom | Bridges customer language to what they actually mean | Valuable NEX | Already in system prompt · core to Composition |
| "A staircase is often the first thing people see when entering a home" (staircase-design-principles.md) | Wisdom | Design judgement · context for importance framing | Valuable NEX | Referenced · needs Wisdom routing |
| "Oak is a hardwood" (generic definition context) | — | Factual · any AI has this · no judgement | Generic AI info | Not worth housing · let Anthropic answer if needed |
| Customer phrase "wood bit you walk on" → tread (human-language-map.json:34-51) | Observatory | Human language bridge · customer describes WITHOUT trade term | Valuable NEX | Live · 16 phrases · example of the moat |
| "Price without specification is incomplete" · Principle 1 (wood-intelligence-principles.md:19-34) | Expert | Professional reasoning · separates generic "staircase costs £X" from expert "here's why two quotes differ" | Valuable NEX | Evidence layer · needs Expert Brain authoring |
| Stopped wedge principle · "wedge stopping ≠ fully seated joint" (stopped-wedge-principle.md:32-56) | Expert | Workshop observation · apprentice vs skilled assembler | Valuable NEX | Layer 1 evidence · Priority 1 for Expert Brain build-out |
| Radiator effect · thermal stress on joints (radiator-effect-on-timber.md:33-47) | Expert | Workshop experience · probabilistic · environmental risk pattern | Valuable NEX | Layer 1 · MEDIUM confidence · pending manufacturer warranty verification |
| "Spend more on: handrail · visible treads · newel posts" (staircase-design-principles.md:66) | Wisdom | Design decision framework · "where the eye goes" principle | Valuable NEX | Needs Wisdom composer routing for "what should I spend on?" |
| Housing depth · "12mm or 0.4×thickness, whichever is greater" (housing-depths.md:35-62) | Expert | Specification rule · scales with string thickness · drives tread/riser length calc | Valuable NEX | Awaiting BWF citation · foundational for Geometry Module |
| Answer Shape 1 · "The main choices are pine, oak and walnut..." (_composer.ts:115-117) | Wisdom | Comparison logic · shape 1 template composes with decision context | Valuable NEX | Live in system prompt |
| Character Layer · match customer word "nice" to "style exploration" (conversation-character-layer.md:105-124) | Wisdom | Emotion mapping · translates vague language to design direction | Valuable NEX | Specified · not yet routing · bridges to design-intent frame |
| "A designer saves money as often as they spend it" · Principle B (staircase-design-principles.md:51-76) | Wisdom | Expert judgement on value · counters customer assumption · guides design stage timing | Valuable NEX | Strong evidence · ready for Wisdom Brain composition |
| Material quality application-specific · Handrail lamwood vs long solid (wood-intelligence-principles.md:71-116) | Wisdom | Contrasts generic rankings with context · "best" depends on where/how | Valuable NEX | Strong principle · needs Wisdom Brain authored response |
| Top tread machining detail · special joint treatment (referenced in stopped-wedge-principle.md) | Expert | Layer 2 priority #2 · specific construction technique | Valuable NEX | Evidence file exists · not yet structured Expert Brain |
| "NEX exists to become wiser about the people it serves" (living-intelligence-architecture-v1.md:7) | — | Guiding compass · not knowledge · architectural principle | Valuable NEX | Keep in constitutional docs |
| Observatory Map 1 · Language → Trade Term · 7 concepts (human-language-map.json) | Observatory | Homeowner phrase translation · bridges gap in customer language | Valuable NEX | Live and growing · core moat |
| Observable gap: "thread" typo for "tread" · correction fires (trade-terminology.ts:53) | Observatory | Customer error pattern · correction pattern established | Valuable NEX | Common_mistakes field already populated for tread |
| Principle G · staircase belongs to architectural family · door/skirting pairing (staircase-design-principles.md:137-149) | Wisdom | Design systems thinking · holistic interior language | Valuable NEX | Rich examples · ready for Wisdom composition |
| Timber lifecycle · tree to graded board (timber-lifecycle-principles.md:20-149) | Expert | Manufacturing intelligence · value set before log reaches mill | Valuable NEX | Layer 1 evidence · strong framework · Expert Brain candidate |
| Confidence signalling rule · "70% confident: soften slightly" (_composer.ts:136-140) | Wisdom | Meta-rule · governs tone matching to evidence quality · prevents false certainty | Valuable NEX | In system prompt · enforced at response level |
| Product Constitution Principle 0003 · "Judgement not Verdict" (expert-voice-standard.md) | Wisdom | Framing rule · recommends with visible reasoning · names alternatives | Valuable NEX | Constitutional · already enforced |
| "The staircase should not be designed alone" · Principle G context (staircase-design-principles.md:117-124) | Wisdom | Scope expansion · architecture-wide implications | Valuable NEX | Needs context-aware Wisdom routing |
| Early designer involvement saves money (staircase-design-principles.md:22-48) | Wisdom | Timing principle · "peak value at house design stage" | Valuable NEX | Strong · quote-ready · Wisdom Brain candidate |
| Proportions matter as much as materials (staircase-design-principles.md:120-124) | Wisdom | Aesthetic + function composition principle | Valuable NEX | Principle E · needs Wisdom routing |
| Four verbs opening · "create · solve · improve · understand" (living-intelligence-architecture-v1.md:113-121) | Wisdom | Locks first-response tone · widens welcome · Soul-critical | Valuable NEX | Specified · in implementation scope for Phase 0 |
| Expert Voice Standard · 50% reduction rule (expert-voice-standard.md:93-99) | Wisdom | Meta-authoring guidance · tone control | Valuable NEX | Constitutional · guides new Expert/Wisdom authoring |

---

## Section 2 · Brain Coverage Report

### REFLEX COVERAGE

**Concepts with full entries:** 10 (winder · newel post · tread · riser · string · nosing · baluster/spindle · handrail · landing · volute)

**Concepts with translation-only:** 4 (trimmer · closed_string · cut_string · housed_string) + dogleg/half_landing + stairwell/floor_opening from earlier

**Missing critical Tier 1 concepts:**
- **rise · going · pitch** (foundational geometry vocabulary · appears throughout docs but no Reflex entry)
- **headroom** (regulatory + practical · appears in geometry spec · no Reflex)
- **open riser / closed riser** (appears in component library · no Reflex)
- **handrail profile / grip diameter** (technical detail customers ask about · no Reflex)
- **pitched vs flat roof opening** (installation-specific · no Reflex)

**Assessment:** Reflex is ~15-20% complete against a working staircase professional's vocabulary. Strong existing entries carry expert voice (winder · newel post). **Tier 1 geometry vocabulary is the biggest gap** given how often homeowners hit these concepts.

---

### EXPERT COVERAGE

**Strong topics:**
- Timber/material reasoning · 12 principle docs authored · framework complete
- Workshop assembly · stopped-wedge · housing depths · top-tread machining · solid Layer 1 evidence
- Design principles A-G · architectural integration · spend-where-visible reasoning
- Staircase geometry fundamentals · regulations cited (Approved Doc K · BS 5395 · BWF)

**Weak topics:**
- **Troubleshooting diagnosis** — only radiator effect documented · broader complaint taxonomy missing
- **Refurbishment / repair sequences** — maintenance guide authored but not Expert Brain structured
- **Safety reasoning** — building regs cited but not comparative (what matters most to homeowners)
- **Handover documentation** — specification best-practice, drawings to request, sign-off procedures not captured

---

### WISDOM COVERAGE

**Strong topics:**
- Design decision framing (oak vs walnut · Principle B · modern vs traditional)
- Emotion translation (Character Layer maps "expensive" → premium appearance)
- Customer worry mapping ("can I afford this?" · "will it fit?" · "can I trust this?")
- Budget composition (spend more on visible · less on hidden)
- Architectural belonging (door family · skirting language · Principle G)

**Weak topics:**
- **Timing decisions** — "should I replace or repair?" · "when is refacing worth it?" · frame incomplete
- **Lifestyle fit** — young family · high traffic · dark vs light homes · not captured
- **Second-guessing override** — customer said "modern" but house is Georgian · gentle-guide script missing
- **Budget defense** — "why is bespoke expensive?" · principle ready but no full Wisdom answer yet

---

### EMOTION / CONTEXT COVERAGE

**Signals covered:**
- Browsing mode · "I'm just looking" (character-layer:125-127)
- Frustration · direct challenge · "You're wrong" (golden-replies:100-117)
- Uncertainty · "I don't know what I want" (golden-replies:130-134)
- Price resistance · "how much?" (character-layer:127-146)

**Signals weak/missing:**
- **Urgency** — "damaged and I have guests next week" · not captured
- **Buyer's remorse** — "I'm second-guessing my oak choice" · not addressed
- **Trust deficit** — "my builder ruined this" partially in Constitution 0004 but not Emotion Brain context
- **Overwhelm** — addressed reactively but no proactive detection
- **Status anxiety** — "is my staircase nice enough?" · aspirational but insecure · not mapped

---

### OBSERVATORY COVERAGE

**Concepts with 5+ homeowner phrases:** 4 (tread: 16 · newel post: 15 · winder: 8 · string: 11)

**Concepts with 1-4 phrases:** ~6 (volute · riser · nosing · balusters · handrail · landing — smaller sets)

**Missing customer language around:**
- **Symptom language** — squeaks · gaps · movement · settling · creaks (biggest single gap)
- **Handrail** — "rail" · "banister" · "pole" · "support" (peripheral component)
- **Baluster/spindle** — "sticks" · "posts holding the rail" (peripheral component)
- **Landing** — how homeowners describe it naturally
- **Headroom** — "can I stand up on the stairs?" · "ceiling clearance"
- **Pitch / angle** — "steep?" · "comfortable?"
- **Carpet vs no carpet** — "finished" vs "bare" language
- **Material cost drivers** — "what makes one more expensive?"

**Assessment:** Observatory Map 1 is ~25-30% complete on critical concepts. Strong on core components. **Major gap in symptom/problem language** — this is where diagnosis moat lives.

---

## Section 3 · Top 10 Valuable NEX Judgement Moments (PROTECT · do not rewrite)

Quotes verbatim · these are the assets that would be lost if a generic AI rewrote them.

1. **"A wedge reaching its stopping point does NOT guarantee that the tread or riser has fully seated against the routed housing shoulder."** (stopped-wedge-principle.md:34) — separates apprentice assumption from expert practice · no published citation.

2. **"Don't put oak everywhere if carpet covers the tread."** (Principle B · staircase-design-principles.md:55-62) — contradicts customer instinct · expert reasoning on value perception.

3. **"The value of a staircase designer decreases sharply the later they are involved. Peak value is at the house design stage; near-zero value is the day the installer arrives."** (staircase-design-principles.md:46-47) — timing principle · changes entire sales conversation.

4. **"Long solid hardwood handrail can bow, twist, or move as moisture changes — it follows the grain. Lamwood counteracts this by opposing grain directions between strips."** (wood-intelligence-principles.md:81-88) — material science + craft · removes "solid = always better" assumption.

5. **"A staircase is often the first thing people see when entering a home. The starting step is a design opportunity: bullnose, curtail, feature newel, open tread start."** (staircase-design-principles.md:89-103) — reframes technical component as emotional touchstone.

6. **"Professional assembly relies on confirming the joint is closed — visually and physically — not on how hard the wedge resists."** (stopped-wedge-principle.md:56) — inverts amateur measurement to expert measurement.

7. **"The lowest price is often mostly explained by the reduced material specification — thickness, profile size, section — and the customer usually doesn't know that."** (wood-intelligence-principles.md:23) — pricing transparency · explains quote differences without making competitors look bad.

8. **"A customer says 'expensive' but means 'premium appearance.' A staircase feels expensive because of proportion, finish, handrail profile, and lighting — not always because of timber species."** (conversation-character-layer.md:105-124 + principles composed) — bridges emotion to specification · budget-smart premium.

9. **"A radiator positioned directly beneath a timber staircase produces continuous warm, dry air that rises through the staircase... contributing to opening joints, squeaks, and shrinkage around strings and newels."** (radiator-effect-on-timber.md:35-47) — complaint diagnostic traceable to household detail · trust-building.

10. **"The staircase should not be designed alone. It should belong to the architectural family of the house — doors, skirting, architraves, flooring, wall panels, lighting all form one design language."** (staircase-design-principles.md:138-150) — scope principle · prevents isolated-component thinking.

---

## Section 4 · Top 10 Missing Interpretation Links (highest-value gaps)

Knowledge EXISTS · human-language BRIDGE doesn't. These are gold.

1. **Housed vs cut string** — knowledge in geometry docs · NO customer phrases. Add: *"side board that holds the steps"* · *"routed side board"* · *"tread slot in the wood"* · *"how many ways can you attach a step?"*
2. **Headroom** — Approved Doc K regulations documented · NO customer phrases. Add: *"height above the stairs"* · *"bumping my head"* · *"ceiling clearance"* · *"standing room on the landing"*
3. **Rise/going comfort principle** — Principle E authored · walk comfort = f(rise:going) · NO customer symptom phrases. Add: *"feels steep"* · *"hard on knees"* · *"short steps"* · *"tiring to climb"*
4. **Material cost drivers** — Principle 1 (thickness/profile drives 10-30% cost) · NO customer language. Add: *"what makes cost go up?"* · *"why is this more expensive?"* · *"is it just the wood?"* · *"what am I paying for?"*
5. **Open vs closed riser** — component library spec · NO customer phrases. Add: *"see through the staircase"* · *"open underneath"* · *"solid steps"*
6. **Refurbishment vs replacement** — maintenance guide + refacing overview authored · NO symptom phrases. Add: *"worn stairs"* · *"looks old"* · *"scuffed up"* · *"paint is peeling"* · *"wood looks tired"*
7. **Baluster/spindle** — component library defines · huge phrase gap. Add: *"the sticks"* · *"spindles"* · *"posts holding the rail"* · *"banister bits"*
8. **Wedge assembly** — stopped-wedge principle authored · DIY-facing phrase list absent. Add: *"is my wedge tight enough?"* · *"my wedge stops but is the stair loose?"*
9. **Squeak/movement diagnosis** — multiple causes scattered · NO unified diagnosis bridge. Add: *"squeaky stairs"* · *"creaking when I walk"* · *"noise from the stairs"* + route to Expert Brain multi-cause diagnosis.
10. **Lighting as design element** — lighting docs authored · NO customer feeling-to-lighting bridge. Add: *"make it look fancier"* · *"add light"* · *"make it stand out"* → route to Wisdom + Lighting context.

---

## Section 5 · Big-Picture Summary

**The moat exists · it is NOT evenly distributed.**

**Reflex Brain:** 15-20% complete with world-class entries. Winder and newel post are textbook — they carry `trade_insight` a generic AI simply doesn't have. But foundational geometry vocabulary (rise · going · headroom · pitch) is conspicuously absent. **Priority: ship Tier 1 vocabulary before expanding to nice-to-have concepts.**

**Expert Brain:** Evidence layer is strong (stopped-wedge · housing depths · timber lifecycle · material reasoning). The translation from evidence → operationalised expert answers is the incomplete gate. **Layer 2 authoring is the next real ship.**

**Wisdom Brain:** Principles authored (design · emotion translation · architectural belonging). Composition routing is incomplete — Wisdom not yet reliably capturing complex "should I?" decisions. System prompt is strong but needs pairing with persistent user context (Living Memory).

**Observatory:** 25-30% phrase coverage of critical concepts. Massive gaps in symptom language (squeaking · gaps · movement) · peripheral components (handrail · baluster · landing) · material questions. **This is where the next 6 months of growth lives — the human-vs-professional-language gap Philip named as the actual moat.**

**The drift risk:** Generic FAQ migration. `docs/brains/` shows early FAQ authoring (`staircase-maintenance-faq` · `staircase-carpet-colour-selection`). These MUST NOT become the pattern — exactly the failure mode Philip warned against. Expert + Wisdom Brains must compose contextually, not retrieve pre-written FAQs.

**The biggest single opportunity:** Customer language for DIAGNOSIS. NEX has expert knowledge of what goes wrong (radiator · joint failure · timber movement). It has almost NO customer-language bridge for *"my stairs squeak"* → diagnosis. **This is where the Observatory becomes critical.**
