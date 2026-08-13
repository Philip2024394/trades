---
title: Intent Patterns — input → intent tier → retrieval → follow-up
provenance: philip-approved-2026-08-14
brain: staircase_brain
domain: STAIRCASE
authoritative: true
purpose: classify_customer_input_and_route_to_appropriate_response_shape
---

# Intent Patterns — input → intent tier → retrieval → follow-up

This file is the routing layer between customer language and NEX's response shape. It classifies each incoming input into one of three confidence tiers and specifies the response shape.

**Locked rules:**
- Every pattern derives from evidence in the existing Reference Brain
- Ambiguous inputs → ASK first, do not answer
- Likely inputs → surface the interpretation + offer to adjust
- Clear inputs → answer directly with hedged nuance

---

## The three confidence tiers (recap)

| Tier | Definition | Response shape |
|---|---|---|
| **Clear** | Customer input contains enough information for direct answer | Direct answer + optional hedged nuance |
| **Likely** | NEX can guess the intent but should surface it | Hedged interpretation + partial answer + follow-up option |
| **Ambiguous** | Multiple valid interpretations — no single right answer | Short acknowledgement + clarifying question. STOP. Do not answer yet. |

---

## Pilot patterns · Starting steps

### Pattern SS-01 · Construction-type-first
**Input:** "I've got a staircase against a wall — what starting-step options do I have?"
**Intent tier:** Clear
**Concepts:** starting_step_options + wall_fixed_construction_type
**Retrieval:** `starting-steps-knowledge-2026-08-14.md` §1 + `starting-steps-types-carpet-and-design-2026-08-14.md` Part 1
**Response shape:** direct — enumerate the aesthetic options that are physically possible on a wall-fixed staircase (bullnose or curtail wrapping the free side · square platform · flush no-projection · extended tread projecting forward)
**Follow-up (optional):** "What style is the rest of the staircase — traditional, modern, or somewhere in between?"

### Pattern SS-02 · Bullnose-feasibility-with-construction-gap
**Input:** "Can I have a curved starting step if the stairs are against a wall?"
**Intent tier:** Clear (customer has already specified construction)
**Concepts:** curved_starting_step + wall_fixed_construction_type
**Retrieval:** Same as SS-01
**Response shape:** direct — yes on the free side (wall blocks outward wrap on the wall side). Explain why using construction/design hierarchy language.
**Follow-up (optional):** "Do you want the wrap to be subtle or a bigger feature?"

### Pattern SS-03 · Wider-first-step
**Input:** "Can I make the first step wider?"
**Intent tier:** Clear
**Concepts:** extended_tread_starting_step
**Retrieval:** `starting-steps-types-carpet-and-design-2026-08-14.md` Part 1 §11
**Response shape:** direct — yes, extended tread is a common option. Explain shape variations.
**Follow-up (optional):** "How much floor space is available at the bottom? An extended step needs somewhere to project into."

### Pattern SS-04 · Carpet + feature step
**Input:** "I want a nice first step because I'm carpeting the rest."
**Intent tier:** Likely (customer says "nice" — which decorative direction?)
**Concepts:** feature_starting_step + carpeted_flight + carpet_starting_step_design_tendency
**Retrieval:** `starting-steps-types-carpet-and-design-2026-08-14.md` Part 3 (carpet tendency)
**Response shape:** hedged interpretation. Confirm the "leave timber exposed" tendency. Offer the type choice.
**Follow-up:** "The common approach is to leave the first step exposed as a timber feature while the carpet begins on the flight above. Are you thinking more of a rounded bullnose, a curtail with a scroll, or a wider square feature step?"

### Pattern SS-05 · Ambiguous "fancy"
**Input:** "I want something fancy at the bottom of the stairs."
**Intent tier:** **Ambiguous**
**Concepts:** could be bullnose OR curtail OR volute OR wider tread OR contrasting timber OR feature newel OR combined
**Retrieval:** DO NOT retrieve yet
**Response shape:** ASK
**Response:** "There are quite a few ways to make the bottom step more of a feature. Are you thinking more about a rounded step, a wider first tread, or something more elaborate with a feature newel and volute? Also, will the rest of the staircase be carpeted or exposed timber?"

### Pattern SS-06 · Ambiguous "open"
**Input:** "Can you make the bottom look more open?"
**Intent tier:** **Ambiguous**
**Concepts:** could be flush first tread OR cantilever/floating OR less-crowded balustrade OR under-stair open OR glass balustrade
**Retrieval:** DO NOT retrieve yet
**Response shape:** ASK
**Response:** "That could mean a few different things. Do you want the balustrade at the bottom to feel less crowded, the first step to be flush and minimal, or the whole under-stair area opened up? Any of those directions would take us somewhere different."

### Pattern SS-07 · Terminology lookup
**Input:** "What's that rounded first step called?"
**Intent tier:** Likely (customer wants a name; could be bullnose / half-round / curtail)
**Concepts:** starting_step_terminology
**Retrieval:** `starting-steps-types-carpet-and-design-2026-08-14.md` Part 1 §2, §4, §20 (half-round)
**Response shape:** hedged answer
**Response:** "That's usually called a bullnose starting step — a rounded front edge on the first tread. If it wraps around the ends or curves back toward the staircase it might also be called a half-round or a curtail. Do you have a picture, or want me to describe the differences?"

---

### Pattern SS-08 · Two-balusters-per-tread
**Input:** "Can I have two balusters per step?"
**Intent tier:** Clear
**Concepts:** balusters_per_tread_typical
**Retrieval:** `landing-railings-continuity-and-construction-2026-08-14.md` §8.2
**Response shape:** direct — yes, two balusters per tread is a common practical starting arrangement for many traditional staircase designs. Hedge on actual applicability against actual tread width + Building Regs.

### Pattern SS-09 · Balustrade-less-crowded (Likely)
**Input:** "I want the railing to look less crowded."
**Intent tier:** Likely
**Concepts:** balustrade_less_crowded_slimmer_or_metal_or_glass
**Retrieval:** `landing-railings-continuity-and-construction-2026-08-14.md` §12 (continuity across systems) + batch 8 baluster families
**Response shape:** hedged interpretation
**Response:** "That usually points toward slimmer balusters, wider spacing (needs checking against Building Regs), or a switch to a more open-looking balustrade — matt black metal rods, brushed stainless, or glass panels rather than turned timber. Are you drawn more toward keeping it traditional but lighter, or moving modern?"

### Pattern SS-10 · Step-that-sticks-out terminology (Likely)
**Input:** "The step that sticks out — what's it called?"
**Intent tier:** Likely
**Concepts:** projecting_starting_step_terminology
**Retrieval:** `starting-steps-types-carpet-and-design-2026-08-14.md` Part 1 (bullnose / curtail / half-round / extended)
**Response shape:** hedged answer + confirm which
**Response:** "That's usually one of a few things: a bullnose (rounded front), a curtail (curves around the newel), a half-round (semi-circular protrusion), or an extended tread (wider square projection). If you can tell me whether it's rounded or square, I can narrow it down."

## Pilot patterns · Landing railings

### Pattern LR-01 · Continuity
**Input:** "Can I have the same railing around the landing?"
**Intent tier:** Clear
**Concepts:** landing_balustrade_continuity_principle
**Retrieval:** `landing-railings-continuity-and-construction-2026-08-14.md` §1
**Response shape:** direct — yes; that's normally the recommendation. Explain the continuity principle.

### Pattern LR-02 · Base rail on the landing
**Input:** "Why does the landing need a baserail?"
**Intent tier:** Clear
**Concepts:** three_way_base_rail_construction_relationship
**Retrieval:** `landing-railings-continuity-and-construction-2026-08-14.md` §2 (three-way rule)
**Response shape:** direct with construction reasoning — the landing is a horizontal surface so the balusters normally need a horizontal base rail to fix into; on a cut-string flight the balusters may fix directly to the stair construction so the flight itself may not need a sloping base rail.

### Pattern LR-03 · Top newel transition
**Input:** "How do I connect the landing rail to the top newel?"
**Intent tier:** Clear
**Concepts:** top_newel_transition
**Retrieval:** `landing-railings-continuity-and-construction-2026-08-14.md` §3
**Response shape:** direct — stair handrail terminates at one face of the top newel; landing handrail connects to another face of the same newel.

---

## Pilot patterns · Handrail components

### Pattern HR-01 · Wall handrail brackets
**Input:** "What brackets do I need for the handrail?"
**Intent tier:** Likely (need to know: wall-mounted or newel-mounted?)
**Concepts:** wall_mounted_handrail_kit_brackets
**Retrieval:** `staircase-handrail-components-2026-08-14.md` §6
**Response shape:** hedged interpretation
**Response:** "If you mean the brackets that hold a wall-mounted handrail (the one running along a wall on the side of the staircase), the standard kit uses polished stainless, brushed stainless, matt black or brass brackets spaced along the run. Is the handrail being fixed to a wall, or is it part of the balustrade with newel posts?"

### Pattern HR-02 · Metal handrail-to-wall fixing (customer language)
**Input:** "What's that metal thing that holds the handrail to the wall?"
**Intent tier:** Clear (customer describes the fixture without knowing its name)
**Concepts:** wall_mounted_handrail_bracket
**Retrieval:** Same as HR-01
**Response shape:** direct — that's a wall-mounted handrail bracket. Naming + material options + fixing requirement (into structural material, never plasterboard alone).

---

## Pilot patterns · Step mats + carpet

### Pattern SM-01 · Mats on individual steps
**Input:** "Can I put mats just on the steps?"
**Intent tier:** Clear
**Concepts:** step_mats
**Retrieval:** `step-mats-knowledge-2026-08-14.md` §1
**Response shape:** direct — yes, per-tread step mats leave the risers and timber margins exposed; they add grip and softness without a full carpet.

### Pattern SM-02 · Runner vs step mats
**Input:** "What's the difference between a stair runner and step mats?"
**Intent tier:** Clear
**Concepts:** step_mats_vs_runner_vs_full_carpet
**Retrieval:** `step-mats-knowledge-2026-08-14.md` §1
**Response shape:** direct comparison — runner = continuous carpet down the centre; step mats = individual per-tread covers with everything else exposed; full carpet = everything covered.

---

## Pilot patterns · Refacing scope

### Pattern RF-01 · Partial refacing with timber showing
**Input:** "I want to refurb my stairs but keep some of the timber showing."
**Intent tier:** Likely (which timber elements should stay? treads? newels? handrail?)
**Concepts:** refacing_scope + partial_timber_retention
**Retrieval:** `refacing-before-after-cards-and-trade-content-taxonomy-2026-08-14.md` §1 + `starting-steps-knowledge-2026-08-14.md` §16 (refurbishment)
**Response shape:** hedged interpretation + clarifying question
**Response:** "There's a lot you can change without touching the staircase structure — newel caps, spindles, base rails, handrails, or the finish on the treads themselves. Which parts of the current staircase do you want to keep visible?"

---

## Pilot patterns · Under-stair

### Pattern US-01 · Under-stair uses (ambiguous)
**Input:** "What can I do under my stairs?"
**Intent tier:** **Ambiguous** (many possibilities)
**Concepts:** could be storage / office / library / seating / wine / aquarium / WC / play nook / display / bookshelf
**Retrieval:** DO NOT retrieve everything yet
**Response shape:** ASK
**Response:** "Loads — it depends on what you'd get most use out of. Are you thinking about storage (drawers, shelves, a cupboard), a small workspace (a desk or nook), or something more of a feature (wine cellar, reading corner, display)? Do you already know how much space you have under there?"

---

---

## Pilot patterns · Balusters / Balustrade / Guardrail

### Pattern BAL-01 · Choose baluster style
**Input:** "How do I choose between round and square wooden balusters?"
**Intent tier:** Likely (needs style-lean)
**Concepts:** balusters + design_style
**Retrieval:** batch 8 landing-railing gallery (12 baluster families)
**Response shape:** hedged interpretation
**Response:** "Round turned balusters read classical/traditional. Plain square balusters read modern-neutral. Which way is the staircase leaning — traditional or modern?"

### Pattern BAL-02 · Glass vs wrought iron
**Input:** "How do I choose between a glass or wrought iron staircase railing?"
**Intent tier:** Likely
**Concepts:** balusters + design_style
**Retrieval:** batch 8 gallery + landing-railings continuity doc
**Response shape:** hedged with follow-up
**Response:** "Frameless glass reads modern-luxury and opens the space visually. Wrought iron reads classical/period, especially with scroll or cage detail. What's the rest of the staircase style, and is this a new-build or refurb?"

### Pattern BAL-03 · Baluster spacing
**Input:** "How do I choose the right baluster spacing for aesthetic balance?"
**Intent tier:** Clear on aesthetics · Regs-dependent on max opening
**Concepts:** balusters + safety_regs
**Retrieval:** landing-railings §8 (spacing) · UK Regs (routed to Code-Compliance future brain for max opening)
**Response shape:** direct on aesthetics + regs pointer
**Response:** "Two balusters per tread is the common practical starting arrangement for balance on a traditional staircase — trimmed at top/bottom where the newel restricts tread width. The actual maximum gap is governed by UK Building Regulations for your specific installation, not a fixed number. Do you want to work through the visual rhythm or lock the regs check first?"

### Pattern BAL-04 · Modernise ugly spindles
**Input:** "What is the easiest way to modernize ugly stair spindles?"
**Intent tier:** Clear (refacing scope)
**Concepts:** balusters + refacing + design_style
**Retrieval:** refacing taxonomy + batch 8 modern families
**Response shape:** direct enumeration
**Response:** "Common single-move updates: (1) swap turned timber for slim brushed stainless verticals — biggest style-lift with the smallest structural change; (2) swap to matt-black metal rods — reads industrial-modern; (3) swap to frameless glass panels — most open and premium. Whichever you pick, you're keeping the newel posts and handrail if they're solid. Which direction attracts you?"

### Pattern BAL-05 · Charcoal paint on spindles
**Input:** "How can I use dark charcoal paint to modernize stair spindles?"
**Intent tier:** Clear (paint refacing move)
**Concepts:** balusters + maintenance_repair + design_style
**Retrieval:** refacing + design-language cascade (glossary)
**Response shape:** direct
**Response:** "Painting existing timber spindles in dark charcoal (matt black or graphite) is a common single-day refacing move — it visually converts a traditional turned staircase into a modern bi-colour scheme without replacement. Works best when the handrail and newels stay in natural timber for contrast. Prep matters: sand, prime, two coats, and use a low-VOC eggshell for durability. Want to work through the practical order or the design pairing?"

---

## Pilot patterns · Handrail

### Pattern HR-03 · Handrail material choice
**Input:** "What is the best wood choice for a heavy high-traffic handrail?"
**Intent tier:** Clear (materials-in-use)
**Concepts:** handrail + timber_species
**Retrieval:** staircase-handrail-components §1 + staircase-timbers §1
**Response shape:** direct with hedged material comparison
**Response:** "Oak is the most popular UK choice for heavy-use handrails — hard-wearing, takes daily grip well, finishes cleanly. Walnut is the higher-end alternative (darker, more formal). Beech is a lighter-cost hardwood option that also handles wear. Softwoods like pine are better left for painted handrails than natural — pine dents more easily under sustained handling."

### Pattern HR-04 · Handrail transition around a tight radius
**Input:** "How do I plan a wooden banister transition around a tight radius?"
**Intent tier:** Clear (construction detail)
**Concepts:** handrail + carpentry_math (partial)
**Retrieval:** staircase-handrail-components §4 (swan-neck / gooseneck) + §5 (volute)
**Response shape:** direct
**Response:** "Tight radius transitions use prefabricated handrail fittings — a quarter-turn (90° horizontal), a swan-neck (S-curve rising up onto a landing), or a laminated bent handrail if the geometry is unusual. Straight cut-and-join around a tight radius rarely reads cleanly — the eye picks up the facet. Which transition are you handling — landing turn, rising to landing, or bottom-newel curl?"

---

## Pilot patterns · Design style (cascading)

### Pattern DS-01 · Modern staircase full design
**Input:** "What are the best design styles for a grand curved entryway staircase?"
**Intent tier:** Likely (grand + curved + entryway = cascade)
**Concepts:** design_style + starting_step + layout_types + balusters
**Retrieval:** design-language cascade (glossary) + batch scenes for grand curved
**Response shape:** hedged interpretation + design cascade
**Response:** "Grand curved entryway usually points to one of two style poles: (1) traditional/classical — sweeping curved cut-string flight with turned newels, curtail-with-volute starting step, turned timber spindles, oak or mahogany, carpet runner; (2) modern-luxury — helical cantilever with frameless glass balustrade, LED under-nosing, exposed oak treads. What's the rest of the interior leaning?"

### Pattern DS-02 · Make it look wider
**Input:** "How do I make a narrow wooden staircase look wider using paint?"
**Intent tier:** Clear (design-visual technique)
**Concepts:** design_style + maintenance_repair
**Retrieval:** design-language cascade (glossary) + timber species doc for paint-grade
**Response shape:** direct enumeration
**Response:** "A few painting moves that visually widen a narrow staircase: (1) paint the risers in a very pale colour (white, off-white, pale grey) so the eye reads only the tread edge — the flight feels lighter and less boxy; (2) paint the string in the same pale colour so it disappears against the wall; (3) contrast the tread nosing (dark timber or a contrasting paint stripe) to define the tread edge cleanly; (4) paint the spindles in a mid-value to avoid a heavy dark band on the side. Combined moves work better than one alone."

### Pattern DS-03 · Modern industrial staircase
**Input:** "Show me examples of industrial style steel and concrete staircase steps." [image_search]
**Intent tier:** Clear
**Concepts:** design_style + treads_risers + stringers
**Query type:** image_retrieval
**Retrieval:** batch 7 industrial scenes (Shou Sugi Ban + riveted steel · batch 10 cantilever illustrations)
**Response shape:** IR-01 (image-first)
**Response:** "Industrial style staircase examples from the reference library: [image grid — riveted black steel plate stringer with dark walnut treads (batch 7 img-23) · dual black steel side-stringers with light oak floating treads (batch 7 img-43) · cantilever oak treads on black steel spine stringer (batch 10 img-33)]. Common language: exposed steel structure, matt-black or corten metal, oak or concrete treads, no ornament. Which direction leans right for your setup?"

### Pattern DS-04 · Minimalist floating
**Input:** "Show me minimal modern floating staircases featuring thin black wire cable rails." [image_search]
**Intent tier:** Clear
**Concepts:** design_style + stringers + balusters
**Query type:** image_retrieval
**Retrieval:** batch 7 + batch 10 floating cantilever scenes + horizontal cable rail (batch 8 img-32)
**Response shape:** IR-01
**Response:** "Minimal floating with cable rails from the library: [image grid]. The pattern: cantilever oak treads (either wall-side spine or dual black steel side-stringers) + horizontal or vertical thin cable rails tensioned between minimal newel posts. Works best in a modern open-plan space with tall ceilings. Are you leaning toward horizontal cables or vertical?"

### Pattern DS-05 · Scandinavian light-timber
**Input:** "Show me pictures of Scandinavian style light oak steps with glass panels." [image_search]
**Intent tier:** Clear
**Concepts:** design_style + timber_species + balusters
**Query type:** image_retrieval
**Retrieval:** batch 4-8 scenes with light oak + glass
**Response shape:** IR-01
**Response:** "Scandinavian light-oak + glass staircases from the library: [image grid]. Common pattern: natural light oak treads and newels + frameless glass balustrade + minimal or no ornament + often white throat / painted risers for contrast. Do you want to see the variants with different balustrade attachment (clamps vs point-fixed)?"

### Pattern DS-06 · Coastal
**Input:** "Show me coastal style staircase designs using white and light timber." [image_search]
**Intent tier:** Clear
**Concepts:** design_style + finish + timber_species
**Query type:** image_retrieval
**Retrieval:** batch scenes with white + pale timber combinations
**Response shape:** IR-01
**Response:** "Coastal-style staircase examples: [image grid]. The language: white-painted balustrade / risers + pale timber treads (pale oak or maple) + light-toned handrail + often glass panels for extra brightness. Rope-detail handrails are a traditional coastal accent. Want me to focus on new-build coastal or refacing an existing staircase to that language?"

---

## Pilot patterns · Maintenance / Repair

### Pattern MR-01 · Remove old carpet
**Input:** "How do I remove old carpet from wooden steps safely?"
**Intent tier:** Clear (repair procedure)
**Concepts:** maintenance_repair + carpet_stepmats
**Retrieval:** step-mats knowledge (context) · procedure specifics are NOT in Reference Brain — flag as gap
**Response shape:** honest partial answer + gap flag
**Response:** "The reference knowledge NEX carries is on choosing and installing carpet, not on removal procedures. Practically: remove staples with a pull tool, work top-to-bottom, protect the tread wood from gouging. If the treads underneath are in good condition, they can be refinished directly. If damaged, they'll need patch repair or overlay treads. For the specific removal-tool + technique detail I'd point you to a fitter or a step-by-step guide — that's outside NEX's design-oriented scope."

### Pattern MR-02 · Stop wood stairs creaking
**Input:** "How can I stop wood stairs from creaking in winter?"
**Intent tier:** Clear (specific maintenance issue)
**Concepts:** maintenance_repair
**Retrieval:** handrail-components doc mentions wedges (glue blocks) which prevent creaking; the specific creak-treatment procedure is outside Reference Brain
**Response shape:** partial answer + gap flag
**Response:** "Creaking usually means a tread-riser joint has loosened — the internal glue blocks (wedges) that reinforce the corner have failed, or the tread has separated from the string. Common trad-fix routes: re-glue the internal wedges from underneath if accessible, screw the tread into the string from below with countersunk screws, or lift and reset the tread. The specific fix depends on the staircase construction — a joiner surveys and picks the approach. That specific procedure detail is outside NEX's design-oriented scope."

### Pattern MR-03 · Fix a wobbly newel
**Input:** "How do I fix a wobbly newel post securely?"
**Intent tier:** Clear
**Concepts:** maintenance_repair + newel_caps (adjacent)
**Retrieval:** landing-railings-continuity §5 (corner newel structural fixing principle)
**Response shape:** direct with structural principle
**Response:** "A wobbly newel almost always means the fixing has failed to reach structural material. NEX's principle here: newel fixings need to bite into joists, timber grounds, or masonry — not just floorboards or plasterboard. Common fixes: lift the floor plate to access the joist, add a bolt fixing from below, or install a hidden steel plate that carries the newel into the joist. The exact fix depends on the construction; a joiner picks the approach after inspection. The structural principle matters more than the specific technique: no repair holds if the fixing doesn't reach structure."

---

## Pilot patterns · Layout Types

### Pattern LT-01 · Straight vs L-shape
**Input:** "When should I choose an L-shaped stair over a U-shaped stair?"
**Intent tier:** Clear (spatial trade-off)
**Concepts:** layout_types
**Retrieval:** batch scenes covering L-shape and U-shape (limited direct evidence)
**Response shape:** direct comparison
**Response:** "L-shape (single 90° turn at a landing) suits rooms where the staircase runs along one wall then turns into the flight — needs less continuous wall length than a straight run. U-shape (180° turn at a landing) folds the flight back on itself — needs the least floor length but the deepest space (twice the flight width). Which are you constrained by — length, depth, or both?"

### Pattern LT-02 · Space-saver options
**Input:** "How do you design a staircase for a small tiny house loft?"
**Intent tier:** Clear (space-constrained)
**Concepts:** layout_types
**Retrieval:** batch 7 scenes on spiral + winder + narrow flights
**Response shape:** direct enumeration
**Response:** "Tiny-house loft staircases usually pick from three options: (1) alternating tread stair (space-saver ship ladder) — steepest but smallest footprint; (2) spiral staircase — small footprint but hard to move furniture through; (3) winder staircase — folds a full flight around a 90° or 180° turn, easier to use than a spiral. Which constraint dominates — footprint area, headroom, or ease of daily use?"

### Pattern LT-03 · Bifurcated
**Input:** "What is a bifurcated staircase and where is it traditionally used?"
**Intent tier:** Clear (terminology)
**Concepts:** layout_types + design_style
**Retrieval:** gap flag — bifurcated is a specialist layout not in current Reference Brain
**Response shape:** honest partial answer + gap flag
**Response:** "A bifurcated staircase is a wide single flight that splits into two narrower opposing flights at a mid-landing — most often seen in grand halls, historic mansions, hotel lobbies, and formal public buildings. NEX's current reference library is residential-scale rather than monumental, so specific bifurcated design detail is outside current scope. The design language is grand/traditional and normally pairs with wide treads, curved balustrade, and often a central feature niche between the two upper flights."

---

## Pilot patterns · Stringers

### Pattern STR-01 · Mono-stringer explanation
**Input:** "What is a mono-stringer staircase and when should I select it?"
**Intent tier:** Clear (terminology + selection)
**Concepts:** stringers + design_style
**Retrieval:** batch 10 cantilever/mono-stringer illustrations
**Response shape:** direct
**Response:** "A mono-stringer is a single central steel spine that runs the length of the flight, with the treads cantilevered off both sides. Reads modern-architectural. Best when: you want the sides open (no visible side stringer), the treads are structural material (usually solid oak), and the space suits a floating look. Not the pick for traditional staircases or where you want a solid closed-side look."

### Pattern STR-02 · Central stringer
**Input:** "What is a central stringer staircase and how does it support steps?"
**Intent tier:** Clear
**Concepts:** stringers
**Retrieval:** batch 10 illustrations
**Response shape:** direct
**Response:** "A central stringer runs down the middle of the staircase — treads cantilever off it on both sides. Structurally the stringer carries the vertical load and each tread transfers via a bracket or bolted connection. Common in modern floating designs. Alternative is dual-stringer (side stringers on both sides) or mono-cut central-notched carrying visible treads. Which look are you going for — floating minimal or clearly structural?"

### Pattern STR-03 · Cantilever floating
**Input:** "What is a cantilevered stair layout and how much wall depth is required?"
**Intent tier:** Clear
**Concepts:** stringers + carpentry_math (wall depth spec is partial gap)
**Retrieval:** batch 10 cantilever cutaway + illustration
**Response shape:** direct with honest limit
**Response:** "A cantilever stair has treads that project from a wall (or a hidden steel spine) with no visible support on the other side. Wall-side cantilevers need substantial wall depth for embedded steel channels — typical range is 150–250 mm structural depth, but the exact figure depends on tread length, load, and the specific steel bracket system. The engineer / manufacturer of the cantilever system specifies the required depth for your setup — NEX flags the design principle but doesn't specify structural depths."

---

## Pilot patterns · Lighting

### Pattern LI-01 · LED motion-activated
**Input:** "How do I install motion-activated LED lights on stairs?"
**Intent tier:** Clear (procedural request)
**Concepts:** lighting + installation_process
**Retrieval:** batch 7-8 LED scenes for design context · procedure specifics are outside Reference Brain
**Response shape:** design-context answer + procedural gap flag
**Response:** "Motion-activated LED lights are usually installed as under-nosing strips or in-riser recessed spots, wired to a PIR sensor at the top and bottom of the flight so the lights activate when someone approaches. Design-wise NEX carries evidence of where LED integration looks best (under-nosing wash · in-riser spots · LED-inset newel · cove wash at the starting step). The specific electrical wiring procedure is outside NEX's design scope — that's an electrician's competency. Want to work through the design placement first?"

### Pattern LI-02 · Recessed wall lights
**Input:** "What are the best recessed wall lights for a modern staircase?"
**Intent tier:** Likely (product recommendation)
**Concepts:** lighting + design_style
**Retrieval:** batch scenes for design examples · specific product recommendation is a gap
**Response shape:** design-context + honest product limit
**Response:** "For modern staircases the common recessed wall light choices are: (1) small square LED step lights aligned with each tread (subtle floor-level wash); (2) slim vertical linear recessed strips (architectural feature); (3) small round downlight fittings at head-height along the flight wall. NEX doesn't recommend specific product brands — the design language matters more than the product. If you want brand recommendations, a lighting specialist supplier or a spec-sheet from a Focus SB / Astro / John Cullen catalogue is the right source."

---

## Pilot patterns · Safety / Regs (route to future brain)

### Pattern SR-01 · Handrail height
**Input:** "How high must a residential staircase handrail be installed legally?"
**Intent tier:** Clear
**Concepts:** safety_regs
**Routing:** future_brain:building_codes
**Response shape:** FB-01
**Response:** "That's governed by current UK Building Regulations for the specific installation. NEX doesn't quote the figure directly because the applicable value depends on the regs version + the specific staircase context. Check the current UK Building Regulations for residential stairs, or ask the installer/inspector for the specific figure. What I can help with is the design side — handrail material, profile, continuity, transition at the top newel."

### Pattern SR-02 · Baluster gap
**Input:** "What is the maximum allowed gap between staircase railing balusters?"
**Intent tier:** Clear
**Concepts:** safety_regs + balusters
**Routing:** future_brain:building_codes
**Response shape:** FB-01
**Response:** "That's a UK Building Regulations question — the current sphere-through-opening rule governs it (a small child must not be able to pass through). The specific dimension needs to be checked against the current regs for the specific installation. NEX doesn't state the number directly because the applicable value depends on the regs version. Design-side: NEX can help with baluster style, spacing rhythm, and family choice — those are separate decisions."

---

## Ambiguity clarifier patterns (linguistic-doors triggered)

### Pattern AMB-01 · "Make it look bigger"
**Input family:** "I want the stairs to look bigger" · "Make it feel less narrow" · "How do we open this up?" · "The staircase looks heavy"
**Intent tier:** Ambiguous
**Concepts:** design_style + balusters + finish + construction
**Retrieval:** DO NOT retrieve yet — the door is one, the axis isn't chosen
**Response shape:** ASK
**Response:** "'More open' can go a few directions. Are you thinking mainly about the balustrade feeling lighter (glass or slim metal instead of turned timber), the whole staircase reading paler (paint or lighter timber), the actual construction (open risers or floating treads), or the lighting? Any one of those would take us somewhere different."

### Pattern AMB-02 · "Make the first step bigger"
**Input family:** "Make the bottom step bigger" · "I want a wider first step" · "Can the entry step be more substantial?"
**Intent tier:** Ambiguous
**Concepts:** starting_steps
**Retrieval:** DO NOT retrieve — 20 starting-step types
**Response shape:** ASK
**Response:** "'Bigger' at the bottom points a few ways. Do you mean wider across (extended tread projecting forward), rounder / wrapping around (bullnose or curtail curling around the newel), or a more substantial two-step statement (double-stacked at the base)? Also, is the rest of the staircase leaning modern or traditional?"

### Pattern AMB-03 · "Make it more modern"
**Input family:** "Modernise this" · "Make it more modern" · "Contemporary look" · "Less old-fashioned"
**Intent tier:** Ambiguous
**Concepts:** design_style + refacing
**Retrieval:** DO NOT retrieve — modernise cascade is broad
**Response shape:** ASK
**Response:** "Modern goes a few ways. Architectural-minimalist (matt black metal, glass, exposed steel), warm-modern (light oak, slim spindles, keeps some traditional feel), or luxury-modern (cantilever, frameless glass, LED integration)? And is this a refurb keeping the existing structure, or a full replacement?"

### Pattern AMB-04 · "Make it more traditional"
**Input family:** "More traditional" · "Classical look" · "Period style" · "Country house feel"
**Intent tier:** Ambiguous
**Concepts:** design_style
**Retrieval:** DO NOT retrieve — traditional cascade is broad
**Response shape:** ASK
**Response:** "'Traditional' can lean a few ways. Grand traditional (turned newels + volute + carpet runner + dark hardwood) reads formal / country house. Cottage traditional (pine + painted spindles + simpler cap) reads warmer / rural. Georgian or Federal (ball finials + white spindles + dark handrail) reads more classical-architectural. Which era or feel are you drawn to?"

### Pattern AMB-05 · "Something like this"
**Input family:** "I want something like this" · "Like this" · "Can I have this?" · "What about this one?"
**Intent tier:** Ambiguous (pronoun-lack)
**Concepts:** unclassified (until context resolves)
**Retrieval:** DO NOT retrieve — need image or description first
**Response shape:** ASK
**Response:** "I don't have a specific reference for 'this' — do you have an image you can share, or can you describe what you're pointing to? A rough style word (modern / traditional / warm / minimal) also helps me narrow."

### Pattern AMB-06 · "What's best?"
**Input family:** "What's best here?" · "What should I do?" · "Which is better?" · "What would you recommend?"
**Intent tier:** Ambiguous (no constraints given)
**Concepts:** unclassified until context
**Retrieval:** DO NOT retrieve
**Response shape:** ASK
**Response:** "Best-for-what? Depends on the goal. Are you optimising for how it looks (style match), how much you spend (refacing vs replacement), how long it lasts (durability), or how the space works (footprint / traffic flow)? Any one of those changes the answer."

### Pattern AMB-07 · "Something impressive at the entry"
**Input family:** "Impressive entry" · "Statement staircase" · "Wow factor" · "Grand entrance"
**Intent tier:** Ambiguous
**Concepts:** design_style + starting_steps + layout_types
**Retrieval:** DO NOT retrieve — impressive cascade is broad
**Response shape:** ASK
**Response:** "Impressive can go two poles. Traditional impressive: sweeping curved staircase with turned newels, volute, curtail starting step, and carpet runner — reads country-house / mansion. Modern impressive: helical cantilever with frameless glass balustrade and LED integration — reads architect-modern. Which pole is the rest of the interior?"

### Pattern AMB-08 · "Save space"
**Input family:** "Save space" · "Tight corner" · "Small footprint" · "Compact staircase"
**Intent tier:** Ambiguous
**Concepts:** layout_types
**Retrieval:** DO NOT retrieve — need daily-use vs occasional-use axis
**Response shape:** ASK
**Response:** "How constrained is the space, and how often will it be used? Daily use rules out alternating-tread ship ladders. Occasional-only opens up ship ladder and spiral. Winder staircases and L-shape landings are the middle-ground compromises. Do you know the floor area available?"

### Pattern AMB-09 · "The staircase feels dated"
**Input family:** "Feels dated" · "Looks old" · "Doesn't fit the house" · "Stuck in a time period"
**Intent tier:** Ambiguous
**Concepts:** refacing + design_style
**Retrieval:** DO NOT retrieve — direction depends on current era
**Response shape:** ASK
**Response:** "What era does the current staircase feel like? Brown-and-heavy 1970s takes different moves than ornate Victorian or blond 1990s. Also, thinking full refacing or just tweaking one thing (like the spindles or the finish)?"

### Pattern AMB-10 · Vague single-word style request
**Input family:** "Nicer" · "Better" · "Different" · "Special" — single word without object
**Intent tier:** Ambiguous
**Concepts:** unclassified
**Retrieval:** DO NOT retrieve
**Response shape:** ASK
**Response:** "Nicer / better / different — any of those can point a few ways. Are you focusing on the entry step, the balustrade, the handrail, the finish, or the overall style? And what feels lacking about the current one?"

---

## Additional targeted patterns for common corpus questions

### Pattern TR-01 · Best hardwood for treads
**Input:** "What are the most durable hardwoods used for constructing elegant steps?"
**Intent tier:** Clear
**Concepts:** treads_risers + timber_species
**Retrieval:** `staircase-timbers-2026-08-14.md` §1
**Response shape:** direct
**Response:** "Common UK hardwood picks for elegant durable treads: oak (most popular · hard-wearing · well-priced for the quality), walnut (dark · formal · more expensive), cherry / mahogany (rich reddish-brown · classical / period), maple (very pale · Scandi-modern), ash / beech (mid-cost · warm). Oak is the default pick if you don't have a specific style-lean forcing another choice."

### Pattern TR-02 · Open riser vs closed riser
**Input:** "What is the structural difference between open risers and closed risers?"
**Intent tier:** Clear
**Concepts:** treads_risers
**Retrieval:** batch scenes for both variants
**Response shape:** direct comparison
**Response:** "Closed-riser: each tread has a vertical riser board behind it — the space between treads is filled. Reads traditional / enclosed / warmer. Open-riser: no riser board — you can see through the gap between treads. Reads modern / architectural / airy. Structural difference: closed-riser stairs get some torsional stiffness from the riser board; open-riser stairs rely entirely on the stringer and tread-to-string connection. Child safety: open risers must comply with the maximum sphere-through-opening rule per UK Building Regulations."

### Pattern TR-03 · Finish raw oak treads
**Input:** "What are the best ways to finish raw white oak treads?"
**Intent tier:** Clear
**Concepts:** treads_risers + timber_species + maintenance_repair
**Retrieval:** timber species doc §4 + finish-related evidence
**Response shape:** direct enumeration
**Response:** "White oak takes several finish approaches well: (1) hardwax oil — enhances the grain, matt sheen, easy to spot-repair over time; (2) polyurethane / lacquer — hardest wearing, higher gloss options; (3) water-based clear coat — low-VOC, keeps the pale oak tone; (4) stain then finish — allows warmer or darker tones (or grey / black for modern). For a staircase, wear-resistance matters — hardwax oil and polyurethane both hold up; polyurethane is more forgiving under heavy traffic. The look-vs-durability trade-off is the main decision axis."

### Pattern TR-04 · Bullnose vs square edge tread
**Input:** "How do I select between bullnose and square edge tread profiles?"
**Intent tier:** Clear
**Concepts:** treads_risers + starting_steps
**Retrieval:** starting-steps-types §4 (bullnose) · treads context
**Response shape:** direct comparison
**Response:** "Bullnose (rounded front edge) reads softer, traditional-leaning, and is grippier underfoot as the edge doesn't dig in. Square edge (crisp 90° front) reads modern / architectural / minimal. On the flight, both are safe; on the starting step, a bullnose is often chosen even when the rest of the flight is square-edged. Style consistency across the flight is the usual approach unless the starting step is deliberately a bullnose feature."

### Pattern LT-04 · Winder for corners
**Input:** "What is a winder staircase and how does it turn corners?"
**Intent tier:** Clear (terminology)
**Concepts:** layout_types
**Retrieval:** layout scenes covering winders
**Response shape:** direct
**Response:** "A winder staircase turns a corner using angled (usually triangular / pie-shaped) treads instead of a landing. Common layouts: 90° winder (three winder treads for a quarter turn) or 180° winder (six winders for a half turn). Winders save space vs a landing, but the walking geometry is trickier — the narrow inner edge means less foot area, and the wide outer edge is a longer step. UK Building Regulations govern minimum tread depth at the walking line — worth checking against the actual design."

### Pattern CS-01 · Choose carpet fiber
**Input:** "What is the best type of carpet fiber for high-traffic stairs?"
**Intent tier:** Clear
**Concepts:** carpet_stepmats
**Retrieval:** step-mats + carpet knowledge (partial)
**Response shape:** direct comparison
**Response:** "Wool is the traditional high-durability pick — soft, resilient, hides wear well; more expensive. Nylon is the modern high-durability synthetic — very tough, budget-friendlier, wider colour choice. Polypropylene is stain-resistant and washable but crushes faster under heavy foot traffic. Sisal / natural fibre reads coastal / rustic but wears visibly. For a busy family staircase the common trade-off is wool (best long-term look) vs nylon (best price-per-year). Both handle traffic well."

### Pattern CS-02 · Hollywood vs waterfall carpet
**Input:** "What is the difference between Hollywood and waterfall carpet installation methods?"
**Intent tier:** Clear
**Concepts:** carpet_stepmats
**Retrieval:** carpet knowledge
**Response shape:** direct comparison
**Response:** "Hollywood (also called cap-and-band or upholstered): the carpet is tightly wrapped around the tread nosing, tucked under the front edge — clean formal appearance, more labour, more expensive. Waterfall: the carpet flows straight down from the tread over the riser without being tucked — quicker install, more casual look, slightly more susceptible to visible wear at the front edge. Hollywood is the traditional / high-end choice; waterfall is common on budget or utility stairs."

### Pattern LI-03 · Colour temperature for stair lighting
**Input:** "What are the best color temperatures for modern staircase lighting?"
**Intent tier:** Clear
**Concepts:** lighting
**Retrieval:** partial — Reference Brain has scene evidence, colour-temperature specifics are inference from that
**Response shape:** direct hedged answer
**Response:** "For staircase lighting the common range is 2700K (warm white — reads soft / traditional) to 3000K (still warm but slightly crisper — most modern staircases). 4000K (neutral white) reads more commercial / clinical and is less common in residential unless the whole house uses it. 3000K is the safe middle-ground default for most modern residential staircases. LED under-nosing wash reads better at 2700K–3000K; step-inset lights sometimes go slightly cooler for contrast. The exact bulb temperature always depends on the rest of the room's lighting — matching is more important than a specific number."

### Pattern MR-04 · Sand old scratched treads
**Input:** "What is the best way to sand down old scratched treads?"
**Intent tier:** Clear
**Concepts:** maintenance_repair + treads_risers
**Retrieval:** partial — Reference Brain covers timber species; sanding procedure detail is a gap
**Response shape:** direct with honest procedural limit
**Response:** "General approach: work through progressively finer grits (usually 80 → 120 → 180 for a solid hardwood tread), keeping the sander moving to avoid dishing, sanding along the grain not across. Corner and edge detail needs hand-sanding or a detail sander. After sanding, dust off completely before finishing. The specific grit sequence and sander type depend on the timber, depth of the scratches, and whether treads can be worked in place or need lifting. That specific procedural depth is outside NEX's design-oriented scope — a joiner or refinisher would pick the exact approach on-site."

### Pattern BAL-06 · Pin-top vs square-top baluster
**Input:** "What is the difference between a pin-top and a square-top baluster?"
**Intent tier:** Clear (terminology + installation)
**Concepts:** balusters
**Retrieval:** handrail-components + balustrade evidence
**Response shape:** direct comparison
**Response:** "Pin-top: the baluster has a round dowel at the top that fits into a drilled hole in the underside of the handrail — cleaner appearance, no visible fillet needed. Square-top: the baluster top is left square and fits into a routed groove on the underside of the handrail, with a small timber fillet strip between each baluster to fill the gap — traditional appearance, easier to install and adjust spacing. Pin-top reads slightly more refined / modern; square-top-with-fillets reads traditional and is the default on most turned-spindle staircases."

### Pattern HR-05 · Wooden banister transition around tight radius
**Input:** "How do I plan a wooden banister transition around a tight radius?"
**Intent tier:** Clear
**Concepts:** handrail
**Retrieval:** handrail-components §4 (swan-neck), §5 (volute)
**Response shape:** direct
**Response:** "Tight-radius handrail transitions normally use prefabricated fittings — a quarter-turn (90° horizontal turn on a landing), a swan-neck / gooseneck (S-curve rising up to a higher landing level), or a laminated bent handrail for unusual geometry. Straight cut-and-join around a tight radius rarely reads cleanly — the eye picks up the facet. The prefab fitting is spliced into the straight handrail sections. Which transition are you handling — a landing turn, a rise to a landing, or a bottom-newel curl?"

### Pattern NC-01 · Change just the newel caps
**Input:** "How can I upgrade newel caps without replacing the whole newel?"
**Intent tier:** Clear
**Concepts:** newel_caps + refacing
**Retrieval:** newel-caps §6
**Response shape:** direct
**Response:** "That's one of the simplest refurbishment moves. Cap swaps don't touch the newel post itself — the existing cap is glued or dowel-fixed on top of the newel, so it can be removed and replaced with a matching-seat-dimension new cap. Most timber caps come in a few standard newel-width sizes. Do you want the new caps to blend into the existing style, or deliberately contrast (say, matt-black metal cap on a natural oak newel for a bi-colour accent)?"

---

## Focused patterns · Stringers (closing the biggest gap)

Reference Brain sources for this cluster: batch 10 illustrations, `staircase-handrail-components-2026-08-14.md`, `landing-railings-continuity-and-construction-2026-08-14.md` §2 (three-way base-rail rule).

### Pattern STR-04 · Dual-stringer
**Input:** "What is a dual-stringer staircase and where is it best used?"
**Concepts:** stringers
**Response:** "A dual-stringer staircase has two stringers, one on each side of the flight — the treads span between them. Reads more solid/structural than a single central stringer, and it's the traditional-carpentry default. Works well when both sides of the staircase are visible (open on both sides), when you want a robust and simple structural read, and when the treads are relatively thin (the stringers carry the load). Modern variants use dual black steel stringers with oak treads floating between."

### Pattern STR-05 · Box stringer
**Input:** "What is a box stringer staircase design and its structural layout?"
**Concepts:** stringers
**Response:** "A box stringer is a stringer built up from multiple plies or layers glued into a box section — deeper and stiffer than a solid stringer of the same width, without adding as much visual weight. Common in commercial staircases and long-span residential flights where structural stiffness matters. Aesthetically it reads clean and modern because the visible depth stays consistent along the length."

### Pattern STR-06 · Housed stringer + mortise
**Input:** "What is a housed stringer and how do you mortise it?"
**Concepts:** stringers + carpentry_math
**Response:** "A housed stringer has treads and risers set into routed grooves (mortises) cut into the side of the stringer — the tread ends are hidden inside the timber, and the staircase reads as a solid closed-string design. Traditional carpentry approach. The mortises are cut with a router and jig for consistent depth and angle. Structural detail: wedges are glued behind each tread inside the mortise to lock the joint and prevent creaking. That mortise-cutting procedure is a joinery skill — outside NEX's design-oriented scope but the design implication is closed-string traditional appearance."

### Pattern STR-07 · Cut stringer vs routed stringer
**Input:** "What is the difference between a cut stringer and a routed stringer?"
**Concepts:** stringers
**Response:** "Cut stringer (open string): the stringer is notched along the top so the tread and riser sit ON TOP of the string with the tread ends exposed — reads traditional cut-string, works with scroll brackets on the visible profile. Routed stringer (housed / closed string): grooves are cut INTO the side of the stringer and treads slot inside — the tread ends are hidden. Cut-string reads decorative/traditional-exposed. Routed reads solid/closed. This connects to the three-way base-rail rule (see landing-railings doc §2) — cut-string flights may skip the sloping base rail because balusters can fix directly to the treads."

### Pattern STR-08 · Anchor steel mono-stringer to concrete
**Input:** "How do you anchor a steel mono-stringer to a concrete floor?"
**Concepts:** stringers + installation_process
**Response:** "The mono-stringer's base plate is chemical-anchored or expansion-bolted into the concrete slab. Design-wise the load transfer point is critical — the stringer's full flight weight and live load transfers through that base connection. The specific fixing spec (chemical anchor size, bolt diameter, minimum embed depth) depends on the concrete grade + expected load and is calculated by the manufacturer or a structural engineer. NEX flags the design principle (this connection has to reach structural concrete, not screed); the specific fixing spec is an engineering calc."

### Pattern STR-09 · Cantilever wall depth
**Input:** "How much wall depth is required for a cantilever staircase?"
**Concepts:** stringers + carpentry_math
**Response:** "Cantilever wall-side staircases need substantial embedded steel channels running back into the wall behind each tread. Typical structural depth range is 150–250 mm depending on tread length and load, but the exact figure is calculated per project by the manufacturer or structural engineer — NEX flags the principle (the fixings must reach real structural depth, not a shallow wall finish), the specific dimension is an engineering calc."

### Pattern STR-10 · Central stringer floating look
**Input:** "How do I plan a minimal profile mono-stringer stair for small apartments?"
**Concepts:** stringers + layout_types
**Response:** "Mono-stringer minimal-profile is a good small-space pick because the single central stringer keeps both sides visually open. Two common patterns for a small apartment: (a) wall-side spine — a single steel plate spine along the wall with treads cantilevering out; (b) central steel spine — the stringer runs down the middle with treads floating both sides. Both need engineered fixings at the base plate and (for wall-side) into structural wall material. Treads are usually thick solid oak. What's the flight length and clear ceiling height?"

### Pattern STR-11 · Cantilever floating tread layout
**Input:** "What is a floating cantilevered tread layout and its framing style?"
**Concepts:** stringers
**Response:** "Floating cantilevered treads project from the wall (or from a hidden central spine) with no visible support on the outer side — the treads appear to float. Framing: steel channels are embedded into the wall structure behind each tread (or bolted to a central steel spine); the tread bolts into that channel. The framing is hidden behind the wall finish. Common tread materials: solid oak (structural thickness required), thick engineered timber, or steel-and-timber composite. Load transfer + framing depth is calculated per project by the manufacturer/engineer."

### Pattern STR-12 · Steel stringer thermal expansion
**Input:** "What engineering consideration is needed for thermal expansion in long steel stairs?"
**Concepts:** stringers + material_science (edge — partly deferred)
**Response:** "Long steel stringers do expand and contract with temperature — noticeable on external staircases in the UK across seasonal ranges. Design considerations: expansion joints at connection points to prevent stress buildup, slotted-hole connections at one end of the stringer to allow slide, using a stringer material with compatible thermal coefficient to whatever it connects to. The specific expansion calculations are structural engineering — NEX flags the principle; the exact expansion joint spec is calc-per-project."

---

## Focused patterns · Layout Types (closing the second-biggest gap)

### Pattern LT-05 · Quarter-turn
**Input:** "What is a quarter-turn staircase layout and how does it function?"
**Concepts:** layout_types
**Response:** "Quarter-turn: the staircase turns 90° at a landing — one flight runs up to the landing, a second flight rises from the landing at right angles. Reads as an L-shape from above. Common in mid-size homes because it fits a corner more efficiently than a straight run and reads more architectural. Structural interest: the landing carries both flights, so the landing framing is a key detail."

### Pattern LT-06 · Split-level
**Input:** "What is a split-level staircase and how does it save space?"
**Concepts:** layout_types
**Response:** "A split-level staircase serves a house where the floor levels are staggered — one short flight up to a mid-level, then another short flight up to the main upper floor. Saves space by breaking the total floor-to-floor height into two smaller flights that can fold into a footprint too small for a single run. Common in townhouses and hillside builds where the plot forces staggered levels."

### Pattern LT-07 · Wraparound
**Input:** "How does a wraparound staircase layout affect home foot traffic?"
**Concepts:** layout_types
**Response:** "A wraparound staircase wraps around a central point — usually a column, a wall, or a stairwell opening — turning through 270° or 360°. From above it reads as a U-shape or a spiral. Foot traffic implication: the staircase forms a visual centre of the space, but the walking path is longer than a straight run because you have to travel around the wrap. Common in grand entries and open-plan spaces where the staircase is a feature rather than pure circulation."

### Pattern LT-08 · Double-helix
**Input:** "What is the architectural purpose of a double-helix staircase design?"
**Concepts:** layout_types + design_style
**Response:** "A double-helix is two interweaving spiral flights that never intersect — historically used to allow two flows of people to pass without meeting (famously at Château de Chambord). Modern architectural uses are almost always ceremonial/monumental rather than practical — a grand hotel, a museum atrium, a public building. Not a residential-scale layout. NEX's Reference Brain is residential-scale; specific double-helix design detail is outside current pilot scope."

### Pattern LT-09 · Grand double staircase
**Input:** "How do you style a large double staircase in mansions?"
**Concepts:** layout_types + design_style
**Response:** "A double staircase in a grand hall usually splits from a single wider bottom flight into two opposing upper flights meeting at a landing (bifurcated), OR runs two parallel flights up either side of a central hall meeting at a top landing (double-return). Styling cascade for the grand version: turned newels with elaborate volute · turned classical spindles OR polished wrought iron cage detail · curtail-with-volute starting step · carpet runner with brass rods · rich hardwood (oak or mahogany) · large chandelier centred over the hall. NEX's Reference Brain covers the components (batch 7 grand curved scenes); the specific bifurcated / double-return layout planning is a specialist mansion-scale design brief."

### Pattern LT-10 · Freestanding
**Input:** "How do I design a freestanding staircase requiring minimal wall support?"
**Concepts:** layout_types + stringers
**Response:** "Freestanding staircase means the flight isn't fixed to any adjacent wall — the structural load transfers through the treads and stringer(s) into the floor at the base and (optionally) the landing at the top. Common patterns: dual side-stringers (steel or heavy timber, treads span between them) · central steel spine (mono-stringer with treads cantilevered both sides) · engineered cantilever with a hidden internal spine · helical structural continuous stringer. Design implication: the base connection has to transfer all lateral load, so the base plate and its fixing into the floor structure is the critical detail. Usually engineer-designed."

### Pattern LT-11 · Alternating tread
**Input:** "What is an alternating tread staircase and when is it practical?"
**Concepts:** layout_types
**Response:** "Alternating tread (also called space-saver or ship ladder): each tread is only half-width, with left and right halves alternating up the flight — so each foot lands on its own tread. Fits a much smaller footprint than a conventional staircase and is much steeper. Practical for: attic access, loft conversions, occasional-use secondary staircases, tight tiny-house designs. NOT for daily-use primary staircases — the geometry rules out safe descent for children, elderly, or anyone carrying items. Regs restrict where they can be used as primary stairs."

### Pattern LT-12 · Circular / spiral distinction
**Input:** "What is the difference between a helical and a spiral staircase?"
**Concepts:** layout_types
**Response:** "Spiral: winds around a central column — each tread is triangular / wedge-shaped and pivots off the central post. Very small footprint but tight geometry (narrow inner edge). Helical: sweeps around a curved centreline without a central column — treads are curved but not narrow at any edge, the whole flight arcs through space. Bigger footprint but much more elegant walking geometry. Spiral = space-saver space-restricted design. Helical = architectural / grand design."

---

## Focused patterns · Maintenance / Repair (closing the third gap)

### Pattern MR-05 · Paint combinations for rustic staircase
**Input:** "What are the best color combinations for painting a rustic staircase?"
**Concepts:** maintenance_repair + design_style
**Response:** "Rustic staircase paint palettes normally lean natural + muted: whites/off-whites for spindles and risers · deep forest green / sage / muted olive as accent · warm cream · charcoal or soft black as contrast · pale duck-egg blue for coastal-cottage. Common combinations: white spindles + natural oak treads and handrail (classic cottage); off-white risers + charcoal spindles + natural pine treads (modern-rustic); sage green spindles + white risers + oak treads (English country). Which room palette are you working with?"

### Pattern MR-06 · Restore polished marble steps
**Input:** "How do I clean and restore high-traffic polished marble steps?"
**Concepts:** maintenance_repair
**Response:** "Marble is porous and reactive to acids — never clean with vinegar or citrus cleaners. Restoration steps typically: (1) neutral-pH stone cleaner to lift dirt without etching; (2) light re-polish with a marble-safe polishing compound for high-traffic areas; (3) seal with a penetrating stone sealer to reduce future staining. Etched or deeply scratched marble may need professional re-polishing (diamond honing). NEX's scope covers the design principles; specific product recommendations sit with a stone restoration specialist."

### Pattern MR-07 · Fix loose handrail bracket
**Input:** "How do I fix a loose handrail bracket on drywall?"
**Concepts:** maintenance_repair + handrail
**Response:** "A loose wall-mounted handrail bracket almost always means the fixing is only into plasterboard, not into a stud or timber ground. The right fix is to remove the bracket and either (a) refix into a stud (relocate the bracket if the stud isn't at the current position), (b) install a timber batten behind the plasterboard the bracket can fix into, or (c) use a hollow-wall anchor rated for handrail load if the substrate can't take a proper fixing. NEX's principle: no handrail bracket holds long-term if the fixing doesn't reach structure. The specific fitting technique is a fitter's competency."

### Pattern MR-08 · Modernise old concrete outdoor step
**Input:** "How can I make an old concrete outdoor step look modern?"
**Concepts:** maintenance_repair + design_style + outdoor_stairs
**Response:** "Concrete outdoor step refreshes: (1) pressure-wash then apply concrete cleaner to remove staining; (2) skim coat with a micro-cement or thin polymer overlay to give a fresh smooth surface; (3) apply penetrating concrete sealer (matt or satin) to protect; (4) optionally overlay with natural stone or porcelain outdoor tiles for a full material change. Modern-look palette: pale grey micro-cement · charcoal · natural greige stone. NEX flags the design direction — specific product recommendations sit with a landscaper or masonry specialist."

### Pattern MR-09 · Chevron pattern paint
**Input:** "How can I paint a modern chevron pattern on steps?"
**Concepts:** maintenance_repair + design_style
**Response:** "Chevron pattern painting works well as a feature on the RISERS (not the treads — foot wear will show through the pattern). Approach: mask off the riser with painter's tape in a diagonal-alternating pattern, paint the first colour, let dry, remove tape and re-mask for the second colour, paint second colour. Common palettes: monochrome (charcoal + white) for architectural-modern · warm neutrals for cottage-modern · bold single-accent colour on white for playful modern. Feature only — don't do every riser; a few at the base or a few near the top read as a designed accent rather than busy."

## The response-shape checklist (NEX applies this on every turn)

Before responding, NEX runs through:

1. **Interpret** — check the glossary. Ambiguous phrase? Note it.
2. **Classify** — Clear / Likely / Ambiguous.
3. **Missing info?** — does NEX need to know construction type, dimensions, style intent, carpet/timber intent?
4. **If Ambiguous → ASK. STOP. No answer yet.**
5. **If Likely** → surface the guess ("It sounds like you're asking about X") + partial answer + follow-up option.
6. **If Clear** → direct answer + hedged nuance + optional follow-up.
7. **Always** — hedged language, six-step reasoning hierarchy, source-backed knowledge only.

## Cross-references

- `customer-language-glossary.md` — the phrase-level interpretation with ambiguity tiers
- `question-variations.md` — the many-phrasings-per-concept mapping
- `customer-intent-scenarios.md` — situational patterns beyond individual phrases
- `follow-up-questions.md` — the specific clarifying questions per topic
- `explanation-patterns.md` — the "why" templates the response shape uses
- All Reference Brain sources cited above
