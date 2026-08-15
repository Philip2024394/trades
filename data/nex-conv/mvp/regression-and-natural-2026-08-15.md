# NEX conversation · regression + 25-turn natural test · 2026-08-15

- Regression fixtures: **15/15 probes passed**
- Natural conversation: **25 turns**, avg **1854.8ms** per turn
- Final state: material=oak · style=traditional · constraints=[against_wall] · corrections=2

## Regression per-fixture

### reg-fix-4-hello-meta · 2/2
_Fix 4 — meta greetings must NOT force staircase advice_

- **✓** `meta_greeting` · Customer: *hello*
  NEX: Hi there — how can I help?
- **✓** `meta_greeting` · Customer: *hi there*
  NEX: Hi — how can I help you today?

### reg-fix-4-presence-check · 2/2
_Fix 4 — presence checks must confirm you're there, not talk staircases_

- **✓** `meta_presence` · Customer: *Is anyone online?*
  NEX: Hi there — I'm here and ready to help. Is there something I can address?
- **✓** `meta_presence` · Customer: *are you there?*
  NEX: Hi there, how can I help you today?

### reg-fix-4-identity · 1/1
_Fix 4 — 'who are you' should identify as Summit assistant, not reveal AI model_

- **✓** `meta_identity` · Customer: *who are you?*
  NEX: Hi there — I'm the Summit staircase assistant. How can I help?

### reg-fix-1-price-no-fabrication · 2/2
_Fix 1 — asking for a price when NO price is in the packet must NOT invent a £ figure_

- **✓** `specify_material` · Customer: *I'm looking for an oak staircase*
  NEX: Given your preference for oak, a closed string staircase would be a classic choice with a smooth, traditional look. Would you like to see some examples of this style?
- **✓** `ask_price` · Customer: *How much would that cost?*
  NEX: I don't want to guess figures — I can get you an accurate quote once we've talked through the specifics. What sort of size is your staircase, roughly?

### reg-fix-1-price-range-no-fabrication · 2/2
_Fix 1 — invented price RANGES also count as fabrication_

- **✓** `specify_material` · Customer: *I want a walnut staircase*
  NEX: Given your preference for walnut, a closed string look would be a classic choice. Would you like to see examples of walnut in a closed string staircase?
- **✓** `ask_price` · Customer: *roughly what's the price?*
  NEX: Given your preference for walnut, a closed string look would be a classic choice. Would you like to see examples of walnut in a closed string staircase? What size are you thinking for your staircase, roughly?

### reg-fix-3-no-op-correction · 2/2
_Fix 3 — correcting to the CURRENT value should not narrate a state change_

- **✓** `specify_material` · Customer: *I'd like an oak staircase*
  NEX: Given your preference for oak, a closed string would often be a good fit for a traditional look. Would you consider that option, or are you leaning towards an open string with oak instead?
- **✓** `correct` · Customer: *No, I meant oak*
  NEX: Given your preference for oak, a closed string would often be a good fit for a traditional look. Would you consider that option, or are you leaning towards an open string with oak instead?

### reg-fix-2-pronoun-that · 2/2
_Fix 2 — 'is that expensive?' must resolve 'that' from state, not ask what_

- **✓** `specify_material` · Customer: *Can I have a bullnose starting step in oak?*
  NEX: For your oak staircase with a traditional look, a bullnose starting step is a popular choice. Would you like to see some examples of this in action?
- **✓** `ask_price` · Customer: *Is that expensive?*
  NEX: Given your oak staircase with a traditional look and the bullnose starting step you're after, a closed string is often the better fit. It's a bit more cost-effective and aligns well with the traditional aesthetic. Would you like to see some examples of this in

### reg-fix-2-pronoun-the-other-one · 2/2
_Fix 2 — 'the other one' must resolve to prior alternative from state_

- **✓** `ask_definition` · Customer: *Closed string or cut string for a Victorian oak staircase?*
  NEX: Given your Victorian oak staircase, a closed string with a traditional look would often be the best choice. It provides a smooth, elegant appearance with the tread ends hidden. Would you prefer this or consider a cut string with visible tread ends?
- **✓** `statement` · Customer: *Tell me more about the other one*
  NEX: Given your preference for a traditional look with the staircase against the wall, the cut string with visible tread ends might be a good alternative. Would you like to explore this further?

## Natural 25-turn transcript

| T | Customer | Intent | Reply (first 180 chars) | Facts | Focus (top 4) | Latency |
|---|---|---|---|---|---|---|
| 1 | hi | meta_greeting | Hi there — how can I help? | — | — | 1093ms |
| 2 | u there? | meta_presence | Hi there — I'm here and ready to help. Goes well? | — | — | 1057ms |
| 3 | im looking to redo my staircase | statement | Given your staircase against a wall, a closed string with oak would be a common choice. What do you think? | — | staircase | 1531ms |
| 4 | its against a wall on one side | specify_constraint | Given your staircase against a wall on one side, a closed string with oak would be a common choice. What do you think? | construction_context=against_wall | staircase,against_wall | 1597ms |
| 5 | oak i think | specify_material | Given the oak you mentioned, a closed string with oak would be a common choice for a traditional look. Would you prefer the closed string look with oak or consider an open string w | construction_context=against_wall · material_primary=oak | staircase,against_wall,oak | 1989ms |
| 6 | what abt closed vs cut? | compare | Would you lean towards the closed string look with oak or consider an open string with walnut for contrast? | construction_context=against_wall · material_primary=oak | staircase,against_wall,oak | 1580ms |
| 7 | and open riser too? | ask_what_about | Would you lean towards the closed string look with oak or consider an open string with walnut for contrast? | construction_context=against_wall · material_primary=oak | staircase,against_wall,oak,open_riser | 1578ms |
| 8 | hmm | backchannel | Take your time. I'm here when you're ready. | construction_context=against_wall · material_primary=oak | staircase,against_wall,oak,open_riser | 981ms |
| 9 | which would you go for in a Victorian house | statement | Given your interest in a Victorian house, a traditional look with a closed string and oak would often be a fitting choice. What do you think about that? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 1834ms |
| 10 | how much roughly | ask_price | Given your interest in a traditional look with an oak staircase against a wall, a closed string is often the natural fit. Would you like to see a couple of similar examples in our  | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2241ms |
| 11 | and installation - separate? | ask_what_about | Given your interest in a traditional look with an oak stairc, a closed string is often the natural fit against a wall. Would you like to explore the installation options separately | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2029ms |
| 12 | wait sorry, what does 'base rail' mean | statement | Apologies, I see we're still on the basics. A base rail is the vertical board at the bottom of the staircase that supports the handrail. Does that help clarify, or do you need more | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2118ms |
| 13 | does that apply to cut string too | statement | Sure, given your interest in a traditional look with an oak staircase, does the base rail apply to both closed and cut strings? Would you like to explore more about the base rail a | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2244ms |
| 14 | actually let's switch to walnut | correct | Given the walnut you mentioned, a cut string with walnut would offer a sleek, traditional look that complements the oak you're leaning towards. Would you prefer the base rail to be | construction_context=against_wall · material_primary=walnut · style_intent=traditional | staircase,against_wall,oak,open_riser | 2286ms |
| 15 | does that change the recommendation | statement | Given the walnut you mentioned, does that change the recommendation to a cut string with walnut for your traditional look? | construction_context=against_wall · material_primary=walnut · style_intent=traditional | staircase,against_wall,oak,open_riser | 1855ms |
| 16 | no back to oak | correct | Given your preference back to oak, a cut string with oak would offer a sleek, traditional look that complements the existing staircase. Would you like to explore this option furthe | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 1961ms |
| 17 | sorry for the flip flopping | correct | Understood, given your flip-flopping, let's clarify: a cut string with oak would offer a sleek, traditional look that complements the existing staircase. Would you prefer that over | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2055ms |
| 18 | what about the bottom step - can it be something special? | ask_what_about | Given your preference for something special at the bottom step, a cut string with a unique feature, such as a glass panel or a custom design, could really make a statement. What do | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2063ms |
| 19 | bullnose yes | statement | Sure, a cut string with oak would offer a sleek, traditional look that complements the existing staircase. For the bullnose, a custom design or a glass panel could be a special tou | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2207ms |
| 20 | and can i carpet the rest but keep that step in oak | ask_what_about | Given the oak you mentioned and the traditional direction, a cut string with the oak step would complement your staircase well. Would you like to keep the rest of the staircase car | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2291ms |
| 21 | who am i actually talking to btw | meta_identity | Hi there — I'm the Summit staircase assistant, here to help with your staircase needs. How can I assist you today? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 1253ms |
| 22 | cool, thanks | close | You're welcome. Anything else I can help with? | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 1011ms |
| 23 | one more - is there a rule for handrail height? | ask_definition | Given the oak you mentioned and your traditional direction, the UK Approved Document K sets the handrail height at 900mm–1000mm measured vertically above the pitch line of the flig | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2327ms |
| 24 | perfect. summary: oak, against wall, closed string with cut wall option, bullnose bottom step exposed, carpeted flight above, 900mm handrail | confirm | Perfect. So, with the oak, against the wall, and the closed string with a cut wall option, and the bullnose bottom step exposed, and the carpeted flight above, and the 900mm handra | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2758ms |
| 25 | sound right? | ask_definition | Perfect. So, with the oak, against the wall, and the closed string with a cut wall option, and the bullnose bottom step exposed, and the carpeted flight above, 900mm handrail heigh | construction_context=against_wall · material_primary=oak · style_intent=traditional | staircase,against_wall,oak,open_riser | 2430ms |
