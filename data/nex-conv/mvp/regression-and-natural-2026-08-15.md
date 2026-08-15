# NEX conversation · regression + 25-turn natural test · 2026-08-15

- Regression fixtures: **15/15 probes passed**
- Natural conversation: **25 turns**, avg **2196.6ms** per turn
- Final state: material=oak · style=traditional · constraints=[against_wall] · corrections=2

## Regression per-fixture

### reg-fix-4-hello-meta · 2/2
_Fix 4 — meta greetings must NOT force staircase advice_

- **✓** `meta_greeting` · Customer: *hello*
  NEX: Hi there — how can I help?
- **✓** `meta_greeting` · Customer: *hi there*
  NEX: Hi there — how can I help?

### reg-fix-4-presence-check · 2/2
_Fix 4 — presence checks must confirm you're there, not talk staircases_

- **✓** `meta_presence` · Customer: *Is anyone online?*
  NEX: No problem, I'm here and ready to help. How can I assist you today?
- **✓** `meta_presence` · Customer: *are you there?*
  NEX: Hi — I'm here, no problem. How can I help?

### reg-fix-4-identity · 1/1
_Fix 4 — 'who are you' should identify as Summit assistant, not reveal AI model_

- **✓** `meta_identity` · Customer: *who are you?*
  NEX: Apologies, I was quiet there. I'm NEX, your advisor for staircase solutions. How can I help today?

### reg-fix-1-price-no-fabrication · 2/2
_Fix 1 — asking for a price when NO price is in the packet must NOT invent a £ figure_

- **✓** `specify_material` · Customer: *I'm looking for an oak staircase*
  NEX: Given your preference for oak, would you consider a closed string staircase for the wall?
- **✓** `ask_price` · Customer: *How much would that cost?*
  NEX: Would you like to explore any other aspects of the staircase design before we discuss the cost?

### reg-fix-1-price-range-no-fabrication · 2/2
_Fix 1 — invented price RANGES also count as fabrication_

- **✓** `specify_material` · Customer: *I want a walnut staircase*
  NEX: Given your preference for walnut, would you consider a closed string look for the staircase?
- **✓** `ask_price` · Customer: *roughly what's the price?*
  NEX: Given your preference for walnut, how about we discuss the overall size and layout of the staircase first? What's the approximate height and width you need?

### reg-fix-3-no-op-correction · 2/2
_Fix 3 — correcting to the CURRENT value should not narrate a state change_

- **✓** `specify_material` · Customer: *I'd like an oak staircase*
  NEX: Given your preference for oak, a closed string would often be a good fit for a traditional look. What about the style—traditional or something more contemporary in mind?
- **✓** `correct` · Customer: *No, I meant oak*
  NEX: Given your preference for oak, a closed string would often be a good fit for a traditional look. Would you prefer the closed string look with oak or consider an open string with another wood for contrast?

### reg-fix-2-pronoun-that · 2/2
_Fix 2 — 'is that expensive?' must resolve 'that' from state, not ask what_

- **✓** `specify_material` · Customer: *Can I have a bullnose starting step in oak?*
  NEX: Given your preference for a bullnose starting step in oak, how about considering a cut string for the open side?
- **✓** `ask_price` · Customer: *Is that expensive?*
  NEX: Given your preference for a bullnose starting step in oak, a cut string for the open side is often a bit more expensive to make and install. Would you like to explore this further?

### reg-fix-2-pronoun-the-other-one · 2/2
_Fix 2 — 'the other one' must resolve to prior alternative from state_

- **✓** `specify_style` · Customer: *Closed string or cut string for a Victorian oak staircase?*
  NEX: Given your preference for a Victorian look, would you lean towards the closed string for its traditional elegance or consider a cut string for a more contemporary feel?
- **✓** `statement` · Customer: *Tell me more about the other one*
  NEX: Given your preference for a Victorian look, would you prefer the closed string for its traditional elegance or consider a cut string for its contrasting profile?

## Natural 25-turn transcript

| T | Customer | Intent | Reply (first 180 chars) | Facts | Focus (top 4) | Latency |
|---|---|---|---|---|---|---|
| 1 | hi | meta_greeting | Hi there — how can I help? | — | — | 1385ms |
| 2 | u there? | meta_presence | Apologies, I'm ready and here. How can I help? | — | — | 1005ms |
| 3 | im looking to redo my staircase | statement | Given your staircase against the wall, a closed string is often the natural fit — smooth diagonal, tread ends hidden. If you'd rather see the tread ends step down as a feature, a c | — | staircase | 2877ms |
| 4 | its against a wall on one side | specify_constraint | Given your staircase against the wall, do you prefer a cut string for the open side? | construction_context=against_wall | staircase,against_wall | 2499ms |
| 5 | oak i think | specify_material | Given the oak you mentioned, would you consider a cut string for the open side? | construction_context=against_wall · material_primary=oak | staircase,against_wall,oak | 1929ms |
| 6 | what abt closed vs cut? | compare | Would you lean towards the closed string for its traditional look, or consider the cut string for a more contemporary feel? | construction_context=against_wall · material_primary=oak | staircase,against_wall,oak | 2094ms |
| 7 | and open riser too? | ask_what_about | Would you prefer the closed string for its traditional look, or the cut string for a more contemporary feel? | construction_context=against_wall · material_primary=oak | staircase,against_wall,oak,open_riser | 2089ms |
| 8 | hmm | backchannel | Take your time. I'm here when you're ready. | construction_context=against_wall · material_primary=oak | staircase,against_wall,oak,open_riser | 1293ms |
| 9 | which would you go for in a Victorian house | specify_style | Would you prefer the closed string for its traditional look, or the cut string for a more contemporary feel? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2095ms |
| 10 | how much roughly | ask_price | I don't want to guess figures — I can get you an accurate quote once we've talked through the specifics. What sort of size is your staircase, roughly? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2443ms |
| 11 | and installation - separate? | ask_what_about | Given the oak you mentioned and the traditional direction, a closed string with a smooth diagonal look would often be a good fit for your staircase. What size are you thinking of? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2429ms |
| 12 | wait sorry, what does 'base rail' mean | statement | Sure, how about explaining what a base rail is? It's like a vertical board that supports the handrail at the base of the staircase. Does that help clarify? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2554ms |
| 13 | does that apply to cut string too | statement | Sure, does the base rail apply to both closed string and cut string? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 1972ms |
| 14 | actually let's switch to walnut | correct | Given the walnut you mentioned, a closed string with walnut would provide a traditional look that suits your preference. Would you prefer that or consider an open string with oak f | construction_context=against_wall · material_primary=walnut · style_intent=traditional | staircase,against_wall,oak,open_riser | 2459ms |
| 15 | does that change the recommendation | statement | Given the walnut you mentioned, a closed string with walnut would provide a traditional look that suits your preference. Would you prefer that or consider an open string with oak f | construction_context=against_wall · material_primary=walnut · style_intent=traditional | staircase,against_wall,oak,open_riser | 2297ms |
| 16 | no back to oak | correct | Given your preference for oak, an interior residential staircase with a closed string in oak would offer a traditional look that aligns well with your style. Would you like to expl | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2386ms |
| 17 | sorry for the flip flopping | correct | Given your preference for oak, a closed string staircase would indeed offer a traditional look that aligns well with your style. Would you like to explore this option further? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2297ms |
| 18 | what about the bottom step - can it be something special? | ask_what_about | Given your preference for a traditional look with oak, would you consider a starting step with a bullnose detail to make the bottom step something special? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2296ms |
| 19 | bullnose yes | statement | Given your preference for a traditional look with oak and the bullnose detail, would you consider a starting step in exposed timber, with a step mat shaped for the curve to complem | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2386ms |
| 20 | and can i carpet the rest but keep that step in oak | ask_what_about | Given the oak you mentioned and the traditional direction, would you consider a starting step in exposed timber, with a bullnose detail? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2175ms |
| 21 | who am i actually talking to btw | meta_identity | No problem — I'm here and ready to help with your staircase needs. How can I assist you today? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 3064ms |
| 22 | cool, thanks | close | You're welcome — anything else I can help with? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 1025ms |
| 23 | one more - is there a rule for handrail height? | ask_definition | Given the oak you mentioned and the traditional direction, the handrail height typically falls within the UK Approved Document K range of 900mm to 1000mm measured vertically above  | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2906ms |
| 24 | perfect. summary: oak, against wall, closed string with cut wall option, bullnose bottom step exposed, carpeted flight above, 900mm handrail | confirm | Given your summary, it sounds like a closed string with a cut wall option would be a good fit. Would you like to proceed with that, or do you have any other preferences? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2357ms |
| 25 | sound right? | ask_definition | Perfect, the staircase you're thinking of with an oak finish against the wall would suit a closed string, which has a smooth diagonal look with treads hidden. Would you like to pro | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2602ms |
