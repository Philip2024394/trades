---
title: Cross-Topic Intent Recognition — one utterance spanning multiple concepts
provenance: philip-supplied-directive-2026-08-14
brain: staircase_brain
domain: STAIRCASE
authoritative: true
purpose: recognise_when_one_utterance_spans_multiple_concept_families_and_handle_as_one_conversation
---

# Cross-Topic Intent Recognition — one utterance, many concepts

Customers rarely stay inside neat trade-terminology categories. A single sentence can span starting step + balustrade + landing + design preference all at once. NEX must handle it as **one conversation** — not three isolated searches — and not force the customer to break their thought into chunks.

**Locked rule:** never respond to a compound utterance with a single concept's answer while ignoring the others. Either address all of them briefly, OR explicitly acknowledge the multi-topic scope and ask which to prioritise.

---

## The compound-utterance detection pattern

An utterance is **compound** if it contains more than one concept-family signal. Example signals per family:

| Family | Signal keywords / phrases |
|---|---|
| starting_step | first step · bottom step · bullnose · curtail · flared bottom · big first tread · entry step |
| balustrade | spindles · balusters · railing · glass · metal · turned wood |
| landing_railing | landing · upstairs rail · around the top |
| design_style | modern · traditional · minimalist · grand · Scandinavian · Victorian · industrial |
| construction | wall-fixed · against a wall · open on both sides · cut-string · closed-string |
| finish | carpet · runner · step mats · exposed timber · painted · stained |
| understair | under the stairs · under-stair · storage · office |
| lighting | LED · lights · illuminated · glowing · night-lit |
| refacing | refurb · update · modernise · reface · redo · makeover |

If two or more families appear in one utterance → it's compound. NEX must handle all of them.

---

## The five compound-handling shapes

### Shape XT-01 · Compact multi-answer
**Use when:** all named concepts are Clear and NEX has evidence for each.
**Template:** address each concept in one short sentence, then invite the customer to zoom in.

**Example:**
> **Customer:** "I want a wide first step in oak with glass balustrade above and a matching landing rail."
> **NEX:** "That maps cleanly to three linked choices: (1) extended-tread first step in oak — projecting forward for the width you're describing; (2) frameless glass balustrade with oak top handrail on the flight — glass reads modern-luxury and pairs well with an oak tread; (3) landing railing continuing the same glass-and-oak system for continuity. All three fit the same modern-with-oak design language. Want to zoom in on any of the three?"

### Shape XT-02 · Compound with one clear + one ambiguous
**Use when:** part of the utterance is Clear + part is Ambiguous.
**Template:** answer the Clear part directly, ask the clarifying question for the Ambiguous part.

**Example:**
> **Customer:** "I want the first step wider and something nicer around the landing."
> **NEX:** "Wider first step points to an extended-tread starting step — plain square projection if modern, rounded ends if traditional. 'Nicer' around the landing could go a few directions — do you mean a design upgrade (change of balustrade or handrail style), a physical extension (more balustrade around a bigger opening), or feature-lighting on the landing rail?"

### Shape XT-03 · Compound signalling a full design conversation
**Use when:** the utterance is a full-project description ("I want a modern staircase with...").
**Template:** briefly restate the design intent to confirm, then structure the next few turns as a design walk-through.

**Example:**
> **Customer:** "I want a modern staircase with a nice big first step, glass above it and something modern around the landing."
> **NEX:** "So we're building a coherent modern staircase: extended feature first step in your chosen timber, frameless glass balustrade on the flight, and a matching modern landing railing (glass or slim metal). Let me walk through the four choices that unlock the rest: (1) timber species for the treads and handrail (oak is the common modern pick), (2) whether the flight will be a full cut-string or a floating cantilever, (3) LED integration or none, (4) full carpet, runner, or exposed timber on the treads. Which one do you want to start with?"

### Shape XT-04 · Compound with construction constraint
**Use when:** the utterance combines aesthetics + construction type.
**Template:** confirm the construction constraint first (it bounds what's possible), then address the aesthetic choices within it.

**Example:**
> **Customer:** "It's a staircase against a wall — I want the first step to feel special and modern balustrade."
> **NEX:** "Wall-fixed staircase — so the first step's outward projection can happen on the free side only. For 'special' on the free side: extended square tread (modern-fitting) or a subtle bullnose (softer). For a modern balustrade: matt-black metal rods, brushed stainless verticals, or frameless glass. Any style-lean between architectural minimalist and warmer modern-transitional?"

### Shape XT-05 · Compound with cross-brain component
**Use when:** utterance spans Staircase Brain + a future-brain topic.
**Template:** answer the staircase side directly, honestly defer the future-brain side.

**Example:**
> **Customer:** "What's the price of a modern glass staircase and what code says about the handrail height?"
> **NEX:** "Two parts. On the design: modern glass staircase usually means frameless glass balustrade + timber (oak commonly) or steel structural + light oak treads — I can walk you through the design choices in detail. On price and code: NEX doesn't quote pricing (Business Brain not built — needs an actual quote against your specific staircase) and doesn't give specific handrail-height figures (Building Regs govern that for the specific installation). Do you want to work through the design first? Cost and regs both attach to the specific design once it's chosen."

---

## Cross-topic vocabulary NEX should recognise

**Style-language keywords that unlock multiple concept families at once:**

| Word | Unlocks |
|---|---|
| modern / contemporary / minimalist | balustrade + newel + starting-step + timber-vs-metal + finish preference |
| traditional / classical / period / Victorian | turned-newel + volute + bullnose + turned-spindle + oak/mahogany |
| Scandinavian | pale timber (oak/maple) + slim spindles + glass + light finish |
| grand / imperial / mansion | wider staircase + curtail + volute + turned newels + carpet runner |
| industrial | matt-black metal + steel stringer + concrete/oak treads + cable rail |
| coastal | white/pale timber + rope handrails + glass + light finish |
| architect-modern / luxury | cantilever + frameless glass + LED + brushed stainless + minimal newel |
| rustic / cottage / farmhouse | pine + turned-spindle-or-square + painted balustrade + natural finish |

When a style-language keyword appears, NEX should recognise the implied cascade of preferences and use it to narrow the compound response.

---

## Cross-topic conversation examples

### CONV-XT01 · Full design conversation from one utterance

**Turn 1:**
> Customer: "I want a modern staircase with a nice big first step, glass above it and something modern around the landing."

> NEX: "So we're building a coherent modern staircase: extended feature first step in your chosen timber, frameless glass balustrade on the flight, and a matching modern landing railing. Let me walk through the four choices that unlock the rest: (1) timber species for the treads and handrail, (2) full cut-string flight or floating cantilever, (3) LED integration or none, (4) full carpet, runner, or exposed timber on the treads. Which one do you want to start with?"

**Turn 2:**
> Customer: "Oak, cantilever, LED yes, exposed timber."

> NEX: "Locked in: oak throughout · cantilever floating treads · LED integration · exposed timber (no carpet). That gives you: floating oak cantilever treads with black steel wall-side spine or steel stringer, frameless clear glass balustrade with oak top handrail, LED under-nosing on each tread (subtle glow spilling from below the front edge), extended square oak first tread projecting into the entry, matching frameless glass around the landing opening. Any of those specifics you want to challenge or refine?"

**Turn 3:**
> Customer: "What holds the glass up?"

> NEX: "Two common patterns for frameless glass: (a) glass panels with matt-black stainless clamps at the top and bottom edges — a slim structural strip is visible; (b) point-fixed glass with hidden bolts through the glass into the timber cap — clamps invisible, most minimal look. Both fit the modern-oak language; (b) reads slightly more architectural. Preference?"

---

### CONV-XT02 · Compound with clear + ambiguous

**Turn 1:**
> Customer: "I want the first step wider and something nicer around the landing."

> NEX: "Wider first step points to an extended-tread starting step — plain square projection if modern, rounded ends if traditional. 'Nicer' around the landing could go a few directions — a design upgrade (change of balustrade or handrail style), a physical extension (more balustrade around a bigger opening), or feature lighting on the landing rail?"

**Turn 2:**
> Customer: "Design upgrade. Current landing is just plain white spindles."

> NEX: "OK — current is plain white spindles on the landing. A few upgrade directions that all continue the extended-first-step reading: (1) swap to slim brushed stainless verticals — reads modern-transitional; (2) swap to matt-black metal rods with plate accents at the centre — reads more architectural; (3) swap to frameless glass panels — most open and modern. Do you want the landing to match the staircase spindles or deliberately step up above the flight?"

---

### CONV-XT03 · Cross-topic with construction constraint

**Turn 1:**
> Customer: "Wall on one side. Want a fancy first step and traditional railing all the way up."

> NEX: "Wall-fixed means the first step's decorative projection happens on the free side only — that's the geometry, not a design limit. For 'fancy' + traditional: bullnose or curtail wrapping around the free-side newel, matched to turned timber spindles + turned newel + moulded oak handrail on the flight and continuing around the landing. If you want the traditional statement version, a curtail with a volute on the bottom newel is the most decorative single move. Which direction — subtle bullnose or full curtail-with-volute?"

---

### CONV-XT04 · Compound spanning refacing scope

**Turn 1:**
> Customer: "Old pine staircase. Want a modern look without ripping it out."

> NEX: "Classic refacing scope. Common moves that don't touch the staircase structure: (1) replace spindles — pine turned → matt-black metal rods (biggest single visual change); (2) swap newel caps — cottage cap → flat modern cap or LED-inset; (3) sand and refinish the pine treads (or stain darker); (4) add step mats or a runner if the pine is too worn to expose. Want to work through those in order of impact, or do you have a specific look in mind already?"

---

### CONV-XT05 · Cross-brain compound

**Turn 1:**
> Customer: "Modern cantilever staircase — what will it cost and does it meet code?"

> NEX: "Two parts, both routed honestly. On design: cantilever + modern usually means floating oak treads on a black steel wall-side spine or dual side-stringers, frameless glass balustrade, LED under-nosing. I can walk through the full design and materials. On cost: NEX doesn't quote pricing (Business Brain isn't built) — the specific figure needs an actual quote against your staircase. On code: UK Building Regulations govern cantilever compliance (specifically maximum tread deflection, secure fixing to structural material, guardrail heights) — those need checking against the actual regs for your installation, not a generic figure. Do you want to work the design side first? Cost + regs both attach once the design is chosen."

---

## Meta-rules

- **Never split a compound utterance into isolated searches.** Recognise the whole thing.
- **Style-language keywords cascade.** "Modern" implies balustrade + finish + starting-step choices simultaneously.
- **Never dump all sub-answers.** Address briefly + invite zoom-in on one.
- **State carries.** Once a customer establishes "modern + oak + cantilever", subsequent turns don't need to re-ask.

## Cross-references

- `conversational-families.md` — 14 question types per concept
- `conversation-state-model.md` — state architecture
- `customer-language-glossary.md` — style-language vocabulary
- `intent-patterns.md` — single-concept routing (falls back when compound utterance doesn't apply)
- `frustration-recovery-patterns.md` — recovery when compound handling fails
