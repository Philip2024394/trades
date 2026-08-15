# NEX Acceptance Test · 15-Turn Conversation · V1 Step 2 (LLM Response Layer)

- Fixture: `acceptance-15turn-oak-staircase-2026-08-15` · 18 turns
- Purpose: Philip's V1 acceptance test: can a normal person have a 15-20 turn staircase conversation without repeatedly correcting NEX or reminding her what they're discussing?
- Persona: First-time buyer renovating a Victorian terrace hallway. Doesn't know trade terminology. Feels their way through the choice.
- Backend: **postgres** · Model: **anthropic/claude-haiku-4.5**
- Prose calls OK: **18** · errors: **0**
- Tokens: prompt **25093** · completion **925**
- Total cost this run: **$0** (`$0.000000`/turn)
- Prose latency avg: **2128.2ms** · P50 2014ms · P95 3253ms
- Faithfulness violations: **0**

## Final state snapshot
```json
{
  "current_topic": "bullnose",
  "established_facts": {
    "style_intent": {
      "value": "straight_flight",
      "turn_established": 3,
      "confidence": 0.49500000000000005
    },
    "material_primary": {
      "value": "walnut",
      "turn_established": 29,
      "confidence": 0.95,
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
  "constraints": [],
  "corrections_log": [],
  "turn_count": 36
}
```

## Turn-by-turn

### T1 · intent=`ask_definition` · entities=[staircase]

**Customer:** Hi, I'm renovating my hallway and I think I want a new staircase. Where do we start?

**NEX:** Is your staircase against a wall on one side, or open on both sides?

_state after turn:_ topic=`staircase` · facts=`(none)` · focus=[staircase] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.473 · ""Which wood is best for stairs?""

_timings:_ total 4879ms · embed 3103ms · retrieve 3ms · prose 1764ms · prose tokens 1085p/17c · $0.000000

---

### T2 · intent=`statement` · entities=[against_wall, straight_flight]

**Customer:** The current one is against a wall on one side and open on the other. It's a straight run up to the first floor.

**NEX:** Is your staircase against a wall on one side, or open on both sides?

_state after turn:_ topic=`straight_flight` · facts=`style_intent=straight_flight` · focus=[staircase, against_wall, straight_flight] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.495 · ""I've got a staircase against a wall"

_timings:_ total 1288ms · embed 28ms · retrieve 2ms · prose 1255ms · prose tokens 1177p/17c · $0.000000

---

### T3 · intent=`statement` · entities=[traditional, contemporary, oak]

**Customer:** I like oak. The house is Victorian so I don't want it to look too modern.

**NEX:** A common transitional look would be slim brushed stainless steel vertical rods with the oak handrail and oak newels. The oak stays, the balustrade lightens up, and the whole staircase feels more open without abandoning the traditional feel. An alternative could be plain slim square oak spindles at wider spacing. Is your staircase against a wall on one side, or open on both sides?

_state after turn:_ topic=`traditional` · facts=`style_intent=straight_flight` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.394 · "A common transitional look would be slim brushed stainless steel vertical rods with the oak handrail and oak newels. The oak stays, the balustrade lightens up, and the whole stairc"

_timings:_ total 2677ms · embed 20ms · retrieve 2ms · prose 2651ms · prose tokens 1350p/79c · $0.000000

---

### T4 · intent=`ask_what_about` · entities=[baluster, oak]

**Customer:** What about the balusters? I hear that word a lot and I'm not sure what looks good with oak.

**NEX:** Sure, a common option would be slim brushed stainless steel vertical rods with the oak handrail and newels. The oak stays and balustrade help keep it traditional while making it feel more open. Another option could be plain slim square oak spindles with a wider spacing. Would your staircase be against a wall on one side, or open on both?

_state after turn:_ topic=`baluster` · facts=`style_intent=straight_flight` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.397 · "A common transitional look would be slim brushed stainless steel vertical rods with the oak handrail and oak newels. The oak stays, the balustrade lightens up, and the whole stairc"

_timings:_ total 2597ms · embed 24ms · retrieve 2ms · prose 2569ms · prose tokens 1417p/73c · $0.000000

---

### T5 · intent=`statement` · entities=[traditional, contemporary]

**Customer:** Something in between traditional and modern would be nice. My partner wants it to feel light.

**NEX:** This is a commonly-recommended option; other options exist depending on your specific setup. Is your staircase against a wall on one side, or open on both sides?

_state after turn:_ topic=`traditional` · facts=`style_intent=straight_flight` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.498 · "Example: > Customer: "It's a staircase against a wall — I want the first step to feel special and modern balustrade." > NEX: "Wall-fixed staircase — so the first step's outward pro"

_timings:_ total 1775ms · embed 15ms · retrieve 2ms · prose 1758ms · prose tokens 1457p/34c · $0.000000

---

### T6 · intent=`ask_definition` · entities=[base_rail, string]

**Customer:** What is a base rail? I keep seeing it mentioned.

**NEX:** This is a commonly-recommended option; other options exist depending on your specific setup. Is your staircase against a wall on one side, or open on both sides?

_state after turn:_ topic=`base_rail` · facts=`style_intent=straight_flight` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string] · corrections_log=0

_top retrieved:_ `staircase-string-types-2026-08-15` · score 0.391 · "Interior residential straight-flight staircase in oak with a mixed string configuration — the OUTER (visible) string is a CLOSED string (smooth diagonal plank with a straight top e"

_timings:_ total 1728ms · embed 9ms · retrieve 1ms · prose 1717ms · prose tokens 1390p/34c · $0.000000

---

### T7 · intent=`confirm` · entities=[string]

**Customer:** Ok so do I need one? Depends on the string type?

**NEX:** This is a commonly-recommended option; other options exist depending on your specific setup. Is your staircase against a wall on one side, or open on both sides?

_state after turn:_ topic=`string` · facts=`style_intent=straight_flight` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string] · corrections_log=0

_top retrieved:_ `staircase-string-types-2026-08-15` · score 0.364 · "Long straight double-side cut-string interior staircase with a small square top-landing (quarter landing) that sits against a wall. Both stringers show the stepped top profile with"

_timings:_ total 1659ms · embed 16ms · retrieve 2ms · prose 1640ms · prose tokens 1378p/34c · $0.000000

---

### T8 · intent=`compare` · entities=[closed_string, cut_string, string]

**Customer:** What's the difference between closed string and cut string?

**NEX:** Closed string is like a smooth diagonal plank with treads hidden, while cut string has a stepped top edge with visible treads and balusters landing directly into them.

_state after turn:_ topic=`closed_string` · facts=`style_intent=straight_flight` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.542 · "Use when: explaining the three-way base-rail rule (closed-string vs cut-string vs landing)."

_timings:_ total 1791ms · embed 16ms · retrieve 1ms · prose 1773ms · prose tokens 1332p/34c · $0.000000

---

### T9 · intent=`ask_definition` · entities=[open_riser, riser]

**Customer:** Is that the same as open riser?

**NEX:** This is a commonly-recommended option; other options exist depending on your specific setup. Is your staircase against a wall on one side, or open on both sides?

_state after turn:_ topic=`open_riser` · facts=`style_intent=straight_flight` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser] · corrections_log=0

_top retrieved:_ `staircase-string-types-2026-08-15` · score 0.595 · "Long straight double-side cut-string interior staircase with a small square top-landing (quarter landing) that sits against a wall. Both stringers show the stepped top profile with"

_timings:_ total 1734ms · embed 19ms · retrieve 2ms · prose 1710ms · prose tokens 1390p/34c · $0.000000

---

### T10 · intent=`ask_recommendation` · entities=[against_wall, traditional, staircase, string, oak]

**Customer:** Got it. For our staircase (against a wall one side, oak, Victorian) which string type would you recommend?

**NEX:** This is a commonly-recommended option; other options exist depending on your specific setup. Is your staircase against a wall on one side, or open on both sides?

_state after turn:_ topic=`traditional` · facts=`style_intent=straight_flight` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser] · corrections_log=0

_top retrieved:_ `staircase-string-types-2026-08-15` · score 0.485 · "Interior residential straight-flight staircase with OPEN RISERS — the vertical riser board between treads has been omitted, so you can see through between each tread. IMPORTANT: th"

_timings:_ total 1734ms · embed 10ms · retrieve 1ms · prose 1723ms · prose tokens 1414p/34c · $0.000000

---

### T11 · intent=`ask_what_about` · entities=[starting_step]

**Customer:** What about the bottom step? Can we do something a bit special there?

**NEX:** Sure, we could extend the feature of the first step in oak, which is often a popular choice for modern staircases. This includes a frameless glass balustrade on the flight and a matching modern landing railing. Four choices unlock the rest: (1) timber species — oak is the common modern pick, walnut deeper and more traditional.

_state after turn:_ topic=`starting_step` · facts=`style_intent=straight_flight` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.326 · "NEX response: > "So we're building a coherent modern staircase: extended feature first step in your chosen timber, frameless glass balustrade on the flight, and a matching modern l"

_timings:_ total 2554ms · embed 19ms · retrieve 2ms · prose 2532ms · prose tokens 1427p/70c · $0.000000

---

### T12 · intent=`ask_what_about` · entities=[starting_step, carpet, staircase, oak]

**Customer:** And can I carpet the flight but keep the bottom step in exposed oak?

**NEX:** Sure, we can have the bottom step in exposed oak while carpeting the rest of the flight. Let's discuss the timber species for the treads and handrail. Would you prefer the staircase to be against a wall or open on both sides?

_state after turn:_ topic=`starting_step` · facts=`style_intent=straight_flight` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step, carpet] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.567 · "NEX: "So we're building a coherent modern staircase: extended feature first step in your chosen timber, frameless glass balustrade on the flight, and a matching modern landing rail"

_timings:_ total 2136ms · embed 16ms · retrieve 4ms · prose 2115ms · prose tokens 1467p/51c · $0.000000

---

### T13 · intent=`ask_price` · entities=[price]

**Customer:** How much roughly?

**NEX:** This is a commonly-recommended option; other options exist depending on your specific setup. Is your staircase against a wall on one side, or open on both sides?

_state after turn:_ topic=`starting_step` · facts=`style_intent=straight_flight` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step, carpet, price] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.508 · "Example: > Customer: "I want a modern staircase with a nice big first step, glass above it and something modern around the landing." > NEX: "So we're building a coherent modern sta"

_timings:_ total 1768ms · embed 15ms · retrieve 3ms · prose 1748ms · prose tokens 1407p/34c · $0.000000

---

### T14 · intent=`ask_what_about` · entities=[installation]

**Customer:** And installation — is that separate?

**NEX:** Understood — you're asking about installation in the context of a starting step. This is a commonly-recommended option; other options exist depending on your specific setup. Is your staircase against a wall on one side, or open on both sides?

_state after turn:_ topic=`starting_step` · facts=`style_intent=straight_flight` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step, carpet, price, installation] · corrections_log=0

_top retrieved:_ `staircase-multi-2026-08-15` · score 0.34 · "Interior straight-flight residential staircase (longer flight than _02) with oak treads, white-painted risers, oak newel post and black square vertical balusters. Curved (bullnose)"

_timings:_ total 2035ms · embed 12ms · retrieve 3ms · prose 2015ms · prose tokens 1438p/50c · $0.000000

---

### T15 · intent=`correct` · entities=[walnut]

**Customer:** Actually wait, let's switch to walnut. Does that change anything?

**NEX:** Got it — updating the current assumption. So we're building a coherent modern staircase: extended feature first step in your chosen timber, frameless glass balustrade on the flight, and a matching modern landing railing. Four choices unlock the rest: (1) timber species — oak is the common modern pick, walnut deeper and more traditional. This is a commonly-recommended option; other options exist depending on your specific setup. Is your staircase against a wall on one side, or open on both sides?

_state after turn:_ topic=`starting_step` · facts=`style_intent=straight_flight · material_primary=walnut` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step, carpet, price, installation, walnut] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.367 · "NEX response: > "So we're building a coherent modern staircase: extended feature first step in your chosen timber, frameless glass balustrade on the flight, and a matching modern l"

_timings:_ total 3265ms · embed 10ms · retrieve 2ms · prose 3253ms · prose tokens 1443p/102c · $0.000000

---

### T16 · intent=`confirm` · entities=[handrail_height, oak, handrail]

**Customer:** Ok back to oak. Sorry. What about the handrail height — is there a rule?

**NEX:** A common transitional look would be slim brushed stainless steel vertical rods with the oak handrail and oak newels. The oak stays, the balustrade lightens up, and the whole staircase feels more open without abandoning the traditional feel. This is a commonly-recommended option; other options exist depending on your specific setup. Is your staircase against a wall on one side, or open on both sides?

_state after turn:_ topic=`handrail` · facts=`style_intent=straight_flight · material_primary=walnut` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step, carpet, price, installation, walnut, handrail_height, handrail] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.539 · "A common transitional look would be slim brushed stainless steel vertical rods with the oak handrail and oak newels. The oak stays, the balustrade lightens up, and the whole stairc"

_timings:_ total 2935ms · embed 23ms · retrieve 2ms · prose 2908ms · prose tokens 1502p/81c · $0.000000

---

### T17 · intent=`ask_recommendation` · entities=[baluster, tread]

**Customer:** Between two balusters per tread and one, which do you recommend for our set-up?

**NEX:** Two balusters per tread is a common practical starting arrangement for many traditional staircase designs — it gives a balanced appearance and consistent spacing. This is a commonly-recommended option; other options exist depending on your specific setup. Is your staircase against a wall on one side, or open on both sides?

_state after turn:_ topic=`baluster` · facts=`style_intent=straight_flight · material_primary=walnut` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step, carpet, price, installation, walnut, handrail_height, handrail, tread] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.441 · "Template: > "Two balusters per tread is a common practical starting arrangement for many traditional staircase designs — it gives a balanced appearance and consistent spacing. Wher"

_timings:_ total 2298ms · embed 9ms · retrieve 0ms · prose 2289ms · prose tokens 1482p/60c · $0.000000

---

### T18 · intent=`confirm` · entities=[bullnose, closed_string, baluster, carpet, handrail, timber, staircase, metal, handrail_height, oak, starting_step, string]

**Customer:** Perfect. To summarise: oak, closed string with cut wall option, bullnose starting step, exposed timber, carpeted flight above, matt-black slim metal balusters, 900mm handrail. Sound right?

**NEX:** Continuing with walnut and a straight-flight staircase, a common transitional look would be slim brushed stainless steel vertical rods with the oak handrail and oak newels. The oak stays, the balustrade lightens up, and the whole staircase feels more open without abandoning the traditional feel. Alternative: plain slim square oak spindles at wider spacing. Is your staircase against a wall on one side, or open on both sides?

_state after turn:_ topic=`bullnose` · facts=`style_intent=straight_flight · material_primary=walnut` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step, carpet, price, installation, walnut, handrail_height, handrail, tread, bullnose, timber, metal] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.601 · "A common transitional look would be slim brushed stainless steel vertical rods with the oak handrail and oak newels. The oak stays, the balustrade lightens up, and the whole stairc"

_timings:_ total 2914ms · embed 19ms · retrieve 1ms · prose 2894ms · prose tokens 1537p/87c · $0.000000

---
