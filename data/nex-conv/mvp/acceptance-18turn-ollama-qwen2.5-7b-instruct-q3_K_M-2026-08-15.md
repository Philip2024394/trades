# NEX Acceptance Test · 15-Turn Conversation · V1 Step 2 (LLM Response Layer)

- Fixture: `acceptance-15turn-oak-staircase-2026-08-15` · 18 turns
- Purpose: Philip's V1 acceptance test: can a normal person have a 15-20 turn staircase conversation without repeatedly correcting NEX or reminding her what they're discussing?
- Persona: First-time buyer renovating a Victorian terrace hallway. Doesn't know trade terminology. Feels their way through the choice.
- Backend: **postgres** · Model: **qwen2.5:7b-instruct-q3_K_M**
- Prose calls OK: **18** · errors: **0**
- Tokens: prompt **30340** · completion **953**
- Total cost this run: **$0** (`$0.000000`/turn)
- Prose latency avg: **9886.1ms** · P50 10049ms · P95 12857ms
- Faithfulness violations: **1**
  - ⚠ "£" — the ingested corpus doesn't carry specific prices — Haiku must not fabricate them

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
      "at": "2026-08-15T05:24:19.845Z"
    },
    {
      "field": "material_primary",
      "previous": "walnut",
      "new": "oak",
      "turn": 31,
      "at": "2026-08-15T05:24:28.877Z"
    }
  ],
  "turn_count": 36
}
```

## Turn-by-turn

### T1 · intent=`ask_definition` · entities=[staircase]

**Customer:** Hi, I'm renovating my hallway and I think I want a new staircase. Where do we start?

**NEX:** First, we need to decide if your staircase is against a wall or open on both sides. This will help us choose the right style, like a closed string or cut string. Which side does your staircase face?

_state after turn:_ topic=`staircase` · facts=`(none)` · focus=[staircase] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.473 · ""Which wood is best for stairs?""

_timings:_ total 11706ms · embed 729ms · retrieve 4ms · prose 10962ms · prose tokens 1324p/44c · $0.000000

---

### T2 · intent=`specify_constraint` · entities=[against_wall, straight_flight]

**Customer:** The current one is against a wall on one side and open on the other. It's a straight run up to the first floor.

**NEX:** For a staircase against a wall on one side and open on the other, a cut string is often used on the open side to show the tread edges, while the near-wall side can have a closed string for a cleaner look. Which style do you prefer?

_state after turn:_ topic=`straight_flight` · facts=`style_intent=straight_flight · construction_context=against_wall` · focus=[staircase, against_wall, straight_flight] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.495 · ""I've got a staircase against a wall"

_timings:_ total 8719ms · embed 14ms · retrieve 6ms · prose 8696ms · prose tokens 1431p/53c · $0.000000

---

### T3 · intent=`statement` · entities=[traditional, contemporary, oak]

**Customer:** I like oak. The house is Victorian so I don't want it to look too modern.

**NEX:** For a Victorian-style staircase, a slim brushed stainless steel balustrade with oak spindles and handrail can offer a modern touch while keeping the traditional look. Alternatively, plain slim square oak spindles at wider spacing could work too. Which style do you prefer?

_state after turn:_ topic=`traditional` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.394 · "A common transitional look would be slim brushed stainless steel vertical rods with the oak handrail and oak newels. The oak stays, the balustrade lightens up, and the whole stairc"

_timings:_ total 10064ms · embed 11ms · retrieve 2ms · prose 10049ms · prose tokens 1631p/56c · $0.000000

---

### T4 · intent=`ask_what_about` · entities=[baluster, oak]

**Customer:** What about the balusters? I hear that word a lot and I'm not sure what looks good with oak.

**NEX:** Understood — you're asking about balusters, oak in the context of a traditional Victorian staircase. A common choice is slim brushed stainless steel vertical rods with the oak handrail and newels. An alternative could be plain slim square oak spindles at wider spacing. Which style do you prefer?

_state after turn:_ topic=`baluster` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.397 · "A common transitional look would be slim brushed stainless steel vertical rods with the oak handrail and oak newels. The oak stays, the balustrade lightens up, and the whole stairc"

_timings:_ total 10557ms · embed 11ms · retrieve 1ms · prose 10545ms · prose tokens 1693p/61c · $0.000000

---

### T5 · intent=`statement` · entities=[traditional, contemporary]

**Customer:** Something in between traditional and modern would be nice. My partner wants it to feel light.

**NEX:** A slim brushed stainless steel balustrade could give a modern light feel while still using your oak treads. This keeps the traditional look but adds a contemporary touch. What do you think about that?

_state after turn:_ topic=`traditional` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.498 · "Example: > Customer: "It's a staircase against a wall — I want the first step to feel special and modern balustrade." > NEX: "Wall-fixed staircase — so the first step's outward pro"

_timings:_ total 7584ms · embed 10ms · retrieve 2ms · prose 7571ms · prose tokens 1740p/41c · $0.000000

---

### T6 · intent=`ask_definition` · entities=[base_rail, string]

**Customer:** What is a base rail? I keep seeing it mentioned.

**NEX:** A base rail is a horizontal timber that runs along the bottom of the balusters, giving support and a finished look. For your oak staircase, it often runs along the bottom of the visible string, creating a clean line. Would you like to explore price, installation, or a comparison?

_state after turn:_ topic=`base_rail` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string] · corrections_log=0

_top retrieved:_ `staircase-string-types-2026-08-15` · score 0.391 · "Interior residential straight-flight staircase in oak with a mixed string configuration — the OUTER (visible) string is a CLOSED string (smooth diagonal plank with a straight top e"

_timings:_ total 10348ms · embed 8ms · retrieve 2ms · prose 10337ms · prose tokens 1669p/59c · $0.000000

---

### T7 · intent=`confirm` · entities=[string]

**Customer:** Ok so do I need one? Depends on the string type?

**NEX:** For your straight-flight staircase against a wall, a cut string is common as it shows the tread ends and balances with the slim balusters. A closed string is another option, hiding the tread ends for a smoother look. Which would you prefer?

_state after turn:_ topic=`string` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string] · corrections_log=0

_top retrieved:_ `staircase-string-types-2026-08-15` · score 0.364 · "Long straight double-side cut-string interior staircase with a small square top-landing (quarter landing) that sits against a wall. Both stringers show the stepped top profile with"

_timings:_ total 8790ms · embed 9ms · retrieve 1ms · prose 8779ms · prose tokens 1661p/50c · $0.000000

---

### T8 · intent=`compare` · entities=[closed_string, cut_string, string]

**Customer:** What's the difference between closed string and cut string?

**NEX:** Closed string keeps the tread ends hidden, while cut string has a stepped top edge and the tread ends are visible. Which style do you prefer?

_state after turn:_ topic=`closed_string` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.542 · "Use when: explaining the three-way base-rail rule (closed-string vs cut-string vs landing)."

_timings:_ total 5957ms · embed 38ms · retrieve 1ms · prose 5916ms · prose tokens 1611p/30c · $0.000000

---

### T9 · intent=`ask_definition` · entities=[open_riser, riser]

**Customer:** Is that the same as open riser?

**NEX:** A cut-string staircase has a stepped top edge where the balusters land into the treads. An open riser means there's no vertical board between treads, making them visible from side to side. Which would you prefer for your staircase?

_state after turn:_ topic=`open_riser` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser] · corrections_log=0

_top retrieved:_ `staircase-string-types-2026-08-15` · score 0.595 · "Long straight double-side cut-string interior staircase with a small square top-landing (quarter landing) that sits against a wall. Both stringers show the stepped top profile with"

_timings:_ total 8873ms · embed 7ms · retrieve 2ms · prose 8863ms · prose tokens 1669p/50c · $0.000000

---

### T10 · intent=`ask_recommendation` · entities=[against_wall, traditional, staircase, string, oak]

**Customer:** Got it. For our staircase (against a wall one side, oak, Victorian) which string type would you recommend?

**NEX:** For a Victorian oak straight-flight staircase against a wall, a closed string is often the natural choice—it gives a smooth, elegant look with hidden tread ends. If you prefer to see the tread steps, a cut string could be an alternative. Which direction do you think suits your staircase better?

_state after turn:_ topic=`traditional` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser] · corrections_log=0

_top retrieved:_ `staircase-string-types-2026-08-15` · score 0.485 · "Interior residential straight-flight staircase with OPEN RISERS — the vertical riser board between treads has been omitted, so you can see through between each tread. IMPORTANT: th"

_timings:_ total 10809ms · embed 13ms · retrieve 2ms · prose 10794ms · prose tokens 1692p/59c · $0.000000

---

### T11 · intent=`ask_what_about` · entities=[starting_step]

**Customer:** What about the bottom step? Can we do something a bit special there?

**NEX:** Understood — you're asking about the starting step in your modern oak staircase. One option is to extend the first step, making it more prominent. Another is to use a wider tread at the bottom. Which would you prefer?

_state after turn:_ topic=`starting_step` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.326 · "NEX response: > "So we're building a coherent modern staircase: extended feature first step in your chosen timber, frameless glass balustrade on the flight, and a matching modern l"

_timings:_ total 9804ms · embed 12ms · retrieve 2ms · prose 9789ms · prose tokens 1703p/47c · $0.000000

---

### T12 · intent=`ask_what_about` · entities=[starting_step, carpet, staircase, oak]

**Customer:** And can I carpet the flight but keep the bottom step in exposed oak?

**NEX:** Understood — you're asking about the bottom step, carpet, and keeping the bottom step in exposed oak. For the bottom step, a closed string is often used to maintain a smooth look, while a cut string keeps the tread ends visible. Would you prefer a subtle carpet transition at the bottom step or a more seamless look?

_state after turn:_ topic=`starting_step` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step, carpet] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.567 · "NEX: "So we're building a coherent modern staircase: extended feature first step in your chosen timber, frameless glass balustrade on the flight, and a matching modern landing rail"

_timings:_ total 12896ms · embed 17ms · retrieve 18ms · prose 12860ms · prose tokens 1743p/67c · $0.000000

---

### T13 · intent=`ask_price` · entities=[price]

**Customer:** How much roughly?

**NEX:** For a modern oak staircase with a big first step and glass above, the design is looking great. Prices can vary, but a typical modern staircase like this might start from around £5,000 to £10,000. Would you like to explore price options or discuss the design in more detail?

_state after turn:_ topic=`starting_step` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step, carpet, price] · corrections_log=0

_top retrieved:_ `conv-intel-2026-08-14` · score 0.508 · "Example: > Customer: "I want a modern staircase with a nice big first step, glass above it and something modern around the landing." > NEX: "So we're building a coherent modern sta"

_timings:_ total 11357ms · embed 68ms · retrieve 20ms · prose 11265ms · prose tokens 1687p/66c · $0.000000

---

### T14 · intent=`ask_what_about` · entities=[installation]

**Customer:** And installation — is that separate?

**NEX:** Understood — you're asking about installation in the context of the oak staircase. Installation is usually a separate step, but it depends on your specific needs. Would you like to explore price, installation, or a comparison?

_state after turn:_ topic=`starting_step` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step, carpet, price, installation] · corrections_log=0

_top retrieved:_ `staircase-multi-2026-08-15` · score 0.34 · "Interior straight-flight residential staircase (longer flight than _02) with oak treads, white-painted risers, oak newel post and black square vertical balusters. Curved (bullnose)"

_timings:_ total 8518ms · embed 35ms · retrieve 16ms · prose 8453ms · prose tokens 1714p/45c · $0.000000

---

### T15 · intent=`correct` · entities=[walnut]

**Customer:** Actually wait, let's switch to walnut. Does that change anything?

**NEX:** Got it — updating the current assumption. With walnut now chosen, we can keep the modern look. A closed string or cut string could work well, depending on your preference for the tread edges. Which style do you like better?

_state after turn:_ topic=`starting_step` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=walnut` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step, carpet, price, installation, walnut] · corrections_log=1

_top retrieved:_ `conv-intel-2026-08-14` · score 0.367 · "NEX response: > "So we're building a coherent modern staircase: extended feature first step in your chosen timber, frameless glass balustrade on the flight, and a matching modern l"

_timings:_ total 9017ms · embed 17ms · retrieve 4ms · prose 8985ms · prose tokens 1757p/47c · $0.000000

---

### T16 · intent=`correct` · entities=[handrail_height, oak, handrail]

**Customer:** Ok back to oak. Sorry. What about the handrail height — is there a rule?

**NEX:** Got it — swapping oak for walnut. For handrail height, there's a common rule of around 900mm from the nosing of the tread to the top of the handrail. This ensures safety and comfort. Would you like to explore price, installation, or a comparison with different styles?

_state after turn:_ topic=`handrail` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step, carpet, price, installation, walnut, handrail_height, handrail] · corrections_log=2

_top retrieved:_ `conv-intel-2026-08-14` · score 0.539 · "A common transitional look would be slim brushed stainless steel vertical rods with the oak handrail and oak newels. The oak stays, the balustrade lightens up, and the whole stairc"

_timings:_ total 12018ms · embed 23ms · retrieve 21ms · prose 11973ms · prose tokens 1867p/63c · $0.000000

---

### T17 · intent=`ask_recommendation` · entities=[baluster, tread]

**Customer:** Between two balusters per tread and one, which do you recommend for our set-up?

**NEX:** Two balusters per tread is a common practical choice, giving a balanced look. With the staircase against a wall, this arrangement often works well. Would you like to explore price, installation, or a comparison with another option?

_state after turn:_ topic=`baluster` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step, carpet, price, installation, walnut, handrail_height, handrail, tread] · corrections_log=2

_top retrieved:_ `conv-intel-2026-08-14` · score 0.441 · "Template: > "Two balusters per tread is a common practical starting arrangement for many traditional staircase designs — it gives a balanced appearance and consistent spacing. Wher"

_timings:_ total 9797ms · embed 100ms · retrieve 3ms · prose 9692ms · prose tokens 1844p/46c · $0.000000

---

### T18 · intent=`confirm` · entities=[bullnose, closed_string, baluster, carpet, handrail, timber, staircase, metal, handrail_height, oak, starting_step, string]

**Customer:** Perfect. To summarise: oak, closed string with cut wall option, bullnose starting step, exposed timber, carpeted flight above, matt-black slim metal balusters, 900mm handrail. Sound right?

**NEX:** Oak, closed string with a cut wall option, bullnose starting step, exposed timber, carpeted flight above, and matt-black slim metal balusters sound like a great choice. This design keeps a traditional feel while adding modern elements. Would you like to explore price, installation, or a comparison with the alternative balustrade options?

_state after turn:_ topic=`bullnose` · facts=`style_intent=straight_flight · construction_context=against_wall · material_primary=oak` · focus=[staircase, against_wall, straight_flight, traditional, contemporary, oak, baluster, base_rail, string, closed_string, cut_string, open_riser, riser, starting_step, carpet, price, installation, walnut, handrail_height, handrail, tread, bullnose, timber, metal] · corrections_log=2

_top retrieved:_ `conv-intel-2026-08-14` · score 0.601 · "A common transitional look would be slim brushed stainless steel vertical rods with the oak handrail and oak newels. The oak stays, the balustrade lightens up, and the whole stairc"

_timings:_ total 12530ms · embed 73ms · retrieve 12ms · prose 12443ms · prose tokens 1904p/69c · $0.000000

---
