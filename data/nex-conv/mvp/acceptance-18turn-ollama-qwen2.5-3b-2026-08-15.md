# NEX Acceptance Test · 15-Turn Conversation · V1 Step 2 (LLM Response Layer)

- Fixture: `acceptance-15turn-oak-staircase-2026-08-15` · 18 turns
- Purpose: Philip's V1 acceptance test: can a normal person have a 15-20 turn staircase conversation without repeatedly correcting NEX or reminding her what they're discussing?
- Persona: First-time buyer renovating a Victorian terrace hallway. Doesn't know trade terminology. Feels their way through the choice.
- Backend: **postgres** · Model: **qwen2.5:3b**
- Prose calls OK: **18** · errors: **0**
- Tokens: prompt **30271** · completion **720**
- Total cost this run: **$0** (`$0.000000`/turn)
- Prose latency avg: **2578.4ms** · P50 1913ms · P95 14571ms
- Faithfulness violations: **0**

## Final state snapshot
```json
{
  "current_topic": "bullnose",
  "established_facts": {
    "style_intent": {
      "value": "straight_flight",
      "turn_established": 3,
      "confidence": 0.765
    },
    "construction_context": {
      "value": "against_wall",
      "turn_established": 3,
      "confidence": 0.85
    },
    "material_primary": {
      "value": "oak",
      "turn_established": 31,
      "confidence": 0.85,
      "via": "correction"
    }
  },
  "entities_in_focus": [
    "staircase",
    "against_wall",
    "straight_flight",
    "traditional",
    "contemporary",
    "oak",
    "baluster",
    "base_rail",
    "string",
    "closed_string",
    "cut_string",
    "open_riser",
    "riser",
    "starting_step",
    "carpet",
    "price",
    "installation",
    "walnut",
    "handrail_height",
    "handrail",
    "tread",
    "bullnose",
    "timber",
    "metal"
  ],
  "constraints": [
    "against_wall"
  ],
  "corrections_log": [
    {
      "field": "material_primary",
      "previous": "oak",
      "new": "walnut",
      "turn": 29,
      "at": "2026-08-15T05:27:25.156Z"
    },
    {
      "field": "material_primary",
      "previous": "walnut",
      "new": "oak",
      "turn": 31,
      "at": "2026-08-15T05:27:26.962Z"
    }
  ],
  "turn_count": 36
}
```

## Turn-by-turn

### T1 · intent=`ask_definition` · entities=[staircase]

**Customer:** Hi, I'm renovating my hallway and I think I want a new staircase. Where do we start?

**NEX:** Given your preference for keeping some of the timber showing, a cut string staircase on the open side could be a good choice. Would you consider this option, or are you leaning towards a staircase against the wall for a smoother look?

_state after turn:_ topic=`staircase` · facts=`(none)` · focus=[staircase] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.473 · ""Which wood is best for stairs?""

_timings:_ total 15241ms · embed 655ms · retrieve 3ms · prose 14573ms · prose tokens 1324p/47c · $0.000000

---

### T2 · intent=`specify_constraint` · entities=[against_wall, straight_flight]

**Customer:** The current one is against a wall on one side and open on the other. It's a straight run up to the first floor.

**NEX:** For a staircase against a wall on one side, a cut string option would often be a good choice, giving a stepped look to the staircase. Do you prefer this option or are you leaning towards a smooth, closed string?

_state after turn:_ topic=`straight_flight` · facts=`style_intent=straight_flight · construction_context=against_wall` · focus=[staircase, against_wall, straight_flight] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.495 · ""I've got a staircase against a wall"

_timings:_ total 1822ms · embed 30ms · retrieve 4ms · prose 1786ms · prose tokens 1431p/46c · $0.000000

---

### T3 · intent=`statement` · entities=[traditional, contemporary, oak]

**Customer:** I like oak. The house is Victorian so I don't want it to look too modern.

**NEX:** For a Victorian staircase against a wall, a plain slim square oak balustrade might complement your aesthetic preferences without overwhelming the traditional feel. Would you like to explore price, installation, or a comparison with another option?

_state after turn:_ topic=`traditional` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.394 · "A common transitional look would be slim brushed stainless steel vertical rods with the oak handrail and oak newels. The oak stays, the balustrade lightens up, and the whole stairc"

_timings:_ total 1953ms · embed 19ms · retrieve 1ms · prose 1929ms · prose tokens 1631p/44c · $0.000000

---

### T4 · intent=`ask_what_about` · entities=[baluster, oak]

**Customer:** What about the balusters? I hear that word a lot and I'm not sure what looks good with oak.

**NEX:** Would you prefer a more contemporary look with plain slim square oak spindles at wider spacing, or do you lean towards the traditional feel with stainless steel balusters?

_state after turn:_ topic=`baluster` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.397 · "A common transitional look would be slim brushed stainless steel vertical rods with the oak handrail and oak newels. The oak stays, the balustrade lightens up, and the whole stairc"

_timings:_ total 1684ms · embed 12ms · retrieve 2ms · prose 1668ms · prose tokens 1693p/34c · $0.000000

---

### T5 · intent=`statement` · entities=[traditional, contemporary]

**Customer:** Something in between traditional and modern would be nice. My partner wants it to feel light.

**NEX:** For a light and transitional look, consider slim brushed stainless steel vertical rods paired with the oak handrail and newels. This option keeps the oak aesthetic while adding a modern touch. Would you like to explore this further?

_state after turn:_ topic=`traditional` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.498 · "Example: > Customer: "It's a staircase against a wall — I want the first step to feel special and modern balustrade." > NEX: "Wall-fixed staircase — so the first step's outward pro"

_timings:_ total 2088ms · embed 20ms · retrieve 3ms · prose 2063ms · prose tokens 1740p/45c · $0.000000

---

### T6 · intent=`ask_definition` · entities=[base_rail, string]

**Customer:** What is a base rail? I keep seeing it mentioned.

**NEX:** A base rail is the vertical board that supports the balusters and runs along the wall side of the staircase. It keeps the balusters in place and gives the staircase a finished look. Would you like to explore a different material or finish for your staircase?

_state after turn:_ topic=`base_rail` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string] · corrections_log=0

_top retrieved:_ `staircase-string-types-2026-08-15` · score 0.391 · "Interior residential straight-flight staircase in oak with a mixed string configuration — the OUTER (visible) string is a CLOSED string (smooth diagonal plank with a straight top e"

_timings:_ total 2176ms · embed 10ms · retrieve 2ms · prose 2163ms · prose tokens 1669p/52c · $0.000000

---

### T7 · intent=`confirm` · entities=[string]

**Customer:** Ok so do I need one? Depends on the string type?

**NEX:** Would you like to explore a cut-string staircase instead, which would keep the tread ends visible and give a more contemporary look?

_state after turn:_ topic=`string` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string] · corrections_log=0

_top retrieved:_ `staircase-string-types-2026-08-15` · score 0.364 · "Long straight double-side cut-string interior staircase with a small square top-landing (quarter landing) that sits against a wall. Both stringers show the stepped top profile with"

_timings:_ total 1600ms · embed 18ms · retrieve 6ms · prose 1574ms · prose tokens 1661p/26c · $0.000000

---

### T8 · intent=`compare` · entities=[closed_string, cut_string, string]

**Customer:** What's the difference between closed string and cut string?

**NEX:** For a straight-flight staircase in oak, a closed string is smooth and tidy, with the tread ends hidden. A cut string shows the tread steps, often used for a more traditional look. Which do you prefer?

_state after turn:_ topic=`closed_string` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.542 · "Use when: explaining the three-way base-rail rule (closed-string vs cut-string vs landing)."

_timings:_ total 1930ms · embed 13ms · retrieve 1ms · prose 1914ms · prose tokens 1611p/44c · $0.000000

---

### T9 · intent=`ask_definition` · entities=[open_riser, riser]

**Customer:** Is that the same as open riser?

**NEX:** A cut-string staircase with open risers would show visible tread ends, unlike a closed string where the risers are flush with the stringers. Would you like to explore price, installation, or a comparison?

_state after turn:_ topic=`open_riser` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser] · corrections_log=0

_top retrieved:_ `staircase-string-types-2026-08-15` · score 0.595 · "Long straight double-side cut-string interior staircase with a small square top-landing (quarter landing) that sits against a wall. Both stringers show the stepped top profile with"

_timings:_ total 1958ms · embed 14ms · retrieve 1ms · prose 1942ms · prose tokens 1669p/43c · $0.000000

---

### T10 · intent=`ask_recommendation` · entities=[against_wall, traditional, staircase, string, oak]

**Customer:** Got it. For our staircase (against a wall one side, oak, Victorian) which string type would you recommend?

**NEX:** For your Victorian oak staircase against a wall, a closed string would be a classic choice — it gives that smooth diagonal look without the tread ends showing. Would you prefer the open riser option instead?

_state after turn:_ topic=`traditional` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser] · corrections_log=0

_top retrieved:_ `staircase-string-types-2026-08-15` · score 0.485 · "Interior residential straight-flight staircase with OPEN RISERS — the vertical riser board between treads has been omitted, so you can see through between each tread. IMPORTANT: th"

_timings:_ total 1861ms · embed 12ms · retrieve 2ms · prose 1846ms · prose tokens 1692p/41c · $0.000000

---

### T11 · intent=`ask_what_about` · entities=[starting_step]

**Customer:** What about the bottom step? Can we do something a bit special there?

**NEX:** Would you prefer a wider first tread or a rounded feature for the starting step, given the Victorian style and oak timber?

_state after turn:_ topic=`starting_step` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.326 · "NEX response: > "So we're building a coherent modern staircase: extended feature first step in your chosen timber, frameless glass balustrade on the flight, and a matching modern l"

_timings:_ total 1652ms · embed 11ms · retrieve 1ms · prose 1640ms · prose tokens 1703p/25c · $0.000000

---

### T12 · intent=`ask_what_about` · entities=[starting_step, carpet, staircase, oak]

**Customer:** And can I carpet the flight but keep the bottom step in exposed oak?

**NEX:** Sure, with the oak for the first step and a glass balustrade for the flight, you could also consider a carpeted landing for a touch of warmth and contrast. Would you like to explore other options for the landing?

_state after turn:_ topic=`starting_step` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step, carpet] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.567 · "NEX: "So we're building a coherent modern staircase: extended feature first step in your chosen timber, frameless glass balustrade on the flight, and a matching modern landing rail"

_timings:_ total 2070ms · embed 15ms · retrieve 2ms · prose 2053ms · prose tokens 1743p/47c · $0.000000

---

### T13 · intent=`ask_price` · entities=[price]

**Customer:** How much roughly?

**NEX:** Would you like to explore the price, installation, or a comparison of the options we've discussed?

_state after turn:_ topic=`starting_step` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step, carpet, price] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.508 · "Example: > Customer: "I want a modern staircase with a nice big first step, glass above it and something modern around the landing." > NEX: "So we're building a coherent modern sta"

_timings:_ total 1472ms · embed 10ms · retrieve 4ms · prose 1457ms · prose tokens 1687p/21c · $0.000000

---

### T14 · intent=`ask_what_about` · entities=[installation]

**Customer:** And installation — is that separate?

**NEX:** Installation is typically a separate part of the project, so it would be priced and installed separately from the staircase itself. Would you like to discuss the price first?

_state after turn:_ topic=`starting_step` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step, carpet, price, installation] · corrections_log=0

_top retrieved:_ `staircase-multi-2026-08-15` · score 0.34 · "Interior straight-flight residential staircase (longer flight than _02) with oak treads, white-painted risers, oak newel post and black square vertical balusters. Curved (bullnose)"

_timings:_ total 1728ms · embed 7ms · retrieve 1ms · prose 1711ms · prose tokens 1714p/33c · $0.000000

---

### T15 · intent=`correct` · entities=[walnut]

**Customer:** Actually wait, let's switch to walnut. Does that change anything?

**NEX:** Got it — updating the current assumption to walnut. Would you like to explore the price, installation, or a comparison with the original oak staircase?

_state after turn:_ topic=`starting_step` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=walnut` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step, carpet, price, installation, walnut] · corrections_log=1

_top retrieved:_ `conv-intel-2026-08-14` · score 0.367 · "NEX response: > "So we're building a coherent modern staircase: extended feature first step in your chosen timber, frameless glass balustrade on the flight, and a matching modern l"

_timings:_ total 1809ms · embed 17ms · retrieve 2ms · prose 1789ms · prose tokens 1775p/30c · $0.000000

---

### T16 · intent=`correct` · entities=[handrail_height, oak, handrail]

**Customer:** Ok back to oak. Sorry. What about the handrail height — is there a rule?

**NEX:** Got it — switching from walnut to oak. A common transitional look would be slim brushed stainless steel vertical rods with the oak handrail and oak newels, keeping the traditional feel while making it more modern. Would you like to explore the price, installation options, or a comparison with other materials?

_state after turn:_ topic=`handrail` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step, carpet, price, installation, walnut, handrail_height, handrail] · corrections_log=2

_top retrieved:_ `conv-intel-2026-08-14` · score 0.539 · "A common transitional look would be slim brushed stainless steel vertical rods with the oak handrail and oak newels. The oak stays, the balustrade lightens up, and the whole stairc"

_timings:_ total 2372ms · embed 14ms · retrieve 2ms · prose 2355ms · prose tokens 1838p/60c · $0.000000

---

### T17 · intent=`ask_recommendation` · entities=[baluster, tread]

**Customer:** Between two balusters per tread and one, which do you recommend for our set-up?

**NEX:** For a traditional oak staircase against a wall, two balusters per tread is a common practical arrangement that gives a balanced appearance. Would you like to explore price, installation, or a comparison?

_state after turn:_ topic=`baluster` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step, carpet, price, installation, walnut, handrail_height, handrail, tread] · corrections_log=2

_top retrieved:_ `conv-intel-2026-08-14` · score 0.441 · "Template: > "Two balusters per tread is a common practical starting arrangement for many traditional staircase designs — it gives a balanced appearance and consistent spacing. Wher"

_timings:_ total 1902ms · embed 8ms · retrieve 1ms · prose 1893ms · prose tokens 1815p/39c · $0.000000

---

### T18 · intent=`confirm` · entities=[bullnose, closed_string, baluster, carpet, handrail, timber, staircase, metal, handrail_height, oak, starting_step, string]

**Customer:** Perfect. To summarise: oak, closed string with cut wall option, bullnose starting step, exposed timber, carpeted flight above, matt-black slim metal balusters, 900mm handrail. Sound right?

**NEX:** Continuing with oak, straight-flight staircase against a wall, a closed string with a cut wall option seems to fit well. Would you like to explore the price, installation, or a comparison with another option?

_state after turn:_ topic=`bullnose` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step, carpet, price, installation, walnut, handrail_height, handrail, tread, bullnose, timber, metal] · corrections_log=2

_top retrieved:_ `conv-intel-2026-08-14` · score 0.601 · "A common transitional look would be slim brushed stainless steel vertical rods with the oak handrail and oak newels. The oak stays, the balustrade lightens up, and the whole stairc"

_timings:_ total 2083ms · embed 19ms · retrieve 2ms · prose 2062ms · prose tokens 1875p/43c · $0.000000

---
